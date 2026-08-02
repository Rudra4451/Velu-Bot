import { BaseRepository } from '../BaseRepository.js';

export interface ReactionRoleConfig {
  messageId: string;
  channelId: string;
  mappings: Record<string, string>; // emoji -> roleId
}

export class ReactionRoleRepository extends BaseRepository<ReactionRoleConfig[]> {
  constructor() {
    super('reaction_roles', undefined, { eagerLoad: true });
  }

  protected serialize(id: string, data: ReactionRoleConfig[]): any {
    return { id, data };
  }

  protected deserialize(row: any): { id: string; data: ReactionRoleConfig[] } {
    return { id: row.id, data: row.data as ReactionRoleConfig[] };
  }
}

export const reactionRoleStorage = new ReactionRoleRepository();
