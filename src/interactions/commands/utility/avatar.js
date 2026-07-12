import { SlashCommandBuilder } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const data = new SlashCommandBuilder()
  .setName('avatar')
  .setDescription("Show a user's avatar.")
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The user whose avatar you want to see.')
      .setRequired(false)
  );

export async function execute(interaction) {
  const user = interaction.options.getUser('target') || interaction.user;
  const avatarUrl = user.displayAvatarURL({ size: 1024, dynamic: true });

  const embed = UIFactory.premium(`${user.tag}'s Avatar`, `[Link to Avatar](${avatarUrl})`, {
    image: avatarUrl
  });

  await middleware.safeReply(interaction, { embeds: [embed] });
}
