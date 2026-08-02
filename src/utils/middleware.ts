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
import { UIFactory } from '../ui/factory.js';
import type { Command } from '../types/index.js';

type AnyInteraction = ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction;
type ReplyPayload = string | InteractionReplyOptions | MessagePayload;

export const middleware = {
  /**
   * Checks if user has necessary permissions for the command.
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
    
    if (ephemeral && !data.flags) {
      data.flags = MessageFlags.Ephemeral;
    }

    try {
      if (interaction.replied) {
        return await interaction.followUp(data as InteractionReplyOptions);
      }
      if (interaction.deferred) {
        // If they requested ephemeral but it was deferred non-ephemeral, we must followUp instead of editReply
        if (ephemeral && !interaction.ephemeral) {
          return await interaction.followUp(data as InteractionReplyOptions);
        }
        
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
  },

  /**
   * Centralized Global Error Handler
   */
  async handleError(interaction: AnyInteraction, error: any, contextInfo: string = 'execution') {
    const errorId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    logger.error(`[Error ID: ${errorId}] Failed during ${contextInfo}:`, error);

    let cause = 'An internal system error occurred.';
    let fix = 'Please try again later.';

    // Map common errors without exposing stack trace
    if (error?.code === 10062) {
      cause = 'The interaction expired because it took too long.';
      fix = 'Try running the command again.';
    } else if (error?.code === 50013) {
      cause = 'The bot lacks the necessary permissions.';
      fix = 'Ensure the bot has correct role permissions in this channel.';
    }

    const embed = UIFactory.error(
      'System Error',
      'We encountered a problem while processing your request.',
      {
        fields: [
          { name: 'Error ID', value: `\`${errorId}\``, inline: true },
          { name: 'Possible Cause', value: cause, inline: false },
          { name: 'Suggested Fix', value: fix, inline: false },
        ],
        footerText: 'Please provide this Error ID if you contact support.'
      }
    );

    await this.safeReply(interaction, { embeds: [embed] }, true);
  }
};
