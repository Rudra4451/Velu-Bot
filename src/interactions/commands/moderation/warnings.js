import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { db } from '../../../state/db.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Moderation';
export const userPermission = PermissionFlagsBits.ModerateMembers;
export const botPermission = null;

export const data = new SlashCommandBuilder()
  .setName('warnings')
  .setDescription('View warnings of a member.')
  .addUserOption(opt => opt.setName('target').setDescription('Member to check').setRequired(true));

export async function execute(interaction) {
  const target = interaction.options.getUser('target');
  const userWarns = db.getWarnings(interaction.guild.id, target.id);

  if (userWarns.length === 0) {
    const embed = UIFactory.info('Clean Record', `${target} has no warnings.`);
    return middleware.safeReply(interaction, { embeds: [embed] });
  }

  const fields = userWarns.map((warn, index) => ({
    name: `Warning #${index + 1} | ID: ${warn.id}`,
    value: `**Moderator:** <@${warn.moderatorId}>\n**Reason:** ${warn.reason}\n**Date:** <t:${Math.floor(warn.timestamp / 1000)}:f>`,
    inline: false
  }));

  const embed = UIFactory.premium(
    `✦ Warnings for ${target.username}`,
    `Total warnings active: **${userWarns.length}**`,
    { fields }
  );

  return middleware.safeReply(interaction, { embeds: [embed] });
}
