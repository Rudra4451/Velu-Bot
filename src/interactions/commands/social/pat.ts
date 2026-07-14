import { ChatInputCommandInteraction } from 'discord.js';
import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';
import type { Command } from '../../../types/index.js';

const command: Command = {
  data: buildSocialCommand('pat', 'Pat another user on the head.'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
  await executeSocial(
    interaction,
    'pat',
    (user, target) => `👋 ${user} gently pats ${target} on the head!`,
    (user) => `👋 ${user} pats their own head.`
  );
  }
};

export const { data, execute } = command;
