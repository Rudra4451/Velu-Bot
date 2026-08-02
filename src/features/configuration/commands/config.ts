import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { guildStorage } from '../../../database/repositories/GuildRepository.js';
import { warningStorage } from '../../../database/repositories/WarningRepository.js';
import { afkStorage } from '../../../database/repositories/AfkRepository.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Configuration';
export const userPermission = PermissionFlagsBits.ManageGuild;
export const botPermission = null;

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Manage all server settings in one place.')

  // ── VIEW ──────────────────────────────────────────────────────────────────
  .addSubcommand(sub =>
    sub.setName('view').setDescription('View all current server configuration.')
  )
  .addSubcommand(sub =>
    sub.setName('reset').setDescription('Reset all bot configurations for this server.')
  )

  // ── WELCOME ───────────────────────────────────────────────────────────────
  .addSubcommand(sub =>
    sub.setName('welcome')
      .setDescription('Configure the welcome system.')
      .addChannelOption(opt => opt.setName('channel').setDescription('Welcome channel').setRequired(false))
      .addStringOption(opt => opt.setName('message').setDescription('Welcome text (use {member} or {server})').setRequired(false))
      .addRoleOption(opt => opt.setName('autorole').setDescription('Auto-role for joining members').setRequired(false))
      .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable the welcome system').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('welcome-preview').setDescription('Preview the current welcome message.')
  )

  // ── GOODBYE ───────────────────────────────────────────────────────────────
  .addSubcommand(sub =>
    sub.setName('goodbye')
      .setDescription('Configure the goodbye system.')
      .addChannelOption(opt => opt.setName('channel').setDescription('Goodbye channel').setRequired(false))
      .addStringOption(opt => opt.setName('message').setDescription('Goodbye text (use {member} or {server})').setRequired(false))
      .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable goodbye messages').setRequired(false))
  )

  // ── LOGS ──────────────────────────────────────────────────────────────────
  .addSubcommand(sub =>
    sub.setName('logs')
      .setDescription('Configure the audit logging system.')
      .addChannelOption(opt => opt.setName('channel').setDescription('Audit logs channel').setRequired(false))
      .addBooleanOption(opt => opt.setName('enabled').setDescription('Toggle audit logging').setRequired(false))
  )

  // ── AUTOMOD ───────────────────────────────────────────────────────────────
  .addSubcommand(sub =>
    sub.setName('automod')
      .setDescription('Configure the auto-moderation system.')
      .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable automod entirely').setRequired(false))
      .addBooleanOption(opt => opt.setName('spam_filter').setDescription('Delete repeated/rapid spam messages').setRequired(false))
      .addBooleanOption(opt => opt.setName('block_invites').setDescription('Delete Discord invite links from non-mods').setRequired(false))
      .addBooleanOption(opt => opt.setName('badwords').setDescription('Delete messages containing flagged words').setRequired(false))
      .addStringOption(opt => opt.setName('badwords_list').setDescription('Comma-separated list of banned words (e.g. badword1,badword2)').setRequired(false))
  )

  // ── PERMISSIONS ───────────────────────────────────────────────────────────
  .addSubcommand(sub =>
    sub.setName('permissions-add')
      .setDescription('Grant a role access to a command or module.')
      .addStringOption(opt =>
        opt.setName('target')
          .setDescription('Command name (e.g. "ban") or Module name (e.g. "Moderation")')
          .setRequired(true)
      )
      .addRoleOption(opt => opt.setName('role').setDescription('Role to authorize').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('permissions-remove')
      .setDescription('Revoke a role\'s access to a command or module.')
      .addStringOption(opt =>
        opt.setName('target')
          .setDescription('Command or module name')
          .setRequired(true)
      )
      .addRoleOption(opt => opt.setName('role').setDescription('Role to revoke').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('permissions-list').setDescription('List all current custom permission overrides.')
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  // ── VIEW ──────────────────────────────────────────────────────────────────
  if (subcommand === 'view') {
    const config = guildStorage.get(guildId);

    const fields = [
      {
        name: '👋 Welcome System',
        value: [
          `**Status:** ${config.welcomeEnabled ? '🟩 Enabled' : '🟥 Disabled'}`,
          `**Channel:** ${config.welcomeChannel ? `<#${config.welcomeChannel}>` : '_Not set_'}`,
          `**Auto-Role:** ${config.welcomeAutoRole ? `<@&${config.welcomeAutoRole}>` : '_None_'}`,
          `**Text:** \`${config.welcomeMessage.slice(0, 50)}${config.welcomeMessage.length > 50 ? '...' : ''}\``,
        ].join('\n'),
        inline: false
      },
      {
        name: '👋 Goodbye System',
        value: [
          `**Status:** ${config.goodbyeEnabled ? '🟩 Enabled' : '🟥 Disabled'}`,
          `**Channel:** ${config.goodbyeChannel ? `<#${config.goodbyeChannel}>` : '_Not set_'}`,
          `**Text:** \`${config.goodbyeMessage.slice(0, 50)}${config.goodbyeMessage.length > 50 ? '...' : ''}\``,
        ].join('\n'),
        inline: false
      },
      {
        name: '🪵 Audit Logging',
        value: [
          `**Status:** ${config.logEnabled ? '🟩 Enabled' : '🟥 Disabled'}`,
          `**Channel:** ${config.logChannel ? `<#${config.logChannel}>` : '_Not set_'}`,
        ].join('\n'),
        inline: false
      },
      {
        name: '🛡️ Auto-Moderation',
        value: [
          `**Status:** ${config.automodEnabled ? '🟩 Enabled' : '🟥 Disabled'}`,
          `**Spam Filter:** ${config.automodSpamFilter ? '✅' : '❌'}`,
          `**Block Invites:** ${config.automodBlockInvites ? '✅' : '❌'}`,
          `**Bad Words:** ${config.automodBadwords ? '✅' : '❌'} _(${config.automodBadwordsList.length} words)_`,
        ].join('\n'),
        inline: false
      },
    ];

    const embed = UIFactory.premium('✦ Server Configuration', `Settings overview for **${interaction.guild.name}**`, { fields });
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  // ── RESET ──────────────────────────────────────────────────────────────────
  if (subcommand === 'reset') {
    guildStorage.delete(guildId);
    const embed = UIFactory.success('Configuration Reset', 'All bot settings for this server have been reset to defaults.');
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  // ── WELCOME ───────────────────────────────────────────────────────────────
  if (subcommand === 'welcome') {
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');
    const autorole = interaction.options.getRole('autorole');
    const enabled = interaction.options.getBoolean('enabled');

    const updates: any = {};
    if (channel) updates.welcomeChannel = channel.id;
    if (message) updates.welcomeMessage = message;
    if (autorole) updates.welcomeAutoRole = autorole.id;
    if (enabled !== null) updates.welcomeEnabled = enabled;

    if (Object.keys(updates).length > 0) {
      guildStorage.update(guildId, updates);
    }

    const embed = UIFactory.success('Welcome System Updated', 'Welcome settings have been saved.');
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'welcome-preview') {
    const config = guildStorage.get(guildId);
    if (!config.welcomeEnabled || !config.welcomeChannel) {
      const embed = UIFactory.warning('System Offline', 'The welcome system is disabled. Enable it with `/config welcome enabled:True`.');
      await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
      return;
    }

    await middleware.safeDefer(interaction);

    const welcomeText = config.welcomeMessage
      .replace('{member}', `${interaction.user}`)
      .replace('{server}', interaction.guild.name);

    const embed = UIFactory.premium('✦ Welcome Preview', welcomeText, {
      thumbnail: interaction.user.displayAvatarURL({ forceStatic: false } as any),
      timestamp: true,
      footerText: `Member #${interaction.guild.memberCount}`
    });

    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  // ── GOODBYE ───────────────────────────────────────────────────────────────
  if (subcommand === 'goodbye') {
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');
    const enabled = interaction.options.getBoolean('enabled');

    const updates: any = {};
    if (channel) updates.goodbyeChannel = channel.id;
    if (message) updates.goodbyeMessage = message;
    if (enabled !== null) updates.goodbyeEnabled = enabled;
    
    if (Object.keys(updates).length > 0) {
      guildStorage.update(guildId, updates);
    }

    const embed = UIFactory.success('Goodbye System Updated', 'Goodbye settings have been saved.');
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  // ── LOGS ──────────────────────────────────────────────────────────────────
  if (subcommand === 'logs') {
    const channel = interaction.options.getChannel('channel');
    const enabled = interaction.options.getBoolean('enabled');

    const updates: any = {};
    if (channel) updates.logChannel = channel.id;
    if (enabled !== null) updates.logEnabled = enabled;

    if (Object.keys(updates).length > 0) {
      guildStorage.update(guildId, updates);
    }

    const embed = UIFactory.success('Audit Logs Updated', 'Audit log settings have been saved.');
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  // ── AUTOMOD ───────────────────────────────────────────────────────────────
  if (subcommand === 'automod') {
    const enabled = interaction.options.getBoolean('enabled');
    const spamFilter = interaction.options.getBoolean('spam_filter');
    const blockInvites = interaction.options.getBoolean('block_invites');
    const badwords = interaction.options.getBoolean('badwords');
    const badwordsList = interaction.options.getString('badwords_list');

    const updates: any = {};
    if (enabled !== null) updates.automodEnabled = enabled;
    if (spamFilter !== null) updates.automodSpamFilter = spamFilter;
    if (blockInvites !== null) updates.automodBlockInvites = blockInvites;
    if (badwords !== null) updates.automodBadwords = badwords;
    if (badwordsList) {
      const words = badwordsList.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
      updates.automodBadwordsList = words;
    }
    
    if (Object.keys(updates).length > 0) {
      guildStorage.update(guildId, updates);
    }

    const config = guildStorage.get(guildId);
    const fields = [
      { name: '🛡️ Status', value: config.automodEnabled ? '🟩 Enabled' : '🟥 Disabled', inline: true },
      { name: '🔁 Spam Filter', value: config.automodSpamFilter ? '✅ On' : '❌ Off', inline: true },
      { name: '🔗 Block Invites', value: config.automodBlockInvites ? '✅ On' : '❌ Off', inline: true },
      { name: '🤬 Bad Words', value: config.automodBadwords ? `✅ On _(${config.automodBadwordsList.length} words)_` : '❌ Off', inline: true },
    ];

    const embed = UIFactory.success('Automod Updated', 'Auto-moderation settings have been saved.', { fields });
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  // ── PERMISSIONS ───────────────────────────────────────────────────────────
  if (subcommand === 'permissions-add') {
    const target = interaction.options.getString('target')!;
    const role = interaction.options.getRole('role')!;
    const config = guildStorage.get(guildId);
    const customPerms = config.customPermissions || {};
    if (!customPerms[target]) customPerms[target] = [];
    if (!customPerms[target].includes(role.id)) {
      customPerms[target].push(role.id);
      guildStorage.update(guildId, { customPermissions: customPerms });
    }
    const embed = UIFactory.success('Access Granted', `${role} can now execute \`${target.toLowerCase()}\`.`);
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'permissions-remove') {
    const target = interaction.options.getString('target')!;
    const role = interaction.options.getRole('role')!;
    const config = guildStorage.get(guildId);
    const customPerms = config.customPermissions || {};
    if (customPerms[target]) {
      customPerms[target] = customPerms[target].filter(id => id !== role.id);
      guildStorage.update(guildId, { customPermissions: customPerms });
    }
    const embed = UIFactory.success('Access Revoked', `${role} no longer has override access to \`${target.toLowerCase()}\`.`);
    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'permissions-list') {
    const config = guildStorage.get(guildId);
    const customPerms = config.customPermissions || {};
    const allPerms = Object.entries(customPerms);
    if (allPerms.length === 0) {
      const embed = UIFactory.info('Permission Overrides', 'No custom role overrides have been configured.');
      await middleware.safeReply(interaction, { embeds: [embed] });
      return;
    }

    const fields = [];
    for (const [target, roleIds] of allPerms) {
      if (roleIds.length === 0) continue;
      const rolesText = roleIds.map(id => `<@&${id}>`).join(', ');
      fields.push({ name: `🎯 \`${target}\``, value: `**Roles:** ${rolesText}`, inline: false });
    }

    if (fields.length === 0) {
      const embed = UIFactory.info('Permission Overrides', 'No custom role overrides have been configured.');
      await middleware.safeReply(interaction, { embeds: [embed] });
      return;
    }

    const embed = UIFactory.premium('✦ Permission Overrides', 'Custom role access overrides for this server:', { fields });
    await middleware.safeReply(interaction, { embeds: [embed] });
  }
}
