<div align="center">

# ✦ Velu Bot

### Premium Music · Security · Games — All-in-One Discord Bot

[![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge)](LICENSE)
[![Deploy](https://img.shields.io/badge/Render-Deployed-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://render.com)

**Studio-grade 48kHz music** · **37 slash commands** · **Multi-engine search** · **Autoplay** · **Auto-mod** · **Mini-games** · **24/7 uptime**

[Invite Velu](https://discord.com/oauth2/authorize?client_id=1525432700511453306&permissions=8&scope=bot%20applications.commands) · [Report Bug](https://github.com/Rudra4451/Velu-Bot/issues) · [Request Feature](https://github.com/Rudra4451/Velu-Bot/issues)

</div>

---

## ✨ Feature Highlights

| Category | Features |
|----------|----------|
| 🎵 **Music Engine** | YouTube, Spotify & SoundCloud multi-engine search · Studio 48kHz audio · Live autocomplete · Autoplay related tracks · Interactive Now Playing cards with pause/skip/loop/queue buttons |
| 🛡️ **Security Suite** | Anti-spam rate limiting · Anti-invite link blocker · Bad word filter · Warning system · Audit logging · Channel lock/unlock |
| 🎮 **Mini-Games** | TicTacToe (vs AI) · Connect Four · Rock Paper Scissors · Memory Card Match · Guess the Number |
| 🌸 **Stickers & GIFs** | Multi-provider parallel search (Waifu.pics + Giphy + Klipy) · Reaction GIFs for moderation actions |
| ⚡ **Performance** | Parallel API racing · In-memory caching · Pre-computed button IDs · O(n) fuzzy matching · 8-min self-ping keep-alive |

---

## 🚀 Quick Setup

### Prerequisites

- **Node.js ≥ 22.0.0** (required for Supabase SDK)
- Discord Bot Token & Application ID — [Developer Portal](https://discord.com/developers/applications)
- Optional: [Klipy API Key](https://klipy.com/) for extra stickers

### Installation

```bash
git clone https://github.com/Rudra4451/Velu-Bot.git
cd Velu-Bot
npm install
```

### Configuration

Copy `.env.example` → `.env` and fill in your credentials:

```bash
cp .env.example .env
```

```ini
# Required
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id

# Optional — faster dev command registration
DISCORD_GUILD_ID=your_test_guild_id

# Optional — persistent storage (falls back to in-memory if not set)
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Optional — animated stickers
KLIPY_API_KEY=your_klipy_key

# Multi-prefix chat commands
BOT_PREFIX=?
BOT_PREFIXES=?,!,$,&

LOG_LEVEL=info
```

### Run

```bash
# Development (hot-reload)
npm run dev

# Production
npm run build
npm start
```

Slash commands auto-register globally on startup — no manual deploy needed.

---

## 🎮 All 37 Commands

### 🎵 Music (9 commands)

| Command | Description |
|---------|-------------|
| `/play <query>` | Search & play from YouTube, Spotify, SoundCloud with live autocomplete |
| `/nowplaying` | Now Playing card with progress bar & interactive controls |
| `/queue` | View upcoming tracks & total duration |
| `/skip` | Skip to the next track |
| `/stop` | Disconnect & clear the queue |
| `/volume <0-100>` | Adjust playback volume |
| `/loop` | Cycle: Off → Track 🔂 → Queue 🔁 → Autoplay 📻 |
| `/autoplay` | Toggle automatic related track playback |
| `/shuffle` | Shuffle the queue randomly |

### 🛡️ Moderation (10 commands)

| Command | Description |
|---------|-------------|
| `/ban <user> [reason]` | Ban a member with optional message purge |
| `/unban <user>` | Unban a user by ID |
| `/kick <user> [reason]` | Kick a member from the server |
| `/timeout <user> <minutes>` | Timeout a member for specified duration |
| `/warn <issue/list/clear> <user>` | Issue, view, or clear warnings |
| `/purge <amount>` | Bulk delete messages (1-100) |
| `/slowmode <seconds>` | Set channel slowmode |
| `/lock` / `/unlock` | Lock or unlock a channel |
| `/nickname <user> [name]` | Change or reset member nickname |
| `/security` | Configure auto-mod: anti-spam, anti-invite, bad words |

### 🎮 Games (5 commands)

| Command | Description |
|---------|-------------|
| `/tictactoe [opponent]` | 3×3 TicTacToe — play vs a friend or AI with minimax |
| `/connectfour [opponent]` | 7×6 Connect Four with alpha-beta pruning AI |
| `/rps [opponent]` | Rock Paper Scissors with interactive buttons |
| `/memory` | 4×4 emoji card flip matching game |
| `/guessnumber` | Guess a number 1-100 in 7 attempts |

### 🔧 Utility (12 commands)

| Command | Description |
|---------|-------------|
| `/sticker <query>` | Search animated stickers (Waifu.pics + Giphy + Klipy) |
| `/afk [reason]` | Set AFK status with auto-notify on mention |
| `/ping` | Bot latency & WebSocket heartbeat |
| `/uptime` | Bot uptime since last restart |
| `/user [member]` | User info card with roles & join date |
| `/serverinfo` | Server statistics & info embed |
| `/poll <question>` | Create a reaction poll |
| `/reminder <time> <message>` | Set a timed reminder |
| `/calc <expression>` | Math calculator |
| `/roll [sides]` | Roll a dice |
| `/password [length]` | Generate a secure random password |
| `/timestamp <date>` | Convert a date to Discord timestamp format |

### ⌨️ Prefix Commands

All moderation & utility commands also work with prefixes: `?`, `!`, `$`, `&`

```
?ping  !avatar  $userinfo  &serverinfo  ?afk  !help
?warn  !kick   $ban       &timeout      ?purge
```

### ⚙️ Server Config

| Command | Description |
|---------|-------------|
| `/config` | Welcome/goodbye messages, auto-role, log channel setup |

---

## 🏗️ Architecture

```
Velu/
├── index.ts                    # Bootstrap & Discord Gateway login
├── Dockerfile                  # Multi-stage Docker build (Node 22 Alpine)
├── render.yaml                 # Render deployment config
├── src/
│   ├── api/server.ts           # Express API + /healthz + self-ping keep-alive
│   ├── config/                 # Zod-validated environment config
│   ├── constants/              # Theme colors, limits, branding
│   ├── types/                  # TypeScript interfaces
│   ├── ui/factory.ts           # Centralized embed builder (UIFactory)
│   ├── state/
│   │   ├── db.ts               # In-memory DB with Supabase sync
│   │   ├── manager.ts          # Stateless component ID encoder/decoder
│   │   └── supabase.ts         # Supabase client initialization
│   ├── services/
│   │   ├── music.ts            # discord-player wrapper, search, autoplay
│   │   └── klipy.ts            # Multi-provider GIF/sticker fetcher
│   ├── utils/
│   │   ├── middleware.ts       # safeReply, safeDefer, permission checks
│   │   ├── permissionManager.ts # Role hierarchy & authorization
│   │   ├── logger.ts           # Structured logging
│   │   └── scanner.ts          # Directory scanner for auto-loading
│   ├── handlers/prefix.ts      # Multi-prefix command router
│   ├── loaders/                # Auto-loaders for commands, events, components
│   ├── events/                 # messageCreate, ready, guildMemberAdd, etc.
│   └── interactions/
│       ├── router.ts           # Central interaction dispatcher
│       ├── commands/           # 37 slash commands across 5 categories
│       └── components/         # Button/select menu handlers (music, games)
```

### Key Design Decisions

- **Stateless Component Router** — Button/select custom IDs encode state inline (`namespace:action|i:<json>`) or fall back to a TTL-bounded memory store. No database needed for interactive components.
- **Multi-Engine Parallel Search** — YouTube, Spotify & Auto search engines race simultaneously with a 2-second timeout. First results win.
- **Parallel Sticker Providers** — Waifu.pics, Giphy & Klipy all race via `Promise.allSettled`. Cached for 10 minutes with variety rotation.
- **O(n) Levenshtein with Early Exit** — Single-row optimization with row-min early termination for typo-tolerant music search.
- **Self-Ping Keep-Alive** — 8-minute interval pings the `/healthz` endpoint to prevent Render free-tier sleep.
- **Supabase with Graceful Fallback** — 400ms connection race; if Supabase is unreachable, bot starts instantly with in-memory-only storage.

---

## 🐳 Deployment

### Render (Recommended)

1. Push to GitHub
2. Connect repo to [Render](https://render.com)
3. Render auto-detects the `Dockerfile` and deploys
4. Set environment variables in Render dashboard

### Docker (Manual)

```bash
docker build -t velu-bot .
docker run -d --env-file .env velu-bot
```

### DisCloud

Uses the included `discloud.config` — just upload the repo.

---

## 📝 Adding a New Command

Create a file in `src/interactions/commands/<category>/name.ts`:

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Utility';

export const data = new SlashCommandBuilder()
  .setName('hello')
  .setDescription('Say hello!');

export async function execute(interaction: ChatInputCommandInteraction) {
  await middleware.safeReply(interaction, {
    embeds: [UIFactory.success('Hello!', 'Welcome to Velu! 🌸')]
  });
}
```

It auto-loads on next restart — no registration code needed.

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT — Free to use, modify, and distribute.

---

<div align="center">

**Built with ❤️ by [Rudra](https://github.com/Rudra4451)**

</div>
