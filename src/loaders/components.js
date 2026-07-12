import { mkdir } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { logger } from '../utils/logger.js';
import { scanDirectory } from '../utils/scanner.js';

export async function loadComponents(client) {
  client.components = new Map();
  const componentsDir = join(process.cwd(), 'src', 'interactions', 'components');

  try {
    await mkdir(componentsDir, { recursive: true });
    const componentFiles = await scanDirectory(componentsDir);

    for (const file of componentFiles) {
      const fileUrl = pathToFileURL(file).href;
      const component = await import(fileUrl);

      if (!component.namespace || !component.execute) {
        logger.warn(`Component file at ${file} is missing required "namespace" or "execute" export.`);
        continue;
      }

      client.components.set(component.namespace, component);
      logger.debug(`Loaded component handler for namespace: ${component.namespace}`);
    }

    logger.info(`Loaded ${client.components.size} component handler(s).`);
  } catch (error) {
    logger.error('Failed to load components:', error);
  }
}
