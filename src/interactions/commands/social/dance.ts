import { ChatInputCommandInteraction } from 'discord.js';
import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';
import type { Command } from '../../../types/index.js';

const command: Command = {
  data: buildSocialCommand('dance', 'Start dancing.', false),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
  await executeSocial(
    interaction,
    'dance',
    (user, target) => `💃 ${user} grooves and dances with ${target}!`,
    (user) => `💃 ${user} starts busting some moves and dancing!`
  );
  }
};

export const { data, execute } = command;
