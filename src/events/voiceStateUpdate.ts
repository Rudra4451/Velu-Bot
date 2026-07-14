import { VoiceState } from 'discord.js';
import { db } from '../state/db.js';
import { actionLogger } from '../utils/actionLogger.js';

export const name = 'voiceStateUpdate';
export const once = false;

export async function execute(oldState: VoiceState, newState: VoiceState): Promise<void> {
  const guild = newState.guild;
  const config = db.getConfig(guild.id);
  if (!config.logEnabled) return;

  const member = newState.member;
  if (!member) return;

  // 1. Join voice channel
  if (!oldState.channelId && newState.channelId) {
    const fields = [
      { name: 'Member', value: `${member} (\`${member.id}\`)`, inline: true },
      { name: 'Channel', value: `${newState.channel}`, inline: true }
    ];
    await actionLogger.log(guild, {
      title: '🔊 Voice Joined',
      description: `${member.user.tag} joined voice channel ${newState.channel}.`,
      fields,
      color: 0x00FA9A // Neon Mint
    });
    return;
  }

  // 2. Leave voice channel
  if (oldState.channelId && !newState.channelId) {
    const fields = [
      { name: 'Member', value: `${member} (\`${member.id}\`)`, inline: true },
      { name: 'Channel', value: `${oldState.channel}`, inline: true }
    ];
    await actionLogger.log(guild, {
      title: '🔇 Voice Left',
      description: `${member.user.tag} left voice channel ${oldState.channel}.`,
      fields,
      color: 0xFF3E3E // Vivid Coral
    });
    return;
  }

  // 3. Move voice channel
  if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    const fields = [
      { name: 'Member', value: `${member} (\`${member.id}\`)`, inline: true },
      { name: 'From', value: `${oldState.channel}`, inline: true },
      { name: 'To', value: `${newState.channel}`, inline: true }
    ];
    await actionLogger.log(guild, {
      title: '🔄 Voice Moved',
      description: `${member.user.tag} moved to voice channel ${newState.channel}.`,
      fields,
      color: 0x00BFFF // Deep Sky Blue
    });
  }
}
