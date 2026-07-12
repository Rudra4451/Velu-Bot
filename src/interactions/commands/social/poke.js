import { buildSocialCommand, executeSocial } from '../../../utils/socialHelper.js';

export const data = buildSocialCommand('poke', 'Poke another user.');

export async function execute(interaction) {
  await executeSocial(
    interaction,
    'poke',
    (user, target) => `👉 ${user} pokes ${target}! Hey!`,
    (user) => `👉 ${user} pokes their own cheek.`
  );
}
