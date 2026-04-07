/**
 * Komponent prezentujący pojedynczy artykuł informacyjny.
 *
 * Odpowiada za:
 * - wyświetlanie metadanych artykułu (tytuł, źródło, data, sentyment),
 * - obsługę akcji użytkownika (zapis, usunięcie, eksport do PDF),
 * - integrację z hookami pomocniczymi (sentyment, favicona, treść artykułu),
 * - renderowanie w trybie pełnym lub kompaktowym.
 */

"use client";

import React from "react";
import ArticleCard from "./ArticleCard";
import locales from "../lib/locales";
import { Article } from "../lib/fetchNews";
import type { Lang } from "../lib/types";

type ArticleListProps = {
  articles: Article[];
  language: Lang;
  locales: typeof locales;
  savedView?: boolean;
  onDelete?: (title: string) => void; 
};

export default function ArticleList({
  articles,
  language,
  locales,
  savedView = false,
  onDelete,
}: ArticleListProps) {
  if (!articles || articles.length === 0) {
    return (
      <p className="text-gray-500">
        {language === "pl" ? "Brak artykułów do wyświetlenia." : language === "no" ? "Ingen artikler å vise." : "No articles to display."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {articles.map((article, idx) => (
        <ArticleCard
          key={idx}
          article={article}
          language={language}
          locales={locales}
          savedView={savedView}
          onDelete={onDelete ? () => onDelete(article.title) : undefined}
        />
      ))}
    </div>
  );
}





