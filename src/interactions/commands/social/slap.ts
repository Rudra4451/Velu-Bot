import { ChatInputCommandInteraction } from 'discord.js';
import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';
import type { Command } from '../../../types/index.js';

const command: Command = {
  data: buildSocialCommand('slap', 'Slap another user.'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
  await executeSocial(
    interaction,
    'slap',
    (user, target) => `💥 ${user} slaps ${target} across the face! Ouch.`,
    (user) => `💥 ${user} slaps themselves... wait, why?`
  );
  }
};

export const { data, execute } = command;
