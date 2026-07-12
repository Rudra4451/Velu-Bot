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
function getBestMove(board, botSymbol, playerSymbol) {
  const TTT_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  const checkWin = (b, symbol) => {
    return TTT_LINES.some(([a, bIndex, c]) => b[a] === symbol && b[bIndex] === symbol && b[c] === symbol);
  };

  const isFull = (b) => b.every(c => c !== null);

  const minimax = (b, depth, isMaximizing) => {
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

export const namespace = 'game';

export async function execute(interaction, context) {
  const { action, data } = context;
  const { ref } = data ?? {};

  // ── Modal: Guess Number ─────────────────────────────────────────────────────
  if (interaction.isModalSubmit() && action === 'guess_modal') {
    if (!ref) return interaction.reply({ content: 'Invalid state reference.', ephemeral: true });

    const resolved = stateManager.resolve(`game:guess_master|${ref}`);
    if (resolved.expired || !resolved.data) {
      return interaction.reply({ embeds: [UIFactory.warning('Session Expired', 'This game has expired.')], ephemeral: true });
    }

    const game = resolved.data;

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
    const components = game.status === 'playing' ? interaction.message.components : [];
    await interaction.update({ embeds: [embed], components });
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

  const game = resolved.data;

  // ── Rock Paper Scissors ─────────────────────────────────────────────────────
  if (action === 'rps') {
    const { choice } = data;
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
    const components = game.status === 'finished' ? [] : interaction.message.components;
    await interaction.update({ embeds: [embed], components });
    return;
  }

  // ── Tic Tac Toe ─────────────────────────────────────────────────────────────
  if (action === 'ttt') {
    const { idx } = data;
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
    } else if (game.board.every(c => c !== null)) {
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
          } else if (game.board.every(c => c !== null)) {
            game.status = 'finished'; game.winner = 'draw';
          } else {
            game.turn = 'p1';
          }
        }
      }
    }

    const rows = buildTttRows(game, ref);
    const embed = renderTttEmbed(game);
    await interaction.update({ embeds: [embed], components: game.status === 'finished' ? [] : rows });
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
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('guess_input')
          .setLabel('Your guess (1 – 100)')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(3)
          .setRequired(true)
      )
    );

    await interaction.showModal(modal);
    return;
  }

  // ── Connect Four ─────────────────────────────────────────────────────────────
  if (action === 'c4') {
    const col = parseInt(interaction.values[0], 10);
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
    } else if (game.board.every(c => c !== null)) {
      game.status = 'finished'; game.winner = 'draw';
    } else {
      game.turn = isP1Turn ? 'p2' : 'p1';

      if (game.isBot && game.turn === 'p2') {
        const available = [];
        for (let c = 0; c < 7; c++) { if (game.board[c] === null) available.push(c); }
        if (available.length > 0) {
          const botCol = available[Math.floor(Math.random() * available.length)];
          dropChecker(game.board, botCol, 'p2');
          if (checkC4Win(game.board)) {
            game.status = 'finished'; game.winner = 'p2';
          } else if (game.board.every(c => c !== null)) {
            game.status = 'finished'; game.winner = 'draw';
          } else {
            game.turn = 'p1';
          }
        }
      }
    }

    const menuRow = buildC4Menu(game, ref);
    const embed = renderC4Embed(game);
    await interaction.update({ embeds: [embed], components: menuRow ? [menuRow] : [] });
    return;
  }

  // ── Memory Match ─────────────────────────────────────────────────────────────
  if (action === 'memory') {
    const { idx } = data;

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
      // Leave selected as-is so user sees both cards before next click resets
    }

    const rows = buildMemoryRows(game, ref);
    const embed = renderMemoryEmbed(game);
    await interaction.update({ embeds: [embed], components: game.status === 'finished' ? [] : rows });
    return;
  }
}
