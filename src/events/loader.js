import { mkdir } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { logger } from '../utils/logger.js';
import { scanDirectory } from '../utils/scanner.js';

export async function loadEvents(client) {
  const eventsDir = join(process.cwd(), 'src', 'events');

  try {
    await mkdir(eventsDir, { recursive: true });
    const eventFiles = await scanDirectory(eventsDir, { exclude: ['loader.js'] });

    for (const file of eventFiles) {
      const fileUrl = pathToFileURL(file).href;
      const event = await import(fileUrl);

      if (!event.name || !event.execute) {
        logger.warn(`Event file at ${file} is missing required "name" or "execute" export.`);
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }

      logger.debug(`Loaded event listener for: ${event.name}`);
    }

    logger.info(`Loaded event listeners.`);
  } catch (error) {
    logger.error('Failed to load events:', error);
  }
}
