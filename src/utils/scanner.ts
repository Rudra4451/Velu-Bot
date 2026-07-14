import { readdir, stat } from 'fs/promises';
import { join } from 'path';

interface ScanOptions {
  extension?: string;
  exclude?: string[];
}

/**
 * Recursively find all files in a directory matching specific conditions.
 * Supports both `.ts` and `.js` extensions for dev/production flexibility.
 */
export async function scanDirectory(dir: string, options: ScanOptions = {}): Promise<string[]> {
  const extension = options.extension ?? '.ts';
  const exclude = options.exclude ?? [];

  try {
    const subdirs = await readdir(dir);
    const files = await Promise.all(
      subdirs.map(async (subdir) => {
        const res = join(dir, subdir);
        const fileStat = await stat(res);
        if (fileStat.isDirectory()) {
          return scanDirectory(res, options);
        }
        return res;
      })
    );

    return files.flat().filter(file => {
      const matchesExt = file.endsWith(extension);
      const isExcluded = exclude.some(ex => file.includes(ex));
      return matchesExt && !isExcluded;
    });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}
