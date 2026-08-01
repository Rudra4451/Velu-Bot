import { 
  GuildMember, 
  TextChannel, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  VoiceBasedChannel 
} from 'discord.js';
import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  VoiceConnectionStatus, 
  entersState, 
  AudioPlayer, 
  VoiceConnection, 
  StreamType 
} from '@discordjs/voice';
import play from 'play-dl';
import { UIFactory } from '../ui/factory.js';
import { logger } from '../utils/logger.js';
import { stateManager } from '../state/manager.js';

// Initialize SoundCloud Client ID token for play-dl
play.setToken({ soundcloud: { client_id: 'sUn5toeW5d8MC2jOLpE2yAibTG7RRYsA' } });

export interface Song {
  title: string;
  url: string;
  duration: string;
  thumbnail?: string;
  requester: string;
  author?: string;
  source?: string;
}

export interface GuildQueueInfo {
  playing: boolean;
  paused: boolean;
  songs: Song[];
  volume: number;
  repeatMode: number;
  progress: string;
}

export enum RepeatMode {
  OFF = 0,
  TRACK = 1,
  QUEUE = 2,
  AUTOPLAY = 3,
}

// Global active guild players map
const guildPlayers = new Map<string, GuildMusicPlayer>();
const nowPlayingMessages = new Map<string, any>();

// ── Clean Track Title Utility ────────────────────────────────────────────────
function cleanTrackTitle(title: string): string {
  return title
    .replace(/[\(\[\{].*?(official|music|video|audio|lyric|hd|4k|remix|ft|feat).*?[\)\]\}]/gi, '')
    .replace(/official video|music video|lyric video|official audio|full song/gi, '')
    .trim();
}

// ── Visual Progress Bar Utility ──────────────────────────────────────────────
export function createProgressBar(currentMs: number, totalMs: number, length: number = 14): string {
  if (!totalMs || totalMs === 0) return '`[🔘' + '─'.repeat(length - 1) + ']`';
  const progress = Math.min(Math.max(currentMs / totalMs, 0), 1);
  const filled = Math.round(progress * length);
  const empty = length - filled;
  const bar = '▬'.repeat(Math.max(0, filled - 1)) + '🔘' + '▬'.repeat(Math.max(0, empty));
  return `\`[${bar}]\``;
}

// ── Static Custom IDs for Buttons ────────────────────────────────────────────
const MUSIC_IDS = {
  toggle_pause: stateManager.create('music', 'toggle_pause'),
  skip: stateManager.create('music', 'skip'),
  stop: stateManager.create('music', 'stop'),
  loop: stateManager.create('music', 'loop'),
  queue: stateManager.create('music', 'queue'),
};

export function createMusicControlRow(paused: boolean = false, repeatMode: number = 0): ActionRowBuilder<ButtonBuilder> {
  const loopLabels = ['Off', 'Track', 'Queue', 'Autoplay 📻'];
  
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
      .setLabel(`Loop: ${loopLabels[repeatMode] || 'Off'}`)
      .setStyle(repeatMode > 0 ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(MUSIC_IDS.queue)
      .setEmoji('📜')
      .setLabel('Queue')
      .setStyle(ButtonStyle.Secondary),
  );
}

// ── Native Guild Music Player Class ─────────────────────────────────────────
export class GuildMusicPlayer {
  public readonly guildId: string;
  public textChannel: TextChannel;
  public voiceChannel: VoiceBasedChannel;
  public connection: VoiceConnection | null = null;
  public audioPlayer: AudioPlayer;
  public queue: Song[] = [];
  public currentIndex: number = 0;
  public repeatMode: RepeatMode = RepeatMode.OFF;
  public volume: number = 95;
  private idleTimeout: NodeJS.Timeout | null = null;

