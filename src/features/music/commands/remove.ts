import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../../../types/index.js';
import { musicService } from '../services/music.js';
import { UIFactory } from '../../../ui/factory.js';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a track from the queue')
    .addIntegerOption(option => 
      option.setName('position')
        .setDescription('Position of the track to remove')
        .setRequired(true)
        .setMinValue(1)
    ),
  module: 'music',
  async execute(interaction: ChatInputCommandInteraction) {
    const position = interaction.options.getInteger('position', true);
    
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    if (!member?.voice.channel) {
      await interaction.reply({
        embeds: [UIFactory.error(null, 'You must be in a voice channel.')],
        ephemeral: true
      });
      return;
    }

    const removedTrack = musicService.remove(interaction.guildId!, position);
    if (!removedTrack) {
      await interaction.reply({
        embeds: [UIFactory.error(null, `Invalid position! Track #${position} does not exist.`)],
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      embeds: [UIFactory.success(null, `Removed **${removedTrack.title}** from the queue 🗑️`)]
    });
  }
};
