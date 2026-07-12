import { SlashCommandBuilder } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const data = new SlashCommandBuilder()
  .setName('coinflip')
  .setDescription('Flip a coin (Heads or Tails).');

export async function execute(interaction) {
  const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
  const icon = result === 'Heads' ? '🪙' : '🪙';

  const embed = UIFactory.premium('Coin Flipper', `The coin spun in the air and landed on...\n\n${icon} **${result}**`);
  await middleware.safeReply(interaction, { embeds: [embed] });
}
