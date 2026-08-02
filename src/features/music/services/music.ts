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
import { UIFactory } from '../../../ui/factory.js';
import { logger } from '../../../utils/logger.js';
import { stateManager } from '../../../core/stateManager.js';
import { THEME } from '../../../constants/theme.js';

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
  history: Song[];
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

const guildPlayers = new Map<string, GuildMusicPlayer>();
const nowPlayingMessages = new Map<string, any>();
const updateIntervals = new Map<string, NodeJS.Timeout>();

function cleanTrackTitle(title: string): string {
  return title
    .replace(/[\(\[\{].*?(official|music|video|audio|lyric|hd|4k|remix|ft|feat).*?[\)\]\}]/gi, '')
    .replace(/official video|music video|lyric video|official audio|full song/gi, '')
    .trim();
}

function parseDuration(duration: string): number {
  if (duration === 'Live' || !duration) return 0;
  const parts = duration.split(':').map(Number);
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  return 0;
}

function formatDuration(ms: number): string {
  if (ms === 0) return 'Live';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function createProgressBar(currentMs: number, totalMs: number, length: number = 16): string {
  if (!totalMs || totalMs === 0) return '`[🔘' + '▬'.repeat(length - 1) + ']`';
  const progress = Math.min(Math.max(currentMs / totalMs, 0), 1);
  const filled = Math.round(progress * length);
  const empty = length - filled;
  const bar = '▬'.repeat(Math.max(0, filled - 1)) + '🔘' + '▬'.repeat(Math.max(0, empty));
  return `\`[${bar}]\` \`${formatDuration(currentMs)} / ${formatDuration(totalMs)}\``;
}

const MUSIC_IDS = {
  previous: stateManager.create('music', 'previous'),
  toggle_pause: stateManager.create('music', 'toggle_pause'),
  skip: stateManager.create('music', 'skip'),
  stop: stateManager.create('music', 'stop'),
  loop: stateManager.create('music', 'loop'),
  queue: stateManager.create('music', 'queue'),
};

export function createMusicControlRow(paused: boolean = false, repeatMode: number = 0): ActionRowBuilder<ButtonBuilder> {
  const loopLabels = ['Off', 'Track', 'Queue', 'Autoplay'];
  
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(MUSIC_IDS.previous)
      .setEmoji('⏮️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(MUSIC_IDS.toggle_pause)
      .setEmoji(paused ? '▶️' : '⏸️')
      .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(MUSIC_IDS.skip)
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(MUSIC_IDS.loop)
      .setEmoji('🔁')
      .setLabel(`${loopLabels[repeatMode]}`)
      .setStyle(repeatMode > 0 ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(MUSIC_IDS.stop)
      .setEmoji('⏹️')
      .setStyle(ButtonStyle.Danger),
  );
}

export class GuildMusicPlayer {
  public readonly guildId: string;
  public textChannel: TextChannel;
  public voiceChannel: VoiceBasedChannel;
  public connection: VoiceConnection | null = null;
  public audioPlayer: AudioPlayer;
  
  public queue: Song[] = [];
  public history: Song[] = [];
  public currentIndex: number = 0;
  
  public repeatMode: RepeatMode = RepeatMode.OFF;
  public volume: number = 95;
  public playbackStart: number = 0;
  
  private idleTimeout: NodeJS.Timeout | null = null;

  constructor(guildId: string, voiceChannel: VoiceBasedChannel, textChannel: TextChannel) {
    this.guildId = guildId;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;
    this.audioPlayer = createAudioPlayer();

    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this.handleTrackFinish();
    });

    this.audioPlayer.on('error', (error) => {
      logger.error(`AudioPlayer error in guild ${this.guildId}:`, error);
      this.handleTrackFinish();
    });
  }

  public async connect(): Promise<void> {
    if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) return;

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

    if (this.queue.length === 0 || this.currentIndex >= this.queue.length || this.currentIndex < 0) {
      this.scheduleIdleTimeout();
      return;
    }

    const currentSong = this.queue[this.currentIndex];

    try {
      await this.connect();

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

      const scStream = await play.stream(streamUrl, { quality: 2 });
      const resource = createAudioResource(scStream.stream, {
        inputType: scStream.type as StreamType,
        inlineVolume: true,
      });

      if (resource.volume) resource.volume.setVolume(this.volume / 100);

      this.audioPlayer.play(resource);
      this.playbackStart = Date.now();
      
      this.sendNowPlayingEmbed(currentSong);
      this.startEmbedUpdater(currentSong);
    } catch (err: any) {
      logger.error(`Error playing track in guild ${this.guildId}:`, err);
      this.handleTrackFinish();
    }
  }
  
  private startEmbedUpdater(song: Song): void {
    if (updateIntervals.has(this.guildId)) {
      clearInterval(updateIntervals.get(this.guildId)!);
    }
    
    // Update every 10 seconds to avoid rate limits
    const interval = setInterval(() => {
      if (this.audioPlayer.state.status !== AudioPlayerStatus.Playing) return;
      
      const msg = nowPlayingMessages.get(this.guildId);
      if (!msg) return;
      
      const elapsed = this.audioPlayer.state.playbackDuration;
      const totalMs = parseDuration(song.duration);
      
      const loopLabels = ['Off', 'Track 🔂', 'Queue 🔁', 'Autoplay 📻'];
      const embed = UIFactory.premium(
        '🎶 Now Playing',
        `**[${song.title}](${song.url})**\n\n` +
        `👤 **Artist:** \`${song.author || 'Official Release'}\`   |   🔊 **Volume:** \`${this.volume}%\`\n` +
        `🎧 **Requested by:** \`${song.requester}\`   |   🔁 **Loop Mode:** \`${loopLabels[this.repeatMode] || 'Off'}\`\n\n` +
        `${createProgressBar(elapsed, totalMs, 20)}`,
        {
          thumbnail: song.thumbnail,
          image: THEME.gifs.equalizer,
          footerText: `Velu Premium Audio ✨`
        }
      );
      
      msg.edit({ embeds: [embed] }).catch(() => {});
    }, 10_000);
    
    updateIntervals.set(this.guildId, interval);
  }

  private sendNowPlayingEmbed(song: Song): void {
    const prevMsg = nowPlayingMessages.get(this.guildId);
    if (prevMsg) {
      prevMsg.delete().catch(() => {});
      nowPlayingMessages.delete(this.guildId);
    }

    const totalMs = parseDuration(song.duration);
    const loopLabels = ['Off', 'Track 🔂', 'Queue 🔁', 'Autoplay 📻'];
    
    const embed = UIFactory.premium(
      '🎶 Now Playing',
      `**[${song.title}](${song.url})**\n\n` +
      `👤 **Artist:** \`${song.author || 'Official Release'}\`   |   🔊 **Volume:** \`${this.volume}%\`\n` +
      `🎧 **Requested by:** \`${song.requester}\`   |   🔁 **Loop Mode:** \`${loopLabels[this.repeatMode] || 'Off'}\`\n\n` +
      `${createProgressBar(0, totalMs, 20)}`,
      {
        thumbnail: song.thumbnail,
        image: THEME.gifs.equalizer,
        footerText: `Velu Premium Audio ✨`
      }
    );

    const actionRow = createMusicControlRow(false, this.repeatMode);
    this.textChannel.send({ embeds: [embed], components: [actionRow] }).then(msg => {
      nowPlayingMessages.set(this.guildId, msg);
    }).catch(() => {});
  }

  private handleTrackFinish(): void {
    if (updateIntervals.has(this.guildId)) {
      clearInterval(updateIntervals.get(this.guildId)!);
      updateIntervals.delete(this.guildId);
    }

    const finishedSong = this.queue[this.currentIndex];
    if (finishedSong) {
      this.history.push(finishedSong);
      if (this.history.length > 50) this.history.shift(); // Keep history size manageable
    }

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
  
  public previous(): boolean {
    if (this.history.length === 0) return false;
    const lastSong = this.history.pop()!;
    this.queue.splice(this.currentIndex, 0, lastSong);
    this.play();
    return true;
  }
  
  public jump(index: number): boolean {
    if (index < 1 || index > this.queue.length) return false;
    this.currentIndex = index - 1;
    this.play();
    return true;
  }

  public remove(index: number): Song | null {
    if (index < 1 || index > this.queue.length) return null;
    const removed = this.queue.splice(index - 1, 1)[0];
    if (index - 1 < this.currentIndex) this.currentIndex--;
    else if (index - 1 === this.currentIndex) this.play(); // If removing currently playing song
    return removed;
  }
  
  public move(from: number, to: number): boolean {
    if (from < 1 || from > this.queue.length || to < 1 || to > this.queue.length) return false;
    const item = this.queue.splice(from - 1, 1)[0];
    this.queue.splice(to - 1, 0, item);
    // Adjust currentIndex if necessary
    if (this.currentIndex === from - 1) this.currentIndex = to - 1;
    else if (from - 1 < this.currentIndex && to - 1 >= this.currentIndex) this.currentIndex--;
    else if (from - 1 > this.currentIndex && to - 1 <= this.currentIndex) this.currentIndex++;
    return true;
  }

  private async handleAutoplay(): Promise<void> {
    const lastSong = this.queue[this.currentIndex - 1] || this.history[this.history.length - 1];
    if (!lastSong) return;

    try {
      const cleanTitle = cleanTrackTitle(lastSong.title);
      const query = `${cleanTitle} official audio`;
      const searchRes = await play.search(query, { source: { youtube: 'video' }, limit: 5 });

      const recentUrls = new Set([...this.queue.map(s => s.url), ...this.history.map(s => s.url)]);
      const nextItem = searchRes.find(s => !recentUrls.has(s.url)) || searchRes[0];

      if (nextItem) {
        const newSong: Song = {
          title: nextItem.title || 'Related Song',
          url: nextItem.url,
          duration: nextItem.durationRaw || 'Live',
          thumbnail: nextItem.thumbnails?.[0]?.url || '',
          requester: 'Autoplay 📻',
          author: nextItem.channel?.name || 'Official Artist',
          source: 'youtube'
        };

        this.queue.push(newSong);
        this.play();
      }
    } catch (err: any) {
      logger.error(`Autoplay failed:`, err);
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
    this.history = [];
    this.currentIndex = 0;
    this.audioPlayer.stop();

    if (updateIntervals.has(this.guildId)) {
      clearInterval(updateIntervals.get(this.guildId)!);
      updateIntervals.delete(this.guildId);
    }

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

    const msg = nowPlayingMessages.get(this.guildId);
    if (msg) {
      const row = createMusicControlRow(this.audioPlayer.state.status === AudioPlayerStatus.Paused, this.repeatMode);
      msg.edit({ components: [row] }).catch(() => {});
    }

    return this.repeatMode;
  }

  public shuffle(): number {
    if (this.queue.length - this.currentIndex <= 1) return 0;
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

const searchCache = new Map<string, { songs: Song[]; expiresAt: number }>();

export const musicService = {
  getQueueInfo(guildId: string): GuildQueueInfo | undefined {
    const player = guildPlayers.get(guildId);
    if (!player || player.queue.length === 0) return undefined;

    const currentMs = player.audioPlayer.state.status === AudioPlayerStatus.Playing ? player.audioPlayer.state.playbackDuration : 0;
    const totalMs = parseDuration(player.queue[player.currentIndex]?.duration || '0');

    return {
      playing: player.audioPlayer.state.status === AudioPlayerStatus.Playing,
      paused: player.audioPlayer.state.status === AudioPlayerStatus.Paused,
      songs: player.queue.slice(player.currentIndex),
      history: player.history,
      volume: player.volume,
      repeatMode: player.repeatMode,
      progress: createProgressBar(currentMs, totalMs, 16)
    };
  },

  async searchTracks(query: string, user: any): Promise<Song[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const cacheKey = trimmed.toLowerCase();
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return cached.songs;

    try {
      let searchQuery = trimmed;
      const validation = await play.validate(trimmed).catch(() => 'search');

      if (validation === 'sp_track') {
        try {
          const spData: any = await play.spotify(trimmed);
          searchQuery = `${spData.name} ${spData.artists?.[0]?.name || ''} official audio`.trim();
        } catch {}
      } else if (validation === 'yt_video' || validation === 'yt_playlist') {
        try {
          if (validation === 'yt_playlist') {
            const playlist = await play.playlist_info(trimmed, { incomplete: true });
            const tracks = await playlist.all_videos();
            const songs: Song[] = tracks.map((track: any) => ({
              title: track.title || 'Unknown',
              url: track.url,
              duration: track.durationRaw || 'Live',
              thumbnail: track.thumbnails?.[0]?.url || '',
              requester: user.tag || user.username || 'User',
              author: track.channel?.name || 'Channel',
              source: 'youtube'
            }));
            searchCache.set(cacheKey, { songs, expiresAt: Date.now() + 60_000 });
            return songs;
          } else {
            const ytInfo = await play.video_basic_info(trimmed);
            const song: Song = {
              title: ytInfo.video_details.title || 'Unknown',
              url: ytInfo.video_details.url,
              duration: ytInfo.video_details.durationRaw || 'Live',
              thumbnail: ytInfo.video_details.thumbnails?.[0]?.url || '',
              requester: user.tag || user.username || 'User',
              author: ytInfo.video_details.channel?.name || 'Channel',
              source: 'youtube'
            };
            searchCache.set(cacheKey, { songs: [song], expiresAt: Date.now() + 60_000 });
            return [song];
          }
        } catch (e) {
          logger.warn(`Failed to parse yt_video or yt_playlist: ${e}`);
        }
      } else if (validation === 'so_track') {
        try {
          const soData: any = await play.soundcloud(trimmed);
          searchQuery = `${soData.name} official audio`.trim();
        } catch {}
      }

      // Parallel Hybrid Search: Music (High Fidelity) + Video (Lyrics/Loose)
      const ytMusicPromise = (play as any).search(searchQuery, { source: { youtube: 'music' }, limit: 5 }).catch(() => []);
      const ytVideoPromise = play.search(searchQuery, { source: { youtube: 'video' }, limit: 5 }).catch(() => []);
      
      const timeoutPromise = new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500));

      // Race against a 2.5s timeout to guarantee Discord autocomplete speed
      const [musicRes, videoRes] = await Promise.race([
        Promise.all([ytMusicPromise, ytVideoPromise]),
        timeoutPromise
      ]).catch(() => [[], []]);

      // Merge and deduplicate by URL
      const rawResults = [...(musicRes || []), ...(videoRes || [])];
      const uniqueResults = Array.from(new Map(rawResults.map(item => [item.url, item])).values());

      if (uniqueResults.length > 0) {
        const songs: Song[] = uniqueResults.slice(0, 10).map((item: any) => ({
          title: item.title || 'Unknown',
          url: item.url,
          duration: item.durationRaw || 'Live',
          thumbnail: item.thumbnails?.[0]?.url || '',
          requester: user.tag || user.username || 'User',
          author: item.channel?.name || 'Channel',
          source: 'youtube'
        }));
        searchCache.set(cacheKey, { songs, expiresAt: Date.now() + 60_000 });
        return songs;
      }
    } catch (err) {
      logger.warn(`Search error: ${err}`);
    }
    return [];
  },

  async play(member: GuildMember, query: string, textChannel: TextChannel): Promise<{ message: string; trackName: string; thumbnail?: string }> {
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) throw new Error('You must join a voice channel to play music.');

    const songs = await this.searchTracks(query, member.user);
    if (!songs || songs.length === 0) throw new Error(`No audio tracks found for "${query}".`);

    let player = guildPlayers.get(member.guild.id);
    if (!player) {
      player = new GuildMusicPlayer(member.guild.id, voiceChannel, textChannel);
      guildPlayers.set(member.guild.id, player);
    } else {
      player.textChannel = textChannel;
      player.voiceChannel = voiceChannel;
    }

    const isPlaylist = query.includes('list=') || query.includes('playlist');

    if (isPlaylist && songs.length > 1) {
      player.queue.push(...songs);
      if (player.audioPlayer.state.status === AudioPlayerStatus.Idle && player.currentIndex === player.queue.length - songs.length) {
        player.play().catch(err => logger.error('Player error:', err));
      }
      return {
        message: `Queued **${songs.length} tracks** from playlist!`,
        trackName: 'Playlist',
        thumbnail: songs[0].thumbnail
      };
    } else {
      const song = songs[0];
      player.queue.push(song);

      if (player.audioPlayer.state.status === AudioPlayerStatus.Idle && player.currentIndex === player.queue.length - 1) {
        player.play().catch(err => logger.error('Player error:', err));
      }

      return {
        message: `Queued **[${song.title}](${song.url})**`,
        trackName: song.title,
        thumbnail: song.thumbnail
      };
    }
  },
  
  previous(guildId: string): boolean {
    const player = guildPlayers.get(guildId);
    if (!player) return false;
    return player.previous();
  },
  
  jump(guildId: string, index: number): boolean {
    const player = guildPlayers.get(guildId);
    if (!player) return false;
    return player.jump(index);
  },
  
  remove(guildId: string, index: number): Song | null {
    const player = guildPlayers.get(guildId);
    if (!player) return null;
    return player.remove(index);
  },
  
  move(guildId: string, from: number, to: number): boolean {
    const player = guildPlayers.get(guildId);
    if (!player) return false;
    return player.move(from, to);
  },

  togglePause(guildId: string): { isPaused: boolean } {
    const player = guildPlayers.get(guildId);
    if (!player) throw new Error('No active playback.');
    const isPaused = player.togglePause();
    
    // Update component row to show Pause/Resume accurately
    const msg = nowPlayingMessages.get(guildId);
    if (msg) {
      const row = createMusicControlRow(isPaused, player.repeatMode);
      msg.edit({ components: [row] }).catch(() => {});
    }
    
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
    if (!player) throw new Error('No active queue.');
    return player.shuffle();
  }
};
