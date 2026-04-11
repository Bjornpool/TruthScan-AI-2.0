/**
 * Główna strona dashboardu analitycznego aplikacji.
 */

"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import DashboardHeader from "./components/DashboardHeader";
import ChartsSection from "./components/ChartsSection";
import SourceComparison from "./components/SourceComparison";

import { useNewsCache, newsKey } from "../../app/stores/newsCache";

const ALL_SOURCES = [
  "BBC", "CNN", "NYTimes", "Guardian", "AlJazeera",
  "Money", "PolsatNews", "TVN24", "SpidersWeb", "Bankier",
  "NRK", "VG", "E24", "Aftenposten",
] as const;

export default function DashboardPage() {
  const [hydrated, setHydrated] = useState(false);
  const { language } = useLanguage();
  const [selectedSource, setSelectedSource] = useState("BBC");
  const cache = useNewsCache();
  const [reloadKey, setReloadKey] = useState(0);

  const REFRESH_TEXT = {
    pl: "Odśwież ",
    en: "Refresh ",
    no: "Oppdater ",
  } as const;

  useEffect(() => {
    setHydrated(true);
  }, []);

  const handleRefresh = () => {
    ALL_SOURCES.forEach((src) => {
      cache.del(newsKey(src));
    });
    cache.del("dashboard:charts");
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="mx-auto w-full space-y-6 p-6 text-foreground bg-gradient-to-br from-blue-50 via-indigo-100 to-indigo-500 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
      <div className="flex items-center justify-between gap-3">
        <DashboardHeader
          language={language}
          hydrated={hydrated}
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
