import { describe, it, expect, beforeEach } from 'vitest';
import { Storage } from '../src/storage/Storage.js';
import fs from 'fs';
import path from 'path';

describe('Storage', () => {
  const testFileName = 'test_storage.json';
  const testFilePath = path.join(process.cwd(), 'data', testFileName);
  
  beforeEach(() => {
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  it('should initialize with default data', () => {
    const storage = new Storage<{ count: number }>(testFileName, () => ({ count: 0 }));
    expect(storage.get('test_guild')).toEqual({ count: 0 });
  });

  it('should persist and retrieve data', () => {
    const storage = new Storage<{ count: number }>(testFileName, () => ({ count: 0 }));
    storage.set('test_guild', { count: 1 });
    expect(storage.get('test_guild')).toEqual({ count: 1 });
  });

  it('should update partial data', () => {
    const storage = new Storage<{ a: string; b: number }>(testFileName, () => ({ a: 'hello', b: 1 }));
    storage.update('test_guild', { b: 2 });
    expect(storage.get('test_guild')).toEqual({ a: 'hello', b: 2 });
  });
});
