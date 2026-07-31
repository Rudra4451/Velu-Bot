import { GuildMember, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { UIFactory } from '../ui/factory.js';
import { logger } from '../utils/logger.js';
import { player } from '../../index.js';
import { stateManager } from '../state/manager.js';
import { QueueRepeatMode, QueryType } from 'discord-player';

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

// ── Performance & Quality: Cache search results for 30s ──
const searchCache = new Map<string, { tracks: any[]; expiresAt: number }>();
const SEARCH_CACHE_TTL_MS = 30_000;

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
  if (searchCache.size > 150) {
    const firstKey = searchCache.keys().next().value;
    if (firstKey) searchCache.delete(firstKey);
  }
  searchCache.set(key, { tracks, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
}

/** Calculate Levenshtein edit distance for typo-tolerant fuzzy matching */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/** Check if two words fuzzy match despite typos or spelling mistakes */
function isFuzzyWordMatch(queryWord: string, targetWord: string): boolean {
  if (queryWord === targetWord) return true;
  if (targetWord.includes(queryWord) || queryWord.includes(targetWord)) return true;
  if (queryWord.length >= 4 && targetWord.length >= 4) {
    const dist = levenshteinDistance(queryWord, targetWord);
    const maxAllowed = queryWord.length > 6 ? 2 : 1;
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
   * Ultra-fast multi-engine partial search for text or URLs with typo-tolerance & lyric matching.
   */
  async searchTracks(query: string, user: any): Promise<any[]> {
    const trimmed = query.trim();
    const cacheKey = trimmed.toLowerCase();
    const cached = getCachedSearch(cacheKey);
    if (cached) return cached;

    const isUrl = /^https?:\/\//i.test(trimmed);

    if (isUrl) {
      const res = await player.search(trimmed, {
        requestedBy: user,
        searchEngine: QueryType.AUTO
      });
      if (res.hasTracks()) {
        const tracks = res.tracks.slice(0, 10);
        setCachedSearch(cacheKey, tracks);
        return tracks;
      }
      return [];
    }

    // Multi-engine parallel search (YouTube, Spotify, Apple Music, Auto)
    const engineResults: any[][] = [[], [], [], []];

    const createResolver = (priorityIndex: number) => (res: any) => {
      if (res && res.hasTracks()) {
        engineResults[priorityIndex] = res.tracks;
      }
    };

    const p1 = player.search(trimmed, { requestedBy: user, searchEngine: QueryType.YOUTUBE_SEARCH }).then(createResolver(0)).catch(() => {});
    const p2 = player.search(trimmed, { requestedBy: user, searchEngine: QueryType.SPOTIFY_SEARCH }).then(createResolver(1)).catch(() => {});
    const p3 = player.search(trimmed, { requestedBy: user, searchEngine: QueryType.APPLE_MUSIC_SEARCH }).then(createResolver(2)).catch(() => {});
    const p4 = player.search(trimmed, { requestedBy: user, searchEngine: QueryType.AUTO }).then(createResolver(3)).catch(() => {});
    
    await Promise.race([
      Promise.all([p1, p2, p3, p4]),
      new Promise(resolve => setTimeout(resolve, 2500))
    ]);

    const allTracks: any[] = [];
    const seenUrls = new Set<string>();

    for (const tracks of engineResults) {
      for (const track of tracks) {
        if (!seenUrls.has(track.url)) {
          seenUrls.add(track.url);
          allTracks.push(track);
        }
      }
    }

    // Secondary fallback for Lyrics / Middle of song lines or Heavy Typos
    if (allTracks.length === 0) {
      try {
        const [lyricsRes, songRes] = await Promise.allSettled([
          player.search(`${trimmed} lyrics`, { requestedBy: user, searchEngine: QueryType.YOUTUBE_SEARCH }),
          player.search(`${trimmed} song`, { requestedBy: user, searchEngine: QueryType.YOUTUBE_SEARCH })
        ]);

        if (lyricsRes.status === 'fulfilled' && lyricsRes.value.hasTracks()) {
          for (const t of lyricsRes.value.tracks) {
            if (!seenUrls.has(t.url)) { seenUrls.add(t.url); allTracks.push(t); }
          }
        }
        if (songRes.status === 'fulfilled' && songRes.value.hasTracks()) {
          for (const t of songRes.value.tracks) {
            if (!seenUrls.has(t.url)) { seenUrls.add(t.url); allTracks.push(t); }
          }
        }
      } catch {}
    }

    // Advanced Typo-Tolerant & Relevance Scoring
    const queryWords = trimmed.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
    const scoreTrack = (track: any) => {
      const target = `${track.title} ${track.author || ''}`.toLowerCase();
      const targetWords = target.split(/\s+/);
      let score = 0;

      // Exact phrase match
      if (target.includes(trimmed.toLowerCase())) score += 60;

      // Word-level fuzzy & typo matching
      for (const qWord of queryWords) {
        let wordMatched = false;
        for (const tWord of targetWords) {
          if (isFuzzyWordMatch(qWord, tWord)) {
            score += 15;
            wordMatched = true;
            break;
          }
        }
        if (!wordMatched && target.includes(qWord)) score += 8;
      }

      // Official / High quality track bonus
      if (target.includes('official') || target.includes('lyric') || target.includes('audio')) score += 5;
      return score;
    };

    if (allTracks.length > 0) {
      allTracks.sort((a, b) => scoreTrack(b) - scoreTrack(a));
      
      const topTracks = allTracks.slice(0, 15);
      setCachedSearch(cacheKey, topTracks);
      return topTracks;
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
      searchEngine: /^https?:\/\//i.test(query) ? QueryType.AUTO : QueryType.YOUTUBE_SEARCH
    });

    if (!searchResult.hasTracks()) {
      const fallbackTracks = await this.searchTracks(query, member.user);
      if (fallbackTracks.length > 0) {
        searchResult = { hasTracks: () => true, tracks: fallbackTracks } as any;
      }
    }

    if (!searchResult.hasTracks()) {
      throw new Error('No audio tracks found for that search query.');
    }

    try {
      const { track } = await player.play(channel as any, searchResult, {
        nodeOptions: {
          metadata: {
            channel: textChannel
          },
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 180_000,
          leaveOnEnd: true,
          leaveOnEndCooldown: 180_000,
          // ── Studio Sound Quality & High Bitrate Stream ──
          bufferingTimeout: 15_000,
          volume: 95,
          selfDeaf: true,
          leaveOnStop: true,
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
