import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { db } from '../../../state/db.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Configuration';
export const userPermission = PermissionFlagsBits.Administrator;
export const botPermission = null;

export const data = new SlashCommandBuilder()
  .setName('permissions')
  .setDescription('Manage command and module role access overrides.')
  .addSubcommand(sub =>
    sub.setName('add')
      .setDescription('Grant a custom role access to a command or module.')
      .addStringOption(opt =>
        opt.setName('target')
          .setDescription('Command name (e.g. "ban") or Module name (e.g. "Moderation")')
          .setRequired(true)
      )
      .addRoleOption(opt => opt.setName('role').setDescription('Role to authorize').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('remove')
      .setDescription('Revoke custom role access from a command or module.')
      .addStringOption(opt =>
        opt.setName('target')
          .setDescription('Command or module name')
          .setRequired(true)
      )
      .addRoleOption(opt => opt.setName('role').setDescription('Role to revoke').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('list')
      .setDescription('List all current custom permission overrides.')
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (subcommand === 'add') {
    const target = interaction.options.getString('target');
    const role = interaction.options.getRole('role');
    db.addPermission(guildId, target, role.id);
    const embed = UIFactory.success(
      'Access Granted',
      `Members with the role ${role} can now execute command/module: \`${target.toLowerCase()}\`.`
    );
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'remove') {
    const target = interaction.options.getString('target');
    const role = interaction.options.getRole('role');
    db.removePermission(guildId, target, role.id);
    const embed = UIFactory.success(
      'Access Revoked',
      `Members with the role ${role} no longer have override access to command/module: \`${target.toLowerCase()}\`.`
    );
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'list') {
    const allPerms = db.getAllPermissions(guildId);
    if (allPerms.size === 0) {
      const embed = UIFactory.info('Custom Permissions', 'There are currently no custom role overrides configured.');
      return middleware.safeReply(interaction, { embeds: [embed] });
    }

    const fields = [];
    for (const [target, roleIds] of allPerms.entries()) {
      if (roleIds.length === 0) continue;
      const rolesText = roleIds.map(id => `<@&${id}>`).join(', ');
      fields.push({
        name: `🎯 Target: ${target}`,
        value: `**Allowed Roles:** ${rolesText}`,
        inline: false
      });
    }

    if (fields.length === 0) {
      const embed = UIFactory.info('Custom Permissions', 'There are currently no custom role overrides configured.');
      return middleware.safeReply(interaction, { embeds: [embed] });
    }

    const embed = UIFactory.premium('✦ Custom Permissions Overrides', 'List of role permission overrides currently configured in this guild:', { fields });
    return middleware.safeReply(interaction, { embeds: [embed] });
  }
}
