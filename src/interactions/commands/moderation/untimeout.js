import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { permissionManager } from '../../../utils/permissionManager.js';
import { actionLogger } from '../../../utils/actionLogger.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Moderation';
export const userPermission = PermissionFlagsBits.ModerateMembers;
export const botPermission = PermissionFlagsBits.ModerateMembers;

export const data = new SlashCommandBuilder()
  .setName('untimeout')
  .setDescription('Remove timeout from a member.')
  .addUserOption(opt => opt.setName('target').setDescription('Member to untimeout').setRequired(true))
  .addStringOption(opt => opt.setName('reason').setDescription('Reason for untimeout').setRequired(false));

export async function execute(interaction) {
  const target = interaction.options.getMember('target');
  const reason = interaction.options.getString('reason') || 'No reason provided';

  if (!target) {
    const embed = UIFactory.error('Error', 'Target member not found in this server.');
    return middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
  }

  // Verify hierarchy
  if (!(await permissionManager.checkHierarchy(interaction, target))) return;

  await middleware.safeDefer(interaction);

  try {
    await target.timeout(null, reason);
  } catch (err) {
    const embed = UIFactory.error('Untimeout Failed', `Could not remove timeout for ${target}: ${err.message}`);
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  const embed = UIFactory.success('Timeout Removed', `Successfully removed timeout for ${target.user.tag}.\n**Reason:** ${reason}`);
  await middleware.safeReply(interaction, { embeds: [embed] });

  // Log to Audit Log
  const fields = [
    { name: 'Target', value: `${target.user.tag} (\`${target.id}\`)`, inline: true },
    { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
    { name: 'Reason', value: reason, inline: false }
  ];
  await actionLogger.log(interaction.guild, {
    title: '🔊 Timeout Removed',
    description: `Timeout was removed for ${target.user.tag} by ${interaction.user.tag}.`,
    fields,
    color: 0x00FA9A // Neon Mint
  });
}
