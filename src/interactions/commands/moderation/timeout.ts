import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { permissionManager } from '../../../utils/permissionManager.js';
import { actionLogger } from '../../../utils/actionLogger.js';
import { klipyService } from '../../../services/klipy.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Moderation';
export const userPermission = PermissionFlagsBits.ModerateMembers;
export const botPermission = PermissionFlagsBits.ModerateMembers;

export const data = new SlashCommandBuilder()
  .setName('timeout')
  .setDescription('Manage timeouts for server members.')
  .addSubcommand(sub =>
    sub.setName('set')
      .setDescription('Time out a member (restrict chat/voice permissions).')
      .addUserOption(opt => opt.setName('target').setDescription('Member to timeout').setRequired(true))
      .addIntegerOption(opt =>
        opt.setName('duration')
          .setDescription('Timeout duration')
          .setRequired(true)
          .addChoices(
            { name: '1 Minute', value: 60 },
            { name: '5 Minutes', value: 300 },
            { name: '10 Minutes', value: 600 },
            { name: '1 Hour', value: 3600 },
            { name: '24 Hours', value: 86400 },
            { name: '7 Days', value: 604800 }
          )
      )
      .addStringOption(opt => opt.setName('reason').setDescription('Reason for timeout').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('remove')
      .setDescription('Remove timeout from a member.')
      .addUserOption(opt => opt.setName('target').setDescription('Member to untimeout').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason for removal').setRequired(false))
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();

  // ── SET (TIMEOUT) ─────────────────────────────────────────────────────────
  if (subcommand === 'set') {
    const target = interaction.options.getMember('target') as any;
    const duration = interaction.options.getInteger('duration')!;
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target) {
      const embed = UIFactory.error('Error', 'Target member not found in this server.');
      await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
      return;
    }

    if (!(await permissionManager.checkHierarchy(interaction, target))) return;

    await middleware.safeDefer(interaction);

    try {
      await target.timeout(duration * 1000, reason);
    } catch (err: any) {
      const embed = UIFactory.error('Timeout Failed', `Could not timeout ${target}: ${err.message}`);
      await middleware.safeReply(interaction, { embeds: [embed] });
      return;
    }

    const gifUrl = await klipyService.search('timeout', 'anime silence quiet tape');
    const durationText = duration < 3600 ? `${duration / 60} minutes` : `${duration / 3600} hours`;

    const embed = UIFactory.success('Member Timed Out',
      `${target.user.tag} has been timed out for **${durationText}**.\n**Reason:** ${reason}`,
      { image: gifUrl || undefined, timestamp: true }
    );
    await middleware.safeReply(interaction, { embeds: [embed] });

    await actionLogger.log(interaction.guild, {
      title: '🔇 Member Timed Out',
      description: `${target.user.tag} was timed out by ${interaction.user.tag}.`,
      fields: [
        { name: 'Target', value: `${target.user.tag} (\`${target.id}\`)`, inline: true },
        { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
        { name: 'Duration', value: durationText, inline: true },
        { name: 'Reason', value: reason, inline: false }
      ],
      color: 0xFF8C00
    });
  }

  // ── REMOVE (UNTIMEOUT) ────────────────────────────────────────────────────
  if (subcommand === 'remove') {
    const target = interaction.options.getMember('target') as any;
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target) {
      const embed = UIFactory.error('Error', 'Target member not found in this server.');
      await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
      return;
    }

    if (!(await permissionManager.checkHierarchy(interaction, target))) return;

    await middleware.safeDefer(interaction);

    try {
      await target.timeout(null, reason);
    } catch (err: any) {
      const embed = UIFactory.error('Untimeout Failed', `Could not remove timeout for ${target}: ${err.message}`);
      await middleware.safeReply(interaction, { embeds: [embed] });
      return;
    }

    const embed = UIFactory.success('Timeout Removed', `Successfully removed timeout for ${target.user.tag}.\n**Reason:** ${reason}`);
    await middleware.safeReply(interaction, { embeds: [embed] });

    await actionLogger.log(interaction.guild, {
      title: '🔊 Timeout Removed',
      description: `Timeout was removed for ${target.user.tag} by ${interaction.user.tag}.`,
      fields: [
        { name: 'Target', value: `${target.user.tag} (\`${target.id}\`)`, inline: true },
        { name: 'Moderator', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
        { name: 'Reason', value: reason, inline: false }
      ],
      color: 0x00FA9A
    });
  }
}
