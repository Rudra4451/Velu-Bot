import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { stateManager } from '../../../state/manager.js';
import { middleware } from '../../../utils/middleware.js';
import { serializeUser, mentionUser, displayUser } from '../../../utils/userSerializer.js';

export const data = new SlashCommandBuilder()
  .setName('guessnumber')
  .setDescription('Guess the secret number between 1 and 100 within 7 attempts.');

export async function execute(interaction) {
  const target = Math.floor(Math.random() * 100) + 1;

  const game = {
    player: serializeUser(interaction.user),
    target,
    attempts: 0,
    maxAttempts: 7,
    status: 'playing', // playing | won | lost
    hint: 'Guess a number between **1** and **100**.',
  };

  const masterId = stateManager.create('game', 'guess_master', game);
  const refKey = masterId.split('|')[1];

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(stateManager.create('game', 'guess_btn', { ref: refKey }))
      .setLabel('Make a Guess 🔢')
      .setStyle(ButtonStyle.Success)
  );

  const embed = renderGuessEmbed(game);
  await middleware.safeReply(interaction, { embeds: [embed], components: [row] });
}

export function renderGuessEmbed(game) {
  if (game.status === 'won') {
    return UIFactory.success(
      'Correct Guess!',
      `👤 **Player:** ${mentionUser(game.player)}\n` +
      `🏆 **Result:** You guessed it right in **${game.attempts}** attempt(s)!\n` +
      `🔢 **The Number was:** \`${game.target}\``
    );
  }

  if (game.status === 'lost') {
    return UIFactory.error(
      'Game Over',
      `👤 **Player:** ${mentionUser(game.player)}\n` +
      `❌ **Result:** You used all ${game.maxAttempts} attempts.\n` +
      `🔢 **The Number was:** \`${game.target}\``
    );
  }

  const description = [
    `👤 **Player:** ${mentionUser(game.player)}`,
    `📊 **Attempts:** \`${game.attempts} / ${game.maxAttempts}\``,
    ``,
    `📢 **Hint:** ${game.hint}`,
    ``,
    `*Click the green button below to submit a guess.*`
  ].join('\n');

  return UIFactory.premium('Guess the Number', description);
}
