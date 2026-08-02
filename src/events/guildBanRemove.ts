import { AuditLogEvent, GuildBan } from 'discord.js';
import { guildStorage } from '../database/repositories/GuildRepository.js';
import { actionLogger } from '../utils/actionLogger.js';

export const name = 'guildBanRemove';
export const once = false;

export async function execute(ban: GuildBan): Promise<void> {
  const guild = ban.guild;
  const config = guildStorage.get(guild.id);

  if (config.logEnabled) {
    const executor = await actionLogger.fetchExecutor(guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    
    const fields = [
      { name: 'User', value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
      { name: 'Unbanned By', value: executor ? `${executor}` : 'Unknown', inline: true },
      { name: 'Reason', value: ban.reason || 'No reason provided', inline: false }
    ];

    await actionLogger.log(guild, {
      title: '🔓 Member Unbanned',
      description: `${ban.user.tag} has been unbanned.`,
      fields,
      color: 0x00FA9A // Neon Mint
    });
  }
}
