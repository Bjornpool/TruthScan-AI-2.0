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
import {
  Clock, Newspaper, Minus, Smile, Frown,
  AlertTriangle, ExternalLink, GitCompare, Bookmark,
} from "lucide-react";
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
  onSave?: (article: Article) => void | Promise<void>;
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
  console.log("[CARD]", article.title?.substring(0, 30), "sentiment=", article.sentiment, "→ label=", sentimentLabel);
  const { faviconSrc, sourceInitial, hasFavicon, nextFavicon } = useFavicon(article);
  const { fetchFullContent } = useArticleContent();
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [fullContent, setFullContent] = useState<string>("");
  const [showPDF, setShowPDF] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const isCompact = variant === "compact";
  const t = locales[language] ?? locales.pl;

  const T = (pl: string, no: string, en: string) =>
    language === "pl" ? pl : language === "no" ? no : en;

  // Ikona sentymentu oparta na przetłumaczonej etykiecie — zawsze spójna z wyświetlanym tekstem
  const SentimentIcon = () => {
    const s = sentimentLabel.toLowerCase();
    if (s.includes("pos") || s.includes("pozyt")) return <Smile className="w-3.5 h-3.5 text-green-500 inline" />;
    if (s.includes("neg") || s.includes("negat")) return <Frown className="w-3.5 h-3.5 text-red-400 inline" />;
    return <Minus className="w-3.5 h-3.5 text-gray-400 inline" />;
  };

  const handleExportPDF = async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      let contentToExport = article.summary || article.description || "";

      if (article.link && article.link.startsWith("http") && !fullContent) {
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

  const renderDescription = () => {
    const desc = article.summary || article.description || "";
    if (!desc) return null;
    return (
      <p className={[
        "text-gray-700 dark:text-gray-300",
        isCompact ? "text-sm line-clamp-3 mb-2" : "mb-3"
      ].join(" ")}>
        {desc}
      </p>
    );
  };

  const renderMetadata = () => (
    <div className={[
      "text-gray-600 dark:text-gray-400",
      isCompact ? "text-xs space-y-0.5 mb-2" : "text-sm space-y-1 mb-3"
    ].join(" ")}>
      {article.published && (
        <p>
          <Clock className="w-3.5 h-3.5 text-gray-400 inline mr-1" />
          {T("Data", "Dato", "Date")}:{" "}
          <time suppressHydrationWarning>{article.published}</time>
        </p>
      )}
      <p>
        <Newspaper className="w-3.5 h-3.5 text-gray-400 inline mr-1" />
        {T("Źródło", "Kilde", "Source")}: {article.source || "-"}
      </p>
      <p>
        <SentimentIcon />{" "}
        {T("Sentyment", "Sentimentanalyse", "Sentiment")}:{" "}
        <span className={sentimentColor}>{sentimentLabel}</span>
      </p>
      <p>
        <span className="relative group cursor-help">
          <AlertTriangle className="w-3.5 h-3.5 text-orange-400 inline" />
          <span className="absolute bottom-full left-0 mb-1 hidden group-hover:block w-64 bg-gray-800 text-white text-xs rounded-lg p-2 z-50 shadow-lg pointer-events-none">
            {T(
              "Wynik modelu BART wskazujący na prawdopodobieństwo dezinformacji. Powyżej 50% — artykuł może być fake newsem.",
              "BART-modellens score for sannsynlighet for feilinformasjon. Over 50% — artikkelen kan være falske nyheter.",
              "BART model score indicating misinformation probability. Above 50% — the article may be fake news."
            )}
          </span>
        </span>{" "}
        {T("Prawdopodobieństwo Fake News", "Sannsynlighet for falske nyheter", "Fake News Probability")}:{" "}
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
          className="flex items-center gap-1 text-blue-500 hover:text-blue-400 hover:underline font-medium transition"
        >
          <ExternalLink className="w-3.5 h-3.5 inline" />
          {T("Pokaż artykuł", "Vis artikkel", "View article")}
        </a>
      )}

      <button
        onClick={() => setShowCompare(true)}
        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-500 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition cursor-pointer"
      >
        <GitCompare className="w-3.5 h-3.5 inline" />
        {T("Porównaj modele", "Sammenlign modeller", "Compare models")}
      </button>

      {savedView && (
        <button
          onClick={handleExportPDF}
          disabled={isExporting || isLoadingContent}
          className={`text-purple-600 hover:text-purple-500 font-medium transition ${
            (isExporting || isLoadingContent) ? "opacity-50 cursor-not-allowed" : "hover:underline cursor-pointer"
          }`}
        >
          {isLoadingContent
            ? T(" Pobieranie...", " Laster inn...", " Loading...")
            : T(" Eksportuj PDF", " Eksporter til PDF", " Export PDF")}
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
          className="text-red-500 hover:text-red-400 hover:underline font-medium transition cursor-pointer"
        >
          🗑️ {T("Usuń", "Slett", "Delete")}
        </button>
      ) : onSave ? (
        savedOk ? (
          <span className="flex items-center gap-1 text-green-500 font-medium text-sm">
            ✅ {T("Zapisano!", "Lagret!", "Saved!")}
          </span>
        ) : (
          <button
            onClick={async () => {
              try {
                await onSave(article);
                setSavedOk(true);
                setTimeout(() => setSavedOk(false), 2500);
              } catch {
                // error handled by parent (SourceBlock)
              }
            }}
            className="flex items-center gap-1 text-green-600 hover:text-green-500 hover:underline font-medium transition cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5 inline" />
            {T("Zapisz", "Lagre", "Save")}
          </button>
        )
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
