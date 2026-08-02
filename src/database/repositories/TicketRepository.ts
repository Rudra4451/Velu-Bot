import { BaseRepository } from '../BaseRepository.js';

export interface TicketConfig {
  enabled: boolean;
  categoryId: string | null;
  logChannelId: string | null;
  supportRoleId: string | null;
}

export class TicketRepository extends BaseRepository<TicketConfig> {
  constructor() {
    super('tickets', () => ({
      enabled: false,
      categoryId: null,
      logChannelId: null,
      supportRoleId: null,
    }), { eagerLoad: true });
  }

  protected serialize(id: string, data: TicketConfig): any {
    return { id, data };
  }

  protected deserialize(row: any): { id: string; data: TicketConfig } {
    return { id: row.id, data: row.data as TicketConfig };
  }
}

export const ticketStorage = new TicketRepository();
