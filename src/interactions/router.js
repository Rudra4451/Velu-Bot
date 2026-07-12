import { Collection } from 'discord.js';
import { logger } from '../utils/logger.js';
import { UIFactory } from '../ui/factory.js';
import { stateManager } from '../state/manager.js';
import { LIMITS } from '../constants/index.js';
import { middleware } from '../utils/middleware.js';

// Stores cooldown expiration timestamps: Map<cooldownKey, expirationTimestamp>
const cooldowns = new Collection();

export async function handleInteraction(interaction, client) {
  const now = Date.now();

  // 1. Clean up expired cooldowns to prevent memory leaks without background timers
  for (const [key, expirationTime] of cooldowns.entries()) {
    if (now >= expirationTime) {
      cooldowns.delete(key);
    }
  }

  // 2. Slash Commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      logger.warn(`No slash command matched name: /${interaction.commandName}`);
      return;
    }

    // Permission Validation Middleware
    const authorized = await middleware.checkPermissions(interaction, command);
    if (!authorized) return;

    // Cooldown Validation Middleware
    const cooldownAmount = command.cooldown ?? LIMITS.COOLDOWN_DEFAULT_MS;
    const cooldownKey = `${interaction.user.id}:${command.data.name}`;

    if (cooldowns.has(cooldownKey)) {
      const expirationTime = cooldowns.get(cooldownKey);
      if (now < expirationTime) {
        const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
        const embed = UIFactory.warning(
          'Command on Cooldown',
          `Please wait **${timeLeft}s** before using the \`/${command.data.name}\` command again.`
        );
        return middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
      }
    }

    cooldowns.set(cooldownKey, now + cooldownAmount);

    try {
      logger.debug(`Executing command /${interaction.commandName} for User: ${interaction.user.tag}`);
      await command.execute(interaction, client);
    } catch (error) {
      logger.error(`Error executing slash command /${interaction.commandName}`, error);
      const errorEmbed = UIFactory.error(
        'Execution Error',
        'An unexpected error occurred while executing this command.'
      );
      await middleware.safeReply(interaction, { embeds: [errorEmbed], ephemeral: true });
    }
    return;
  }

  // 3. Buttons, Select Menus, Modals
  if (
    interaction.isButton() ||
    interaction.isAnySelectMenu() ||
    interaction.isModalSubmit()
  ) {
    const customId = interaction.customId;
    
    // Resolve state
    let state;
    try {
      state = stateManager.resolve(customId);
    } catch (err) {
      logger.warn(`Failed to resolve state for custom ID: ${customId}`, err);
      const errorEmbed = UIFactory.error('Invalid Interaction', 'The payload format was invalid or spoofed.');
      return middleware.safeReply(interaction, { embeds: [errorEmbed], ephemeral: true });
    }

    if (state.expired) {
      const expireEmbed = UIFactory.warning(
        'Interaction Expired',
        'This session has expired. Please run the initial command again.'
      );
      return middleware.safeReply(interaction, { embeds: [expireEmbed], ephemeral: true });
    }

    const { namespace, action, data } = state;
    logger.debug(`Routed Component Interaction - Namespace: "${namespace}", Action: "${action}"`);

    // Lookup component handler
    const handler = client.components?.get(`${namespace}:${action}`) || client.components?.get(namespace);
    if (!handler) {
      logger.warn(`No handler found for interaction: namespace=${namespace}, action=${action}`);
      const unhandledEmbed = UIFactory.error(
        'Interaction Error',
        'No handler found to process this interaction.'
      );
      return middleware.safeReply(interaction, { embeds: [unhandledEmbed], ephemeral: true });
    }

    try {
      await handler.execute(interaction, { action, data, namespace }, client);
    } catch (error) {
      logger.error(`Error running component handler for ${namespace}:${action}`, error);
      const errEmbed = UIFactory.error('Error', 'Failed to process this component action.');
      await middleware.safeReply(interaction, { embeds: [errEmbed], ephemeral: true });
    }
    return;
  }

  // 4. Autocomplete
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;

    try {
      await command.autocomplete(interaction, client);
    } catch (error) {
      logger.error(`Autocomplete error for /${interaction.commandName}`, error);
    }
  }
}
