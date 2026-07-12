import { AuditLogEvent } from 'discord.js';
import { db } from '../state/db.js';
import { actionLogger } from '../utils/actionLogger.js';

export const name = 'channelDelete';
export const once = false;

export async function execute(channel) {
  const guild = channel.guild;
  if (!guild) return;

  const config = db.getConfig(guild.id);
  if (!config.logEnabled) return;

  const executor = await actionLogger.fetchExecutor(guild, AuditLogEvent.ChannelDelete, channel.id);
  
  const fields = [
    { name: 'Channel Name', value: `\`#${channel.name}\``, inline: true },
    { name: 'Deleted By', value: executor ? `${executor}` : 'Unknown', inline: true },
    { name: 'ID', value: `\`${channel.id}\``, inline: true }
  ];

  await actionLogger.log(guild, {
    title: '🗑️ Channel Deleted',
    description: `The channel **#${channel.name}** was deleted.`,
    fields,
    color: 0xFF3E3E // Vivid Coral
  });
}
