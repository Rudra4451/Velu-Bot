import { GuildMember, TextChannel, Message } from 'discord.js';
import { UIFactory } from '../ui/factory.js';
import { logger } from '../utils/logger.js';
import { player } from '../../index.js';

interface Song {
  title: string;
  url: string;
  duration: string;
  thumbnail?: string;
  requester: string;
}

interface GuildQueue {
  playing: boolean;
  songs: Song[];
}

// Subscribe to discord-player events
player.events.on('playerStart', (queue, track) => {
  const textChannel = (queue.metadata as any)?.channel as TextChannel;
  if (!textChannel) return;

  const embed = UIFactory.premium(
    '🎵 Now Playing',
    `**[${track.title}](${track.url})**\n\n**Duration:** ${track.duration}\n**Requested by:** ${track.requestedBy?.tag || 'Unknown'}`,
    {
      thumbnail: track.thumbnail,
    }
  );

  textChannel.send({ embeds: [embed] }).catch(() => {});
});

player.events.on('error', (queue, error) => {
  logger.error(`Player error in ${queue.guild.id}: ${error.message}`);
});

player.events.on('playerError', (queue, error) => {
  logger.error(`Player connection error in ${queue.guild.id}: ${error.message}`);
});

export const musicService = {
  getQueue(guildId: string): GuildQueue | undefined {
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
            requester: currentTrack.requestedBy?.tag || 'Unknown'
        });
    }
    
    for (const track of queue.tracks.toArray()) {
        songs.push({
            title: track.title,
            url: track.url,
            duration: track.duration,
            thumbnail: track.thumbnail,
            requester: track.requestedBy?.tag || 'Unknown'
        });
    }
    
    if (songs.length === 0) return undefined;

    return {
      playing: queue.isPlaying(),
      songs: songs
    };
  },

  async play(member: GuildMember, query: string, textChannel: TextChannel): Promise<string> {
    const channel = member.voice.channel;
    if (!channel) {
      throw new Error('You must be in a voice channel to play music.');
    }

    const searchResult = await player.search(query, {
      requestedBy: member.user,
      searchEngine: 'auto'
    });

    if (!searchResult.hasTracks()) {
      throw new Error('No results found for that query.');
    }

    try {
      const { track } = await player.play(channel as any, searchResult, {
        nodeOptions: {
          metadata: {
            channel: textChannel
          },
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 300000,
          leaveOnEnd: true,
          leaveOnEndCooldown: 300000
        }
      });

      return `Added to queue: **${track.title}**`;
    } catch (e: any) {
      logger.error(`Failed to play track: ${e}`);
      throw new Error('Failed to join voice channel or start stream.');
    }
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
  }
};
