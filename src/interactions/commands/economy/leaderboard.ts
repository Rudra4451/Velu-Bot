import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { db } from '../../../state/db.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Economy';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('See the top wealthiest and highest level members!')
  .addStringOption(option => 
    option.setName('type')
      .setDescription('Leaderboard type')
      .setRequired(true)
      .addChoices(
        { name: 'Levels & XP', value: 'xp' },
        { name: 'Coins & Wealth', value: 'coins' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  if (!interaction.guild) return;
  const type = interaction.options.getString('type', true);
  
  const allUsers = db.getAllEconomy(interaction.guild.id);
  
  if (allUsers.length === 0) {
    const embed = UIFactory.warning('Empty Leaderboard', 'No one has gained any XP or coins yet!');
    await middleware.safeReply(interaction, { embeds: [embed] });
    return;
  }

  // Sort and take top 10
  if (type === 'xp') {
    allUsers.sort((a, b) => b.xp - a.xp);
  } else {
    allUsers.sort((a, b) => b.coins - a.coins);
  }
  
  const top10 = allUsers.slice(0, 10);
  
  let description = '';
  for (let i = 0; i < top10.length; i++) {
    const eco = top10[i];
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
    
    if (type === 'xp') {
      description += `${medal} <@${eco.userId}> — **Lvl ${eco.level}** (${Math.floor(eco.xp)} XP)\n`;
    } else {
      description += `${medal} <@${eco.userId}> — **${eco.coins} 🍡 Coins**\n`;
    }
  }

  const embed = UIFactory.premium(
    `🏆 ${type === 'xp' ? 'Level' : 'Wealth'} Leaderboard`,
    description,
    {
      thumbnail: interaction.guild.iconURL({ forceStatic: false } as any) || undefined
    }
  );

  await middleware.safeReply(interaction, { embeds: [embed] });
}
