import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { musicService } from '../services/music.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Music';

export const data = new SlashCommandBuilder()
  .setName('loop')
  .setDescription('Toggle track or queue repeat mode.');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  try {
    const newMode = musicService.toggleLoop(interaction.guild.id);
    const modeNames = ['Off 🛑', 'Track Loop 🔂', 'Queue Loop 🔁'];
    const embed = UIFactory.info(
      'Loop Mode Changed',
      `Repeat mode is now set to **${modeNames[newMode] || 'Off'}**.`
    );
    await middleware.safeReply(interaction, { embeds: [embed] });
  } catch (error: any) {
    const embed = UIFactory.error('Loop Error', error.message || 'Failed to toggle repeat mode.');
    await middleware.safeReply(interaction, { embeds: [embed] });
  }
}
