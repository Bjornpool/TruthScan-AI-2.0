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

import { useRef, useEffect, useState, useCallback } from "react";
import SourceSelector from "../../../components/SourceSelector";
import EmotionalPieChart from "../../../components/EmotionalPieChart";
import FakeNewsBarChart from "../../../components/FakeNewsBarChart";
import ProgressBar from "../../../components/ProgressBar";
import { useDashboardCharts } from "../../hooks/useDashboardCharts";
import { useNewsCache } from "../../stores/newsCache";
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
  const [aiComment, setAiComment]               = useState<string | null>(null);
  const [aiCommentLoading, setAiCommentLoading] = useState(false);
  const aiCommentFiredRef = useRef(false);

  const [aiEmotionComment, setAiEmotionComment]               = useState<string | null>(null);
  const [aiEmotionCommentLoading, setAiEmotionCommentLoading] = useState(false);
  const aiEmotionCommentFiredRef = useRef(false);

  const chartsSectionRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedRef = useRef(false);

  console.log('[CACHE CHECK]', {
    cachedCharts: !!cachedCharts,
    cachedChartsData: cachedCharts ? Object.keys(cachedCharts) : null,
    hasLoadedRef: hasLoadedRef?.current
  });

  // ── Effective values ────────────────────────────────────────────────────────
  // Live dane z hooka (subskrypcja Zustand) mają priorytet nad starym cache z localStorage.
  // Dzięki temu zmiana artykułów (SSE/prefetch) natychmiast aktualizuje wykresy.
  const effectiveBarData     = barData.length > 0 ? barData : (cachedCharts?.barData ?? []);
  const effectiveEmotionData = emotionData.length > 0 ? emotionData : (cachedCharts?.emotionData ?? []);

  // Warunek oparty wyłącznie na długości tablicy — wartości 0 nie blokują wykresu
  const effectiveHasBars = effectiveBarData.length > 0;
  const effectiveHasEmos = effectiveEmotionData.length > 0;

  const cacheIsValid = !!(
    cachedCharts &&
    (cachedCharts.barData.length > 0 || cachedCharts.emotionData.length > 0)
  );
  const effectiveTotalSources   = cachedCharts?.totalSources ?? totalSources;
  const effectiveChartsStarted  = cacheIsValid ? true  : chartsStarted;
  const effectiveChartsLoading  = cacheIsValid ? false : chartsLoading;
  const effectiveProgressCount  = cacheIsValid ? effectiveTotalSources : progressCount;
  const effectiveProgressPct    = cacheIsValid ? 100   : progressPct;

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    setIsClient(true);
    // Synchroniczny odczyt — brak dynamic import eliminuje race condition
    // z hasLoadedRef, który blokował użycie cache na kolejnych wejściach
    const cached = useNewsCache.getState().get<ChartsCache>(CHARTS_CACHE_KEY);
    setCachedCharts(cached);
  }, []);

  useEffect(() => {
    if (!isClient || hasLoadedRef.current) return;

    const el = chartsSectionRef.current;
    if (!el) return;

    if (cacheIsValid) {
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
  }, [isClient, cacheIsValid, loadCharts]);

  // Generuj komentarz AI raz po załadowaniu danych wykresu emocji
  useEffect(() => {
    if (aiEmotionCommentFiredRef.current) return;
    if (!isClient || effectiveChartsLoading || !effectiveHasEmos) return;
    const totalEmotionArticles = effectiveEmotionData.reduce((sum, e) => sum + e.value, 0);
    if (totalEmotionArticles < 20) return;

    aiEmotionCommentFiredRef.current = true;
    setAiEmotionCommentLoading(true);

    const pos = effectiveEmotionData.find((e) => e.name === "POSITIVE")?.value ?? 0;
    const neu = effectiveEmotionData.find((e) => e.name === "NEUTRAL")?.value ?? 0;
    const neg = effectiveEmotionData.find((e) => e.name === "NEGATIVE")?.value ?? 0;

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    fetch(`${apiBase}/ai-emotion-comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positive: pos, neutral: neu, negative: neg, lang: language }),
    })
      .then((r) => r.json())
      .then((data) => setAiEmotionComment(data.comment ?? null))
      .catch(() => setAiEmotionComment(null))
      .finally(() => setAiEmotionCommentLoading(false));
  }, [isClient, effectiveChartsLoading, effectiveHasEmos, effectiveEmotionData, language]);

  // Generuj komentarz AI raz po załadowaniu danych wykresu słupkowego
  useEffect(() => {
    if (aiCommentFiredRef.current) return;
    if (!isClient || effectiveChartsLoading || !effectiveHasBars || effectiveBarData.length < 5) return;

    aiCommentFiredRef.current = true;
    setAiCommentLoading(true);

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    fetch(`${apiBase}/ai-chart-comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bars: effectiveBarData, lang: language }),
    })
      .then((r) => r.json())
      .then((data) => setAiComment(data.comment ?? null))
      .catch(() => setAiComment(null))
      .finally(() => setAiCommentLoading(false));
  }, [isClient, effectiveChartsLoading, effectiveHasBars, effectiveBarData, language]);

  useEffect(() => {
    if (!isClient || !chartsStarted || chartsLoading || chartsError || (!hasBars && !hasEmos)) {
      return;
    }

    if (!barData?.length && !emotionData?.length) return;

    const cache = useNewsCache.getState();
    const currentCache = cache.get<ChartsCache>(CHARTS_CACHE_KEY);
    const areDataEqual =
      JSON.stringify(currentCache?.barData) === JSON.stringify(barData) &&
      JSON.stringify(currentCache?.emotionData) === JSON.stringify(emotionData);

    if (areDataEqual) return;

    const payload: ChartsCache = { barData, emotionData, totalSources };
    cache.set(CHARTS_CACHE_KEY, payload);
    setCachedCharts(payload);
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

  // ── SSR skeleton ─────────────────────────────────────────────────────────────
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

  console.log("[ChartsSection] render →", {
    cachedCharts: !!cachedCharts,
    barData: barData.length, emotionData: emotionData.length,
    effectiveBarData: effectiveBarData.length, effectiveEmotionData: effectiveEmotionData.length,
    effectiveHasBars, effectiveHasEmos,
    effectiveChartsStarted, effectiveChartsLoading,
    progressCount, effectiveProgressCount,
  });

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
              <>
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
                {aiEmotionCommentLoading && (
                  <p className="mt-2 text-xs italic text-gray-400 dark:text-gray-500 animate-pulse">
                    {language === "pl"
                      ? "Generowanie analizy AI…"
                      : language === "no"
                      ? "Genererer AI-analyse…"
                      : "Generating AI analysis…"}
                  </p>
                )}
                {aiEmotionComment && (
                  <div className="mt-3 rounded-lg bg-gray-200/70 dark:bg-gray-700/60 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    <span className="font-semibold text-gray-800 dark:text-gray-200">✨ {language === "pl" ? "Analiza AI:" : language === "no" ? "AI-analyse:" : "AI Analysis:"}</span>{" "}
                    {aiEmotionComment}
                  </div>
                )}
              </>
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
            <>
              <FakeNewsBarChart data={effectiveBarData} title={t.fakeNewsSources} />

              {/* Komentarz AI pod wykresem */}
              {aiCommentLoading && (
                <p className="mt-2 text-xs italic text-gray-400 dark:text-gray-500 animate-pulse">
                  {language === "pl"
                    ? "Generowanie analizy AI…"
                    : language === "no"
                    ? "Genererer AI-analyse…"
                    : "Generating AI analysis…"}
                </p>
              )}
              {aiComment && (
                <div className="mt-3 rounded-lg bg-gray-200/70 dark:bg-gray-700/60 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  <span className="font-semibold text-gray-800 dark:text-gray-200">✨ {language === "pl" ? "Analiza AI:" : language === "no" ? "AI-analyse:" : "AI Analysis:"}</span>{" "}
                  {aiComment}
                </div>
              )}
              {!effectiveChartsLoading && effectiveBarData.length < effectiveTotalSources && (
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  {language === "pl"
                    ? `Załadowano ${effectiveBarData.length} z ${effectiveTotalSources} źródeł. Niektóre źródła mogą być niedostępne.`
                    : language === "no"
                    ? `Lastet ${effectiveBarData.length} av ${effectiveTotalSources} kilder. Noen kilder kan være utilgjengelige.`
                    : `Loaded ${effectiveBarData.length} of ${effectiveTotalSources} sources. Some sources may be unavailable.`}
                </p>
              )}
            </>
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
          ) : effectiveChartsStarted ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500 dark:text-gray-400 py-12">
              <p className="text-sm">
                {language === "pl"
                  ? "Brak danych — odśwież stronę"
                  : language === "no"
                  ? "Ingen data — oppdater siden"
                  : "No data — refresh the page"}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                {language === "pl" ? "Odśwież" : language === "no" ? "Oppdater" : "Refresh"}
              </button>
            </div>
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
