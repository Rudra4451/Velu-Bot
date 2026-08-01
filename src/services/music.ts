import { GuildMember, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { UIFactory } from '../ui/factory.js';
import { logger } from '../utils/logger.js';
import { player } from '../../index.js';
import { stateManager } from '../state/manager.js';
import { QueueRepeatMode, Track } from 'discord-player';
import play from 'play-dl';

// Initialize play-dl SoundCloud Client ID asynchronously for sub-second search & streaming
play.getFreeClientID().then(id => {
  if (id) {
    play.setToken({ soundcloud: { client_id: id } });
    logger.info('🎵 play-dl SoundCloud client ID initialized successfully.');
  }
}).catch(err => {
  logger.warn(`play-dl client ID init warning: ${err.message || err}`);
});

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

/** Track active Now Playing cards per guild for clean deletion when stopped or track changes */
const nowPlayingMessages = new Map<string, any>();

/** Clean up noise from track titles for higher quality related search queries */
function cleanTrackTitle(title: string): string {
  return title
    .replace(/[\(\[\{].*?(official|music|video|audio|lyric|hd|4k|remix|ft|feat).*?[\)\]\}]/gi, '')
    .replace(/official video|music video|lyric video|official audio|full song/gi, '')
    .trim();
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

// ── Pre-built static button custom IDs (computed once at startup, not every interaction) ──
const MUSIC_IDS = {
  toggle_pause: stateManager.create('music', 'toggle_pause'),
  skip: stateManager.create('music', 'skip'),
  stop: stateManager.create('music', 'stop'),
  loop: stateManager.create('music', 'loop'),
  queue: stateManager.create('music', 'queue'),
};

/**
 * Creates interactive ActionRows for Music Controls.
 * Uses pre-computed custom IDs for zero overhead.
 */
export function createMusicControlRow(paused: boolean = false, repeatMode: number = 0): ActionRowBuilder<ButtonBuilder> {
  const loopEmojis = ['Off', 'Track', 'Queue', 'Autoplay 📻'];
  
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(MUSIC_IDS.toggle_pause)
      .setEmoji(paused ? '▶️' : '⏸️')
      .setLabel(paused ? 'Resume' : 'Pause')
      .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(MUSIC_IDS.skip)
      .setEmoji('⏭️')
      .setLabel('Skip')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(MUSIC_IDS.stop)
      .setEmoji('⏹️')
      .setLabel('Stop')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(MUSIC_IDS.loop)
      .setEmoji('🔁')
      .setLabel(`Loop: ${loopEmojis[repeatMode] || 'Off'}`)
      .setStyle(repeatMode > 0 ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(MUSIC_IDS.queue)
      .setEmoji('📜')
      .setLabel('Queue')
      .setStyle(ButtonStyle.Secondary),
  );
}

// ── Player Events ──────────────────────────────────────────────────────────────
// NOTE: No onBeforeCreateStream — DefaultExtractors handle streaming internally.
// Overriding it was the root cause of all playback failures (broken ytdl decipher,
// missing yt-dlp binary, play.stream() Invalid URL on YouTube).

player.events.on('playerStart', async (queue, track) => {
  const textChannel = (queue.metadata as any)?.channel as TextChannel;
  if (!textChannel) return;

  // Clean up previous Now Playing message card in channel
  const prevMsg = nowPlayingMessages.get(queue.guild.id);
  if (prevMsg) {
    prevMsg.delete().catch(() => {});
    nowPlayingMessages.delete(queue.guild.id);
  }

  const durationStr = track.duration || 'Live Stream';
  const loopLabels = ['Off', 'Track 🔂', 'Queue 🔁', 'Autoplay 📻'];
  const loopStatus = loopLabels[queue.repeatMode] || 'Off';

  const embed = UIFactory.premium(
    '🎶 Now Playing',
    `**[${track.title}](${track.url})**\n\n` +
    `👤 **Artist:** \`${track.author || 'Unknown'}\`\n` +
    `⏱️ **Duration:** \`${durationStr}\`\n` +
    `🎧 **Requested by:** ${track.requestedBy ? `<@${track.requestedBy.id}>` : 'Unknown'}\n\n` +
    `🔊 **Volume:** \`${queue.node.volume}%\`   |   🔁 **Mode:** \`${loopStatus}\``,
    {
      thumbnail: track.thumbnail,
      footerText: 'Velu Music • Ultra Studio Audio 48kHz ✨'
    }
  );

  const actionRow = createMusicControlRow(false, queue.repeatMode);
  try {
    const msg = await textChannel.send({ embeds: [embed], components: [actionRow] });
    nowPlayingMessages.set(queue.guild.id, msg);
  } catch {}
});

player.events.on('emptyQueue', async (queue) => {
  // Autoplay handler for smooth continuous related playback
  if (queue.repeatMode === QueueRepeatMode.AUTOPLAY || queue.repeatMode === (3 as any)) {
    try {
      const prevTrack = queue.history.previousTrack;
      if (!prevTrack) return;

      const cleanTitle = cleanTrackTitle(prevTrack.title);
      const cleanArtist = prevTrack.author ? prevTrack.author.replace(/vevo|official|channel/gi, '').trim() : '';
      const searchQuery = cleanArtist ? `${cleanArtist} ${cleanTitle}` : `${cleanTitle} song`;

      // Get voice channel — bot may still be connected during leaveOnEndCooldown
      const voiceChannel = queue.guild.members.me?.voice?.channel;
      if (!voiceChannel) return;

      // Use player.play() with timeout — handles search + queue + streaming through extractors
      await Promise.race([
        player.play(voiceChannel, searchQuery, {
          nodeOptions: { metadata: queue.metadata },
          requestedBy: prevTrack.requestedBy || undefined,
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('autoplay timeout')), 5000))
      ]);

      const textChannel = (queue.metadata as any)?.channel as TextChannel;
      if (textChannel) {
        const embed = UIFactory.info(
          '📻 Autoplay Active',
          `Playing a related track based on: **${prevTrack.title}**`
        );
        textChannel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (err: any) {
      logger.error(`Autoplay error: ${err.message || err}`);
    }
  }
});

player.events.on('error', (queue, error) => {
  logger.error(`Player error in ${queue.guild.id}: ${error.message}`);
});

player.events.on('playerError', (queue, error) => {
  logger.error(`Player connection error in ${queue.guild.id}: ${error.message}`);
});

// ── Performance & Quality: Cache search results for 60s ──────────────────────
const searchCache = new Map<string, { tracks: any[]; expiresAt: number }>();
const SEARCH_CACHE_TTL_MS = 60_000;

function getCachedSearch(key: string): any[] | null {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    searchCache.delete(key);
    return null;
  }
  return entry.tracks;
}

function setCachedSearch(key: string, tracks: any[]): void {
  if (searchCache.size > 200) {
    const firstKey = searchCache.keys().next().value;
    if (firstKey) searchCache.delete(firstKey);
  }
  searchCache.set(key, { tracks, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
}

// ── Music Service ────────────────────────────────────────────────────────────

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

  /**
   * Fast multi-engine search for autocomplete and song discovery.
   * Uses play-dl YouTube search (fast, high quality results) with
   * discord-player DefaultExtractors as fallback.
   */
  async searchTracks(query: string, user: any): Promise<Track[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const cacheKey = trimmed.toLowerCase();
    const cached = getCachedSearch(cacheKey);
    if (cached) return cached;

    // 1. Fast YouTube search via play-dl (best for autocomplete — fast & accurate)
    try {
      const results = await Promise.race([
        play.search(trimmed, { limit: 10, source: { youtube: 'video' } }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('play-dl search timeout')), 3000))
      ]);

      if (results && results.length > 0) {
        const tracks: Track[] = results.map(item => new Track(player, {
          title: item.title || 'Unknown Song',
          url: item.url,
          duration: item.durationRaw || '0:00',
          thumbnail: item.thumbnails[0]?.url || '',
          author: item.channel?.name || 'Unknown',
          requestedBy: user,
          source: 'youtube',
        }));
        setCachedSearch(cacheKey, tracks);
        return tracks;
      }
    } catch (err: any) {
      logger.warn(`play-dl search warning for "${trimmed}": ${err.message || err}`);
    }

    // 2. Fallback: discord-player search via DefaultExtractors (SoundCloud, Spotify, etc.)
    try {
      const res = await Promise.race([
        player.search(trimmed, { requestedBy: user }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('player.search timeout')), 3000))
      ]);
      if (res?.hasTracks()) {
        setCachedSearch(cacheKey, res.tracks);
        return res.tracks;
      }
    } catch (err: any) {
      logger.warn(`player search fallback warning for "${trimmed}": ${err.message || err}`);
    }

    return [];
  },

  /**
   * Play music using discord-player's built-in pipeline.
   * Uses player.play() which handles search, queue creation, voice connection,
   * and streaming ALL through DefaultExtractors — no broken custom interceptors.
   */
  async play(member: GuildMember, query: string, textChannel: TextChannel): Promise<{ message: string; trackName: string; thumbnail?: string }> {
    const channel = member.voice.channel;
    if (!channel) {
      throw new Error('You must join a voice channel to play music.');
    }

    try {
      // If query is a YouTube URL, resolve title for reliable playback through extractors.
      // YouTube URL extractors can be unreliable; title search finds the song on working sources.
      let searchQuery = query;
      if (/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/i.test(query)) {
        try {
          const info = await Promise.race([
            play.video_basic_info(query),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('URL resolve timeout')), 3000))
          ]);
          const title = info.video_details.title || '';
          const artist = info.video_details.channel?.name || '';
          searchQuery = `${title} ${artist}`.trim();
          logger.debug(`Resolved YouTube URL to search query: "${searchQuery}"`);
        } catch {
          logger.debug(`Could not resolve YouTube URL, using as-is: "${query}"`);
        }
      }

      // player.play() does everything: search → create/reuse queue → connect VC → stream
      const result = await Promise.race([
        player.play(channel, searchQuery, {
          nodeOptions: {
            metadata: { channel: textChannel },
            leaveOnEmpty: true,
            leaveOnEmptyCooldown: 180_000,
            leaveOnEnd: true,
            leaveOnEndCooldown: 180_000,
            bufferingTimeout: 5_000,
            connectionTimeout: 5_000,
            volume: 95,
            selfDeaf: true,
            leaveOnStop: true,
          },
          requestedBy: member.user,
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Playback request timed out. Please try again.')), 10_000))
      ]);

      const track = result.track;
      return {
        message: `Queued **[${track.title}](${track.url})**`,
        trackName: track.title,
        thumbnail: track.thumbnail,
      };
    } catch (e: any) {
      logger.error(`Failed to play: ${e.message || e}`);
      throw new Error(e.message || 'Failed to play track. Please try a different song.');
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
    // Delete active Now Playing card if present
    const prevMsg = nowPlayingMessages.get(guildId);
    if (prevMsg) {
      prevMsg.delete().catch(() => {});
      nowPlayingMessages.delete(guildId);
    }
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
