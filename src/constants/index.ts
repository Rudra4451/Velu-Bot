export { THEME } from './theme.js';

export const LIMITS = {
  STATE_TTL_MS: 2 * 60 * 60 * 1000,   // 2 hours temporary memory expiration
  DISCORD_CUSTOM_ID_LIMIT: 100,    // Discord's maximum custom_id length
  COOLDOWN_DEFAULT_MS: 3000,       // Default interaction cooldown (ms)
} as const;

// Game-specific constants
export const GAMES = {
  TTT_LINES: [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6],             // diagonals
  ],
} as const;
