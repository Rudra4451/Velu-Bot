import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const data = new SlashCommandBuilder()
  .setName('uptime')
  .setDescription('Display the current running uptime of the bot.');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const uptimeMs = interaction.client.uptime;
  
  // Format uptime to Days, Hours, Minutes, Seconds
  let totalSeconds = Math.floor(uptimeMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  totalSeconds %= 86400;
  const hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const uptimeString = `\`${days}d ${hours}h ${minutes}m ${seconds}s\``;
  const embed = UIFactory.premium('System Uptime', `Bot has been online and active for:\n\n${uptimeString}`);

  await middleware.safeReply(interaction, { embeds: [embed] });
}
