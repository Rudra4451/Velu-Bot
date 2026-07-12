import { db } from '../state/db.js';
import { klipyService } from '../services/klipy.js';
import { actionLogger } from '../utils/actionLogger.js';
import { UIFactory } from '../ui/factory.js';
import { logger } from '../utils/logger.js';

export const name = 'guildMemberRemove';
export const once = false;

export async function execute(member, client) {
  const guild = member.guild;
  const config = db.getConfig(guild.id);

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

        const gifUrl = await klipyService.search('goodbye', 'anime wave goodbye sad');

        const embed = UIFactory.premium(
          '✦ Member Left',
          `**${member.user.tag}** has left the server. They stayed with us for ${durationText}.`,
          {
            thumbnail: member.user.displayAvatarURL({ dynamic: true }),
            image: gifUrl || undefined,
            timestamp: true,
            footerText: `Members: ${guild.memberCount}`,
          }
        );

        await channel.send({ embeds: [embed] });
      }
    } catch (err) {
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
