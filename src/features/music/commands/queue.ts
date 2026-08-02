import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { musicService } from '../services/music.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';
import type { Command } from '../../../types/index.js';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('View the current music queue.')
    .addIntegerOption(option => 
      option.setName('page')
        .setDescription('Page number to view')
        .setMinValue(1)
    ),
  module: 'music',
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return;
    
    const queueInfo = musicService.getQueueInfo(interaction.guildId);
    if (!queueInfo || queueInfo.songs.length === 0) {
      const embed = UIFactory.warning('Empty Queue', 'There are no songs in the queue.');
      await middleware.safeReply(interaction, { embeds: [embed] });
      return;
    }

    const songsPerPage = 10;
    const totalPages = Math.ceil((queueInfo.songs.length - 1) / songsPerPage) || 1;
    let currentPage = interaction.options.getInteger('page') || 1;
    
    if (currentPage > totalPages) currentPage = totalPages;

    const generateEmbed = (page: number) => {
      const np = queueInfo.songs[0];
      let description = `**Now Playing:**\n🎶 [${np.title}](${np.url}) - \`${np.duration}\`\n\n${queueInfo.progress}\n\n**Up Next:**\n`;
      
      if (queueInfo.songs.length === 1) {
        description += '*No more songs in queue.*';
      } else {
        const start = 1 + (page - 1) * songsPerPage;
        const end = Math.min(start + songsPerPage, queueInfo.songs.length);
        
        for (let i = start; i < end; i++) {
          const song = queueInfo.songs[i];
          description += `**${i}.** [${song.title}](${song.url}) - \`${song.duration}\`\n`;
        }
      }

      return UIFactory.premium('🎵 Music Queue', description, {
        thumbnail: np.thumbnail,
        footerText: `Page ${page} of ${totalPages} • ${queueInfo.songs.length - 1} songs in queue`
      });
    };

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('queue_prev')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 1),
      new ButtonBuilder()
        .setCustomId('queue_next')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === totalPages)
    );

    const response = await interaction.reply({
      embeds: [generateEmbed(currentPage)],
      components: totalPages > 1 ? [row] : [],
      fetchReply: true
    });

    if (totalPages > 1) {
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
      });

      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({ content: 'Use your own command!', ephemeral: true });
          return;
        }

        if (i.customId === 'queue_prev') currentPage--;
        if (i.customId === 'queue_next') currentPage++;

        row.components[0].setDisabled(currentPage === 1);
        row.components[1].setDisabled(currentPage === totalPages);

        await i.update({
          embeds: [generateEmbed(currentPage)],
          components: [row]
        });
      });

      collector.on('end', () => {
        row.components.forEach(c => c.setDisabled(true));
        response.edit({ components: [row] }).catch(() => {});
      });
    }
  }
};
