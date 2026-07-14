import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { db } from '../../../state/db.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Economy';

export const data = new SlashCommandBuilder()
  .setName('pay')
  .setDescription('Give coins to another user.')
  .addUserOption(option => 
    option.setName('user')
      .setDescription('The user to pay')
      .setRequired(true)
  )
  .addIntegerOption(option => 
    option.setName('amount')
      .setDescription('Amount of coins to give')
      .setRequired(true)
      .setMinValue(1)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  if (!interaction.guild) return;
  const targetUser = interaction.options.getUser('user', true);
  const amount = interaction.options.getInteger('amount', true);
  
  if (targetUser.id === interaction.user.id) {
    const embed = UIFactory.warning('Invalid Target', 'You cannot pay yourself!');
    await middleware.safeReply(interaction, { embeds: [embed] });
    return;
  }
  
  if (targetUser.bot) {
    const embed = UIFactory.warning('Invalid Target', 'Bots have no use for money!');
    await middleware.safeReply(interaction, { embeds: [embed] });
    return;
  }

  const senderEco = db.getEconomy(interaction.guild.id, interaction.user.id);
  
  if (senderEco.coins < amount) {
    const embed = UIFactory.error('Insufficient Funds', `You only have **${senderEco.coins} 🍡**!`);
    await middleware.safeReply(interaction, { embeds: [embed] });
    return;
  }

  const targetEco = db.getEconomy(interaction.guild.id, targetUser.id);
  
  senderEco.coins -= amount;
  targetEco.coins += amount;
  
  db.updateEconomy(interaction.guild.id, interaction.user.id, senderEco);
  db.updateEconomy(interaction.guild.id, targetUser.id, targetEco);

  const embed = UIFactory.success(
    'Payment Successful! 💸',
    `You paid **${amount} 🍡 Coins** to ${targetUser}.\nYour remaining balance: **${senderEco.coins} 🍡**`
  );
  await middleware.safeReply(interaction, { embeds: [embed] });
}
