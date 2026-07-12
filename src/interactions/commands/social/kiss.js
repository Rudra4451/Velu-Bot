import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';

export const data = buildSocialCommand('kiss', 'Kiss another user.');

export async function execute(interaction) {
  await executeSocial(
    interaction,
    'kiss',
    (user, target) => `💋 ${user} kisses ${target} lovingly!`,
    (user) => `💋 ${user} blows a kiss into the mirror.`
  );
}
