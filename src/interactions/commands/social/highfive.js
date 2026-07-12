import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';

export const data = buildSocialCommand('highfive', 'Give another user a highfive.');

export async function execute(interaction) {
  await executeSocial(
    interaction,
    'highfive',
    (user, target) => `🙌 ${user} slaps hands in a high five with ${target}!`,
    (user) => `🙌 ${user} highfives the air.`
  );
}
