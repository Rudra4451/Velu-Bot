import { AuditLogEvent, GuildChannel } from 'discord.js';
import { db } from '../state/db.js';
import { actionLogger } from '../utils/actionLogger.js';

export const name = 'channelCreate';
export const once = false;

export async function execute(channel: GuildChannel): Promise<void> {
  const guild = channel.guild;
  if (!guild) return;

  const config = db.getConfig(guild.id);
  if (!config.logEnabled) return;

  const executor = await actionLogger.fetchExecutor(guild, AuditLogEvent.ChannelCreate, channel.id);
  
  const fields = [
    { name: 'Channel', value: `${channel} (\`${channel.id}\`)`, inline: true },
    { name: 'Created By', value: executor ? `${executor}` : 'Unknown', inline: true },
    { name: 'Type', value: `\`${channel.type}\``, inline: true }
  ];

  await actionLogger.log(guild, {
    title: '📁 Channel Created',
    description: `A new channel was created: ${channel}.`,
    fields,
    color: 0x00FA9A // Neon Mint
  });
}
