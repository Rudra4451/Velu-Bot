import { mkdir } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { logger } from '../utils/logger.js';
import { scanDirectory } from '../utils/scanner.js';
import type { VeluClient, ComponentHandler } from '../types/index.js';

export async function loadComponents(client: VeluClient): Promise<void> {
  client.components = new Map();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const componentsDir = join(__dirname, '..', 'interactions', 'components');
  const ext = __filename.endsWith('.ts') ? '.ts' : '.js';

  try {
    await mkdir(componentsDir, { recursive: true });
    const componentFiles = await scanDirectory(componentsDir, { extension: ext });

    for (const file of componentFiles) {
      const fileUrl = pathToFileURL(file).href;
      const component = await import(fileUrl) as ComponentHandler;

      if (!component.namespace || !component.execute) {
        logger.warn(`Component file at ${file} is missing required "namespace" or "execute" export.`);
        continue;
      }

      client.components.set(component.namespace, component);
      logger.debug(`Loaded component handler for namespace: ${component.namespace}`);
    }

    logger.info(`Loaded ${client.components.size} component handler(s).`);
  } catch (error: any) {
    logger.error('Failed to load components:', error);
  }
}
