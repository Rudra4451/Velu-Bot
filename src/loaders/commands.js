import { mkdir } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { REST, Routes } from 'discord.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { scanDirectory } from '../utils/scanner.js';

export async function loadCommands(client) {
  client.commands = new Map();
  const commandsDir = join(process.cwd(), 'src', 'interactions', 'commands');

  try {
    await mkdir(commandsDir, { recursive: true });
    const commandFiles = await scanDirectory(commandsDir);
    const commandData = [];

    for (const file of commandFiles) {
      const fileUrl = pathToFileURL(file).href;
      const command = await import(fileUrl);

      if (!command.data || !command.execute) {
        logger.warn(`Command file at ${file} is missing required "data" or "execute" export.`);
        continue;
      }

      client.commands.set(command.data.name, command);
      commandData.push(command.data.toJSON());
      logger.debug(`Loaded command: /${command.data.name}`);
    }

    logger.info(`Loaded ${client.commands.size} command(s).`);

    if (commandData.length > 0) {
      await registerCommands(commandData);
    }
  } catch (error) {
    logger.error('Failed to load or register commands:', error);
  }
}

async function registerCommands(commands) {
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);

  try {
    logger.info('Started refreshing application (/) commands.');

    if (config.DISCORD_GUILD_ID) {
      logger.info(`Registering guild-scoped commands to Guild: ${config.DISCORD_GUILD_ID}`);
      await rest.put(
        Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
        { body: commands }
      );
    } else {
      logger.info('Registering global application commands.');
      await rest.put(
        Routes.applicationCommands(config.DISCORD_CLIENT_ID),
        { body: commands }
      );
    }

    logger.info('Successfully reloaded application (/) commands.');
  } catch (error) {
    logger.error('Error occurred while registering slash commands', error);
  }
}
