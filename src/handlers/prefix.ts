import { PermissionFlagsBits, Message, GuildMember, User, PermissionResolvable } from 'discord.js';
import { config } from '../config/index.js';
import { UIFactory } from '../ui/factory.js';
import { db } from '../state/db.js';
import { permissionManager } from '../utils/permissionManager.js';
import { actionLogger } from '../utils/actionLogger.js';
import { logger } from '../utils/logger.js';
import type { VeluClient } from '../types/index.js';

// Cooldowns for prefix commands: key is "userId:command" → expiry timestamp
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 3000;

// ─── Utilities ────────────────────────────────────────────────────────────────

function getUserId(arg: string | undefined): string | null {
  if (!arg) return null;
  const mentionMatch = arg.match(/^<@!?(\d{17,20})>$/);
  if (mentionMatch) return mentionMatch[1]!;
  if (/^\d{17,20}$/.test(arg)) return arg;
  return null;
}

async function resolveUserOrMember(message: Message, arg: string | undefined): Promise<{ user?: User, member?: GuildMember }> {
  if (!arg) return {};
  
  // 1. Check direct mention or ID
  const id = getUserId(arg);
  if (id) {
    let member = message.mentions.members?.get(id) || await message.guild?.members.fetch(id).catch(() => undefined);
    if (member) return { user: member.user, member };
    let user = message.mentions.users.get(id) || await message.client.users.fetch(id).catch(() => undefined);
    return { user };
  }

  // 2. Search by username/tag if no ID/mention matched (e.g. "@rudra_4454")
  const cleanArg = arg.replace(/^@/, '').toLowerCase();
  if (message.guild) {
    // Search cached members
    const cachedMember = message.guild.members.cache.find(m => 
      m.user.username.toLowerCase() === cleanArg || 
      m.user.tag.toLowerCase() === cleanArg ||
      (m.nickname && m.nickname.toLowerCase() === cleanArg)
    );
    if (cachedMember) return { user: cachedMember.user, member: cachedMember };

    // Search via query (fetches from API)
    const fetched = await message.guild.members.fetch({ query: cleanArg, limit: 1 }).catch(() => null);
    const member = fetched?.first();
    if (member) return { user: member.user, member };
  }

  return {};
}

function checkCooldown(userId: string, commandName: string): string | null {
  const key = `${userId}:${commandName}`;
  const now = Date.now();
  if (cooldowns.has(key) && now < cooldowns.get(key)!) {
    return ((cooldowns.get(key)! - now) / 1000).toFixed(1);
  }
  cooldowns.set(key, now + COOLDOWN_MS);
  return null;
}

async function safeReply(message: Message, payload: string | { content?: string, embeds?: any[] }): Promise<Message | null> {
  try {
    const data = typeof payload === 'string' ? { content: payload } : payload;
    return await message.reply(data);
  } catch (err: any) {
    logger.error('Prefix safeReply failed:', err);
    return null;
  }
}

/**
 * Quick guard: checks that the invoking user has the given Discord permission.
 * Also checks custom role overrides via permissionManager by building a minimal interaction-like object.
 */
async function guard(
  message: Message,
  userPermission: PermissionResolvable | null,
  botPermission: PermissionResolvable | null,
  commandName: string
): Promise<boolean> {
  const { guild, member } = message;
  if (!guild || !member) return false;

  // Bot Owner check
  const app = message.client.application;
  if (app) {
    const owner = app.owner;
    const ownerId = (owner as any)?.members ? (owner as any).ownerId : (owner as any)?.id;
    if (ownerId && message.author.id === ownerId) return true;
  }

  // Guild Owner check
  if (guild.ownerId === message.author.id) return true;

  // Administrator check
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  // Custom role override
  const allowedRoles = [
    ...db.getPermissions(guild.id, commandName),
    ...db.getPermissions(guild.id, 'Moderation'),
  ];
  if (member.roles.cache.some(role => allowedRoles.includes(role.id))) {
    // Still verify bot permission
    if (botPermission && !guild.members.me!.permissions.has(botPermission)) {
      const embed = UIFactory.error('Missing Bot Permission', `I need the \`${botPermission}\` permission.`);
      await safeReply(message, { embeds: [embed] });
      return false;
    }
    return true;
  }

  // Discord Permission
  if (userPermission && !member.permissions.has(userPermission)) {
    const embed = UIFactory.error('Access Denied', `You need the \`${permissionManager.getPermissionName(userPermission)}\` permission or a configured role.`);
    await safeReply(message, { embeds: [embed] });
    return false;
  }

  // Bot permission check
  if (botPermission && !guild.members.me!.permissions.has(botPermission)) {
    const embed = UIFactory.error('Missing Bot Permission', `I need the \`${permissionManager.getPermissionName(botPermission)}\` permission.`);
    await safeReply(message, { embeds: [embed] });
    return false;
  }

  return true;
}

