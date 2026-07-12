import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { db } from '../../../state/db.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Configuration';
export const userPermission = PermissionFlagsBits.ManageGuild;
export const botPermission = null;

export const data = new SlashCommandBuilder()
  .setName('goodbye')
  .setDescription('Manage the premium goodbye notifications system.')
  .addSubcommand(sub =>
    sub.setName('setup')
      .setDescription('Setup the goodbye channel.')
      .addChannelOption(opt => opt.setName('channel').setDescription('Goodbye channel').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('disable')
      .setDescription('Disable the goodbye notifications.')
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (subcommand === 'setup') {
    const channel = interaction.options.getChannel('channel');
    db.updateConfig(guildId, 'goodbyeEnabled', true);
    db.updateConfig(guildId, 'goodbyeChannel', channel.id);

    const embed = UIFactory.success('Goodbye System Enabled', `Goodbye announcements configured successfully in ${channel}.`);
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  if (subcommand === 'disable') {
    db.updateConfig(guildId, 'goodbyeEnabled', false);
    const embed = UIFactory.success('Goodbye System Disabled', 'Goodbye announcements have been disabled.');
    return middleware.safeReply(interaction, { embeds: [embed] });
  }
}
