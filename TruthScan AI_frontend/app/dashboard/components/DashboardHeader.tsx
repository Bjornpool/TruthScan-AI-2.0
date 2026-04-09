/**
 * Nagłówek dashboardu prezentujący nazwę systemu
 * oraz opis jego funkcjonalności w zależności od języka interfejsu.
 */

"use client";

import type { Lang } from "../../../lib/types";

interface Props {
  language: Lang;
  hydrated: boolean;
}

export default function DashboardHeader({ language, hydrated }: Props) {
  const isPl = language === "pl";
  const isNo = language === "no";

  return (
    <div className="bg-gray-100 dark:bg-gray-900 p-5 rounded-xl shadow-md">
      {/* Gradientowy nagłówek AI */}
      <h2
        className="text-5xl font-extrabold tracking-tight
        bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500
        text-transparent bg-clip-text
        drop-shadow-[0_0_10px_rgba(56,189,248,0.35)]
        flex items-center gap-3"
      >
        <span className="text-4xl"></span>
        TruthScan AI
      </h2>

      <p
        className="mt-3 text-gray-700 dark:text-gray-300 text-base"
        suppressHydrationWarning
      >
        {hydrated
          ? isPl
            ? "Narzędzie do analizy wiadomości z wielu źródeł, które pomaga ocenić emocjonalny wydźwięk treści oraz wykrywać potencjalnie wprowadzające w błąd informacje."
            : isNo
            ? "Verktøy for nyhetsanalyse fra flere kilder som hjelper deg å vurdere den emosjonelle tonen og oppdage potensielt villedende informasjon."
            : "A tool for analyzing news from multiple sources that helps assess emotional tone and detect potentially misleading content."
          : ""}
      </p>

      <p
        className="text-sm mt-1 text-gray-600 dark:text-gray-400 max-w-3xl"
        suppressHydrationWarning
      >
        {hydrated
          ? isPl
            ? "W oparciu o automatyczną analizę treści TruthScan AI prezentuje wyniki w formie przejrzystych wykresów i zestawienia artykułów."
            : isNo
            ? "Basert på automatisk innholdsanalyse presenterer TruthScan AI resultater i form av tydelige diagrammer og artikkeloversikter."
            : "Using automated content analysis, TruthScan AI presents results through clear charts and structured article summaries."
          : ""}
      </p>
    </div>
  );
}
