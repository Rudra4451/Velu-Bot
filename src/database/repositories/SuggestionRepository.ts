import { BaseRepository } from '../BaseRepository.js';

export interface SuggestionConfig {
  enabled: boolean;
  channelId: string | null;
}

export class SuggestionRepository extends BaseRepository<SuggestionConfig> {
  constructor() {
    super('suggestions', undefined, { eagerLoad: true });
  }

  protected serialize(id: string, data: SuggestionConfig): any {
    return { id, data };
  }

  protected deserialize(row: any): { id: string; data: SuggestionConfig } {
    return { id: row.id, data: row.data as SuggestionConfig };
  }
}

export const suggestionStorage = new SuggestionRepository();
