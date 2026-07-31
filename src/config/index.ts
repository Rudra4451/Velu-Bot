import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DISCORD_GUILD_ID: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  KLIPY_API_KEY: z.string().optional(),
  BOT_PREFIX: z.string().min(1).max(3).default('?'),
  BOT_PREFIXES: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_KEY: z.string().optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

const parseConfig = (): AppConfig => {
  const result = configSchema.safeParse({
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
    LOG_LEVEL: process.env.LOG_LEVEL,
    KLIPY_API_KEY: process.env.KLIPY_API_KEY,
    BOT_PREFIX: process.env.BOT_PREFIX,
    BOT_PREFIXES: process.env.BOT_PREFIXES,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
  });

  if (!result.success) {
    console.error('❌ Invalid configuration:', result.error.format());
    process.exit(1);
  }

  return result.data;
};

export const config = parseConfig();

/** All active bot prefixes — parsed from BOT_PREFIXES or falls back to BOT_PREFIX */
export const BOT_PREFIXES: string[] = (() => {
  if (config.BOT_PREFIXES) {
    return config.BOT_PREFIXES.split(',').map(p => p.trim()).filter(p => p.length > 0);
  }
  return [config.BOT_PREFIX];
})();
