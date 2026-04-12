/**
 * Widok zapisanych artykułów użytkownika.
 *
 * Odpowiada za:
 * - pobieranie listy zapisanych artykułów z backendu,
 * - synchronizację języka interfejsu (localStorage + event),
 * - prezentację artykułów w formie kart,
 * - obsługę usuwania zapisanych wpisów.
 */


"use client";

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import locales from "../lib/locales";
import ArticleCard from "./ArticleCard";
import { Article } from "../lib/fetchNews";
import { getSavedArticles, deleteSavedArticle } from "../lib/savedArticles";
import type { Lang } from "../lib/types";

export default function SavedArticlesPage() {
  const [savedArticles, setSavedArticles] = useState<Article[]>([]);
  const [language, setLanguage] = useState<Lang>("pl");

  useEffect(() => {
    const storedLang = localStorage.getItem("lang");
    if (storedLang === "pl" || storedLang === "en" || storedLang === "no") {
      setLanguage(storedLang as Lang);
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === "lang") {
        const v = e.newValue;
        if (v === "pl" || v === "en" || v === "no") setLanguage(v as Lang);
      }
    };
    const onCustom = (e: Event) => {
      const lang = (e as CustomEvent).detail;
      if (lang === "pl" || lang === "en" || lang === "no") setLanguage(lang as Lang);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("app:langchange", onCustom as EventListener);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("app:langchange", onCustom as EventListener);
    };
  }, []);

  
  useEffect(() => {
    fetchSavedArticles();
  }, []);

  const fetchSavedArticles = async () => {
    try {
      const articles = await getSavedArticles();
      setSavedArticles(articles);
    } catch (error) {
      console.error("❌ Błąd pobierania artykułów:", error);
    }
  };

  const handleDelete = async (title: string) => {
    try {
      await deleteSavedArticle(title);
      setSavedArticles((prev) => prev.filter((a) => a.title !== title));
      alert(language === "pl" ? "🗑️ Artykuł usunięty." : language === "no" ? "🗑️ Artikkelen ble slettet." : "🗑️ Article deleted.");
    } catch (err) {
      console.error("❌ Delete error:", err);
      alert(language === "pl" ? "❌ Błąd usuwania." : language === "no" ? "❌ Sletting mislyktes." : "❌ Delete failed.");
    }
  };

  const t = locales[language] ?? locales.pl;

  return (
    
    <div className="p-6 text-foreground bg-gradient-to-br from-blue-50 via to-indigo-500 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
      <h1 className="flex items-center gap-2 text-2xl font-bold mb-4">
        <Bookmark className="w-5 h-5 text-blue-500 shrink-0" />
        {language === "pl" ? "Zapisane artykuły" : language === "no" ? "Lagrede artikler" : "Saved articles"}
      </h1>

      {savedArticles.length === 0 ? (
        <p className="text-gray-400">
          {language === "pl" ? "Brak zapisanych artykułów." : language === "no" ? "Ingen lagrede artikler." : "No saved articles."}
        </p>
      ) : (
        savedArticles.map((article, index) => (
          <ArticleCard
            key={index}
            article={article}
            language={language}
            locales={locales}
            onDelete={handleDelete}
            savedView={true} 
          />
        ))
      )}
    </div>
  );
}




