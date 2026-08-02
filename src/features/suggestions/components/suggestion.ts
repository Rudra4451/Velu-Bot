import { ButtonInteraction, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';
import type { ComponentContext } from '../../../types/index.js';

export const namespace = 'suggestion';

export async function execute(interaction: ButtonInteraction, context: ComponentContext): Promise<void> {
  const { action } = context;
  const message = interaction.message;
  
  if (!message.embeds[0]) return;
  
  const embed = EmbedBuilder.from(message.embeds[0]);
  const buttons = (message.components[0] as any).components.map((c: any) => ButtonBuilder.from(c));

  if (action === 'upvote' || action === 'downvote') {
    let btnIndex = action === 'upvote' ? 0 : 1;
    const btn = buttons[btnIndex];
    
    const currentCount = parseInt((btn.data as any).label || '0', 10);
    btn.setLabel((currentCount + 1).toString());
    
    const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
    await interaction.update({ components: [newRow] });
    return;
  }

  if (action === 'accept' || action === 'decline') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return await middleware.safeReply(interaction, { embeds: [UIFactory.error('Denied', 'You do not have permission to moderate suggestions.')], ephemeral: true }) as unknown as void;
    }

    const isAccept = action === 'accept';
    embed.setColor(isAccept ? 0x00FF00 : 0xFF0000);
    embed.setTitle(isAccept ? '✅ Suggestion Accepted' : '❌ Suggestion Declined');
    embed.addFields({ name: `Moderator Note (${interaction.user.tag})`, value: 'Status updated.' });

    // Disable all buttons
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].setDisabled(true);
    }
    
    const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
    await interaction.update({ embeds: [embed], components: [newRow] });
    
    // Lock thread if exists
    if (message.hasThread) {
      await message.thread?.setLocked(true, `Suggestion ${action}ed`);
      await message.thread?.setArchived(true);
    }
  }
}
