import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../../../types/index.js';
import { musicService } from '../services/music.js';
import { UIFactory } from '../../../ui/factory.js';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('move')
    .setDescription('Move a track to a different position in the queue')
    .addIntegerOption(option => 
      option.setName('from')
        .setDescription('Current position of the track')
        .setRequired(true)
        .setMinValue(1)
    )
    .addIntegerOption(option => 
      option.setName('to')
        .setDescription('New position for the track')
        .setRequired(true)
        .setMinValue(1)
    ),
  module: 'music',
  async execute(interaction: ChatInputCommandInteraction) {
    const from = interaction.options.getInteger('from', true);
    const to = interaction.options.getInteger('to', true);
    
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    if (!member?.voice.channel) {
      await interaction.reply({
        embeds: [UIFactory.error(null, 'You must be in a voice channel.')],
        ephemeral: true
      });
      return;
    }

    const success = musicService.move(interaction.guildId!, from, to);
    if (!success) {
      await interaction.reply({
        embeds: [UIFactory.error(null, `Invalid positions provided. Track not moved.`)],
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      embeds: [UIFactory.success(null, `Moved track from position #${from} to #${to} 🔃`)]
    });
  }
};
