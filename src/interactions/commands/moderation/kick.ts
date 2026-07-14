import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { permissionManager } from '../../../utils/permissionManager.js';
import { actionLogger } from '../../../utils/actionLogger.js';
import { klipyService } from '../../../services/klipy.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Moderation';
export const userPermission = PermissionFlagsBits.KickMembers;
export const botPermission = PermissionFlagsBits.KickMembers;

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a member from the server.')
  .addUserOption(opt => opt.setName('target').setDescription('Member to kick').setRequired(true))
  .addStringOption(opt => opt.setName('reason').setDescription('Reason for kick').setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const target = interaction.options.getMember('target') as any;
  const reason = interaction.options.getString('reason') || 'No reason provided';

  if (!target) {
    const embed = UIFactory.error('Error', 'Target member not found in this server.');
    await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
  }

  // Verify hierarchy
  if (!(await permissionManager.checkHierarchy(interaction, target))) return;

  await middleware.safeDefer(interaction);

  try {
    // Direct kick execution
    await target.kick(reason);
  } catch (err: any) {
    const embed = UIFactory.error('Kick Failed', `Could not kick ${target}: ${err.message}`);
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  const gifUrl = await klipyService.search('kick', 'anime kick flying');

  const embed = UIFactory.success(
    'Member Kicked',
    `${target.user.tag} has been kicked.\n**Reason:** ${reason}`,
    {
      image: gifUrl || undefined,
      timestamp: true
    }
  );

  await middleware.safeReply(interaction, { embeds: [embed] });

  // Log to Audit Log (the guildMemberRemove event logs this as leaving, but we log the explicit moderation action here)
  const fields = [
    { name: 'Target', value: `${target.user.tag} (\`${target.id}\`)`, inline: true },
    { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
    { name: 'Reason', value: reason, inline: false }
  ];
  await actionLogger.log(interaction.guild, {
    title: '🔨 Member Kicked',
    description: `${target.user.tag} was kicked by ${interaction.user.tag}.`,
    fields,
    color: 0xFF3E3E // Vivid Coral
  });
}
