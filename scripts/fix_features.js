import fs from 'fs';
import path from 'path';

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(filePath));
    } else if (filePath.endsWith('.ts')) {
      results.push(filePath);
    }
  }
  return results;
}

const featureFiles = walkDir(path.join(process.cwd(), 'src/features'));

for (const filePath of featureFiles) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  // Replace stateManager import
  if (content.includes("import { stateManager } from '../../../state/manager.js';")) {
    content = content.replace("import { stateManager } from '../../../state/manager.js';", "import { stateManager } from '../../../core/stateManager.js';");
    changed = true;
  }
  
  if (content.includes("import { stateManager } from '../../state/manager.js';")) {
    content = content.replace("import { stateManager } from '../../state/manager.js';", "import { stateManager } from '../../core/stateManager.js';");
    changed = true;
  }
  
  if (content.includes("import { stateManager } from '../state/manager.js';")) {
    content = content.replace("import { stateManager } from '../state/manager.js';", "import { stateManager } from '../core/stateManager.js';");
    changed = true;
  }

  // Replace db import
  if (content.includes("import { db } from '../../../state/db.js';")) {
    content = content.replace("import { db } from '../../../state/db.js';", "import { guildStorage } from '../../../storage/GuildStorage.js';\nimport { warningStorage } from '../../../storage/WarningStorage.js';\nimport { afkStorage } from '../../../storage/AfkStorage.js';");
    changed = true;
  }

  if (content.includes("db.getConfig(")) {
    content = content.replace(/db\.getConfig\(/g, "guildStorage.get(");
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${path.basename(filePath)}`);
  }
}
