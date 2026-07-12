import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { stateManager } from '../../../state/manager.js';
import { middleware } from '../../../utils/middleware.js';
import { serializeUser, mentionUser } from '../../../utils/userSerializer.js';

const PAIR_COUNT = 8;
const GRID_SIZE = PAIR_COUNT * 2; // 16 cards

const EMOJI_DECK = ['🍎', '🍌', '🍇', '🍉', '🍒', '🍍', '🥥', '🥝'];

export const data = new SlashCommandBuilder()
  .setName('memory')
  .setDescription('Play a solo Memory Match game — flip pairs of cards to find all matches.');

export async function execute(interaction) {
  // Double deck and shuffle using Fisher-Yates
  const deck = [...EMOJI_DECK, ...EMOJI_DECK];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const game = {
    player: serializeUser(interaction.user),
    deck,
    revealed: Array(GRID_SIZE).fill(false),
    selected: [],  // indices of currently face-up un-matched cards (max 2)
    attempts: 0,
    matched: 0,
    status: 'playing', // playing | finished
  };

  const masterId = stateManager.create('game', 'memory_master', game);
  const refKey = masterId.split('|')[1];

  const rows = buildMemoryRows(game, refKey);
  const embed = renderMemoryEmbed(game);
  await middleware.safeReply(interaction, { embeds: [embed], components: rows });
}

export function buildMemoryRows(game, refKey) {
  const rows = [];
  for (let r = 0; r < 4; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 4; c++) {
      const idx = r * 4 + c;
      const isRevealed = game.revealed[idx];
      const isSelected = game.selected.includes(idx);
      const visible = isRevealed || isSelected;

      const label = visible ? game.deck[idx] : '?';
      const style = isRevealed ? ButtonStyle.Success : isSelected ? ButtonStyle.Primary : ButtonStyle.Secondary;
      const disabled = game.status === 'finished' || isRevealed || isSelected;

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(stateManager.create('game', 'memory', { ref: refKey, idx }))
          .setLabel(label)
          .setStyle(style)
          .setDisabled(disabled)
      );
    }
    rows.push(row);
  }
  return rows;
}

export function renderMemoryEmbed(game) {
  if (game.status === 'finished') {
    return UIFactory.success(
      '🎉 Memory Match Complete!',
      `${mentionUser(game.player)} found all **${PAIR_COUNT}** pairs in **${game.attempts}** attempts!`
    );
  }

  return UIFactory.premium(
    '🧠 Memory Match',
    `**Player:** ${mentionUser(game.player)}\n` +
    `**Attempts:** \`${game.attempts}\`  •  **Pairs Found:** \`${game.matched}/${PAIR_COUNT}\`\n\n` +
    `Flip two cards and find all matching pairs!`
  );
}
