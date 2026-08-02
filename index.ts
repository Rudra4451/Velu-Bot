import { Client, GatewayIntentBits, Options } from 'discord.js';
import { config } from './src/config/index.js';
import { logger } from './src/utils/logger.js';
import { loadEvents } from './src/events/loader.js';
import { loadCommands } from './src/loaders/commands.js';
import { loadComponents } from './src/loaders/components.js';
import { startApiServer } from './src/api/server.js';
import { guildStorage } from './src/database/repositories/GuildRepository.js';
import { warningStorage } from './src/database/repositories/WarningRepository.js';
import { ticketStorage } from './src/database/repositories/TicketRepository.js';
import { suggestionStorage } from './src/database/repositories/SuggestionRepository.js';
import { starboardStorage } from './src/database/repositories/StarboardRepository.js';
import { reactionRoleStorage } from './src/database/repositories/ReactionRoleRepository.js';
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

// ── Crash Protection: Never let the bot process die ──────────────
const shutdown = async () => {
  logger.info('Shutdown signal received. Clearing resources and logging out...');
  
  // Flush all pending DB writes
  logger.info('Flushing database writes...');
  await Promise.all([
    guildStorage.flush(),
    warningStorage.flush(),
    ticketStorage.flush(),
    suggestionStorage.flush(),
    starboardStorage.flush(),
    reactionRoleStorage.flush()
  ]).catch(e => logger.error('Error flushing DB:', e));

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
    // 0. Init JSON file storages (non-blocking)
    const storageInitPromise = Promise.all([
      guildStorage.init(),
      warningStorage.init(),
      ticketStorage.init(),
      suggestionStorage.init(),
      starboardStorage.init(),
      reactionRoleStorage.init()
    ]);

    // 1. Load components, events, and commands IN PARALLEL
    const [, , commandData] = await Promise.all([
      loadComponents(client),
      loadEvents(client),
      loadCommands(client),
    ]);

    // Wait for Storage init to finish
    await storageInitPromise;

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
