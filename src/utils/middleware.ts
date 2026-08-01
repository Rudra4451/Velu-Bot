import { 
  ChatInputCommandInteraction, 
  ButtonInteraction, 
  AnySelectMenuInteraction, 
  ModalSubmitInteraction, 
  InteractionReplyOptions, 
  MessagePayload,
  MessageFlags
} from 'discord.js';
import { logger } from './logger.js';
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
   * Uses MessageFlags.Ephemeral for modern Discord.js v14 compatibility.
   */
  async safeReply(interaction: AnyInteraction, payload: ReplyPayload, ephemeral: boolean = false) {
    const data: Record<string, unknown> = typeof payload === 'string' ? { content: payload } : { ...payload as object };
    
    if (ephemeral && !data.flags) {
      data.flags = MessageFlags.Ephemeral;
    }

    try {
      if (interaction.replied) {
        return await interaction.followUp(data as InteractionReplyOptions);
      }
      if (interaction.deferred) {
        // When editing a deferred reply, Discord API expects editReply content without flags/ephemeral properties
        delete data.flags;
        delete data.ephemeral;
        return await interaction.editReply(data as any);
      }
      return await interaction.reply(data as InteractionReplyOptions);
    } catch (error: any) {
      logger.error('Failed safeReply execution:', error.message || error);
      return null;
    }
  },

  /**
   * Safely defer interaction to prevent timeouts.
   */
  async safeDefer(interaction: AnyInteraction, ephemeral: boolean = false): Promise<void> {
    try {
      if (!interaction.deferred && !interaction.replied) {
        if (ephemeral) {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } else {
          await interaction.deferReply();
        }
      }
    } catch (error: any) {
      logger.error('Failed safeDefer execution:', error.message || error);
    }
  }
};
