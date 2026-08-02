import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, TextChannel } from 'discord.js';
import { reactionRoleStorage } from '../../../database/repositories/ReactionRoleRepository.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Roles';

export const data = new SlashCommandBuilder()
  .setName('reactionrole')
  .setDescription('Manage reaction roles.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommand(sub =>
    sub.setName('add')
      .setDescription('Add a reaction role to a message.')
      .addStringOption(opt => opt.setName('message_id').setDescription('The ID of the message').setRequired(true))
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel of the message').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption(opt => opt.setName('emoji').setDescription('The emoji to react with').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('The role to give').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('remove')
      .setDescription('Remove a reaction role.')
      .addStringOption(opt => opt.setName('message_id').setDescription('The ID of the message').setRequired(true))
      .addStringOption(opt => opt.setName('emoji').setDescription('The emoji').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (subcommand === 'add') {
    const messageId = interaction.options.getString('message_id')!;
    const channel = interaction.options.getChannel('channel') as TextChannel;
    const emoji = interaction.options.getString('emoji')!;
    const role = interaction.options.getRole('role')!;

    await middleware.safeDefer(interaction, true);

    try {
      const msg = await channel.messages.fetch(messageId);
      await msg.react(emoji); // Validate emoji
      
      const configs = reactionRoleStorage.get(guildId) || [];
      let config = configs.find(c => c.messageId === messageId);
      
      if (!config) {
        config = { messageId, channelId: channel.id, mappings: {} };
        configs.push(config);
      }
      
      config.mappings[emoji] = role.id;
      reactionRoleStorage.set(guildId, configs);

      const embed = UIFactory.success('Reaction Role Added', `Reacting with ${emoji} on [this message](${msg.url}) will now give ${role}.`);
      await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });

    } catch (err: any) {
      await middleware.safeReply(interaction, { embeds: [UIFactory.error('Failed', `Could not add reaction: ${err.message}`)], ephemeral: true });
    }
  }

  if (subcommand === 'remove') {
    const messageId = interaction.options.getString('message_id')!;
    const emoji = interaction.options.getString('emoji')!;

    const configs = reactionRoleStorage.get(guildId) || [];
    const config = configs.find(c => c.messageId === messageId);

    if (!config || !config.mappings[emoji]) {
      return await middleware.safeReply(interaction, { embeds: [UIFactory.error('Not Found', 'No reaction role found with that emoji on that message.')], ephemeral: true }) as unknown as void;
    }

    delete config.mappings[emoji];
    
    // Cleanup if empty
    if (Object.keys(config.mappings).length === 0) {
      reactionRoleStorage.set(guildId, configs.filter(c => c.messageId !== messageId));
    } else {
      reactionRoleStorage.set(guildId, configs);
    }

    const embed = UIFactory.success('Reaction Role Removed', `Removed reaction role for ${emoji} on message ID ${messageId}.`);
    await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
  }
}
