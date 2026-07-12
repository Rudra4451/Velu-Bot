import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { permissionManager } from '../../../utils/permissionManager.js';
import { actionLogger } from '../../../utils/actionLogger.js';
import { klipyService } from '../../../services/klipy.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Moderation';
export const userPermission = PermissionFlagsBits.BanMembers;
export const botPermission = PermissionFlagsBits.BanMembers;

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a user from the server.')
  .addUserOption(opt => opt.setName('target').setDescription('User to ban').setRequired(true))
  .addStringOption(opt => opt.setName('reason').setDescription('Reason for ban').setRequired(false))
  .addIntegerOption(opt =>
    opt.setName('delete_messages')
      .setDescription('How much of their message history to delete')
      .setRequired(false)
      .addChoices(
        { name: "Don't Delete", value: 0 },
        { name: "Previous 1 Hour", value: 3600 },
        { name: "Previous 24 Hours", value: 86400 },
        { name: "Previous 7 Days", value: 604800 }
      )
  );

export async function execute(interaction) {
  const targetUser = interaction.options.getUser('target');
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const deleteSeconds = interaction.options.getInteger('delete_messages') || 0;

  const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

  // If the target is in the server, verify hierarchy
  if (targetMember) {
    if (!(await permissionManager.checkHierarchy(interaction, targetMember))) return;
  }

  await middleware.safeDefer(interaction);

  try {
    await interaction.guild.bans.create(targetUser.id, {
      reason,
      deleteMessageSeconds: deleteSeconds
    });
  } catch (err) {
    const embed = UIFactory.error('Ban Failed', `Could not ban ${targetUser.tag}: ${err.message}`);
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  const gifUrl = await klipyService.search('ban', 'anime ban hammer punch');

  const embed = UIFactory.success(
    'User Banned',
    `${targetUser.tag} has been banned.\n**Reason:** ${reason}`,
    {
      image: gifUrl || undefined,
      timestamp: true
    }
  );

  await middleware.safeReply(interaction, { embeds: [embed] });

  // Log to Audit Log (handled by guildBanAdd too, but we log explicitly here)
  const fields = [
    { name: 'Target', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
    { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
    { name: 'Reason', value: reason, inline: false },
    { name: 'Purged Messages', value: `${deleteSeconds / 3600} hours`, inline: true }
  ];
  await actionLogger.log(interaction.guild, {
    title: '🔨 Member Banned',
    description: `${targetUser.tag} was banned by ${interaction.user.tag}.`,
    fields,
    color: 0xFF3E3E // Vivid Coral
  });
}
