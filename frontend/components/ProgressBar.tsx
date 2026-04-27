/**
 * Komponent wizualizujący postęp ładowania danych analitycznych.
 *
 * Odpowiada za:
 * - prezentację bieżącego stanu przetwarzania źródeł,
 * - wyświetlenie wartości liczbowych i procentowych postępu,
 * - dostosowanie komunikatów do wybranego języka interfejsu (PL / EN).
 */


"use client";

import type { Lang } from "../lib/types";

interface ProgressBarProps {
  progressCount: number;
  totalSources: number;
  progressPct: number;
  language: Lang;
}

export default function ProgressBar({
  progressCount,
  totalSources,
  progressPct,
  language
}: ProgressBarProps) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>
          {language === "pl"
            ? `Załadowano źródeł: ${progressCount} / ${totalSources}`
            : language === "no"
            ? `Lastede kilder: ${progressCount} / ${totalSources}`
            : `Loaded sources: ${progressCount} / ${totalSources}`}
        </span>
        <span>{progressPct}%</span>
      </div>
      <div className="h-1.5 w-full rounded bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className="h-1.5 bg-blue-500 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}