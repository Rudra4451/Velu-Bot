import { mkdir } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { REST, Routes } from 'discord.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { scanDirectory } from '../utils/scanner.js';
import type { VeluClient, Command } from '../types/index.js';

export async function loadCommands(client: VeluClient): Promise<void> {
  client.commands = new Map() as VeluClient['commands'];
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const commandsDir = join(__dirname, '..', 'interactions', 'commands');
  const ext = __filename.endsWith('.ts') ? '.ts' : '.js';

  try {
    await mkdir(commandsDir, { recursive: true });
    const commandFiles = await scanDirectory(commandsDir, { extension: ext });
    const commandData: ReturnType<Command['data']['toJSON']>[] = [];

    for (const file of commandFiles) {
      const fileUrl = pathToFileURL(file).href;
      const command = await import(fileUrl) as Command;

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
  } catch (error: any) {
    logger.error('Failed to load or register commands:', error);
  }
}

async function registerCommands(commands: unknown[]): Promise<void> {
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
  } catch (error: any) {
    logger.error('Error occurred while registering slash commands', error);
  }
}