  constructor(guildId: string, voiceChannel: VoiceBasedChannel, textChannel: TextChannel) {
    this.guildId = guildId;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;
    this.audioPlayer = createAudioPlayer();

    // Listen to Audio Player Events
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this.handleTrackFinish();
    });

    this.audioPlayer.on('error', (error) => {
      logger.error(`AudioPlayer error in guild ${this.guildId}:`, error);
      this.handleTrackFinish();
    });
  }

  public async connect(): Promise<void> {
    if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
      return;
    }

    this.connection = joinVoiceChannel({
      channelId: this.voiceChannel.id,
      guildId: this.guildId,
      adapterCreator: this.voiceChannel.guild.voiceAdapterCreator as any,
      selfDeaf: true,
    });

    this.connection.subscribe(this.audioPlayer);

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection!, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection!, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });
  }

  public async play(): Promise<void> {
    this.clearIdleTimeout();

    if (this.queue.length === 0 || this.currentIndex >= this.queue.length) {
      this.scheduleIdleTimeout();
      return;
    }

    const currentSong = this.queue[this.currentIndex];

    try {
      await this.connect();

      // High Quality stream extraction (quality: 2 for 48kHz Opus stream)
      let streamUrl = currentSong.url;

      if (!currentSong.url.includes('soundcloud.com')) {
        try {
          const searchQuery = `${cleanTrackTitle(currentSong.title)} ${currentSong.author || ''}`.trim();
          const scRes = await play.search(searchQuery, { source: { soundcloud: 'tracks' }, limit: 1 });
          if (scRes.length > 0) {
            streamUrl = (scRes[0] as any).permalink_url || scRes[0].url;
          }
        } catch {}
      }

      // Stream with highest audio quality configuration (quality: 2)
      const scStream = await play.stream(streamUrl, { quality: 2 });
      const resource = createAudioResource(scStream.stream, {
        inputType: scStream.type as StreamType,
        inlineVolume: true,
      });

      if (resource.volume) {
        resource.volume.setVolume(this.volume / 100);
      }

      this.audioPlayer.play(resource);

      // Send Now Playing Embed
      this.sendNowPlayingEmbed(currentSong);
    } catch (err: any) {
      logger.error(`Error playing track "${currentSong.title}" in guild ${this.guildId}:`, err);
      this.handleTrackFinish();
    }
  }

  private sendNowPlayingEmbed(song: Song): void {
    const prevMsg = nowPlayingMessages.get(this.guildId);
    if (prevMsg) {
      prevMsg.delete().catch(() => {});
      nowPlayingMessages.delete(this.guildId);
    }

    const loopLabels = ['Off', 'Track 🔂', 'Queue 🔁', 'Autoplay 📻'];
    const embed = UIFactory.premium(
      '🎶 Now Playing',
      `**[${song.title}](${song.url})**\n\n` +
      `👤 **Artist:** \`${song.author || 'Unknown'}\`   |   ⏱️ **Duration:** \`${song.duration || 'Live'}\`\n` +
      `🎧 **Requested by:** \`${song.requester}\`   |   🔊 **Volume:** \`${this.volume}%\` \n\n` +
      `🔁 **Loop Mode:** \`${loopLabels[this.repeatMode] || 'Off'}\`   |   💎 **Bitrate:** \`48kHz Studio Opus ✨\``,
      {
        thumbnail: song.thumbnail,
        footerText: 'Velu • Ultra Studio Audio 48kHz & High Performance ⚡'
      }
    );

    const actionRow = createMusicControlRow(false, this.repeatMode);
    this.textChannel.send({ embeds: [embed], components: [actionRow] }).then(msg => {
      nowPlayingMessages.set(this.guildId, msg);
    }).catch(() => {});
  }

  private handleTrackFinish(): void {
    if (this.repeatMode === RepeatMode.TRACK) {
      this.play();
      return;
    }

    if (this.repeatMode === RepeatMode.QUEUE) {
      this.currentIndex = (this.currentIndex + 1) % this.queue.length;
      this.play();
      return;
    }

    this.currentIndex++;

    if (this.currentIndex < this.queue.length) {
      this.play();
    } else {
      if (this.repeatMode === RepeatMode.AUTOPLAY) {
        this.handleAutoplay();
      } else {
        const embed = UIFactory.info('Queue Finished', '🎵 Queue has ended. Leaving voice channel in 3 minutes if inactive.');
        this.textChannel.send({ embeds: [embed] }).catch(() => {});
        this.scheduleIdleTimeout();
      }
    }
  }

  private async handleAutoplay(): Promise<void> {
    const lastSong = this.queue[this.queue.length - 1];
    if (!lastSong) return;

    try {
      const cleanTitle = cleanTrackTitle(lastSong.title);
      const query = `${cleanTitle} song`;
      const searchRes = await play.search(query, { source: { soundcloud: 'tracks' }, limit: 5 });

      const recentUrls = new Set(this.queue.map(s => s.url));
      const nextItem = searchRes.find(s => !recentUrls.has(s.url || (s as any).permalink_url)) || searchRes[0];

      if (nextItem) {
        const scTrack = nextItem as any;
        const newSong: Song = {
          title: scTrack.name || scTrack.title || 'Related Song',
          url: scTrack.permalink_url || scTrack.url,
          duration: scTrack.durationInMs ? `${Math.floor(scTrack.durationInMs / 60000)}:${Math.floor((scTrack.durationInMs % 60000) / 1000).toString().padStart(2, '0')}` : 'Live',
          thumbnail: scTrack.thumbnail || scTrack.user?.avatar_url || '',
          requester: 'Autoplay 📻',
          author: scTrack.user?.name || scTrack.user?.username || 'Artist'
        };

        this.queue.push(newSong);
        this.play();
      }
    } catch (err: any) {
      logger.error(`Autoplay failed in guild ${this.guildId}:`, err);
      this.scheduleIdleTimeout();
    }
  }

  public skip(): boolean {
    if (this.audioPlayer.state.status === AudioPlayerStatus.Idle) return false;
    this.audioPlayer.stop();
    return true;
  }

  public stop(): void {
    this.queue = [];
    this.currentIndex = 0;
    this.audioPlayer.stop();

    const prevMsg = nowPlayingMessages.get(this.guildId);
    if (prevMsg) {
      prevMsg.delete().catch(() => {});
      nowPlayingMessages.delete(this.guildId);
    }

    this.destroy();
  }

  public togglePause(): boolean {
    if (this.audioPlayer.state.status === AudioPlayerStatus.Paused) {
      this.audioPlayer.unpause();
      return false;
    } else {
      this.audioPlayer.pause();
      return true;
    }
  }

  public setVolume(vol: number): number {
    this.volume = Math.min(Math.max(vol, 0), 100);
    return this.volume;
  }

  public toggleLoop(): RepeatMode {
    if (this.repeatMode === RepeatMode.OFF) this.repeatMode = RepeatMode.TRACK;
    else if (this.repeatMode === RepeatMode.TRACK) this.repeatMode = RepeatMode.QUEUE;
    else if (this.repeatMode === RepeatMode.QUEUE) this.repeatMode = RepeatMode.AUTOPLAY;
    else this.repeatMode = RepeatMode.OFF;

    return this.repeatMode;
  }

  public shuffle(): number {
    if (this.queue.length <= 1) return 0;
    const upcoming = this.queue.slice(this.currentIndex + 1);
    for (let i = upcoming.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [upcoming[i], upcoming[j]] = [upcoming[j], upcoming[i]];
    }
    this.queue = [...this.queue.slice(0, this.currentIndex + 1), ...upcoming];
    return upcoming.length;
  }

  private scheduleIdleTimeout(): void {
    this.clearIdleTimeout();
    this.idleTimeout = setTimeout(() => {
      logger.info(`Auto-leaving voice channel in guild ${this.guildId} due to inactivity.`);
      this.destroy();
    }, 180_000);
  }

  private clearIdleTimeout(): void {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
  }

  public destroy(): void {
    this.clearIdleTimeout();
    this.audioPlayer.stop();
    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }
    guildPlayers.delete(this.guildId);
  }
}

