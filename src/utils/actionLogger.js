import { AuditLogEvent } from 'discord.js';
import { db } from '../state/db.js';
import { UIFactory } from '../ui/factory.js';
import { logger } from './logger.js';

/**
 * Safely fetches the executor of an action from Guild Audit Logs.
 */
async function fetchExecutor(guild, actionType, targetId) {
  try {
    if (!guild.members.me.permissions.has('ViewAuditLog')) {
      return null;
    }
    const auditLogs = await guild.fetchAuditLogs({
      limit: 5,
      type: actionType
    });
    
    // Find the log entry matching the target and created in the last 10 seconds
    const entry = auditLogs.entries.find(
      e => e.targetId === targetId && (Date.now() - e.createdTimestamp) < 10000
    );
    
    return entry ? entry.executor : null;
  } catch (err) {
    logger.debug(`Failed to fetch audit log for action ${actionType}: ${err.message}`);
    return null;
  }
}

export const actionLogger = {
  /**
   * General log dispatcher
   */
  async log(guild, { title, description, fields = [], color, thumbnail, image }) {
    const config = db.getConfig(guild.id);
    if (!config.logEnabled || !config.logChannel) return;

    try {
      const channel = await guild.channels.fetch(config.logChannel);
      if (!channel || !channel.isTextBased()) return;

      const embed = UIFactory.premium(title, description, {
        fields,
        thumbnail,
        image,
        footerText: 'Velu Audit System',
        timestamp: true
      });
      if (color) {
        embed.setColor(color);
      }

      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error(`Failed to dispatch log to guild ${guild.id}: ${err.message}`);
    }
  },

  // Helper to fetch executor from audit logs
  fetchExecutor
};
