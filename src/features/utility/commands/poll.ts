import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction } from 'discord.js';
import { UIFactory } from '../../../ui/factory.js';
import { stateManager } from '../../../core/stateManager.js';
import { middleware } from '../../../utils/middleware.js';

export const data = new SlashCommandBuilder()
  .setName('poll')
  .setDescription('Create an interactive poll with button vote choices.')
  .addStringOption(option =>
    option.setName('question')
      .setDescription('The poll question.')
      .setRequired(true)
      .setMaxLength(200)
  )
  .addStringOption(option =>
    option.setName('choices')
      .setDescription('2–5 choices separated by commas (e.g. Yes, No, Maybe).')
      .setRequired(true)
      .setMaxLength(300)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const question = interaction.options.getString('question');
  const choicesStr = interaction.options.getString('choices');

  const choices = choicesStr!.split(',').map(c => c.trim()).filter(Boolean);

  if (choices.length < 2 || choices.length > 5) {
    await middleware.safeReply(interaction, {
      embeds: [UIFactory.warning('Invalid Choices', 'Please provide between **2** and **5** comma-separated choices.')],
      ephemeral: true,
    });
  }

  // Validate individual choice lengths (Discord button labels ≤ 80 chars)
  const overlong = choices.find(c => c.length > 80);
  if (overlong) {
    await middleware.safeReply(interaction, {
      embeds: [UIFactory.warning('Choice Too Long', `Each choice must be 80 characters or fewer. Offending choice: "${overlong}"`)],
      ephemeral: true,
    });
  }

  const pollState = {
    question,
    choices,
    votes: Array(choices.length).fill(0),
    voted: [], // user IDs that have already voted
  };

  // Store the master poll state once, in-memory (shared mutable reference)
  const masterId = stateManager.create('utility', 'poll_master', pollState);
  const refKey = masterId.split('|')[1];

  const buttonRow = new ActionRowBuilder();
  choices.forEach((choice, idx) => {
    const customId = stateManager.create('utility', 'poll', { ref: refKey, idx });
    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(choice)
        .setStyle(ButtonStyle.Primary)
    );
  });

  const embed = renderPollEmbed(pollState);
  await middleware.safeReply(interaction, { embeds: [embed], components: [buttonRow as any] });
}

export function renderPollEmbed(pollState: any) {
  const totalVotes = pollState.votes.reduce((a: number, b: number) => a + b, 0);

  const fields = pollState.choices.map((choice: string, i: number) => {
    const count = pollState.votes[i];
    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    const filled = totalVotes > 0 ? Math.round((count / totalVotes) * 10) : 0;
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

    return {
      name: choice,
      value: `\`${bar}\` **${count}** vote(s) — ${pct}%`,
    };
  });

  return UIFactory.premium(
    `📊 ${pollState.question}`,
    `**Total votes:** ${totalVotes}`,
    { fields }
  );
}
