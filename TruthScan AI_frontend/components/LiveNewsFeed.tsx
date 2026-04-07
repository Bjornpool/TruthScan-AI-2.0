/**
 * Komponent strumieniowego wyświetlania artykułów z wybranego źródła.
 *
 * Odpowiada za:
 * - odbiór danych w czasie rzeczywistym (streaming),
 * - prezentację postępu przetwarzania artykułów,
 * - animowane renderowanie listy artykułów,
 * - umożliwienie zapisu pojedynczych artykułów.
 */


"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNewsStream } from "../app/hooks/useNewsStream";
import type { Article } from "../lib/fetchNews";
import ArticleCard from "./ArticleCard";

import type { Lang } from "../lib/types";

interface LiveNewsFeedProps {
  source: string;
  language: Lang;
}

const TEXT_CONTENT = {
  pl: {
    title: "Strumień wiadomości",
    loading: "⏳ Ładowanie danych...",
    error: "❌ Błąd połączenia z serwerem",
    progress: (current: number, total: number) => `Przetworzono ${current} z ${total} artykułów`,
    complete: "✅ Wszystkie artykuły załadowane!",
    saveError: "❌ Błąd zapisu",
    saveSuccess: "✅ Artykuł zapisany!",
    connectionError: "❌ Błąd połączenia z backendem."
  },
  en: {
    title: "News Stream",
    loading: "⏳ Loading data...",
    error: "❌ Server connection error",
    progress: (current: number, total: number) => `Processed ${current} of ${total} articles`,
    complete: "✅ All articles loaded!",
    saveError: "❌ Save error",
    saveSuccess: "✅ Article saved!",
    connectionError: "❌ Connection error."
  },
  no: {
    title: "Nyhetsstrøm",
    loading: "⏳ Laster inn data...",
    error: "❌ Tilkoblingsfeil til serveren",
    progress: (current: number, total: number) => `Behandlet ${current} av ${total} artikler`,
    complete: "✅ Alle artikler lastet!",
    saveError: "❌ Lagringsfeil",
    saveSuccess: "✅ Artikkel lagret!",
    connectionError: "❌ Tilkoblingsfeil."
  }
};

export default function LiveNewsFeed({ source, language }: LiveNewsFeedProps) {
  const {
    articles: rawArticles,
    loading,
    error,
    progress = 0,
    total = 0,
  } = useNewsStream(source);

  const [localArticles, setLocalArticles] = useState<Article[]>([]);
  const t = TEXT_CONTENT[language];

  useEffect(() => {
    setLocalArticles([]);
  }, [source]);

  useEffect(() => {
    const next = (rawArticles ?? []) as Article[];
    setLocalArticles(next);
  }, [rawArticles]);

  const handleSave = async (article: Article) => {
    try {
      const response = await fetch("http://127.0.0.1:8000/save-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(article),
      });
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        alert(`${t.saveError}: ${err.detail || response.statusText}`);
        return;
      }
      
      alert(t.saveSuccess);
    } catch (err) {
      console.error("❌ Save error:", err);
      alert(t.connectionError);
    }
  };

  const progressPercent = Math.round((Math.min(progress, total) / Math.max(total, 1)) * 100);
  const progressText = t.progress(Math.min(progress, total), total);

  return (
    <div className="p-4 border rounded-xl bg-white dark:bg-gray-900 shadow-sm">
      <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">
        📡 {t.title}: <span className="text-blue-600">{source}</span>
      </h2>

      {loading && <p className="text-gray-500">{t.loading}</p>}
      
      {!!error && progress < total && (
        <p className="text-red-500">{t.error}</p>
      )}

      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-4 overflow-hidden">
        <div
          className="bg-blue-500 h-3 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
        {progressText}
      </p>

      <AnimatePresence>
        {localArticles.map((a, i) => (
          <motion.div
            key={`${a.title}-${a.published ?? i}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="mb-3"
          >
            <ArticleCard
              article={a}
              language={language}
              locales={{}} 
              variant="compact"
              savedView={false}
              onSave={handleSave}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {progress === total && total > 0 && (
        <p className="text-green-500 mt-2 text-sm font-semibold">
          {t.complete}
        </p>
      )}
    </div>
  );
}