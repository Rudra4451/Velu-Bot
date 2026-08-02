import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { guildStorage } from '../../../database/repositories/GuildRepository.js';
import { warningStorage } from '../../../database/repositories/WarningRepository.js';
import { afkStorage } from '../../../database/repositories/AfkRepository.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Moderation';

export const data = new SlashCommandBuilder()
  .setName('security')
  .setDescription('Manage security and auto-moderation settings.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub.setName('status')
      .setDescription('View current security and auto-moderation status.')
  )
  .addSubcommand(sub =>
    sub.setName('automod')
      .setDescription('Toggle Auto-Moderation master switch.')
      .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable Auto-Mod').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('antispam')
      .setDescription('Toggle Anti-Spam protection.')
      .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable Anti-Spam').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('antiinvite')
      .setDescription('Toggle invite link blocking.')
      .addBooleanOption(opt => opt.setName('enabled').setDescription('Block Discord invite links').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('badwords')
      .setDescription('Toggle bad word filtering.')
      .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable bad word filter').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const guildId = interaction.guild.id;
  const subcommand = interaction.options.getSubcommand();
  const config = guildStorage.get(guildId);

  if (subcommand === 'status') {
    const statusText = 
      `🛡️ **Auto-Moderation Master Switch:** ${config.automodEnabled ? '🟢 `ENABLED`' : '🔴 `DISABLED`'}\n` +
      `⚡ **Anti-Spam Filter:** ${config.automodSpamFilter ? '🟢 `ACTIVE`' : '🔴 `INACTIVE`'}\n` +
      `🔗 **Anti-Invite Link Filter:** ${config.automodBlockInvites ? '🟢 `ACTIVE`' : '🔴 `INACTIVE`'}\n` +
      `🤬 **Bad Word Filter:** ${config.automodBadwords ? '🟢 `ACTIVE`' : '🔴 `INACTIVE`'}\n` +
      `📜 **Audit Logging:** ${config.logEnabled && config.logChannel ? `🟢 Channel: <#${config.logChannel}>` : '🔴 `DISABLED`'}`;

    const embed = UIFactory.premium('🛡️ Security & Auto-Mod Overview', statusText, {
      footerText: 'Velu Security Suite • Anti-Raid & Protection'
    });
    await middleware.safeReply(interaction, { embeds: [embed] });
    return;
  }

  const enabled = interaction.options.getBoolean('enabled', true);

  if (subcommand === 'automod') {
    guildStorage.update(guildId, { automodEnabled: enabled });
    const embed = UIFactory.success('Security Updated', `Auto-Moderation master switch set to: **${enabled ? 'ENABLED' : 'DISABLED'}**`);
    await middleware.safeReply(interaction, { embeds: [embed] });
  } else if (subcommand === 'antispam') {
    guildStorage.update(guildId, { automodSpamFilter: enabled });
    const embed = UIFactory.success('Security Updated', `Anti-Spam filter set to: **${enabled ? 'ACTIVE' : 'INACTIVE'}**`);
    await middleware.safeReply(interaction, { embeds: [embed] });
  } else if (subcommand === 'antiinvite') {
    guildStorage.update(guildId, { automodBlockInvites: enabled });
    const embed = UIFactory.success('Security Updated', `Anti-Invite link filter set to: **${enabled ? 'ACTIVE' : 'INACTIVE'}**`);
    await middleware.safeReply(interaction, { embeds: [embed] });
  } else if (subcommand === 'badwords') {
    guildStorage.update(guildId, { automodBadwords: enabled });
    const embed = UIFactory.success('Security Updated', `Bad word filter set to: **${enabled ? 'ACTIVE' : 'INACTIVE'}**`);
    await middleware.safeReply(interaction, { embeds: [embed] });
  }
}
