import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';
import { logger } from '../../../utils/logger.js';
import type { VeluClient } from '../../../types/index.js';

export const module = 'Utility';

export const data = new SlashCommandBuilder()
  .setName('user')
  .setDescription('View user profile, avatar, or banner.')
  .addSubcommand(sub =>
    sub.setName('info')
      .setDescription('Show profile details of a member.')
      .addUserOption(opt => opt.setName('target').setDescription('User to view (default: you)').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('avatar')
      .setDescription("Show a user's full-size avatar.")
      .addUserOption(opt => opt.setName('target').setDescription('User to view (default: you)').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('banner')
      .setDescription("Show a user's profile banner.")
      .addUserOption(opt => opt.setName('target').setDescription('User to view (default: you)').setRequired(false))
  );

export async function execute(interaction: ChatInputCommandInteraction, client: VeluClient): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  // ── INFO ──────────────────────────────────────────────────────────────────
  if (subcommand === 'info') {
    if (!interaction.guild) return;
    const member = (interaction.options.getMember('target') || interaction.member) as any;

    if (!member) {
      const user = interaction.options.getUser('target') || interaction.user;
      const embed = UIFactory.premium(`User Info: ${user.tag}`, '', {
        fields: [
          { name: 'ID', value: `\`${user.id}\``, inline: true },
          { name: 'Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true }
        ],
        thumbnail: user.displayAvatarURL()
      });
      await middleware.safeReply(interaction, { embeds: [embed] });
      return;
    }

    const user = member.user;
    const roles = member.roles.cache
      .filter((role: any) => role.name !== '@everyone')
      .map((role: any) => role.toString())
      .join(', ') || 'None';

    const embed = UIFactory.premium(`User Info: ${user.tag}`, '', {
      fields: [
        { name: 'ID', value: `\`${user.id}\``, inline: true },
        { name: 'Nickname', value: member.nickname || 'None', inline: true },
        { name: 'Created At', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Joined At', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
        { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true },
        { name: 'Roles', value: roles }
      ],
      thumbnail: user.displayAvatarURL()
    });
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  // ── AVATAR ────────────────────────────────────────────────────────────────
  if (subcommand === 'avatar') {
    const user = interaction.options.getUser('target') || interaction.user;
    const avatarUrl = user.displayAvatarURL({ size: 1024, dynamic: true } as any);

    const embed = UIFactory.premium(`${user.tag}'s Avatar`, `[Link to Avatar](${avatarUrl})`, {
      image: avatarUrl
    });
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  // ── BANNER ────────────────────────────────────────────────────────────────
  if (subcommand === 'banner') {
    const targetUser = interaction.options.getUser('target') || interaction.user;

    await middleware.safeDefer(interaction);

    try {
      const user = await client.users.fetch(targetUser.id, { force: true });
      const bannerUrl = (user as any).bannerURL?.({ size: 1024, dynamic: true });

      if (!bannerUrl) {
        const errorEmbed = UIFactory.warning('No Banner Found', `**${user.tag}** does not have a profile banner set.`);
        await middleware.safeReply(interaction, { embeds: [errorEmbed] });
        return;
      }

      const embed = UIFactory.premium(`${user.tag}'s Banner`, `[Link to Banner](${bannerUrl})`, {
        image: bannerUrl
      });
      await middleware.safeReply(interaction, { embeds: [embed] });
    } catch (error: any) {
      logger.error('Failed to fetch user banner', error);
      await middleware.safeReply(interaction, { embeds: [UIFactory.error('Error', 'Could not retrieve banner data.')] });
    }
  }
}
