import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const data = new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('Get detailed information about this Discord server.');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const { guild } = interaction;

  if (!guild) {
    const dmEmbed = UIFactory.warning('Command Guild Only', 'This command can only be used inside a Discord server.');
    await middleware.safeReply(interaction, { embeds: [dmEmbed], ephemeral: true });
  }

  // Fetch counts
  const memberCount = guild.memberCount;
  const channels = guild.channels.cache;
  const textChannels = channels.filter(c => c.type === 0).size;
  const voiceChannels = channels.filter(c => c.type === 2).size;
  const rolesCount = guild.roles.cache.size;

  const embed = UIFactory.premium(`Server Details: ${guild.name}`, '', {
    fields: [
      { name: 'Server Owner', value: `<@${guild.ownerId}>`, inline: true },
      { name: 'Created At', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Server ID', value: `\`${guild.id}\``, inline: true },
      { name: 'Members', value: `\`${memberCount}\``, inline: true },
      { name: 'Channels', value: `💬 \`${textChannels}\` Text | 🔊 \`${voiceChannels}\` Voice`, inline: true },
      { name: 'Roles Count', value: `\`${rolesCount}\``, inline: true }
    ],
    thumbnail: guild.iconURL() ?? undefined
  });

  await middleware.safeReply(interaction, { embeds: [embed] });
}
