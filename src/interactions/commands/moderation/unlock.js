import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { actionLogger } from '../../../utils/actionLogger.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Moderation';
export const userPermission = PermissionFlagsBits.ManageChannels;
export const botPermission = PermissionFlagsBits.ManageChannels;

export const data = new SlashCommandBuilder()
  .setName('unlock')
  .setDescription('Unlock a channel (remove lock override for @everyone).')
  .addChannelOption(opt => opt.setName('channel').setDescription('Channel to unlock (default: current channel)').setRequired(false));

export async function execute(interaction) {
  const channel = interaction.options.getChannel('channel') || interaction.channel;

  await middleware.safeDefer(interaction);

  try {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: null
    });
  } catch (err) {
    const embed = UIFactory.error('Unlock Failed', `Could not unlock ${channel}: ${err.message}`);
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  const embed = UIFactory.success('Channel Unlocked', `Successfully unlocked the channel ${channel}.\n*Members can now send messages again.*`);
  await middleware.safeReply(interaction, { embeds: [embed] });

  // Log to Audit Log
  const fields = [
    { name: 'Channel', value: `${channel}`, inline: true },
    { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true }
  ];
  await actionLogger.log(interaction.guild, {
    title: '🔓 Channel Unlocked',
    description: `Channel ${channel} was unlocked by ${interaction.user.tag}.`,
    fields,
    color: 0x00FA9A // Neon Mint
  });
}
