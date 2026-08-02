import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { actionLogger } from '../../../utils/actionLogger.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Moderation';
export const userPermission = PermissionFlagsBits.ManageChannels;
export const botPermission = PermissionFlagsBits.ManageChannels;

export const data = new SlashCommandBuilder()
  .setName('lock')
  .setDescription('Lock or unlock a channel.')
  .addSubcommand(sub =>
    sub.setName('set')
      .setDescription('Lock a channel (prevent @everyone from sending messages).')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel to lock (default: current)').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('remove')
      .setDescription('Unlock a channel (restore @everyone send permissions).')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel to unlock (default: current)').setRequired(false))
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();
  const channel = interaction.options.getChannel('channel') || interaction.channel;

  await middleware.safeDefer(interaction);

  if (subcommand === 'set') {
    try {
      await (channel as any).permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
    } catch (err: any) {
      const embed = UIFactory.error('Lock Failed', `Could not lock ${channel}: ${err.message}`);
      await middleware.safeReply(interaction, { embeds: [embed] });
      return;
    }

    const embed = UIFactory.success('Channel Locked', `${channel} has been locked.\n*Members can no longer send messages.*`);
    await middleware.safeReply(interaction, { embeds: [embed] });

    await actionLogger.log(interaction.guild, {
      title: '🔒 Channel Locked',
      description: `Channel ${channel} was locked by ${interaction.user.tag}.`,
      fields: [
        { name: 'Channel', value: `${channel}`, inline: true },
        { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true }
      ],
      color: 0xFF3E3E
    });
  }

  if (subcommand === 'remove') {
    try {
      await (channel as any).permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
    } catch (err: any) {
      const embed = UIFactory.error('Unlock Failed', `Could not unlock ${channel}: ${err.message}`);
      await middleware.safeReply(interaction, { embeds: [embed] });
      return;
    }

    const embed = UIFactory.success('Channel Unlocked', `${channel} has been unlocked.\n*Members can now send messages again.*`);
    await middleware.safeReply(interaction, { embeds: [embed] });

    await actionLogger.log(interaction.guild, {
      title: '🔓 Channel Unlocked',
      description: `Channel ${channel} was unlocked by ${interaction.user.tag}.`,
      fields: [
        { name: 'Channel', value: `${channel}`, inline: true },
        { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true }
      ],
      color: 0x00FA9A
    });
  }
}
