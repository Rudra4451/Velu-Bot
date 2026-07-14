import { ChatInputCommandInteraction } from 'discord.js';
import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';
import type { Command } from '../../../types/index.js';

const command: Command = {
  data: buildSocialCommand('blush', 'Blush or act shy.', false),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
  await executeSocial(
    interaction,
    'blush',
    (user, target) => `😳 ${user} blushes crimson red looking at ${target}...`,
    (user) => `😳 ${user} blushes shyly.`
  );
  }
};

export const { data, execute } = command;
