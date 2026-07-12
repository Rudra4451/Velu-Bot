import { AuditLogEvent } from 'discord.js';
import { db } from '../state/db.js';
import { actionLogger } from '../utils/actionLogger.js';

export const name = 'roleDelete';
export const once = false;

export async function execute(role) {
  const guild = role.guild;
  const config = db.getConfig(guild.id);
  if (!config.logEnabled) return;

  const executor = await actionLogger.fetchExecutor(guild, AuditLogEvent.RoleDelete, role.id);
  
  const fields = [
    { name: 'Role Name', value: role.name, inline: true },
    { name: 'Deleted By', value: executor ? `${executor}` : 'Unknown', inline: true },
    { name: 'ID', value: `\`${role.id}\``, inline: true }
  ];

  await actionLogger.log(guild, {
    title: '🗑️ Role Deleted',
    description: `The role **${role.name}** was deleted.`,
    fields,
    color: 0xFF3E3E // Vivid Coral
  });
}
