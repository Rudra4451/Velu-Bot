import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const token = process.env.DISCORD_TOKEN!;
const clientId = process.env.DISCORD_CLIENT_ID!;

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Started deleting all global application commands.');
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log('Successfully deleted all global application commands.');
  } catch (error) {
    console.error(error);
  }
})();
