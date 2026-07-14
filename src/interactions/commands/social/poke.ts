import { ChatInputCommandInteraction } from 'discord.js';
import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';
import type { Command } from '../../../types/index.js';

const command: Command = {
  data: buildSocialCommand('poke', 'Poke another user.'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
  await executeSocial(
    interaction,
    'poke',
    (user, target) => `👉 ${user} pokes ${target}! Hey!`,
    (user) => `👉 ${user} pokes their own cheek.`
  );
  }
};

export const { data, execute } = command;
