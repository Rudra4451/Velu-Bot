import { Client, GatewayIntentBits, Options, SweeperOptions } from 'discord.js';
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

// ── Performance: Tune Node.js GC & event loop ──────────────────────
if (typeof globalThis.gc === 'undefined') {
  // Increase event emitter limits to prevent warnings under load
  process.setMaxListeners(30);
}

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
    MessageManager: 50,        // only keep last 50 messages per channel
    PresenceManager: 0,        // don't cache presences at all
    GuildMemberManager: {
      maxSize: 200,
      keepOverLimit: (member: any) => member.id === client.user?.id,
    },
  }),
  rest: {
    timeout: 30_000,           // 30s REST timeout
  }
}) as VeluClient;

export const player = new Player(client, {
  // ── Audio Performance: Higher quality pipeline ──
  skipFFmpeg: false,
});

// Load standard extractors automatically
player.extractors.loadMulti(DefaultExtractors);

// Graceful shutdown handling
const shutdown = () => {
  logger.info('Shutdown signal received. Clearing resources and logging out...');
  client.destroy();
  logger.info('Goodbye!');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

async function bootstrap() {
  const startTime = performance.now();

  try {
    // 0. Start Supabase cache load (non-blocking, race with loaders)
    const dbPromise = db.loadFromSupabase();

    // 1. Load components, events, and commands IN PARALLEL
    const [, , commandData] = await Promise.all([
      loadComponents(client),
      loadEvents(client),
      loadCommands(client),    // now returns command data without registering to Discord REST
    ]);

    // Wait for DB load (may have already finished)
    await dbPromise;

    const loadTime = (performance.now() - startTime).toFixed(0);
    logger.info(`⚡ All modules loaded in ${loadTime}ms`);

    // 2. Connect to Discord Gateway FIRST (bot comes online faster)
    await client.login(config.DISCORD_TOKEN);

    // 3. Register slash commands in background after 10s delay (avoids REST rate-limiting during boot)
    if (commandData && commandData.length > 0) {
      setTimeout(() => {
        loadCommands.registerToDiscord(commandData, config).catch(err => {
          logger.error('Background command registration failed:', err);
        });
      }, 10_000);
    }

    // 4. Start API Server
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
    startApiServer(client, port);
  } catch (error) {
    logger.error('Fatal bootstrapping error:', error);
    process.exit(1);
  }
}

bootstrap();
