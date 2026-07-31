/**
 * Standalone command deployment script.
 * Run via: npm run deploy
 * This registers slash commands without starting the gateway connection.
 */

import dotenv from 'dotenv';
dotenv.config();

import { z } from 'zod';
import { REST, Routes } from 'discord.js';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { scanDirectory } from '../utils/scanner.js';

const configSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().optional(),
});

const result = configSchema.safeParse({
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
});

if (!result.success) {
  console.error('❌ Missing required environment variables:', result.error.format());
  process.exit(1);
}

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = result.data;

const commandsDir = join(process.cwd(), 'src', 'interactions', 'commands');
await mkdir(commandsDir, { recursive: true });

const commandFiles = await scanDirectory(commandsDir);
const commandData = [];

for (const file of commandFiles) {
  const fileUrl = pathToFileURL(file).href;
  const command = await import(fileUrl);
  if (!command.data?.toJSON) {
    console.warn(`⚠️  Skipping invalid command file: ${file}`);
    continue;
  }
  commandData.push(command.data.toJSON());
  console.log(`  ✓ Queued: /${command.data.name}`);
}

const rest = new REST({ version: '10', timeout: 60000 }).setToken(DISCORD_TOKEN);

if (DISCORD_GUILD_ID) {
  console.log(`\n🚀 Registering ${commandData.length} command(s) to guild ${DISCORD_GUILD_ID}...`);
  await rest.put(
    Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
    { body: commandData }
  );
} else {
  console.log(`\n🚀 Registering ${commandData.length} command(s) globally...`);
  await rest.put(
    Routes.applicationCommands(DISCORD_CLIENT_ID),
    { body: commandData }
  );
}

console.log('✅ Successfully deployed all slash commands!');
