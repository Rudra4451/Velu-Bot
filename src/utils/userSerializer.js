/**
 * Converts a Discord User/GuildMember into a minimal serializable object.
 * Required because Discord.js User objects cannot survive JSON round-trips.
 * @param {import('discord.js').User} user
 * @returns {{ id: string, username: string, tag: string, avatarURL: string|null }}
 */
export function serializeUser(user) {
  return {
    id: user.id,
    username: user.username,
    tag: user.tag ?? user.username,
    avatarURL: user.displayAvatarURL?.() ?? null,
  };
}

/**
 * Returns a Discord mention string from a serialized user object.
 * @param {{ id: string, username: string }} user
 * @returns {string}
 */
export function mentionUser(user) {
  return `<@${user.id}>`;
}

/**
 * Returns a display name from a serialized user object.
 * @param {{ username: string }} user
 * @returns {string}
 */
export function displayUser(user) {
  return `**${user.username}**`;
}
