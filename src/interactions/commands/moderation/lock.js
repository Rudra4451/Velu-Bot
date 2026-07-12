import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { actionLogger } from '../../../utils/actionLogger.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Moderation';
export const userPermission = PermissionFlagsBits.ManageChannels;
export const botPermission = PermissionFlagsBits.ManageChannels;

export const data = new SlashCommandBuilder()
  .setName('lock')
  .setDescription('Lock a channel (prevent @everyone from sending messages).')
  .addChannelOption(opt => opt.setName('channel').setDescription('Channel to lock (default: current channel)').setRequired(false));

export async function execute(interaction) {
  const channel = interaction.options.getChannel('channel') || interaction.channel;

  await middleware.safeDefer(interaction);

  try {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: false
    });
  } catch (err) {
    const embed = UIFactory.error('Lock Failed', `Could not lock ${channel}: ${err.message}`);
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  const embed = UIFactory.success('Channel Locked', `Successfully locked the channel ${channel}.\n*Members can no longer send messages.*`);
  await middleware.safeReply(interaction, { embeds: [embed] });

  // Log to Audit Log
  const fields = [
    { name: 'Channel', value: `${channel}`, inline: true },
    { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true }
  ];
  await actionLogger.log(interaction.guild, {
    title: '🔒 Channel Locked',
    description: `Channel ${channel} was locked by ${interaction.user.tag}.`,
    fields,
    color: 0xFF3E3E // Vivid Coral
  });
}
