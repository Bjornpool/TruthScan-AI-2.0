/**
 * Hook pobierający artykuły dla wybranego źródła.
 *
 * Kolejność:
 *  1. Cache Zustand (newsKey(source)) → natychmiastowy zwrot, brak requestu
 *  2. Cache MISS → HTTP GET /news/{source} (ten sam endpoint co prefetch)
 *
 * Używa tego samego endpointu co fetchOneSource() w prefetch (page.tsx)
 * i useDashboardCharts (czyta z cache). Gwarantuje spójność danych
 * między kartami artykułów a wykresem.
 */

"use client";

import { useEffect, useState } from "react";
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

  const cache = useNewsCache();

  useEffect(() => {
    if (!source) return;

    // Klucz cache — model wywiedziony z source, bez lang
    const cacheKey = newsKey(source);
    const cached = cache.get<Article[]>(cacheKey);

    // Cache HIT — zwróć dane z cache, bez requestu do backendu
    if (cached && cached.length > 0) {
      console.log(`[STREAM] ${source} key=${cacheKey} CACHE HIT ${cached.length} art. sentiments=[${cached.map((a) => a.sentiment).join(", ")}]`);
      setState({
        articles: cached,
        loading: false,
        error: null,
        progress: cached.length,
        total: cached.length,
      });
      return;
    }

    // Cache MISS — HTTP GET /news/{source} (ten sam endpoint co prefetch)
    console.log(`[STREAM] ${source} key=${cacheKey} CACHE MISS — HTTP GET /news/${source}`);

    setState({ articles: [], loading: true, error: null, progress: 0, total: 0 });

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    let cancelled = false;

    fetch(`${apiBase}/news/${encodeURIComponent(source)}?lang=${lang}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const rawArticles: Article[] = Array.isArray(data?.articles) ? data.articles : [];
        const articles = rawArticles.slice(0, limit);
        if (articles.length > 0) {
          cache.set(cacheKey, articles);
        }
        setState({
          articles,
          loading: false,
          error: null,
          progress: articles.length,
          total: articles.length,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(`[STREAM] ${source} błąd HTTP GET:`, err);
        setState((s) => ({ ...s, loading: false, error: String(err) }));
      });

    return () => {
      cancelled = true;
    };
  }, [source, limit]);

  return state;
}
