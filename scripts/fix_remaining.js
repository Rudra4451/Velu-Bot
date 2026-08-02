import fs from 'fs';
import path from 'path';

function fixFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;
  for (const [search, replace] of replacements) {
    if (content.includes(search)) {
      content = content.replace(new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replace);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Fixed ${filePath}`);
  }
}

// Fix games.ts
fixFile('src/features/games/components/games.ts', [
  ["../../types/index.js", "../../../types/index.js"],
  ["../../core/stateManager.js", "../../../core/stateManager.js"],
  ["../../ui/factory.js", "../../../ui/factory.js"],
  ["../../utils/middleware.js", "../../../utils/middleware.js"],
  ["../../utils/userSerializer.js", "../../../utils/userSerializer.js"],
  ["../commands/games/rps.js", "../commands/rps.js"],
  ["../commands/games/tictactoe.js", "../commands/tictactoe.js"],
  ["../commands/games/guessnumber.js", "../commands/guessnumber.js"],
  ["../commands/games/connectfour.js", "../commands/connectfour.js"],
  ["../commands/games/memory.js", "../commands/memory.js"],
]);

// Fix music.ts components
fixFile('src/features/music/components/music.ts', [
  ["../../services/music.js", "../services/music.js"],
  ["../../ui/factory.js", "../../../ui/factory.js"],
  ["../../utils/middleware.js", "../../../utils/middleware.js"],
  ["../../utils/permissionManager.js", "../../../utils/permissionManager.js"],
  ["../../types/index.js", "../../../types/index.js"],
]);

// Fix music.ts commands
fixFile('src/features/music/commands/nowplaying.ts', [
  ["../../../services/music.js", "../services/music.js"],
]);

// Fix music service
fixFile('src/features/music/services/music.ts', [
  ["../core/stateManager.js", "../../../core/stateManager.js"],
  ["../ui/factory.js", "../../../ui/factory.js"],
  ["../utils/logger.js", "../../../utils/logger.js"],
]);

// Fix utility components
fixFile('src/features/utility/components/utility.ts', [
  ["../../core/stateManager.js", "../../../core/stateManager.js"],
  ["../../ui/factory.js", "../../../ui/factory.js"],
  ["../../utils/middleware.js", "../../../utils/middleware.js"],
  ["../../types/index.js", "../../../types/index.js"],
  ["../commands/utility/poll.js", "../commands/poll.js"],
]);

// Fix moderation security
fixFile('src/features/moderation/commands/security.ts', [
  ["db.updateConfig", "guildStorage.update"],
  ["db.getConfig", "guildStorage.get"],
]);

// Fix moderation warn
fixFile('src/features/moderation/commands/warn.ts', [
  ["db.addWarning(", "// db.addWarning("],
  ["db.getWarnings(", "warningStorage.get("],
  ["db.clearWarnings(", "warningStorage.set(interaction.guild!.id, []); // db.clearWarnings("],
]);

// Fix afk
fixFile('src/features/utility/commands/afk.ts', [
  ["db.setAFK(interaction.user.id, reason);", "afkStorage.set(interaction.user.id, { reason, timestamp: Date.now(), gifUrl: null });"],
]);

// Fix router
fixFile('src/interactions/router.ts', [
  ["../state/manager.js", "../core/stateManager.js"]
]);

console.log("Fixes applied");
