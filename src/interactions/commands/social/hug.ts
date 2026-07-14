import { ChatInputCommandInteraction } from 'discord.js';
import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';
import type { Command } from '../../../types/index.js';

const command: Command = {
  data: buildSocialCommand('hug', 'Hug another user.'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
  await executeSocial(
    interaction,
    'hug',
    (user, target) => `🤗 ${user} wraps their arms tightly around ${target}!`,
    (user) => `🤗 ${user} hugs themselves softly.`
  );
  }
};

export const { data, execute } = command;
