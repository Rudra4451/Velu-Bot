import { Client, GatewayIntentBits } from 'discord.js';
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
  ]
}) as VeluClient;

export const player = new Player(client);

// Load standard extractors automatically
player.extractors.loadMulti(DefaultExtractors);

// Graceful shutdown handling
const shutdown = () => {
  logger.info('Shutdown signal received. Clearning resources and logging out...');
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
  try {
    // 0. Load database cache from Supabase
    await db.loadFromSupabase();

    // 1. Load component handlers
    await loadComponents(client);

    // 2. Load events
    await loadEvents(client);

    // 3. Load and register commands
    await loadCommands(client);

    // 4. Connect to Discord Gateway
    await client.login(config.DISCORD_TOKEN);
    
    // 5. Start API Server
    startApiServer(client);
  } catch (error) {
    logger.error('Fatal bootstrapping error:', error);
    process.exit(1);
  }
}

bootstrap();
