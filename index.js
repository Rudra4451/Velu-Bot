import { Client, GatewayIntentBits } from 'discord.js';
import { config } from './src/config/index.js';
import { logger } from './src/utils/logger.js';
import { loadEvents } from './src/events/loader.js';
import { loadCommands } from './src/loaders/commands.js';
import { loadComponents } from './src/loaders/components.js';

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
});

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
    // 1. Load component handlers
    await loadComponents(client);

    // 2. Load events
    await loadEvents(client);

    // 3. Load and register commands
    await loadCommands(client);

    // 4. Connect to Discord Gateway
    await client.login(config.DISCORD_TOKEN);
  } catch (error) {
    logger.error('Fatal bootstrapping error:', error);
    process.exit(1);
  }
}

bootstrap();
