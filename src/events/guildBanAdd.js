import { AuditLogEvent } from 'discord.js';
import { db } from '../state/db.js';
import { actionLogger } from '../utils/actionLogger.js';

export const name = 'guildBanAdd';
export const once = false;

export async function execute(ban) {
  const guild = ban.guild;
  const config = db.getConfig(guild.id);

  if (config.logEnabled) {
    const executor = await actionLogger.fetchExecutor(guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    
    const fields = [
      { name: 'User', value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
      { name: 'Banned By', value: executor ? `${executor}` : 'Unknown', inline: true },
      { name: 'Reason', value: ban.reason || 'No reason provided', inline: false }
    ];

    await actionLogger.log(guild, {
      title: '🔨 Member Banned',
      description: `${ban.user.tag} has been banned from the server.`,
      fields,
      color: 0xFF3E3E // Vivid Coral/Red
    });
  }
}
