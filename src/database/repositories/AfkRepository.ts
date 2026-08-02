import { BaseRepository } from '../BaseRepository.js';
import type { AfkData } from '../../types/index.js';

export class AfkRepository extends BaseRepository<AfkData> {
  constructor() {
    super('afk_status', undefined, { eagerLoad: true, ttlMs: 7200000 }); // Eager load, expire in 2 hours
  }

  protected serialize(id: string, data: AfkData): any {
    return { id, data };
  }

  protected deserialize(row: any): { id: string; data: AfkData } {
    return { id: row.id, data: row.data as AfkData };
  }
}

export const afkStorage = new AfkRepository();
