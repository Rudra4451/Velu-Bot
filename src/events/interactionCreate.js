import { Events } from 'discord.js';
import { handleInteraction } from '../interactions/router.js';

export const name = Events.InteractionCreate;

export async function execute(interaction, client) {
  await handleInteraction(interaction, client);
}
