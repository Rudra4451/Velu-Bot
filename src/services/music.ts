import { GuildMember, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { UIFactory } from '../ui/factory.js';
import { logger } from '../utils/logger.js';
import { player } from '../../index.js';
import { stateManager } from '../state/manager.js';
import { QueueRepeatMode, QueryType, Track, onBeforeCreateStream } from 'discord-player';
import play from 'play-dl';
import youtubeDl from 'youtube-dl-exec';

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

// Audio Stream Interceptor — ultra-fast yt-dlp direct URL resolution & SoundCloud fallback
onBeforeCreateStream(async (track, source) => {
  logger.debug(`Stream interceptor resolving track: "${track.title}" (source: ${source}, url: ${track.url})`);
  try {
    // 1. Direct SoundCloud Stream
    if (track.url.includes('soundcloud.com') || source === 'soundcloud') {
      try {
        const scStream = await play.stream(track.url);
        if (scStream?.stream) return scStream.stream;
      } catch (scErr: any) {
        logger.warn(`Direct SoundCloud stream failed: ${scErr.message || scErr}`);
      }
    }

    // 2. High-speed yt-dlp direct audio URL resolution with 7s timeout
    try {
      const output: any = await Promise.race([
        youtubeDl(track.url, {
          dumpSingleJson: true,
          noCheckCertificates: true,
          noWarnings: true,
          preferFreeFormats: true,
          format: 'bestaudio/best',
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('yt-dlp stream timeout')), 7000))
      ]);
      if (output && output.url) {
        logger.debug(`yt-dlp stream URL successfully resolved for "${track.title}"`);
        return output.url;
      }
    } catch (ytErr: any) {
      logger.warn(`yt-dlp stream extraction failed for "${track.title}": ${ytErr.message || ytErr}`);
    }

    // 3. Fallback: SoundCloud search + stream
    const scSearchQuery = `${track.title} ${track.author || ''}`.trim();
    logger.debug(`Falling back to SoundCloud stream for: "${scSearchQuery}"`);
    const scResults = await play.search(scSearchQuery, { source: { soundcloud: 'tracks' }, limit: 1 });
    if (scResults && scResults.length > 0) {
      const scStream = await play.stream(scResults[0].url);
      if (scStream?.stream) return scStream.stream;
    }
  } catch (err: any) {
    logger.error(`Error in onBeforeCreateStream for track "${track.title}":`, err);
  }
  return null;
});

// Player Events Listeners
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
  const textChannel = (queue.metadata as any)?.channel as TextChannel;

  // Autoplay handler for smooth continuous related playback
  if (queue.repeatMode === QueueRepeatMode.AUTOPLAY || queue.repeatMode === (3 as any)) {
    try {
      const prevTrack = queue.history.previousTrack;
      if (!prevTrack) return;

      const cleanTitle = cleanTrackTitle(prevTrack.title);
      const cleanArtist = prevTrack.author ? prevTrack.author.replace(/vevo|official|channel/gi, '').trim() : '';

      // High relevance autoplay search query
      const query = cleanArtist ? `${cleanArtist} ${cleanTitle}` : `${cleanTitle} song`;
      
      const searchResult = await player.search(query, {
        requestedBy: prevTrack.requestedBy || undefined,
        searchEngine: QueryType.YOUTUBE_SEARCH
      });

      if (searchResult.hasTracks()) {
        // Exclude songs already played or currently playing
        const recentUrls = new Set(queue.history.tracks.toArray().map(t => t.url));
        recentUrls.add(prevTrack.url);

        const nextTrack = searchResult.tracks.find(t => !recentUrls.has(t.url) && t.title !== prevTrack.title) 
          || searchResult.tracks.find(t => t.url !== prevTrack.url)
          || searchResult.tracks[0];

        if (nextTrack) {
          queue.addTrack(nextTrack);
          if (!queue.isPlaying()) {
            await queue.node.play();
          }

          if (textChannel) {
            const embed = UIFactory.info(
              '📻 Autoplay Active',
              `Next related track: **[${nextTrack.title}](${nextTrack.url})** • \`${nextTrack.duration || 'Live'}\``
            );
            textChannel.send({ embeds: [embed] }).catch(() => {});
          }
        }
      }
    } catch (err: any) {
      logger.error(`Autoplay recommendation error: ${err.message || err}`);
    }
  }
});

player.events.on('error', (queue, error) => {
  logger.error(`Player error in ${queue.guild.id}: ${error.message}`);
});

