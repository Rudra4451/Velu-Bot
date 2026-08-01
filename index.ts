import { Client, GatewayIntentBits, Options } from 'discord.js';
import { Player } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';
import { config } from './src/config/index.js';
import { logger } from './src/utils/logger.js';
import { loadEvents } from './src/events/loader.js';
import { loadCommands } from './src/loaders/commands.js';
import { loadComponents } from './src/loaders/components.js';
import { startApiServer } from './src/api/server.js';
import { db } from './src/state/db.js';
import type { VeluClient } from './src/types/index.js';

// ── Performance: Tune Node.js event loop ──────────────────────
process.setMaxListeners(30);

logger.info('✦ Initializing Velu Bot...');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  // ── Performance: Cache sweepers to keep memory lean ──
  sweepers: {
    messages: {
      interval: 300,   // sweep every 5 minutes
      lifetime: 600,   // discard messages older than 10 minutes
    },
    users: {
      interval: 600,
      filter: () => (user: any) => user.bot && user.id !== client.user?.id,
    },
  },
  // ── Performance: Limit cached messages per channel ──
  makeCache: Options.cacheWithLimits({
    MessageManager: 50,
    PresenceManager: 0,
    GuildMemberManager: {
      maxSize: 200,
      keepOverLimit: (member: any) => member.id === client.user?.id,
    },
  }),
  rest: {
    timeout: 30_000,
  }
}) as VeluClient;

export const player = new Player(client, {
  skipFFmpeg: false,
});

// Extractors loaded during bootstrap phase

// ── Crash Protection: Never let the bot process die ──────────────
const shutdown = () => {
  logger.info('Shutdown signal received. Clearing resources and logging out...');
  client.destroy();
  logger.info('Goodbye!');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Prevent unhandled errors from killing the process
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception (process survived):', error);
  // Don't exit — keep the bot running
});

// ── Auto-Reconnect: Re-login if Discord WebSocket disconnects ──
client.on('shardDisconnect', (event, shardId) => {
  logger.warn(`Shard ${shardId} disconnected (code ${event.code}). Auto-reconnecting in 5s...`);
  setTimeout(() => {
    client.login(config.DISCORD_TOKEN).catch(err => {
      logger.error('Auto-reconnect failed:', err);
    });
  }, 5000);
});

client.on('shardError', (error, shardId) => {
  logger.error(`Shard ${shardId} WebSocket error:`, error);
});

client.on('shardReconnecting', (shardId) => {
  logger.info(`Shard ${shardId} reconnecting...`);
});

async function bootstrap() {
  const startTime = performance.now();

  try {
    // 0. Start Supabase cache load (non-blocking, race with loaders)
    const dbPromise = db.loadFromSupabase();

    // 1. Load components, events, commands, and extractors IN PARALLEL
    const [, , commandData] = await Promise.all([
      loadComponents(client),
      loadEvents(client),
      loadCommands(client),
      player.extractors.loadMulti(DefaultExtractors).catch(err => {
        logger.error('Failed to load default player extractors:', err);
      }),
    ]);

    // Wait for DB load (may have already finished)
    await dbPromise;

    const loadTime = (performance.now() - startTime).toFixed(0);
    logger.info(`⚡ All modules loaded in ${loadTime}ms`);

    // 2. Connect to Discord Gateway FIRST (bot comes online faster)
    await client.login(config.DISCORD_TOKEN);

    // 3. Register slash commands in background after 10s delay
    if (commandData && commandData.length > 0) {
      setTimeout(() => {
        loadCommands.registerToDiscord(commandData, config).catch(err => {
          logger.error('Background command registration failed:', err);
        });
      }, 10_000);
    }

    // 4. Start API Server (includes keep-alive pinger)
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
    startApiServer(client, port);
  } catch (error) {
    logger.error('Fatal bootstrapping error:', error);
    // In production, restart instead of dying
    logger.info('Retrying bootstrap in 10 seconds...');
    setTimeout(() => bootstrap(), 10_000);
  }
}

bootstrap();
