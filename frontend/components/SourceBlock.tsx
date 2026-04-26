/**
 * Blok porównawczy pojedynczego źródła informacyjnego.
 *
 * Odpowiada za:
 * - prezentację wybranego źródła wiadomości,
 * - możliwość dynamicznej zmiany źródła w obrębie porównania,
 * - wyświetlenie podstawowych metryk (liczba artykułów, ryzyko fake news),
 * - osadzenie strumienia artykułów dla danego źródła.
 */

"use client";

import SourceSelector from "./SourceSelector";
import LiveNewsFeed from "./LiveNewsFeed";
import type { Lang } from "../lib/types";

export type SourceBlockProps = {
  source: string;
  onChangeSource: (s: string) => void;
  language: Lang;
  locales: any;
  stats?: {
    articlesCount?: number;
    fakeRiskPercent?: number;
  };
  className?: string;
};

const STATS_TEXT = {
  pl: {
    articles: "Artykułów:",
    fakeRisk: 'Ryzyko "fake":',
  },
  en: {
    articles: "Articles:",
    fakeRisk: "Fake risk:",
  },
  no: {
    articles: "Artikler:",
    fakeRisk: "Falsk-risiko:",
  },
};

export default function SourceBlock({
  source,
  onChangeSource,
  language,
  locales,
  stats,
  className,
}: SourceBlockProps) {
  const t = STATS_TEXT[language];

  return (
    <div
      className={`bg-gray-100 dark:bg-gray-800 rounded-lg shadow p-4 space-y-4 ${
        className ?? ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-lg md:text-xl tracking-wide text-gray-900 dark:text-gray-100">
            {source}
          </h3>
        </div>

        <div className="w-[220px]">
          <SourceSelector
            selectedSource={source}
            setSelectedSource={onChangeSource}
            language={language}
            locales={locales}
          />
        </div>
      </div>

      {stats && (stats.articlesCount != null || stats.fakeRiskPercent != null) && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
          {stats.articlesCount != null && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              {t.articles}
              <strong className="ml-1">{stats.articlesCount}</strong>
            </span>
          )}
          {stats.fakeRiskPercent != null && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              {t.fakeRisk}
              <strong className="ml-1">
                {stats.fakeRiskPercent.toFixed(2)}%
              </strong>
            </span>
          )}
        </div>
      )}

      {/* Feed – remount przy zmianie źródła */}
      <div className="border border-black/5 dark:border-white/10 rounded-md">
        <LiveNewsFeed key={source} source={source} language={language} />
      </div>
    </div>
  );
}

