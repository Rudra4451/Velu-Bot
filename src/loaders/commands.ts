import { mkdir } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { REST, Routes } from 'discord.js';
import { logger } from '../utils/logger.js';
import { scanDirectory } from '../utils/scanner.js';
import type { VeluClient, Command } from '../types/index.js';
import type { AppConfig } from '../config/index.js';

/**
 * Loads commands into client.commands Map and returns their JSON data
 * WITHOUT registering to Discord REST API (fast, no network I/O).
 */
export async function loadCommands(client: VeluClient): Promise<ReturnType<Command['data']['toJSON']>[]> {
  client.commands = new Map() as VeluClient['commands'];
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const commandsDir = join(__dirname, '..', 'interactions', 'commands');
  const ext = __filename.endsWith('.ts') ? '.ts' : '.js';

  try {
    await mkdir(commandsDir, { recursive: true });
    const commandFiles = await scanDirectory(commandsDir, { extension: ext });
    const commandData: ReturnType<Command['data']['toJSON']>[] = [];

    // Import all command files in parallel for faster loading
    const importPromises = commandFiles.map(async (file) => {
      const fileUrl = pathToFileURL(file).href;
      const command = await import(fileUrl) as Command;
      return { file, command };
    });

    const results = await Promise.allSettled(importPromises);

    for (const result of results) {
      if (result.status === 'rejected') {
        logger.warn(`Failed to import command file: ${result.reason}`);
        continue;
      }
      const { file, command } = result.value;

      if (!command.data || !command.execute) {
        logger.warn(`Command file at ${file} is missing required "data" or "execute" export.`);
        continue;
      }

      client.commands.set(command.data.name, command);
      commandData.push(command.data.toJSON());
      logger.debug(`Loaded command: /${command.data.name}`);
    }

    logger.info(`Loaded ${client.commands.size} command(s).`);
    return commandData;
  } catch (error: any) {
    logger.error('Failed to load commands:', error);
    return [];
  }
}

/**
 * Register slash commands to Discord REST API.
 * This is intentionally separated so it can run AFTER client.login()
 * for faster bot startup (bot appears online before commands finish registering).
 */
loadCommands.registerToDiscord = async function(
  commands: unknown[],
  config: AppConfig
): Promise<void> {
  const rest = new REST({ version: '10', timeout: 60_000 }).setToken(config.DISCORD_TOKEN);

  try {
    logger.info('Started refreshing application (/) commands.');

    // Always register global commands across ALL servers automatically
    logger.info('🚀 Registering global application (/) commands across all servers...');
    await rest.put(
      Routes.applicationCommands(config.DISCORD_CLIENT_ID),
      { body: commands }
    );

    // If DISCORD_GUILD_ID is set, also register guild commands for instant development updates
    if (config.DISCORD_GUILD_ID) {
      logger.info(`⚡ Registering guild-scoped commands to Guild: ${config.DISCORD_GUILD_ID}`);
      await rest.put(
        Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
        { body: commands }
      );
    }

    logger.info('✅ Successfully reloaded application (/) commands.');
  } catch (error: any) {
    logger.error('Error occurred while registering slash commands', error);
  }
};
