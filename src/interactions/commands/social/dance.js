import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';

export const data = buildSocialCommand('dance', 'Start dancing.', false);

export async function execute(interaction) {
  await executeSocial(
    interaction,
    'dance',
    (user, target) => `💃 ${user} grooves and dances with ${target}!`,
    (user) => `💃 ${user} starts busting some moves and dancing!`
  );
}
