import { Message, PermissionFlagsBits } from 'discord.js';
import { db } from '../state/db.js';
import { UIFactory } from '../ui/factory.js';
import { klipyService } from '../services/klipy.js';
import { handlePrefixCommand } from '../handlers/prefix.js';
import type { VeluClient, BotEvent } from '../types/index.js';

// Cooldown map to prevent AFK notification spam: key is "authorId:afkUserId" -> timestamp
const afkCooldowns = new Map<string, number>();
const COOLDOWN_MS = 60 * 1000; // 1 minute cooldown per mentioner-mentioned pair

// Automod: spam detection map — key is "guildId:userId" -> array of timestamps
const spamTracker = new Map<string, number[]>();
const SPAM_THRESHOLD = 5; // messages
const SPAM_WINDOW_MS = 5 * 1000; // within 5 seconds
const INVITE_REGEX = /(discord\.gg|discord\.com\/invite)\/[a-zA-Z0-9]+/i;

export const name = 'messageCreate';
export const once = false;

export async function execute(message: Message, client: VeluClient): Promise<void> {
  if (message.author.bot || !message.guild) return;

  // 0. Prefix command routing (runs first, before AFK checks)
  await handlePrefixCommand(message);

  const now = Date.now();
  const guildId = message.guild.id;
  const userId = message.author.id;

  // 1. Economy XP Gain
  const eco = db.getEconomy(guildId, userId);
  const XP_COOLDOWN = 60 * 1000; // 1 minute cooldown for gaining XP
  
  if (now - eco.lastMessageTime > XP_COOLDOWN) {
    const xpGained = Math.floor(Math.random() * 11) + 15; // 15 to 25 XP
    eco.xp += xpGained;
    eco.lastMessageTime = now;
    
    // Calculate level (Simple curve: level = 0.1 * sqrt(xp))
    const newLevel = Math.floor(0.1 * Math.sqrt(eco.xp)) + 1;
    
    if (newLevel > eco.level) {
      eco.level = newLevel;
      eco.coins += newLevel * 50; // Bonus coins on level up
      
      const embed = UIFactory.success(
        'Level Up! 🎉',
        `${message.author} has reached **Level ${newLevel}**!\n*Reward: +${newLevel * 50} 🍡 Coins*`
      );
      await (message.channel as any).send({ embeds: [embed] }).catch(() => {});
    }
    
    db.updateEconomy(guildId, userId, eco);
  }

  // 2. Welcome Back: check if sender is AFK
  const senderAFK = db.getAFK(message.author.id);
  if (senderAFK) {
    db.clearAFK(message.author.id);
    
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
    await message.reply({ embeds: [embed] }).then(msg => {
      // Auto-delete after 5 seconds to keep channel clean
      setTimeout(() => msg.delete().catch(() => {}), 5000);
    });
  }

  // 3. Mentions Check: check if anyone mentioned is AFK
  if (message.mentions.users.size > 0) {
    for (const [userId, user] of message.mentions.users) {
      if (userId === message.author.id) continue; // Don't notify if they mention themselves

      const afkData = db.getAFK(userId);
      if (afkData) {
        // Spam prevention check
        const cooldownKey = `${message.author.id}:${userId}`;
        const lastNotified = afkCooldowns.get(cooldownKey) || 0;

        if (now - lastNotified > COOLDOWN_MS) {
          afkCooldowns.set(cooldownKey, now);

          const timeSince = `<t:${Math.floor(afkData.timestamp / 1000)}:R>`;
          const description = `**${user.username}** went AFK ${timeSince}:\n> ${afkData.reason}`;

          const gifUrl = afkData.gifUrl || await klipyService.search('afk', 'anime sleep nap');

          const embed = UIFactory.premium(`💤 ${user.username} is AFK`, description, {
            image: gifUrl || undefined,
            footerText: 'Away From Keyboard',
            timestamp: false
          });

          await message.reply({ embeds: [embed] });
        }
      }
    }
  }

  // 4. Automod
  const config = db.getConfig(guildId);
  if (config.automodEnabled) {
    // Check if member has Manage Messages perm (bypass automod)
    const member = message.member;
    const isMod = member?.permissions.has(PermissionFlagsBits.ManageMessages) ?? false;

    if (!isMod) {
      let shouldDelete = false;
      let violationReason = '';

      // 4a. Spam Filter
      if (config.automodSpamFilter) {
        const spamKey = `${guildId}:${userId}`;
        const timestamps = spamTracker.get(spamKey) || [];
        const filtered = timestamps.filter(t => now - t < SPAM_WINDOW_MS);
        filtered.push(now);
        spamTracker.set(spamKey, filtered);

        if (filtered.length >= SPAM_THRESHOLD) {
          shouldDelete = true;
          violationReason = 'Spam detected — please slow down!';
          spamTracker.set(spamKey, []); // Reset after flagging
        }
      }

      // 4b. Invite Block
      if (!shouldDelete && config.automodBlockInvites && INVITE_REGEX.test(message.content)) {
        shouldDelete = true;
        violationReason = 'Discord invite links are not allowed here.';
      }

      // 4c. Bad Words
      if (!shouldDelete && config.automodBadwords && config.automodBadwordsList.length > 0) {
        const lowerContent = message.content.toLowerCase();
        const found = config.automodBadwordsList.find(word => lowerContent.includes(word));
        if (found) {
          shouldDelete = true;
          violationReason = 'Your message contained a flagged word.';
        }
      }

      if (shouldDelete) {
        await message.delete().catch(() => {});
        // DM the user a quiet warning (fire-and-forget)
        message.author.send({
          embeds: [UIFactory.warning(
            '🛡️ Automod Warning',
            `Your message in **${message.guild?.name}** was removed.\n> **Reason:** ${violationReason}`
          )]
        }).catch(() => {}); // Silently ignore if DMs are closed
      }
    }
  }
}
