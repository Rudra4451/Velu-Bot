import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Moderation';

export const data = new SlashCommandBuilder()
  .setName('bans')
  .setDescription('View a paginated list of all banned users in this server.')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addIntegerOption(option => 
    option.setName('page')
      .setDescription('The page number to view')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  try {
    const bans = await interaction.guild.bans.fetch();
    if (bans.size === 0) {
      const embed = UIFactory.info('Server Bans', 'There are no banned users in this server.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const banList = Array.from(bans.values());
    
    const perPage = 10;
    const page = Math.max(1, interaction.options.getInteger('page') || 1);
    const totalPages = Math.ceil(banList.length / perPage);
    const start = (page - 1) * perPage;
    const end = start + perPage;
    
    const currentBans = banList.slice(start, end);
    
    const description = currentBans.map((ban, i) => {
      return `**${start + i + 1}.** ${ban.user.tag} (\`${ban.user.id}\`)\n> **Reason:** ${ban.reason || 'None'}`;
    }).join('\n\n');
    
    const embed = UIFactory.premium('🔨 Server Bans', description, {
      footerText: `Page ${Math.min(page, totalPages)} of ${totalPages} • Total: ${banList.length} bans`
    });
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    const embed = UIFactory.error('Failed to fetch bans', error.message || 'An unknown error occurred.');
    await interaction.editReply({ embeds: [embed] });
  }
}
