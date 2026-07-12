import { readdir, stat } from 'fs/promises';
import { join } from 'path';

/**
 * Recursively find all files in a directory matching specific conditions.
 * @param {string} dir - The directory to scan.
 * @param {object} options - Filtering options.
 * @param {string} [options.extension='.js'] - Filter files by extension.
 * @param {string[]} [options.exclude=[]] - File names/paths to exclude.
 * @returns {Promise<string[]>} List of absolute file paths.
 */
export async function scanDirectory(dir, options = {}) {
  const extension = options.extension ?? '.js';
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
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}
