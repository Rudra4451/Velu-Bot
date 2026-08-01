import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { musicService } from '../../../services/music.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Music';

export const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Stop playback and clear the queue.');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  
  const stopped = musicService.stop(interaction.guild.id);
  
  if (stopped) {
    const embed = UIFactory.success('Music Stopped', 'Playback stopped and queue cleared. Leaving voice channel.');
    await middleware.safeReply(interaction, { embeds: [embed] });
  } else {
    const embed = UIFactory.warning('Cannot Stop', 'There is no music currently playing.');
    await middleware.safeReply(interaction, { embeds: [embed] });
  }
}
