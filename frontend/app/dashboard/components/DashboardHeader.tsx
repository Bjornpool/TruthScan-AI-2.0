/**
 * Nagłówek dashboardu — opis systemu + statystyki na żywo.
 * Licznik artykułów aktualizuje się reaktywnie przez subskrypcję Zustand cache.
 */

"use client";

import { useEffect, useState } from "react";
import locales from "../../../lib/locales";
import { useNewsCache, newsKey } from "../../stores/newsCache";
import RotatingFact from "./RotatingFact";
import type { Lang } from "../../../lib/types";

interface Props {
  language: Lang;
  hydrated: boolean;
}

const ALL_SOURCES = [
  "BBC", "CNN", "NYTimes", "Guardian", "AlJazeera",
  "Money", "PolsatNews", "TVN24", "SpidersWeb", "Bankier",
  "NRK", "VG", "E24", "Aftenposten",
] as const;

/** Zlicza artykuły ze wszystkich źródeł obecnych w cache. */
function countCachedArticles(): number {
  const state = useNewsCache.getState();
  return ALL_SOURCES.reduce((sum, src) => {
    const articles = state.get<any[]>(newsKey(src));
    return sum + (articles?.length ?? 0);
  }, 0);
}

interface StatCardProps {
  value: string | number | string[];
  label: string;
  color: string;
}

function StatCard({ value, label, color }: StatCardProps) {
  const ring: Record<string, string> = {
    blue:   "border-blue-400/60   dark:border-blue-500/50",
    purple: "border-purple-400/60 dark:border-purple-500/50",
    pink:   "border-pink-400/60   dark:border-pink-500/50",
    indigo: "border-indigo-400/60 dark:border-indigo-500/50",
  };
  const text: Record<string, string> = {
    blue:   "text-blue-600   dark:text-blue-400",
    purple: "text-purple-600 dark:text-purple-400",
    pink:   "text-pink-600   dark:text-pink-400",
    indigo: "text-indigo-600 dark:text-indigo-400",
  };

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border bg-white/60 dark:bg-gray-800/60 px-3 py-2.5 shadow-sm backdrop-blur-sm ${ring[color]}`}
    >
      <span className={`text-2xl font-extrabold leading-none ${text[color]}`}>
        {Array.isArray(value)
          ? value.map((f, i) => <span key={i} className="mx-0.5">{f}</span>)
          : value}
      </span>
      <span className="mt-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

export default function DashboardHeader({ language, hydrated }: Props) {
  const t = locales[language] ?? locales.pl;
  const [articleCount, setArticleCount] = useState(0);

  // Inicjalizacja + subskrypcja reaktywna — aktualizuje się gdy prefetch/SSE zapisuje do cache
  useEffect(() => {
    setArticleCount(countCachedArticles());

    const unsub = useNewsCache.subscribe(() => {
      setArticleCount(countCachedArticles());
    });
    return () => unsub();
  }, []);

  const stats = [
    { value: ALL_SOURCES.length, label: t.statSources,   color: "blue"   },
    { value: articleCount,       label: t.statArticles,   color: "purple" },
    { value: 4,                  label: t.statModels,     color: "pink"   },
    { value: ["🇵🇱", "🇳🇴", "🇬🇧"], label: t.statLanguages,  color: "indigo" },
  ];

  return (
    <div className="bg-gray-100 dark:bg-gray-900 p-5 rounded-xl shadow-md w-full">
      <h2
        className="text-5xl font-extrabold tracking-tight
        bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500
        text-transparent bg-clip-text
        drop-shadow-[0_0_10px_rgba(56,189,248,0.35)]
        flex items-center gap-3 mb-4"
      >
        <span className="text-4xl"></span>
        TruthScan AI
      </h2>

      {/* Opis + statystyki obok siebie */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Opis — 40% */}
        <p
          className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed lg:w-2/5"
          suppressHydrationWarning
        >
          {hydrated ? t.dashboardDescription : ""}
        </p>

        {/* Statystyki — 60%, siatka 2×2 */}
        {hydrated && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-3 lg:w-3/5">
            {stats.map((s) => (
              <StatCard key={s.label} value={s.value} label={s.label} color={s.color} />
            ))}
          </div>
        )}
      </div>

      {hydrated && (
        <div className="mt-3">
          <RotatingFact language={language} />
        </div>
      )}
    </div>
  );
}
