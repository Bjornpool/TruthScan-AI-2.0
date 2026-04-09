/**
 * Sekcja dashboardu odpowiedzialna za wizualizację danych analitycznych.
 *
 * Komponent integruje:
 * - wykres sentymentu emocjonalnego,
 * - wykres prawdopodobieństwa fake newsów według źródeł,
 * - mechanizm leniwego ładowania i cache po stronie klienta,
 * - modal z listą artykułów dla wybranego źródła.
 */

"use client";

import { useRef, useEffect, useState } from "react";
import SourceSelector from "../../../components/SourceSelector";
import EmotionalPieChart from "../../../components/EmotionalPieChart";
import FakeNewsBarChart from "../../../components/FakeNewsBarChart";
import ProgressBar from "../../../components/ProgressBar";
import { useDashboardCharts } from "../../hooks/useDashboardCharts";
import locales from "../../../lib/locales";
import MiniSpinner from "./MiniSpinner";
import ArticlesModal from "./ArticlesModal";

import type { Lang } from "../../../lib/types";

interface Props {
  language: Lang;
  selectedSource: string;
  setSelectedSource: (source: string) => void;
}

const CHARTS_CACHE_KEY = "dashboard:charts";

type ChartsCache = {
  barData: any[];
  emotionData: any[];
  totalSources: number;
};

