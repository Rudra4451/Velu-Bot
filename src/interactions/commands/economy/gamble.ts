import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { db } from '../../../state/db.js';
import { UIFactory } from '../../../ui/factory.js';
import { middleware } from '../../../utils/middleware.js';

export const module = 'Economy';

export const data = new SlashCommandBuilder()
  .setName('gamble')
  .setDescription('Try your luck and gamble your 🍡 Pastel Coins!')
  .addSubcommand(sub =>
    sub.setName('slots')
      .setDescription('Spin the slot machine and win big (or lose it all).')
      .addIntegerOption(opt =>
        opt.setName('bet')
          .setDescription('Amount of coins to bet (min 10, max 10,000)')
          .setRequired(true)
          .setMinValue(10)
          .setMaxValue(10000)
      )
  )
  .addSubcommand(sub =>
    sub.setName('flip')
      .setDescription('Bet on a coin flip — double or nothing!')
      .addIntegerOption(opt =>
        opt.setName('bet')
          .setDescription('Amount of coins to bet (min 10, max 10,000)')
          .setRequired(true)
          .setMinValue(10)
          .setMaxValue(10000)
      )
      .addStringOption(opt =>
        opt.setName('side')
          .setDescription('Which side do you bet on?')
          .setRequired(true)
          .addChoices(
            { name: '🪙 Heads', value: 'heads' },
            { name: '🔄 Tails', value: 'tails' }
          )
      )
  );

// Slot machine symbols & their rarity weights
const SLOTS = [
  { symbol: '🍒', weight: 40 },  // Common
  { symbol: '🍋', weight: 30 },  // Common
  { symbol: '🍊', weight: 20 },  // Uncommon
  { symbol: '⭐', weight: 7 },   // Rare
  { symbol: '💎', weight: 2 },   // Ultra rare
  { symbol: '🌸', weight: 1 },   // Legendary
];

// Multipliers for matching 3 symbols
const MULTIPLIERS: Record<string, number> = {
  '🍒': 1.5,
  '🍋': 2.0,
  '🍊': 3.0,
  '⭐': 5.0,
  '💎': 10.0,
  '🌸': 25.0,
};

function spinSlot(): string {
  const totalWeight = SLOTS.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.random() * totalWeight;
  for (const slot of SLOTS) {
    random -= slot.weight;
    if (random <= 0) return slot.symbol;
  }
  return SLOTS[0].symbol;
}

const GAMBLE_COOLDOWNS = new Map<string, number>();
const COOLDOWN_MS = 10 * 1000; // 10-second anti-spam

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  // Anti-spam cooldown
  const cooldownKey = `${userId}:${subcommand}`;
  const lastUsed = GAMBLE_COOLDOWNS.get(cooldownKey) || 0;
  const now = Date.now();
  if (now - lastUsed < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (now - lastUsed)) / 1000);
    const embed = UIFactory.warning('Slow Down!', `You can gamble again in **${remaining}s**.`);
    await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
    return;
  }
  GAMBLE_COOLDOWNS.set(cooldownKey, now);

  const bet = interaction.options.getInteger('bet')!;
  const eco = db.getEconomy(guildId, userId);

  if (eco.coins < bet) {
    const embed = UIFactory.error('Insufficient Funds', `You only have **${eco.coins}** 🍡 coins. You can't bet **${bet}**.`);
    await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
    return;
  }

  // ── SLOTS ─────────────────────────────────────────────────────────────────
  if (subcommand === 'slots') {
    const reels = [spinSlot(), spinSlot(), spinSlot()];
    const display = reels.join(' | ');

    let winnings = 0;
    let resultText = '';

    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      // Three of a kind
      const multiplier = MULTIPLIERS[reels[0]] || 2.0;
      winnings = Math.floor(bet * multiplier);
      resultText = `🎉 **JACKPOT!** Three ${reels[0]}s! You win **+${winnings}** 🍡 coins! _(×${multiplier})_`;
    } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
      // Two of a kind
      winnings = Math.floor(bet * 0.5);
      resultText = `😊 **Two of a kind!** You get half back — **+${winnings}** 🍡 coins.`;
    } else {
      // Loss
      winnings = -bet;
      resultText = `😞 **No match.** You lost **${bet}** 🍡 coins. Better luck next time!`;
    }

    const newBalance = eco.coins + winnings;
    db.updateEconomy(guildId, userId, { coins: newBalance });

    const isWin = winnings > 0;
    const embed = (isWin ? UIFactory.success : UIFactory.premium)(
      isWin ? '🎰 Slot Machine — Win!' : '🎰 Slot Machine — Loss',
      `[ ${display} ]\n\n${resultText}`,
      {
        fields: [
          { name: '💰 Bet', value: `${bet} 🍡`, inline: true },
          { name: `${isWin ? '🏆' : '💸'} ${isWin ? 'Winnings' : 'Loss'}`, value: `${Math.abs(winnings)} 🍡`, inline: true },
          { name: '💳 New Balance', value: `${newBalance} 🍡`, inline: true }
        ]
      }
    ) as any;

    await middleware.safeReply(interaction, { embeds: [embed] });
  }

  // ── FLIP ──────────────────────────────────────────────────────────────────
  if (subcommand === 'flip') {
    const side = interaction.options.getString('side')!;
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = result === side;

    const change = won ? bet : -bet;
    const newBalance = eco.coins + change;
    db.updateEconomy(guildId, userId, { coins: newBalance });

    const resultEmoji = result === 'heads' ? '🪙 Heads' : '🔄 Tails';
    const resultText = won
      ? `The coin landed on **${resultEmoji}** — that's what you picked! 🎉\nYou win **+${bet}** 🍡 coins!`
      : `The coin landed on **${resultEmoji}** — you picked ${side === 'heads' ? '🪙 Heads' : '🔄 Tails'}.\nYou lost **${bet}** 🍡 coins.`;

    const embed = (won ? UIFactory.success : UIFactory.premium)(
      won ? '🪙 Coin Flip — Win!' : '🪙 Coin Flip — Loss',
      resultText,
      {
        fields: [
          { name: '🎯 Your Bet', value: `${side === 'heads' ? '🪙 Heads' : '🔄 Tails'}`, inline: true },
          { name: '🪙 Result', value: resultEmoji, inline: true },
          { name: '💳 New Balance', value: `${newBalance} 🍡`, inline: true }
        ]
      }
    ) as any;

    await middleware.safeReply(interaction, { embeds: [embed] });
  }
}
