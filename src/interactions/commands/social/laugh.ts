import { ChatInputCommandInteraction } from 'discord.js';
import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';
import type { Command } from '../../../types/index.js';

const command: Command = {
  data: buildSocialCommand('laugh', 'Laugh out loud.', false),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
  await executeSocial(
    interaction,
    'laugh',
    (user, target) => `😆 ${user} laughs hysterically at ${target}!`,
    (user) => `😆 ${user} laughs out loud!`
  );
  }
};

export const { data, execute } = command;
