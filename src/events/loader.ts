import { mkdir } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { logger } from '../utils/logger.js';
import { scanDirectory } from '../utils/scanner.js';
import type { VeluClient, BotEvent } from '../types/index.js';

export async function loadEvents(client: VeluClient): Promise<void> {
  const eventsDir = join(process.cwd(), 'src', 'events');

  try {
    await mkdir(eventsDir, { recursive: true });
    const eventFiles = await scanDirectory(eventsDir, { exclude: ['loader.ts', 'loader.js'] });

    for (const file of eventFiles) {
      const fileUrl = pathToFileURL(file).href;
      const event = await import(fileUrl) as BotEvent;

      if (!event.name || !event.execute) {
        logger.warn(`Event file at ${file} is missing required "name" or "execute" export.`);
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args: unknown[]) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args: unknown[]) => event.execute(...args, client));
      }

      logger.debug(`Loaded event listener for: ${event.name}`);
    }

    logger.info(`Loaded event listeners.`);
  } catch (error: any) {
    logger.error('Failed to load events:', error);
  }
}
