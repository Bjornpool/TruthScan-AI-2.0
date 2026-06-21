/**
 * Główna strona dashboardu analitycznego aplikacji.
 *
 * Na starcie prefetchuje wszystkie 14 źródeł JEDNOCZEŚNIE (Promise.all)
 * zanim wyrenderuje wykresy i karty — gwarantuje, że oba komponenty
 * czytają ten sam snapshot RSS z cache Zustand.
 */

"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import DashboardHeader from "./components/DashboardHeader";
import ModelInfoSection from "./components/ModelInfoSection";
import ChartsSection from "./components/ChartsSection";
import SourceComparison from "./components/SourceComparison";
import { useNewsCache, newsKey } from "../../app/stores/newsCache";
import { fetchOneSource } from "../../lib/fetchNews";

const ALL_SOURCES = [
  "BBC", "CNN", "NYTimes", "Guardian", "AlJazeera",
  "Money", "PolsatNews", "TVN24", "SpidersWeb", "Bankier",
  "NRK", "VG", "E24", "Aftenposten",
] as const;

const REFRESH_TEXT = {
  pl: "Odśwież ",
  en: "Refresh ",
  no: "Oppdater ",
} as const;

const LOADING_TEXT = {
  pl: "Ładowanie źródeł wiadomości…",
  en: "Loading news sources…",
  no: "Laster nyhetskilder…",
} as const;

export default function DashboardPage() {
  const { language } = useLanguage();
  const [selectedSource, setSelectedSource] = useState("BBC");
  const cache = useNewsCache();
  const [reloadKey, setReloadKey] = useState(0);
  const [prefetchDone, setPrefetchDone] = useState(false);
  const [prefetchProgress, setPrefetchProgress] = useState(0);
  const [prefetchTotal, setPrefetchTotal] = useState(0);

  useEffect(() => {
    const cacheState = useNewsCache.getState();
    const missing = (ALL_SOURCES as readonly string[]).filter(
      (src) => !cacheState.get(newsKey(src))
    );

    // Wszystkie źródła są już w cache (np. powrót w ciągu TTL 5 min)
    if (missing.length === 0) {
      setPrefetchDone(true);
      return;
    }

    setPrefetchDone(false);
    setPrefetchProgress(0);
    setPrefetchTotal(missing.length);

    let completed = 0;

    console.log(`[PREFETCH] start — brakujące: ${missing.join(", ")}`);

    // Pobieramy wszystkie brakujące źródła JEDNOCZEŚNIE — ten sam snapshot RSS
    Promise.all(
      missing.map(async (src) => {
        const key = newsKey(src);
        try {
          const { articles } = await fetchOneSource(src, language);
          if (articles.length > 0) {
            useNewsCache.getState().set(key, articles);
            console.log(
              `[PREFETCH] ${src} key=${key} ${articles.length} art. sentiments=[${articles.map((a) => a.sentiment).join(", ")}]`
            );
          } else {
            console.warn(`[PREFETCH] ${src} — brak artykułów`);
          }
        } catch (err) {
          console.error(`[PREFETCH] ${src} — błąd:`, err);
        } finally {
          completed++;
          setPrefetchProgress(completed);
        }
      })
    ).finally(() => {
      console.log("[PREFETCH] done — prefetchDone=true");
      setPrefetchDone(true);
    });
    // language przechwycony w momencie uruchomienia efektu; pomijamy go
    // z deps bo wybór modelu zależy od source, nie od języka UI
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const handleRefresh = () => {
    ALL_SOURCES.forEach((src) => {
      cache.del(newsKey(src));
    });
    setReloadKey((k) => k + 1);
  };

  // Ekran ładowania — wyświetlany dopóki wszystkie źródła nie trafią do cache
  if (!prefetchDone) {
    const pct =
      prefetchTotal > 0 ? Math.round((prefetchProgress / prefetchTotal) * 100) : 0;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-100 to-indigo-500 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">
            {LOADING_TEXT[language]}
          </p>
          {prefetchTotal > 0 && (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {prefetchProgress} / {prefetchTotal}&nbsp;&nbsp;({pct}%)
              </p>
              <div className="w-64 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mx-auto">
                <div
                  className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full space-y-6 p-6 text-foreground bg-gradient-to-br from-blue-50 via-indigo-100 to-indigo-500 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
      <div className="flex items-center justify-between gap-3">
        <DashboardHeader
          language={language}
          hydrated={true}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 rounded-lg bg-white/80 px-3 py-1.5 text-sm
               text-slate-900 shadow-sm hover:bg-white dark:bg-slate-700
               dark:text-slate-100 dark:hover:bg-slate-700 transition-colors"
            title={REFRESH_TEXT[language]}
          >
            <span className="text-lg">↺</span>
            {REFRESH_TEXT[language]}
          </button>
        </div>
      </div>

      <ModelInfoSection language={language} />

      <ChartsSection
        key={`${selectedSource}:${reloadKey}`}
        language={language}
        selectedSource={selectedSource}
        setSelectedSource={setSelectedSource}
      />

      <SourceComparison language={language} />
    </div>
  );
}
