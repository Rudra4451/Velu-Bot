import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../../../types/index.js';
import { musicService } from '../services/music.js';
import { UIFactory } from '../../../ui/factory.js';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('jump')
    .setDescription('Jump to a specific track index in the queue')
    .addIntegerOption(option => 
      option.setName('position')
        .setDescription('The queue position to jump to')
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

    const success = musicService.jump(interaction.guildId!, position);
    if (!success) {
      await interaction.reply({
        embeds: [UIFactory.error(null, `Invalid position! Track #${position} does not exist.`)],
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      embeds: [UIFactory.success(null, `Jumped to track #${position} 🚀`)]
    });
  }
};
