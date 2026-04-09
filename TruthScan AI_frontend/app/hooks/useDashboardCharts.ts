/**
 * Hook odpowiedzialny za pobieranie i agregację danych do wykresów dashboardu.
 */

import { useCallback, useRef, useState } from "react";
import { fetchOneSource, NewsData } from "../../lib/fetchNews";
import type { Lang } from "../../lib/types";

const ALL_SOURCES = [
  "BBC", "CNN", "NYTimes", "Guardian", "AlJazeera",
  "Money", "PolsatNews", "TVN24", "SpidersWeb", "Bankier",
  "NRK", "VG", "TV2", "Aftenposten",
] as const;

export function useDashboardCharts(language: Lang) {
  const [barData, setBarData] = useState<{ label: string; value: number }[]>([]);
  const [emotionData, setEmotionData] = useState<{ name: string; value: number }[]>([]);
  const [progressCount, setProgressCount] = useState(0);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [chartsError, setChartsError] = useState<string | null>(null);
  
  // Struktury w useRef – pozwalają aktualizować dane bez nadmiarowych re-renderów
  const barsMapRef = useRef<Map<string, number>>(new Map());
  const emosMapRef = useRef<Record<string, number>>({ 
    POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0 
  });
  const chartsStartedRef = useRef(false);

  const progressPct = Math.round((progressCount / ALL_SOURCES.length) * 100);

  const normalizeSent = (s: string): "POSITIVE" | "NEGATIVE" | "NEUTRAL" => {
    const k = (s || "").trim().toUpperCase();
    if (k === "POZYTYWNE" || k === "POSITIVE" || k === "POSITIVT") return "POSITIVE";
    if (k === "NEGATYWNE" || k === "NEGATIVE" || k === "NEGATIVT") return "NEGATIVE";
    if (k === "NEUTRALNE" || k === "NEUTRAL"  || k === "NØYTRALT") return "NEUTRAL";
    return "NEUTRAL";
  };

  const refreshChartsFromRefs = () => {
    const order = new Map(ALL_SOURCES.map((s, i) => [s as string, i]));
    const arr = Array.from(barsMapRef.current.entries()).map(([label, value]) => ({
      label, value,
    }));
    arr.sort((a, b) => (order.get(a.label) ?? 999) - (order.get(b.label) ?? 999));
    setBarData(arr);

    const emoArr = [
      { name: "POSITIVE", value: emosMapRef.current.POSITIVE },
      { name: "NEUTRAL", value: emosMapRef.current.NEUTRAL },
      { name: "NEGATIVE", value: emosMapRef.current.NEGATIVE }
    ];
    setEmotionData(emoArr);
  };

  const loadCharts = useCallback(async () => {
    if (chartsStartedRef.current) return;
    chartsStartedRef.current = true;
    setChartsLoading(true);
    setChartsError(null);
    setProgressCount(0);
    barsMapRef.current.clear();
    emosMapRef.current = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0 };

    console.log(`📊 Ładuję wykresy: ${ALL_SOURCES.length} źródeł, lang=${language}`);

    const promises = ALL_SOURCES.map(async (src) => {
      try {
        const { news, emotions } = await fetchOneSource(src, language);

        if (news) {
          barsMapRef.current.set(news.source, parseFloat(news.fake_news));
        }

        for (const [emotionKey, count] of Object.entries(emotions)) {
          const normalized = normalizeSent(emotionKey);
          emosMapRef.current[normalized] = (emosMapRef.current[normalized] || 0) + (count as number);
        }

        console.log(`✅ [${src}] fake=${news?.fake_news}, emotions=`, emotions);
      } catch (error) {
        console.warn(`⚠️ [${src}] błąd pobierania:`, error);
        // Ustaw 0 dla niedostępnych źródeł tak żeby słupek się pojawił
        barsMapRef.current.set(src, 0);
      } finally {
        // Zawsze aktualizuj stan — nawet przy błędzie żeby wykresy się pokazały
        refreshChartsFromRefs();
        setProgressCount((c) => c + 1);
      }
    });

    await Promise.allSettled(promises);
    setChartsLoading(false);
    console.log(`📊 Wykresy gotowe. Słupki:`, barsMapRef.current.size, `Emocje:`, emosMapRef.current);
  }, [language]);

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
    hasBars: barData.length > 0,
    hasEmos: emotionData.length > 0,
  };
}