async function hierarchyCheck(message: Message, targetMember: GuildMember): Promise<boolean> {
  const { guild, member } = message;
  if (!guild || !member) return false;
  
  const botMember = guild.members.me!;

  if (targetMember.id === guild.ownerId) {
    const embed = UIFactory.error('Hierarchy Error', 'You cannot moderate the Server Owner.');
    await safeReply(message, { embeds: [embed] });
    return false;
  }
  if (targetMember.id === message.author.id) {
    const embed = UIFactory.error('Hierarchy Error', 'You cannot moderate yourself.');
    await safeReply(message, { embeds: [embed] });
    return false;
  }
  if (targetMember.id === botMember.id) {
    const embed = UIFactory.error('Hierarchy Error', 'I cannot moderate myself.');
    await safeReply(message, { embeds: [embed] });
    return false;
  }
  if (guild.ownerId !== message.author.id && targetMember.roles.highest.position >= member.roles.highest.position) {
    const embed = UIFactory.error('Hierarchy Error', 'The target has a higher or equal role to yours.');
    await safeReply(message, { embeds: [embed] });
    return false;
  }
  if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
    const embed = UIFactory.error('Hierarchy Error', 'The target has a higher or equal role to mine.');
    await safeReply(message, { embeds: [embed] });
    return false;
  }
  return true;
}

// ─── Command Implementations ──────────────────────────────────────────────────

type CommandFunction = (message: Message, args: string[]) => Promise<any>;

