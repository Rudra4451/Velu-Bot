import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';
import type { Command } from '../../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('credits')
    .setDescription('View the creators and contributors of Velu Bot.'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = UIFactory.premium('✨ Velu Bot Credits', 'Velu Bot was built with passion to provide the best possible Discord experience.', {
      fields: [
        { name: '👑 Creator & Lead Developer', value: '**Rudra**', inline: false },
        { name: '💖 Special Thanks', value: 'Thanks to all the open-source libraries that made this possible, especially `discord.js` and `play-dl`.', inline: false },
      ],
      footerText: 'Thank you for using Velu Bot!'
    });

    await middleware.safeReply(interaction, { embeds: [embed] });
  }
};

export const { data, execute } = command;
