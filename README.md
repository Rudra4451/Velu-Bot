# Velu — Premium Discord Bot

Velu is a robust, modular, and extremely lightweight Discord bot designed to serve as a premium replacement for standard multi-purpose bots. It features zero-configuration local JSON storage (no external database required), a stunning UI system built into its core, and extensive features for Moderation, Music, Utilities, and Games.

## 🚀 Features

- **No External Database Required:** Uses blazing-fast, robust local `.json` file storage with debounce and caching.
- **Premium UI:** Powered by a customized `UIFactory` ensuring beautiful embeds, modals, and buttons across all commands.
- **Advanced Moderation:** Comprehensive warning system, auto-moderation (spam, bad words, invite blocking), and case management.
- **Stateless Systems:** Complete support for Tickets, Suggestions, Starboards, and Reaction Roles without relying on bloated state tracking.
- **High-Quality Music:** Uses `@discordjs/voice` and `play-dl` for robust, high-fidelity audio playback.

## 🛠️ Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Rudra4451/Velu-Bot.git
   cd Velu-Bot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Rename `.env.example` to `.env` and fill in your keys:
   ```env
   TOKEN=your_bot_token
   CLIENT_ID=your_client_id
   DEV_GUILD_ID=your_guild_id
   ```

4. **Build the project (Optional but recommended):**
   ```bash
   npm run build
   ```

5. **Deploy Slash Commands:**
   ```bash
   npm run deploy
   ```

6. **Start the Bot:**
   ```bash
   npm start
   ```
   *(For development mode with hot-reloading: `npm run dev`)*

## 📚 Folder Structure

Velu follows a strictly modular architecture under `src/features/`.

```
src/
├── api/             # Built-in REST API (optional)
├── core/            # Core systems (Command Handler, State Manager)
├── events/          # Discord.js Event Listeners
├── features/        # Modular Bot Features (The Core)
│   ├── configuration/
│   ├── games/
│   ├── moderation/
│   ├── music/
│   ├── reactionRoles/
│   ├── starboard/
│   ├── suggestions/
│   ├── tickets/
│   └── utility/
├── storage/         # Generic JSON Persistence Layer
├── types/           # Global TypeScript Definitions
├── ui/              # UIFactory for Premium Embeds
└── utils/           # Helper utilities, logger, and middleware
```

## 🧪 Testing

Velu uses **Vitest** for its test suite.

Run tests using:
```bash
npx vitest run
```

## 🛡️ Architecture & Constraints

Velu was completely redesigned to guarantee absolute reliability without relying on complex external services. **It does not use MongoDB, Redis, PostgreSQL, or SQLite.** All state is stored locally or handled statelessly, drastically improving speed, decreasing memory footprint, and making deployment as simple as cloning and running `npm start`.

---
*Built with ❤️ using TypeScript and Discord.js.*
