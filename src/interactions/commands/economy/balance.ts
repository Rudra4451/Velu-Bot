import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { db } from '../../../state/db.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Economy';

export const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Check your current coin balance.')
  .addUserOption(option => 
    option.setName('user')
      .setDescription('The user to check balance for')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  if (!interaction.guild) return;
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const eco = db.getEconomy(interaction.guild.id, targetUser.id);

  const embed = UIFactory.success(
    `${targetUser.username}'s Wallet`,
    `**Balance:** ${eco.coins} 🍡 Coins\n\n*Earn more by chatting or claiming your \`/daily\`!*`,
    {
      thumbnail: targetUser.displayAvatarURL({ forceStatic: false } as any)
    }
  );

  await middleware.safeReply(interaction, { embeds: [embed] });
}
