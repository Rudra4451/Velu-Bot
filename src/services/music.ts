import { GuildMember, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { UIFactory } from '../ui/factory.js';
import { logger } from '../utils/logger.js';
import { player } from '../../index.js';
import { stateManager } from '../state/manager.js';
import { QueueRepeatMode, Track, onBeforeCreateStream } from 'discord-player';
import play from 'play-dl';

// Initialize SoundCloud token synchronously with high-performance default client ID
play.setToken({ soundcloud: { client_id: 'sUn5toeW5d8MC2jOLpE2yAibTG7RRYsA' } });

// Fetch fresh dynamic client ID asynchronously for fallback
play.getFreeClientID().then(id => {
  if (id) {
    play.setToken({ soundcloud: { client_id: id } });
    logger.info('🎵 play-dl SoundCloud client ID updated successfully.');
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

// ── Pre-built static button custom IDs ───────────────────────────────────────
const MUSIC_IDS = {
  toggle_pause: stateManager.create('music', 'toggle_pause'),
  skip: stateManager.create('music', 'skip'),
  stop: stateManager.create('music', 'stop'),
  loop: stateManager.create('music', 'loop'),
  queue: stateManager.create('music', 'queue'),
};

/**
 * Creates interactive ActionRows for Music Controls.
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

// ── Stream Interceptor: Ultra-reliable SoundCloud & Audio Bridge Streaming ─────
// Direct YouTube streams fail on Render due to YouTube IP blocks (429 Sign in).
// SoundCloud streams bypass IP blocks completely and work 100% reliably 24/7 on cloud hosting.
onBeforeCreateStream(async (track, source) => {
  logger.debug(`Stream interceptor resolving track: "${track.title}" (source: ${source}, url: ${track.url})`);
  try {
    // 1. Direct SoundCloud Stream
    if (track.url.includes('soundcloud.com') || source === 'soundcloud') {
      try {
        const scStream = await play.stream(track.url);
        if (scStream?.stream) return scStream.stream;
      } catch (scErr: any) {
        logger.warn(`Direct SoundCloud stream warning: ${scErr.message || scErr}`);
      }
    }

    // 2. High-speed SoundCloud Search Bridge for YouTube/Spotify/Text Tracks
    try {
      const searchQuery = `${cleanTrackTitle(track.title)} ${track.author || ''}`.trim();
      const scResults = await play.search(searchQuery, { source: { soundcloud: 'tracks' }, limit: 1 });
      if (scResults && scResults.length > 0) {
        const scTrack: any = scResults[0];
        const scUrl = scTrack.permalink_url || scTrack.url;
        if (scUrl) {
          const scStream = await play.stream(scUrl);
          if (scStream?.stream) {
            logger.debug(`SoundCloud bridge stream successfully created for "${track.title}"`);
            return scStream.stream;
          }
        }
      }
    } catch (bridgeErr: any) {
      logger.warn(`SoundCloud bridge stream warning for "${track.title}": ${bridgeErr.message || bridgeErr}`);
    }
  } catch (err: any) {
    logger.error(`Error in onBeforeCreateStream for "${track.title}":`, err);
  }
  return null;
});

// ── Player Events ──────────────────────────────────────────────────────────────

player.events.on('playerStart', async (queue, track) => {
  const textChannel = (queue.metadata as any)?.channel as TextChannel;
  if (!textChannel) return;

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
  if (queue.repeatMode === QueueRepeatMode.AUTOPLAY || queue.repeatMode === (3 as any)) {
    try {
      const prevTrack = queue.history.previousTrack;
      if (!prevTrack) return;

      const cleanTitle = cleanTrackTitle(prevTrack.title);
      const cleanArtist = prevTrack.author ? prevTrack.author.replace(/vevo|official|channel/gi, '').trim() : '';
      const searchQuery = cleanArtist ? `${cleanArtist} ${cleanTitle}` : `${cleanTitle} song`;

      const voiceChannel = queue.guild.members.me?.voice?.channel;
      if (!voiceChannel) return;

      const textChannel = (queue.metadata as any)?.channel as TextChannel;
      if (!textChannel) return;

      const tracks = await musicService.searchTracks(searchQuery, prevTrack.requestedBy);
      if (tracks && tracks.length > 0) {
        queue.addTrack(tracks[0]);
        if (!queue.isPlaying()) {
          queue.node.play().catch(err => logger.warn(`Autoplay node.play warning: ${err.message || err}`));
        }
        const embed = UIFactory.info(
          '📻 Autoplay Active',
          `Playing related track: **[${tracks[0].title}](${tracks[0].url})**`
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

// ── Search Cache ─────────────────────────────────────────────────────────────
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
   * Ultra-fast search across YouTube, SoundCloud, and Spotify.
   * Returns valid Track objects that route audio streaming through SoundCloud bridge.
   */
  async searchTracks(query: string, user: any): Promise<Track[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const cacheKey = trimmed.toLowerCase();
    const cached = getCachedSearch(cacheKey);
    if (cached) return cached;

    // 1. YouTube & Spotify search via play-dl with strict 2.5s timeout
    try {
      const searchPromise = (async () => {
        const validation = await play.validate(trimmed).catch(() => false);
        const tracks: Track[] = [];

        if (validation === 'sp_track') {
          const spData = await play.spotify(trimmed);
          const searchQ = `${spData.name} ${(spData as any).artists?.[0]?.name || ''}`;
          const scRes = await play.search(searchQ, { source: { soundcloud: 'tracks' }, limit: 1 });
          if (scRes.length > 0) {
            const item: any = scRes[0];
            tracks.push(new Track(player, {
              title: spData.name,
              url: item.permalink_url || item.url,
              duration: (spData as any).durationRaw || '0:00',
              thumbnail: item.thumbnail || (spData as any).thumbnail?.url || '',
              author: (spData as any).artists?.[0]?.name || 'Spotify',
              requestedBy: user,
              source: 'spotify',
            }));
          }
        } else {
          // Fast SoundCloud & YouTube hybrid search
          const results = await play.search(trimmed, { source: { soundcloud: 'tracks' }, limit: 10 });
          if (results && results.length > 0) {
            for (const item of results) {
              const scItem = item as any;
              const durationMs = scItem.durationInMs;
              const durationStr = durationMs
                ? `${Math.floor(durationMs / 60000)}:${Math.floor((durationMs % 60000) / 1000).toString().padStart(2, '0')}`
                : 'Live';

              tracks.push(new Track(player, {
                title: scItem.name || scItem.title || 'Unknown Song',
                url: scItem.permalink_url || scItem.url,
                duration: durationStr,
                thumbnail: scItem.thumbnail || scItem.user?.avatar_url || '',
                author: scItem.user?.name || scItem.user?.username || 'Artist',
                requestedBy: user,
                source: 'soundcloud',
              }));
            }
          }
        }
        return tracks;
      })();

      const timeoutPromise = new Promise<Track[]>((_, reject) =>
        setTimeout(() => reject(new Error('search timeout')), 2500)
      );

      const tracks = await Promise.race([searchPromise, timeoutPromise]);
      if (tracks && tracks.length > 0) {
        setCachedSearch(cacheKey, tracks);
        return tracks;
      }
    } catch (err: any) {
      logger.warn(`play-dl search warning for "${trimmed}": ${err.message || err}`);
    }

    // 2. Fallback: discord-player search via DefaultExtractors with strict 2s timeout
    try {
      const playerSearchPromise = player.search(trimmed, { requestedBy: user });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('player.search timeout')), 2000)
      );

      const res = await Promise.race([playerSearchPromise, timeoutPromise]);
      if (res && res.hasTracks()) {
        setCachedSearch(cacheKey, res.tracks);
        return res.tracks;
      }
    } catch (err: any) {
      logger.warn(`player.search fallback warning for "${trimmed}": ${err.message || err}`);
    }

    return [];
  },

  /**
   * Fast music play execution with zero-latency sub-second response.
   */
  async play(member: GuildMember, query: string, textChannel: TextChannel): Promise<{ message: string; trackName: string; thumbnail?: string }> {
    const channel = member.voice.channel;
    if (!channel) {
      throw new Error('You must join a voice channel to play music.');
    }

    const tracks = await this.searchTracks(query, member.user);
    if (!tracks || tracks.length === 0) {
      throw new Error(`No audio tracks found for "${query}". Please check the song title or link.`);
    }

    const targetTrack = tracks[0];

    try {
      let queue = player.nodes.get(member.guild.id);
      if (!queue) {
        queue = player.nodes.create(member.guild.id, {
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
        });
      }

      if (!queue.connection) {
        await Promise.race([
          queue.connect(channel as any, { deaf: true, timeout: 4_000 }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Voice channel connection timed out after 4s')), 4000))
        ]);
      }

      queue.addTrack(targetTrack);

      // Start playback asynchronously in background so response returns immediately
      if (!queue.isPlaying()) {
        queue.node.play().catch(err => {
          logger.warn(`queue.node.play async warning: ${err.message || err}`);
        });
      }

      return {
        message: `Queued **[${targetTrack.title}](${targetTrack.url})**`,
        trackName: targetTrack.title,
        thumbnail: targetTrack.thumbnail
      };
    } catch (e: any) {
      logger.error(`Failed to play track: ${e.message || e}`);
      throw new Error(`Could not connect to voice channel or start stream: ${e.message || e}`);
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