export default function ChartsSection({
  language,
  selectedSource,
  setSelectedSource,
}: Props) {
  const [isClient, setIsClient] = useState(false);
  const [cachedCharts, setCachedCharts] = useState<ChartsCache | null>(null);
  
  const {
    barData,
    emotionData,
    progressCount,
    progressPct,
    chartsLoading,
    chartsError,
    chartsStarted,
    loadCharts,
    totalSources,
    hasBars,
    hasEmos,
  } = useDashboardCharts(language);

  const [showArticlesModal, setShowArticlesModal] = useState(false);
  const chartsSectionRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedRef = useRef(false); 

  useEffect(() => {
    setIsClient(true);
    
    import("../../../app/stores/newsCache").then(({ useNewsCache }) => {
      const cache = useNewsCache.getState();
      setCachedCharts(cache.get<ChartsCache>(CHARTS_CACHE_KEY));
    });
  }, []);

  useEffect(() => {
    if (!isClient || hasLoadedRef.current) return;
    
    const el = chartsSectionRef.current;
    if (!el) return;

    if (cachedCharts) {
      console.log("✅ Używam cache dla wykresów");
      return;
    }

    hasLoadedRef.current = true;
    
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            console.log("🚀 Ładuję wykresy (intersection)...");
            loadCharts();
            io.disconnect();
          }
        },
        { threshold: 0.05, rootMargin: "200px 0px" } 
      );
      io.observe(el);
      return () => io.disconnect();
    } else {
      const t = setTimeout(() => {
        console.log("🚀 Ładuję wykresy (timeout)...");
        loadCharts();
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isClient, cachedCharts, loadCharts]);

  useEffect(() => {
    if (!isClient || !chartsStarted || chartsLoading || chartsError || (!hasBars && !hasEmos)) {
      return;
    }

    if (!barData?.length && !emotionData?.length) return;

    import("../../../app/stores/newsCache").then(({ useNewsCache }) => {
      const cache = useNewsCache.getState();
      
      const currentCache = cache.get<ChartsCache>(CHARTS_CACHE_KEY);
      const areDataEqual =
        JSON.stringify(currentCache?.barData) === JSON.stringify(barData) &&
        JSON.stringify(currentCache?.emotionData) === JSON.stringify(emotionData);

      if (areDataEqual) return;

      const payload: ChartsCache = {
        barData,
        emotionData,
        totalSources,
      };
      cache.set(CHARTS_CACHE_KEY, payload);
      setCachedCharts(payload); 
    });
  }, [
    isClient,
    chartsStarted,
    chartsLoading,
    chartsError,
    hasBars,
    hasEmos,
    barData,
    emotionData,
    totalSources,
  ]);

  if (!isClient) {
    return (
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-lg bg-gray-100 p-4 shadow dark:bg-gray-800">
            <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded mb-2 w-1/2 animate-pulse"></div>
            <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
          <div className="min-h-[320px] rounded-lg bg-gray-100 p-4 shadow dark:bg-gray-800 animate-pulse"></div>
        </div>
        <div className="lg:col-span-2 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow min-h-[420px] lg:min-h-[480px] animate-pulse"></div>
      </section>
    );
  }

  const effectiveBarData = cachedCharts?.barData ?? barData;
  const effectiveEmotionData = cachedCharts?.emotionData ?? emotionData;
  const effectiveTotalSources = cachedCharts?.totalSources ?? totalSources;

  const effectiveHasBars = cachedCharts
    ? cachedCharts.barData.length > 0
    : hasBars;
  const effectiveHasEmos = cachedCharts
    ? cachedCharts.emotionData.length > 0
    : hasEmos;

  const effectiveChartsStarted = cachedCharts ? true : chartsStarted;
  const effectiveChartsLoading = cachedCharts ? false : chartsLoading;
  const effectiveProgressCount = cachedCharts
    ? effectiveTotalSources
    : progressCount;
  const effectiveProgressPct = cachedCharts ? 100 : progressPct;

  const t = locales[language] ?? locales.pl;

  return (
    <>
      <section
        ref={chartsSectionRef}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch"
      >
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-lg bg-gray-100 p-4 shadow dark:bg-gray-800">
            <h2 className="mb-2 text-lg font-semibold">{t.selectSource}</h2>
            <SourceSelector
              selectedSource={selectedSource}
              setSelectedSource={setSelectedSource}
              language={language}
              locales={locales}
            />

            {selectedSource && (
              <button
                onClick={() => setShowArticlesModal(true)}
                className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
              >
                📰{" "}
                {language === "pl" ? "Pokaż artykuły" : language === "no" ? "Vis artikler" : "Show articles"}
              </button>
            )}
          </div>

          <div className="min-h-[320px] rounded-lg bg-gray-100 p-4 shadow dark:bg-gray-800">
            {effectiveChartsStarted && (
              <ProgressBar
                progressCount={effectiveProgressCount}
                totalSources={effectiveTotalSources}
                progressPct={effectiveProgressPct}
                language={language}
              />
            )}

            {chartsError ? (
              <div className="text-sm text-red-400">{chartsError}</div>
            ) : effectiveHasEmos ? (
              <EmotionalPieChart
                data={effectiveEmotionData}
                title={
                  language === "pl"
                    ? "Emocje w artykułach"
                    : language === "no"
                    ? "Følelser i artikler"
                    : "Emotions in Articles"
                }
              />
            ) : effectiveChartsLoading ? (
              <MiniSpinner
                text={
                  language === "pl"
                    ? "Ładuję wykres emocji…"
                    : language === "no"
                    ? "Laster emosjonskart…"
                    : "Loading emotions chart…"
                }
              />
            ) : null}
          </div>
        </div>

        <div className="lg:col-span-2 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow flex flex-col h-full">
          {effectiveChartsStarted && (
            <ProgressBar
              progressCount={effectiveProgressCount}
              totalSources={effectiveTotalSources}
              progressPct={effectiveProgressPct}
              language={language}
            />
          )}

          {chartsError ? (
            <div className="text-sm text-red-400">{chartsError}</div>
          ) : effectiveHasBars ? (
            <FakeNewsBarChart data={effectiveBarData} title={t.fakeNewsSources} />
          ) : effectiveChartsLoading ? (
            <MiniSpinner
              text={
                language === "pl"
                  ? "Ładuję wykres źródeł…"
                  : language === "no"
                  ? "Laster kildekart…"
                  : "Loading sources chart…"
              }
            />
          ) : null}
        </div>
      </section>

      {showArticlesModal && (
        <ArticlesModal
          source={selectedSource}
          language={language}
          onClose={() => setShowArticlesModal(false)}
        />
      )}
    </>
  );
}