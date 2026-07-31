import { ButtonBuilder, ButtonStyle, ActionRowBuilder, GuildMember } from 'discord.js';
import { db } from '../state/db.js';
import { actionLogger } from '../utils/actionLogger.js';
import { UIFactory } from '../ui/factory.js';
import { logger } from '../utils/logger.js';
import type { VeluClient, BotEvent } from '../types/index.js';

export const name = 'guildMemberAdd';
export const once = false;

export async function execute(member: GuildMember, client: VeluClient): Promise<void> {
  const guild = member.guild;
  const config = db.getConfig(guild.id);

  // 1. Auto-Role Assignment
  if (config.welcomeAutoRole) {
    try {
      const role = await guild.roles.fetch(config.welcomeAutoRole);
      if (role && guild.members.me!.roles.highest.position > role.position) {
        await member.roles.add(role);
        logger.debug(`Assigned auto-role ${role.name} to new member ${member.user.tag}`);
      }
    } catch (err: any) {
      logger.warn(`Failed to assign welcome auto-role for guild ${guild.id}: ${err.message}`);
    }
  }

  // 2. Premium Welcome Embed
  if (config.welcomeEnabled && config.welcomeChannel) {
    try {
      const channel = await guild.channels.fetch(config.welcomeChannel);
      if (channel && channel.isTextBased()) {
        const welcomeText = config.welcomeMessage
          ? config.welcomeMessage.replace('{member}', `${member}`).replace('{server}', guild.name)
          : `Welcome ${member} to **${guild.name}**! 🌸\nWe're so happy to have you here! Please make sure to read the rules and have fun! ✨`;

        const embed = UIFactory.premium('✦ New Member Joined', welcomeText, {
          thumbnail: member.user.displayAvatarURL({ forceStatic: false } as any),
          timestamp: true,
          footerText: `Member #${guild.memberCount}`,
        });

        // Add optional link buttons (using Discord's native channel link structures)
        const buttons = [];
        if (guild.rulesChannelId) {
          buttons.push(
            new ButtonBuilder()
              .setLabel('Rules')
              .setStyle(ButtonStyle.Link)
              .setURL(`https://discord.com/channels/${guild.id}/${guild.rulesChannelId}`)
          );
        }

        const components = [];
        if (buttons.length > 0) {
          components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons));
        }

        await (channel as any).send({ content: `${member}`, embeds: [embed], components });
      }
    } catch (err: any) {
      logger.error(`Failed to send welcome message for guild ${guild.id}:`, err);
    }
  }

  // 3. Log Member Join
  if (config.logEnabled) {
    const fields = [
      { name: 'Member', value: `${member} (${member.user.tag})`, inline: true },
      { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'ID', value: `\`${member.id}\``, inline: true }
    ];

    await actionLogger.log(guild, {
      title: '📥 Member Joined',
      description: `${member} joined the server.`,
      fields,
      color: 0x00FA9A // Neon Mint
    });
  }
}
