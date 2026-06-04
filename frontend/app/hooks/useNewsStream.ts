/**
 * Hook obsługujący strumieniowe pobieranie newsów (SSE) dla wybranego źródła.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import type { Article } from "@/lib/fetchNews";
import { useNewsCache, newsKey } from "../../app/stores/newsCache";
import type { Lang } from "../../lib/types";

type StreamState = {
  articles: Article[];
  loading: boolean;
  error: string | null;
  progress: number;
  total: number;
};

export function useNewsStream(source: string, lang: Lang = "pl", limit: number = 5): StreamState {
  const [state, setState] = useState<StreamState>({
    articles: [],
    loading: true,
    error: null,
    progress: 0,
    total: 0,
  });

  const esRef = useRef<EventSource | null>(null);
  const cache = useNewsCache();

  useEffect(() => {
    if (!source) return;

    // Klucz cache bez lang — etykiety tłumaczone przez useSentiment po stronie UI
    const cacheKey = newsKey(source);
    const cached = cache.get<Article[]>(cacheKey);

    // Jeżeli dane są w cache, pomijamy połączenie SSE
    if (cached && cached.length > 0) {
      setState({
        articles: cached,
        loading: false,
        error: null,
        progress: cached.length,
        total: cached.length,
      });
      return;
    }

    setState({
      articles: [],
      loading: true,
      error: null,
      progress: 0,
      total: 0,
    });

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const es = new EventSource(`${apiBase}/stream-news/${encodeURIComponent(source)}?lang=${lang}`);
    esRef.current = es;

    let collected: Article[] = [];

    const handleMeta = (e: MessageEvent) => {
      try {
        const { total } = JSON.parse(e.data);
        setState((s) => ({ ...s, total: Math.min(total ?? 0, limit) }));
      } catch {
      }
    };

    const handleBackendError = (e: MessageEvent) => {
      const msg = (() => {
        try {
          return JSON.parse(e.data)?.message || "Backend error";
        } catch {
          return "Backend error";
        }
      })();
      setState((s) => ({ ...s, loading: false, error: msg }));
    };

    const handleMessage = (ev: MessageEvent) => {
      try {
        const article = JSON.parse(ev.data) as Article;
        collected.push(article);
        setState((s) => {
          const next = [...s.articles, article].slice(0, limit);
          return {
            ...s,
            articles: next,
            progress: Math.min(next.length, s.total || limit),
          };
        });
      } catch {
      }
    };

    const handleDone = () => {
      setState((s) => ({ ...s, loading: false }));
      // Zapis pełnego wyniku do cache po zakończeniu strumienia
      if (collected.length > 0) {
        cache.set(cacheKey, collected); // zapisane bez lang w kluczu
      }
      es.close();
    };

    const handleError = () => {
      setState((s) => ({ ...s, loading: false, error: "Stream error" }));
      es.close();
    };

    es.addEventListener("meta", handleMeta);
    es.addEventListener("backend_error", handleBackendError);
    es.addEventListener("done", handleDone);
    es.onmessage = handleMessage;
    es.onerror = handleError;

    return () => {
      es.removeEventListener("meta", handleMeta);
      es.removeEventListener("backend_error", handleBackendError);
      es.removeEventListener("done", handleDone);
      es.close();
    };
  // lang celowo pominięty z deps — zmiana języka UI nie powinna restartować SSE.
  // Wartość lang jest przechwytywana z closure przy pierwszym otwarciu połączenia
  // (gdy source się zmienia). Klucz cache nie zawiera lang, więc cache działa poprawnie.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, limit]);

  return state;
}
