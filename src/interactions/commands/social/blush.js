import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';

export const data = buildSocialCommand('blush', 'Blush or act shy.', false);

export async function execute(interaction) {
  await executeSocial(
    interaction,
    'blush',
    (user, target) => `😳 ${user} blushes crimson red looking at ${target}...`,
    (user) => `😳 ${user} blushes shyly.`
  );
}
