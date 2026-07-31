import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const token = process.env.DISCORD_TOKEN!;
const clientId = process.env.DISCORD_CLIENT_ID!;

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Started deleting all application commands.');
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    await rest.put(Routes.applicationGuildCommands(clientId, '1063478012164710502'), { body: [] });
    console.log('Successfully deleted all application commands.');
  } catch (error) {
    console.error(error);
  }
})();
