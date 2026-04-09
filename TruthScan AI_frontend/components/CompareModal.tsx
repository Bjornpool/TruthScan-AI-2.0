/**
 * Modal porównania wszystkich adapterów NLP dla jednego artykułu.
 * Wysyła POST /compare i prezentuje macierz wyników + wyjaśnienie Claude.
 */

"use client";

import React, { useState, useCallback } from "react";
import type { Article } from "../lib/fetchNews";
import type { Lang } from "../lib/types";

interface AdapterResult {
  adapter: string;
  sentiment: string;
  sentiment_score: number;
  inference_time_ms: number;
}

interface CompareResponse {
  shared_fake_probability: number;
  results: AdapterResult[];
  explanation: string;
}

interface CompareModalProps {
  article: Article;
  language: Lang;
  onClose: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")   // **bold**
    .replace(/\*(.+?)\*/g, "$1")        // *italic*
    .replace(/^#{1,6}\s+/gm, "")        // # nagłówki
    .replace(/^[\-\*]\s+/gm, "")        // - listy
    .replace(/^\d+\.\s+/gm, "")         // 1. listy numerowane
    .replace(/`(.+?)`/g, "$1")          // `kod`
    .trim();
}

// Nazwy modeli czytelne dla użytkownika
const ADAPTER_DISPLAY: Record<string, string> = {
  "roberta":     "RoBERTa",
  "xlm-roberta": "XLM-RoBERTa",
  "norbert":     "NorBERT 3",
  "herbert":     "HerBERT",
};

function sentimentRowClass(sentiment: string): string {
  const s = sentiment.toLowerCase();
  if (s.includes("pozyt") || s.includes("posit") || s.includes("positivt")) {
    return "bg-green-50 dark:bg-green-900/20";
  }
  if (s.includes("negat") || s.includes("negativt")) {
    return "bg-red-50 dark:bg-red-900/20";
  }
  return "bg-gray-50 dark:bg-gray-700/30";
}

function sentimentBadgeClass(sentiment: string): string {
  const s = sentiment.toLowerCase();
  if (s.includes("pozyt") || s.includes("posit") || s.includes("positivt")) {
    return "bg-green-100 text-green-800 dark:bg-green-800/40 dark:text-green-300";
  }
  if (s.includes("negat") || s.includes("negativt")) {
    return "bg-red-100 text-red-800 dark:bg-red-800/40 dark:text-red-300";
  }
  return "bg-gray-200 text-gray-700 dark:bg-gray-600/50 dark:text-gray-300";
}

function fakeProbColor(prob: number): string {
  if (prob >= 50) return "text-red-600 dark:text-red-400 font-bold";
  if (prob >= 25) return "text-orange-500 dark:text-orange-400 font-semibold";
  return "text-green-600 dark:text-green-400 font-semibold";
}

export default function CompareModal({ article, language, onClose }: CompareModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const T = (pl: string, no: string, en: string) =>
    language === "pl" ? pl : language === "no" ? no : en;

  const runCompare = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStarted(true);

    const text = article.summary || article.description || article.content || article.title || "";

    try {
      const res = await fetch(`${API_URL}/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          title: article.title ?? "",
          source: article.source ?? "",
          lang: language,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.detail ?? `HTTP ${res.status}`);
      }

      const json = (await res.json()) as CompareResponse;
      setData(json);
    } catch (e: any) {
      setError(e?.message ?? T("Nieznany błąd", "Ukjent feil", "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [article, language]);

  // Auto-start on mount
  React.useEffect(() => {
    if (!started) runCompare();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col
                      bg-white dark:bg-gray-900 rounded-2xl shadow-2xl
                      border border-gray-200 dark:border-gray-700 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4
                        border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              🔬 {T("Porównanie modeli NLP", "Sammenligning av NLP-modeller", "NLP Model Comparison")}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {article.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700
                       dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Zamknij"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-gray-500 dark:text-gray-400">
              <svg className="w-10 h-10 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm font-medium">
                {T(
                  "Analizuję wszystkimi modelami…",
                  "Analyserer med alle modeller…",
                  "Analyzing with all models…"
                )}
              </p>
              <p className="text-xs opacity-60">
                {T(
                  "Może to potrwać kilkanaście sekund.",
                  "Dette kan ta noen sekunder.",
                  "This may take a few seconds."
                )}
              </p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700
                            p-4 flex items-start gap-3">
              <span className="text-xl flex-shrink-0">⚠️</span>
              <div>
                <p className="font-semibold text-red-700 dark:text-red-300">
                  {T("Błąd analizy", "Analysefeil", "Analysis error")}
                </p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
                <button
                  onClick={runCompare}
                  className="mt-3 text-sm font-medium text-red-700 dark:text-red-300
                             underline hover:no-underline"
                >
                  {T("Spróbuj ponownie", "Prøv igjen", "Try again")}
                </button>
              </div>
            </div>
          )}

          {/* Results */}
          {!loading && data && (
            <>
              {/* Shared fake probability — jeden wynik dla wszystkich modeli */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3
                              flex items-center justify-between gap-4
                              bg-gray-50 dark:bg-gray-800/50">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    {T("Fake news (BART — wspólny dla wszystkich modeli)",
                       "Fake news (BART — felles for alle modeller)",
                       "Fake news (BART — shared across all models)")}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    facebook/bart-large-mnli · zero-shot
                  </p>
                </div>
                <span className={`text-2xl tabular-nums ${fakeProbColor(data.shared_fake_probability)}`}>
                  {data.shared_fake_probability.toFixed(1)}%
                </span>
              </div>

              {/* Sentiment table — per adapter */}
              <div>
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
                  {T("Sentyment według modelu", "Sentiment per modell", "Sentiment by model")}
                </h3>
                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400
                                     text-xs uppercase tracking-wide">
                        <th className="text-left px-4 py-2.5">
                          {T("Model", "Modell", "Model")}
                        </th>
                        <th className="text-left px-4 py-2.5">
                          {T("Sentyment", "Sentiment", "Sentiment")}
                        </th>
                        <th className="text-right px-4 py-2.5">
                          {T("Pewność", "Sikkerhet", "Confidence")}
                        </th>
                        <th className="text-right px-4 py-2.5">
                          {T("Czas (ms)", "Tid (ms)", "Time (ms)")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {data.results.map((r) => (
                        <tr key={r.adapter} className={sentimentRowClass(r.sentiment)}>
                          <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-100">
                            {ADAPTER_DISPLAY[r.adapter] ?? r.adapter}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium
                                             ${sentimentBadgeClass(r.sentiment)}`}>
                              {r.sentiment}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                            {(r.sentiment_score * 100).toFixed(0)}%
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-500 dark:text-gray-400">
                            {r.inference_time_ms.toFixed(0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Claude explanation */}
              {data.explanation && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
                    {T("Analiza AI", "AI-analyse", "AI Analysis")}
                  </h3>
                  <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50
                                  dark:from-indigo-900/20 dark:to-purple-900/20
                                  border border-indigo-200 dark:border-indigo-700/50 p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0 mt-0.5">🤖</span>
                      <div>
                        <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-2 uppercase tracking-wide">
                          Claude AI
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                          {stripMarkdown(data.explanation)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200
                       dark:bg-gray-800 dark:hover:bg-gray-700
                       text-gray-700 dark:text-gray-300 text-sm font-medium transition"
          >
            {T("Zamknij", "Lukk", "Close")}
          </button>
        </div>
      </div>
    </div>
  );
}
