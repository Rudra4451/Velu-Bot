import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';

export const data = buildSocialCommand('slap', 'Slap another user.');

export async function execute(interaction) {
  await executeSocial(
    interaction,
    'slap',
    (user, target) => `💥 ${user} slaps ${target} across the face! Ouch.`,
    (user) => `💥 ${user} slaps themselves... wait, why?`
  );
}
