import { Events, MessageReaction, PartialMessageReaction, User, PartialUser, TextChannel } from 'discord.js';
import { starboardStorage } from '../database/repositories/StarboardRepository.js';
import { reactionRoleStorage } from '../database/repositories/ReactionRoleRepository.js';
import { UIFactory } from '../ui/factory.js';
import { logger } from '../utils/logger.js';
import type { BotEvent } from '../types/index.js';

const starboardCache = new Set<string>();

const event: BotEvent = {
  name: Events.MessageReactionAdd,
  async execute(...args: unknown[]) {
    const [reaction, user] = args as [MessageReaction | PartialMessageReaction, User | PartialUser];
    if (user.bot) return;

    if (reaction.partial) {
      try { await reaction.fetch(); } catch (error) { return; }
    }
    if (user.partial) {
      try { await user.fetch(); } catch (error) { return; }
    }
    
    const message = reaction.message;
    if (!message.guild || !message.author) return;
    const guildId = message.guild.id;

    // ── Reaction Roles ────────────────────────────────────────────────────────
    const rrConfigs = reactionRoleStorage.get(guildId) || [];
    const rrConfig = rrConfigs.find(c => c.messageId === message.id);
    if (rrConfig) {
      const emojiName = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
      const roleId = rrConfig.mappings[emojiName || ''] || rrConfig.mappings[reaction.emoji.name || ''];
      
      if (roleId) {
        try {
          const member = await message.guild.members.fetch(user.id);
          if (!member.roles.cache.has(roleId)) {
            await member.roles.add(roleId);
          }
        } catch (e) {
          logger.error('Failed to add reaction role', e);
        }
      }
    }

    // ── Starboard ─────────────────────────────────────────────────────────────
    if (reaction.emoji.name === '⭐' && !message.author.bot) {
      const config = starboardStorage.get(guildId);
      if (!config.enabled || !config.channelId) return;
      if (reaction.count === null || reaction.count < config.threshold) return;

      if (starboardCache.has(message.id)) return;
      starboardCache.add(message.id);

      try {
        const starboardChannel = await message.guild.channels.fetch(config.channelId) as TextChannel;
        if (!starboardChannel) return;

        const embed = UIFactory.premium('⭐ Starboard', message.content || '_No text_', {
          author: { name: message.author.tag, iconURL: message.author.displayAvatarURL({ forceStatic: false } as any) },
          color: 0xFFD700,
          timestamp: true
        });

        if (message.attachments.size > 0) {
          embed.setImage(message.attachments.first()!.url);
        }

        const row = {
          type: 1,
          components: [{ type: 2, style: 5, label: 'Jump to Message', url: message.url }]
        } as any;

        await starboardChannel.send({
          content: `⭐ **${reaction.count}** | ${message.channel}`,
          embeds: [embed],
          components: [row]
        });
      } catch (err: any) {
        logger.error('Starboard Error:', err);
      }
    }
  }
};

export default event;
