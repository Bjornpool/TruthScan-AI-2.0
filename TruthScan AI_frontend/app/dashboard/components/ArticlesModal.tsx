/**
 * Modal wyświetlający strumień artykułów dla wybranego źródła informacyjnego.
 */

"use client";

import { useEffect } from "react";
import LiveNewsFeed from "../../../components/LiveNewsFeed";

import type { Lang } from "../../../lib/types";

interface ArticlesModalProps {
  source: string;
  language: Lang;
  onClose: () => void;
}

export default function ArticlesModal({
  source,
  language,
  onClose,
}: ArticlesModalProps) {
  // ESC + blokada scrolla z kompensacją paska
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);

    const docEl = document.documentElement;
    const bodyEl = document.body;
    const scrollbarWidth = window.innerWidth - docEl.clientWidth;
    const prevOverflow = bodyEl.style.overflow;
    const prevPaddingRight = bodyEl.style.paddingRight;

    if (scrollbarWidth > 0) bodyEl.style.paddingRight = `${scrollbarWidth}px`;
    bodyEl.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      bodyEl.style.overflow = prevOverflow;
      bodyEl.style.paddingRight = prevPaddingRight;
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      
      <div className="relative z-[101] w-[95vw] max-w-6xl h-[85vh] rounded-lg bg-white dark:bg-slate-900 shadow-lg border border-slate-200/60 dark:border-slate-700/60 flex flex-col">
        <div className="flex items-start justify-between p-4 border-b border-slate-200/60 dark:border-slate-700/60 flex-shrink-0">
          <h3 className="text-lg font-semibold">
            {language === "pl" ? "Artykuły z" : language === "no" ? "Artikler fra" : "Articles from"} <span className="text-blue-600">{source}</span>
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <LiveNewsFeed 
            source={source}
            language={language}
          />
        </div>

        <div className="p-3 border-t border-slate-200/60 dark:border-slate-700/60 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            {language === "pl" ? "Zamknij" : language === "no" ? "Lukk" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}