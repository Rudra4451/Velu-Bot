import { SlashCommandBuilder } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const data = new SlashCommandBuilder()
  .setName('dice')
  .setDescription('Roll one or more polyhedral dice.')
  .addIntegerOption(option =>
    option.setName('sides')
      .setDescription('Number of sides on the dice (default: 6).')
      .setRequired(false)
      .setMinValue(2)
      .setMaxValue(100)
  )
  .addIntegerOption(option =>
    option.setName('count')
      .setDescription('Number of dice to roll (default: 1).')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(10)
  );

export async function execute(interaction) {
  const sides = interaction.options.getInteger('sides') || 6;
  const count = interaction.options.getInteger('count') || 1;

  const rolls = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const roll = Math.floor(Math.random() * sides) + 1;
    rolls.push(roll);
    total += roll;
  }

  const embed = UIFactory.premium('Dice Roller', '', {
    fields: [
      { name: '🎲 Roll Configuration', value: `\`${count}d${sides}\``, inline: true },
      { name: '🔢 Individual Rolls', value: rolls.map(r => `\`${r}\``).join(', '), inline: true },
      { name: '✨ Total Sum', value: `**${total}**` }
    ]
  });

  await middleware.safeReply(interaction, { embeds: [embed] });
}
