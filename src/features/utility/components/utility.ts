import type { ButtonInteraction } from 'discord.js';
import { stateManager } from '../../../core/stateManager.js';
import { renderPollEmbed } from '../commands/poll.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';
import type { ComponentHandler } from '../../../types/index.js';

export const namespace = 'utility';

export const execute: ComponentHandler['execute'] = async (interaction, context) => {
  const { action, data } = context;

  if (action === 'poll' && interaction.isButton()) {
    const { ref, idx } = data as { ref: string; idx: number };

    // Resolve the master poll state using the reference key
    // Reconstruct the master customId prefix
    const masterCustomId = `utility:poll_master|${ref}`;
    const resolvedMaster = stateManager.resolve(masterCustomId);

    if (resolvedMaster.expired || !resolvedMaster.data) {
      const expiredEmbed = UIFactory.warning(
        'Poll Expired',
        'This poll session has expired. Votes can no longer be recorded.'
      );
      return middleware.safeReply(interaction, { embeds: [expiredEmbed], ephemeral: true }) as unknown as undefined;
    }

    const pollState = resolvedMaster.data as any;

    // Prevent double voting
    if (pollState.voted.includes(interaction.user.id)) {
      const alreadyVotedEmbed = UIFactory.warning(
        'Already Voted',
        'You have already cast your vote in this poll.'
      );
      return middleware.safeReply(interaction, { embeds: [alreadyVotedEmbed], ephemeral: true }) as unknown as undefined;
    }

    // Cast vote
    pollState.votes[idx]++;
    pollState.voted.push(interaction.user.id);

    // Update the message
    const updatedEmbed = renderPollEmbed(pollState);
    await interaction.update({ embeds: [updatedEmbed] });
  }
};
