import { PermissionFlagsBits } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember, PermissionResolvable } from 'discord.js';
import { db } from '../state/db.js';
import { UIFactory } from '../ui/factory.js';
import { middleware } from './middleware.js';
import type { AuthorizeOptions, HierarchyOptions } from '../types/index.js';

let botOwnerId: string | null = null;

/**
 * Fetch the bot owner ID dynamically if not already cached.
 */
async function getBotOwnerId(client: ChatInputCommandInteraction['client']): Promise<string | null> {
  if (botOwnerId) return botOwnerId;
  try {
    if (!client.application) return null;
    const app = await client.application.fetch();
    if ('members' in (app.owner ?? {})) {
      // Team owner
      botOwnerId = (app.owner as any)?.ownerId ?? null;
    } else {
      // Single user owner
      botOwnerId = (app.owner as any)?.id ?? null;
    }
  } catch {
    // Fail silently, fallback to standard permissions
  }
  return botOwnerId;
}

export const permissionManager = {
  /**
   * Main entry point for command authorization check.
   * Checks priority: Bot Owner -> Guild Owner -> Admin -> Configured Role -> Discord Permission.
   * Also verifies Bot's permissions if applicable.
   */
  async authorize(interaction: ChatInputCommandInteraction, options: AuthorizeOptions = {}): Promise<boolean> {
    const { client, guild, member, user } = interaction;
    if (!guild || !member) return true; // DMs are handled separately or bypassed

    const {
      commandName,
      moduleName,
      userPermission,
      botPermission,
    } = options;

    const guildMember = member as GuildMember;

    // 1. Bot Owner Bypass
    const ownerId = await getBotOwnerId(client);
    if (ownerId && user.id === ownerId) {
      return true;
    }

    // 2. Guild Owner Bypass
    if (guild.ownerId === user.id) {
      return true;
    }

    // 3. Administrator Bypass
    if (guildMember.permissions.has(PermissionFlagsBits.Administrator)) {
      return true;
    }

    // 4. Configured Roles Check
    const allowedRoles = [
      ...db.getPermissions(guild.id, commandName || ''),
      ...db.getPermissions(guild.id, moduleName || '')
    ];

    const hasConfiguredRole = guildMember.roles.cache.some(role => allowedRoles.includes(role.id));
    if (hasConfiguredRole) {
      // Bot permission check before executing
      if (botPermission && !guild.members.me!.permissions.has(botPermission)) {
        const errorEmbed = UIFactory.error(
          'Missing Bot Permission',
          `I require the following permission to run this action: \`${this.getPermissionName(botPermission)}\``
        );
        await middleware.safeReply(interaction, { embeds: [errorEmbed], ephemeral: true });
        return false;
      }
      return true;
    }

    // 5. Discord Permission Check
    if (userPermission) {
      if (!guildMember.permissions.has(userPermission)) {
        const errorEmbed = UIFactory.error(
          'Access Denied',
          `You do not have the required permissions to run this command. (Requires \`${this.getPermissionName(userPermission)}\` or an authorized role)`
        );
        await middleware.safeReply(interaction, { embeds: [errorEmbed], ephemeral: true });
        return false;
      }
    }

    // 6. Bot Permission Check
    if (botPermission && !guild.members.me!.permissions.has(botPermission)) {
      const errorEmbed = UIFactory.error(
        'Missing Bot Permission',
        `I require the following permission to execute this action: \`${this.getPermissionName(botPermission)}\``
      );
      await middleware.safeReply(interaction, { embeds: [errorEmbed], ephemeral: true });
      return false;
    }

    return true;
  },

  /**
   * Helper to check role hierarchy and other moderation constraints.
   * Rejects with friendly embeds instead of letting raw Discord API errors happen.
   */
  async checkHierarchy(
    interaction: ChatInputCommandInteraction,
    targetMember: GuildMember,
    options: HierarchyOptions = {}
  ): Promise<boolean> {
    const { guild, member } = interaction;
    if (!guild || !targetMember) return true;

    const botMember = guild.members.me!;
    const guildMember = member as GuildMember;

    // 1. Target is Guild Owner
    if (targetMember.id === guild.ownerId) {
      const embed = UIFactory.error('Hierarchy Error', 'You cannot moderate the Server Owner.');
      await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
      return false;
    }

    // 2. Target is Executor
    if (targetMember.id === guildMember.id) {
      const embed = UIFactory.error('Hierarchy Error', 'You cannot moderate yourself.');
      await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
      return false;
    }

    // 3. Target is Bot itself
    if (targetMember.id === botMember.id) {
      const embed = UIFactory.error('Hierarchy Error', 'I cannot moderate myself.');
      await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
      return false;
    }

    // 4. Target is higher or equal to Executor in role hierarchy
    const isBotOwner = botOwnerId && guildMember.id === botOwnerId;
    const isGuildOwner = guild.ownerId === guildMember.id;
    if (!isBotOwner && !isGuildOwner) {
      if (targetMember.roles.highest.position >= guildMember.roles.highest.position) {
        const embed = UIFactory.error(
          'Hierarchy Error',
          'The target user has a role that is higher than or equal to your highest role.'
        );
        await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
        return false;
      }
    }

    // 5. Target is higher or equal to Bot in role hierarchy
    if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
      const embed = UIFactory.error(
        'Hierarchy Error',
        'The target user has a role that is higher than or equal to my highest role.'
      );
      await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
      return false;
    }

    // 6. Managed Role protection (if editing/modifying roles)
    if (options.checkManagedRole && targetMember.roles?.botRole) {
      const embed = UIFactory.error('Permission Error', 'Managed roles (e.g. integrations or bot roles) cannot be modified.');
      await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
      return false;
    }

    return true;
  },

  getPermissionName(perm: PermissionResolvable): string {
    return Object.keys(PermissionFlagsBits).find(
      key => PermissionFlagsBits[key as keyof typeof PermissionFlagsBits] === perm
    ) || String(perm);
  }
};
