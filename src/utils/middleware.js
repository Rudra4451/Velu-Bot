import { PermissionFlagsBits } from 'discord.js';
import { logger } from './logger.js';
import { UIFactory } from '../ui/factory.js';
import { permissionManager } from './permissionManager.js';

export const middleware = {
  /**
   * Checks if user has necessary permissions for the command.
   * Returns true if authorized, false otherwise.
   */
  async checkPermissions(interaction, command) {
    const userPermission = command.userPermission || (command.permissions && command.permissions[0]);
    const botPermission = command.botPermission;
    const commandName = command.data?.name;
    const moduleName = command.module;

    return await permissionManager.authorize(interaction, {
      commandName,
      moduleName,
      userPermission,
      botPermission,
    });
  },

  /**
   * Safely reply to an interaction, handling scenarios where it has already been replied, deferred, or closed.
   */
  async safeReply(interaction, payload, ephemeral = false) {
    const data = typeof payload === 'string' ? { content: payload } : payload;
    if (ephemeral) {
      data.ephemeral = true;
    }

    try {
      if (interaction.replied) {
        return await interaction.followUp(data);
      }
      if (interaction.deferred) {
        return await interaction.editReply(data);
      }
      return await interaction.reply(data);
    } catch (error) {
      logger.error('Failed safeReply execution', error);
      // Suppress or bubble depending on context; here we suppress to keep interactions clean
      return null;
    }
  },

  /**
   * Safely defer interaction to prevent timeouts.
   */
  async safeDefer(interaction, ephemeral = false) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral });
      }
    } catch (error) {
      logger.error('Failed safeDefer execution', error);
    }
  }
};
