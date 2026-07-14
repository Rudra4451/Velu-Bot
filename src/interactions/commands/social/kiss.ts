import { ChatInputCommandInteraction } from 'discord.js';
import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';
import type { Command } from '../../../types/index.js';

const command: Command = {
  data: buildSocialCommand('kiss', 'Kiss another user.'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
  await executeSocial(
    interaction,
    'kiss',
    (user, target) => `💋 ${user} kisses ${target} lovingly!`,
    (user) => `💋 ${user} blows a kiss into the mirror.`
  );
  }
};

export const { data, execute } = command;
