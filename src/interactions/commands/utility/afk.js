import { SlashCommandBuilder } from 'discord.js';
import { db } from '../../../state/db.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';
import { klipyService } from '../../../services/klipy.js';

export const module = 'Utility';
export const data = new SlashCommandBuilder()
  .setName('afk')
  .setDescription('Set an Away From Keyboard status.')
  .addStringOption(opt =>
    opt.setName('reason')
      .setDescription('Reason for going AFK (optional).')
      .setRequired(false)
  );

export async function execute(interaction) {
  const reason = interaction.options.getString('reason') || 'I am currently AFK.';
  await middleware.safeDefer(interaction);

  const gifUrl = await klipyService.search('afk', 'anime sleep nap');

  db.setAFK(interaction.user.id, reason, gifUrl);

  const embed = UIFactory.premium(
    '💤 AFK Status Set',
    `I've set your status to AFK:\n> ${reason}\n\n*Sending a message in any server channel will remove your AFK status.*`,
    {
      image: gifUrl || undefined,
      footerText: 'Away From Keyboard',
      timestamp: false
    }
  );

  return middleware.safeReply(interaction, { embeds: [embed] });
}
