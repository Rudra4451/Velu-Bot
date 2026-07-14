import { SlashCommandBuilder, PermissionFlagsBits, StringSelectMenuBuilder, ActionRowBuilder, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { stateManager } from '../../../state/manager.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Roles';
export const userPermission = PermissionFlagsBits.ManageRoles;
export const botPermission = PermissionFlagsBits.ManageRoles;

export const data = new SlashCommandBuilder()
  .setName('roles')
  .setDescription('Manage self-assign roles panels.')
  .addSubcommand(sub =>
    sub.setName('create')
      .setDescription('Create a new self-assign roles panel.')
      .addStringOption(opt => opt.setName('title').setDescription('Panel title').setRequired(true))
      .addStringOption(opt => opt.setName('description').setDescription('Panel description').setRequired(true))
      .addRoleOption(opt => opt.setName('role1').setDescription('First self-assignable role').setRequired(true))
      .addRoleOption(opt => opt.setName('role2').setDescription('Second self-assignable role').setRequired(false))
      .addRoleOption(opt => opt.setName('role3').setDescription('Third self-assignable role').setRequired(false))
      .addRoleOption(opt => opt.setName('role4').setDescription('Fourth self-assignable role').setRequired(false))
      .addRoleOption(opt => opt.setName('role5').setDescription('Fifth self-assignable role').setRequired(false))
      .addStringOption(opt =>
        opt.setName('type')
          .setDescription('Selection mode (Single or Multi-select)')
          .setRequired(false)
          .addChoices(
            { name: 'Single Role Select', value: 'single' },
            { name: 'Multi Role Select', value: 'multi' }
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName('edit')
      .setDescription('Edit an existing roles panel (requires the message ID).')
      .addStringOption(opt => opt.setName('message_id').setDescription('The Message ID of the roles panel').setRequired(true))
      .addStringOption(opt => opt.setName('title').setDescription('New panel title').setRequired(false))
      .addStringOption(opt => opt.setName('description').setDescription('New panel description').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('delete')
      .setDescription('Delete a roles panel (deletes the message).')
      .addStringOption(opt => opt.setName('message_id').setDescription('The Message ID of the roles panel').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction, client: any): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;

  if (subcommand === 'create') {
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const type = interaction.options.getString('type') || 'multi';

    const rawRoles = [
      interaction.options.getRole('role1'),
      interaction.options.getRole('role2'),
      interaction.options.getRole('role3'),
      interaction.options.getRole('role4'),
      interaction.options.getRole('role5')
    ].filter(Boolean);

    // Verify all roles are below bot in hierarchy
    const botMember = guild!.members.me;
    const invalidRoles = rawRoles.filter((role: any) => role.position >= botMember!.roles.highest.position);

    if (invalidRoles.length > 0) {
      const invalidMentions = invalidRoles.map((role: any) => `${role}`).join(', ');
      const embed = UIFactory.error(
        'Hierarchy Error',
        `I cannot manage the following roles because they are higher than or equal to my highest role: ${invalidMentions}`
      );
      await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
    }

    await middleware.safeDefer(interaction);

    const roleData = rawRoles.map((role: any) => ({ id: role.id, name: role.name }));

    // Create selection customId payload using stateManager
    const customId = stateManager.create('roles', 'select', {
      roles: roleData.map(r => r.id),
      type
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder('Select your roles...')
      .setMinValues(0)
      .setMaxValues(type === 'single' ? 1 : roleData.length)
      .addOptions(
        roleData.map(role => ({
          label: role.name,
          value: role.id,
          description: `Toggle the "${role.name}" role`
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const embed = UIFactory.premium(title, description);

    await (interaction.channel as any).send({ embeds: [embed], components: [row as any] });

    const replyEmbed = UIFactory.success('Panel Created', 'Self-assign roles panel has been successfully generated.');
    await middleware.safeReply(interaction, { embeds: [replyEmbed], ephemeral: true });
  }

  if (subcommand === 'edit') {
    const messageId = interaction.options.getString('message_id');
    const newTitle = interaction.options.getString('title');
    const newDescription = interaction.options.getString('description');

    await middleware.safeDefer(interaction, true);

    try {
      const msg = await (interaction.channel as any).messages.fetch(messageId);
      if (!msg || msg.author.id !== client.user.id) {
        throw new Error('Message not found or not sent by this bot.');
      }

      const oldEmbed = msg.embeds[0];
      if (!oldEmbed) throw new Error('Target message has no embed.');

      const embed = UIFactory.premium(
        newTitle || oldEmbed.title || 'Roles Selection',
        newDescription || oldEmbed.description || 'Select your roles below:'
      );

      await msg.edit({ embeds: [embed] });
      const replyEmbed = UIFactory.success('Panel Edited', 'Roles panel message has been successfully updated.');
      await middleware.safeReply(interaction, { embeds: [replyEmbed], ephemeral: true });
    } catch (err: any) {
      const embed = UIFactory.error('Edit Failed', `Could not edit roles panel: ${err.message}`);
      await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
    }
  }

  if (subcommand === 'delete') {
    const messageId = interaction.options.getString('message_id');

    await middleware.safeDefer(interaction, true);

    try {
      const msg = await (interaction.channel as any).messages.fetch(messageId);
      if (!msg) throw new Error('Message not found.');
      await msg.delete();

      const replyEmbed = UIFactory.success('Panel Deleted', 'Roles panel has been successfully deleted.');
      await middleware.safeReply(interaction, { embeds: [replyEmbed], ephemeral: true });
    } catch (err: any) {
      const embed = UIFactory.error('Delete Failed', `Could not delete roles panel: ${err.message}`);
      await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
    }
  }
}
