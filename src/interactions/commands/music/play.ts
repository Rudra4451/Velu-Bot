import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, TextChannel } from 'discord.js';
import { musicService } from '../../../services/music.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Music';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a song from YouTube or SoundCloud.')
  .addStringOption(option => 
    option.setName('query')
      .setDescription('URL or search terms')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
  
  const query = interaction.options.getString('query', true);
  const textChannel = interaction.channel as TextChannel;

  await interaction.deferReply();

  try {
    const result = await musicService.play(interaction.member, query, textChannel);
    const embed = UIFactory.success('Music Queued', result.message, { thumbnail: result.thumbnail });
    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    const embed = UIFactory.error('Playback Error', error.message);
    await interaction.editReply({ embeds: [embed] });
  }
}
