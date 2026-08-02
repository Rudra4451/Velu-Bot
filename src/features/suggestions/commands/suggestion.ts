import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { suggestionStorage } from '../../../database/repositories/SuggestionRepository.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Suggestions';

export const data = new SlashCommandBuilder()
  .setName('suggestion')
  .setDescription('Manage the suggestion system.')
  .addSubcommand(sub =>
    sub.setName('setup')
      .setDescription('Setup the suggestion system.')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel where suggestions will be sent').addChannelTypes(ChannelType.GuildText).setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('disable')
      .setDescription('Disable the suggestion system.')
  )
  .addSubcommand(sub =>
    sub.setName('submit')
      .setDescription('Submit a new suggestion.')
      .addStringOption(opt => opt.setName('suggestion').setDescription('Your suggestion text').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (subcommand === 'setup') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return await middleware.safeReply(interaction, { embeds: [UIFactory.error('Denied', 'You need Administrator permissions.')], ephemeral: true }) as unknown as void;
    }
    const channel = interaction.options.getChannel('channel') as TextChannel;
    suggestionStorage.update(guildId, { enabled: true, channelId: channel.id });
    const embed = UIFactory.success('Suggestion System Configured', `Suggestions will now be sent to ${channel}.`);
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'disable') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return await middleware.safeReply(interaction, { embeds: [UIFactory.error('Denied', 'You need Administrator permissions.')], ephemeral: true }) as unknown as void;
    }
    suggestionStorage.update(guildId, { enabled: false });
    const embed = UIFactory.success('System Disabled', 'The suggestion system has been disabled.');
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'submit') {
    let config = suggestionStorage.get(guildId);
    if (!config) {
      config = { enabled: false, channelId: null };
    }
    if (!config.enabled || !config.channelId) {
      return await middleware.safeReply(interaction, { embeds: [UIFactory.error('Disabled', 'The suggestion system is disabled.')], ephemeral: true }) as unknown as void;
    }

    const suggestionText = interaction.options.getString('suggestion')!;
    
    await middleware.safeDefer(interaction, true);

    try {
      const channel = await interaction.guild.channels.fetch(config.channelId) as TextChannel;
      if (!channel) throw new Error('Suggestion channel not found.');

      const embed = UIFactory.premium('💡 New Suggestion', suggestionText, {
        author: { name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ forceStatic: false } as any) },
        color: 0x00B4D8,
        footerText: `User ID: ${interaction.user.id}`
      });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('suggestion:upvote').setLabel('0').setEmoji('👍').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('suggestion:downvote').setLabel('0').setEmoji('👎').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('suggestion:accept').setLabel('Accept').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('suggestion:decline').setLabel('Decline').setStyle(ButtonStyle.Secondary)
      );

      const msg = await channel.send({ embeds: [embed], components: [row] });
      // Create a thread for discussion
      await msg.startThread({
        name: `Discussion: Suggestion by ${interaction.user.username}`,
        autoArchiveDuration: 1440
      });

      await middleware.safeReply(interaction, { embeds: [UIFactory.success('Success', `Suggestion submitted in ${channel}.`)], ephemeral: true });
    } catch (err: any) {
      await middleware.safeReply(interaction, { embeds: [UIFactory.error('Failed', `Could not submit suggestion: ${err.message}`)], ephemeral: true });
    }
  }
}
