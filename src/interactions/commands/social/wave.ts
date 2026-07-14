import { ChatInputCommandInteraction } from 'discord.js';
import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';
import type { Command } from '../../../types/index.js';

const command: Command = {
  data: buildSocialCommand('wave', 'Wave to another user.', false),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
  await executeSocial(
    interaction,
    'wave',
    (user, target) => `👋 ${user} waves warmly to ${target}!`,
    (user) => `👋 ${user} waves hello!`
  );
  }
};

export const { data, execute } = command;
