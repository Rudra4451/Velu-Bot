import { ChatInputCommandInteraction } from 'discord.js';
import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';
import type { Command } from '../../../types/index.js';

const command: Command = {
  data: buildSocialCommand('cry', 'Express sadness or cry.', false),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
  await executeSocial(
    interaction,
    'cry',
    (user, target) => `😭 ${user} cries on ${target}'s shoulder.`,
    (user) => `😭 ${user} bursts into tears!`
  );
  }
};

export const { data, execute } = command;
