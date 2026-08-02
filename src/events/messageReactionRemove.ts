import { Events, MessageReaction, PartialMessageReaction, User, PartialUser } from 'discord.js';
import { reactionRoleStorage } from '../database/repositories/ReactionRoleRepository.js';
import { logger } from '../utils/logger.js';
import type { BotEvent } from '../types/index.js';

const event: BotEvent = {
  name: Events.MessageReactionRemove,
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
    if (!message.guild) return;
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
          if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId);
          }
        } catch (e) {
          logger.error('Failed to remove reaction role', e);
        }
      }
    }
  }
};

export default event;
