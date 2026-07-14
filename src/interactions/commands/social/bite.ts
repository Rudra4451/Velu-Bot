import { ChatInputCommandInteraction } from 'discord.js';
import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';
import type { Command } from '../../../types/index.js';

const command: Command = {
  data: buildSocialCommand('bite', 'Bite another user.'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
  await executeSocial(
    interaction,
    'bite',
    (user, target) => `🦷 ${user} nibbles and bites ${target}!`,
    (user) => `🦷 ${user} bites their lip.`
  );
  }
};

export const { data, execute } = command;
