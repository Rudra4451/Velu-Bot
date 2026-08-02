import { getSupabase } from './supabase.js';
import { logger } from '../utils/logger.js';
import type { IRepository } from './IRepository.js';

export abstract class BaseRepository<T> implements IRepository<T> {
  protected cache: Map<string, { data: T, expiresAt: number | null }> = new Map();
  protected dirtySet: Set<string> = new Set();
  protected deletedSet: Set<string> = new Set();
  
  private syncTimeout: NodeJS.Timeout | null = null;
  private isSyncing = false;
  
  protected tableName: string;
  protected defaultFactory?: () => T;
  protected ttlMs: number | null; // null = never expire
  protected eagerLoad: boolean;
  
  public metrics = {
    hits: 0,
    misses: 0,
    syncs: 0,
    retries: 0
  };

  constructor(tableName: string, defaultFactory?: () => T, options: { ttlMs?: number, eagerLoad?: boolean } = {}) {
    this.tableName = tableName;
    this.defaultFactory = defaultFactory;
    this.ttlMs = options.ttlMs || null;
    this.eagerLoad = options.eagerLoad ?? false;
  }

  /** Convert TypeScript object to Supabase row format */
  protected abstract serialize(id: string, data: T): any;
  /** Convert Supabase row format to TypeScript object */
  protected abstract deserialize(row: any): { id: string, data: T };

  public async init(): Promise<void> {
    if (this.eagerLoad) {
      try {
        const client = getSupabase();
        const { data, error } = await client.from(this.tableName).select('*');
        if (error) throw error;
        
        if (data) {
          for (const row of data) {
            const { id, data: parsed } = this.deserialize(row);
            this.cache.set(id, { data: parsed, expiresAt: this.ttlMs ? Date.now() + this.ttlMs : null });
          }
        }
        logger.info(`[${this.tableName}] Eager loaded ${data?.length || 0} records.`);
      } catch (err: any) {
        logger.error(`[${this.tableName}] Failed to eager load: ${err.message}`);
      }
    }
  }

  private scheduleSync(): void {
    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    // Debounce for 3 seconds
    this.syncTimeout = setTimeout(() => this.flush(), 3000);
  }

  public async flush(): Promise<void> {
    if (this.isSyncing) {
      // Re-queue if already syncing
      this.scheduleSync();
      return;
    }
    
    if (this.dirtySet.size === 0 && this.deletedSet.size === 0) return;
    
    this.isSyncing = true;
    const client = getSupabase();
    
    const toUpsertIds = Array.from(this.dirtySet);
    const toDeleteIds = Array.from(this.deletedSet);
    
    this.dirtySet.clear();
    this.deletedSet.clear();

    try {
      if (toDeleteIds.length > 0) {
        const { error } = await client.from(this.tableName).delete().in('id', toDeleteIds);
        if (error) throw error;
      }
      
      if (toUpsertIds.length > 0) {
        const rows = toUpsertIds.map(id => {
          const entry = this.cache.get(id);
          if (!entry) return null;
          return this.serialize(id, entry.data);
        }).filter(Boolean);
        
        if (rows.length > 0) {
          // updated_at is handled by the serialization or DB trigger
          const { error } = await client.from(this.tableName).upsert(rows);
          if (error) throw error;
        }
      }
      this.metrics.syncs++;
    } catch (err: any) {
      logger.error(`[${this.tableName}] Flush failed: ${err.message}. Retrying...`);
      this.metrics.retries++;
      // Re-add to dirty sets to try again later
      toUpsertIds.forEach(id => this.dirtySet.add(id));
      toDeleteIds.forEach(id => this.deletedSet.add(id));
      this.scheduleSync(); // Retry
    } finally {
      this.isSyncing = false;
    }
  }

  public get(id: string): T | undefined {
    const entry = this.cache.get(id);
    
    if (entry) {
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        // Expired cache
        this.cache.delete(id);
        this.metrics.misses++;
      } else {
        this.metrics.hits++;
        return entry.data;
      }
    } else {
      this.metrics.misses++;
    }

    if (!this.defaultFactory) {
      if (!this.eagerLoad) {
        this.lazyFetch(id).catch(() => {});
      }
      return undefined;
    }

    const defaultData = this.defaultFactory();
    this.cache.set(id, { data: defaultData, expiresAt: this.ttlMs ? Date.now() + this.ttlMs : null });
    
    if (!this.eagerLoad) {
      // Async fetch in background
      this.lazyFetch(id).catch(() => {});
    }
    
    return defaultData;
  }

  private async lazyFetch(id: string): Promise<void> {
    try {
      const { data, error } = await getSupabase().from(this.tableName).select('*').eq('id', id).single();
      if (!error && data) {
        const { data: parsed } = this.deserialize(data);
        this.cache.set(id, { data: parsed, expiresAt: this.ttlMs ? Date.now() + this.ttlMs : null });
      }
    } catch (e) {
      // Ignore not found or network errors during lazy load
    }
  }

  public set(id: string, value: T): void {
    this.cache.set(id, { data: value, expiresAt: this.ttlMs ? Date.now() + this.ttlMs : null });
    this.dirtySet.add(id);
    this.deletedSet.delete(id);
    this.scheduleSync();
  }

  public update(id: string, partial: Partial<T>): T | undefined {
    const current = this.get(id);
    if (current === undefined) return undefined;
    const updated = { ...current, ...partial } as T;
    this.set(id, updated);
    return updated;
  }

  public delete(id: string): boolean {
    const result = this.cache.delete(id);
    this.dirtySet.delete(id);
    this.deletedSet.add(id);
    this.scheduleSync();
    return result;
  }

  public getAll(): Map<string, T> {
    const result = new Map<string, T>();
    for (const [id, entry] of this.cache.entries()) {
      if (!entry.expiresAt || Date.now() < entry.expiresAt) {
        result.set(id, entry.data);
      }
    }
    return result;
  }
}
