import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { db } from '../../../state/db.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Economy';

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily coins!');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  if (!interaction.guild) return;
  const userId = interaction.user.id;
  const eco = db.getEconomy(interaction.guild.id, userId);

  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  if (now - eco.lastDaily < ONE_DAY) {
    const timeLeft = ONE_DAY - (now - eco.lastDaily);
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    const embed = UIFactory.warning(
      'Already Claimed',
      `You've already claimed your daily reward!\nCome back in **${hours}h ${minutes}m**.`
    );
    await middleware.safeReply(interaction, { embeds: [embed] });
    return;
  }

  const reward = Math.floor(Math.random() * 100) + 100; // 100 to 200 coins
  eco.coins += reward;
  eco.lastDaily = now;
  db.updateEconomy(interaction.guild.id, userId, eco);

  const embed = UIFactory.success(
    'Daily Reward Claimed! 🎁',
    `You received **${reward} 🍡 Coins**!\nYour new balance is **${eco.coins} 🍡**.`
  );
  await middleware.safeReply(interaction, { embeds: [embed] });
}
