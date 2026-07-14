import type {
  ChatInputCommandInteraction,
  ButtonInteraction,
  AnySelectMenuInteraction,
  ModalSubmitInteraction,
  InteractionReplyOptions,
  MessagePayload,
} from 'discord.js';
import { logger } from './logger.js';
import { UIFactory } from '../ui/factory.js';
import { permissionManager } from './permissionManager.js';
import type { Command } from '../types/index.js';

type AnyInteraction = ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction;
type ReplyPayload = string | InteractionReplyOptions | MessagePayload;

export const middleware = {
  /**
   * Checks if user has necessary permissions for the command.
   * Returns true if authorized, false otherwise.
   */
  async checkPermissions(interaction: ChatInputCommandInteraction, command: Command): Promise<boolean> {
    const userPermission = command.userPermission;
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
  async safeReply(interaction: AnyInteraction, payload: ReplyPayload, ephemeral: boolean = false) {
    const data: Record<string, unknown> = typeof payload === 'string' ? { content: payload } : { ...payload as object };
    if (ephemeral) {
      data.ephemeral = true;
    }

    try {
      if (interaction.replied) {
        return await interaction.followUp(data as InteractionReplyOptions);
      }
      if (interaction.deferred) {
        return await interaction.editReply(data as any);
      }
      return await interaction.reply(data as InteractionReplyOptions);
    } catch (error: any) {
      logger.error('Failed safeReply execution', error);
      return null;
    }
  },

  /**
   * Safely defer interaction to prevent timeouts.
   */
  async safeDefer(interaction: AnyInteraction, ephemeral: boolean = false): Promise<void> {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral });
      }
    } catch (error: any) {
      logger.error('Failed safeDefer execution', error);
    }
  }
};
