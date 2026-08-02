import fs from 'fs';
import path from 'path';

const dirs = [
  'src/features/music/commands',
  'src/features/music/components',
  'src/features/music/services',
  'src/features/moderation/commands',
  'src/features/moderation/components',
  'src/features/utility/commands',
  'src/features/utility/components',
  'src/features/games/commands',
  'src/features/games/components',
  'src/features/configuration/commands',
  'src/features/configuration/components',
  'src/ui/embeds',
  'src/ui/components',
];

for (const dir of dirs) {
  fs.mkdirSync(path.join(process.cwd(), dir), { recursive: true });
}

console.log('Directories created successfully.');
