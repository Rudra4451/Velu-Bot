import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';

export const data = buildSocialCommand('bite', 'Bite another user.');

export async function execute(interaction) {
  await executeSocial(
    interaction,
    'bite',
    (user, target) => `🦷 ${user} nibbles and bites ${target}!`,
    (user) => `🦷 ${user} bites their lip.`
  );
}
