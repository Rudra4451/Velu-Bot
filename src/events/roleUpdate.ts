import { AuditLogEvent, Role } from 'discord.js';
import { guildStorage } from '../database/repositories/GuildRepository.js';
import { actionLogger } from '../utils/actionLogger.js';

export const name = 'roleUpdate';
export const once = false;

export async function execute(oldRole: Role, newRole: Role): Promise<void> {
  const guild = newRole.guild;
  const config = guildStorage.get(guild.id);
  if (!config.logEnabled) return;

  const changes: string[] = [];

  if (oldRole.name !== newRole.name) {
    changes.push(`Name: **${oldRole.name}** ➔ **${newRole.name}**`);
  }
  if (oldRole.hexColor !== newRole.hexColor) {
    changes.push(`Color: **${oldRole.hexColor}** ➔ **${newRole.hexColor}**`);
  }
  if (oldRole.hoist !== newRole.hoist) {
    changes.push(`Hoist: **${oldRole.hoist}** ➔ **${newRole.hoist}**`);
  }
  if (oldRole.mentionable !== newRole.mentionable) {
    changes.push(`Mentionable: **${oldRole.mentionable}** ➔ **${newRole.mentionable}**`);
  }
  if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
    changes.push(`Permissions updated (bitfield changed)`);
  }

  if (changes.length === 0) return;

  const executor = await actionLogger.fetchExecutor(guild, AuditLogEvent.RoleUpdate, newRole.id);

  const fields = [
    { name: 'Role', value: `${newRole} (\`${newRole.id}\`)`, inline: true },
    { name: 'Updated By', value: executor ? `${executor}` : 'Unknown', inline: true },
    { name: 'Changes', value: changes.join('\n'), inline: false }
  ];

  await actionLogger.log(guild, {
    title: '🛡️ Role Updated',
    description: `The role ${newRole} was modified.`,
    fields,
    color: newRole.color || 0x00BFFF // Use role color or sky blue
  });
}
