import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { musicService } from '../../../services/music.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Music';

export const data = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Adjust or view the music playback volume.')
  .addIntegerOption(option =>
    option.setName('percent')
      .setDescription('Volume level (0 - 100)')
      .setMinValue(0)
      .setMaxValue(100)
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const percent = interaction.options.getInteger('percent');

  try {
    if (percent === null) {
      const queueInfo = musicService.getQueueInfo(interaction.guild.id);
      const currentVol = queueInfo ? queueInfo.volume : 100;
      const embed = UIFactory.info('Current Volume', `🔊 Playback volume is set to **${currentVol}%**.`);
      await middleware.safeReply(interaction, { embeds: [embed] });
      return;
    }

    const updatedVol = musicService.setVolume(interaction.guild.id, percent);
    const embed = UIFactory.success('Volume Adjusted', `🔊 Set playback volume to **${updatedVol}%**.`);
    await middleware.safeReply(interaction, { embeds: [embed] });
  } catch (error: any) {
    const embed = UIFactory.error('Volume Error', error.message || 'Failed to adjust volume.');
    await middleware.safeReply(interaction, { embeds: [embed] });
  }
}
