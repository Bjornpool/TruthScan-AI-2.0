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
  const cacheKey = newsKey(source);

  // Reactive selector — re-renders only when this source's cache entry changes.
  // This picks up data written by SourceComparison's parallel fetchAllNews prefetch.
  const cachedArticles = useNewsCache((s) => {
    const e = s.cache[cacheKey];
    if (!e) return null;
    return Date.now() - e.ts > s.ttlMs ? null : (e.data as Article[]);
  });

  const esRef = useRef<EventSource | null>(null);
  // Local SSE state — used only while streaming (before cache is populated)
  const [sseArticles, setSseArticles] = useState<Article[]>([]);
  const [sseState, setSseState] = useState({
    loading: cachedArticles === null,
    error: null as string | null,
    progress: 0,
    total: 0,
  });

  // When cache is populated externally (by SourceComparison's fetchAllNews),
  // close any running SSE stream and switch to cached data immediately.
  useEffect(() => {
    if (cachedArticles !== null && esRef.current) {
      esRef.current.close();
      esRef.current = null;
      setSseArticles([]);
      setSseState({
        loading: false,
        error: null,
        progress: cachedArticles.length,
        total: cachedArticles.length,
      });
    }
  }, [cachedArticles]);

  useEffect(() => {
    if (!source) return;

    // Cache hit — skip SSE entirely
    const cached = useNewsCache.getState().get<Article[]>(cacheKey);
    if (cached && cached.length > 0) {
      setSseArticles([]);
      setSseState((s) => ({ ...s, loading: false, progress: cached.length, total: cached.length }));
      return;
    }

    setSseArticles([]);
    setSseState({ loading: true, error: null, progress: 0, total: 0 });

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const es = new EventSource(`${apiBase}/stream-news/${encodeURIComponent(source)}?lang=${lang}`);
    esRef.current = es;

    let collected: Article[] = [];

    const handleMeta = (e: MessageEvent) => {
      try {
        const { total } = JSON.parse(e.data);
        setSseState((s) => ({ ...s, total: Math.min(total ?? 0, limit) }));
      } catch {}
    };

    const handleBackendError = (e: MessageEvent) => {
      const msg = (() => {
        try { return JSON.parse(e.data)?.message || "Backend error"; }
        catch { return "Backend error"; }
      })();
      setSseState((s) => ({ ...s, loading: false, error: msg }));
    };

    const handleMessage = (ev: MessageEvent) => {
      try {
        const article = JSON.parse(ev.data) as Article;
        collected.push(article);
        const next = collected.slice(0, limit);
        setSseArticles(next);
        setSseState((s) => ({
          ...s,
          progress: Math.min(next.length, s.total || limit),
        }));
      } catch {}
    };

    const handleDone = () => {
      setSseState((s) => ({ ...s, loading: false }));
      if (collected.length > 0) {
        useNewsCache.getState().set(cacheKey, collected);
      }
      es.close();
    };

    const handleError = () => {
      setSseState((s) => ({ ...s, loading: false, error: "Stream error" }));
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
  }, [source, lang, limit]);

  // Prefer reactive Zustand cache over local SSE progress buffer
  const articles = (cachedArticles ?? sseArticles).slice(0, limit);

  return {
    articles,
    loading: cachedArticles !== null ? false : sseState.loading,
    error: sseState.error,
    progress: cachedArticles !== null ? articles.length : sseState.progress,
    total: cachedArticles !== null ? articles.length : sseState.total,
  };
}
