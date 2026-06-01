"""
Moduł benchmarkowania modeli NLP.

Mierzy czas inferencji, rozkład sentymentów i prawdopodobieństwo fake news
dla każdego adaptera (roberta, xlm-roberta, norbert, herbert) na próbce tekstów
z trzech grup językowych (en, pl, no).

Użycie standalone:
    python -m app.benchmark

Użycie z API:
    GET /benchmark
    GET /benchmark?adapters=roberta,xlm-roberta&langs=en,pl
"""

import csv
import json
import time
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional

from .nlp_service import get_adapter, ModelAdapter, analyze_news
from .rss_utils import fetch_feed, clean_html, FeedFetchError
from .config import NEWS_FEEDS

# ---------------------------------------------------------------------------
# Próbka tekstów testowych
# ---------------------------------------------------------------------------

# Źródła RSS używane w trybie mode="rss" — po 2 na język
RSS_SOURCES: Dict[str, List[str]] = {
    "en": ["BBC", "NYTimes"],
    "pl": ["PolsatNews", "TVN24"],
    "no": ["NRK", "VG"],
}

SAMPLE_TEXTS: Dict[str, List[str]] = {
    "en": [
        "The government announced new economic reforms to boost growth and reduce unemployment.",
        "Flooding devastated coastal towns overnight, leaving thousands homeless.",
        "Scientists discover a new vaccine that shows 95% efficacy against the virus.",
        "Stock markets surged to record highs after positive inflation data.",
        "A major scandal erupted as leaked documents exposed corporate corruption.",
        "The peace talks collapsed after both sides failed to reach an agreement.",
        "Renewable energy investments hit an all-time high this quarter.",
        "Crime rates in the capital have dropped significantly over the past year.",
    ],
    "pl": [
        "Rząd ogłosił nowe reformy gospodarcze mające na celu pobudzenie wzrostu.",
        "Powódź zniszczyła nadmorskie miejscowości, tysiące osób zostało bez dachu.",
        "Naukowcy odkryli szczepionkę o 95-procentowej skuteczności przeciw wirusowi.",
        "Giełda osiągnęła rekordowe poziomy po pozytywnych danych o inflacji.",
        "Wybuchł wielki skandal po ujawnieniu dokumentów o korupcji korporacyjnej.",
        "Rozmowy pokojowe załamały się po niepowodzeniu negocjacji.",
        "Inwestycje w energię odnawialną osiągnęły historyczny rekord w tym kwartale.",
        "Wskaźniki przestępczości w stolicy znacząco spadły w ciągu ostatniego roku.",
    ],
    "no": [
        "Regjeringen kunngjorde nye økonomiske reformer for å øke veksten.",
        "Flom ødela kystbyer over natten og etterlot tusenvis uten hjem.",
        "Forskere oppdaget en vaksine med 95 prosent effektivitet mot viruset.",
        "Aksjemarkedene steg til rekordhøyder etter positive inflasjonsdata.",
        "En stor skandale brøt ut da lekkede dokumenter avslørte korrupsjon.",
        "Fredssamtalene brøt sammen etter at begge sider ikke klarte å bli enige.",
        "Investeringer i fornybar energi nådde en historisk topp dette kvartalet.",
        "Kriminalitetsratene i hovedstaden har falt betydelig det siste året.",
    ],
}

# ---------------------------------------------------------------------------
# Typy wyników
# ---------------------------------------------------------------------------

BenchmarkResult = Dict  # TypedDict zastąpiony zwykłym Dict dla czytelności

# ---------------------------------------------------------------------------
# Pobieranie tekstów z RSS (tryb mode="rss")
# ---------------------------------------------------------------------------

