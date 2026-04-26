/**
 * Hook pobierający statystyki emocji dla źródła z wykorzystaniem cache po stronie klienta.
 */

"use client";

import { useEffect, useState } from "react";
import { useNewsCache, statsKey } from "../../app/stores/newsCache";

type EmotionStats = {
  source: string;
  total_articles: number;
  emotion_counts: {
    Pozytywne: number;
    Neutralne: number;
    Negatywne: number;
  };
  emotion_percentages: {
    Pozytywne: number;
    Neutralne: number;
    Negatywne: number;
  };
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export function useCachedEmotionStats(source: string, model: string = "roberta") {
  const cache = useNewsCache();
  const [data, setData] = useState<EmotionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!source) return;

    const key = `${statsKey(source)}:${model}`;
    const cached = cache.get<EmotionStats>(key);

    // Jeśli dane są w cache, pomijamy request do API
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `${API_URL}/emotion-stats/${encodeURIComponent(source)}?model=${model}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as EmotionStats;
        setData(json);
        cache.set(key, json);
      } catch (e: any) {
        setError(e?.message ?? "fetch error");
      } finally {
        setLoading(false);
      }
    })();
  }, [source, model]);

  return { data, loading, error };
}
