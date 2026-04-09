/**
 * Hook pobierający listę newsów dla wybranego źródła.
 * Wykorzystuje cache po stronie klienta w celu ograniczenia liczby zapytań do API.
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

export function useCachedNews(source: string, lang: Lang = "pl", model: string = "roberta") {
  const [data, setData] = useState<Article[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const cache = useNewsCache();

  useEffect(() => {
    let mounted = true;
    const key = newsKey(source, lang, model);

    // Odczyt danych z cache przed wykonaniem zapytania HTTP
    const cached = cache.get<Article[]>(key);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/news/${encodeURIComponent(source)}?lang=${lang}&model=${model}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: NewsResponse = await res.json();
        const articles = json.articles ?? [];
        if (!mounted) return;
        setData(articles);

        // Zapis danych w cache po poprawnym pobraniu
        cache.set(key, articles);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "fetch error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      // Zabezpieczenie przed aktualizacją stanu po odmontowaniu komponentu
      mounted = false;
    };
  }, [source, lang, model]);

  const refresh = async () => {
    const key = newsKey(source, lang, model);
    cache.del(key);
    setData(null);
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/news/${encodeURIComponent(source)}?lang=${lang}&model=${model}`);
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