player.events.on('playerError', (queue, error) => {
  logger.error(`Player connection error in ${queue.guild.id}: ${error.message}`);
});

// ── Performance & Quality: Cache search results for 60s ──
const searchCache = new Map<string, { tracks: any[]; expiresAt: number }>();
const SEARCH_CACHE_TTL_MS = 60_000; // increased from 30s to 60s

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

/** Optimized Levenshtein with early exit for max distance threshold */
function levenshteinDistance(a: string, b: string, maxDist: number = 3): number {
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > maxDist) return maxDist + 1; // early exit
  if (la === 0) return lb;
  if (lb === 0) return la;

  // Use single-row optimization instead of full matrix (O(n) space vs O(n²))
  let prev = new Uint8Array(lb + 1);
  let curr = new Uint8Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = i; // track min in row for early exit
    for (let j = 1; j <= lb; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1; // early exit: no cell can be under threshold
    [prev, curr] = [curr, prev];
  }
  return prev[lb];
}

/** Check if two words fuzzy match despite typos or spelling mistakes */
function isFuzzyWordMatch(queryWord: string, targetWord: string): boolean {
  if (queryWord === targetWord) return true;
  if (targetWord.includes(queryWord) || queryWord.includes(targetWord)) return true;
  if (queryWord.length >= 4 && targetWord.length >= 4) {
    const maxAllowed = queryWord.length > 6 ? 2 : 1;
    const dist = levenshteinDistance(queryWord, targetWord, maxAllowed);
    return dist <= maxAllowed;
  }
  return false;
}

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
   * Ultra-fast (sub-second) multi-engine search via play-dl & Track instantiation.
   */
  async searchTracks(query: string, user: any): Promise<Track[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const cacheKey = trimmed.toLowerCase();
    const cached = getCachedSearch(cacheKey);
    if (cached) return cached;

    try {
      // Sub-second search via play-dl with strict 2.5s timeout
      const searchPromise = play.search(trimmed, {
        source: { soundcloud: 'tracks' },
        limit: 10
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('play-dl search timeout')), 2500)
      );

      const results = await Promise.race([searchPromise, timeoutPromise]);
      const tracks: Track[] = [];

      if (results && results.length > 0) {
        for (const item of results) {
          const scItem = item as any;
          const durationMs = scItem.durationInMs;
          const durationStr = durationMs
            ? `${Math.floor(durationMs / 60000)}:${Math.floor((durationMs % 60000) / 1000).toString().padStart(2, '0')}`
            : 'Live';

          const track = new Track(player, {
            title: scItem.name || scItem.title || 'Unknown Song',
            url: scItem.url,
            duration: durationStr,
            thumbnail: scItem.thumbnail || scItem.user?.avatar_url || '',
            author: scItem.user?.name || scItem.user?.username || 'SoundCloud',
            requestedBy: user,
            source: 'soundcloud',
          });

          tracks.push(track);
        }
      }

      if (tracks.length > 0) {
        setCachedSearch(cacheKey, tracks);
        return tracks;
      }
    } catch (err: any) {
      logger.warn(`play-dl fast search error for "${trimmed}": ${err.message || err}`);
    }

    return [];
  },

  async play(member: GuildMember, query: string, textChannel: TextChannel): Promise<{ message: string; trackName: string; thumbnail?: string }> {
    const channel = member.voice.channel;
    if (!channel) {
      throw new Error('You must join a voice channel to play music.');
    }

    // Sub-second fast search
    const tracks = await this.searchTracks(query, member.user);
    if (!tracks || tracks.length === 0) {
      throw new Error(`No audio tracks found for "${query}". Please check the song title or URL.`);
    }

    const targetTrack = tracks[0];

    try {
      const { track } = await player.play(channel as any, targetTrack, {
        requestedBy: member.user,
        nodeOptions: {
          metadata: {
            channel: textChannel
          },
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 180_000,
          leaveOnEnd: true,
          leaveOnEndCooldown: 180_000,
          bufferingTimeout: 15_000,
          volume: 95,
          selfDeaf: true,
          leaveOnStop: true,
        }
      });

      return {
        message: `Queued **[${track.title || targetTrack.title}](${track.url || targetTrack.url})**`,
        trackName: track.title || targetTrack.title,
        thumbnail: track.thumbnail || targetTrack.thumbnail
      };
    } catch (e: any) {
      logger.error(`Failed to play track: ${e.message || e}`);
      throw new Error(`Could not connect to voice channel or process audio stream: ${e.message || e}`);
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
