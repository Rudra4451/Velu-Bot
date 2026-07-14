import { ChatInputCommandInteraction } from 'discord.js';
import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';
import type { Command } from '../../../types/index.js';

const command: Command = {
  data: buildSocialCommand('cuddle', 'Cuddle with another user.'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
  await executeSocial(
    interaction,
    'cuddle',
    (user, target) => `🫂 ${user} snuggles and cuddles up close with ${target}!`,
    (user) => `🫂 ${user} cuddles with a soft pillow.`
  );
  }
};

export const { data, execute } = command;
