import { AuditLogEvent, Role } from 'discord.js';
import { db } from '../state/db.js';
import { actionLogger } from '../utils/actionLogger.js';

export const name = 'roleCreate';
export const once = false;

export async function execute(role: Role): Promise<void> {
  const guild = role.guild;
  const config = db.getConfig(guild.id);
  if (!config.logEnabled) return;

  const executor = await actionLogger.fetchExecutor(guild, AuditLogEvent.RoleCreate, role.id);
  
  const fields = [
    { name: 'Role', value: `${role} (\`${role.id}\`)`, inline: true },
    { name: 'Created By', value: executor ? `${executor}` : 'Unknown', inline: true },
    { name: 'Color', value: role.hexColor, inline: true }
  ];

  await actionLogger.log(guild, {
    title: '🛡️ Role Created',
    description: `A new role was created: ${role}.`,
    fields,
    color: role.color || 0x00BFFF // Use role color or sky blue
  });
}
