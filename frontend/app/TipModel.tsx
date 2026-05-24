/**
 * Komponent modalny wyświetlający edukacyjne porady dla użytkownika.
 */

"use client";

import { useEffect } from "react";

type TipModalProps = {
  title: string;
  body: string;
  linkHref: string;
  linkLabel: string;
  onClose: () => void;
};

export default function TipModal({
  title,
  body,
  linkHref,
  linkLabel,
  onClose,
}: TipModalProps) {
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
      <div className="relative z-[101] w-[92vw] max-w-xl rounded-lg bg-white dark:bg-slate-900 shadow-lg border border-slate-200/60 dark:border-slate-700/60">
        <div className="flex items-start justify-between p-4 border-b border-slate-200/60 dark:border-slate-700/60">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            ✕
          </button>
        </div>

        <div className="p-4 text-sm text-slate-700 dark:text-slate-200">
          <p className="mb-3 leading-relaxed">{body}</p>
          <a
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 underline hover:no-underline"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 3h7v7M10 14 21 3" />
              <path d="M21 14v7h-7M3 10v11h11" />
            </svg>
            {linkLabel}
          </a>
        </div>

        <div className="p-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
