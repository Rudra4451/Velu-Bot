import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';
import { logger } from '../../../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('reminder')
  .setDescription('Set a temporary in-memory reminder.')
  .addIntegerOption(option =>
    option.setName('duration')
      .setDescription('The duration to wait.')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(1440) // max 24 hours (1440 mins)
  )
  .addStringOption(option =>
    option.setName('unit')
      .setDescription('Unit of time.')
      .setRequired(true)
      .addChoices(
        { name: 'Minutes', value: 'm' },
        { name: 'Hours', value: 'h' }
      )
  )
  .addStringOption(option =>
    option.setName('message')
      .setDescription('The message to remind you of.')
      .setRequired(true)
      .setMaxLength(500)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const duration = interaction.options.getInteger('duration');
  const unit = interaction.options.getString('unit');
  const message = interaction.options.getString('message');

  const factor = unit === 'm' ? 60 * 1000 : 3600 * 1000;
  const delayMs = duration! * factor;

  const expirationUnix = Math.floor((Date.now() + delayMs) / 1000);
  
  const embed = UIFactory.success(
    'Reminder Set',
    `I will remind you about:\n**"${message}"**\n\n⏰ Trigger time: <t:${expirationUnix}:R> (In-memory only)`
  );

  await middleware.safeReply(interaction, { embeds: [embed] });

  // Set ephemeral in-memory timer
  setTimeout(async () => {
    try {
      const dmEmbed = UIFactory.info(
        'Reminder Notification',
        `⏰ **You set a reminder:**\n"${message}"\n\n*Server: ${interaction.guild?.name || 'DMs'}*`
      );

      // Attempt to send a direct message first
      await interaction.user.send({ embeds: [dmEmbed] }).catch(async () => {
        // Fall back to channel message if DMs are closed
        const channelEmbed = UIFactory.info(
          'Reminder Notification',
          `⏰ <@${interaction.user.id}>, **here is your reminder:**\n"${message}"`
        );
        await (interaction.channel as any).send({ content: `<@${interaction.user.id}>`, embeds: [channelEmbed] }).catch(() => {});
      });
      logger.debug(`Triggered reminder for user ${interaction.user.id}`);
    } catch (err: any) {
      logger.error('Failed to deliver reminder', err);
    }
  }, delayMs);
}
