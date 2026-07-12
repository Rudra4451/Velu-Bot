import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { permissionManager } from '../../../utils/permissionManager.js';
import { actionLogger } from '../../../utils/actionLogger.js';
import { klipyService } from '../../../services/klipy.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Moderation';
export const userPermission = PermissionFlagsBits.ModerateMembers;
export const botPermission = PermissionFlagsBits.ModerateMembers;

export const data = new SlashCommandBuilder()
  .setName('timeout')
  .setDescription('Time out a member (restrict chat/voice permissions).')
  .addUserOption(opt => opt.setName('target').setDescription('Member to timeout').setRequired(true))
  .addIntegerOption(opt =>
    opt.setName('duration')
      .setDescription('Timeout duration')
      .setRequired(true)
      .addChoices(
        { name: '1 Minute', value: 60 },
        { name: '5 Minutes', value: 300 },
        { name: '10 Minutes', value: 600 },
        { name: '1 Hour', value: 3600 },
        { name: '24 Hours', value: 86400 },
        { name: '7 Days', value: 604800 }
      )
  )
  .addStringOption(opt => opt.setName('reason').setDescription('Reason for timeout').setRequired(false));

export async function execute(interaction) {
  const target = interaction.options.getMember('target');
  const duration = interaction.options.getInteger('duration');
  const reason = interaction.options.getString('reason') || 'No reason provided';

  if (!target) {
    const embed = UIFactory.error('Error', 'Target member not found in this server.');
    return middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
  }

  // Verify hierarchy
  if (!(await permissionManager.checkHierarchy(interaction, target))) return;

  await middleware.safeDefer(interaction);

  try {
    const ms = duration * 1000;
    await target.timeout(ms, reason);
  } catch (err) {
    const embed = UIFactory.error('Timeout Failed', `Could not timeout ${target}: ${err.message}`);
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  const gifUrl = await klipyService.search('timeout', 'anime silence quiet tape');

  const embed = UIFactory.success(
    'Member Timed Out',
    `${target.user.tag} has been timed out for **${duration / 60} minutes**.\n**Reason:** ${reason}`,
    {
      image: gifUrl || undefined,
      timestamp: true
    }
  );

  await middleware.safeReply(interaction, { embeds: [embed] });

  // Log to Audit Log (will also trigger guildMemberUpdate, but we log the explicit moderation action)
  const fields = [
    { name: 'Target', value: `${target.user.tag} (\`${target.id}\`)`, inline: true },
    { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
    { name: 'Duration', value: `${duration / 60} minutes`, inline: true },
    { name: 'Reason', value: reason, inline: false }
  ];
  await actionLogger.log(interaction.guild, {
    title: '🔇 Member Timed Out',
    description: `${target.user.tag} was timed out by ${interaction.user.tag}.`,
    fields,
    color: 0xFF8C00 // Amber
  });
}
