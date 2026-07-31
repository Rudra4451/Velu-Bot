import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction } from 'discord.js';
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

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const opponent = interaction.options.getUser('opponent') || interaction.client.user;
  const isBot = opponent.id === interaction.client.user.id;

  if (opponent.id === interaction.user.id) {
    const errEmbed = UIFactory.warning('Invalid Opponent', 'You cannot play Rock Paper Scissors against yourself.');
    await middleware.safeReply(interaction, { embeds: [errEmbed], ephemeral: true });
    return;
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
  await middleware.safeReply(interaction, { embeds: [embed], components: [buttonRow as any] });
}

export function renderRpsEmbed(game: any) {
  if (game.status === 'pending') {
    const description = [
      `⚔️ **Lobby**`,
      `> 👤 \`Challenger:\` ${mentionUser(game.p1)}`,
      `> 👤 \`Opponent:\` ${mentionUser(game.p2)}`,
      ``,
      `🎮 **How to Play**`,
      `> Select your move (**Rock**, **Paper**, or **Scissors**) using the buttons below!`,
      `> *Moves are kept secret until both players choose.*`
    ].join('\n');
    return UIFactory.premium('Rock, Paper, Scissors', description);
  }

  if (game.status === 'finished') {
    const p1Icon = choiceIcon(game.p1Choice);
    const p2Icon = choiceIcon(game.p2Choice);

    let resultText;
    if (game.winner === 'draw') {
      resultText = `> 🤝 **It's a tie!** Both players chose ${p1Icon} **${game.p1Choice}**.`;
    } else {
      const winner = game.winner === 'p1' ? game.p1 : game.p2;
      resultText = `> 🎉 **Winner:** ${mentionUser(winner)} wins the game!`;
    }

    const description = [
      `⚔️ **Match Outcome**`,
      `> ${mentionUser(game.p1)} chose ${p1Icon} **${game.p1Choice}**`,
      `> ${mentionUser(game.p2)} chose ${p2Icon} **${game.p2Choice}**`,
      ``,
      resultText
    ].join('\n');

    return UIFactory.success('RPS — Game Over', description);
  }

  // Playing (one player has chosen, waiting for other)
  const description = [
    `⚔️ **Match Progress**`,
    `> ${mentionUser(game.p1)} ${game.p1Choice ? '✅ `Ready`' : '⏳ `Choosing...`'}`,
    `> ${mentionUser(game.p2)} ${game.p2Choice ? '✅ `Ready`' : '⏳ `Choosing...`'}`,
    ``,
    `💡 *Waiting for all moves to be locked in.*`
  ].join('\n');
  return UIFactory.premium('RPS — Awaiting Moves', description);
}

function choiceIcon(choice: string) {
  return ({ rock: '🪨', paper: '📄', scissors: '✂️' } as Record<string, string>)[choice] ?? '❓';
}
