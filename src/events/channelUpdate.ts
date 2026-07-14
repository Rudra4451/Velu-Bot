import { AuditLogEvent, GuildChannel } from 'discord.js';
import { db } from '../state/db.js';
import { actionLogger } from '../utils/actionLogger.js';

export const name = 'channelUpdate';
export const once = false;

export async function execute(oldChannel: GuildChannel, newChannel: GuildChannel): Promise<void> {
  const guild = newChannel.guild;
  if (!guild) return;

  const config = db.getConfig(guild.id);
  if (!config.logEnabled) return;

  const changes: string[] = [];

  if (oldChannel.name !== newChannel.name) {
    changes.push(`Name: **#${oldChannel.name}** ➔ **#${newChannel.name}**`);
  }
  if ((oldChannel as any).topic !== (newChannel as any).topic) {
    changes.push(`Topic: *"${(oldChannel as any).topic || 'None'}"* ➔ *"${(newChannel as any).topic || 'None'}"*`);
  }
  if (oldChannel.parentId !== newChannel.parentId) {
    const oldParent = oldChannel.parent ? oldChannel.parent.name : 'None';
    const newParent = newChannel.parent ? newChannel.parent.name : 'None';
    changes.push(`Category: **${oldParent}** ➔ **${newParent}**`);
  }

  if (changes.length === 0) return;

  const executor = await actionLogger.fetchExecutor(guild, AuditLogEvent.ChannelUpdate, newChannel.id);

  const fields = [
    { name: 'Channel', value: `${newChannel} (\`${newChannel.id}\`)`, inline: true },
    { name: 'Updated By', value: executor ? `${executor}` : 'Unknown', inline: true },
    { name: 'Changes', value: changes.join('\n'), inline: false }
  ];

  await actionLogger.log(guild, {
    title: '📁 Channel Updated',
    description: `The channel ${newChannel} was modified.`,
    fields,
    color: 0x00BFFF // Deep Sky Blue
  });
}
