/**
 * Globalny cache danych newsowych po stronie frontendu.
 * Implementuje prosty mechanizm TTL oraz synchronizację z localStorage.
 */

import { create } from "zustand";

type CacheEntry<T = any> = {
  data: T;
  ts: number;           
};

type NewsCacheState = {
  cache: Record<string, CacheEntry>;
  ttlMs: number;
  get: <T = any>(key: string) => T | null;
  set: (key: string, data: any) => void;
  del: (key: string) => void;
  clear: () => void;
};

const TTL_5_MIN = 5 * 60 * 1000;

const storageKey = "truthscan_news_cache_v1";

// Odczyt cache z localStorage (jeśli dostępny)
function loadFromStorage(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
// Zapis cache do localStorage
function saveToStorage(cache: Record<string, CacheEntry>) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(cache));
  } catch {
    // ignorujemy błędy zapisu (np. quota exceeded)v
  }
}

export const useNewsCache = create<NewsCacheState>((set, get) => ({
  cache: typeof window !== "undefined" ? loadFromStorage() : {},
  ttlMs: TTL_5_MIN,

  get: <T = any>(key: string) => {
    const { cache, ttlMs } = get();
    const entry = cache[key];
    if (!entry) return null;
    const expired = Date.now() - entry.ts > ttlMs;
    // Automatyczne wygaszanie wpisów cache (TTL)
    if (expired) {
      
      const next = { ...cache };
      delete next[key];
      set({ cache: next });
      saveToStorage(next);
      return null;
    }
    return entry.data as T;
  },

  set: (key: string, data: any) => {
    const { cache } = get();
    const next = { ...cache, [key]: { data, ts: Date.now() } };
    set({ cache: next });
    saveToStorage(next);
  },

  del: (key: string) => {
    const { cache } = get();
    const next = { ...cache };
    delete next[key];
    set({ cache: next });
    saveToStorage(next);
  },

  clear: () => {
    set({ cache: {} });
    saveToStorage({});
  },
}));

// helper: klucz cache dla /news — lang celowo pominięty, bo etykiety
// sentymentu są tłumaczone po stronie frontendu przez useSentiment.
// Zmiana języka UI nie powinna wymuszać ponownego pobrania artykułów.
export const newsKey = (source: string, model = "roberta") => `news:${source}:${model}`;
// helper: klucz cache dla /emotion-stats
export const statsKey = (source: string) => `stats:${source}`;
