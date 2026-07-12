import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';

export const data = buildSocialCommand('pat', 'Pat another user on the head.');

export async function execute(interaction) {
  await executeSocial(
    interaction,
    'pat',
    (user, target) => `👋 ${user} gently pats ${target} on the head!`,
    (user) => `👋 ${user} pats their own head.`
  );
}
