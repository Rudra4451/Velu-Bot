import type { AnySelectMenuInteraction, GuildMember } from 'discord.js';
import { UIFactory } from '../../ui/factory.js';
import { middleware } from '../../utils/middleware.js';
import { logger } from '../../utils/logger.js';
import type { ComponentHandler } from '../../types/index.js';

export const namespace = 'roles';

export const execute: ComponentHandler['execute'] = async (interaction, state, client) => {
  const { action, data } = state;
  const { guild, member } = interaction;
  
  if (action !== 'select' || !interaction.isAnySelectMenu()) return;
  if (!guild || !member) return;

  const { roles: panelRoles, type } = data as { roles: string[]; type: string };
  const selectedRoles = interaction.values; // Array of role IDs selected

  await middleware.safeDefer(interaction, true); // Defer ephemerally

  const rolesToAdd: string[] = [];
  const rolesToRemove: string[] = [];

  const guildMember = member as GuildMember;
  const memberRoles = guildMember.roles.cache;

  for (const roleId of panelRoles) {
    const isSelected = selectedRoles.includes(roleId);
    const hasRole = memberRoles.has(roleId);

    if (isSelected && !hasRole) {
      rolesToAdd.push(roleId);
    } else if (!isSelected && hasRole) {
      rolesToRemove.push(roleId);
    }
  }

  try {
    if (rolesToRemove.length > 0) {
      await guildMember.roles.remove(rolesToRemove);
    }
    if (rolesToAdd.length > 0) {
      await guildMember.roles.add(rolesToAdd);
    }

    const addedMentions = rolesToAdd.map(id => `<@&${id}>`).join(', ') || 'None';
    const removedMentions = rolesToRemove.map(id => `<@&${id}>`).join(', ') || 'None';

    const embed = UIFactory.success(
      'Roles Updated',
      `Your roles have been updated.\n\n➕ **Added:** ${addedMentions}\n➖ **Removed:** ${removedMentions}`
    );

    await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
  } catch (err: any) {
    logger.error('Failed to update roles via select panel', err);
    const embed = UIFactory.error('Update Failed', `Could not update your roles: ${err.message}`);
    await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
  }
};
