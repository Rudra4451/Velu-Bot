import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, CategoryChannel } from 'discord.js';
import { ticketStorage } from '../../../database/repositories/TicketRepository.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Tickets';
export const userPermission = PermissionFlagsBits.Administrator;
export const botPermission = PermissionFlagsBits.ManageChannels;

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Manage the ticket system.')
  .addSubcommand(sub =>
    sub.setName('setup')
      .setDescription('Setup the ticket system in the current server.')
      .addChannelOption(opt => opt.setName('category').setDescription('Category where tickets will be created').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
      .addChannelOption(opt => opt.setName('log_channel').setDescription('Channel for ticket transcripts/logs').addChannelTypes(ChannelType.GuildText).setRequired(false))
      .addRoleOption(opt => opt.setName('support_role').setDescription('Role for ticket support staff').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('panel')
      .setDescription('Send the ticket creation panel to a channel.')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send the panel in').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption(opt => opt.setName('title').setDescription('Title for the panel').setRequired(false))
      .addStringOption(opt => opt.setName('description').setDescription('Description for the panel').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('disable')
      .setDescription('Disable the ticket system.')
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (subcommand === 'setup') {
    const category = interaction.options.getChannel('category') as CategoryChannel;
    const logChannel = interaction.options.getChannel('log_channel');
    const supportRole = interaction.options.getRole('support_role');

    ticketStorage.update(guildId, {
      enabled: true,
      categoryId: category.id,
      logChannelId: logChannel?.id || null,
      supportRoleId: supportRole?.id || null
    });

    const embed = UIFactory.success('Ticket System Configured', `The ticket system is now **enabled**.\n\n**Category:** <#${category.id}>\n**Logs:** ${logChannel ? `<#${logChannel.id}>` : '_None_'}\n**Support Role:** ${supportRole ? `<@&${supportRole.id}>` : '_None_'}`);
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'panel') {
    let config = ticketStorage.get(guildId);
    if (!config) {
      config = { enabled: false, categoryId: null, logChannelId: null, supportRoleId: null };
    }
    if (!config.enabled || !config.categoryId) {
      return await middleware.safeReply(interaction, { embeds: [UIFactory.error('System Disabled', 'Please setup the ticket system first using `/ticket setup`.')], ephemeral: true }) as unknown as void;
    }

    const channel = interaction.options.getChannel('channel') as any;
    const title = interaction.options.getString('title') || 'Support Tickets';
    const description = interaction.options.getString('description') || 'Click the button below to open a ticket.';

    const embed = UIFactory.premium(title, description, { color: 0x00F5D4 });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket:create')
        .setLabel('Open Ticket')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Primary)
    );

    try {
      await channel.send({ embeds: [embed], components: [row] });
      await middleware.safeReply(interaction, { embeds: [UIFactory.success('Panel Sent', `Ticket panel successfully sent to ${channel}.`)], ephemeral: true });
    } catch (err: any) {
      await middleware.safeReply(interaction, { embeds: [UIFactory.error('Failed', `Could not send panel: ${err.message}`)], ephemeral: true });
    }
  }

  if (subcommand === 'disable') {
    ticketStorage.update(guildId, { enabled: false });
    const embed = UIFactory.success('System Disabled', 'The ticket system has been disabled.');
    await middleware.safeReply(interaction, { embeds: [embed] });
  }
}
