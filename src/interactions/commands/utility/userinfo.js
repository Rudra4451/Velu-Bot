import { SlashCommandBuilder } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const data = new SlashCommandBuilder()
  .setName('userinfo')
  .setDescription("Show profile details of a member.")
  .addUserOption(option =>
    option.setName('target')
      .setDescription('The user whose details you want to view.')
      .setRequired(false)
  );

export async function execute(interaction) {
  const member = interaction.options.getMember('target') || interaction.member;
  if (!member) {
    // In DMs, fall back to user
    const user = interaction.options.getUser('target') || interaction.user;
    const embed = UIFactory.premium(`User Info: ${user.tag}`, '', {
      fields: [
        { name: 'ID', value: `\`${user.id}\``, inline: true },
        { name: 'Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true }
      ],
      thumbnail: user.displayAvatarURL()
    });
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  const { user } = member;
  const roles = member.roles.cache
    .filter(role => role.name !== '@everyone')
    .map(role => role.toString())
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
