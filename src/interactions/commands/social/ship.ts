import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { klipyService } from '../../../services/klipy.js';
import { middleware } from '../../../utils/middleware.js';
import type { Command } from '../../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ship')
    .setDescription('Calculate the love compatibility between two users.')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The user to ship with.')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    const user = interaction.user;
    const target = interaction.options.getUser('target');
    if (!target) return;

    if (target.id === user.id) {
      const embed = UIFactory.warning('Self-Ship Detected', 'Self-love is valid, but you need to pick someone else!');
      await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true }) as unknown as undefined;
    }

    await middleware.safeDefer(interaction);

    // Deterministic score from user IDs — consistent for the same pair
    const score = (parseInt(user.id.slice(-4), 10) + parseInt(target.id.slice(-4), 10)) % 101;

    const filled = Math.round(score / 10);
    const meter = '❤️'.repeat(filled) + '🖤'.repeat(10 - filled);

    let verdict;
    if (score >= 90) verdict = '💖 Destined soulmates!';
    else if (score >= 70) verdict = '💞 High compatibility!';
    else if (score >= 40) verdict = '💛 A solid match.';
    else verdict = '💔 Unlikely pairing.';

    const description = [
      `${user} **×** ${target}`,
      '',
      `**${score}%** compatibility`,
      `\`${meter}\``,
      '',
      `_${verdict}_`,
    ].join('\n');

    const gifUrl = await klipyService.search('ship', 'anime love couple');

    const embed = UIFactory.premium('💘 Matchmaker', description, {
      image: gifUrl || undefined,
    });

    await middleware.safeReply(interaction, { embeds: [embed] });
  }
};

export const { data, execute } = command;
