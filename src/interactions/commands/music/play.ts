import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  AutocompleteInteraction,
  GuildMember, 
  TextChannel,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';
import { musicService } from '../../../services/music.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';
import { stateManager } from '../../../state/manager.js';

export const module = 'Music';

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
  const query = interaction.options.getString('query', true);
  if (!query || query.trim().length === 0) {
    return void await interaction.respond([]);
  }

  try {
    const tracks = await musicService.searchTracks(query, interaction.user);
    const choices = tracks.slice(0, 10).map(t => {
      const nameStr = `${t.title} • ${t.author || 'Unknown'} [${t.duration || 'Live'}]`;
      return {
        name: nameStr.length > 100 ? nameStr.substring(0, 97) + '...' : nameStr,
        value: t.url || `${t.title} ${t.author || ''}`
      };
    });

    await interaction.respond(choices);
  } catch {
    await interaction.respond([]).catch(() => {});
  }
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;

  const member = interaction.member;
  if (!member.voice.channel) {
    const embed = UIFactory.warning('Voice Channel Required', 'You must be in a voice channel to play music.');
    return void await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
  }
  
  const query = interaction.options.getString('query', true);
  const textChannel = interaction.channel as TextChannel;

  await interaction.deferReply();

  const isUrl = /^https?:\/\//i.test(query);

  if (isUrl) {
    try {
      const result = await musicService.play(member, query, textChannel);
      const embed = UIFactory.success('Music Queued', result.message, { thumbnail: result.thumbnail });
      await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      const embed = UIFactory.error('Playback Error', error.message || 'Failed to play track.');
      await interaction.editReply({ embeds: [embed] });
    }
    return;
  }

  // Interactive Multi-Source Search Selection for Text Queries
  try {
    const tracks = await musicService.searchTracks(query, interaction.user);
    if (tracks.length === 0) {
      const embed = UIFactory.error('No Results', `No music tracks found for **"${query}"** across YouTube & SoundCloud.`);
      return void await interaction.editReply({ embeds: [embed] });
    }

    if (tracks.length === 1) {
      const result = await musicService.play(member, tracks[0].url, textChannel);
      const embed = UIFactory.success('Music Queued', result.message, { thumbnail: result.thumbnail });
      return void await interaction.editReply({ embeds: [embed] });
    }

    // Build interactive Select Menu for Top 5 Search Results
    const selectOptions = tracks.slice(0, 5).map((t, idx) => {
      const label = `${idx + 1}. ${t.title}`.substring(0, 100);
      const description = `By ${t.author || 'Artist'} • Duration: ${t.duration || 'Live'}`.substring(0, 100);
      return new StringSelectMenuOptionBuilder()
        .setLabel(label)
        .setDescription(description)
        .setValue(t.url)
        .setEmoji('🎵');
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(stateManager.create('music', 'select_song'))
      .setPlaceholder('🔍 Select the exact song you want to play...')
      .addOptions(selectOptions);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const embed = UIFactory.premium(
      '🔍 Multiple Results Found',
      `Found **${tracks.length}** search matches for **"${query}"**.\n\nPlease select your preferred version from the menu below:`,
      {
        thumbnail: tracks[0].thumbnail,
        footerText: 'Select a song within 60 seconds • Velu Music ✨'
      }
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error: any) {
    const embed = UIFactory.error('Search Error', error.message || 'Failed to process song search.');
    await interaction.editReply({ embeds: [embed] });
  }
}
