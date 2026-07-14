import { Events } from 'discord.js';
import type { Interaction } from 'discord.js';
import { handleInteraction } from '../interactions/router.js';
import type { VeluClient, BotEvent } from '../types/index.js';

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction: Interaction, client: VeluClient): Promise<void> {
  await handleInteraction(interaction, client);
}
