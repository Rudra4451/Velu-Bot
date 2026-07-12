import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { db } from '../../../state/db.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Configuration';
export const userPermission = PermissionFlagsBits.ManageGuild;
export const botPermission = null;

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('View and update bot configurations.')
  .addSubcommand(sub =>
    sub.setName('view')
      .setDescription('View all server settings.')
  )
  .addSubcommand(sub =>
    sub.setName('welcome')
      .setDescription('Update welcome system parameters.')
      .addChannelOption(opt => opt.setName('channel').setDescription('Welcome notifications channel').setRequired(false))
      .addStringOption(opt => opt.setName('message').setDescription('Welcome message content').setRequired(false))
      .addBooleanOption(opt => opt.setName('enabled').setDescription('Toggle welcome system').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('logs')
      .setDescription('Update audit logging parameters.')
      .addChannelOption(opt => opt.setName('channel').setDescription('Audit logs channel').setRequired(false))
      .addBooleanOption(opt => opt.setName('enabled').setDescription('Toggle logging system').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('autorole')
      .setDescription('Update the auto role given on join.')
      .addRoleOption(opt => opt.setName('role').setDescription('Auto role').setRequired(true))
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (subcommand === 'view') {
    const config = db.getConfig(guildId);

    const welcomeChannel = config.welcomeChannel ? `<#${config.welcomeChannel}>` : '_None_';
    const welcomeStatus = config.welcomeEnabled ? '🟩 Enabled' : '🟥 Disabled';
    const welcomeRole = config.welcomeAutoRole ? `<@&${config.welcomeAutoRole}>` : '_None_';

    const logChannel = config.logChannel ? `<#${config.logChannel}>` : '_None_';
    const logStatus = config.logEnabled ? '🟩 Enabled' : '🟥 Disabled';

    const fields = [
      { name: '👋 Welcome System', value: `**Status:** ${welcomeStatus}\n**Channel:** ${welcomeChannel}\n**Auto-Role:** ${welcomeRole}\n**Text:** \`${config.welcomeMessage}\``, inline: false },
      { name: '🪵 Audit Logging', value: `**Status:** ${logStatus}\n**Channel:** ${logChannel}`, inline: false }
    ];

    const embed = UIFactory.premium('✦ Server Configuration', 'Current Velu Bot settings for this server:', { fields });
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'welcome') {
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');
    const enabled = interaction.options.getBoolean('enabled');

    if (channel) db.updateConfig(guildId, 'welcomeChannel', channel.id);
    if (message) db.updateConfig(guildId, 'welcomeMessage', message);
    if (enabled !== null) db.updateConfig(guildId, 'welcomeEnabled', enabled);

    const embed = UIFactory.success('Welcome Config Updated', 'Welcome settings have been successfully updated.');
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'logs') {
    const channel = interaction.options.getChannel('channel');
    const enabled = interaction.options.getBoolean('enabled');

    if (channel) db.updateConfig(guildId, 'logChannel', channel.id);
    if (enabled !== null) db.updateConfig(guildId, 'logEnabled', enabled);

    const embed = UIFactory.success('Logs Config Updated', 'Audit log settings have been successfully updated.');
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'autorole') {
    const role = interaction.options.getRole('role');
    db.updateConfig(guildId, 'welcomeAutoRole', role.id);

    const embed = UIFactory.success('Auto Role Updated', `Members will now be assigned the ${role} role upon joining.`);
    return middleware.safeReply(interaction, { embeds: [embed] });
  }
}
