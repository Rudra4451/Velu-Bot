import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { stateManager } from '../../../state/manager.js';
import { middleware } from '../../../utils/middleware.js';
import { serializeUser, mentionUser, displayUser } from '../../../utils/userSerializer.js';

// Board: 6 rows × 7 cols, index = row * 7 + col
const ROWS = 6;
const COLS = 7;

export const data = new SlashCommandBuilder()
  .setName('connectfour')
  .setDescription('Play Connect Four against another user or the bot.')
  .addUserOption(option =>
    option.setName('opponent')
      .setDescription('The user to challenge (leave empty to play against the bot).')
      .setRequired(false)
  );

export async function execute(interaction) {
  const opponent = interaction.options.getUser('opponent') || interaction.client.user;
  const isBot = opponent.id === interaction.client.user.id;

  if (opponent.id === interaction.user.id) {
    const errEmbed = UIFactory.warning('Invalid Opponent', 'You cannot play Connect Four against yourself.');
    return middleware.safeReply(interaction, { embeds: [errEmbed], ephemeral: true });
  }

  const game = {
    p1: serializeUser(interaction.user), // 🔴
    p2: serializeUser(opponent),          // 🟡
    isBot,
    board: Array(ROWS * COLS).fill(null),
    turn: 'p1',
    status: 'playing',
    winner: null, // 'p1' | 'p2' | 'draw'
  };

  const masterId = stateManager.create('game', 'c4_master', game);
  const refKey = masterId.split('|')[1];

  const menuRow = buildC4Menu(game, refKey);
  const embed = renderC4Embed(game);
  await middleware.safeReply(interaction, { embeds: [embed], components: menuRow ? [menuRow] : [] });
}

export function buildC4Menu(game, refKey) {
  if (game.status === 'finished') return null;

  const options = [];
  for (let c = 0; c < COLS; c++) {
    // Column is full if the top cell (row 0) is occupied
    if (game.board[c] === null) {
      options.push({
        label: `Column ${c + 1}`,
        value: String(c),
        description: `Drop your checker in column ${c + 1}`,
      });
    }
  }

  if (options.length === 0) return null;

  const customId = stateManager.create('game', 'c4', { ref: refKey });
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder('Select a column to drop your checker...')
      .addOptions(options)
  );
}

export function renderC4Embed(game) {
  let grid = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = game.board[r * COLS + c];
      grid += cell === 'p1' ? '🔴' : cell === 'p2' ? '🟡' : '⚫';
    }
    grid += '\n';
  }
  grid += '1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣';

  if (game.status === 'finished') {
    if (game.winner === 'draw') {
      return UIFactory.warning(
        'Connect Four — Draw!',
        `⚔️ **Match Result**\n> 🤝 It's a draw between ${mentionUser(game.p1)} and ${mentionUser(game.p2)}!\n\n⬇️ **Final Board**\n${grid}`
      );
    }
    const winner = game.winner === 'p1' ? game.p1 : game.p2;
    const color = game.winner === 'p1' ? '🔴' : '🟡';
    return UIFactory.success(
      'Connect Four — Game Over',
      `⚔️ **Match Result**\n> 🎉 ${displayUser(winner)} (${color}) wins the game!\n\n⬇️ **Final Board**\n${grid}`
    );
  }

  const current = game.turn === 'p1' ? game.p1 : game.p2;
  const color = game.turn === 'p1' ? '🔴' : '🟡';
  const description = [
    `⚔️ **Battle Details**`,
    `> 🔴 \`Player 1:\` ${mentionUser(game.p1)}`,
    `> 🟡 \`Player 2:\` ${mentionUser(game.p2)}`,
    ``,
    `🎲 **Current Status**`,
    `> It is currently ${mentionUser(current)}'s turn (${color})!`,
    `> *Drop your checker using the dropdown below.*`,
    ``,
    `⬇️ **Game Board**`,
    grid
  ].join('\n');

  return UIFactory.premium('Connect Four', description);
}

/** Drop a checker into a column; returns the row index or -1 if full. */
export function dropChecker(board, col, player) {
  for (let r = ROWS - 1; r >= 0; r--) {
    const idx = r * COLS + col;
    if (board[idx] === null) {
      board[idx] = player;
      return r;
    }
  }
  return -1;
}

/** Check if the board contains a winning four-in-a-row. */
export function checkC4Win(board) {
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const i = r * COLS + c;
      if (board[i] && board[i] === board[i + 1] && board[i] === board[i + 2] && board[i] === board[i + 3]) return true;
    }
  }
  // Vertical
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (board[i] && board[i] === board[i + COLS] && board[i] === board[i + 2 * COLS] && board[i] === board[i + 3 * COLS]) return true;
    }
  }
  // Diagonal down-right
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const i = r * COLS + c;
      if (board[i] && board[i] === board[i + COLS + 1] && board[i] === board[i + 2 * (COLS + 1)] && board[i] === board[i + 3 * (COLS + 1)]) return true;
    }
  }
  // Diagonal up-right
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const i = r * COLS + c;
      if (board[i] && board[i] === board[i - COLS + 1] && board[i] === board[i - 2 * (COLS - 1)] && board[i] === board[i - 3 * (COLS - 1)]) return true;
    }
  }
  return false;
}
