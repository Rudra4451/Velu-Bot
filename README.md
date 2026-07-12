# ✦ Velu — Premium Zero-Persistence Discord Bot

Velu is a modern, cinematic Discord bot built with Node.js and **discord.js v14**. It follows a strict **Zero-Persistence Architecture** — database-free, stateless by design, event-driven, and production-ready.

---

## ⚙️ Requirements

- **Node.js ≥ 18.0.0** (for native `fetch` and `structuredClone`)
- A Discord application with Bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- Optional: A free [Klipy API key](https://klipy.com/) for animated social GIFs

---

## 🚀 Setup

1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/yourname/velu-bot.git
   cd velu-bot
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Fill in your `.env`:
   ```ini
   DISCORD_TOKEN=your_bot_token_here
   DISCORD_CLIENT_ID=your_application_id_here

   # Fast registration during development (removes ~1h global propagation delay)
   DISCORD_GUILD_ID=your_test_server_id_here

   # Optional — enables live GIF fetching for social commands
   KLIPY_API_KEY=your_klipy_api_key_here

   # Prefix for text-based commands (default: ?)
   BOT_PREFIX=?

   LOG_LEVEL=info   # debug | info | warn | error
   ```

3. **Register slash commands**
   ```bash
   npm run deploy
   ```
   > Run this once after any command changes. Guild commands update instantly; global commands take up to 1 hour.

4. **Start the bot**
   ```bash
   npm start
   ```

---

## 🗂️ Project Structure

```
velu-bot/
├── index.js                        # Entry point — bootstrap & graceful shutdown
├── .env.example                    # Environment variable template
├── package.json
└── src/
    ├── config/index.js             # Validated configuration via Zod
    ├── constants/
    │   ├── index.js                # Global limits and game constants
    │   └── theme.js                # Colors, icons, footer branding
    ├── events/
    │   ├── loader.js               # Dynamic event registration
    │   ├── ready.js                # ClientReady handler
    │   └── interactionCreate.js    # Routes all interactions to the router
    ├── handlers/
    │   └── prefix.js               # Text-based prefix command handler
    ├── interactions/
    │   ├── router.js               # Central interaction router (commands, components, modals, autocomplete)
    │   ├── commands/
    │   │   ├── utility/            # ping, avatar, banner, userinfo, serverinfo, calc, choose,
    │   │   │                       #   coinflip, dice, password, timestamp, reminder, poll, uptime, afk
    │   │   ├── social/             # hug, pat, slap, kiss, cuddle, bite, poke, highfive,
    │   │   │                       #   wave, cry, laugh, blush, dance, ship
    │   │   ├── games/              # rps, tictactoe, guessnumber, connectfour, memory
    │   │   ├── config/             # welcome, goodbye, logs, config, permissions
    │   │   └── moderation/         # warn, warnings, clearwarnings, kick, ban, unban, timeout, untimeout, purge, slowmode, lock, unlock, nickname
    │   └── components/
    │       ├── utility.js          # Poll button vote handler
    │       ├── games.js            # All game interaction handlers
    │       └── roles.js            # Self-assign roles component handler
    ├── loaders/
    │   ├── commands.js             # Slash command file scanner + REST registration
    │   └── components.js           # Component handler file scanner
    ├── scripts/
    │   └── deploy.js               # Standalone command deployment (npm run deploy)
    ├── services/
    │   └── klipy.js                # Klipy GIF API client with caching & fallback
    ├── state/
    │   ├── db.js                   # In-memory store for server configs, logs, AFK, warnings
    │   └── manager.js              # Zero-Persistence state manager (inline + TTL memory)
    ├── ui/
    │   └── factory.js              # Standardized embed builder (success, error, warning, info, premium)
    └── utils/
        ├── actionLogger.js         # Logging system dispatcher
        ├── logger.js               # Colorized structured logger
        ├── middleware.js           # safeReply, safeDefer, checkPermissions
        ├── permissionManager.js    # Centralized hierarchy and authorization rules
        ├── scanner.js              # Recursive file discovery utility
        ├── socialHelper.js         # Shared social command builder and executor
        ├── userSerializer.js       # Safe Discord User → plain-object converter
        └── validator.js            # Input validation helpers
```

---

## 🎮 Commands

### ⚙️ Utility
| Command | Description |
|---|---|
| `/ping` | Gateway and bot latency |
| `/avatar [user]` | Full-resolution avatar |
| `/banner [user]` | User profile banner |
| `/userinfo [user]` | Detailed member card |
| `/serverinfo` | Server metadata |
| `/calc <expression>` | Safe arithmetic calculator |
| `/choose <options>` | Random choice selector |
| `/coinflip` | Heads or tails |
| `/dice [sides] [count]` | Polyhedral dice roller |
| `/password [length] [flags]` | Cryptographically secure password (ephemeral) |
| `/timestamp <offset> <unit> [format]` | Discord markdown timestamp generator |
| `/reminder <duration> <unit> <message>` | In-memory reminder (DM or channel fallback) |
| `/poll <question> <choices>` | Interactive button-voting poll |
| `/uptime` | Bot uptime display |
| `/afk [reason]` | Set Away From Keyboard status |

### 🛡️ Moderation & Server Settings
| Command | Description |
|---|---|
| `/warn <user> <reason>` | Warn a member (in-memory) |
| `/warnings <user>` | View warnings of a member |
| `/clearwarnings <user>` | Clear all warnings of a member |
| `/kick <user> [reason]` | Kick a member |
| `/ban <user> [reason] [delete]` | Ban a user and purge historical messages |
| `/unban <id> [reason]` | Unban a user |
| `/timeout <user> <duration> [reason]` | Restrict user permissions |
| `/untimeout <user> [reason]` | Remove timeout restriction |
| `/purge <amount>` | Bulk delete messages |
| `/slowmode <seconds>` | Configure slowmode rates |
| `/lock [channel]` | Restrict channel writing access |
| `/unlock [channel]` | Unlock a locked channel |
| `/nickname <user> [nick]` | Change member nicknames |
| `/welcome <setup/disable/preview/message/channel>` | Welcome module configurations |
| `/goodbye <setup/disable>` | Goodbye module configurations |
| `/logs <setup/disable/view>` | Audit logs setup |
| `/config <view/welcome/logs/autorole>` | Central config manager |
| `/permissions <add/remove/list>` | Manage custom command/module roles |
| `/role <create/delete/rename/color/hoist/mentionable/add/remove/toggle>` | Manage server roles and roles assignments |
| `/roles <panel create/panel edit/panel delete>` | Self-assign roles interactive panels |

### 💖 Social
`/hug` `/pat` `/slap` `/kiss` `/cuddle` `/bite` `/poke` `/highfive` `/wave` `/cry` `/laugh` `/blush` `/dance` `/ship`

All social commands feature animated Klipy GIFs (requires API key) or curated fallback GIFs.

### 🎮 Interactive Games
| Command | Description |
|---|---|
| `/tictactoe [opponent]` | 3×3 grid — vs bot or user |
| `/rps [opponent]` | Rock, Paper, Scissors — vs bot or user |
| `/connectfour [opponent]` | 7×6 checker board — vs bot or user |
| `/guessnumber` | Guess the hidden number (1–100) in 7 tries |
| `/memory` | 4×4 card-flip matching game |

All games are **Zero-Persistence** — state lives only in Discord component IDs or a TTL-bounded in-memory store.

### ⌨️ Prefix Commands
For users who prefer classic chat commands instead of slash commands, Velu supports a customizable prefix (default: `?`).
- **Available Commands**: `?ping`, `?avatar`, `?userinfo`, `?serverinfo`, `?afk`, `?warn`, `?warnings`, `?clearwarnings`, `?kick`, `?ban`, `?unban`, `?timeout`, `?untimeout`, `?purge`, `?slowmode`, `?lock`, `?unlock`, `?nickname`
- Use `?help` to see the in-chat reference menu.

---

## 🏗️ Architecture

### Zero-Persistence State
State flows through this priority chain:
1. **Inline payload**: `namespace:action|i:<json>` — stored directly in the custom ID (≤ 100 chars)
2. **Memory reference**: `namespace:action|_m:<hex>` — keyed in a TTL Map, auto-expired after 15 minutes, cleaned on every create/resolve call

Commands never know where state lives. They only call `stateManager.create()` and `stateManager.resolve()`.

### Permission Evaluation Flow
All protected commands validate access in the centralized Permission Manager following this precedence:
1. **Bot Owner** ➔ Bypasses all permissions.
2. **Guild Owner** ➔ Bypasses all guild permission restrictions.
3. **Administrator** ➔ Bypasses command restrictions.
4. **Configured Role** ➔ Grants access to specific commands or modules.
5. **Discord Permission** ➔ Fallback checks (e.g., `BanMembers`).
6. **Denied** ➔ Ephemeral error response.

### Interaction Routing
```
Discord Gateway
  └── interactionCreate event
        └── router.handleInteraction()
              ├── isChatInputCommand()  → commands Map → execute()
              ├── isButton() / isAnySelectMenu() / isModalSubmit()
              │     └── stateManager.resolve(customId)
              │           └── components Map (by namespace) → execute()
              └── isAutocomplete()     → command.autocomplete()
```

---

## 🔒 Security

- All user input is validated before processing
- `/calc` uses a strict whitelist regex (`/^[0-9+\-*/().]+$/`) before any evaluation
- Component interactions validate player ownership before processing moves
- Passwords are generated with Node.js `crypto.randomBytes` (CSPRNG)
- No secrets are logged or exposed in error messages

---

## 📄 License

MIT — use freely, attribution appreciated.
