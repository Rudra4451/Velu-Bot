import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '..', 'src');

const replacements = [
  { from: /storage\/GuildStorage\.js/g, to: 'database/repositories/GuildRepository.js' },
  { from: /storage\/WarningStorage\.js/g, to: 'database/repositories/WarningRepository.js' },
  { from: /storage\/TicketStorage\.js/g, to: 'database/repositories/TicketRepository.js' },
  { from: /storage\/SuggestionStorage\.js/g, to: 'database/repositories/SuggestionRepository.js' },
  { from: /storage\/ReactionRoleStorage\.js/g, to: 'database/repositories/ReactionRoleRepository.js' },
  { from: /storage\/StarboardStorage\.js/g, to: 'database/repositories/StarboardRepository.js' },
  { from: /storage\/AfkStorage\.js/g, to: 'database/repositories/AfkRepository.js' }
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const { from, to } of replacements) {
        if (content.match(from)) {
          content = content.replace(from, to);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated imports in ${fullPath}`);
      }
    }
  }
}

processDirectory(srcDir);
// Also process index.ts in root
let indexContent = fs.readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8');
let indexChanged = false;
for (const { from, to } of replacements) {
  if (indexContent.match(from)) {
    indexContent = indexContent.replace(from, to);
    indexChanged = true;
  }
}
if (indexChanged) {
  fs.writeFileSync(path.join(__dirname, '..', 'index.ts'), indexContent, 'utf8');
  console.log(`Updated imports in index.ts`);
}

// Ensure the old storage directory is removed later
console.log('Done mapping imports.');
