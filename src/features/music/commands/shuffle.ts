import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { musicService } from '../services/music.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Music';

export const data = new SlashCommandBuilder()
  .setName('shuffle')
  .setDescription('Randomly shuffle the current music queue.');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  try {
    const count = musicService.shuffle(interaction.guild.id);
    const embed = UIFactory.success(
      'Queue Shuffled',
      `🔀 Successfully shuffled **${count}** tracks in queue.`
    );
    await middleware.safeReply(interaction, { embeds: [embed] });
  } catch (error: any) {
    const embed = UIFactory.error('Shuffle Error', error.message || 'Failed to shuffle queue.');
    await middleware.safeReply(interaction, { embeds: [embed] });
  }
}
