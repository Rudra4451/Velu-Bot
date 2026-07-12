import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { actionLogger } from '../../../utils/actionLogger.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Moderation';
export const userPermission = PermissionFlagsBits.ManageChannels;
export const botPermission = PermissionFlagsBits.ManageChannels;

export const data = new SlashCommandBuilder()
  .setName('slowmode')
  .setDescription('Set slowmode rate limit for this channel.')
  .addIntegerOption(opt =>
    opt.setName('seconds')
      .setDescription('Seconds (0 to disable, max 21600)')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(21600)
  );

export async function execute(interaction) {
  const seconds = interaction.options.getInteger('seconds');
  const channel = interaction.channel;

  await middleware.safeDefer(interaction);

  try {
    await channel.setRateLimitPerUser(seconds, `Slowmode set by ${interaction.user.tag}`);
  } catch (err) {
    const embed = UIFactory.error('Slowmode Failed', `Could not update slowmode: ${err.message}`);
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  const embed = UIFactory.success(
    'Slowmode Updated',
    seconds === 0 
      ? 'Slowmode has been disabled for this channel.' 
      : `Slowmode has been set to **${seconds} seconds**.`
  );
  await middleware.safeReply(interaction, { embeds: [embed] });

  // Log to Audit Log
  const fields = [
    { name: 'Channel', value: `${channel}`, inline: true },
    { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
    { name: 'Interval', value: seconds === 0 ? 'Disabled' : `${seconds}s`, inline: true }
  ];
  await actionLogger.log(interaction.guild, {
    title: '⏲️ Slowmode Configured',
    description: `Slowmode was updated in ${channel} by ${interaction.user.tag}.`,
    fields,
    color: 0x00BFFF // Deep Sky Blue
  });
}
