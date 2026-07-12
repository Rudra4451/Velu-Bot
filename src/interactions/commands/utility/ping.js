import { SlashCommandBuilder } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check the bot latency and API response times.');

export async function execute(interaction) {
  const sent = await interaction.deferReply({ fetchReply: true });
  const latency = sent.createdTimestamp - interaction.createdTimestamp;
  const apiLatency = Math.round(interaction.client.ws.ping);

  const embed = UIFactory.premium('Ping Latency', '', {
    fields: [
      { name: '🤖 Bot Latency', value: `\`${latency}ms\``, inline: true },
      { name: '⚡ Gateway API Latency', value: `\`${apiLatency}ms\``, inline: true }
    ]
  });

  await middleware.safeReply(interaction, { embeds: [embed] });
}
