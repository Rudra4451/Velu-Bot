import { GuildMember, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { UIFactory } from '../ui/factory.js';
import { logger } from '../utils/logger.js';
import { player } from '../../index.js';
import { stateManager } from '../state/manager.js';
import { QueueRepeatMode } from 'discord-player';

export interface Song {
  title: string;
  url: string;
  duration: string;
  thumbnail?: string;
  requester: string;
  author?: string;
}

export interface GuildQueueInfo {
  playing: boolean;
  paused: boolean;
  songs: Song[];
  volume: number;
  repeatMode: number;
  progress: string;
}

/**
 * Creates a visual progress bar string.
 */
export function createProgressBar(currentMs: number, totalMs: number, length: number = 14): string {
  if (!totalMs || totalMs === 0) return '`[🔘' + '─'.repeat(length - 1) + ']`';
  const progress = Math.min(Math.max(currentMs / totalMs, 0), 1);
  const filled = Math.round(progress * length);
  const empty = length - filled;
  const bar = '▬'.repeat(Math.max(0, filled - 1)) + '🔘' + '▬'.repeat(Math.max(0, empty));
  return `\`[${bar}]\``;
}

/**
 * Creates interactive ActionRows for Music Controls.
 */
export function createMusicControlRow(paused: boolean = false, repeatMode: number = 0): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  const pauseBtn = new ButtonBuilder()
    .setCustomId(stateManager.create('music', 'toggle_pause'))
    .setEmoji(paused ? '▶️' : '⏸️')
    .setLabel(paused ? 'Resume' : 'Pause')
    .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Primary);

  const skipBtn = new ButtonBuilder()
    .setCustomId(stateManager.create('music', 'skip'))
    .setEmoji('⏭️')
    .setLabel('Skip')
    .setStyle(ButtonStyle.Secondary);

  const stopBtn = new ButtonBuilder()
    .setCustomId(stateManager.create('music', 'stop'))
    .setEmoji('⏹️')
    .setLabel('Stop')
    .setStyle(ButtonStyle.Danger);

  const loopEmojis = ['Off', 'Track', 'Queue', 'Autoplay 📻'];
  const loopBtn = new ButtonBuilder()
    .setCustomId(stateManager.create('music', 'loop'))
    .setEmoji('🔁')
    .setLabel(`Loop: ${loopEmojis[repeatMode] || 'Off'}`)
    .setStyle(repeatMode > 0 ? ButtonStyle.Success : ButtonStyle.Secondary);

  const queueBtn = new ButtonBuilder()
    .setCustomId(stateManager.create('music', 'queue'))
    .setEmoji('📜')
    .setLabel('Queue')
    .setStyle(ButtonStyle.Secondary);

  row.addComponents(pauseBtn, skipBtn, stopBtn, loopBtn, queueBtn);
  return row;
}

// Player Events Listeners
player.events.on('playerStart', (queue, track) => {
  const textChannel = (queue.metadata as any)?.channel as TextChannel;
  if (!textChannel) return;

  const durationStr = track.duration || 'Live Stream';
  const loopLabels = ['Off', 'Track 🔂', 'Queue 🔁', 'Autoplay 📻'];
  const loopStatus = loopLabels[queue.repeatMode] || 'Off';

  const embed = UIFactory.premium(
    '🎶 Now Playing',
    `**[${track.title}](${track.url})**\n\n` +
    `👤 **Artist:** \`${track.author || 'Unknown'}\`\n` +
    `⏱️ **Duration:** \`${durationStr}\`\n` +
    `🎧 **Requested by:** ${track.requestedBy ? `<@${track.requestedBy.id}>` : 'Unknown'}\n\n` +
    `🔊 **Volume:** \`${queue.node.volume}%\`   |   🔁 **Mode:** \`${loopStatus}\``,
    {
      thumbnail: track.thumbnail,
      footerText: 'Velu Music • Premium Audio Engine ✨'
    }
  );

  const actionRow = createMusicControlRow(false, queue.repeatMode);
  textChannel.send({ embeds: [embed], components: [actionRow] }).catch(() => {});
});

