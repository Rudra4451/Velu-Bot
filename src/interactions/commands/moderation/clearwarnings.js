import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { db } from '../../../state/db.js';
import { UIFactory } from '../../../ui/factory.js';
import { permissionManager } from '../../../utils/permissionManager.js';
import { actionLogger } from '../../../utils/actionLogger.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Moderation';
export const userPermission = PermissionFlagsBits.ModerateMembers;
export const botPermission = null;

export const data = new SlashCommandBuilder()
  .setName('clearwarnings')
  .setDescription('Clear all warnings for a member.')
  .addUserOption(opt => opt.setName('target').setDescription('Member to clear').setRequired(true));

export async function execute(interaction) {
  const target = interaction.options.getMember('target');

  if (!target) {
    const embed = UIFactory.error('Error', 'Target member not found in this server.');
    return middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
  }

  // Verify hierarchy
  if (!(await permissionManager.checkHierarchy(interaction, target))) return;

  const count = db.clearWarnings(interaction.guild.id, target.id);

  if (count === 0) {
    const embed = UIFactory.info('Clean Record', `${target} has no warnings to clear.`);
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  const embed = UIFactory.success('Warnings Cleared', `Successfully cleared **${count}** warnings for ${target}.`);
  await middleware.safeReply(interaction, { embeds: [embed] });

  // Log to Audit Log
  const fields = [
    { name: 'Target', value: `${target} (\`${target.id}\`)`, inline: true },
    { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
    { name: 'Cleared Warnings', value: `\`${count}\``, inline: true }
  ];
  await actionLogger.log(interaction.guild, {
    title: '🧹 Warnings Cleared',
    description: `All warnings for ${target.user.tag} were cleared by ${interaction.user.tag}.`,
    fields,
    color: 0x00FA9A // Neon Mint
  });
}
