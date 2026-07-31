import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_SIZE = 100;
const REQUEST_TIMEOUT_MS = 4000;

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheSet(key: string, url: string): void {
  if (cache.size >= CACHE_MAX_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { url, expiresAt: Date.now() + CACHE_TTL_MS });
}

function cacheGet(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.url;
}

// Curated fallback GIFs / Stickers
const FALLBACK_GIFS: Record<string, string[]> = {
  hug: [
    'https://media.tenor.com/d9TfT_N5K58AAAAC/anime-hug.gif',
    'https://media.tenor.com/kCZfb3JNzIACAAAAC/gocchuumon-wa-usagi-desu-ka-gochiusa.gif',
  ],
  pat: [
    'https://media.tenor.com/8DaC-vnnn5gAAAAC/pat-head-anime.gif',
    'https://media.tenor.com/1YlET68Ew58AAAAC/headpat-anime.gif',
  ],
  slap: [
    'https://media.tenor.com/wOBntxRcj7gAAAAC/slap-anime.gif',
  ],
  kiss: [
    'https://media.tenor.com/3wO64ea7k28AAAAC/anime-kiss.gif',
  ],
  dance: [
    'https://media.tenor.com/02h38S58x-gAAAAC/anime-dance.gif',
  ],
  welcome: [
    'https://media.tenor.com/Fw7F1Z6wE-0AAAAC/anime-welcome.gif',
  ],
  goodbye: [
    'https://media.tenor.com/d_nZ_qY6E-0AAAAC/anime-goodbye.gif',
  ],
  victory: [
    'https://media.tenor.com/v8F1Z6wE-0AAAAC/anime-victory.gif',
  ],
  ban: [
    'https://media.tenor.com/b8F1Z6wE-0AAAAC/anime-ban.gif',
  ],
  kick: [
    'https://media.tenor.com/k8F1Z6wE-0AAAAC/anime-kick.gif',
  ],
  timeout: [
    'https://media.tenor.com/t8F1Z6wE-0AAAAC/anime-timeout.gif',
  ],
  afk: [
    'https://media.tenor.com/a8F1Z6wE-0AAAAC/anime-sleep.gif',
  ],
  music: [
    'https://media.tenor.com/69x-v4W8z-8AAAAC/anime-dance.gif',
  ]
};

const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

async function fetchFromTenor(query: string, retries: number = 1): Promise<string | null> {
  // Public Tenor V1 Key commonly used for open integrations
  const url = `https://g.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=LIVDSRZULELA&limit=15&media_filter=minimal`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = (await res.json()) as any;
    const results = json?.results;
    if (!results?.length) return null;

    const pick = results[Math.floor(Math.random() * Math.min(results.length, 10))];
    return pick?.media?.[0]?.gif?.url || null;
  } catch (err: unknown) {
    logger.warn(`Tenor request failed for "${query}": ${(err as Error).message}`);
    if (retries > 0) {
      return fetchFromTenor(query, retries - 1);
    }
    return null;
  }
}

export const klipyService = {
  /**
   * Returns a GIF / Sticker URL for the given category/query.
   */
  async search(category: string, query: string): Promise<string> {
    const cacheKey = `tenor:${category}:${query}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    // We append "anime" to specific action queries for better styling
    const searchQuery = ['hug', 'pat', 'slap', 'kiss', 'dance'].includes(query.toLowerCase()) 
      ? `anime ${query}` 
      : query;

    const apiResult = await fetchFromTenor(searchQuery);
    const url = apiResult ?? pickRandom(FALLBACK_GIFS[category] ?? FALLBACK_GIFS.hug);

    cacheSet(cacheKey, url);
    return url;
  },
};
