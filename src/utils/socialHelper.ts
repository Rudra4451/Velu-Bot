import { SlashCommandBuilder, ChatInputCommandInteraction, User } from 'discord.js';
import { UIFactory } from '../ui/factory.js';
import { klipyService } from '../services/klipy.js';
import { middleware } from './middleware.js';

/**
 * Builds a standard slash command builder for a social action.
 */
export function buildSocialCommand(name: string, description: string, requireTarget: boolean = true) {
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
 */
export async function executeSocial(
  interaction: ChatInputCommandInteraction,
  category: string,
  actionText: (user: User, target: User) => string,
  selfText: (user: User) => string
): Promise<void> {
  const user = interaction.user;
  const target = interaction.options.getUser('target');

  await middleware.safeDefer(interaction);

  let description: string;
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
