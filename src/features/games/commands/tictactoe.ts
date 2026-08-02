import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { stateManager } from '../../../core/stateManager.js';
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

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const opponent = interaction.options.getUser('opponent') || interaction.client.user;
  const isBot = opponent.id === interaction.client.user.id;

  if (opponent.id === interaction.user.id) {
    const errEmbed = UIFactory.warning('Invalid Opponent', 'You cannot play Tic Tac Toe against yourself.');
    await middleware.safeReply(interaction, { embeds: [errEmbed], ephemeral: true });
    return;
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
  await middleware.safeReply(interaction, { embeds: [embed], components: rows as any });
}

export function buildTttRows(game: any, refKey: string) {
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

export function renderTttEmbed(game: any) {
  if (game.status === 'finished') {
    if (game.winner === 'draw') {
      return UIFactory.warning(
        'Tic Tac Toe — Draw!',
        `⚔️ **Match Result**\n> 🤝 It's a draw between ${mentionUser(game.p1)} and ${mentionUser(game.p2)}!\n\n*The board is shown below in its final state.*`
      );
    }
    const winner = game.winner === 'p1' ? game.p1 : game.p2;
    return UIFactory.success(
      'Tic Tac Toe — Game Over',
      `⚔️ **Match Result**\n> 🎉 ${displayUser(winner)} wins the game!\n\n*Congratulations!*`
    );
  }

  const current = game.turn === 'p1' ? game.p1 : game.p2;
  const symbol = game.turn === 'p1' ? '✕' : '○';
  const description = [
    `⚔️ **Battle Details**`,
    `> ✕ \`Player 1:\` ${mentionUser(game.p1)}`,
    `> ○ \`Player 2:\` ${mentionUser(game.p2)}`,
    ``,
    `🎲 **Current Status**`,
    `> It is currently ${mentionUser(current)}'s turn (${symbol})!`,
    `> *Make your move by clicking a button below.*`
  ].join('\n');

  return UIFactory.premium('Tic Tac Toe', description);
}

/** Check if the board has a winning line using shared constant. */
export function checkTttWin(board: any[]) {
  return GAMES.TTT_LINES.some(([a, b, c]) =>
    board[a] !== null && board[a] === board[b] && board[a] === board[c]
  );
}
