import { GuildMember } from 'discord.js';
import { guildStorage } from '../database/repositories/GuildRepository.js';
import { actionLogger } from '../utils/actionLogger.js';
import { UIFactory } from '../ui/factory.js';
import { logger } from '../utils/logger.js';
import type { VeluClient, BotEvent } from '../types/index.js';

export const name = 'guildMemberRemove';
export const once = false;

export async function execute(member: GuildMember, client: VeluClient): Promise<void> {
  const guild = member.guild;
  const config = guildStorage.get(guild.id);

  // 1. Goodbye System Notification
  if (config.goodbyeEnabled && config.goodbyeChannel) {
    try {
      const channel = await guild.channels.fetch(config.goodbyeChannel);
      if (channel && channel.isTextBased()) {
        const joinTime = member.joinedTimestamp || Date.now();
        const durationMs = Date.now() - joinTime;
        const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));
        const durationHours = Math.floor((durationMs / (1000 * 60 * 60)) % 24);

        const durationText = durationDays > 0 
          ? `**${durationDays} days** and **${durationHours} hours**` 
          : `**${durationHours} hours**`;

        const goodbyeText = config.goodbyeMessage
          ? config.goodbyeMessage.replace('{member}', `${member.user.tag}`).replace('{server}', guild.name)
          : `Farewell ${member.user.tag}! ☁️\nWe hope you had a good time in **${guild.name}**... you will be missed! 🕊️`;

        const embed = UIFactory.premium(
          '✦ Member Left',
          `${goodbyeText}\n\n*They stayed with us for ${durationText}.*`,
          {
            thumbnail: member.user.displayAvatarURL({ forceStatic: false } as any),
            timestamp: true,
            footerText: `Members: ${guild.memberCount}`,
          }
        );

        await (channel as any).send({ embeds: [embed] });
      }
    } catch (err: any) {
      logger.error(`Failed to send goodbye message for guild ${guild.id}:`, err);
    }
  }

  // 2. Log Member Leave
  if (config.logEnabled) {
    const fields = [
      { name: 'Member', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: 'Joined At', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown', inline: true }
    ];

    await actionLogger.log(guild, {
      title: '📤 Member Left',
      description: `${member.user.tag} has left the server.`,
      fields,
      color: 0xFF3E3E // Vivid Coral/Red
    });
  }
}
