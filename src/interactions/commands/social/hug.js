import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';

export const data = buildSocialCommand('hug', 'Hug another user.');

export async function execute(interaction) {
  await executeSocial(
    interaction,
    'hug',
    (user, target) => `🤗 ${user} wraps their arms tightly around ${target}!`,
    (user) => `🤗 ${user} hugs themselves softly.`
  );
}