player.events.on('emptyQueue', async (queue) => {
  const textChannel = (queue.metadata as any)?.channel as TextChannel;

  if (queue.repeatMode === QueueRepeatMode.AUTOPLAY || queue.repeatMode === (3 as any)) {
    try {
      const prevTrack = queue.history.previousTrack;
      if (!prevTrack) return;

      const query = `${prevTrack.author || ''} ${prevTrack.title} related`.trim();
      const searchResult = await player.search(query, {
        requestedBy: prevTrack.requestedBy || undefined,
        searchEngine: 'auto'
      });

      if (searchResult.hasTracks()) {
        const nextTrack = searchResult.tracks.find(t => t.url !== prevTrack.url) || searchResult.tracks[0];
        if (nextTrack) {
          queue.addTrack(nextTrack);
          if (!queue.isPlaying()) {
            await queue.node.play();
          }

          if (textChannel) {
            const embed = UIFactory.info(
              '📻 Autoplay Active',
              `Automatically added related track: **[${nextTrack.title}](${nextTrack.url})**`
            );
            textChannel.send({ embeds: [embed] }).catch(() => {});
          }
        }
      }
    } catch (err: any) {
      logger.error(`Autoplay search error: ${err.message || err}`);
    }
  }
});

player.events.on('error', (queue, error) => {
  logger.error(`Player error in ${queue.guild.id}: ${error.message}`);
});

player.events.on('playerError', (queue, error) => {
  logger.error(`Player connection error in ${queue.guild.id}: ${error.message}`);
});

