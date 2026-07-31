import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { klipyService } from '../../../services/klipy.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Utility';

export const data = new SlashCommandBuilder()
  .setName('sticker')
  .setDescription('Search and send animated Klipy reaction stickers.')
  .addStringOption(opt =>
    opt.setName('query')
      .setDescription('Sticker search keyword (e.g. happy, hug, dance, anime, cat)')
      .setRequired(true)
  )
  .addUserOption(opt =>
    opt.setName('target')
      .setDescription('Optional member to tag or send the sticker to')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const query = interaction.options.getString('query', true);
  const targetUser = interaction.options.getUser('target');
  
  await interaction.deferReply();

  try {
    const gifUrl = await klipyService.search('sticker', query);

    const description = targetUser
      ? `${interaction.user} sent a sticker to ${targetUser}! 🌸`
      : `${interaction.user} shared a sticker! ✨`;

    const embed = UIFactory.premium(`✨ Sticker: ${query}`, description, {
      image: gifUrl,
      footerText: 'Powered by Klipy Stickers'
    });

    await interaction.editReply({ 
      content: targetUser ? `${targetUser}` : undefined,
      embeds: [embed] 
    });
  } catch (error: any) {
    const embed = UIFactory.error('Sticker Error', error.message || 'Could not fetch sticker.');
    await interaction.editReply({ embeds: [embed] });
  }
}
