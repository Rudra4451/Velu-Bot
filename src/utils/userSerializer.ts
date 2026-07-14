import type { User } from 'discord.js';
import type { SerializedUser } from '../types/index.js';

/**
 * Converts a Discord User/GuildMember into a minimal serializable object.
 * Required because Discord.js User objects cannot survive JSON round-trips.
 */
export function serializeUser(user: User): SerializedUser {
  return {
    id: user.id,
    username: user.username,
    tag: user.tag ?? user.username,
    avatarURL: user.displayAvatarURL?.() ?? null,
  };
}

/**
 * Returns a Discord mention string from a serialized user object.
 */
export function mentionUser(user: Pick<SerializedUser, 'id'>): string {
  return `<@${user.id}>`;
}

/**
 * Returns a display name from a serialized user object.
 */
export function displayUser(user: Pick<SerializedUser, 'username'>): string {
  return `**${user.username}**`;
}
