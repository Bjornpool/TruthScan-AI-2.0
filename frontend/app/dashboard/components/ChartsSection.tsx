/**
 * Sekcja dashboardu odpowiedzialna za wizualizację danych analitycznych.
 *
 * Dane wykresów pochodzą wyłącznie z cache Zustand (newsKey per source).
 * Cache jest wypełniany przez SSE (LiveNewsFeed) lub prefetch (strona główna).
 * Analiza AI odpala się jednorazowo gdy wszystkie 14 źródeł są w cache.
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

export default function ChartsSection({
  language,
  selectedSource,
  setSelectedSource,
}: Props) {
  const [isClient, setIsClient] = useState(false);
  const [showArticlesModal, setShowArticlesModal] = useState(false);

  const [aiComment, setAiComment]                             = useState<string | null>(null);
  const [aiCommentLoading, setAiCommentLoading]               = useState(false);
  const [aiEmotionComment, setAiEmotionComment]               = useState<string | null>(null);
  const [aiEmotionCommentLoading, setAiEmotionCommentLoading] = useState(false);

  const aiCommentFiredRef      = useRef(false);
  const aiEmotionCommentFiredRef = useRef(false);

  const {
    barData,
    emotionData,
    loadedSources,
    totalSources,
    progressPct,
    isComplete,
    hasBars,
    hasEmos,
  } = useDashboardCharts(language);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Komentarz AI dla wykresu emocji — odpala się raz gdy wszystkie źródła załadowane
  useEffect(() => {
    if (aiEmotionCommentFiredRef.current) return;
    if (!isClient || !isComplete || !hasEmos) return;
    const totalEmotions = emotionData.reduce((sum, e) => sum + e.value, 0);
    if (totalEmotions < 5) return;

    aiEmotionCommentFiredRef.current = true;
    setAiEmotionCommentLoading(true);

    const pos = emotionData.find((e) => e.name === "POSITIVE")?.value ?? 0;
    const neu = emotionData.find((e) => e.name === "NEUTRAL")?.value ?? 0;
    const neg = emotionData.find((e) => e.name === "NEGATIVE")?.value ?? 0;

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
  }, [isClient, isComplete, hasEmos, emotionData, language]);

  // Komentarz AI dla wykresu słupkowego — odpala się raz gdy wszystkie źródła załadowane
  useEffect(() => {
    if (aiCommentFiredRef.current) return;
    if (!isClient || !isComplete || !hasBars || barData.length < 5) return;

    aiCommentFiredRef.current = true;
    setAiCommentLoading(true);

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    fetch(`${apiBase}/ai-chart-comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bars: barData, lang: language }),
    })
      .then((r) => r.json())
      .then((data) => setAiComment(data.comment ?? null))
      .catch(() => setAiComment(null))
      .finally(() => setAiCommentLoading(false));
  }, [isClient, isComplete, hasBars, barData, language]);

  const t = locales[language] ?? locales.pl;

  // SSR skeleton
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

  return (
    <>
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Lewa kolumna: selektor źródła + wykres kołowy */}
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
            {hasEmos ? (
              <>
                <EmotionalPieChart
                  data={emotionData}
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
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      ✨ {language === "pl" ? "Analiza AI:" : language === "no" ? "AI-analyse:" : "AI Analysis:"}
                    </span>{" "}
                    {aiEmotionComment}
                  </div>
                )}
              </>
            ) : (
              <MiniSpinner
                text={
                  language === "pl"
                    ? "Oczekuję na artykuły…"
                    : language === "no"
                    ? "Venter på artikler…"
                    : "Waiting for articles…"
                }
              />
            )}
          </div>
        </div>

        {/* Prawa kolumna: pasek postępu + wykres słupkowy */}
        <div className="lg:col-span-2 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow flex flex-col h-full">
          {!isComplete && (
            <ProgressBar
              progressCount={loadedSources}
              totalSources={totalSources}
              progressPct={progressPct}
              language={language}
            />
          )}

          {hasBars ? (
            <>
              <FakeNewsBarChart data={barData} title={t.fakeNewsSources} />

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
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    ✨ {language === "pl" ? "Analiza AI:" : language === "no" ? "AI-analyse:" : "AI Analysis:"}
                  </span>{" "}
                  {aiComment}
                </div>
              )}
              {!isComplete && barData.length < totalSources && (
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  {language === "pl"
                    ? `Załadowano ${loadedSources} z ${totalSources} źródeł.`
                    : language === "no"
                    ? `Lastet ${loadedSources} av ${totalSources} kilder.`
                    : `Loaded ${loadedSources} of ${totalSources} sources.`}
                </p>
              )}
            </>
          ) : (
            <MiniSpinner
              text={
                language === "pl"
                  ? "Oczekuję na artykuły…"
                  : language === "no"
                  ? "Venter på artikler…"
                  : "Waiting for articles…"
              }
            />
          )}
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
