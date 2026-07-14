import { Events, ActivityType } from 'discord.js';
import { logger } from '../utils/logger.js';
import type { VeluClient, BotEvent } from '../types/index.js';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: VeluClient): Promise<void> {
  logger.info(`🤖 Bot logged in successfully as: ${client.user?.tag}`);
  
  // Set premium cinematic status / presence
  client.user?.setPresence({
    activities: [{
      name: '✦ Velu Premium Bot',
      type: ActivityType.Custom,
      state: '✦ Zero-Persistence, Pure Performance'
    }],
    status: 'online'
  });

  logger.info('🤖 Ready and listening for events.');
}
