import { BaseRepository } from '../BaseRepository.js';
import type { Warning } from '../../types/index.js';

export class WarningRepository extends BaseRepository<Warning[]> {
  constructor() {
    super('warnings', undefined, { eagerLoad: true, ttlMs: 3600000 }); // Eager load, expire in 1 hour
  }

  protected serialize(id: string, data: Warning[]): any {
    return {
      id,
      data
    };
  }

  protected deserialize(row: any): { id: string; data: Warning[] } {
    return {
      id: row.id,
      data: row.data as Warning[]
    };
  }
}

export const warningStorage = new WarningRepository();
