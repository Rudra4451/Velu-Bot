export interface IRepository<T> {
  /** Gets an item from the cache, fetching if not loaded (or using default) */
  get(id: string): T;
  /** Synchronous update of cache, schedules async db write */
  set(id: string, value: T): void;
  /** Partial update of cache, schedules async db write */
  update(id: string, partial: Partial<T>): T;
  /** Deletes from cache and schedules async db delete */
  delete(id: string): boolean;
  /** Fetch all loaded items */
  getAll(): Map<string, T>;
  /** Forces flush to database immediately */
  flush(): Promise<void>;
}
