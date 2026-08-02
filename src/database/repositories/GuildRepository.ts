import { BaseRepository } from '../BaseRepository.js';
import type { GuildConfig } from '../../types/index.js';

export class GuildRepository extends BaseRepository<GuildConfig> {
  constructor() {
    super('guild_configs', () => ({
      welcomeEnabled: false,
      welcomeChannel: null,
      welcomeMessage: 'Welcome to the server, {user}!',
      welcomeAutoRole: null,
      goodbyeEnabled: false,
      goodbyeChannel: null,
      goodbyeMessage: '{user} has left the server.',
      logEnabled: false,
      logChannel: null,
      automodEnabled: false,
      automodSpamFilter: false,
      automodBlockInvites: false,
      automodBadwords: false,
      automodBadwordsList: [],
      customPermissions: {},
    }), { eagerLoad: true }); // Guild configs should be eagerly loaded
  }

  public get(id: string): GuildConfig {
    return super.get(id) as GuildConfig;
  }

  public update(id: string, partial: Partial<GuildConfig>): GuildConfig {
    return super.update(id, partial) as GuildConfig;
  }

  protected serialize(id: string, data: GuildConfig): any {
    return {
      id,
      data: data
    };
  }

  protected deserialize(row: any): { id: string; data: GuildConfig } {
    return {
      id: row.id,
      data: row.data as GuildConfig
    };
  }
}

export const guildStorage = new GuildRepository();
