import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { db } from '../../../state/db.js';
import { UIFactory } from '../../../ui/factory.js';
import { permissionManager } from '../../../utils/permissionManager.js';
import { actionLogger } from '../../../utils/actionLogger.js';
import { klipyService } from '../../../services/klipy.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Moderation';
export const userPermission = PermissionFlagsBits.ModerateMembers;
export const botPermission = null;

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Issue a warning to a member.')
  .addUserOption(opt => opt.setName('target').setDescription('Member to warn').setRequired(true))
  .addStringOption(opt => opt.setName('reason').setDescription('Reason for warning').setRequired(true));

export async function execute(interaction) {
  const target = interaction.options.getMember('target');
  const reason = interaction.options.getString('reason');

  if (!target) {
    const embed = UIFactory.error('Error', 'Target member not found in this server.');
    return middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
  }

  // Verify hierarchy
  if (!(await permissionManager.checkHierarchy(interaction, target))) return;

  await middleware.safeDefer(interaction);

  const warnRecord = db.addWarning(interaction.guild.id, target.id, interaction.user.id, reason);
  const userWarns = db.getWarnings(interaction.guild.id, target.id);

  const gifUrl = await klipyService.search('warning', 'anime warning angry mad');

  const embed = UIFactory.success(
    'Member Warned',
    `${target} has been warned.\n**Reason:** ${reason}\nTotal warnings: **${userWarns.length}**`,
    {
      image: gifUrl || undefined,
      footerText: `Warn ID: ${warnRecord.id}`,
      timestamp: true
    }
  );

  await middleware.safeReply(interaction, { embeds: [embed] });

  // Log to Audit Log
  const fields = [
    { name: 'Target', value: `${target} (\`${target.id}\`)`, inline: true },
    { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
    { name: 'Reason', value: reason, inline: false },
    { name: 'Warn ID', value: `\`${warnRecord.id}\``, inline: true },
    { name: 'Total Warnings', value: `\`${userWarns.length}\``, inline: true }
  ];
  await actionLogger.log(interaction.guild, {
    title: '⚠️ Member Warned',
    description: `${target.user.tag} was warned by ${interaction.user.tag}.`,
    fields,
    color: 0xFF8C00 // Amber
  });
}
