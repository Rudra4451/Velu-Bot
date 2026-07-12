import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';

export const data = buildSocialCommand('cry', 'Express sadness or cry.', false);

export async function execute(interaction) {
  await executeSocial(
    interaction,
    'cry',
    (user, target) => `😭 ${user} cries on ${target}'s shoulder.`,
    (user) => `😭 ${user} bursts into tears!`
  );
}
