import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { stateManager } from '../../../state/manager.js';
import { middleware } from '../../../utils/middleware.js';
import { serializeUser, mentionUser, displayUser } from '../../../utils/userSerializer.js';

export const data = new SlashCommandBuilder()
  .setName('rps')
  .setDescription('Play Rock, Paper, Scissors against the bot or another user.')
  .addUserOption(option =>
    option.setName('opponent')
      .setDescription('The user to challenge (leave empty to play against the bot).')
      .setRequired(false)
  );

export async function execute(interaction) {
  const opponent = interaction.options.getUser('opponent') || interaction.client.user;
  const isBot = opponent.id === interaction.client.user.id;

  if (opponent.id === interaction.user.id) {
    const errEmbed = UIFactory.warning('Invalid Opponent', 'You cannot play Rock Paper Scissors against yourself.');
    return middleware.safeReply(interaction, { embeds: [errEmbed], ephemeral: true });
  }

  // Store only serializable primitives — Discord User objects cannot be JSON round-tripped
  const game = {
    p1: serializeUser(interaction.user),
    p2: serializeUser(opponent),
    isBot,
    p1Choice: null,
    p2Choice: null,
    winner: null, // 'p1' | 'p2' | 'draw'
    status: 'pending', // pending | playing | finished
  };

  const masterId = stateManager.create('game', 'rps_master', game);
  const refKey = masterId.split('|')[1];

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(stateManager.create('game', 'rps', { ref: refKey, choice: 'rock' }))
      .setLabel('Rock 🪨')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(stateManager.create('game', 'rps', { ref: refKey, choice: 'paper' }))
      .setLabel('Paper 📄')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(stateManager.create('game', 'rps', { ref: refKey, choice: 'scissors' }))
      .setLabel('Scissors ✂️')
      .setStyle(ButtonStyle.Primary)
  );

  const embed = renderRpsEmbed(game);
  await middleware.safeReply(interaction, { embeds: [embed], components: [buttonRow] });
}

export function renderRpsEmbed(game) {
  if (game.status === 'pending') {
    return UIFactory.premium(
      '🪨 Rock, Paper, Scissors ✂️',
      `**Challenger:** ${mentionUser(game.p1)}\n**Opponent:** ${mentionUser(game.p2)}\n\nBoth players, select your move below!`
    );
  }

  if (game.status === 'finished') {
    const p1Icon = choiceIcon(game.p1Choice);
    const p2Icon = choiceIcon(game.p2Choice);

    let resultText;
    if (game.winner === 'draw') {
      resultText = "🤝 It's a tie! Both chose the same move.";
    } else {
      const winner = game.winner === 'p1' ? game.p1 : game.p2;
      resultText = `🎉 ${displayUser(winner)} wins!`;
    }

    return UIFactory.success(
      'RPS — Game Over',
      `${mentionUser(game.p1)} chose ${p1Icon} **${game.p1Choice}**\n` +
      `${mentionUser(game.p2)} chose ${p2Icon} **${game.p2Choice}**\n\n` +
      resultText
    );
  }

  // Playing (one player has chosen, waiting for other)
  return UIFactory.premium(
    'RPS — Awaiting Moves',
    `${mentionUser(game.p1)} ${game.p1Choice ? '✅ Ready' : '⏳ Choosing...'}\n` +
    `${mentionUser(game.p2)} ${game.p2Choice ? '✅ Ready' : '⏳ Choosing...'}`
  );
}

function choiceIcon(choice) {
  return { rock: '🪨', paper: '📄', scissors: '✂️' }[choice] ?? '❓';
}
