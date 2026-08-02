import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { actionLogger } from '../../../utils/actionLogger.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Moderation';
export const userPermission = PermissionFlagsBits.ManageMessages;
export const botPermission = PermissionFlagsBits.ManageMessages;

export const data = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('Delete a specified amount of messages in this channel.')
  .addIntegerOption(opt =>
    opt.setName('amount')
      .setDescription('Number of messages to delete (1-100)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const amount = interaction.options.getInteger('amount');
  const channel = interaction.channel;

  await middleware.safeDefer(interaction, true); // Defer ephemerally

  try {
    const deleted = await (channel as any).bulkDelete(amount, true);
    
    const embed = UIFactory.success('Purge Complete', `Successfully deleted **${deleted.size}** messages.`);
    await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });

    // Log to Audit Log
    const fields = [
      { name: 'Channel', value: `${channel}`, inline: true },
      { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
      { name: 'Amount Requested', value: `${amount}`, inline: true },
      { name: 'Amount Deleted', value: `${deleted.size}`, inline: true }
    ];
    await actionLogger.log(interaction.guild, {
      title: '🧹 Messages Purged',
      description: `Purged ${deleted.size} messages in ${channel} by ${interaction.user.tag}.`,
      fields,
      color: 0x00BFFF // Deep Sky Blue
    });
  } catch (err: any) {
    const embed = UIFactory.error('Purge Failed', `Could not purge messages: ${err.message}`);
    await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
  }
}
