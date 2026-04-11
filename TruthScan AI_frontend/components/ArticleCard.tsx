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

import React, { useState } from "react";
import { Article } from "../lib/fetchNews";
import { useArticleContent } from "../app/hooks/useArticleContent";
import { useFavicon } from "../app/hooks/useFavicon";
import { useSentiment } from "../app/hooks/useSentiment";
import PDFModal from "./PDFModal";
import CompareModal from "./CompareModal";
import type { Lang } from "../lib/types";

interface ArticleCardProps {
  article: Article;
  language: Lang;
  locales: any;
  onDelete?: (title: string) => void;
  savedView?: boolean;
  variant?: "full" | "compact";
  onSave?: (article: Article) => void;
}

export default function ArticleCard({
  article,
  language,
  locales,
  onDelete,
  savedView = false,
  variant = "full",
  onSave,
}: ArticleCardProps) {
  const { label: sentimentLabel, color: sentimentColor } = useSentiment(article.sentiment || "", language);
  const { faviconSrc, sourceInitial, hasFavicon, nextFavicon } = useFavicon(article); 
  const { fetchFullContent } = useArticleContent();
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [fullContent, setFullContent] = useState<string>("");
  const [showPDF, setShowPDF] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const isCompact = variant === "compact";
  const t = locales[language] ?? locales.pl;

  const T = (pl: string, no: string, en: string) =>
    language === "pl" ? pl : language === "no" ? no : en;

  const handleExportPDF = async () => {
    if (isExporting) return;
    
    setIsExporting(true);
    try {
      let contentToExport = article.summary || article.description || "";
      
      if (article.link && article.link.startsWith('http') && !fullContent) {
        setIsLoadingContent(true);
        try {
          const fetchedContent = await fetchFullContent(article.link);
          setFullContent(fetchedContent);
        } catch (error) {
          console.log("ℹ️ Używam dostępnej treści");
        } finally {
          setIsLoadingContent(false);
        }
      }

      setShowPDF(true);
    } catch (error) {
      console.error("❌ Błąd przygotowania PDF:", error);
      alert(T("Błąd podczas przygotowywania PDF", "Feil ved forberedelse av PDF", "Error preparing PDF"));
    } finally {
      setIsExporting(false);
    }
  };

  const handlePDFClose = () => setShowPDF(false);
  const handlePDFExportStart = () => console.log("🟡 Eksport PDF rozpoczęty");
  const handlePDFExportEnd = () => {
    console.log("🟢 Eksport PDF zakończony");
    handlePDFClose();
  };

  const renderHeader = () => (
    <div className="flex items-start gap-3 mb-2">
      {hasFavicon ? ( 
        <img
          src={faviconSrc}
          alt={`${article.source} favicon`}
          width={24}
          height={24}
          className="w-6 h-6 rounded-sm mt-1 ring-1 ring-black/10 dark:ring-white/10 bg-white object-contain"
          referrerPolicy="no-referrer"
          onError={nextFavicon} 
        />
      ) : (
        <div className="w-6 h-6 rounded-sm mt-1 bg-gray-200 dark:bg-gray-700 grid place-items-center text-xs font-semibold">
          {sourceInitial}
        </div>
      )}

      <h2 className={[
        "font-bold text-blue-600 dark:text-blue-400",
        isCompact ? "text-base leading-snug" : "text-lg"
      ].join(" ")}>
        {article.title}
      </h2>
    </div>
  );

  const renderDescription = () => (
    <p className={[
      "text-gray-700 dark:text-gray-300",
      isCompact ? "text-sm line-clamp-3 mb-2" : "mb-3"
    ].join(" ")}>
      {article.summary || article.description ||
        T("Brak opisu", "Ingen beskrivelse", "No description")}
    </p>
  );

  const renderMetadata = () => (
    <div className={[
      "text-gray-500 dark:text-gray-400",
      isCompact ? "text-xs space-y-0.5 mb-2" : "text-sm space-y-1 mb-3"
    ].join(" ")}>
      <p>
        🕒 {T("Data", "Dato", "Date")}:{" "}
        <time suppressHydrationWarning>
          {article.published || T("Brak daty", "Ingen dato", "No date")}
        </time>
      </p>
      <p>📰 {T("Źródło", "Kilde", "Source")}: {article.source || "-"}</p>
      <p>
        💬 {T("Sentyment", "Sentimentanalyse", "Sentiment")}:{" "}
        <span className={sentimentColor}>{sentimentLabel}</span>
      </p>
      <p>
        ❓ {T("Prawdopodobieństwo Fake News", "Sannsynlighet for falske nyheter", "Fake News Probability")}:{" "}
        {typeof article.fake_probability === "number"
          ? `${article.fake_probability.toFixed(2)}%`
          : T("Brak danych", "Ingen data", "No data")}
      </p>
    </div>
  );

  const renderActions = () => (
    <div className={[
      "flex items-center gap-6 pt-2 border-t border-gray-300 dark:border-gray-700",
      isCompact ? "mt-2" : "mt-3"
    ].join(" ")}>
      {article.link && (
        <a
          href={article.link.startsWith("http") ? article.link : `https://${article.link}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-400 font-medium transition"
        >
          🔗 {T("Pokaż artykuł", "Vis artikkel", "View article")}
        </a>
      )}

      <button
        onClick={() => setShowCompare(true)}
        className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300
                   font-medium transition"
      >
        🔬 {T("Porównaj modele", "Sammenlign modeller", "Compare models")}
      </button>

      {savedView && (
        <button
          onClick={handleExportPDF}
          disabled={isExporting || isLoadingContent}
          className={`text-purple-600 hover:text-purple-500 font-medium transition ${
            (isExporting || isLoadingContent) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isLoadingContent ? '⏳' : isExporting ? '📄' : '📄'} 
          {isLoadingContent
            ? T(" Pobieranie...", " Laster inn...", " Loading...")
            : T(" Eksportuj PDF", " Eksporter til PDF", " Export PDF")
          }
        </button>
      )}

      {savedView ? (
        <button
          onClick={() => {
            if (confirm(T(
              "Czy na pewno chcesz usunąć ten artykuł?",
              "Er du sikker på at du vil slette denne artikkelen?",
              "Are you sure you want to delete this article?"
            ))) {
              onDelete?.(article.title);
            }
          }}
          className="text-red-500 hover:text-red-400 font-medium transition"
        >
          🗑️ {T("Usuń", "Slett", "Delete")}
        </button>
      ) : onSave ? (
        <button
          onClick={() => onSave(article)}
          className="text-green-600 hover:text-green-500 font-medium transition"
        >
          💾 {T("Zapisz", "Lagre", "Save")}
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <article className={[
        "relative rounded-2xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 transition-all duration-300",
        isCompact ? "p-4 shadow-sm hover:shadow-md" : "p-5 shadow-md hover:shadow-lg hover:-translate-y-0.5"
      ].join(" ")}>
        {renderHeader()}
        {renderDescription()}
        {renderMetadata()}
        {renderActions()}
      </article>

      <PDFModal
        article={article}
        language={language}
        sentimentLabel={sentimentLabel}
        sentimentColor={sentimentColor}
        fullContent={fullContent}
        isLoadingContent={isLoadingContent}
        showPDF={showPDF}
        onClose={handlePDFClose}
        onExportStart={handlePDFExportStart}
        onExportEnd={handlePDFExportEnd}
      />

      {showCompare && (
        <CompareModal
          article={article}
          language={language}
          onClose={() => setShowCompare(false)}
        />
      )}
    </>
  );
}