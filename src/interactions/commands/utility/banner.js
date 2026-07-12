import { SlashCommandBuilder } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';
import { logger } from '../../../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('banner')
  .setDescription("Show a user's profile banner.")
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The user whose banner you want to see.')
      .setRequired(false)
  );

export async function execute(interaction, client) {
  const targetUser = interaction.options.getUser('target') || interaction.user;

  await middleware.safeDefer(interaction);

  try {
    const user = await client.users.fetch(targetUser.id, { force: true });
    const bannerUrl = user.bannerURL({ size: 1024, dynamic: true });

    if (!bannerUrl) {
      const errorEmbed = UIFactory.warning(
        'No Banner Found',
        `User **${user.tag}** does not have a profile banner set.`
      );
      return middleware.safeReply(interaction, { embeds: [errorEmbed] });
    }

    const embed = UIFactory.premium(`${user.tag}'s Banner`, `[Link to Banner](${bannerUrl})`, {
      image: bannerUrl
    });

    await middleware.safeReply(interaction, { embeds: [embed] });
  } catch (error) {
    logger.error('Failed to fetch user banner', error);
    const errEmbed = UIFactory.error('Error', 'Could not retrieve user banner data.');
    await middleware.safeReply(interaction, { embeds: [errEmbed] });
  }
}
