import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { musicService, createMusicControlRow } from '../../../services/music.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Music';

export const data = new SlashCommandBuilder()
  .setName('nowplaying')
  .setDescription('See the currently playing song and playback controls.');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  
  const queueInfo = musicService.getQueueInfo(interaction.guild.id);
  
  if (!queueInfo || queueInfo.songs.length === 0 || !queueInfo.playing) {
    const embed = UIFactory.warning('Nothing Playing', 'There is no music playing right now.');
    await middleware.safeReply(interaction, { embeds: [embed] });
    return;
  }

  const song = queueInfo.songs[0];
  const repeatModes = ['Off', 'Track', 'Queue'];

  const embed = UIFactory.premium(
    '🎶 Now Playing',
    `**[${song.title}](${song.url})**\n\n` +
    `👤 **Artist:** \`${song.author || 'Unknown'}\`\n` +
    `⏱️ **Duration:** \`${song.duration}\`\n` +
    `🎧 **Requested by:** \`${song.requester}\`\n\n` +
    `🔊 **Volume:** \`${queueInfo.volume}%\`   |   🔁 **Loop:** \`${repeatModes[queueInfo.repeatMode] || 'Off'}\``,
    {
      thumbnail: song.thumbnail,
      footerText: 'Velu Music • Interactive Audio Engine ✨'
    }
  );

  const actionRow = createMusicControlRow(queueInfo.paused, queueInfo.repeatMode);
  await middleware.safeReply(interaction, { embeds: [embed], components: [actionRow] });
}
