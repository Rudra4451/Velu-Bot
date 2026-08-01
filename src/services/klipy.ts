import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes (longer cache = more instant hits)
const CACHE_MAX_SIZE = 200;
const REQUEST_TIMEOUT_MS = 2500;

interface CacheEntry {
  urls: string[];   // store multiple URLs per query for variety
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheSet(key: string, urls: string[]): void {
  if (cache.size >= CACHE_MAX_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { urls, expiresAt: Date.now() + CACHE_TTL_MS });
}

function cacheGet(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  // Return a random URL from the cached list for variety
  return entry.urls[Math.floor(Math.random() * entry.urls.length)];
}

// High quality fallback sticker URLs
const FALLBACK_GIFS: Record<string, string[]> = {
  hug: [
    'https://media.giphy.com/media/lrr91983vOTW8/giphy.gif',
    'https://media.giphy.com/media/u9BxFE6544a6A/giphy.gif',
  ],
  pat: [
    'https://media.giphy.com/media/5tmRHw7ScrvwNJpTC4/giphy.gif',
    'https://media.giphy.com/media/L2z7ILmjDJa92/giphy.gif',
  ],
  slap: [
    'https://media.giphy.com/media/Gf3AUz3eBNbTW/giphy.gif',
  ],
  kiss: [
    'https://media.giphy.com/media/G3va39rn8E4A8/giphy.gif',
  ],
  dance: [
    'https://media.giphy.com/media/13CoXDiaCcCvg4/giphy.gif',
    'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif',
  ],
  welcome: [
    'https://media.giphy.com/media/xT9IgG50Vm3z0g0uUE/giphy.gif',
  ],
  goodbye: [
    'https://media.giphy.com/media/PSxPL6jjDnpmM/giphy.gif',
  ],
  afk: [
    'https://media.giphy.com/media/d2W7eZX5z62ziqdi/giphy.gif',
  ],
  music: [
    'https://media.giphy.com/media/l41YkxvUlB1WXivNm/giphy.gif',
  ]
};

const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Waifu.pics SFW actions map
const WAIFU_ACTIONS = new Set(['hug', 'pat', 'slap', 'kiss', 'dance', 'cuddle', 'smile', 'wave', 'wink', 'highfive', 'happy', 'blush', 'bite']);

async function fetchFromWaifuPics(action: string): Promise<string | null> {
  const endpoint = WAIFU_ACTIONS.has(action.toLowerCase()) ? action.toLowerCase() : 'dance';
  const url = `https://api.waifu.pics/sfw/${endpoint}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    return json?.url || null;
  } catch {
    return null;
  }
}

async function fetchFromGiphy(query: string): Promise<string[]> {
  // Public Giphy Beta Key for open search
  const url = `https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(query)}&limit=10&rating=g`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const json = (await res.json()) as any;
    const data = json?.data;
    if (!data?.length) return [];
    return data
      .map((item: any) => item?.images?.original?.url || item?.images?.downsized?.url)
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchFromKlipy(query: string): Promise<string[]> {
  if (!config.KLIPY_API_KEY) return [];
  const url = `https://api.klipy.com/api/v1/${config.KLIPY_API_KEY}/gifs/search?q=${encodeURIComponent(query)}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const json = (await res.json()) as any;
    const results = json?.data?.data;
    if (!results?.length) return [];
    return results
      .map((item: any) => item?.file?.hd?.gif?.url || item?.file?.md?.gif?.url)
      .filter(Boolean);
  } catch {
    return [];
  }
}

export const klipyService = {
  /**
   * Ultra-fast parallel multi-provider GIF / Sticker URL fetcher.
   * All providers are raced simultaneously — first valid result wins.
   */
  async search(category: string, query: string): Promise<string> {
    const cleanQuery = (query || category || 'dance').toLowerCase().trim();
    const cacheKey = `sticker:${category}:${cleanQuery}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    // Race ALL providers in parallel — whoever returns first wins
    const allUrls: string[] = [];

    const providers: Promise<void>[] = [];

    // Waifu.pics for known anime actions
    if (WAIFU_ACTIONS.has(cleanQuery)) {
      providers.push(
        fetchFromWaifuPics(cleanQuery).then(url => { if (url) allUrls.push(url); })
      );
    }

    // Giphy + Klipy always race in parallel
    providers.push(
      fetchFromGiphy(cleanQuery).then(urls => { allUrls.push(...urls); })
    );
    providers.push(
      fetchFromKlipy(cleanQuery).then(urls => { allUrls.push(...urls); })
    );

    // Wait for all to finish (or timeout naturally via AbortController)
    await Promise.allSettled(providers);

    if (allUrls.length > 0) {
      cacheSet(cacheKey, allUrls);
      return pickRandom(allUrls);
    }

    // Fallback to curated GIF list
    const fallback = pickRandom(FALLBACK_GIFS[cleanQuery] || FALLBACK_GIFS.hug);
    return fallback;
  },
};
