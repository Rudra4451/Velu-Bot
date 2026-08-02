import { AuditLogEvent, GuildMember } from 'discord.js';
import { guildStorage } from '../database/repositories/GuildRepository.js';
import { actionLogger } from '../utils/actionLogger.js';

export const name = 'guildMemberUpdate';
export const once = false;

export async function execute(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
  const guild = newMember.guild;
  const config = guildStorage.get(guild.id);
  if (!config.logEnabled) return;

  // 1. Timeout Check
  const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
  const newTimeout = newMember.communicationDisabledUntilTimestamp;

  if (oldTimeout !== newTimeout) {
    if (newTimeout && newTimeout > Date.now()) {
      const executor = await actionLogger.fetchExecutor(guild, AuditLogEvent.MemberUpdate, newMember.id);
      const fields = [
        { name: 'Member', value: `${newMember} (\`${newMember.id}\`)`, inline: true },
        { name: 'Timed Out By', value: executor ? `${executor}` : 'Unknown', inline: true },
        { name: 'Until', value: `<t:${Math.floor(newTimeout / 1000)}:f> (<t:${Math.floor(newTimeout / 1000)}:R>)`, inline: false }
      ];
      await actionLogger.log(guild, {
        title: '🔇 Member Timed Out',
        description: `${newMember.user.tag} has been timed out.`,
        fields,
        color: 0xFF8C00 // Premium Amber
      });
    } else if (oldTimeout && (!newTimeout || newTimeout <= Date.now())) {
      const executor = await actionLogger.fetchExecutor(guild, AuditLogEvent.MemberUpdate, newMember.id);
      const fields = [
        { name: 'Member', value: `${newMember} (\`${newMember.id}\`)`, inline: true },
        { name: 'Removed By', value: executor ? `${executor}` : 'Automatic/Unknown', inline: true }
      ];
      await actionLogger.log(guild, {
        title: '🔊 Timeout Removed',
        description: `Timeout has been removed for ${newMember.user.tag}.`,
        fields,
        color: 0x00BFFF // Deep Sky Blue
      });
    }
  }

  // 2. Nickname Change Check
  if (oldMember.nickname !== newMember.nickname) {
    const executor = await actionLogger.fetchExecutor(guild, AuditLogEvent.MemberUpdate, newMember.id);
    const fields = [
      { name: 'Member', value: `${newMember} (\`${newMember.id}\`)`, inline: true },
      { name: 'Changed By', value: executor ? `${executor}` : 'User/Unknown', inline: true },
      { name: 'Old Nickname', value: oldMember.nickname || '_None_', inline: true },
      { name: 'New Nickname', value: newMember.nickname || '_None_', inline: true }
    ];
    await actionLogger.log(guild, {
      title: '🏷️ Nickname Updated',
      description: `${newMember.user.tag}'s nickname was updated.`,
      fields,
      color: 0x00BFFF // Deep Sky Blue
    });
  }

  // 3. Role Changes Check
  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;

  if (oldRoles.size !== newRoles.size) {
    const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
    const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));

    if (addedRoles.size > 0 || removedRoles.size > 0) {
      const executor = await actionLogger.fetchExecutor(guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
      
      if (addedRoles.size > 0) {
        const roleList = addedRoles.map(role => `${role}`).join(', ');
        const fields = [
          { name: 'Member', value: `${newMember} (\`${newMember.id}\`)`, inline: true },
          { name: 'Granted By', value: executor ? `${executor}` : 'Unknown', inline: true },
          { name: 'Roles Added', value: roleList, inline: false }
        ];
        await actionLogger.log(guild, {
          title: '➕ Roles Granted',
          description: `Roles were added to ${newMember.user.tag}.`,
          fields,
          color: 0x00FA9A // Neon Mint
        });
      }

      if (removedRoles.size > 0) {
        const roleList = removedRoles.map(role => `${role}`).join(', ');
        const fields = [
          { name: 'Member', value: `${newMember} (\`${newMember.id}\`)`, inline: true },
          { name: 'Revoked By', value: executor ? `${executor}` : 'Unknown', inline: true },
          { name: 'Roles Removed', value: roleList, inline: false }
        ];
        await actionLogger.log(guild, {
          title: '➖ Roles Revoked',
          description: `Roles were removed from ${newMember.user.tag}.`,
          fields,
          color: 0xFF3E3E // Vivid Coral
        });
      }
    }
  }
}
