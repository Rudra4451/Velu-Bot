import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { musicService } from '../../../services/music.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Music';

export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Skip the currently playing song.');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  
  const skipped = musicService.skip(interaction.guild.id);
  
  if (skipped) {
    const embed = UIFactory.success('Song Skipped', 'Skipping to the next track...');
    await middleware.safeReply(interaction, { embeds: [embed] });
  } else {
    const embed = UIFactory.warning('Cannot Skip', 'There is no music currently playing.');
    await middleware.safeReply(interaction, { embeds: [embed] });
  }
}
