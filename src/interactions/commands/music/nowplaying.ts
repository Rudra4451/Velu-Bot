import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { musicService } from '../../../services/music.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Music';

export const data = new SlashCommandBuilder()
  .setName('nowplaying')
  .setDescription('See the currently playing song.');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  if (!interaction.guild) return;
  
  const queue = musicService.getQueue(interaction.guild.id);
  
  if (!queue || queue.songs.length === 0 || !queue.playing) {
    const embed = UIFactory.warning('Nothing Playing', 'There is no music playing right now.');
    await middleware.safeReply(interaction, { embeds: [embed] });
    return;
  }

  const song = queue.songs[0];

  const embed = UIFactory.premium(
    '🎵 Now Playing',
    `**[${song.title}](${song.url})**\n\n**Duration:** ${song.duration}\n**Requested by:** ${song.requester}`,
    {
      thumbnail: song.thumbnail,
    }
  );
  
  await middleware.safeReply(interaction, { embeds: [embed] });
}
