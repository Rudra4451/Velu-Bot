import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';

export const data = buildSocialCommand('laugh', 'Laugh out loud.', false);

export async function execute(interaction) {
  await executeSocial(
    interaction,
    'laugh',
    (user, target) => `😆 ${user} laughs hysterically at ${target}!`,
    (user) => `😆 ${user} laughs out loud!`
  );
}
