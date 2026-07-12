import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';

export const data = buildSocialCommand('wave', 'Wave to another user.', false);

export async function execute(interaction) {
  await executeSocial(
    interaction,
    'wave',
    (user, target) => `👋 ${user} waves warmly to ${target}!`,
    (user) => `👋 ${user} waves hello!`
  );
}
