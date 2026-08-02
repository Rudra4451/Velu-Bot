import { BaseRepository } from '../BaseRepository.js';

export interface StarboardConfig {
  enabled: boolean;
  channelId: string | null;
  threshold: number;
}

export class StarboardRepository extends BaseRepository<StarboardConfig> {
  constructor() {
    super('starboard', () => ({
      enabled: false,
      channelId: null,
      threshold: 3,
    }), { eagerLoad: true });
  }

  protected serialize(id: string, data: StarboardConfig): any {
    return { id, data };
  }

  protected deserialize(row: any): { id: string; data: StarboardConfig } {
    return { id: row.id, data: row.data as StarboardConfig };
  }
}

export const starboardStorage = new StarboardRepository();
