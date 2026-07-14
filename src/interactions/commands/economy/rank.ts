import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { db } from '../../../state/db.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Economy';

export const data = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('Check your current level and XP.')
  .addUserOption(option => 
    option.setName('user')
      .setDescription('The user to check rank for')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  if (!interaction.guild) return;
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const eco = db.getEconomy(interaction.guild.id, targetUser.id);
  
  // XP needed for next level: level = 0.1 * sqrt(xp) -> xp = (level / 0.1)^2
  const nextLevelXp = Math.pow((eco.level) / 0.1, 2);
  const currentLevelXp = Math.pow((eco.level - 1) / 0.1, 2);
  const xpIntoLevel = eco.xp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;
  const progressPercent = Math.min(100, Math.max(0, (xpIntoLevel / xpNeeded) * 100));
  
  const progressBar = createProgressBar(progressPercent);

  const embed = UIFactory.premium(
    `${targetUser.username}'s Rank`,
    `**Level:** ${eco.level} 🌟\n**XP:** ${Math.floor(eco.xp)} / ${Math.floor(nextLevelXp)}\n\n${progressBar} ${progressPercent.toFixed(1)}%`,
    {
      thumbnail: targetUser.displayAvatarURL({ forceStatic: false } as any)
    }
  );

  await middleware.safeReply(interaction, { embeds: [embed] });
}

function createProgressBar(percent: number, length: number = 10): string {
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  return '🟩'.repeat(filled) + '⬜'.repeat(empty);
}
