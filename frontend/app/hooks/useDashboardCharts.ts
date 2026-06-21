/**
 * Hook agregujący dane wykresów czysto reaktywnie z cache Zustand.
 *
 * NIE robi własnych HTTP requestów — subskrybuje cache i przelicza
 * gdy SSE lub prefetch zapisze nowe artykuły do newsKey(source).
 * Kolejność: SSE/prefetch → cache → recomputeFromCache → wykresy → AI
 */

import { useCallback, useEffect, useState } from "react";
import { useNewsCache, newsKey } from "../../app/stores/newsCache";
import type { Article } from "../../lib/fetchNews";
import type { Lang } from "../../lib/types";

const ALL_SOURCES = [
  "BBC", "CNN", "NYTimes", "Guardian", "AlJazeera",
  "Money", "PolsatNews", "TVN24", "SpidersWeb", "Bankier",
  "NRK", "VG", "E24", "Aftenposten",
] as const;

const SOURCE_ORDER = new Map(ALL_SOURCES.map((s, i) => [s as string, i]));

export function useDashboardCharts(_language: Lang) {
  const [barData, setBarData]         = useState<{ label: string; value: number }[]>([]);
  const [emotionData, setEmotionData] = useState<{ name: string; value: number }[]>([]);
  const [loadedSources, setLoadedSources] = useState(0);

  const normalizeSent = (s: string): "POSITIVE" | "NEGATIVE" | "NEUTRAL" => {
    const k = (s || "").trim().toUpperCase();
    if (k === "POZYTYWNE" || k === "POSITIVE" || k === "POSITIVT") return "POSITIVE";
    if (k === "NEGATYWNE" || k === "NEGATIVE" || k === "NEGATIVT") return "NEGATIVE";
    if (k === "NEUTRALNE" || k === "NEUTRAL"  || k === "NØYTRALT") return "NEUTRAL";
    return "NEUTRAL";
  };

  const recomputeFromCache = useCallback(() => {
    const cacheState = useNewsCache.getState();
    const barsMap    = new Map<string, number>();
    const emosMap    = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0 };
    let loaded = 0;

    for (const src of ALL_SOURCES) {
      const key = newsKey(src);
      const articles = cacheState.get<Article[]>(key);
      console.log(`[CHARTS] ${src} key=${key} articles=${articles ? articles.length : "null"}`);
      if (!articles || articles.length === 0) continue;

      loaded++;

      const avgFake =
        articles.reduce((sum, a) => {
          const num = Number(a.fake_probability);
          return sum + (Number.isFinite(num) ? num : 0);
        }, 0) / articles.length;

      barsMap.set(src, avgFake);

      for (const art of articles) {
        if (art.sentiment) {
          const norm = normalizeSent(art.sentiment);
          console.log(`[CHARTS]   → sentiment="${art.sentiment}" norm=${norm}`);
          emosMap[norm] = (emosMap[norm] || 0) + 1;
        }
      }
    }

    console.log("[CHARTS] emosMap:", { ...emosMap }, "loaded:", loaded);
    setLoadedSources(loaded);
    if (barsMap.size === 0) return;

    const arr = Array.from(barsMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => (SOURCE_ORDER.get(a.label) ?? 999) - (SOURCE_ORDER.get(b.label) ?? 999));

    setBarData(arr);
    setEmotionData([
      { name: "POSITIVE", value: emosMap.POSITIVE },
      { name: "NEUTRAL",  value: emosMap.NEUTRAL  },
      { name: "NEGATIVE", value: emosMap.NEGATIVE },
    ]);
  }, []);

  useEffect(() => {
    recomputeFromCache();
    const unsub = useNewsCache.subscribe(() => {
      recomputeFromCache();
    });
    return () => unsub();
  }, [recomputeFromCache]);

  const totalSources = ALL_SOURCES.length;

  return {
    barData,
    emotionData,
    loadedSources,
    totalSources,
    progressPct: Math.round((loadedSources / totalSources) * 100),
    isComplete:  loadedSources >= totalSources,
    hasBars:     barData.length > 0,
    hasEmos:     emotionData.length > 0,
  };
}
