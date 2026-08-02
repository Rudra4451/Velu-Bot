import fs from 'fs';
import path from 'path';

const eventsDir = path.join(process.cwd(), 'src/events');
const files = fs.readdirSync(eventsDir).filter(f => f.endsWith('.ts'));

for (const file of files) {
  const filePath = path.join(eventsDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  if (content.includes("import { db } from '../state/db.js';")) {
    content = content.replace("import { db } from '../state/db.js';", "import { guildStorage } from '../storage/GuildStorage.js';");
    changed = true;
  }
  
  if (content.includes("db.getConfig(")) {
    content = content.replace(/db\.getConfig\(/g, "guildStorage.get(");
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${file}`);
  }
}
