/**
 * Hook pobierający listę newsów dla wybranego źródła.
 * Wykorzystuje cache po stronie klienta w celu ograniczenia liczby zapytań do API.
 *
 * Klucz cache zawiera tylko source i model — NIE lang.
 * Etykiety sentymentu są tłumaczone po stronie frontendu przez useSentiment,
 * więc zmiana języka UI nie wymusza ponownego pobierania artykułów.
 */

import { useEffect, useState } from "react";
import { useNewsCache, newsKey } from "../../app/stores/newsCache";
import type { Lang } from "../../lib/types";

type Article = {
  title: string;
  link: string;
  summary: string;
  published: string;
  source: string;
  sentiment: string;
  fake_probability: number;
  sentiment_score?: number;
};

type NewsResponse = { source: string; articles: Article[] };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export function useCachedNews(source: string, lang: Lang = "pl", model: string = "roberta") {
  const [data, setData] = useState<Article[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const cache = useNewsCache();

  useEffect(() => {
    let mounted = true;
    // Klucz cache bez lang — artykuły są language-agnostic po stronie cache
    const key = newsKey(source, model);

    const cached = cache.get<Article[]>(key);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        // Lang przekazywany do backendu (wpływa na format dat itp.),
        // ale nie jest częścią klucza cache
        const res = await fetch(
          `${API_URL}/news/${encodeURIComponent(source)}?lang=${lang}&model=${model}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: NewsResponse = await res.json();
        const articles = json.articles ?? [];
        if (!mounted) return;
        setData(articles);
        cache.set(key, articles);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "fetch error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  // lang pominięty z deps — zmiana języka nie triggeruje re-fetch
  }, [source, model]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async () => {
    const key = newsKey(source, model);
    cache.del(key);
    setData(null);
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/news/${encodeURIComponent(source)}?lang=${lang}&model=${model}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: NewsResponse = await res.json();
      const articles = json.articles ?? [];
      setData(articles);
      cache.set(key, articles);
    } catch (e: any) {
      setError(e?.message ?? "fetch error");
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refresh };
}
