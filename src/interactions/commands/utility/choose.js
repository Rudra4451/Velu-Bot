import { SlashCommandBuilder } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const data = new SlashCommandBuilder()
  .setName('choose')
  .setDescription('Randomly choose one option from a list of choices.')
  .addStringOption(option =>
    option.setName('options')
      .setDescription('A list of choices separated by commas (e.g. apple, orange, banana).')
      .setRequired(true)
  );

export async function execute(interaction) {
  const optionsString = interaction.options.getString('options');
  const choices = optionsString.split(',').map(choice => choice.trim()).filter(Boolean);

  if (choices.length < 2) {
    const errEmbed = UIFactory.warning(
      'Not Enough Options',
      'Please specify at least **two** choices separated by commas.'
    );
    return middleware.safeReply(interaction, { embeds: [errEmbed], ephemeral: true });
  }

  const selected = choices[Math.floor(Math.random() * choices.length)];
  const embed = UIFactory.premium('Selector', '', {
    fields: [
      { name: '📋 Options Provided', value: choices.map(c => `• ${c}`).join('\n') },
      { name: '✨ Selected Option', value: `**${selected}**` }
    ]
  });

  await middleware.safeReply(interaction, { embeds: [embed] });
}
