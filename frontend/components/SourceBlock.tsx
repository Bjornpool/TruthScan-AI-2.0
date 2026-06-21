/**
 * Blok porównawczy pojedynczego źródła.
 *
 * Czyta artykuły WYŁĄCZNIE z cache Zustand (ten sam klucz co wykres).
 * Nigdy nie otwiera SSE — eliminuje rozbieżności między kartami a wykresem.
 */

"use client";

import SourceSelector from "./SourceSelector";
import ArticleCard from "./ArticleCard";
import { saveArticle } from "../lib/savedArticles";
import { useNewsCache, newsKey } from "../app/stores/newsCache";
import type { Article } from "../lib/fetchNews";
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
  pl: { articles: "Artykułów:", fakeRisk: 'Ryzyko "fake":' },
  en: { articles: "Articles:",  fakeRisk: "Fake risk:" },
  no: { articles: "Artikler:", fakeRisk: "Falsk-risiko:" },
};

const NO_DATA_TEXT = {
  pl: "Brak artykułów w cache",
  en: "No articles in cache",
  no: "Ingen artikler i cache",
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

  // Czyta z tego samego klucza co useDashboardCharts — gwarantuje spójność z wykresem
  const articles = useNewsCache((state) => {
    const key = newsKey(source);
    const entry = state.cache[key];
    if (!entry || Date.now() - entry.ts > state.ttlMs) return null;
    return entry.data as Article[] | null;
  });

  console.log(
    "[BLOCK]", source,
    "key=", newsKey(source),
    "articles=", articles?.length ?? "null",
    "sentiments=", articles?.map((a) => a.sentiment) ?? "null",
  );

  const handleSave = async (article: Article) => {
    try {
      await saveArticle(article);
    } catch (err: any) {
      alert(`❌ Supabase error: ${err?.message ?? JSON.stringify(err)}`);
    }
  };

  return (
    <div
      className={`bg-gray-100 dark:bg-gray-800 rounded-lg shadow p-4 space-y-4 ${
        className ?? ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-lg md:text-xl tracking-wide text-gray-900 dark:text-gray-100">
          {source}
        </h3>
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
              <strong className="ml-1">{stats.fakeRiskPercent.toFixed(2)}%</strong>
            </span>
          )}
        </div>
      )}

      <div className="border border-black/5 dark:border-white/10 rounded-md p-2 space-y-3">
        {articles && articles.length > 0 ? (
          articles.map((a, i) => (
            <ArticleCard
              key={a.url ?? i}
              article={a}
              language={language}
              locales={locales}
              variant="compact"
              savedView={false}
              onSave={handleSave}
            />
          ))
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
            {NO_DATA_TEXT[language]}
          </p>
        )}
      </div>
    </div>
  );
}
