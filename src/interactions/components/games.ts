import type { ComponentHandler } from '../../types/index.js';
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { stateManager } from '../../state/manager.js';
import { UIFactory } from '../../ui/factory.js';
import { middleware } from '../../utils/middleware.js';
import { mentionUser } from '../../utils/userSerializer.js';

import { renderRpsEmbed } from '../commands/games/rps.js';
import { buildTttRows, renderTttEmbed, checkTttWin } from '../commands/games/tictactoe.js';
import { renderGuessEmbed } from '../commands/games/guessnumber.js';
import { buildC4Menu, renderC4Embed, dropChecker, checkC4Win } from '../commands/games/connectfour.js';
import { buildMemoryRows, renderMemoryEmbed } from '../commands/games/memory.js';

// ─── Tic Tac Toe Minimax Bot ───────────────────────────────────────────
function getBestMove(board: any, botSymbol: any, playerSymbol: any) {
  const TTT_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  const checkWin = (b: any, symbol: any) => {
    return TTT_LINES.some(([a, bIndex, c]) => b[a] === symbol && b[bIndex] === symbol && b[c] === symbol);
  };

  const isFull = (b: any) => b.every((c: any) => c !== null);

  const minimax = (b: any, depth: any, isMaximizing: any) => {
    if (checkWin(b, botSymbol)) return 10 - depth;
    if (checkWin(b, playerSymbol)) return depth - 10;
    if (isFull(b)) return 0;

    if (isMaximizing) {
      let bestScore = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (b[i] === null) {
          b[i] = botSymbol;
          const score = minimax(b, depth + 1, false);
          b[i] = null;
          bestScore = Math.max(score, bestScore);
        }
      }
      return bestScore;
    } else {
      let bestScore = Infinity;
      for (let i = 0; i < 9; i++) {
        if (b[i] === null) {
          b[i] = playerSymbol;
          const score = minimax(b, depth + 1, true);
          b[i] = null;
          bestScore = Math.min(score, bestScore);
        }
      }
      return bestScore;
    }
  };

  let bestScore = -Infinity;
  let move = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = botSymbol;
      const score = minimax(board, 0, false);
      board[i] = null;
      if (score > bestScore) {
        bestScore = score;
        move = i;
      }
    }
  }
  return move;
}

// ─── Connect Four AI Heuristics ─────────────────────────────────────────
function dropCheckerSimulate(board: any, col: any, player: any) {
  const temp = [...board];
  for (let r = 5; r >= 0; r--) {
    const idx = r * 7 + col;
    if (temp[idx] === null) {
      temp[idx] = player;
      return temp;
    }
  }
  return null;
}

function evaluateC4Window(window: any[], piece: any) {
  let score = 0;
  const oppPiece = piece === 'p2' ? 'p1' : 'p2';
  let pieceCount = 0;
  let emptyCount = 0;
  let oppCount = 0;

  for (const cell of window) {
    if (cell === piece) pieceCount++;
    else if (cell === oppPiece) oppCount++;
    else emptyCount++;
  }

  if (pieceCount === 4) score += 1000;
  else if (pieceCount === 3 && emptyCount === 1) score += 10;
  else if (pieceCount === 2 && emptyCount === 2) score += 4;

  if (oppCount === 3 && emptyCount === 1) score -= 80;

  return score;
}

function evaluateC4Board(board: any[], piece: any) {
  let score = 0;
  
  // Center column preference
  const centerArray = [];
  for (let r = 0; r < 6; r++) centerArray.push(board[r * 7 + 3]);
  const centerCount = centerArray.filter(c => c === piece).length;
  score += centerCount * 6;

  // Horizontal
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const window = [board[r*7+c], board[r*7+c+1], board[r*7+c+2], board[r*7+c+3]];
      score += evaluateC4Window(window, piece);
    }
  }
  // Vertical
  for (let c = 0; c < 7; c++) {
    for (let r = 0; r < 3; r++) {
      const window = [board[r*7+c], board[(r+1)*7+c], board[(r+2)*7+c], board[(r+3)*7+c]];
      score += evaluateC4Window(window, piece);
    }
  }
  // Positive Diagonal
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const window = [board[r*7+c], board[(r+1)*7+c+1], board[(r+2)*7+c+2], board[(r+3)*7+c+3]];
      score += evaluateC4Window(window, piece);
    }
  }
  // Negative Diagonal
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const window = [board[(r+3)*7+c], board[(r+2)*7+c+1], board[(r+1)*7+c+2], board[r*7+c+3]];
      score += evaluateC4Window(window, piece);
    }
  }
  return score;
}

