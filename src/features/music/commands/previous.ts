import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../../../types/index.js';
import { musicService } from '../services/music.js';
import { UIFactory } from '../../../ui/factory.js';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('previous')
    .setDescription('Play the previous track in history'),
  module: 'music',
  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    if (!member?.voice.channel) {
      await interaction.reply({
        embeds: [UIFactory.error(null, 'You must be in a voice channel to use this command.')],
        ephemeral: true
      });
      return;
    }

    const success = musicService.previous(interaction.guildId!);
    if (!success) {
      await interaction.reply({
        embeds: [UIFactory.error(null, 'There is no previous track in the history.')],
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      embeds: [UIFactory.success(null, 'Rewinding to previous track... ⏪')]
    });
  }
};
