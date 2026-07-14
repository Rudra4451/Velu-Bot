import { AuditLogEvent, Message } from 'discord.js';
import { db } from '../state/db.js';
import { actionLogger } from '../utils/actionLogger.js';

export const name = 'messageDelete';
export const once = false;

export async function execute(message: Message): Promise<void> {
  if (message.partial) return; // Can't fetch contents of cached partials reliably without database
  if (message.author?.bot) return; // Skip bot messages

  const guild = message.guild;
  if (!guild) return;

  const config = db.getConfig(guild.id);
  if (!config.logEnabled) return;

  const executor = await actionLogger.fetchExecutor(guild, AuditLogEvent.MessageDelete, message.id);
  
  const content = message.content ? (message.content.length > 1000 ? message.content.substring(0, 997) + '...' : message.content) : '_No text content_';

  const fields = [
    { name: 'Author', value: `${message.author} (\`${message.author.id}\`)`, inline: true },
    { name: 'Channel', value: `${message.channel}`, inline: true },
    { name: 'Deleted By', value: executor ? `${executor}` : 'Author (or Unknown)', inline: true },
    { name: 'Content', value: `\`\`\`\n${content}\n\`\`\``, inline: false }
  ];

  await actionLogger.log(guild, {
    title: '🗑️ Message Deleted',
    description: `A message was deleted in ${message.channel}.`,
    fields,
    color: 0xFF3E3E // Vivid Coral
  });
}
