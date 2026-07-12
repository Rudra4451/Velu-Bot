import { SlashCommandBuilder } from 'discord.js';
import crypto from 'crypto';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const data = new SlashCommandBuilder()
  .setName('password')
  .setDescription('Generate a secure random password.')
  .addIntegerOption(option =>
    option.setName('length')
      .setDescription('Length of the password (default: 12, max: 32).')
      .setRequired(false)
      .setMinValue(6)
      .setMaxValue(32)
  )
  .addBooleanOption(option =>
    option.setName('uppercase')
      .setDescription('Include uppercase letters (default: true).')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('numbers')
      .setDescription('Include numbers (default: true).')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('symbols')
      .setDescription('Include symbols (default: true).')
      .setRequired(false)
  );

export async function execute(interaction) {
  const length = interaction.options.getInteger('length') || 12;
  const useUpper = interaction.options.getBoolean('uppercase') !== false;
  const useNumbers = interaction.options.getBoolean('numbers') !== false;
  const useSymbols = interaction.options.getBoolean('symbols') !== false;

  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let allowedChars = lowercase;
  if (useUpper) allowedChars += uppercase;
  if (useNumbers) allowedChars += numbers;
  if (useSymbols) allowedChars += symbols;

  let password = '';
  // Cryptographically secure random generation
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += allowedChars[bytes[i] % allowedChars.length];
  }

  const embed = UIFactory.success(
    'Secure Password Generated',
    `Here is your requested password (sent ephemerally for security):\n\n\`\`\`\n${password}\n\`\`\``,
    { footerText: 'Velu • Cryptographically Secure' }
  );

  // Must reply ephemerally to protect the password from other members in the channel
  await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
}
