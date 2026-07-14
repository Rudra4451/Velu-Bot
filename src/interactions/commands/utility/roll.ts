import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Utility';

export const data = new SlashCommandBuilder()
  .setName('roll')
  .setDescription('Random tools: flip a coin, roll dice, or pick from options.')
  .addSubcommand(sub =>
    sub.setName('coin')
      .setDescription('Flip a coin (Heads or Tails).')
  )
  .addSubcommand(sub =>
    sub.setName('dice')
      .setDescription('Roll one or more polyhedral dice.')
      .addIntegerOption(opt =>
        opt.setName('sides').setDescription('Number of sides (default: 6)').setRequired(false).setMinValue(2).setMaxValue(100)
      )
      .addIntegerOption(opt =>
        opt.setName('count').setDescription('Number of dice to roll (default: 1)').setRequired(false).setMinValue(1).setMaxValue(10)
      )
  )
  .addSubcommand(sub =>
    sub.setName('choose')
      .setDescription('Randomly choose one from a comma-separated list of options.')
      .addStringOption(opt =>
        opt.setName('options').setDescription('Comma-separated choices (e.g. apple, orange, banana)').setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  // ── COIN ──────────────────────────────────────────────────────────────────
  if (subcommand === 'coin') {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    const description = result === 'Heads'
      ? '🪙 The coin spun through the air and landed on...\n\n**Heads!**'
      : '🪙 The coin spun through the air and landed on...\n\n**Tails!**';

    const embed = UIFactory.premium('Coin Flip', description);
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  // ── DICE ──────────────────────────────────────────────────────────────────
  if (subcommand === 'dice') {
    const sides = interaction.options.getInteger('sides') || 6;
    const count = interaction.options.getInteger('count') || 1;

    const rolls: number[] = [];
    let total = 0;
    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      total += roll;
    }

    const embed = UIFactory.premium('Dice Roller', '', {
      fields: [
        { name: '🎲 Configuration', value: `\`${count}d${sides}\``, inline: true },
        { name: '🔢 Individual Rolls', value: rolls.map(r => `\`${r}\``).join(', '), inline: true },
        { name: '✨ Total Sum', value: `**${total}**` }
      ]
    });
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  // ── CHOOSE ────────────────────────────────────────────────────────────────
  if (subcommand === 'choose') {
    const optionsString = interaction.options.getString('options')!;
    const choices = optionsString.split(',').map(c => c.trim()).filter(Boolean);

    if (choices.length < 2) {
      const errEmbed = UIFactory.warning('Not Enough Options', 'Please specify at least **two** choices separated by commas.');
      await middleware.safeReply(interaction, { embeds: [errEmbed], ephemeral: true });
      return;
    }

    const selected = choices[Math.floor(Math.random() * choices.length)];
    const embed = UIFactory.premium('Random Selector', '', {
      fields: [
        { name: '📋 Options Provided', value: choices.map(c => `• ${c}`).join('\n') },
        { name: '✨ Selected Option', value: `**${selected}**` }
      ]
    });
    await middleware.safeReply(interaction, { embeds: [embed] });
  }
}
