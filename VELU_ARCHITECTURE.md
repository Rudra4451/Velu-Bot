# Velu Bot — Complete Architecture & Onboarding Guide

Welcome to **Velu**! This document is explicitly designed to be **copy-pasteable** into any AI (ChatGPT, Claude, Gemini, etc.) to give the AI full context of the repository. It contains our architecture, philosophy, file structure, and core source code examples. 

---

## 1. Core Philosophy & Stack

*   **Language:** TypeScript (Strict Mode) running via `tsx` or compiled to Node.js.
*   **Library:** `discord.js` v14.
*   **Architecture:** **Zero-Persistence** / In-Memory State. There is NO database (No MongoDB, No PostgreSQL). Everything runs dynamically in memory via `src/state/`. 
*   **UI/UX:** "Cute, Premium, Clean, Pastel." All visual output routes through a central `UIFactory`.

### Project Structure
```
Velu/
├── index.ts                     # Entry point & Client Bootstrap
├── src/
│   ├── config/                  # Environment variables & runtime constants
│   ├── constants/               # Theming & Visuals (Pastel Theme)
│   ├── types/                   # Universal TypeScript interfaces
│   ├── ui/                      # UIFactory for Embed generation
│   ├── state/                   # In-memory DB (db.ts) and State Manager (manager.ts)
│   ├── services/                # External APIs (e.g., Klipy for GIFs)
│   ├── utils/                   # Loggers, Middlewares, Permissions
│   ├── handlers/                # Events (messageCreate.ts) and Prefix logic (prefix.ts)
│   ├── loaders/                 # Dynamic Loaders (commands, components, events)
│   └── interactions/
│       ├── commands/            # Slash Commands grouped by category (social, utility, etc.)
│       └── components/          # Button & Select Menu handlers (e.g., games.ts)
```

---

## 2. Core Modules & Code Snippets

### A. The UIFactory (`src/ui/factory.ts`)
We use a centralized factory for all Discord embeds to ensure consistent branding.
```typescript
import { EmbedBuilder } from 'discord.js';
import { THEME } from '../constants/theme.js';

export class UIFactory {
  static createBase(title: string | null, description: string | null, color: number, icon: string, options: any = {}) {
    const embed = new EmbedBuilder().setColor(color);
    if (title) embed.setTitle(icon ? `${icon}   ${title}` : title);
    if (description) embed.setDescription(description);
    return embed;
  }
  static success(title: string | null, desc: string | null, options = {}) {
    return this.createBase(title, desc, THEME.colors.success, THEME.icons.success, options);
  }
  // Other methods: error(), premium(), info()
}
```

### B. State Management (`src/state/manager.ts`)
Because we have no DB, interactive elements (like Games, Modals) must survive statelessly. The `stateManager` serializes state into custom IDs for Discord buttons.
```typescript
class StateManager {
  // Encodes: "namespace:action:base64Data"
  create(namespace: string, action: string, data: Record<string, any> = {}): string {
    const payload = Buffer.from(JSON.stringify(data)).toString('base64');
    return `${namespace}:${action}:${payload}`;
  }
  // Decodes incoming interaction customIds
  parse(customId: string) {
    const [namespace, action, payload] = customId.split(':');
    const data = payload ? JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) : null;
    return { namespace, action, data };
  }
}
export const stateManager = new StateManager();
```

### C. Prefix Command Routing (`src/handlers/prefix.ts`)
Our bot supports both Slash Commands and standard prefix commands. Mention parsing is strictly handled by `resolveUserOrMember()`.
```typescript
// We aggressively parse IDs, mentions (<@!123>), and standard @usernames.
async function resolveUserOrMember(message: Message, arg: string | undefined) {
  if (!arg) return {};
  const idMatch = arg.match(/^<@!?(\d+)>$/);
  const id = idMatch ? idMatch[1] : (/^\d+$/.test(arg) ? arg : null);
  
  if (id) {
    const member = message.guild?.members.cache.get(id);
    if (member) return { user: member.user, member };
  } else {
    const cleanArg = arg.replace(/^@/, '').toLowerCase();
    const member = message.guild?.members.cache.find(m => m.user.username.toLowerCase() === cleanArg);
    if (member) return { user: member.user, member };
  }
  return {};
}
```

### D. Advanced AI (Minimax & Alpha-Beta Pruning)
Our Game bots (TicTacToe and Connect 4) use recursive AI.
Connect 4 uses Alpha-Beta pruning (`src/interactions/components/games.ts`):
```typescript
function minimaxC4(board: any[], depth: number, alpha: number, beta: number, isMaximizing: boolean) {
  const isTerminal = isTerminalNode(board);
  if (depth === 0 || isTerminal) {
    if (isTerminal) return checkC4Win(board) ? (isMaximizing ? -10000000 : 10000000) : 0;
    return evaluateC4Board(board, 'p2');
  }
  // Standard Alpha-Beta Loop...
}
```

---

## 3. How to Add a New Command

Create a new file in `src/interactions/commands/CATEGORY/name.ts`. It will be auto-loaded!

```typescript
import { SlashCommandBuilder } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';
import type { Command } from '../../../types/index.js';

export const module = 'Utility';
export const data = new SlashCommandBuilder()
  .setName('hello')
  .setDescription('Say hello!');

export async function execute(interaction: any) {
  await middleware.safeReply(interaction, {
    embeds: [UIFactory.success('Hello!', 'Welcome to Velu.')]
  });
}
```

---

## 4. Note to Future AIs

When reading this, please understand that:
1. **Never introduce a database**. Use memory caching (`src/state/db.ts`).
2. **Never change the UI theme** to dark/aggressive colors unless requested. Stick to pastels (`src/constants/theme.ts`).
3. Ensure all user parameters fallback between ID, Tag, and Username.
4. Keep TypeScript strictness. Resolve any `null` types via `if(!interaction.guild) return;`

Good luck!