function isTerminalNode(board: any[]) {
  return checkC4Win(board) || board.every(c => c !== null);
}

function minimaxC4(board: any[], depth: number, alpha: number, beta: number, isMaximizing: boolean) {
  const validLocations = [];
  for (let c = 0; c < 7; c++) if (board[c] === null) validLocations.push(c);
  
  const isTerminal = isTerminalNode(board);
  if (depth === 0 || isTerminal) {
    if (isTerminal) {
      if (checkC4Win(board)) {
        return isMaximizing ? -10000000 : 10000000;
      } else {
        return 0; // Draw
      }
    } else {
      return evaluateC4Board(board, 'p2');
    }
  }

  if (isMaximizing) {
    let value = -Infinity;
    for (const col of validLocations) {
      const bCopy = dropCheckerSimulate(board, col, 'p2');
      if (bCopy) {
        const newScore = minimaxC4(bCopy, depth - 1, alpha, beta, false);
        value = Math.max(value, newScore);
        alpha = Math.max(alpha, value);
        if (alpha >= beta) break;
      }
    }
    return value;
  } else {
    let value = Infinity;
    for (const col of validLocations) {
      const bCopy = dropCheckerSimulate(board, col, 'p1');
      if (bCopy) {
        const newScore = minimaxC4(bCopy, depth - 1, alpha, beta, true);
        value = Math.min(value, newScore);
        beta = Math.min(beta, value);
        if (alpha >= beta) break;
      }
    }
    return value;
  }
}

function getBestC4Move(board: any[]) {
  const validLocations = [];
  for (let c = 0; c < 7; c++) if (board[c] === null) validLocations.push(c);
  if (validLocations.length === 0) return -1;
  
  // 1-move win check for instantaneous response
  for (const col of validLocations) {
    const simulated = dropCheckerSimulate(board, col, 'p2');
    if (simulated && checkC4Win(simulated)) return col;
  }
  // 1-move block check
  for (const col of validLocations) {
    const simulated = dropCheckerSimulate(board, col, 'p1');
    if (simulated && checkC4Win(simulated)) return col;
  }

  let bestScore = -Infinity;
  let bestCol = validLocations[Math.floor(Math.random() * validLocations.length)];
  
  for (const col of validLocations) {
    const bCopy = dropCheckerSimulate(board, col, 'p2');
    if (bCopy) {
      const score = minimaxC4(bCopy, 4, -Infinity, Infinity, false);
      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }
  }
  return bestCol;
}

export const namespace = 'game';

