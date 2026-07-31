# ✦ Velu — Premium Music & Security Discord Bot

Velu is a high-performance, studio-grade Discord bot built with **Node.js** and **discord.js v14**. It features a modern **Music Engine**, an automated **Security & Moderation Suite**, **Zero-Database Mini-Games**, and **Multi-Prefix Support**.

---

## ✨ Features Highlight

- 🎵 **Studio-Grade Music Engine**: Powered by WebAssembly (`@evan/opus` 48kHz stereo), live slash autocomplete, multi-source search dropdowns (YouTube, Spotify, SoundCloud), related track **Autoplay**, and dynamic playback control cards.
- 🔒 **Voice Channel Protection**: Strict permission guards ensuring only users connected to the bot's voice channel can control playback.
- 🛡️ **Security & Moderation Suite**: Anti-Spam rate-limiting, Anti-Invite link blocking, Bad Word filter, warning system with escalation, and audit logging (`/security`).
- 🎯 **Multi-Prefix Chat Commands**: Works with `?`, `!`, `$`, `&` or custom prefixes in `.env` for ultra-fast chat controls.
- 🌸 **Klipy Stickers & Reaction GIFs**: Search animated stickers with `/sticker` and automated reaction GIFs for moderation actions (`/ban`, `/kick`, `/timeout`, `/afk`).
- 🎮 **Zero-Persistence Mini-Games**: Play TicTacToe, ConnectFour, RPS, Memory Card Matching, and Guess the Number without database requirements.

---

## ⚙️ Requirements

- **Node.js ≥ 18.0.0** (Native `fetch` & ESM support)
- Discord Bot Token & Application ID ([Discord Developer Portal](https://discord.com/developers/applications))
- Optional: Klipy API Key for animated stickers ([Klipy.com](https://klipy.com/))

---

## 🚀 Quick Setup

1. **Clone & Install Dependencies**
   ```bash
   git clone https://github.com/Rudra4451/Velu-Bot.git
   cd Velu-Bot
   npm install
   ```

2. **Environment Configuration**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Configure `.env` keys:
   ```ini
   DISCORD_TOKEN=your_bot_token_here
   DISCORD_CLIENT_ID=your_application_id_here
   DISCORD_GUILD_ID=your_test_guild_id_here  # Optional: for instant slash command registration

   # Multiple prefixes for chat commands (comma-separated)
   BOT_PREFIX=?
   BOT_PREFIXES=?,!,$,&

   # Optional: Klipy API Key for animated stickers & GIFs
   KLIPY_API_KEY=your_klipy_api_key_here

   LOG_LEVEL=info
   ```

3. **Deploy Slash Commands**
   ```bash
   npm run deploy
   ```

4. **Start the Bot**
   ```bash
   npm run dev      # Development with live-reload
   # or
   npm start        # Production start
   ```

---

## 🎮 Commands Summary

### 🎵 Music Engine Commands
| Command | Description |
|---|---|
| `/play <query>` | Live autocomplete & multi-source search (YouTube, Spotify, SoundCloud) |
| `/nowplaying` | Displays active song card with live progress bar and control buttons |
| `/queue` | Shows upcoming song queue & total duration |
| `/skip` | Skips to the next track in queue |
| `/stop` | Disconnects bot and clears queue |
| `/volume [0-100]` | Adjusts playback volume |
| `/loop` | Toggles loop mode: `Off` ➔ `Track` ➔ `Queue` ➔ `Autoplay` |
| `/autoplay` | Toggles automatic queuing of related tracks when queue ends |
| `/shuffle` | Randomly shuffles queue order |

### 🛡️ Security & Moderation
| Command | Description |
|---|---|
| `/security <status/automod/antispam/antiinvite/badwords>` | Manage Auto-Mod master switch & filters |
| `/ban add/remove` | Ban/unban users with message deletion history & Klipy GIFs |
| `/kick <target>` | Kick member from server with animated reaction |
| `/timeout <target> <duration>` | Mute/timeout member for specified minutes |
| `/warn issue/list/clear` | Issue, view, or clear member warnings |
| `/purge <amount>` | Bulk delete messages in channel |
| `/slowmode <seconds>` | Configure channel rate-limiting |
| `/lock` / `/unlock` | Restrict or restore channel messaging permissions |
| `/nickname <user> [nick]` | Change or reset member nickname |

### ⌨️ Multi-Prefix Commands (`?`, `!`, `$`, `&`)
Run text commands directly in chat using any active prefix:
- **Utility**: `?ping`, `!avatar`, `$userinfo`, `&serverinfo`, `?afk [reason]`, `!help`
- **Moderation**: `?warn`, `!warnings`, `$clearwarnings`, `&kick`, `?ban`, `!unban`, `$timeout`, `&untimeout`, `?purge`, `!slowmode`, `$lock`, `&unlock`, `?nickname`

### 🎮 Zero-Persistence Mini-Games
- `/tictactoe [opponent]` — Play 3×3 Tic-Tac-Toe vs user or AI
- `/connectfour [opponent]` — Interactive 7×6 ConnectFour board
- `/rps [opponent]` — Rock, Paper, Scissors with interactive buttons
- `/memory` — 4×4 Card-flip Emoji Memory Matching Game
- `/guessnumber` — Number guessing game (1–100) in 7 attempts

---

## 🏗️ Architecture

- **Stateless Component Router**: Component custom IDs pack state inline (`namespace:action|i:<json>`) or fallback to a TTL-bounded in-memory store.
- **Audio Pipeline**: Pure WebAssembly Opus codec via `@evan/opus` avoiding Windows C++ binary execution blocks.
- **Resilient Database Fallback**: Fast 1.5-second connection race for Supabase, gracefully degrading to zero-DB in-memory operations if offline.

---

## 📄 License

MIT — Feel free to customize and use!
