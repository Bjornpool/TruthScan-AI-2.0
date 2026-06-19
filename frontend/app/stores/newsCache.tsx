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

// Mapowanie source → model NLP (lustrzane odbicie _resolve_model z backendu).
// Używane do budowania klucza cache — gwarantuje spójność między useNewsStream
// (zapis) a useDashboardCharts (odczyt) dla każdego źródła.
const _PL_SOURCES = new Set(["PolsatNews", "TVN24", "Bankier", "Money", "SpidersWeb"]);
const _NO_SOURCES = new Set(["NRK", "VG", "E24", "Aftenposten"]);

export function resolveModel(source: string): string {
  if (_PL_SOURCES.has(source)) return "herbert";
  if (_NO_SOURCES.has(source)) return "norbert";
  return "roberta";
}

// helper: klucz cache dla /news — model wywiedziony z source, nie hardcoded "roberta".
// Dzięki temu news:PolsatNews:herbert i news:VG:norbert są niezależnymi wpisami.
export const newsKey = (source: string, model?: string) =>
  `news:${source}:${model ?? resolveModel(source)}`;

// helper: klucz cache dla /emotion-stats
export const statsKey = (source: string) => `stats:${source}`;
