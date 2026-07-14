import { ChatInputCommandInteraction } from 'discord.js';
import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';
import type { Command } from '../../../types/index.js';

const command: Command = {
  data: buildSocialCommand('highfive', 'Give another user a highfive.'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
  await executeSocial(
    interaction,
    'highfive',
    (user, target) => `🙌 ${user} slaps hands in a high five with ${target}!`,
    (user) => `🙌 ${user} highfives the air.`
  );
  }
};

export const { data, execute } = command;
