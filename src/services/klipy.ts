import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_SIZE = 100;
const REQUEST_TIMEOUT_MS = 2500; // 2.5 seconds timeout for thorough API searching

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

async function fetchFromGiphy(query: string): Promise<string | null> {
  // Public Giphy Beta Key for open search
  const url = `https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(query)}&limit=10&rating=g`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const data = json?.data;
    if (!data?.length) return null;
    const pick = data[Math.floor(Math.random() * data.length)];
    return pick?.images?.original?.url || pick?.images?.downsized?.url || null;
  } catch {
    return null;
  }
}

async function fetchFromKlipy(query: string): Promise<string | null> {
  if (!config.KLIPY_API_KEY) return null;
  const url = `https://api.klipy.com/api/v1/${config.KLIPY_API_KEY}/gifs/search?q=${encodeURIComponent(query)}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const results = json?.data?.data;
    if (!results?.length) return null;
    const pick = results[Math.floor(Math.random() * results.length)];
    return pick?.file?.hd?.gif?.url || pick?.file?.md?.gif?.url || null;
  } catch {
    return null;
  }
}

export const klipyService = {
  /**
   * Multi-provider GIF / Sticker URL fetcher with zero downtime.
   */
  async search(category: string, query: string): Promise<string> {
    const cleanQuery = (query || category || 'dance').toLowerCase().trim();
    const cacheKey = `sticker:${category}:${cleanQuery}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    let resultUrl: string | null = null;

    // 1. If it's a known anime reaction action, try Waifu.pics API first (ultra-fast, HD)
    if (WAIFU_ACTIONS.has(cleanQuery)) {
      resultUrl = await fetchFromWaifuPics(cleanQuery);
    }

    // 2. Try Giphy API
    if (!resultUrl) {
      resultUrl = await fetchFromGiphy(cleanQuery);
    }

    // 3. Try Klipy API
    if (!resultUrl) {
      resultUrl = await fetchFromKlipy(cleanQuery);
    }

    // 4. Fallback to curated GIF list
    const finalUrl = resultUrl || pickRandom(FALLBACK_GIFS[cleanQuery] || FALLBACK_GIFS.hug);

    cacheSet(cacheKey, finalUrl);
    return finalUrl;
  },
};
