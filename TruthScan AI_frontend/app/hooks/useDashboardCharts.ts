/**
 * Hook odpowiedzialny za pobieranie i agregację danych do wykresów dashboardu.
 *
 * Architektura reaktywna:
 *   1. Subskrypcja Zustand (useNewsCache) — wykresy aktualizują się automatycznie
 *      gdy SSE lub HTTP fallback zapisze artykuły do cache.
 *   2. loadCharts() pobiera przez HTTP źródła nieobecne w cache i zapisuje artykuły;
 *      subskrypcja wyłapuje zapis i przelicza wykresy.
 *
 * Dzięki temu fake_probability pochodzi zawsze z tych samych artykułów co stream SSE.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchOneSource } from "../../lib/fetchNews";
import { useNewsCache, newsKey } from "../../app/stores/newsCache";
import type { Article } from "../../lib/fetchNews";
import type { Lang } from "../../lib/types";

const ALL_SOURCES = [
  "BBC", "CNN", "NYTimes", "Guardian", "AlJazeera",
  "Money", "PolsatNews", "TVN24", "SpidersWeb", "Bankier",
  "NRK", "VG", "E24", "Aftenposten",
] as const;

const SOURCE_ORDER = new Map(ALL_SOURCES.map((s, i) => [s as string, i]));

export function useDashboardCharts(language: Lang) {
  const [barData, setBarData]         = useState<{ label: string; value: number }[]>([]);
  const [emotionData, setEmotionData] = useState<{ name: string; value: number }[]>([]);
  const [progressCount, setProgressCount] = useState(0);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [chartsError, setChartsError]     = useState<string | null>(null);

  const chartsStartedRef = useRef(false);
  const progressPct = Math.round((progressCount / ALL_SOURCES.length) * 100);

  const normalizeSent = (s: string): "POSITIVE" | "NEGATIVE" | "NEUTRAL" => {
    const k = (s || "").trim().toUpperCase();
    if (k === "POZYTYWNE" || k === "POSITIVE" || k === "POSITIVT") return "POSITIVE";
    if (k === "NEGATYWNE" || k === "NEGATIVE" || k === "NEGATIVT") return "NEGATIVE";
    if (k === "NEUTRALNE" || k === "NEUTRAL"  || k === "NØYTRALT") return "NEUTRAL";
    return "NEUTRAL";
  };

  /**
   * Przelicza barData i emotionData na podstawie tego co aktualnie jest w cache.
   * Wywoływana przy każdej zmianie store (subskrypcja) oraz po mount.
   */
  const recomputeFromCache = useCallback(() => {
    const cacheState = useNewsCache.getState();
    const barsMap    = new Map<string, number>();
    const emosMap    = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0 };

    for (const src of ALL_SOURCES) {
      const articles = cacheState.get<Article[]>(newsKey(src));
      if (!articles || articles.length === 0) continue;

      // DEBUG: typ i wartość fake_probability pierwszego artykułu
      const first = articles[0];
      console.log(
        `[CHARTS] [${src}] article[0].fake_probability:`,
        typeof first.fake_probability, "=", first.fake_probability,
        "| sentiment:", first.sentiment
      );

      const avgFake =
        articles.reduce((sum, a) => {
          const num = Number(a.fake_probability);
          return sum + (Number.isFinite(num) ? num : 0);
        }, 0) / articles.length;

      console.log(`[CHARTS] [${src}] avgFake=${avgFake.toFixed(4)} (${articles.length} art)`);
      barsMap.set(src, avgFake);

      for (const art of articles) {
        if (art.sentiment) {
          const norm = normalizeSent(art.sentiment);
          emosMap[norm] = (emosMap[norm] || 0) + 1;
        }
      }
    }

    if (barsMap.size === 0) return; // nic w cache — nie nadpisuj pustą tablicą

    const arr = Array.from(barsMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => (SOURCE_ORDER.get(a.label) ?? 999) - (SOURCE_ORDER.get(b.label) ?? 999));

    const emoArr = [
      { name: "POSITIVE", value: emosMap.POSITIVE },
      { name: "NEUTRAL",  value: emosMap.NEUTRAL  },
      { name: "NEGATIVE", value: emosMap.NEGATIVE },
    ];

    console.log(`[CHARTS] recompute → bars=${arr.length}`, arr.map(x => `${x.label}:${x.value.toFixed(1)}`));
    setBarData(arr);
    setEmotionData(emoArr);
  }, []);

  /** Subskrypcja Zustand — reaguje na każdą zmianę cache (SSE lub HTTP fallback). */
  useEffect(() => {
    // Przelicz raz od razu (cache może już mieć dane z poprzedniej sesji)
    recomputeFromCache();

    const unsub = useNewsCache.subscribe(() => {
      recomputeFromCache();
    });

    return () => unsub();
  }, [recomputeFromCache]);

  /**
   * Pobiera przez HTTP artykuły dla źródeł nieobecnych w cache
   * i zapisuje je do store — co wyzwala subskrypcję i przeliczenie wykresów.
   */
  const loadCharts = useCallback(async () => {
    if (chartsStartedRef.current) {
      console.log("[CHARTS] loadCharts: już uruchomione, pomijam");
      return;
    }
    chartsStartedRef.current = true;
    setChartsLoading(true);
    setChartsError(null);
    setProgressCount(0);

    console.log(`[CHARTS] start: ${ALL_SOURCES.length} źródeł, lang=${language}`);

    const cacheState = useNewsCache.getState();

    const promises = ALL_SOURCES.map(async (src) => {
      try {
        const cached = cacheState.get<Article[]>(newsKey(src));

        if (cached && cached.length > 0) {
          console.log(`[CHARTS] [${src}] → CACHE HIT (${cached.length} art)`);
          // recomputeFromCache działa reaktywnie; nic więcej nie trzeba robić
        } else {
          console.log(`[CHARTS] [${src}] → CACHE MISS → HTTP`);
          const { articles } = await fetchOneSource(src, language);

          console.log(`[CHARTS] [${src}] HTTP: ${articles.length} art`);

          if (articles.length > 0) {
            // Zapis do cache wyzwala subskrypcję → recomputeFromCache()
            useNewsCache.getState().set(newsKey(src), articles);
          }
        }
      } catch (error) {
        console.warn(`[CHARTS] [${src}] błąd:`, error);
      } finally {
        setProgressCount((c) => c + 1);
      }
    });

    await Promise.allSettled(promises);
    setChartsLoading(false);

    console.log("[CHARTS] gotowe. barsMap rozmiar po HTTP:", barData.length);
  }, [language, barData.length]);

  return {
    barData,
    emotionData,
    progressCount,
    progressPct,
    chartsLoading,
    chartsError,
    chartsStarted: chartsStartedRef.current,
    loadCharts,
    totalSources: ALL_SOURCES.length,
    hasBars:  barData.length > 0,
    hasEmos:  emotionData.length > 0,
  };
}
