import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { db } from '../../../state/db.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Utility';

export const data = new SlashCommandBuilder()
  .setName('afk')
  .setDescription('Set your status to Away From Keyboard.')
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for going AFK')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const reason = interaction.options.getString('reason') || 'AFK';
  
  db.setAFK(interaction.user.id, reason);

  const embed = UIFactory.premium('💤 Status Updated: AFK', `You are now AFK: **${reason}**\n\n*I will automatically notify anyone who mentions you, and remove your AFK status when you send a message.*`, {
    footerText: 'Away From Keyboard'
  });

  await middleware.safeReply(interaction, { embeds: [embed] });
}
