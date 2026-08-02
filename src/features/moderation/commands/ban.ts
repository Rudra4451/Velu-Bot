import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
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
  .setDescription('Ban or unban users from the server.')
  .addSubcommand(sub =>
    sub.setName('add')
      .setDescription('Ban a user from the server.')
      .addUserOption(opt => opt.setName('target').setDescription('User to ban').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason for ban').setRequired(false))
      .addIntegerOption(opt =>
        opt.setName('delete_messages')
          .setDescription('How much of their message history to delete')
          .setRequired(false)
          .addChoices(
            { name: "Don't Delete", value: 0 },
            { name: 'Previous 1 Hour', value: 3600 },
            { name: 'Previous 24 Hours', value: 86400 },
            { name: 'Previous 7 Days', value: 604800 }
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName('remove')
      .setDescription('Unban a user from the server.')
      .addStringOption(opt => opt.setName('user_id').setDescription('User ID or username to unban').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason for unban').setRequired(false))
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();

  // ── ADD (BAN) ─────────────────────────────────────────────────────────────
  if (subcommand === 'add') {
    const targetUser = interaction.options.getUser('target')!;
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteSeconds = interaction.options.getInteger('delete_messages') || 0;

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (targetMember) {
      if (!(await permissionManager.checkHierarchy(interaction, targetMember))) return;
    }

    await middleware.safeDefer(interaction);

    try {
      await interaction.guild.bans.create(targetUser.id, { reason, deleteMessageSeconds: deleteSeconds });
    } catch (err: any) {
      const embed = UIFactory.error('Ban Failed', `Could not ban ${targetUser.tag}: ${err.message}`);
      await middleware.safeReply(interaction, { embeds: [embed] });
      return;
    }

    const gifUrl = await klipyService.search('ban', 'anime ban hammer punch');
    const embed = UIFactory.success('User Banned', `${targetUser.tag} has been banned.\n**Reason:** ${reason}`, {
      image: gifUrl || undefined, timestamp: true
    });
    await middleware.safeReply(interaction, { embeds: [embed] });

    await actionLogger.log(interaction.guild, {
      title: '🔨 Member Banned',
      description: `${targetUser.tag} was banned by ${interaction.user.tag}.`,
      fields: [
        { name: 'Target', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
        { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
        { name: 'Reason', value: reason, inline: false },
        { name: 'Purged Messages', value: `${deleteSeconds / 3600} hours`, inline: true }
      ],
      color: 0xFF3E3E
    });
  }

  // ── REMOVE (UNBAN) ────────────────────────────────────────────────────────
  if (subcommand === 'remove') {
    const input = interaction.options.getString('user_id')!.trim();
    const reason = interaction.options.getString('reason') || 'No reason provided';

    await middleware.safeDefer(interaction);

    const mentionMatch = input.match(/^<@!?(\d{17,20})>$/);
    let targetId: string | null = mentionMatch ? mentionMatch[1] : (input.match(/^\d{17,20}$/) ? input : null);

    if (!targetId) {
      const cleanInput = input.replace(/^@/, '').toLowerCase();
      try {
        const bans = await interaction.guild.bans.fetch();
        const matchedBan = bans.find(ban =>
          ban.user.username.toLowerCase() === cleanInput || ban.user.tag.toLowerCase() === cleanInput
        );
        if (matchedBan) targetId = matchedBan.user.id;
      } catch {}
    }

    const userId = targetId || input;

    try {
      await interaction.guild.bans.remove(userId, reason);
    } catch (err: any) {
      const embed = UIFactory.error('Unban Failed', `Could not unban "${input}": ${err.message}`);
      await middleware.safeReply(interaction, { embeds: [embed] });
      return;
    }

    const embed = UIFactory.success('User Unbanned', `Successfully unbanned \`${userId}\`.\n**Reason:** ${reason}`);
    await middleware.safeReply(interaction, { embeds: [embed] });

    await actionLogger.log(interaction.guild, {
      title: '🔓 Member Unbanned',
      description: `User \`${userId}\` was unbanned by ${interaction.user.tag}.`,
      fields: [
        { name: 'Target ID', value: `\`${userId}\``, inline: true },
        { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
        { name: 'Reason', value: reason, inline: false }
      ],
      color: 0x00FA9A
    });
  }
}
