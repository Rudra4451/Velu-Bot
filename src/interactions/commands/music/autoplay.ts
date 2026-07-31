import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { musicService } from '../../../services/music.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Music';

export const data = new SlashCommandBuilder()
  .setName('autoplay')
  .setDescription('Toggle automatic playback of related songs when the queue ends.');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  try {
    const isAutoplay = musicService.toggleAutoplay(interaction.guild.id);
    const embed = UIFactory.success(
      'Autoplay Toggled',
      isAutoplay
        ? '📻 **Autoplay is now ENABLED.** Related songs will automatically play after your queue ends!'
        : '🛑 **Autoplay is now DISABLED.** Playback will stop when your queue ends.'
    );
    await middleware.safeReply(interaction, { embeds: [embed] });
  } catch (error: any) {
    const embed = UIFactory.error('Autoplay Error', error.message || 'Failed to toggle autoplay.');
    await middleware.safeReply(interaction, { embeds: [embed] });
  }
}
