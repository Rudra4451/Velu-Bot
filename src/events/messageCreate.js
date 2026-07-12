import { db } from '../state/db.js';
import { UIFactory } from '../ui/factory.js';
import { klipyService } from '../services/klipy.js';
import { handlePrefixCommand } from '../handlers/prefix.js';

// Cooldown map to prevent AFK notification spam: key is "authorId:afkUserId" -> timestamp
const afkCooldowns = new Map();
const COOLDOWN_MS = 60 * 1000; // 1 minute cooldown per mentioner-mentioned pair

export const name = 'messageCreate';
export const once = false;

export async function execute(message) {
  if (message.author.bot || !message.guild) return;

  // 0. Prefix command routing (runs first, before AFK checks)
  await handlePrefixCommand(message);

  const now = Date.now();

  // 1. Welcome Back: check if sender is AFK
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

  // 2. Mentions Check: check if anyone mentioned is AFK
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
}
