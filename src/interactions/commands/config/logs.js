import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { db } from '../../../state/db.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Configuration';
export const userPermission = PermissionFlagsBits.ManageGuild;
export const botPermission = null;

export const data = new SlashCommandBuilder()
  .setName('logs')
  .setDescription('Manage the logging system.')
  .addSubcommand(sub =>
    sub.setName('setup')
      .setDescription('Setup the audit logs channel.')
      .addChannelOption(opt => opt.setName('channel').setDescription('Logs channel').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('disable')
      .setDescription('Disable the logging system.')
  )
  .addSubcommand(sub =>
    sub.setName('view')
      .setDescription('View currently logged events and statuses.')
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (subcommand === 'setup') {
    const channel = interaction.options.getChannel('channel');
    db.updateConfig(guildId, 'logEnabled', true);
    db.updateConfig(guildId, 'logChannel', channel.id);

    const embed = UIFactory.success('Logging Enabled', `System audit logs configured in ${channel}.`);
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'disable') {
    db.updateConfig(guildId, 'logEnabled', false);
    const embed = UIFactory.success('Logging Disabled', 'System audit logs have been disabled.');
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'view') {
    const config = db.getConfig(guildId);
    const channel = config.logChannel ? `<#${config.logChannel}>` : '_None_';
    const status = config.logEnabled ? '🟩 Enabled' : '🟥 Disabled';

    const fields = [
      { name: 'Status', value: status, inline: true },
      { name: 'Channel', value: channel, inline: true },
      { name: 'Monitored Events', value: 'Messages, Members, Roles, Channels, Bans, Voice States', inline: false }
    ];

    const embed = UIFactory.premium('✦ Logging System Settings', 'All guild activity log configurations:', { fields });
    return middleware.safeReply(interaction, { embeds: [embed] });
  }
}
