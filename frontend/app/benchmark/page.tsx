"use client";

import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import type { Lang } from "../../lib/types";

// ── Types ────────────────────────────────────────────────────────────────────

interface BenchmarkResult {
  adapter_name: string;
  language?: string;
  sample_size?: number;
  successful_runs?: number;
  avg_inference_time_ms?: number | null;
  min_inference_time_ms?: number | null;
  max_inference_time_ms?: number | null;
  avg_fake_probability?: number | null;
  sentiments_distribution?: Record<string, number>;
  error?: string;
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

const LANG_COLORS: Record<string, string> = {
  en: "#3b82f6",
  pl: "#8b5cf6",
  no: "#10b981",
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#10b981",
  neutral:  "#6b7280",
  negative: "#ef4444",
};

const ADAPTER_ORDER = ["roberta", "xlm-roberta", "herbert", "norbert"];

function sortedAdapters(names: string[]) {
  return [...names].sort(
    (a, b) =>
      (ADAPTER_ORDER.indexOf(a) === -1 ? 99 : ADAPTER_ORDER.indexOf(a)) -
      (ADAPTER_ORDER.indexOf(b) === -1 ? 99 : ADAPTER_ORDER.indexOf(b))
  );
}

// Normalize sentiment keys to canonical form
function normalizeSentKey(k: string): "positive" | "neutral" | "negative" {
  const u = k.toLowerCase();
  if (u.includes("pos") || u === "pozytywne") return "positive";
  if (u.includes("neg") || u === "negatywne") return "negative";
  return "neutral";
}

// ── i18n ─────────────────────────────────────────────────────────────────────

const i18n = {
  pl: {
    title:       "Benchmark modeli NLP",
    subtitle:    "Porównanie czasu inferencji, rozkładu sentymentów i prawdopodobieństwa fake newsów",
    intro:       "Benchmark porównuje cztery modele NLP (RoBERTa, XLM-RoBERTa, NorBERT 3, HerBERT) na artykułach w trzech językach: polskim, norweskim i angielskim. Każdy model analizuje 8 artykułów per język — łącznie 96 analiz NLP. Wyniki pokazują czas inferencji, rozkład sentymentu oraz prawdopodobieństwo dezinformacji.",
    runBtn:      "Uruchom benchmark",
    running:     "Trwa benchmark… (może potrwać 2–3 minuty)",
    chart1:      "Czasy inferencji (ms)",
    chart1Desc:  "Niższy wynik oznacza szybszy model. Pierwsze uruchomienie modelu może być wolniejsze ze względu na ładowanie do pamięci.",
    chart2:      "Rozkład sentymentów",
    chart2Desc:  "Rozkład klasyfikacji sentymentu dla wszystkich artykułów testowych. Model dominujący w jednej kategorii może wskazywać na ograniczenia zero-shot.",
    chart3:      "Prawdopodobieństwo Fake News (%)",
    chart3Desc:  "Prawdopodobieństwo dezinformacji obliczane przez model BART jako wspólny baseline dla wszystkich modeli i języków.",
    tableTitle:  "Szczegółowe wyniki",
    tableDesc:   "Kliknij nazwę modelu, aby dowiedzieć się więcej",
    colModel:    "Model",
    colLang:     "Język",
    colSamples:  "Próbki",
    colAvg:      "Śr. czas (ms)",
    colMin:      "Min (ms)",
    colMax:      "Max (ms)",
    colFake:     "Fake prob%",
    colSent:     "Sentyment",
    noData:      "Brak danych — uruchom benchmark",
    errPrefix:   "Błąd:",
    langs:       { en: "Angielski", pl: "Polski", no: "Norweski" },
    sentLabels:  { positive: "Pozytywny", neutral: "Neutralny", negative: "Negatywny" },
  },
  en: {
    title:       "NLP Model Benchmark",
    subtitle:    "Comparison of inference time, sentiment distribution and fake news probability",
    intro:       "The benchmark compares four NLP models (RoBERTa, XLM-RoBERTa, NorBERT 3, HerBERT) on articles in three languages: Polish, Norwegian and English. Each model analyses 8 articles per language — 96 NLP inferences in total. Results show inference time, sentiment distribution and misinformation probability.",
    runBtn:      "Run benchmark",
    running:     "Running benchmark… (may take 2–3 minutes)",
    chart1:      "Inference time (ms)",
    chart1Desc:  "Lower score means a faster model. The first model run may be slower due to loading into memory.",
    chart2:      "Sentiment distribution",
    chart2Desc:  "Sentiment classification distribution for all test articles. A model dominating one category may indicate zero-shot limitations.",
    chart3:      "Fake News probability (%)",
    chart3Desc:  "Misinformation probability computed by the BART model as a shared baseline across all models and languages.",
    tableTitle:  "Detailed results",
    tableDesc:   "Click a model name to learn more",
    colModel:    "Model",
    colLang:     "Language",
    colSamples:  "Samples",
    colAvg:      "Avg time (ms)",
    colMin:      "Min (ms)",
    colMax:      "Max (ms)",
    colFake:     "Fake prob%",
    colSent:     "Sentiment",
    noData:      "No data — run the benchmark",
    errPrefix:   "Error:",
    langs:       { en: "English", pl: "Polish", no: "Norwegian" },
    sentLabels:  { positive: "Positive", neutral: "Neutral", negative: "Negative" },
  },
  no: {
    title:       "NLP-modell benchmark",
    subtitle:    "Sammenligning av inferenstid, sentimentfordeling og sannsynlighet for falske nyheter",
    intro:       "Benchmarken sammenligner fire NLP-modeller (RoBERTa, XLM-RoBERTa, NorBERT 3, HerBERT) på artikler på tre språk: polsk, norsk og engelsk. Hver modell analyserer 8 artikler per språk — totalt 96 NLP-analyser. Resultatene viser inferenstid, sentimentfordeling og sannsynlighet for desinformasjon.",
    runBtn:      "Kjør benchmark",
    running:     "Kjører benchmark… (kan ta 2–3 minutter)",
    chart1:      "Inferenstid (ms)",
    chart1Desc:  "Lavere score betyr en raskere modell. Første kjøring av modellen kan være tregere på grunn av innlasting i minnet.",
    chart2:      "Sentimentfordeling",
    chart2Desc:  "Sentimentklassifiseringsfordeling for alle testartikler. En modell som dominerer én kategori kan indikere zero-shot-begrensninger.",
    chart3:      "Sannsynlighet for falske nyheter (%)",
    chart3Desc:  "Desinformasjonssannsynlighet beregnet av BART-modellen som felles baseline for alle modeller og språk.",
    tableTitle:  "Detaljerte resultater",
    tableDesc:   "Klikk et modellnavn for å lære mer",
    colModel:    "Modell",
    colLang:     "Språk",
    colSamples:  "Prøver",
    colAvg:      "Gj.sn. tid (ms)",
    colMin:      "Min (ms)",
    colMax:      "Maks (ms)",
    colFake:     "Fake prob%",
    colSent:     "Sentiment",
    noData:      "Ingen data — kjør benchmark",
    errPrefix:   "Feil:",
    langs:       { en: "Engelsk", pl: "Polsk", no: "Norsk" },
    sentLabels:  { positive: "Positivt", neutral: "Nøytralt", negative: "Negativt" },
  },
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function BenchmarkPage() {
  const [language, setLanguage] = useState<Lang>("pl");
  const [results, setResults]   = useState<BenchmarkResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("lang");
    if (stored === "pl" || stored === "en" || stored === "no") setLanguage(stored as Lang);
    const onLang = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d === "pl" || d === "en" || d === "no") setLanguage(d as Lang);
    };
    window.addEventListener("app:langchange", onLang as EventListener);
    return () => window.removeEventListener("app:langchange", onLang as EventListener);
  }, []);

  const t = i18n[language];

  const runBenchmark = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 300_000); // 5 min timeout
      const res = await fetch(`${apiBase}/benchmark?full=false`, { signal: controller.signal });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResults(data.results ?? data);
    } catch (err: any) {
      setError(err?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // ── Derived chart data ──────────────────────────────────────────────────────

  const validResults = results.filter((r) => !r.error && r.language);

  // Chart 1: inference time — rows keyed by adapter, columns per lang
  const adapters = sortedAdapters([...new Set(validResults.map((r) => r.adapter_name))]);
  const langs    = [...new Set(validResults.map((r) => r.language!))].sort();

  const inferenceData = adapters.map((adapter) => {
    const row: Record<string, any> = { adapter };
    for (const lang of langs) {
      const r = validResults.find((x) => x.adapter_name === adapter && x.language === lang);
      row[lang] = r?.avg_inference_time_ms ?? null;
    }
    return row;
  });

  // Chart 2: sentiment distribution — rows keyed by adapter, columns per sentiment
  const sentimentData = adapters.map((adapter) => {
    const counts: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
    for (const r of validResults.filter((x) => x.adapter_name === adapter)) {
      for (const [k, v] of Object.entries(r.sentiments_distribution ?? {})) {
        counts[normalizeSentKey(k)] = (counts[normalizeSentKey(k)] ?? 0) + v;
      }
    }
    return { adapter, ...counts };
  });

  // Chart 3: fake probability — one bar per adapter×lang
  const fakeData = validResults
    .filter((r) => r.avg_fake_probability != null)
    .sort((a, b) => {
      const ai = ADAPTER_ORDER.indexOf(a.adapter_name);
      const bi = ADAPTER_ORDER.indexOf(b.adapter_name);
      return ai !== bi ? ai - bi : (a.language ?? "").localeCompare(b.language ?? "");
    })
    .map((r) => ({
      label: `${r.adapter_name} / ${r.language}`,
      value: r.avg_fake_probability,
    }));

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 text-gray-900 dark:text-gray-100 px-4 md:px-8 py-10">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <FlaskConical className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl font-bold">{t.title}</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto text-sm">{t.subtitle}</p>
        </div>

        {/* Intro */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-6 py-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed max-w-3xl mx-auto">
          {t.intro}
        </div>

        {/* Run button */}
        <div className="flex justify-center">
          <button
            onClick={runBenchmark}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg shadow transition-colors"
          >
            <FlaskConical className="w-5 h-5" />
            {loading ? t.running : t.runBtn}
          </button>
        </div>

        {/* Spinner */}
        {loading && (
          <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">{t.running}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-4 py-3 text-red-700 dark:text-red-300 text-sm">
            {t.errPrefix} {error}
          </div>
        )}

        {/* Charts */}
        {validResults.length > 0 && (
          <div className="space-y-10">

            {/* Chart 1 — inference time */}
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold mb-4">{t.chart1}</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={inferenceData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="adapter" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} unit=" ms" />
                  <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)} ms`]} />
                  <Legend formatter={(val) => (t.langs as any)[val] ?? val} />
                  {langs.map((lang) => (
                    <Bar key={lang} dataKey={lang} fill={LANG_COLORS[lang] ?? "#94a3b8"} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-3 text-sm text-gray-400 dark:text-gray-500 italic">{t.chart1Desc}</p>
            </section>

            {/* Chart 2 — sentiment distribution */}
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold mb-4">{t.chart2}</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sentimentData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="adapter" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend formatter={(val) => (t.sentLabels as any)[val] ?? val} />
                  <Bar dataKey="positive" fill={SENTIMENT_COLORS.positive} radius={[4, 4, 0, 0]}
                       name={(t.sentLabels as any).positive} />
                  <Bar dataKey="neutral"  fill={SENTIMENT_COLORS.neutral}  radius={[4, 4, 0, 0]}
                       name={(t.sentLabels as any).neutral} />
                  <Bar dataKey="negative" fill={SENTIMENT_COLORS.negative} radius={[4, 4, 0, 0]}
                       name={(t.sentLabels as any).negative} />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-3 text-sm text-gray-400 dark:text-gray-500 italic">{t.chart2Desc}</p>
            </section>

            {/* Chart 3 — fake probability */}
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold mb-4">{t.chart3}</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={fakeData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 12 }} unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(v: any) => [`${Number(v).toFixed(2)}%`]} />
                  <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} name={t.chart3} />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-3 text-sm text-gray-400 dark:text-gray-500 italic">{t.chart3Desc}</p>
            </section>

            {/* Table */}
            <section className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 space-y-1">
                <h2 className="text-lg font-semibold">{t.tableTitle}</h2>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {t.tableDesc} —{" "}
                  {["roberta", "xlm-roberta", "herbert", "norbert"].map((m, i, arr) => (
                    <span key={m}>
                      <a href="/dashboard#modele" className="text-blue-500 hover:underline">{m}</a>
                      {i < arr.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase text-xs">
                    <tr>
                      {[t.colModel, t.colLang, t.colSamples, t.colAvg, t.colMin, t.colMax, t.colFake, t.colSent].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {validResults.map((r, i) => {
                      const sentStr = Object.entries(r.sentiments_distribution ?? {})
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ");
                      return (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">{r.adapter_name}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-xs font-semibold"
                              style={{ background: LANG_COLORS[r.language!] + "33", color: LANG_COLORS[r.language!] }}>
                              {r.language?.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.successful_runs ?? "—"} / {r.sample_size ?? "—"}</td>
                          <td className="px-4 py-3 font-mono">{r.avg_inference_time_ms?.toFixed(1) ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-green-600 dark:text-green-400">{r.min_inference_time_ms?.toFixed(1) ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-red-500 dark:text-red-400">{r.max_inference_time_ms?.toFixed(1) ?? "—"}</td>
                          <td className="px-4 py-3 font-mono">
                            {r.avg_fake_probability != null ? `${r.avg_fake_probability.toFixed(2)}%` : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate" title={sentStr}>
                            {sentStr || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

          </div>
        )}

        {/* Empty state */}
        {!loading && validResults.length === 0 && !error && (
          <div className="text-center text-gray-400 dark:text-gray-500 py-16 text-sm">
            {t.noData}
          </div>
        )}

      </div>
    </div>
  );
}
