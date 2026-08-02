import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { guildStorage } from '../../../database/repositories/GuildRepository.js';
import { warningStorage } from '../../../database/repositories/WarningRepository.js';
import { afkStorage } from '../../../database/repositories/AfkRepository.js';
import { UIFactory } from '../../../ui/factory.js';
import { permissionManager } from '../../../utils/permissionManager.js';
import { actionLogger } from '../../../utils/actionLogger.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Moderation';
export const userPermission = PermissionFlagsBits.ModerateMembers;
export const botPermission = null;

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Manage member warnings.')
  .addSubcommand(sub =>
    sub.setName('issue')
      .setDescription('Issue a warning to a member.')
      .addUserOption(opt => opt.setName('target').setDescription('Member to warn').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason for warning').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('list')
      .setDescription('View all warnings for a member.')
      .addUserOption(opt => opt.setName('target').setDescription('Member to check').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('clear')
      .setDescription('Clear all warnings for a member.')
      .addUserOption(opt => opt.setName('target').setDescription('Member to clear').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();

  // ── ISSUE ─────────────────────────────────────────────────────────────────
  if (subcommand === 'issue') {
    const target = interaction.options.getMember('target') as any;
    const reason = interaction.options.getString('reason')!;

    if (!target) {
      await middleware.safeReply(interaction, { embeds: [UIFactory.error('Error', 'Target member not found.')], ephemeral: true });
      return;
    }

    if (!(await permissionManager.checkHierarchy(interaction, target))) return;

    await middleware.safeDefer(interaction);

    const warns = warningStorage.get(interaction.guild.id) || [];
    const warnRecord = {
      id: Math.random().toString(36).substring(2, 8).toUpperCase(),
      userId: target.id,
      moderatorId: interaction.user.id,
      reason,
      timestamp: Date.now()
    };
    warns.push(warnRecord);
    warningStorage.set(interaction.guild.id, warns);
    const userWarns = warns.filter(w => w.userId === target.id);

    const embed = UIFactory.success('Member Warned',
      `${target} has been warned.\n**Reason:** ${reason}\nTotal warnings: **${userWarns.length}**`,
      { footerText: `Warn ID: ${warnRecord.id}`, timestamp: true }
    );
    await middleware.safeReply(interaction, { embeds: [embed] });

    await actionLogger.log(interaction.guild, {
      title: '⚠️ Member Warned',
      description: `${target.user.tag} was warned by ${interaction.user.tag}.`,
      fields: [
        { name: 'Target', value: `${target} (\`${target.id}\`)`, inline: true },
        { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
        { name: 'Reason', value: reason, inline: false },
        { name: 'Warn ID', value: `\`${warnRecord.id}\``, inline: true },
        { name: 'Total Warnings', value: `\`${userWarns.length}\``, inline: true }
      ],
      color: 0xFF8C00
    });
  }

  // ── LIST ──────────────────────────────────────────────────────────────────
  if (subcommand === 'list') {
    const target = interaction.options.getUser('target')!;
    const warns = warningStorage.get(interaction.guild.id) || [];
    const userWarns = warns.filter(w => w.userId === target.id);

    if (userWarns.length === 0) {
      await middleware.safeReply(interaction, { embeds: [UIFactory.info('Clean Record', `${target} has no warnings.`)] });
      return;
    }

    const fields = userWarns.map((warn, index) => ({
      name: `Warning #${index + 1} | ID: ${warn.id}`,
      value: `**Moderator:** <@${warn.moderatorId}>\n**Reason:** ${warn.reason}\n**Date:** <t:${Math.floor(warn.timestamp / 1000)}:f>`,
      inline: false
    }));

    const embed = UIFactory.premium(`✦ Warnings for ${target.username}`, `Total active warnings: **${userWarns.length}**`, { fields });
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  // ── CLEAR ─────────────────────────────────────────────────────────────────
  if (subcommand === 'clear') {
    const target = interaction.options.getMember('target') as any;

    if (!target) {
      await middleware.safeReply(interaction, { embeds: [UIFactory.error('Error', 'Target member not found.')], ephemeral: true });
      return;
    }

    if (!(await permissionManager.checkHierarchy(interaction, target))) return;

    const warns = warningStorage.get(interaction.guild!.id) || [];
    const remaining = warns.filter(w => w.userId !== target.id);
    const count = warns.length - remaining.length;
    warningStorage.set(interaction.guild!.id, remaining);

    if (count === 0) {
      await middleware.safeReply(interaction, { embeds: [UIFactory.info('Clean Record', `${target} has no warnings to clear.`)] });
      return;
    }

    const embed = UIFactory.success('Warnings Cleared', `Successfully cleared **${count}** warnings for ${target}.`);
    await middleware.safeReply(interaction, { embeds: [embed] });

    await actionLogger.log(interaction.guild, {
      title: '🧹 Warnings Cleared',
      description: `All warnings for ${target.user.tag} were cleared by ${interaction.user.tag}.`,
      fields: [
        { name: 'Target', value: `${target} (\`${target.id}\`)`, inline: true },
        { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
        { name: 'Cleared Warnings', value: `\`${count}\``, inline: true }
      ],
      color: 0x00FA9A
    });
  }
}
