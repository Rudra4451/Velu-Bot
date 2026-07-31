import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { musicService } from '../../../services/music.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Music';

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('View the current music queue.');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  
  const queueInfo = musicService.getQueueInfo(interaction.guild.id);
  
  if (!queueInfo || queueInfo.songs.length === 0) {
    const embed = UIFactory.warning('Empty Queue', 'There are no songs in the queue.');
    await middleware.safeReply(interaction, { embeds: [embed] });
    return;
  }

  const np = queueInfo.songs[0];
  let description = `**Now Playing:**\n🎶 [${np.title}](${np.url}) - \`${np.duration}\`\n\n**Up Next:**\n`;
  
  if (queueInfo.songs.length === 1) {
    description += '*No more songs in queue.*';
  } else {
    for (let i = 1; i < Math.min(queueInfo.songs.length, 11); i++) {
      const song = queueInfo.songs[i];
      description += `**${i}.** [${song.title}](${song.url}) - \`${song.duration}\`\n`;
    }
    if (queueInfo.songs.length > 11) {
      description += `\n*...and ${queueInfo.songs.length - 11} more tracks.*`;
    }
  }

  const embed = UIFactory.premium('🎵 Music Queue', description, {
    thumbnail: np.thumbnail
  });
  
  await middleware.safeReply(interaction, { embeds: [embed] });
}
