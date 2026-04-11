/**
 * Warstwa komunikacji z backendem odpowiedzialna za pobieranie
 * i normalizację danych newsowych.
 *
 * Odpowiada za:
 * - pobieranie danych z API dla pojedynczych i wielu źródeł,
 * - normalizację struktury artykułów niezależnie od backendu,
 * - agregację statystyk (fake news, sentyment),
 * - obsługę pobierania progresywnego i współbieżności.
 */

export interface Article {
  title: string;
  description?: string;
  content?: string;
  sentiment?: (
    | "Pozytywne" | "Negatywne" | "Neutralne"
    | "Positive"  | "Negative"  | "Neutral"
    | "Positivt"  | "Negativt"  | "Nøytralt"
  );
  fake_probability?: number;
  publishedAt?: string;
  source: string;
  url?: string;
  model?: string;
  [key: string]: any;
}

export interface NewsData {
  source: string;    
  fake_news: string; 
}

export interface Emotions {
  [sentiment: string]: number;
}

export interface FetchResult {
  newsData: NewsData[];
  allArticles: Article[];
  emotions: Emotions;
}


export interface PartialUpdate {
  source: string;
  newsDatum: NewsData;        
  articles: Article[];        
  emotionsDelta: Emotions;    
}

export interface FetchAllNewsOptions {
  onPartial?: (u: PartialUpdate) => void;
  onProgress?: (processed: number, total: number) => void;
  concurrency?: number; // domyślnie 3
}

// ------------------------------------------------------------
// Mapowanie / normalizacja
// ------------------------------------------------------------
const SOURCE_MAP: Record<string, string> = {
  bbc: "BBC",
  cnn: "CNN",
  nytimes: "NYTimes",
  guardian: "Guardian",
  aljazeera: "AlJazeera",
  money: "Money",
  polsatnews: "PolsatNews",
  tvn24: "TVN24",
  spidersweb: "SpidersWeb",
  bankier: "Bankier",
  nrk: "NRK",
  vg: "VG",
  e24: "E24",
  aftenposten: "Aftenposten",
};

function normalizeSource(s: string) {
  return SOURCE_MAP[s.toLowerCase()] ?? s;
}

function normalizeArticle(raw: any, sourceLabel: string): Article {
  return {
    title: raw?.title ?? "",
    description: raw?.summary ?? raw?.description ?? raw?.content ?? "",
    content: raw?.content ?? raw?.summary ?? "",
    url: raw?.link ?? raw?.url,
    sentiment: raw?.sentiment,
    fake_probability: raw?.fake_probability,
    publishedAt: raw?.published ?? raw?.publishedAt,
    source: sourceLabel,
    ...raw,
  };
}

// -------------------- NOWE: pojedyncze źródło (do ładowania progresywnego) --------------------
export async function fetchOneSource(
  source: string,
  language: "pl" | "en" | "no" = "pl"
): Promise<{ news?: NewsData; emotions: Emotions; articles: Article[] }> {
  const src = normalizeSource(source);
  const emotions: Emotions = {};
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45_000);
    const res = await fetch(
      `${apiBase}/news/${src}?lang=${language}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const rawArticles = Array.isArray(data?.articles) ? (data.articles as any[]) : [];
    const articles = rawArticles.map((a) => normalizeArticle(a, src));

    if (!articles.length) {
      return { news: { source: src, fake_news: "0" }, emotions, articles: [] };
    }

    const avgFake =
      articles.reduce((sum: number, a: any) => sum + (Number(a.fake_probability) || 0), 0) /
      articles.length;

    for (const art of articles) {
      if (art.sentiment) emotions[art.sentiment] = (emotions[art.sentiment] ?? 0) + 1;
    }

    return { news: { source: src, fake_news: avgFake.toFixed(2) }, emotions, articles };
  } catch (err) {
    console.warn(`❌ Błąd źródła: ${src}`, err);
    return { news: { source: src, fake_news: "0" }, emotions, articles: [] };
  }
}

// ------------------------------------------------------------
// Mały helper — kontrola współbieżności
// ------------------------------------------------------------
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
) {
  let index = 0;
  const workers: Promise<void>[] = [];

  async function next() {
    if (index >= items.length) return;
    const i = index++;
    await worker(items[i]);
    return next();
  }

  const n = Math.min(limit, items.length);
  for (let i = 0; i < n; i++) workers.push(next()!);
  await Promise.all(workers);
}

// ------------------------------------------------------------
// Główna funkcja — progresywne pobieranie
// ------------------------------------------------------------
export async function fetchAllNews(
  sources: string[],
  language: "pl" | "en" | "no" = "pl",
  opts: FetchAllNewsOptions = {}
): Promise<FetchResult> {
  const { onPartial, onProgress, concurrency = 3 } = opts;

  const allArticles: Article[] = [];
  const emotions: Emotions = {
    Pozytywne: 0, Negatywne: 0, Neutralne: 0,
    Positive: 0,  Negative: 0,  Neutral: 0,
  };
  const newsData: NewsData[] = [];

  const normalized = sources.map(normalizeSource);
  const total = normalized.length;
  let processed = 0;

  await runWithConcurrency(normalized, concurrency, async (source) => {
    const url = `http://127.0.0.1:8000/news/${encodeURIComponent(source)}?lang=${language}`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const rawArticles: any[] = Array.isArray(data?.articles) ? data.articles : [];
      const articles = rawArticles.map((a) => normalizeArticle(a, source));

      let avg = 0;
      if (articles.length > 0) {
        avg =
          articles.reduce(
            (sum, a) => sum + (Number(a.fake_probability) || 0),
            0
          ) / articles.length;
      }

      const datum: NewsData = { source, fake_news: avg.toFixed(2) };
      newsData.push(datum);

      const delta: Emotions = {};
      for (const art of articles) {
        const s = art.sentiment;
        if (s) delta[s] = (delta[s] ?? 0) + 1;
      }

      onPartial?.({
        source,
        newsDatum: datum,
        articles,
        emotionsDelta: delta,
      });

      allArticles.push(...articles);
      for (const [k, v] of Object.entries(delta)) {
        emotions[k] = (emotions[k] ?? 0) + (v as number);
      }
    } catch (err) {
      console.warn(`❌ Błąd źródła: ${source}`, err);
      const datum: NewsData = { source, fake_news: "0" };
      newsData.push(datum);

      onPartial?.({
        source,
        newsDatum: datum,
        articles: [],
        emotionsDelta: {},
      });
    } finally {
      processed += 1;
      onProgress?.(processed, total);
    }
  });

  return { newsData, allArticles, emotions };
}
