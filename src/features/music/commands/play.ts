import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  AutocompleteInteraction,
  GuildMember, 
  TextChannel
} from 'discord.js';
import { musicService } from '../services/music.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Music';
export const cooldown = 1000;

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Search and play music from YouTube, Spotify, or SoundCloud.')
  .addStringOption(option => 
    option.setName('query')
      .setDescription('Song title, artist, or URL')
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const query = interaction.options.getString('query') || '';
  if (query.trim().length === 0) {
    const recommendations = [
      { name: '🔥 Top 50 Global Hits', value: 'https://www.youtube.com/playlist?list=PL4fGSI1pQAnOpiVDv2V47I2mF7aJIfCok' },
      { name: '🎧 Lofi Hip Hop Radio - Beats to Relax/Study to', value: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
      { name: '🌟 Today\'s Top Hits', value: 'https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9CB5N5Y' },
      { name: '🎸 Essential Rock Classics', value: 'https://www.youtube.com/playlist?list=PLKsz0-GgB_G7t-JmQ9722359Kov_oGv6H' },
      { name: '🌌 Synthwave / Retro Electro Mix', value: 'https://www.youtube.com/watch?v=MVPTGNGiI-4' }
    ];
    return void await interaction.respond(recommendations).catch(() => {});
  }

  // Fast-path: if query is a URL, offer instant response without network delay
  if (/^https?:\/\/.+/i.test(query)) {
    return void await interaction.respond([
      { name: `🎵 Play URL: ${query.substring(0, 80)}`, value: query }
    ]).catch(() => {});
  }

  try {
    const searchPromise = musicService.searchTracks(query, interaction.user);
    const timeoutPromise = new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 180));

    const tracks = await Promise.race([searchPromise, timeoutPromise]);
    const choices = tracks.slice(0, 10).map(t => {
      const nameStr = `${t.title} • ${t.author || 'Unknown'} [${t.duration || 'Live'}]`;
      return {
        name: nameStr.length > 100 ? nameStr.substring(0, 97) + '...' : nameStr,
        value: t.url || `${t.title} ${t.author || ''}`
      };
    });

    if (!interaction.responded) {
      await interaction.respond(choices).catch(() => {});
    }
  } catch {
    if (!interaction.responded) {
      await interaction.respond([]).catch(() => {});
    }
  }
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const member = interaction.member as GuildMember;
  if (!member || !member.voice?.channel) {
    const embed = UIFactory.warning('Voice Channel Required', 'You must be in a voice channel to play music.');
    await middleware.safeReply(interaction, { embeds: [embed] }, true);
    return;
  }
  
  const query = interaction.options.getString('query', true);
  const textChannel = (interaction.channel as TextChannel) || undefined;

  try {
    const result = await musicService.play(member, query, textChannel as TextChannel);
    const embed = UIFactory.success('Music Queued', result.message, { thumbnail: result.thumbnail });
    await middleware.safeReply(interaction, { embeds: [embed] });
  } catch (error: any) {
    const embed = UIFactory.error('Playback Error', error.message || 'Failed to process music play request.');
    await middleware.safeReply(interaction, { embeds: [embed] }, true);
  }
}
