import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Roles';
export const userPermission = PermissionFlagsBits.ManageRoles;
export const botPermission = PermissionFlagsBits.ManageRoles;

export const data = new SlashCommandBuilder()
  .setName('role')
  .setDescription('Manage guild roles and member assignments.')
  .addSubcommand(sub =>
    sub.setName('create')
      .setDescription('Create a new role.')
      .addStringOption(opt => opt.setName('name').setDescription('Role name').setRequired(true))
      .addStringOption(opt => opt.setName('color').setDescription('Hex color code (e.g. #FF0000)').setRequired(false))
      .addBooleanOption(opt => opt.setName('hoist').setDescription('Display role separately').setRequired(false))
      .addBooleanOption(opt => opt.setName('mentionable').setDescription('Allow anyone to mention this role').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('delete')
      .setDescription('Delete an existing role.')
      .addRoleOption(opt => opt.setName('role').setDescription('Role to delete').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('rename')
      .setDescription('Rename a role.')
      .addRoleOption(opt => opt.setName('role').setDescription('Role to rename').setRequired(true))
      .addStringOption(opt => opt.setName('name').setDescription('New role name').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('color')
      .setDescription('Update role color.')
      .addRoleOption(opt => opt.setName('role').setDescription('Role to recolor').setRequired(true))
      .addStringOption(opt => opt.setName('hex').setDescription('New hex color code').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('hoist')
      .setDescription('Toggle display role separately.')
      .addRoleOption(opt => opt.setName('role').setDescription('Role to update').setRequired(true))
      .addBooleanOption(opt => opt.setName('status').setDescription('Hoist status').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('mentionable')
      .setDescription('Toggle role mentionable.')
      .addRoleOption(opt => opt.setName('role').setDescription('Role to update').setRequired(true))
      .addBooleanOption(opt => opt.setName('status').setDescription('Allow mentions').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('add')
      .setDescription('Add a role to a member.')
      .addUserOption(opt => opt.setName('target').setDescription('Member').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('remove')
      .setDescription('Remove a role from a member.')
      .addUserOption(opt => opt.setName('target').setDescription('Member').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('toggle')
      .setDescription('Toggle a role for a member.')
      .addUserOption(opt => opt.setName('target').setDescription('Member').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('Role to toggle').setRequired(true))
  );

function validateRoleHierarchy(interaction: any, role: any): { valid: boolean; reason?: string } {
  const { guild, member } = interaction;
  const botMember = guild.members.me;

  if (role.managed) {
    return { valid: false, reason: 'Managed roles (e.g. integration or bot roles) cannot be modified.' };
  }

  if (guild.ownerId !== member.id && role.position >= member.roles.highest.position) {
    return { valid: false, reason: 'This role is higher than or equal to your highest role.' };
  }

  if (role.position >= botMember.roles.highest.position) {
    return { valid: false, reason: 'This role is higher than or equal to my highest role.' };
  }

  return { valid: true };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;

  if (subcommand === 'create') {
    const name = interaction.options.getString('name')!;
    const color = interaction.options.getString('color') || '#000000';
    const hoist = interaction.options.getBoolean('hoist') || false;
    const mentionable = interaction.options.getBoolean('mentionable') || false;

    // Basic hex color code validation
    if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
      const embed = UIFactory.error('Invalid Color', 'Color must be a valid hex code (e.g., `#FF0000`).');
      await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
    }

    await middleware.safeDefer(interaction);

    try {
      const newRole = await guild.roles.create({
        name,
        color: (color as any) || undefined,
        hoist,
        mentionable,
        reason: `Role created by ${interaction.user.tag}`
      });
      const embed = UIFactory.success('Role Created', `Successfully created the role ${newRole}.`);
      await middleware.safeReply(interaction, { embeds: [embed] });
    } catch (err: any) {
      const embed = UIFactory.error('Failed', `Could not create role: ${err.message}`);
      await middleware.safeReply(interaction, { embeds: [embed] });
    }
  }

  // Get active role option for other subcommands
  const role = interaction.options.getRole('role') as any;
  if (role) {
    const check = validateRoleHierarchy(interaction, role);
    if (!check.valid) {
      const embed = UIFactory.error('Hierarchy Error', check.reason ?? 'Unknown hierarchy error');
      await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
    }
  }

  if (subcommand === 'delete') {
    await middleware.safeDefer(interaction);
    try {
      await role.delete(`Role deleted by ${interaction.user.tag}`);
      const embed = UIFactory.success('Role Deleted', `Successfully deleted the role **${role.name}**.`);
      await middleware.safeReply(interaction, { embeds: [embed] });
    } catch (err: any) {
      const embed = UIFactory.error('Failed', `Could not delete role: ${err.message}`);
      await middleware.safeReply(interaction, { embeds: [embed] });
    }
  }

  if (subcommand === 'rename') {
    const newName = interaction.options.getString('name')!;
    await middleware.safeDefer(interaction);
    try {
      await role.setName(newName, `Role renamed by ${interaction.user.tag}`);
      const embed = UIFactory.success('Role Renamed', `Role has been renamed to **${newName}**.`);
      await middleware.safeReply(interaction, { embeds: [embed] });
    } catch (err: any) {
      const embed = UIFactory.error('Failed', `Could not rename role: ${err.message}`);
      await middleware.safeReply(interaction, { embeds: [embed] });
    }
  }

  if (subcommand === 'color') {
    const hex = interaction.options.getString('hex')!;
    if (!/^#[0-9A-F]{6}$/i.test(hex)) {
      const embed = UIFactory.error('Invalid Color', 'Color must be a valid hex code (e.g., `#FF0000`).');
      await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
    }
    await middleware.safeDefer(interaction);
    try {
      await role.setColor(hex as any, `Role color updated by ${interaction.user.tag}`);
      const embed = UIFactory.success('Role Recolored', `Color for ${role} has been updated to **${hex}**.`);
      await middleware.safeReply(interaction, { embeds: [embed] });
    } catch (err: any) {
      const embed = UIFactory.error('Failed', `Could not update role color: ${err.message}`);
      await middleware.safeReply(interaction, { embeds: [embed] });
    }
  }

  if (subcommand === 'hoist') {
    const status = interaction.options.getBoolean('status');
    await middleware.safeDefer(interaction);
    try {
      await role.setHoist(status, `Role hoist updated by ${interaction.user.tag}`);
      const embed = UIFactory.success('Hoist Updated', `Role hoist status set to **${status}** for ${role}.`);
      await middleware.safeReply(interaction, { embeds: [embed] });
    } catch (err: any) {
      const embed = UIFactory.error('Failed', `Could not update role hoist: ${err.message}`);
      await middleware.safeReply(interaction, { embeds: [embed] });
    }
  }

  if (subcommand === 'mentionable') {
    const status = interaction.options.getBoolean('status');
    await middleware.safeDefer(interaction);
    try {
      await role.setMentionable(status, `Role mentionable updated by ${interaction.user.tag}`);
      const embed = UIFactory.success('Mentionable Updated', `Role mentionable status set to **${status}** for ${role}.`);
      await middleware.safeReply(interaction, { embeds: [embed] });
    } catch (err: any) {
      const embed = UIFactory.error('Failed', `Could not update role mentionable: ${err.message}`);
      await middleware.safeReply(interaction, { embeds: [embed] });
    }
  }

  // Member assignment subcommands
  const target = interaction.options.getMember('target') as any;
  if (!target) {
    const embed = UIFactory.error('Error', 'Target member not found in this server.');
    await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
  }

  if (subcommand === 'add') {
    if (target.roles.cache.has(role.id)) {
      const embed = UIFactory.warning('Duplicate Assignment', `${target} already has the role ${role}.`);
      await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
    }
    await middleware.safeDefer(interaction);
    try {
      await target.roles.add(role);
      const embed = UIFactory.success('Role Added', `Successfully added the role ${role} to ${target}.`);
      await middleware.safeReply(interaction, { embeds: [embed] });
    } catch (err: any) {
      const embed = UIFactory.error('Failed', `Could not add role: ${err.message}`);
      await middleware.safeReply(interaction, { embeds: [embed] });
    }
  }

  if (subcommand === 'remove') {
    if (!target.roles.cache.has(role.id)) {
      const embed = UIFactory.warning('Duplicate Removal', `${target} does not have the role ${role}.`);
      await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
    }
    await middleware.safeDefer(interaction);
    try {
      await target.roles.remove(role);
      const embed = UIFactory.success('Role Removed', `Successfully removed the role ${role} from ${target}.`);
      await middleware.safeReply(interaction, { embeds: [embed] });
    } catch (err: any) {
      const embed = UIFactory.error('Failed', `Could not remove role: ${err.message}`);
      await middleware.safeReply(interaction, { embeds: [embed] });
    }
  }

  if (subcommand === 'toggle') {
    const hasRole = target.roles.cache.has(role.id);
    await middleware.safeDefer(interaction);
    try {
      if (hasRole) {
        await target.roles.remove(role);
        const embed = UIFactory.success('Role Toggled', `Removed the role ${role} from ${target}.`);
        await middleware.safeReply(interaction, { embeds: [embed] });
      } else {
        await target.roles.add(role);
        const embed = UIFactory.success('Role Toggled', `Added the role ${role} to ${target}.`);
        await middleware.safeReply(interaction, { embeds: [embed] });
      }
    } catch (err: any) {
      const embed = UIFactory.error('Failed', `Could not toggle role: ${err.message}`);
      await middleware.safeReply(interaction, { embeds: [embed] });
    }
  }
}
