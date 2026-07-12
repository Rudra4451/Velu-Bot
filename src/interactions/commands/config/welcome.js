import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { db } from '../../../state/db.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';
import { klipyService } from '../../../services/klipy.js';

export const module = 'Configuration';
export const userPermission = PermissionFlagsBits.ManageGuild;
export const botPermission = null;

export const data = new SlashCommandBuilder()
  .setName('welcome')
  .setDescription('Manage the premium welcome message system.')
  .addSubcommand(sub =>
    sub.setName('setup')
      .setDescription('Enable and setup the welcome system.')
      .addChannelOption(opt => opt.setName('channel').setDescription('Welcome channel').setRequired(true))
      .addStringOption(opt => opt.setName('message').setDescription('Welcome text (use {member} or {server})').setRequired(false))
      .addRoleOption(opt => opt.setName('autorole').setDescription('Auto role for joining members').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('disable')
      .setDescription('Disable the welcome system.')
  )
  .addSubcommand(sub =>
    sub.setName('preview')
      .setDescription('Preview the current welcome notification.')
  )
  .addSubcommand(sub =>
    sub.setName('message')
      .setDescription('Update the welcome text.')
      .addStringOption(opt => opt.setName('text').setDescription('New welcome message').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('channel')
      .setDescription('Update the welcome channel.')
      .addChannelOption(opt => opt.setName('channel').setDescription('New welcome channel').setRequired(true))
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (subcommand === 'setup') {
    const channel = interaction.options.getChannel('channel');
    const messageText = interaction.options.getString('message') || 'Welcome {member} to {server}!';
    const autoRole = interaction.options.getRole('autorole');

    db.updateConfig(guildId, 'welcomeEnabled', true);
    db.updateConfig(guildId, 'welcomeChannel', channel.id);
    db.updateConfig(guildId, 'welcomeMessage', messageText);
    if (autoRole) {
      db.updateConfig(guildId, 'welcomeAutoRole', autoRole.id);
    }

    const embed = UIFactory.success(
      'Welcome System Enabled',
      `Welcome system configured successfully in ${channel}.\n**Text:** \`${messageText}\`${autoRole ? `\n**Auto-Role:** ${autoRole}` : ''}`
    );
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'disable') {
    db.updateConfig(guildId, 'welcomeEnabled', false);
    const embed = UIFactory.success('Welcome System Disabled', 'Welcome notifications have been disabled.');
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'preview') {
    const config = db.getConfig(guildId);
    if (!config.welcomeEnabled || !config.welcomeChannel) {
      const embed = UIFactory.warning('System Offline', 'The welcome system is currently disabled. Enable it with `/welcome setup`.');
      return middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
    }

    await middleware.safeDefer(interaction);
    const gifUrl = await klipyService.search('welcome', 'anime welcome cute');

    const welcomeText = config.welcomeMessage
      ? config.welcomeMessage.replace('{member}', `${interaction.user}`).replace('{server}', interaction.guild.name)
      : `Welcome ${interaction.user} to **${interaction.guild.name}**!`;

    const embed = UIFactory.premium('✦ Welcome Preview', welcomeText, {
      thumbnail: interaction.user.displayAvatarURL({ dynamic: true }),
      image: gifUrl || undefined,
      timestamp: true,
      footerText: `Member #${interaction.guild.memberCount}`,
    });

    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'message') {
    const text = interaction.options.getString('text');
    db.updateConfig(guildId, 'welcomeMessage', text);
    const embed = UIFactory.success('Welcome Text Updated', `New welcome message set to:\n\`${text}\``);
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'channel') {
    const channel = interaction.options.getChannel('channel');
    db.updateConfig(guildId, 'welcomeChannel', channel.id);
    const embed = UIFactory.success('Welcome Channel Updated', `Welcome notifications will now be sent in ${channel}.`);
    return middleware.safeReply(interaction, { embeds: [embed] });
  }
}
