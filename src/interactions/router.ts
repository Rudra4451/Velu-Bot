import type { Interaction, ChatInputCommandInteraction } from 'discord.js';
import { logger } from '../utils/logger.js';
import { UIFactory } from '../ui/factory.js';
import { stateManager } from '../state/manager.js';
import { LIMITS } from '../constants/index.js';
import { middleware } from '../utils/middleware.js';
import type { VeluClient, Command } from '../types/index.js';

// ── Performance: Fixed-size cooldown map with lazy expiry ──────────
// Instead of sweeping ALL entries on every interaction, we only check
// the specific user's cooldown key and let stale entries expire naturally.
const cooldowns = new Map<string, number>();

// Periodic sweep every 60 seconds instead of every interaction
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 60_000;

function lazySweepCooldowns(): void {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;

  for (const [key, expiry] of cooldowns) {
    if (now >= expiry) cooldowns.delete(key);
  }
}

export async function handleInteraction(interaction: Interaction, client: VeluClient): Promise<void> {
  // Lazy sweep — runs at most once per minute, not every interaction
  lazySweepCooldowns();

  // ── Slash Commands ──
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName) as Command | undefined;
    if (!command) {
      logger.warn(`No slash command matched name: /${interaction.commandName}`);
      return;
    }

    // Immediately defer interaction to guarantee sub-100ms ACK response to Discord (prevents 3s timeout)
    await middleware.safeDefer(interaction);

    // Permission Validation Middleware
    const authorized = await middleware.checkPermissions(interaction, command);
    if (!authorized) return;

    // Cooldown — O(1) lookup, no sweep
    const cooldownAmount = command.cooldown ?? LIMITS.COOLDOWN_DEFAULT_MS;
    const cooldownKey = `${interaction.user.id}:${command.data.name}`;
    const now = Date.now();

    const expirationTime = cooldowns.get(cooldownKey);
    if (expirationTime !== undefined && now < expirationTime) {
      const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
      const embed = UIFactory.warning(
        'Command on Cooldown',
        `Please wait **${timeLeft}s** before using the \`/${command.data.name}\` command again.`
      );
      return void await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
    }

    cooldowns.set(cooldownKey, now + cooldownAmount);

    try {
      logger.debug(`Executing command /${interaction.commandName} for User: ${interaction.user.tag}`);
      await command.execute(interaction, client);
    } catch (error: any) {
      logger.error(`Error executing slash command /${interaction.commandName}`, error);
      const errorEmbed = UIFactory.error(
        'Execution Error',
        'An unexpected error occurred while executing this command.'
      );
      await middleware.safeReply(interaction, { embeds: [errorEmbed], ephemeral: true });
    }
    return;
  }

  // ── Buttons, Select Menus, Modals ──
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
    } catch (err: any) {
      logger.warn(`Failed to resolve state for custom ID: ${customId}`, err);
      const errorEmbed = UIFactory.error('Invalid Interaction', 'The payload format was invalid or spoofed.');
      return void await middleware.safeReply(interaction, { embeds: [errorEmbed], ephemeral: true });
    }

    if (state.expired) {
      const expireEmbed = UIFactory.warning(
        'Interaction Expired',
        'This session has expired. Please run the initial command again.'
      );
      return void await middleware.safeReply(interaction, { embeds: [expireEmbed], ephemeral: true });
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
      return void await middleware.safeReply(interaction, { embeds: [unhandledEmbed], ephemeral: true });
    }

    try {
      await handler.execute(interaction, { action, data: data as Record<string, unknown> | null, namespace }, client);
    } catch (error: any) {
      logger.error(`Error running component handler for ${namespace}:${action}`, error);
      const errEmbed = UIFactory.error('Error', 'Failed to process this component action.');
      await middleware.safeReply(interaction, { embeds: [errEmbed], ephemeral: true });
    }
    return;
  }

  // ── Autocomplete ──
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName) as Command | undefined;
    if (!command || !command.autocomplete) return;

    try {
      await command.autocomplete(interaction as unknown as ChatInputCommandInteraction, client);
    } catch (error: any) {
      logger.error(`Autocomplete error for /${interaction.commandName}`, error);
    }
  }
}
