import { Message, PermissionFlagsBits } from 'discord.js';
import { db } from '../state/db.js';
import { UIFactory } from '../ui/factory.js';
import { handlePrefixCommand } from '../handlers/prefix.js';
import type { VeluClient } from '../types/index.js';

// Cooldown map to prevent AFK notification spam: key is "authorId:afkUserId" -> timestamp
const afkCooldowns = new Map<string, number>();
const COOLDOWN_MS = 60 * 1000; // 1 minute cooldown per mentioner-mentioned pair

// ── Performance: Periodic AFK cooldown cleanup instead of letting it grow unbounded ──
let lastAfkCleanup = 0;
const AFK_CLEANUP_INTERVAL_MS = 300_000; // 5 minutes

// Automod: spam detection map — key is "guildId:userId" -> array of timestamps
const spamTracker = new Map<string, number[]>();
const SPAM_THRESHOLD = 5; // messages
const SPAM_WINDOW_MS = 5 * 1000; // within 5 seconds

// ── Performance: Pre-compiled regex (compiled once, not per message) ──
const INVITE_REGEX = /(discord\.gg|discord\.com\/invite)\/[a-zA-Z0-9]+/i;

export const name = 'messageCreate';
export const once = false;

export async function execute(message: Message, client: VeluClient): Promise<void> {
  // Fast exit for bots and DMs
  if (message.author.bot || !message.guild) return;

  const now = Date.now();
  const guildId = message.guild.id;
  const userId = message.author.id;

  // ── Performance: Run prefix command and AFK check concurrently ──
  // Prefix commands don't depend on AFK state, so they can run in parallel
  const prefixPromise = handlePrefixCommand(message);

  // 1. Welcome Back: check if sender is AFK (in-memory lookup, O(1))
  const senderAFK = db.getAFK(userId);
  if (senderAFK) {
    db.clearAFK(userId);
    
    const durationMs = now - senderAFK.timestamp;
    const minutes = Math.floor(durationMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    let durationText = `${minutes}m`;
    if (hours > 0) {
      durationText = `${hours}h ${minutes % 60}m`;
    }
    if (minutes === 0) {
      durationText = 'less than a minute';
    }

    const embed = UIFactory.success(
      'Welcome Back!',
      `I have removed your AFK status. You were gone for **${durationText}**.`
    );
    message.reply({ embeds: [embed] }).then(msg => {
      setTimeout(() => msg.delete().catch(() => {}), 5000);
    }).catch(() => {});
  }

  // 2. Mentions Check: check if anyone mentioned is AFK
  if (message.mentions.users.size > 0) {
    // Lazy cleanup of AFK cooldowns
    if (now - lastAfkCleanup > AFK_CLEANUP_INTERVAL_MS) {
      lastAfkCleanup = now;
      for (const [key, ts] of afkCooldowns) {
        if (now - ts > COOLDOWN_MS) afkCooldowns.delete(key);
      }
    }

    for (const [mentionedId, user] of message.mentions.users) {
      if (mentionedId === userId) continue;

      const afkData = db.getAFK(mentionedId);
      if (afkData) {
        const cooldownKey = `${userId}:${mentionedId}`;
        const lastNotified = afkCooldowns.get(cooldownKey) || 0;

        if (now - lastNotified > COOLDOWN_MS) {
          afkCooldowns.set(cooldownKey, now);

          const timeSince = `<t:${Math.floor(afkData.timestamp / 1000)}:R>`;
          const description = `**${user.username}** went AFK ${timeSince}:\n> ${afkData.reason}`;

          const embed = UIFactory.premium(`💤 ${user.username} is AFK`, description, {
            footerText: 'Away From Keyboard',
            timestamp: false
          });

          await message.reply({ embeds: [embed] });
        }
      }
    }
  }

  // 3. Automod & Security Rules
  const config = db.getConfig(guildId);
  if (config.automodEnabled) {
    const member = message.member;
    const isMod = member?.permissions.has(PermissionFlagsBits.ManageMessages) ?? false;

    if (!isMod) {
      let shouldDelete = false;
      let violationReason = '';

      // 3a. Spam Filter
      if (config.automodSpamFilter) {
        const spamKey = `${guildId}:${userId}`;
        const timestamps = spamTracker.get(spamKey) || [];
        const filtered = timestamps.filter(t => now - t < SPAM_WINDOW_MS);
        filtered.push(now);
        spamTracker.set(spamKey, filtered);

        if (filtered.length >= SPAM_THRESHOLD) {
          shouldDelete = true;
          violationReason = 'Spam detected — please slow down!';
          spamTracker.set(spamKey, []);
        }
      }

      // 3b. Invite Block
      if (!shouldDelete && config.automodBlockInvites && INVITE_REGEX.test(message.content)) {
        shouldDelete = true;
        violationReason = 'Discord invite links are not allowed here.';
      }

      // 3c. Bad Words
      if (!shouldDelete && config.automodBadwords && config.automodBadwordsList.length > 0) {
        const lowerContent = message.content.toLowerCase();
        const found = config.automodBadwordsList.find(word => lowerContent.includes(word));
        if (found) {
          shouldDelete = true;
          violationReason = 'Your message contained a flagged word.';
        }
      }

      if (shouldDelete) {
        // Fire-and-forget: don't await these
        message.delete().catch(() => {});
        message.author.send({
          embeds: [UIFactory.warning(
            '🛡️ Automod Warning',
            `Your message in **${message.guild?.name}** was removed.\n> **Reason:** ${violationReason}`
          )]
        }).catch(() => {});
      }
    }
  }

  // Ensure prefix command handler finished
  await prefixPromise;
}
