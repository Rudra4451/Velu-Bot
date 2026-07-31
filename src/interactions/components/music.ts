import { ButtonInteraction } from 'discord.js';
import { musicService, createMusicControlRow } from '../../services/music.js';
import { UIFactory } from '../../ui/factory.js';
import { middleware } from '../../utils/middleware.js';
import type { VeluClient, ComponentContext } from '../../types/index.js';

export const namespace = 'music';

export async function execute(
  interaction: ButtonInteraction,
  payload: ComponentContext,
  client: VeluClient
): Promise<void> {
  if (!interaction.guild) return;

  const { action } = payload;
  const guildId = interaction.guild.id;

  try {
    switch (action) {
      case 'toggle_pause': {
        const { isPaused } = musicService.togglePause(guildId);
        const queueInfo = musicService.getQueueInfo(guildId);
        const repeatMode = queueInfo ? queueInfo.repeatMode : 0;
        const newRow = createMusicControlRow(isPaused, repeatMode);
        
        await interaction.update({ components: [newRow] });
        break;
      }

      case 'skip': {
        const success = musicService.skip(guildId);
        if (success) {
          const embed = UIFactory.success('Track Skipped', '⏭️ Skipped to the next track.');
          await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
        } else {
          const embed = UIFactory.warning('Cannot Skip', 'No track is currently playing or queue is empty.');
          await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
        }
        break;
      }

      case 'stop': {
        const success = musicService.stop(guildId);
        if (success) {
          const embed = UIFactory.error('Playback Stopped', '⏹️ Disconnected and cleared queue.');
          await middleware.safeReply(interaction, { embeds: [embed] });
        } else {
          const embed = UIFactory.warning('Not Playing', 'No active player to stop.');
          await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
        }
        break;
      }

      case 'loop': {
        const newMode = musicService.toggleLoop(guildId);
        const queueInfo = musicService.getQueueInfo(guildId);
        const isPaused = queueInfo ? queueInfo.paused : false;
        const newRow = createMusicControlRow(isPaused, newMode);

        const modeNames = ['Off 🛑', 'Track Loop 🔂', 'Queue Loop 🔁', 'Autoplay 📻 (Plays related songs)'];
        const embed = UIFactory.info('Loop / Autoplay Mode Updated', `Mode set to: **${modeNames[newMode] || 'Off'}**`);
        
        await interaction.update({ components: [newRow] });
        await interaction.followUp({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'queue': {
        const queueInfo = musicService.getQueueInfo(guildId);
        if (!queueInfo || queueInfo.songs.length === 0) {
          const embed = UIFactory.warning('Empty Queue', 'There are no tracks currently in queue.');
          await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
          return;
        }

        const np = queueInfo.songs[0];
        let description = `**Now Playing:**\n🎶 [${np.title}](${np.url}) - \`${np.duration}\`\n\n**Up Next:**\n`;
        
        if (queueInfo.songs.length === 1) {
          description += '*No upcoming tracks in queue.*';
        } else {
          for (let i = 1; i < Math.min(queueInfo.songs.length, 10); i++) {
            const song = queueInfo.songs[i];
            description += `**${i}.** [${song.title}](${song.url}) - \`${song.duration}\`\n`;
          }
          if (queueInfo.songs.length > 10) {
            description += `\n*...and ${queueInfo.songs.length - 10} more tracks.*`;
          }
        }

        const embed = UIFactory.premium('🎵 Current Music Queue', description, {
          thumbnail: np.thumbnail
        });

        await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
        break;
      }

      default: {
        const embed = UIFactory.warning('Unknown Action', `Music action \`${action}\` is not recognized.`);
        await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
        break;
      }
    }
  } catch (error: any) {
    const embed = UIFactory.error('Action Failed', error.message || 'An error occurred while processing music action.');
    await middleware.safeReply(interaction, { embeds: [embed], ephemeral: true });
  }
}
