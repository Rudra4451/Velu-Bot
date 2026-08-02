import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Utility';

export const data = new SlashCommandBuilder()
  .setName('tools')
  .setDescription('Developer and utility tools.')
  .addSubcommand(sub =>
    sub.setName('base64')
      .setDescription('Encode or decode Base64.')
      .addStringOption(opt => opt.setName('action').setDescription('Encode or Decode').addChoices({ name: 'Encode', value: 'encode' }, { name: 'Decode', value: 'decode' }).setRequired(true))
      .addStringOption(opt => opt.setName('text').setDescription('Text to process').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('uuid')
      .setDescription('Generate a random UUID v4.')
  )
  .addSubcommand(sub =>
    sub.setName('snowflake')
      .setDescription('Decode a Discord Snowflake ID.')
      .addStringOption(opt => opt.setName('id').setDescription('The Snowflake ID').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'base64') {
    const action = interaction.options.getString('action')!;
    const text = interaction.options.getString('text')!;
    let result = '';

    try {
      if (action === 'encode') {
        result = Buffer.from(text).toString('base64');
      } else {
        result = Buffer.from(text, 'base64').toString('utf-8');
      }
      const embed = UIFactory.success(`Base64 ${action === 'encode' ? 'Encode' : 'Decode'}`, `\`\`\`\n${result}\n\`\`\``);
      await middleware.safeReply(interaction, { embeds: [embed] });
    } catch (e: any) {
      await middleware.safeReply(interaction, { embeds: [UIFactory.error('Failed', e.message)] });
    }
  }

  if (subcommand === 'uuid') {
    const uuid = crypto.randomUUID();
    const embed = UIFactory.success('UUID Generated', `\`\`\`\n${uuid}\n\`\`\``);
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'snowflake') {
    const id = interaction.options.getString('id')!;
    try {
      // Discord epoch is 1420070400000
      const timestamp = (BigInt(id) >> 22n) + 1420070400000n;
      const date = new Date(Number(timestamp));
      
      const embed = UIFactory.premium('❄️ Snowflake Information', `**ID:** \`${id}\``, {
        fields: [
          { name: 'Timestamp', value: `<t:${Math.floor(date.getTime() / 1000)}:F>`, inline: false },
          { name: 'Relative', value: `<t:${Math.floor(date.getTime() / 1000)}:R>`, inline: false }
        ]
      });
      await middleware.safeReply(interaction, { embeds: [embed] });
    } catch (e) {
      await middleware.safeReply(interaction, { embeds: [UIFactory.error('Invalid ID', 'Provided string is not a valid Snowflake.')] });
    }
  }
}