export const musicService = {
  getQueueInfo(guildId: string): GuildQueueInfo | undefined {
    const queue = player.nodes.get(guildId);
    if (!queue) return undefined;
    
    const currentTrack = queue.currentTrack;
    const songs: Song[] = [];
    
    if (currentTrack) {
      songs.push({
        title: currentTrack.title,
        url: currentTrack.url,
        duration: currentTrack.duration,
        thumbnail: currentTrack.thumbnail,
        requester: currentTrack.requestedBy?.tag || 'Unknown',
        author: currentTrack.author
      });
    }
    
    for (const track of queue.tracks.toArray()) {
      songs.push({
        title: track.title,
        url: track.url,
        duration: track.duration,
        thumbnail: track.thumbnail,
        requester: track.requestedBy?.tag || 'Unknown',
        author: track.author
      });
    }
    
    if (songs.length === 0) return undefined;

    const progressObj = queue.node.createProgressBar();
    const progress = progressObj || '`[🔘─────────────]`';

    return {
      playing: queue.isPlaying(),
      paused: queue.node.isPaused(),
      songs,
      volume: queue.node.volume,
      repeatMode: queue.repeatMode,
      progress
    };
  },

  async searchTracks(query: string, user: any): Promise<any[]> {
    const primary = await player.search(query, {
      requestedBy: user,
      searchEngine: 'auto'
    });

    if (primary.hasTracks()) {
      return primary.tracks.slice(0, 10);
    }

    // Fast parallel fallback across YouTube and SoundCloud
    const [ytRes, scRes] = await Promise.allSettled([
      player.search(query, { requestedBy: user, searchEngine: 'youtube' }),
      player.search(query, { requestedBy: user, searchEngine: 'soundcloud' })
    ]);

    if (ytRes.status === 'fulfilled' && ytRes.value.hasTracks()) {
      return ytRes.value.tracks.slice(0, 10);
    }

    if (scRes.status === 'fulfilled' && scRes.value.hasTracks()) {
      return scRes.value.tracks.slice(0, 10);
    }

    return [];
  },

  async play(member: GuildMember, query: string, textChannel: TextChannel): Promise<{ message: string; trackName: string; thumbnail?: string }> {
    const channel = member.voice.channel;
    if (!channel) {
      throw new Error('You must join a voice channel to play music.');
    }

    let searchResult = await player.search(query, {
      requestedBy: member.user,
      searchEngine: 'auto'
    });

    if (!searchResult.hasTracks()) {
      const [ytRes, scRes] = await Promise.allSettled([
        player.search(query, { requestedBy: member.user, searchEngine: 'youtube' }),
        player.search(query, { requestedBy: member.user, searchEngine: 'soundcloud' })
      ]);

      if (ytRes.status === 'fulfilled' && ytRes.value.hasTracks()) {
        searchResult = ytRes.value;
      } else if (scRes.status === 'fulfilled' && scRes.value.hasTracks()) {
        searchResult = scRes.value;
      }
    }

    if (!searchResult.hasTracks()) {
      throw new Error('No audio tracks found across YouTube or SoundCloud for that search query.');
    }

    try {
      const { track } = await player.play(channel as any, searchResult, {
        nodeOptions: {
          metadata: {
            channel: textChannel
          },
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 180000,
          leaveOnEnd: true,
          leaveOnEndCooldown: 180000,
          bufferingTimeout: 15000,
          volume: 85,
          selfDeaf: true
        }
      });

      return {
        message: `Queued **[${track.title}](${track.url})**`,
        trackName: track.title,
        thumbnail: track.thumbnail
      };
    } catch (e: any) {
      logger.error(`Failed to play track: ${e.message || e}`);
      throw new Error('Could not connect to voice channel or process audio stream.');
    }
  },

  togglePause(guildId: string): { isPaused: boolean } {
    const queue = player.nodes.get(guildId);
    if (!queue || !queue.currentTrack) throw new Error('No active music playback in this server.');
    const isPaused = queue.node.isPaused();
    if (isPaused) {
      queue.node.resume();
    } else {
      queue.node.pause();
    }
    return { isPaused: !isPaused };
  },

  skip(guildId: string): boolean {
    const queue = player.nodes.get(guildId);
    if (!queue || !queue.isPlaying()) return false;
    queue.node.skip();
    return true;
  },

  stop(guildId: string): boolean {
    const queue = player.nodes.get(guildId);
    if (!queue) return false;
    queue.delete();
    return true;
  },

  setVolume(guildId: string, volume: number): number {
    const queue = player.nodes.get(guildId);
    if (!queue) throw new Error('No active queue found.');
    const clampedVolume = Math.min(Math.max(volume, 0), 100);
    queue.node.setVolume(clampedVolume);
    return clampedVolume;
  },

  toggleLoop(guildId: string): number {
    const queue = player.nodes.get(guildId);
    if (!queue) throw new Error('No active queue found.');
    let nextMode: any = QueueRepeatMode.OFF;
    if (queue.repeatMode === QueueRepeatMode.OFF) nextMode = QueueRepeatMode.TRACK;
    else if (queue.repeatMode === QueueRepeatMode.TRACK) nextMode = QueueRepeatMode.QUEUE;
    else if (queue.repeatMode === QueueRepeatMode.QUEUE) nextMode = QueueRepeatMode.AUTOPLAY;
    else nextMode = QueueRepeatMode.OFF;

    queue.setRepeatMode(nextMode);
    return Number(nextMode);
  },

  toggleAutoplay(guildId: string): boolean {
    const queue = player.nodes.get(guildId);
    if (!queue) throw new Error('No active queue found.');
    const isAutoplay = queue.repeatMode === QueueRepeatMode.AUTOPLAY;
    const nextMode = isAutoplay ? QueueRepeatMode.OFF : QueueRepeatMode.AUTOPLAY;
    queue.setRepeatMode(nextMode as any);
    return !isAutoplay;
  },

  shuffle(guildId: string): number {
    const queue = player.nodes.get(guildId);
    if (!queue || queue.tracks.size === 0) throw new Error('Not enough tracks in queue to shuffle.');
    queue.tracks.shuffle();
    return queue.tracks.size;
  }
};
