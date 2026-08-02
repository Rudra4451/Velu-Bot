import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';
import type { Command } from '../../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot latency and API response times.'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    const sent = await interaction.fetchReply();
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
};

export const { data, execute } = command;