export const execute: ComponentHandler['execute'] = (async (interaction: any, context: any) => {
  const { action, data } = context;
  const { ref } = (data as any) ?? {};

  // ── Modal: Guess Number ─────────────────────────────────────────────────────
  if (interaction.isModalSubmit() && action === 'guess_modal') {
    if (!ref) return interaction.reply({ content: 'Invalid state reference.', ephemeral: true });

    const resolved = stateManager.resolve(`game:guess_master|${ref}`);
    if (resolved.expired || !resolved.data) {
      return interaction.reply({ embeds: [UIFactory.warning('Session Expired', 'This game has expired.')], ephemeral: true });
    }

    const game = resolved.data as any;

    if (interaction.user.id !== game.player.id) {
      return interaction.reply({ content: 'This game is not yours!', ephemeral: true });
    }

    const guessStr = interaction.fields.getTextInputValue('guess_input').trim();
    const guess = parseInt(guessStr, 10);

    if (isNaN(guess) || guess < 1 || guess > 100) {
      game.hint = '⚠️ Invalid input. Enter a whole number between **1** and **100**.';
    } else {
      game.attempts++;
      if (guess === game.target) {
        game.status = 'won';
      } else {
        game.hint = guess < game.target
          ? `📈 Go **higher** than **${guess}**!`
          : `📉 Go **lower** than **${guess}**!`;
      }
    }

    if (game.attempts >= game.maxAttempts && game.status === 'playing') {
      game.status = 'lost';
    }

    const embed = renderGuessEmbed(game);
    const components = game.status === 'playing' ? (interaction as any).message.components : [];
    await (interaction as any).update({ embeds: [embed], components });
    return;
  }

  // ── Resolve master state for all button/select interactions ─────────────────
  if (!ref) {
    return middleware.safeReply(interaction, {
      embeds: [UIFactory.error('Invalid Interaction', 'Missing state reference.')],
      ephemeral: true,
    });
  }

  const masterCustomId = `game:${action}_master|${ref}`;
  const resolved = stateManager.resolve(masterCustomId);

  if (resolved.expired || !resolved.data) {
    return middleware.safeReply(interaction, {
      embeds: [UIFactory.warning('Session Expired', 'This game session has expired. Start a new game with the command.')],
      components: [],
      ephemeral: true,
    });
  }

  const game = resolved.data as any;

  // ── Rock Paper Scissors ─────────────────────────────────────────────────────
  if (action === 'rps') {
    const { choice } = (data as any) ?? {};
    const isP1 = interaction.user.id === game.p1.id;
    const isP2 = interaction.user.id === game.p2.id;

    if (!isP1 && !isP2) {
      return interaction.reply({ content: 'You are not a player in this game.', ephemeral: true });
    }

    // Prevent changing choice
    if (isP1 && game.p1Choice) return interaction.reply({ content: 'You already made your choice!', ephemeral: true });
    if (isP2 && game.p2Choice) return interaction.reply({ content: 'You already made your choice!', ephemeral: true });

    if (isP1) game.p1Choice = choice;
    if (isP2) game.p2Choice = choice;

    // Bot picks instantly
    if (game.isBot && isP1) {
      const moves = ['rock', 'paper', 'scissors'];
      game.p2Choice = moves[Math.floor(Math.random() * moves.length)];
    }

    if (game.p1Choice && game.p2Choice) {
      game.status = 'finished';
      if (game.p1Choice === game.p2Choice) {
        game.winner = 'draw';
      } else if (
        (game.p1Choice === 'rock' && game.p2Choice === 'scissors') ||
        (game.p1Choice === 'paper' && game.p2Choice === 'rock') ||
        (game.p1Choice === 'scissors' && game.p2Choice === 'paper')
      ) {
        game.winner = 'p1';
      } else {
        game.winner = 'p2';
      }
    } else {
      game.status = 'playing';
    }

    const embed = renderRpsEmbed(game);
    const components = game.status === 'finished' ? [] : (interaction as any).message.components;
    await (interaction as any).update({ embeds: [embed], components });
    return;
  }

  // ── Tic Tac Toe ─────────────────────────────────────────────────────────────
  if (action === 'ttt') {
    const { idx } = (data as any) ?? {};
    const isP1Turn = game.turn === 'p1';
    const activePlayer = isP1Turn ? game.p1 : game.p2;

    if (interaction.user.id !== activePlayer.id) {
      return interaction.reply({
        content: `It is not your turn! Waiting for ${mentionUser(activePlayer)}.`,
        ephemeral: true,
      });
    }

    if (game.board[idx] !== null) {
      return interaction.reply({ content: 'That cell is already taken!', ephemeral: true });
    }

    game.board[idx] = isP1Turn ? 'X' : 'O';

    if (checkTttWin(game.board)) {
      game.status = 'finished';
      game.winner = game.turn;
    } else if (game.board.every((c: any) => c !== null)) {
      game.status = 'finished';
      game.winner = 'draw';
    } else {
      game.turn = isP1Turn ? 'p2' : 'p1';

      // Bot move
      if (game.isBot && game.turn === 'p2') {
        const botIdx = getBestMove(game.board, 'O', 'X');
        if (botIdx !== -1) {
          game.board[botIdx] = 'O';
          if (checkTttWin(game.board)) {
            game.status = 'finished'; game.winner = 'p2';
          } else if (game.board.every((c: any) => c !== null)) {
            game.status = 'finished'; game.winner = 'draw';
          } else {
            game.turn = 'p1';
          }
        }
      }
    }

    const rows = buildTttRows(game, ref);
    const embed = renderTttEmbed(game);
    await (interaction as any).update({ embeds: [embed], components: game.status === 'finished' ? [] : rows });
    return;
  }

  // ── Guess Number Button (shows modal) ───────────────────────────────────────
  if (action === 'guess_btn') {
    if (interaction.user.id !== game.player.id) {
      return interaction.reply({ content: 'This game belongs to someone else!', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(stateManager.create('game', 'guess_modal', { ref }))
      .setTitle('Guess the Number');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('guess_input')
          .setLabel('Your guess (1 – 100)')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(3)
          .setRequired(true)
      )
    );

    await (interaction as any).showModal(modal);
    return;
  }

  // ── Connect Four ─────────────────────────────────────────────────────────────
  if (action === 'c4') {
    const col = parseInt((interaction as any).values[0], 10);
    const isP1Turn = game.turn === 'p1';
    const activePlayer = isP1Turn ? game.p1 : game.p2;

    if (interaction.user.id !== activePlayer.id) {
      return interaction.reply({
        content: `It is not your turn! Waiting for ${mentionUser(activePlayer)}.`,
        ephemeral: true,
      });
    }

    const dropped = dropChecker(game.board, col, game.turn);
    if (dropped === -1) {
      return interaction.reply({ content: 'That column is full! Choose another.', ephemeral: true });
    }

    if (checkC4Win(game.board)) {
      game.status = 'finished'; game.winner = game.turn;
    } else if (game.board.every((c: any) => c !== null)) {
      game.status = 'finished'; game.winner = 'draw';
    } else {
      game.turn = isP1Turn ? 'p2' : 'p1';

      if (game.isBot && game.turn === 'p2') {
        const botCol = getBestC4Move(game.board);
        if (botCol !== -1) {
          dropChecker(game.board, botCol, 'p2');
          if (checkC4Win(game.board)) {
            game.status = 'finished'; game.winner = 'p2';
          } else if (game.board.every((c: any) => c !== null)) {
            game.status = 'finished'; game.winner = 'draw';
          } else {
            game.turn = 'p1';
          }
        }
      }
    }

    const menuRow = buildC4Menu(game, ref);
    const embed = renderC4Embed(game);
    await (interaction as any).update({ embeds: [embed], components: menuRow ? [menuRow] : [] });
    return;
  }

  // ── Memory Match ─────────────────────────────────────────────────────────────
  if (action === 'memory') {
    const { idx } = (data as any) ?? {};

    if (interaction.user.id !== game.player.id) {
      return interaction.reply({ content: 'This Memory Match game belongs to someone else!', ephemeral: true });
    }

    // If 2 are already face-up and unmatched, start a new pair selection
    if (game.selected.length === 2) {
      game.selected = [idx];
    } else {
      game.selected.push(idx);
    }

    if (game.selected.length === 2) {
      game.attempts++;
      const [first, second] = game.selected;
      if (game.deck[first] === game.deck[second]) {
        // Match!
        game.revealed[first] = true;
        game.revealed[second] = true;
        game.matched++;
        game.selected = [];
        if (game.matched === 8) game.status = 'finished';
      }
      
      if (game.status === 'playing' && game.attempts >= game.maxAttempts) {
        game.status = 'lost';
      }
    }

    const rows = buildMemoryRows(game, ref);
    const embed = renderMemoryEmbed(game);
    await (interaction as any).update({ embeds: [embed], components: (game.status === 'finished' || game.status === 'lost') ? [] : rows });
    return;
  }
}) as any;
