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

const musicFiles = walkDir(path.join(process.cwd(), 'src/features/music'));

for (const filePath of musicFiles) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  // Replace music service import
  if (content.includes("import { musicService } from '../../../services/music.js';")) {
    content = content.replace("import { musicService } from '../../../services/music.js';", "import { musicService } from '../services/music.js';");
    changed = true;
  }
  
  if (content.includes("import { musicService } from '../../services/music.js';")) {
    content = content.replace("import { musicService } from '../../services/music.js';", "import { musicService } from '../services/music.js';");
    changed = true;
  }
  
  if (content.includes("import { UIFactory } from '../ui/factory.js';")) {
    content = content.replace("import { UIFactory } from '../ui/factory.js';", "import { UIFactory } from '../../../ui/factory.js';");
    changed = true;
  }
  
  if (content.includes("import { logger } from '../utils/logger.js';")) {
    content = content.replace("import { logger } from '../utils/logger.js';", "import { logger } from '../../../utils/logger.js';");
    changed = true;
  }
  
  if (content.includes("import { stateManager } from '../state/manager.js';")) {
    content = content.replace("import { stateManager } from '../state/manager.js';", "import { stateManager } from '../../../core/stateManager.js';");
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${path.basename(filePath)}`);
  }
}
