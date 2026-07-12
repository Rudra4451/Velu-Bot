import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { stateManager } from '../../../state/manager.js';
import { middleware } from '../../../utils/middleware.js';
import { serializeUser, mentionUser, displayUser } from '../../../utils/userSerializer.js';
import { GAMES } from '../../../constants/index.js';

export const data = new SlashCommandBuilder()
  .setName('tictactoe')
  .setDescription('Play Tic Tac Toe against another user or the bot.')
  .addUserOption(option =>
    option.setName('opponent')
      .setDescription('The user to challenge (leave empty to play against the bot).')
      .setRequired(false)
  );

export async function execute(interaction) {
  const opponent = interaction.options.getUser('opponent') || interaction.client.user;
  const isBot = opponent.id === interaction.client.user.id;

  if (opponent.id === interaction.user.id) {
    const errEmbed = UIFactory.warning('Invalid Opponent', 'You cannot play Tic Tac Toe against yourself.');
    return middleware.safeReply(interaction, { embeds: [errEmbed], ephemeral: true });
  }

  const game = {
    p1: serializeUser(interaction.user), // ❌ X
    p2: serializeUser(opponent),          // ⭕ O
    isBot,
    board: Array(9).fill(null),
    turn: 'p1',
    status: 'playing',
    winner: null, // 'p1' | 'p2' | 'draw'
  };

  const masterId = stateManager.create('game', 'ttt_master', game);
  const refKey = masterId.split('|')[1];

  const rows = buildTttRows(game, refKey);
  const embed = renderTttEmbed(game);
  await middleware.safeReply(interaction, { embeds: [embed], components: rows });
}

export function buildTttRows(game, refKey) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      const cell = game.board[idx];
      const disabled = game.status === 'finished' || cell !== null;

      let label = '·';
      let style = ButtonStyle.Secondary;
      if (cell === 'X') { label = '✕'; style = ButtonStyle.Danger; }
      if (cell === 'O') { label = '○'; style = ButtonStyle.Success; }

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(stateManager.create('game', 'ttt', { ref: refKey, idx }))
          .setLabel(label)
          .setStyle(style)
          .setDisabled(disabled)
      );
    }
    rows.push(row);
  }
  return rows;
}

export function renderTttEmbed(game) {
  if (game.status === 'finished') {
    if (game.winner === 'draw') {
      return UIFactory.warning(
        'Tic Tac Toe — Draw!',
        `It's a draw between ${mentionUser(game.p1)} and ${mentionUser(game.p2)}!`
      );
    }
    const winner = game.winner === 'p1' ? game.p1 : game.p2;
    return UIFactory.success(
      'Tic Tac Toe — Game Over',
      `🎉 ${displayUser(winner)} wins!`
    );
  }

  const current = game.turn === 'p1' ? game.p1 : game.p2;
  const symbol = game.turn === 'p1' ? '✕' : '○';
  return UIFactory.premium(
    '🎮 Tic Tac Toe',
    `**Challenger (✕):** ${mentionUser(game.p1)}\n**Opponent (○):** ${mentionUser(game.p2)}\n\nIt is ${mentionUser(current)}'s turn (${symbol})!`
  );
}

/** Check if the board has a winning line using shared constant. */
export function checkTttWin(board) {
  return GAMES.TTT_LINES.some(([a, b, c]) =>
    board[a] !== null && board[a] === board[b] && board[a] === board[c]
  );
}
