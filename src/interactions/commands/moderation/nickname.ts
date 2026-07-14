import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { permissionManager } from '../../../utils/permissionManager.js';
import { actionLogger } from '../../../utils/actionLogger.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Moderation';
export const userPermission = PermissionFlagsBits.ManageNicknames;
export const botPermission = PermissionFlagsBits.ManageNicknames;

export const data = new SlashCommandBuilder()
  .setName('nickname')
  .setDescription('Change the nickname of a member.')
  .addUserOption(opt => opt.setName('target').setDescription('Member to rename').setRequired(true))
  .addStringOption(opt => opt.setName('nick').setDescription('New nickname (leave blank to reset)').setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const target = interaction.options.getMember('target') as any;
  const nick = interaction.options.getString('nick'); // null if not provided

  if (!target) {
    const embed = UIFactory.error('Error', 'Target member not found in this server.');
    await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
  }

  // Verify hierarchy
  if (!(await permissionManager.checkHierarchy(interaction, target))) return;

  await middleware.safeDefer(interaction);

  try {
    await target.setNickname(nick);
  } catch (err: any) {
    const embed = UIFactory.error('Nickname Update Failed', `Could not update nickname for ${target}: ${err.message}`);
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  const embed = UIFactory.success(
    'Nickname Updated',
    nick 
      ? `Successfully set nickname for ${target} to **${nick}**.` 
      : `Successfully reset nickname for ${target}.`
  );
  await middleware.safeReply(interaction, { embeds: [embed] });

  // Log to Audit Log (will also trigger guildMemberUpdate, but we log the explicit moderation action)
  const fields = [
    { name: 'Target', value: `${target.user.tag} (\`${target.id}\`)`, inline: true },
    { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
    { name: 'New Nickname', value: nick || '_Reset to Default_', inline: true }
  ];
  await actionLogger.log(interaction.guild, {
    title: '🏷️ Nickname Updated',
    description: `${target.user.tag}'s nickname was updated by ${interaction.user.tag}.`,
    fields,
    color: 0x00BFFF // Deep Sky Blue
  });
}
