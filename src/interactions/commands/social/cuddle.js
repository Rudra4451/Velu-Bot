import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';

export const data = buildSocialCommand('cuddle', 'Cuddle with another user.');

export async function execute(interaction) {
  await executeSocial(
    interaction,
    'cuddle',
    (user, target) => `🫂 ${user} snuggles and cuddles up close with ${target}!`,
    (user) => `🫂 ${user} cuddles with a soft pillow.`
  );
}
