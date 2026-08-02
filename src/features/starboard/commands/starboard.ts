import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, TextChannel } from 'discord.js';
import { starboardStorage } from '../../../database/repositories/StarboardRepository.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Starboard';

export const data = new SlashCommandBuilder()
  .setName('starboard')
  .setDescription('Manage the server starboard.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub.setName('setup')
      .setDescription('Setup the starboard.')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel where starred messages will go').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addIntegerOption(opt => opt.setName('threshold').setDescription('Number of stars required (default: 3)').setMinValue(1).setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('disable')
      .setDescription('Disable the starboard.')
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (subcommand === 'setup') {
    const channel = interaction.options.getChannel('channel') as TextChannel;
    const threshold = interaction.options.getInteger('threshold') || 3;

    starboardStorage.update(guildId, { enabled: true, channelId: channel.id, threshold });
    
    const embed = UIFactory.success('Starboard Configured', `Starboard is now active in ${channel}!\n**Threshold:** ⭐ ${threshold}`);
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'disable') {
    starboardStorage.update(guildId, { enabled: false });
    const embed = UIFactory.success('System Disabled', 'The starboard has been disabled.');
    await middleware.safeReply(interaction, { embeds: [embed] });
  }
}
