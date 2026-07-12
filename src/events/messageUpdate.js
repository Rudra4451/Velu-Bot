import { db } from '../state/db.js';
import { actionLogger } from '../utils/actionLogger.js';

export const name = 'messageUpdate';
export const once = false;

export async function execute(oldMessage, newMessage) {
  if (newMessage.partial) return;
  if (newMessage.author?.bot) return; // Skip bots
  if (oldMessage.content === newMessage.content) return; // Skip edits that aren't text-based (like embeds/pins loading)

  const guild = newMessage.guild;
  if (!guild) return;

  const config = db.getConfig(guild.id);
  if (!config.logEnabled) return;

  const oldContent = oldMessage.content 
    ? (oldMessage.content.length > 500 ? oldMessage.content.substring(0, 497) + '...' : oldMessage.content) 
    : '_None_';
  const newContent = newMessage.content 
    ? (newMessage.content.length > 500 ? newMessage.content.substring(0, 497) + '...' : newMessage.content) 
    : '_None_';

  const fields = [
    { name: 'Author', value: `${newMessage.author} (\`${newMessage.author.id}\`)`, inline: true },
    { name: 'Channel', value: `${newMessage.channel}`, inline: true },
    { name: 'Jump Link', value: `[Go to Message](${newMessage.url})`, inline: true },
    { name: 'Before', value: `\`\`\`\n${oldContent}\n\`\`\``, inline: false },
    { name: 'After', value: `\`\`\`\n${newContent}\n\`\`\``, inline: false }
  ];

  await actionLogger.log(guild, {
    title: '📝 Message Edited',
    description: `A message was edited in ${newMessage.channel}.`,
    fields,
    color: 0x00BFFF // Deep Sky Blue
  });
}
