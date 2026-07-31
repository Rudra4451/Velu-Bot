import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { klipyService } from '../../../services/klipy.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Utility';

export const data = new SlashCommandBuilder()
  .setName('sticker')
  .setDescription('Search and post cute animated Klipy stickers.')
  .addStringOption(opt =>
    opt.setName('query')
      .setDescription('Sticker search term (e.g. happy, dance, anime, cat)')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const query = interaction.options.getString('query', true);
  await interaction.deferReply();

  try {
    const gifUrl = await klipyService.search('sticker', query);
    const embed = UIFactory.premium(`✨ Sticker: ${query}`, null, {
      image: gifUrl,
      footerText: 'Powered by Klipy Stickers'
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    const embed = UIFactory.error('Sticker Error', error.message || 'Could not fetch sticker.');
    await interaction.editReply({ embeds: [embed] });
  }
}