def fetch_rss_texts(langs: List[str], articles_per_lang: int = 8) -> Dict[str, List[str]]:
    """
    Pobiera do articles_per_lang tekstów na język z kanałów RSS.
    Dla każdego języka próbuje kolejnych źródeł z RSS_SOURCES aż do zapełnienia limitu.
    Błędy pobierania są ignorowane (dane ze sprawnych źródeł trafiają do wyniku).
    """
    result: Dict[str, List[str]] = {}
    for lang in langs:
        sources = RSS_SOURCES.get(lang, [])
        collected: List[str] = []
        for source_name in sources:
            if len(collected) >= articles_per_lang:
                break
            url = NEWS_FEEDS.get(source_name)
            if not url:
                continue
            try:
                feed = fetch_feed(url)
                remaining = articles_per_lang - len(collected)
                for entry in (feed.entries or [])[:remaining]:
                    text = clean_html(entry.get("summary", "")).strip()
                    if not text:
                        text = entry.get("title", "").strip()
                    if len(text) >= 20:
                        collected.append(text)
            except Exception:
                pass
        result[lang] = collected
    return result


# ---------------------------------------------------------------------------
# Funkcje benchmarkowania
# ---------------------------------------------------------------------------

def _run_single(
    adapter: ModelAdapter,
    text: str,
    lang: str,
) -> Dict:
    """Uruchamia analyze_news dla jednego tekstu i mierzy czas."""
    start = time.perf_counter()
    result = analyze_news(text, lang=lang, adapter=adapter)
    elapsed_ms = (time.perf_counter() - start) * 1000
    return {**result, "inference_time_ms": elapsed_ms}


def run_benchmark(
    adapter_names: Optional[List[str]] = None,
    langs: Optional[List[str]] = None,
    mode: str = "static",
) -> List[BenchmarkResult]:
    """
    Uruchamia benchmark dla wskazanych adapterów i języków.

    Args:
        adapter_names: Lista nazw adapterów; None = wszystkie cztery.
        langs:         Lista kodów języków; None = ['en', 'pl', 'no'].
        mode:          'static' = hardkodowane SAMPLE_TEXTS (powtarzalne),
                       'rss'    = aktualne artykuły z kanałów RSS.

    Returns:
        Lista słowników z wynikami — jeden wpis na kombinację adapter × język.
    """
    if adapter_names is None:
        adapter_names = ["roberta", "xlm-roberta", "norbert", "herbert"]
    if langs is None:
        langs = ["en", "pl", "no"]

    if mode == "rss":
        texts_by_lang = fetch_rss_texts(langs)
    else:
        texts_by_lang = {lang: SAMPLE_TEXTS.get(lang, []) for lang in langs}

    results: List[BenchmarkResult] = []

    for adapter_name in adapter_names:
        try:
            adapter = get_adapter(adapter_name)
        except ValueError as exc:
            results.append({
                "adapter_name": adapter_name,
                "error": str(exc),
            })
            continue

        for lang in langs:
            texts = texts_by_lang.get(lang, [])
            if not texts:
                if mode == "rss":
                    results.append({
                        "adapter_name": adapter_name,
                        "language": lang,
                        "mode": mode,
                        "error": (
                            f"Nie udało się pobrać artykułów RSS dla języka '{lang}' "
                            f"ze źródeł: {RSS_SOURCES.get(lang, [])}"
                        ),
                    })
                continue

            per_text: List[Dict] = []
            for text in texts:
                try:
                    per_text.append(_run_single(adapter, text, lang))
                except Exception as exc:
                    per_text.append({
                        "sentiment": None,
                        "fake_probability": None,
                        "sentiment_score": None,
                        "inference_time_ms": None,
                        "error": str(exc),
                    })

            # Agregacja
            valid = [r for r in per_text if r.get("inference_time_ms") is not None]
            times = [r["inference_time_ms"] for r in valid]
            fakes = [r["fake_probability"] for r in valid if r.get("fake_probability") is not None]
            sentiments = [r["sentiment"] for r in valid if r.get("sentiment")]

            results.append({
                "adapter_name": adapter_name,
                "language": lang,
                "mode": mode,
                "sample_size": len(texts),
                "successful_runs": len(valid),
                "avg_inference_time_ms": round(sum(times) / len(times), 2) if times else None,
                "min_inference_time_ms": round(min(times), 2) if times else None,
                "max_inference_time_ms": round(max(times), 2) if times else None,
                "avg_fake_probability": round(sum(fakes) / len(fakes), 2) if fakes else None,
                "sentiments_distribution": dict(Counter(sentiments)),
                "per_text": per_text,
            })

    return results


