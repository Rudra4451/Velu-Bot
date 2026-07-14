import type { Guild, AuditLogEvent, User, TextBasedChannel } from 'discord.js';
import { db } from '../state/db.js';
import { UIFactory } from '../ui/factory.js';
import { logger } from './logger.js';

interface LogOptions {
  title: string;
  description: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  color?: number;
  thumbnail?: string;
  image?: string;
}

/**
 * Safely fetches the executor of an action from Guild Audit Logs.
 */
async function fetchExecutor(
  guild: Guild,
  actionType: AuditLogEvent,
  targetId: string
): Promise<User | null> {
  try {
    if (!guild.members.me?.permissions.has('ViewAuditLog')) {
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
    
    return entry ? (entry.executor as User | null) : null;
  } catch (err: unknown) {
    logger.debug(`Failed to fetch audit log for action ${actionType}: ${(err as Error).message}`);
    return null;
  }
}

export const actionLogger = {
  /**
   * General log dispatcher.
   */
  async log(guild: Guild, options: LogOptions): Promise<void> {
    const config = db.getConfig(guild.id);
    if (!config.logEnabled || !config.logChannel) return;

    try {
      const channel = await guild.channels.fetch(config.logChannel);
      if (!channel || !channel.isTextBased()) return;

      const embed = UIFactory.premium(options.title, options.description, {
        fields: options.fields,
        thumbnail: options.thumbnail,
        image: options.image,
        footerText: 'Velu Audit System',
        timestamp: true
      });
      if (options.color) {
        embed.setColor(options.color);
      }

      await (channel as any).send({ embeds: [embed] });
    } catch (err: unknown) {
      logger.error(`Failed to dispatch log to guild ${guild.id}: ${(err as Error).message}`);
    }
  },

  // Helper to fetch executor from audit logs
  fetchExecutor
};
