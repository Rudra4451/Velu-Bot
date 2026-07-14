import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_SIZE = 100;           // Evict oldest when exceeded
const REQUEST_TIMEOUT_MS = 4000;

interface CacheEntry {
  url: string;
  expiresAt: number;
}

/** Simple LRU-like eviction: delete oldest entry when over cap. */
const cache = new Map<string, CacheEntry>();

function cacheSet(key: string, url: string): void {
  if (cache.size >= CACHE_MAX_SIZE) {
    // Map preserves insertion order — delete the very first (oldest) entry
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

// Curated fallback GIFs — used when no API key is configured or Klipy is unreachable
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
    'https://media.tenor.com/k7S2F5H6d48AAAAC/anime-slap.gif',
  ],
  kiss: [
    'https://media.tenor.com/3wO64ea7k28AAAAC/anime-kiss.gif',
    'https://media.tenor.com/F02Ep3b2e5gAAAAC/cute-anime-kiss.gif',
  ],
  cuddle: [
    'https://media.tenor.com/h5TzS-1wNfQAAAAC/anime-cuddle.gif',
    'https://media.tenor.com/02ZqW6J6Z7oAAAAC/anime-cuddle.gif',
  ],
  bite: [
    'https://media.tenor.com/1G9c0uTfIqMAAAAC/anime-bite.gif',
    'https://media.tenor.com/V2hQ2rZq4Z8AAAAC/bite-anime.gif',
  ],
  poke: [
    'https://media.tenor.com/3t7c-8UfS-8AAAAC/anime-poke.gif',
    'https://media.tenor.com/02d08S78x-gAAAAC/anime-poke.gif',
  ],
  highfive: [
    'https://media.tenor.com/39gqR5S3b-kAAAAC/anime-high-five.gif',
    'https://media.tenor.com/6D3aD1e8b-8AAAAC/anime-highfive.gif',
  ],
  wave: [
    'https://media.tenor.com/2s4-v4W8z-8AAAAC/anime-wave.gif',
    'https://media.tenor.com/02c38S98x-gAAAAC/anime-wave.gif',
  ],
  cry: [
    'https://media.tenor.com/28x-v4w8z-8AAAAC/anime-cry.gif',
    'https://media.tenor.com/02e38S88x-gAAAAC/anime-cry.gif',
  ],
  laugh: [
    'https://media.tenor.com/49x-v4W8z-8AAAAC/anime-laugh.gif',
    'https://media.tenor.com/02f38S78x-gAAAAC/anime-laugh.gif',
  ],
  blush: [
    'https://media.tenor.com/59x-v4W8z-8AAAAC/anime-blush.gif',
    'https://media.tenor.com/02g38S68x-gAAAAC/anime-blush.gif',
  ],
  dance: [
    'https://media.tenor.com/69x-v4W8z-8AAAAC/anime-dance.gif',
    'https://media.tenor.com/02h38S58x-gAAAAC/anime-dance.gif',
  ],
  ship: [
    'https://media.tenor.com/79x-v4W8z-8AAAAC/anime-love.gif',
    'https://media.tenor.com/02i38S48x-gAAAAC/anime-love.gif',
  ],
  welcome: [
    'https://media.tenor.com/Fw7F1Z6wE-0AAAAC/anime-welcome.gif',
  ],
  goodbye: [
    'https://media.tenor.com/d_nZ_qY6E-0AAAAC/anime-goodbye.gif',
  ],
  success: [
    'https://media.tenor.com/x8F1Z6wE-0AAAAC/anime-victory.gif',
  ],
  warning: [
    'https://media.tenor.com/w8F1Z6wE-0AAAAC/anime-warning.gif',
  ],
  celebration: [
    'https://media.tenor.com/c8F1Z6wE-0AAAAC/anime-celebration.gif',
  ],
  victory: [
    'https://media.tenor.com/v8F1Z6wE-0AAAAC/anime-victory.gif',
  ],
  defeat: [
    'https://media.tenor.com/d8F1Z6wE-0AAAAC/anime-defeat.gif',
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
  role: [
    'https://media.tenor.com/r8F1Z6wE-0AAAAC/anime-role.gif',
  ],
  afk: [
    'https://media.tenor.com/a8F1Z6wE-0AAAAC/anime-sleep.gif',
  ],
  confetti: [
    'https://media.tenor.com/cn8F1Z6wE-0AAAAC/confetti.gif',
  ],
  party: [
    'https://media.tenor.com/p8F1Z6wE-0AAAAC/anime-party.gif',
  ],
  sad: [
    'https://media.tenor.com/s8F1Z6wE-0AAAAC/anime-sad.gif',
  ],
  happy: [
    'https://media.tenor.com/h8F1Z6wE-0AAAAC/anime-happy.gif',
  ],
};

const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

interface KlipyGifFile {
  gif?: { url?: string };
}

interface KlipyGifResult {
  file?: {
    md?: KlipyGifFile;
    hd?: KlipyGifFile;
    sm?: KlipyGifFile;
  };
}

interface KlipyResponse {
  data?: {
    data?: KlipyGifResult[];
  };
}

async function fetchFromKlipy(query: string, retries: number = 1): Promise<string | null> {
  if (!config.KLIPY_API_KEY) return null;

  const url = `https://api.klipy.com/api/v1/${config.KLIPY_API_KEY}/gifs/search?q=${encodeURIComponent(query)}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = (await res.json()) as KlipyResponse;
    const results = json?.data?.data;
    if (!results?.length) return null;

    const pick = results[Math.floor(Math.random() * Math.min(results.length, 10))];
    return pick?.file?.md?.gif?.url ?? pick?.file?.hd?.gif?.url ?? pick?.file?.sm?.gif?.url ?? null;
  } catch (err: unknown) {
    logger.warn(`Klipy request failed for "${query}": ${(err as Error).message}`);
    if (retries > 0) {
      logger.debug(`Retrying Klipy for "${query}"...`);
      return fetchFromKlipy(query, retries - 1);
    }
    return null;
  }
}

export const klipyService = {
  /**
   * Returns a GIF URL for the given category/query.
   * Falls back to a curated local list if the API is unavailable.
   * Results are cached for CACHE_TTL_MS to reduce redundant requests.
   */
  async search(category: string, query: string): Promise<string> {
    const cacheKey = `${category}:${query}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const apiResult = await fetchFromKlipy(query);
    const url = apiResult ?? pickRandom(FALLBACK_GIFS[category] ?? FALLBACK_GIFS.hug);

    cacheSet(cacheKey, url);
    return url;
  },
};