# ---------------------------------------------------------------------------
# Eksport wyników
# ---------------------------------------------------------------------------

def export_json(results: List[BenchmarkResult], path: Path) -> None:
    """Zapisuje pełne wyniki (z per_text) do pliku JSON."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(results, fh, ensure_ascii=False, indent=2)


def export_csv(results: List[BenchmarkResult], path: Path) -> None:
    """
    Zapisuje wyniki zbiorcze (bez per_text) do pliku CSV.
    Jeden wiersz = jedna kombinacja adapter × język.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    summary_fields = [
        "adapter_name", "language", "mode", "sample_size", "successful_runs",
        "avg_inference_time_ms", "min_inference_time_ms", "max_inference_time_ms",
        "avg_fake_probability", "sentiments_distribution",
    ]
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=summary_fields, extrasaction="ignore")
        writer.writeheader()
        for row in results:
            if "error" in row:
                continue
            flat = {k: row.get(k) for k in summary_fields}
            # Rozkład sentymentów jako string JSON w komórce CSV
            flat["sentiments_distribution"] = json.dumps(
                row.get("sentiments_distribution", {}), ensure_ascii=False
            )
            writer.writerow(flat)


def _summary_only(results: List[BenchmarkResult]) -> List[BenchmarkResult]:
    """Zwraca wyniki bez pola per_text (lżejsza odpowiedź HTTP)."""
    return [{k: v for k, v in r.items() if k != "per_text"} for r in results]


# ---------------------------------------------------------------------------
# Uruchomienie standalone
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="TruthScan NLP benchmark")
    parser.add_argument(
        "--adapters", default="roberta,xlm-roberta,norbert,herbert",
        help="Przecinkowa lista adapterów (domyślnie: wszystkie)",
    )
    parser.add_argument(
        "--langs", default="en,pl,no",
        help="Przecinkowa lista języków (domyślnie: en,pl,no)",
    )
    parser.add_argument(
        "--out-dir", default="benchmark_results",
        help="Katalog wyjściowy dla plików JSON i CSV",
    )
    parser.add_argument(
        "--mode", default="static", choices=["static", "rss"],
        help="Tryb danych: static = SAMPLE_TEXTS (domyślnie), rss = aktualne artykuły RSS",
    )
    args = parser.parse_args()

    adapter_names = [a.strip() for a in args.adapters.split(",")]
    langs = [l.strip() for l in args.langs.split(",")]
    out_dir = Path(args.out_dir)

    print(f"Uruchamiam benchmark: adaptery={adapter_names}, języki={langs}, mode={args.mode}")
    results = run_benchmark(adapter_names=adapter_names, langs=langs, mode=args.mode)

    json_path = out_dir / "benchmark.json"
    csv_path = out_dir / "benchmark.csv"
    export_json(results, json_path)
    export_csv(results, csv_path)

    print(f"Wyniki zapisane: {json_path}, {csv_path}")
    for r in _summary_only(results):
        if "error" in r:
            print(f"  [{r['adapter_name']}] BŁĄD: {r['error']}")
        else:
            print(
                f"  [{r['adapter_name']:12s} / {r['language']}] "
                f"avg={r['avg_inference_time_ms']} ms  "
                f"fake={r['avg_fake_probability']}%  "
                f"sentiments={r['sentiments_distribution']}"
            )
