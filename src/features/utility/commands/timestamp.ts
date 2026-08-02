import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const data = new SlashCommandBuilder()
  .setName('timestamp')
  .setDescription('Generate a Discord markdown timestamp.')
  .addIntegerOption(option =>
    option.setName('offset')
      .setDescription('Offset value (positive for future, negative for past).')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('unit')
      .setDescription('The unit of time offset.')
      .setRequired(true)
      .addChoices(
        { name: 'Minutes', value: 'm' },
        { name: 'Hours', value: 'h' },
        { name: 'Days', value: 'd' }
      )
  )
  .addStringOption(option =>
    option.setName('format')
      .setDescription('The display format of the timestamp.')
      .setRequired(false)
      .addChoices(
        { name: 'Short Time (16:20)', value: 't' },
        { name: 'Long Time (16:20:30)', value: 'T' },
        { name: 'Short Date (11/07/2026)', value: 'd' },
        { name: 'Long Date (11 July 2026)', value: 'D' },
        { name: 'Short Date/Time (11 July 2026 16:20)', value: 'f' },
        { name: 'Long Date/Time (Saturday, 11 July 2026 16:20)', value: 'F' },
        { name: 'Relative (in 2 hours / 5 minutes ago)', value: 'R' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const offset = interaction.options.getInteger('offset');
  const unit = interaction.options.getString('unit');
  const format = interaction.options.getString('format') || 'R';

  let multiplier = 60; // minutes to seconds
  if (unit === 'h') multiplier = 3600; // hours to seconds
  if (unit === 'd') multiplier = 86400; // days to seconds

  const currentUnix = Math.floor(Date.now() / 1000);
  const targetUnix = currentUnix + (offset! * multiplier);

  const discordFormat = `<t:${targetUnix}:${format}>`;
  const codeBlock = `\`${discordFormat}\``;

  const embed = UIFactory.premium('Discord Timestamp Generator', '', {
    fields: [
      { name: '✨ Live Timestamp', value: discordFormat, inline: true },
      { name: '📥 Markdown Format Code', value: codeBlock, inline: true }
    ]
  });

  await middleware.safeReply(interaction, { embeds: [embed] });
}
