import { ButtonInteraction, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, StringSelectMenuBuilder } from 'discord.js';
import { ticketStorage } from '../../../database/repositories/TicketRepository.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';
import type { ComponentContext } from '../../../types/index.js';

export const namespace = 'ticket';

export async function execute(interaction: ButtonInteraction, context: ComponentContext): Promise<void> {
  const { action } = context;
  const guild = interaction.guild;
  if (!guild) return;

  const config = ticketStorage.get(guild.id);
  if (!config.enabled || !config.categoryId) {
    return await middleware.safeReply(interaction, { embeds: [UIFactory.error('Disabled', 'The ticket system is currently disabled.')], ephemeral: true }) as unknown as void;
  }

  if (action === 'create') {
    await middleware.safeDefer(interaction, true);
    
    // Check if user already has a ticket
    const existing = guild.channels.cache.find(c => c.name.startsWith('ticket-') && (c as TextChannel).topic === interaction.user.id);
    if (existing) {
      return await middleware.safeReply(interaction, { embeds: [UIFactory.error('Error', `You already have an open ticket: ${existing}`)], ephemeral: true }) as unknown as void;
    }

    try {
      const permissionOverwrites: any[] = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles],
        }
      ];

      if (config.supportRoleId) {
        permissionOverwrites.push({
          id: config.supportRoleId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        });
      }

      const ticketChannel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: config.categoryId,
        topic: interaction.user.id,
        permissionOverwrites
      });

      const embed = UIFactory.premium('Ticket Created', `Welcome ${interaction.user}!\nSupport will be with you shortly.\n\nUse the buttons below to manage this ticket.`);
      
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket:close')
          .setLabel('Close Ticket')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({ content: `${interaction.user} ${config.supportRoleId ? `<@&${config.supportRoleId}>` : ''}`, embeds: [embed], components: [row] });
      await middleware.safeReply(interaction, { embeds: [UIFactory.success('Success', `Ticket created: ${ticketChannel}`)], ephemeral: true });
    } catch (err: any) {
      await middleware.safeReply(interaction, { embeds: [UIFactory.error('Failed', `Could not create ticket: ${err.message}`)], ephemeral: true });
    }
  }

  if (action === 'close') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) && !(interaction.channel as TextChannel).topic?.includes(interaction.user.id)) {
      if (config.supportRoleId && !(interaction.member as any).roles.cache.has(config.supportRoleId)) {
        return await middleware.safeReply(interaction, { embeds: [UIFactory.error('Denied', 'You do not have permission to close this ticket.')], ephemeral: true }) as unknown as void;
      }
    }

    await middleware.safeDefer(interaction);

    const embed = UIFactory.warning('Closing Ticket', 'This ticket will be deleted in 5 seconds...');
    await (interaction.channel as TextChannel).send({ embeds: [embed] });

    // Try to create a transcript if log channel is set
    if (config.logChannelId) {
      try {
        const logChannel = await guild.channels.fetch(config.logChannelId);
        if (logChannel && logChannel.isTextBased()) {
          const transcriptEmbed = UIFactory.premium('Ticket Closed', `**Ticket:** ${(interaction.channel as TextChannel).name}\n**Closed By:** ${interaction.user}\n**Owner ID:** ${(interaction.channel as TextChannel).topic || 'Unknown'}`, { timestamp: true });
          await logChannel.send({ embeds: [transcriptEmbed] });
        }
      } catch (e) {
        // Ignore
      }
    }

    setTimeout(() => {
      interaction.channel?.delete().catch(() => {});
    }, 5000);
  }
}