// ── Search Cache ─────────────────────────────────────────────────────────────
const searchCache = new Map<string, { songs: Song[]; expiresAt: number }>();

// ── Music Service Export ─────────────────────────────────────────────────────
export const musicService = {
  getQueueInfo(guildId: string): GuildQueueInfo | undefined {
    const player = guildPlayers.get(guildId);
    if (!player || player.queue.length === 0) return undefined;

    return {
      playing: player.audioPlayer.state.status === AudioPlayerStatus.Playing,
      paused: player.audioPlayer.state.status === AudioPlayerStatus.Paused,
      songs: player.queue.slice(player.currentIndex),
      volume: player.volume,
      repeatMode: player.repeatMode,
      progress: '`[🔘─────────────]`'
    };
  },

  /**
   * Dual-Engine High-Accuracy Search across SoundCloud & YouTube.
   * Returns valid Song objects with studio quality stream paths.
   */
  async searchTracks(query: string, user: any): Promise<Song[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const cacheKey = trimmed.toLowerCase();
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return cached.songs;

    try {
      let searchQuery = trimmed;
      const validation = await play.validate(trimmed).catch(() => 'search');

      // Smart URL resolution
      if (validation === 'yt_video' || validation === 'yt_playlist') {
        try {
          const ytInfo = await play.video_basic_info(trimmed);
          const title = ytInfo.video_details.title || '';
          const channel = ytInfo.video_details.channel?.name || '';
          searchQuery = `${title} ${channel}`.trim();
        } catch {}
      } else if (validation === 'sp_track') {
        try {
          const spData: any = await play.spotify(trimmed);
          searchQuery = `${spData.name} ${spData.artists?.[0]?.name || ''}`.trim();
        } catch {}
      } else if (validation === 'so_track') {
        try {
          const scInfo: any = await play.soundcloud(trimmed);
          const song: Song = {
            title: scInfo.name || scInfo.title || 'SoundCloud Track',
            url: scInfo.permalink_url || scInfo.url,
            duration: scInfo.durationInMs
              ? `${Math.floor(scInfo.durationInMs / 60000)}:${Math.floor((scInfo.durationInMs % 60000) / 1000).toString().padStart(2, '0')}`
              : 'Live',
            thumbnail: scInfo.thumbnail || scInfo.user?.avatar_url || '',
            requester: user.tag || user.username || 'User',
            author: scInfo.user?.name || scInfo.user?.username || 'Artist',
            source: 'soundcloud'
          };
          searchCache.set(cacheKey, { songs: [song], expiresAt: Date.now() + 60_000 });
          return [song];
        } catch {}
      }

      // 1. Primary: SoundCloud Search
      try {
        const scResults = await Promise.race([
          play.search(searchQuery, { source: { soundcloud: 'tracks' }, limit: 10 }),
          new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('SC search timeout')), 2000))
        ]);

        if (scResults && scResults.length > 0) {
          const songs: Song[] = scResults.map((item: any) => {
            const durationMs = item.durationInMs;
            const durationStr = durationMs
              ? `${Math.floor(durationMs / 60000)}:${Math.floor((durationMs % 60000) / 1000).toString().padStart(2, '0')}`
              : 'Live';

            return {
              title: item.name || item.title || 'Unknown Song',
              url: item.permalink_url || item.url,
              duration: durationStr,
              thumbnail: item.thumbnail || item.user?.avatar_url || '',
              requester: user.tag || user.username || 'User',
              author: item.user?.name || item.user?.username || 'Artist',
              source: 'soundcloud'
            };
          });

          searchCache.set(cacheKey, { songs, expiresAt: Date.now() + 60_000 });
          return songs;
        }
      } catch (scErr: any) {
        logger.warn(`SoundCloud primary search warning for "${searchQuery}": ${scErr.message || scErr}`);
      }

      // 2. Secondary Fallback: YouTube Search
      try {
        const ytResults = await Promise.race([
          play.search(searchQuery, { source: { youtube: 'video' }, limit: 10 }),
          new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('YT search timeout')), 2000))
        ]);

        if (ytResults && ytResults.length > 0) {
          const songs: Song[] = ytResults.map((item: any) => {
            return {
              title: item.title || 'Unknown Song',
              url: item.url,
              duration: item.durationRaw || '0:00',
              thumbnail: item.thumbnails?.[0]?.url || '',
              requester: user.tag || user.username || 'User',
              author: item.channel?.name || 'YouTube',
              source: 'youtube'
            };
          });

          searchCache.set(cacheKey, { songs, expiresAt: Date.now() + 60_000 });
          return songs;
        }
      } catch (ytErr: any) {
        logger.warn(`YouTube secondary search warning for "${searchQuery}": ${ytErr.message || ytErr}`);
      }
    } catch (err: any) {
      logger.warn(`Search warning for "${trimmed}": ${err.message || err}`);
    }

    return [];
  },

  async play(member: GuildMember, query: string, textChannel: TextChannel): Promise<{ message: string; trackName: string; thumbnail?: string }> {
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      throw new Error('You must join a voice channel to play music.');
    }

    const songs = await this.searchTracks(query, member.user);
    if (!songs || songs.length === 0) {
      throw new Error(`No audio tracks found for "${query}". Please try a different title or link.`);
    }

    const song = songs[0];

    let player = guildPlayers.get(member.guild.id);
    if (!player) {
      player = new GuildMusicPlayer(member.guild.id, voiceChannel, textChannel);
      guildPlayers.set(member.guild.id, player);
    } else {
      player.textChannel = textChannel;
      player.voiceChannel = voiceChannel;
    }

    player.queue.push(song);

    if (player.audioPlayer.state.status === AudioPlayerStatus.Idle && player.queue.length === 1) {
      player.play().catch(err => logger.error('Player start error:', err));
    }

    return {
      message: `Queued **[${song.title}](${song.url})**`,
      trackName: song.title,
      thumbnail: song.thumbnail
    };
  },

  togglePause(guildId: string): { isPaused: boolean } {
    const player = guildPlayers.get(guildId);
    if (!player) throw new Error('No active music playback in this server.');
    const isPaused = player.togglePause();
    return { isPaused };
  },

  skip(guildId: string): boolean {
    const player = guildPlayers.get(guildId);
    if (!player) return false;
    return player.skip();
  },

  stop(guildId: string): boolean {
    const player = guildPlayers.get(guildId);
    if (!player) return false;
    player.stop();
    return true;
  },

  setVolume(guildId: string, volume: number): number {
    const player = guildPlayers.get(guildId);
    if (!player) throw new Error('No active queue found.');
    return player.setVolume(volume);
  },

  toggleLoop(guildId: string): number {
    const player = guildPlayers.get(guildId);
    if (!player) throw new Error('No active queue found.');
    return player.toggleLoop();
  },

  toggleAutoplay(guildId: string): boolean {
    const player = guildPlayers.get(guildId);
    if (!player) throw new Error('No active queue found.');
    const mode = player.toggleLoop();
    return mode === RepeatMode.AUTOPLAY;
  },

  shuffle(guildId: string): number {
    const player = guildPlayers.get(guildId);
    if (!player) throw new Error('Not enough tracks in queue to shuffle.');
    return player.shuffle();
  }
};