const commands: Record<string, CommandFunction> = {

  // ── Utility ──
  async ping(message: Message) {
    const sent = await safeReply(message, { content: '⚡ Pinging...' });
    if (!sent) return;
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const embed = UIFactory.success('Pong!', `**Bot Latency:** \`${latency}ms\`\n**API Latency:** \`${Math.round(message.client.ws.ping)}ms\``);
    await sent.edit({ content: null, embeds: [embed] });
  },

  async avatar(message: Message, args: string[]) {
    let target = message.author;
    if (args[0]) {
      const resolved = await resolveUserOrMember(message, args[0]);
      if (resolved.user) target = resolved.user;
    }
    const url = target.displayAvatarURL({ size: 4096, forceStatic: false } as any);
    const embed = UIFactory.premium(`${target.username}'s Avatar`, null, { image: url });
    await safeReply(message, { embeds: [embed] });
  },

  async userinfo(message: Message, args: string[]) {
    if(!message.guild || !message.member) return;
    let member = message.member;
    if (args[0]) {
      const resolved = await resolveUserOrMember(message, args[0]);
      if (resolved.member) member = resolved.member;
    }
    const user = member.user;
    const roles = member.roles.cache.filter(r => r.id !== message.guild!.id).sort((a, b) => b.position - a.position);
    const fields = [
      { name: 'Username', value: user.tag, inline: true },
      { name: 'ID', value: `\`${user.id}\``, inline: true },
      { name: 'Joined Server', value: `<t:${Math.floor((member.joinedTimestamp || 0) / 1000)}:R>`, inline: true },
      { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: `Roles (${roles.size})`, value: roles.size ? roles.map(r => `${r}`).slice(0, 10).join(', ') : 'None', inline: false },
    ];
    const embed = UIFactory.premium(`User Info — ${user.username}`, null, {
      thumbnail: user.displayAvatarURL({ forceStatic: false } as any),
      fields,
      timestamp: true,
    });
    await safeReply(message, { embeds: [embed] });
  },

  async serverinfo(message: Message) {
    const guild = message.guild;
    if(!guild) return;
    const fields = [
      { name: 'Members', value: `${guild.memberCount}`, inline: true },
      { name: 'Channels', value: `${guild.channels.cache.size}`, inline: true },
      { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
      { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
    ];
    const embed = UIFactory.premium(`Server Info — ${guild.name}`, null, {
      thumbnail: guild.iconURL({ forceStatic: false } as any) ?? undefined,
      fields,
      timestamp: true,
    });
    await safeReply(message, { embeds: [embed] });
  },

  async afk(message: Message, args: string[]) {
    const reason = args.join(' ') || 'AFK';
    db.setAFK(message.author.id, reason);
    const embed = UIFactory.premium('💤 AFK Status Set', `Reason: ${reason}\n*Send a message to remove your AFK.*`);
    await safeReply(message, { embeds: [embed] });
  },

  // ── Moderation ──
  async warn(message: Message, args: string[]) {
    if (!message.guild) return;
    if (!(await guard(message, PermissionFlagsBits.ModerateMembers, null, 'warn'))) return;
    const resolved = await resolveUserOrMember(message, args[0]);
    const target = resolved.member;
    if (!target) {
      return safeReply(message, { embeds: [UIFactory.error('Missing Target', 'Mention a member or provide a valid user ID to warn. Usage: `?warn <@user/user_id> <reason>`')] }) as unknown as undefined;
    }
    const reason = args.slice(1).join(' ');
    if (!reason) {
      return safeReply(message, { embeds: [UIFactory.error('Missing Reason', 'Provide a reason. Usage: `?warn @user <reason>`')] }) as unknown as undefined;
    }
    if (!(await hierarchyCheck(message, target))) return;

    db.addWarning(message.guild.id, target.id, message.author.id, reason);
    const total = db.getWarnings(message.guild.id, target.id).length;
    const embed = UIFactory.success('Member Warned', `${target} has been warned.\n**Reason:** ${reason}\n**Total warnings:** ${total}`);
    await safeReply(message, { embeds: [embed] });
    await actionLogger.log(message.guild, {
      title: '⚠️ Member Warned',
      description: `${target.user.tag} was warned by ${message.author.tag}.`,
      fields: [
        { name: 'Target', value: `${target} (\`${target.id}\`)`, inline: true },
        { name: 'Moderator', value: `${message.author}`, inline: true },
        { name: 'Reason', value: reason, inline: false },
      ],
      color: 0xFF8C00,
    });
  },

  async warnings(message: Message, args: string[]) {
    if (!message.guild) return;
    if (!(await guard(message, PermissionFlagsBits.ModerateMembers, null, 'warnings'))) return;
    const resolved = await resolveUserOrMember(message, args[0]);
    const target = resolved.user;
    if (!target) {
      return safeReply(message, { embeds: [UIFactory.error('Missing Target', 'Mention a member or provide a valid user ID. Usage: `?warnings <@user/user_id>`')] }) as unknown as undefined;
    }
    const warns = db.getWarnings(message.guild.id, target.id);
    if (!warns.length) {
      return safeReply(message, { embeds: [UIFactory.info('Clean Record', `${target} has no warnings.`)] }) as unknown as undefined;
    }
    const fields = warns.map((w, i) => ({
      name: `Warning #${i + 1}`,
      value: `**Reason:** ${w.reason}\n**Date:** <t:${Math.floor(w.timestamp / 1000)}:f>`,
      inline: false,
    }));
    const embed = UIFactory.premium(`Warnings — ${target.username}`, `Total: **${warns.length}**`, { fields });
    await safeReply(message, { embeds: [embed] });
  },

  async clearwarnings(message: Message, args: string[]) {
    if (!message.guild) return;
    if (!(await guard(message, PermissionFlagsBits.ModerateMembers, null, 'clearwarnings'))) return;
    const resolved = await resolveUserOrMember(message, args[0]);
    const target = resolved.member;
    if (!target) {
      return safeReply(message, { embeds: [UIFactory.error('Missing Target', 'Mention a member or provide a valid user ID. Usage: `?clearwarnings <@user/user_id>`')] }) as unknown as undefined;
    }
    if (!(await hierarchyCheck(message, target))) return;
    const count = db.clearWarnings(message.guild.id, target.id);
    const embed = UIFactory.success('Warnings Cleared', `Cleared **${count}** warning(s) for ${target}.`);
    await safeReply(message, { embeds: [embed] });
  },

  async kick(message: Message, args: string[]) {
    if (!message.guild) return;
    if (!(await guard(message, PermissionFlagsBits.KickMembers, PermissionFlagsBits.KickMembers, 'kick'))) return;
    const resolved = await resolveUserOrMember(message, args[0]);
    const target = resolved.member;
    if (!target) {
      return safeReply(message, { embeds: [UIFactory.error('Missing Target', 'Mention a member or provide a valid user ID. Usage: `?kick <@user/user_id> [reason]`')] }) as unknown as undefined;
    }
    const reason = args.slice(1).join(' ') || 'No reason provided';
    if (!(await hierarchyCheck(message, target))) return;
    try {
      await target.kick(reason);
      const embed = UIFactory.success('Member Kicked', `${target.user.tag} was kicked.\n**Reason:** ${reason}`);
      await safeReply(message, { embeds: [embed] });
      await actionLogger.log(message.guild, {
        title: '🔨 Member Kicked',
        description: `${target.user.tag} was kicked.`,
        fields: [
          { name: 'Target', value: `${target.user.tag} (\`${target.id}\`)`, inline: true },
          { name: 'Moderator', value: `${message.author.tag}`, inline: true },
          { name: 'Reason', value: reason, inline: false },
        ],
        color: 0xFF3E3E,
      });
    } catch (err: any) {
      await safeReply(message, { embeds: [UIFactory.error('Kick Failed', err.message)] });
    }
  },

  async ban(message: Message, args: string[]) {
    if (!message.guild) return;
    if (!(await guard(message, PermissionFlagsBits.BanMembers, PermissionFlagsBits.BanMembers, 'ban'))) return;
    const resolved = await resolveUserOrMember(message, args[0]);
    const targetUser = resolved.user;
    const targetMember = resolved.member;
    if (!targetUser) {
      return safeReply(message, { embeds: [UIFactory.error('Missing Target', 'Mention a user or provide a valid user ID. Usage: `?ban <@user/user_id> [reason]`')] }) as unknown as undefined;
    }
    const reason = args.slice(1).join(' ') || 'No reason provided';
    if (targetMember) {
      if (!(await hierarchyCheck(message, targetMember))) return;
    }
    try {
      await message.guild.bans.create(targetUser.id, { reason });
      const embed = UIFactory.success('User Banned', `${targetUser.tag} was banned.\n**Reason:** ${reason}`);
      await safeReply(message, { embeds: [embed] });
      await actionLogger.log(message.guild, {
        title: '🔨 Member Banned',
        description: `${targetUser.tag} was banned.`,
        fields: [
          { name: 'Target', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
          { name: 'Moderator', value: `${message.author.tag}`, inline: true },
          { name: 'Reason', value: reason, inline: false },
        ],
        color: 0xFF3E3E,
      });
    } catch (err: any) {
      await safeReply(message, { embeds: [UIFactory.error('Ban Failed', err.message)] });
    }
  },

  async unban(message: Message, args: string[]) {
    if (!message.guild) return;
    if (!(await guard(message, PermissionFlagsBits.BanMembers, PermissionFlagsBits.BanMembers, 'unban'))) return;
    const input = args[0];
    if (!input) {
      return safeReply(message, { embeds: [UIFactory.error('Missing Target', 'Provide a valid user ID, mention, or username. Usage: `?unban <user/user_id> [reason]`')] }) as unknown as undefined;
    }

    let userId = getUserId(input);

    if (!userId) {
      const cleanInput = input.replace(/^@/, '').toLowerCase();
      try {
        const bans = await message.guild.bans.fetch();
        const matchedBan = bans.find(ban => 
          ban.user.username.toLowerCase() === cleanInput ||
          ban.user.tag.toLowerCase() === cleanInput
        );
        if (matchedBan) {
          userId = matchedBan.user.id;
        }
      } catch (err: any) {
        // Quietly ignore
      }
    }

    userId = userId || input;
    const reason = args.slice(1).join(' ') || 'No reason provided';
    try {
      await message.guild.bans.remove(userId, reason);
      const embed = UIFactory.success('User Unbanned', `Unbanned \`${userId}\`.\n**Reason:** ${reason}`);
      await safeReply(message, { embeds: [embed] });
    } catch (err: any) {
      await safeReply(message, { embeds: [UIFactory.error('Unban Failed', err.message)] });
    }
  },

  async timeout(message: Message, args: string[]) {
    if (!message.guild) return;
    if (!(await guard(message, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.ModerateMembers, 'timeout'))) return;
    const resolved = await resolveUserOrMember(message, args[0]);
    const target = resolved.member;
    const durationStr = args[1];
    if (!target || !durationStr) {
      return safeReply(message, { embeds: [UIFactory.error('Usage', '`?timeout <@user/user_id> <minutes> [reason]`')] }) as unknown as undefined;
    }
    const minutes = parseInt(durationStr, 10);
    if (isNaN(minutes) || minutes < 1 || minutes > 10080) {
      return safeReply(message, { embeds: [UIFactory.error('Invalid Duration', 'Duration must be 1–10080 minutes.')] }) as unknown as undefined;
    }
    const reason = args.slice(2).join(' ') || 'No reason provided';
    if (!(await hierarchyCheck(message, target))) return;
    try {
      await target.timeout(minutes * 60 * 1000, reason);
      const embed = UIFactory.success('Member Timed Out', `${target.user.tag} timed out for **${minutes}m**.\n**Reason:** ${reason}`);
      await safeReply(message, { embeds: [embed] });
    } catch (err: any) {
      await safeReply(message, { embeds: [UIFactory.error('Timeout Failed', err.message)] });
    }
  },

  async untimeout(message: Message, args: string[]) {
    if (!message.guild) return;
    if (!(await guard(message, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.ModerateMembers, 'untimeout'))) return;
    const resolved = await resolveUserOrMember(message, args[0]);
    const target = resolved.member;
    if (!target) {
      return safeReply(message, { embeds: [UIFactory.error('Usage', '`?untimeout <@user/user_id> [reason]`')] }) as unknown as undefined;
    }
    const reason = args.slice(1).join(' ') || 'No reason provided';
    if (!(await hierarchyCheck(message, target))) return;
    try {
      await target.timeout(null, reason);
      const embed = UIFactory.success('Timeout Removed', `Removed timeout for ${target.user.tag}.`);
      await safeReply(message, { embeds: [embed] });
    } catch (err: any) {
      await safeReply(message, { embeds: [UIFactory.error('Failed', err.message)] });
    }
  },

  async purge(message: Message, args: string[]) {
    if (!message.guild || !message.channel.isTextBased()) return;
    if (!(await guard(message, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageMessages, 'purge'))) return;
    const amount = parseInt(args[0], 10);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return safeReply(message, { embeds: [UIFactory.error('Usage', '`?purge <1-100>`')] }) as unknown as undefined;
    }
    try {
      // Delete the command message first, then bulk delete the requested amount
      await message.delete().catch(() => {});
      const deleted = await (message.channel as any).bulkDelete(amount, true);
      const embed = UIFactory.success('Purge Complete', `Deleted **${deleted.size}** messages.`);
      const reply = await (message.channel as any).send({ embeds: [embed] });
      setTimeout(() => reply.delete().catch(() => {}), 4000);
    } catch (err: any) {
      await (message.channel as any).send({ embeds: [UIFactory.error('Purge Failed', err.message)] });
    }
  },

  async slowmode(message: Message, args: string[]) {
    if (!message.guild || !message.channel.isTextBased()) return;
    if (!(await guard(message, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageChannels, 'slowmode'))) return;
    const seconds = parseInt(args[0], 10);
    if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
      return safeReply(message, { embeds: [UIFactory.error('Usage', '`?slowmode <0-21600>`')] }) as unknown as undefined;
    }
    try {
      await (message.channel as any).setRateLimitPerUser(seconds);
      const embed = UIFactory.success('Slowmode Updated', seconds === 0 ? 'Slowmode disabled.' : `Slowmode set to **${seconds}s**.`);
      await safeReply(message, { embeds: [embed] });
    } catch (err: any) {
      await safeReply(message, { embeds: [UIFactory.error('Failed', err.message)] });
    }
  },

  async lock(message: Message) {
    if (!message.guild || !message.channel.isTextBased()) return;
    if (!(await guard(message, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageChannels, 'lock'))) return;
    try {
      await (message.channel as any).permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
      const embed = UIFactory.success('Channel Locked', `${message.channel} is now locked.`);
      await safeReply(message, { embeds: [embed] });
    } catch (err: any) {
      await safeReply(message, { embeds: [UIFactory.error('Failed', err.message)] });
    }
  },

  async unlock(message: Message) {
    if (!message.guild || !message.channel.isTextBased()) return;
    if (!(await guard(message, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageChannels, 'unlock'))) return;
    try {
      await (message.channel as any).permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
      const embed = UIFactory.success('Channel Unlocked', `${message.channel} is now unlocked.`);
      await safeReply(message, { embeds: [embed] });
    } catch (err: any) {
      await safeReply(message, { embeds: [UIFactory.error('Failed', err.message)] });
    }
  },

  async nickname(message: Message, args: string[]) {
    if (!message.guild) return;
    if (!(await guard(message, PermissionFlagsBits.ManageNicknames, PermissionFlagsBits.ManageNicknames, 'nickname'))) return;
    const resolved = await resolveUserOrMember(message, args[0]);
    const target = resolved.member;
    if (!target) {
      return safeReply(message, { embeds: [UIFactory.error('Usage', '`?nickname <@user/user_id> [new nickname]`')] }) as unknown as undefined;
    }
    const nick = args.slice(1).join(' ') || null;
    if (!(await hierarchyCheck(message, target))) return;
    try {
      await target.setNickname(nick);
      const embed = UIFactory.success('Nickname Updated', nick ? `Set to **${nick}**.` : 'Nickname reset.');
      await safeReply(message, { embeds: [embed] });
    } catch (err: any) {
      await safeReply(message, { embeds: [UIFactory.error('Failed', err.message)] });
    }
  },

  // ── Help ──
  async help(message: Message) {
    const prefixes = (await import('../config/index.js')).BOT_PREFIXES;
    const prefix = prefixes[0];
    const prefixDisplay = prefixes.map(p => `\`${p}\``).join('  ');
    const fields = [
      {
        name: '🎯  Active Prefixes',
        value: `>>> ${prefixDisplay}\nUse any of these before a command name!`,
        inline: false,
      },
      {
        name: '⚙️  Utility Commands',
        value: `>>> \`${prefix}ping\` • \`${prefix}avatar\` • \`${prefix}userinfo\` • \`${prefix}serverinfo\` • \`${prefix}afk\``,
        inline: false,
      },
      {
        name: '🛡️  Moderation Commands',
        value: `>>> \`${prefix}warn\` • \`${prefix}warnings\` • \`${prefix}clearwarnings\`\n` +
               `\`${prefix}kick\` • \`${prefix}ban\` • \`${prefix}unban\`\n` +
               `\`${prefix}timeout\` • \`${prefix}untimeout\` • \`${prefix}purge\`\n` +
               `\`${prefix}slowmode\` • \`${prefix}lock\` • \`${prefix}unlock\` • \`${prefix}nickname\``,
        inline: false,
      },
      {
        name: '💡  Pro-Tip',
        value: `> Slash commands (\`/\`) are also fully supported with interactive auto-completing options.\n> Example: \`${prefixes[1] || prefix}ping\` works the same as \`${prefix}ping\`!`,
        inline: false,
      },
    ];
    const embed = UIFactory.premium(
      `Velu Commands Help`,
      `**All Prefixes:** ${prefixDisplay}`,
      { fields }
    );
    await safeReply(message, { embeds: [embed] });
  },
};

// ─── Router ───────────────────────────────────────────────────────────────────

export async function handlePrefixCommand(message: Message): Promise<void> {
  const prefixes = (await import('../config/index.js')).BOT_PREFIXES;

  // Find which prefix was used (longest match first to avoid partial matches)
  const sortedPrefixes = [...prefixes].sort((a, b) => b.length - a.length);
  const matchedPrefix = sortedPrefixes.find(p => message.content.startsWith(p));
  if (!matchedPrefix) return;

  const args = message.content.slice(matchedPrefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();

  if (!commandName || !commands[commandName]) return;

  // Cooldown check
  const cooldownLeft = checkCooldown(message.author.id, commandName);
  if (cooldownLeft) {
    const embed = UIFactory.warning('Slow Down', `Please wait **${cooldownLeft}s** before using \`${matchedPrefix}${commandName}\` again.`);
    const reply = await safeReply(message, { embeds: [embed] });
    if (reply) setTimeout(() => reply.delete().catch(() => {}), 3000);
    return;
  }

  try {
    logger.debug(`Executing prefix command ${matchedPrefix}${commandName} for User: ${message.author.tag}`);
    await commands[commandName](message, args);
  } catch (err: any) {
    logger.error(`Error in prefix command ${commandName}:`, err);
    await safeReply(message, { embeds: [UIFactory.error('Command Error', 'An unexpected error occurred.')] });
  }
}
