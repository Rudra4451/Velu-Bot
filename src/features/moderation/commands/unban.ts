import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';
import { actionLogger } from '../../../utils/actionLogger.js';

export const module = 'Moderation';

export const data = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Unban a user from the server using their User ID.')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addStringOption(option =>
    option.setName('target_id')
      .setDescription('The Discord User ID to unban')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for unbanning this user')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const targetId = interaction.options.getString('target_id', true);
  const reason = interaction.options.getString('reason') || 'No reason provided';

  await interaction.deferReply();

  try {
    const banInfo = await interaction.guild.bans.fetch(targetId).catch(() => null);
    if (!banInfo) {
      const embed = UIFactory.warning('User Not Banned', `No active ban found for user ID \`${targetId}\`.`);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    await interaction.guild.members.unban(targetId, reason);

    const embed = UIFactory.success(
      'User Unbanned',
      `Successfully unbanned **${banInfo.user.tag}** (\`${targetId}\`).\n\n**Reason:** ${reason}`
    );

    await interaction.editReply({ embeds: [embed] });

    await actionLogger.log(interaction.guild, {
      title: '🛡️ Member Unbanned',
      description: `Target: **${banInfo.user.tag}** (\`${targetId}\`)\nModerator: ${interaction.user}\nReason: ${reason}`
    });
  } catch (error: any) {
    const embed = UIFactory.error('Unban Failed', error.message || 'Failed to unban user.');
    await interaction.editReply({ embeds: [embed] });
  }
}
