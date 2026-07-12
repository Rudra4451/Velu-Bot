import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { actionLogger } from '../../../utils/actionLogger.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Moderation';
export const userPermission = PermissionFlagsBits.BanMembers;
export const botPermission = PermissionFlagsBits.BanMembers;

export const data = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Unban a user from the server.')
  .addStringOption(opt => opt.setName('user_id').setDescription('Discord User ID to unban').setRequired(true))
  .addStringOption(opt => opt.setName('reason').setDescription('Reason for unban').setRequired(false));

export async function execute(interaction) {
  const input = interaction.options.getString('user_id').trim();
  const reason = interaction.options.getString('reason') || 'No reason provided';

  await middleware.safeDefer(interaction);

  // 1. Resolve target ID
  const mentionMatch = input.match(/^<@!?(\d{17,20})>$/);
  let targetId = mentionMatch ? mentionMatch[1] : (input.match(/^\d{17,20}$/) ? input : null);

  // 2. If not ID, search guild bans by username/tag
  if (!targetId) {
    const cleanInput = input.replace(/^@/, '').toLowerCase();
    try {
      const bans = await interaction.guild.bans.fetch();
      const matchedBan = bans.find(ban => 
        ban.user.username.toLowerCase() === cleanInput ||
        ban.user.tag.toLowerCase() === cleanInput
      );
      if (matchedBan) {
        targetId = matchedBan.user.id;
      }
    } catch (err) {
      // Quietly ignore or handle fetch errors
    }
  }

  const userId = targetId || input;

  try {
    await interaction.guild.bans.remove(userId, reason);
  } catch (err) {
    const embed = UIFactory.error('Unban Failed', `Could not unban user "${input}": ${err.message}`);
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  const embed = UIFactory.success('User Unbanned', `Successfully unbanned user \`${userId}\`.\n**Reason:** ${reason}`);
  await middleware.safeReply(interaction, { embeds: [embed] });

  // Log to Audit Log
  const fields = [
    { name: 'Target ID', value: `\`${userId}\``, inline: true },
    { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
    { name: 'Reason', value: reason, inline: false }
  ];
  await actionLogger.log(interaction.guild, {
    title: '🔓 Member Unbanned',
    description: `User \`${userId}\` was unbanned by ${interaction.user.tag}.`,
    fields,
    color: 0x00FA9A // Neon Mint
  });
}
