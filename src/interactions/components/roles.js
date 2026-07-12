import { UIFactory } from '../../ui/factory.js';
import { middleware } from '../../utils/middleware.js';
import { logger } from '../../utils/logger.js';

export const namespace = 'roles';

export async function execute(interaction, state, client) {
  const { action, data } = state;
  const { guild, member } = interaction;
  
  if (action !== 'select') return;

  const { roles: panelRoles, type } = data;
  const selectedRoles = interaction.values; // Array of role IDs selected

  await middleware.safeDefer(interaction, true); // Defer ephemerally

  const rolesToAdd = [];
  const rolesToRemove = [];

  const memberRoles = member.roles.cache;

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
      await member.roles.remove(rolesToRemove);
    }
    if (rolesToAdd.length > 0) {
      await member.roles.add(rolesToAdd);
    }

    const addedMentions = rolesToAdd.map(id => `<@&${id}>`).join(', ') || 'None';
    const removedMentions = rolesToRemove.map(id => `<@&${id}>`).join(', ') || 'None';

    const embed = UIFactory.success(
      'Roles Updated',
      `Your roles have been updated.\n\n➕ **Added:** ${addedMentions}\n➖ **Removed:** ${removedMentions}`
    );

    await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
  } catch (err) {
    logger.error('Failed to update roles via select panel', err);
    const embed = UIFactory.error('Update Failed', `Could not update your roles: ${err.message}`);
    await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
  }
}
