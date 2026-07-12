import { SlashCommandBuilder } from 'discord.js';
import { UIFactory } from '../ui/factory.js';
import { klipyService } from '../services/klipy.js';
import { middleware } from './middleware.js';

/**
 * Builds a standard slash command builder for a social action.
 * @param {string} name - Command name
 * @param {string} description - Command description
 * @param {boolean} requireTarget - Whether the `target` option is required
 */
export function buildSocialCommand(name, description, requireTarget = true) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addUserOption(option =>
      option.setName('target')
        .setDescription(requireTarget ? 'The user to target.' : 'The user to target (optional).')
        .setRequired(requireTarget)
    );
}

/**
 * Shared execution handler for all social commands.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {string} category - Klipy/fallback lookup key (e.g. 'hug')
 * @param {(user: object, target: object) => string} actionText - Message when targeting another user
 * @param {(user: object) => string} selfText - Message when targeting oneself or no target
 */
export async function executeSocial(interaction, category, actionText, selfText) {
  const user = interaction.user;
  const target = interaction.options.getUser('target');

  await middleware.safeDefer(interaction);

  let description;
  if (target && target.id !== user.id) {
    description = actionText(user, target);
  } else {
    description = selfText(target ?? user);
  }

  const gifUrl = await klipyService.search(category, `anime ${category}`);

  const embed = UIFactory.premium(null, description, {
    image: gifUrl || undefined,
    footer: false, // Social commands look cleaner without footer
    timestamp: false,
  });

  await middleware.safeReply(interaction, { embeds: [embed] });
}
