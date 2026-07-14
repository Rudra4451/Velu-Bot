import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const data = new SlashCommandBuilder()
  .setName('calc')
  .setDescription('Solve a basic mathematical expression.')
  .addStringOption(option =>
    option.setName('expression')
      .setDescription('The math expression to solve (e.g. 2 + 2 * 3).')
      .setRequired(true)
  );

const evaluate = (expression: string) => {
  // Remove spaces
  const sanitized = expression.replace(/\s+/g, '');
  
  // Whitelist check: only digits, decimal points, basic operators, and matching parenthesis
  if (!/^[0-9+\-*/().]+$/.test(sanitized)) {
    throw new Error('Expression contains invalid characters. Only numbers and +, -, *, /, (, ) are allowed.');
  }

  try {
    // 100% safe as the regex limits inputs strictly to arithmetic tokens
    const result = new Function(`return (${sanitized});`)();
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      throw new Error('The calculation resulted in an invalid number.');
    }
    return result;
  } catch {
    throw new Error('Malformed arithmetic expression.');
  }
};

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const expression = interaction.options.getString('expression');

  try {
    const result = evaluate(expression!);
    const embed = UIFactory.premium('Calculator', '', {
      fields: [
        { name: '📥 Input Expression', value: `\`${expression}\`` },
        { name: '📤 Calculated Result', value: `\`${result}\`` }
      ]
    });
    await middleware.safeReply(interaction, { embeds: [embed] });
  } catch (error: any) {
    const errEmbed = UIFactory.error('Calculation Failed', error.message);
    await middleware.safeReply(interaction, { embeds: [errEmbed], ephemeral: true });
  }
}
