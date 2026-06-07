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
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .nlp_service import get_adapter, ModelAdapter, analyze_news
from .rss_utils import fetch_feed, clean_html, FeedFetchError, is_recent_entry
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

def _texts_from_feed(feed, limit: int) -> List[str]:
    """Wyciąga do limit czystych tekstów z feedu (kolejność zgodna z feedem).
    Pomija artykuły starsze niż 30 dni."""
    out: List[str] = []
    for entry in feed.entries or []:
        if len(out) >= limit:
            break
        if not is_recent_entry(entry):
            continue
        text = clean_html(entry.get("summary", "")).strip()
        if not text:
            text = entry.get("title", "").strip()
        if len(text) >= 20:
            out.append(text)
    return out


def _fetch_source(source_name: str, quota: int) -> Tuple[object, List[str]]:
    """Pobiera feed jednego źródła; zwraca (feed, texts) lub (None, []) przy błędzie."""
    url = NEWS_FEEDS.get(source_name)
    if not url:
        return None, []
    try:
        feed = fetch_feed(url)
        return feed, _texts_from_feed(feed, quota)
    except Exception:
        return None, []


def fetch_rss_texts(langs: List[str], articles_per_lang: int = 8) -> Dict[str, List[str]]:
    """
    Pobiera artykuły RSS z równym podziałem na źródła.

    Algorytm (dla 2 źródeł i articles_per_lang=8):
      1. Pierwsza faza — każde źródło dostaje kwotę articles_per_lang // n_sources = 4.
         Wszystkie źródła dla danego języka są odpytywane równolegle (ThreadPoolExecutor),
         więc czas fazy 1 = max(czas_źródła) zamiast sum(czas_źródła).
      2. Druga faza — jeśli któreś źródło dostarczyło mniej niż kwota (np. ma tylko 2
         artykuły albo nie odpowiada), brakujące artykuły są dobierane z pozostałych
         źródeł (artykuły już wzięte są pomijane po stronie set używanych tekstów).

    Przykłady:
      BBC=4, NYTimes=4             → [b1..b4, n1..n4]           (równy podział)
      BBC=2, NYTimes=4             → [b1, b2, n1..n4, n5, n6]   (NYTimes uzupełnia)
      BBC=błąd, NYTimes=8          → [n1..n8]                    (cały limit z NYTimes)
      BBC=3, NYTimes=3             → [b1..b3, n1..n3]            (łącznie 6, brak rezerwy)
    """
    result: Dict[str, List[str]] = {}
    for lang in langs:
        sources = RSS_SOURCES.get(lang, [])
        n = len(sources)
        quota = articles_per_lang // n if n else articles_per_lang

        # Faza 1: pobierz quota artykułów z każdego źródła — równolegle
        with ThreadPoolExecutor(max_workers=max(n, 1)) as ex:
            futures = [ex.submit(_fetch_source, src, quota) for src in sources]
            pairs = [f.result() for f in futures]

        feeds_cache = [feed for feed, _ in pairs]
        buckets = [texts for _, texts in pairs]

        collected = [t for bucket in buckets for t in bucket]

        # Faza 2: uzupełnij niedobór z dowolnego źródła mającego więcej artykułów
        shortfall = articles_per_lang - len(collected)
        if shortfall > 0:
            used = set(collected)
            for feed in feeds_cache:
                if shortfall <= 0 or feed is None:
                    continue
                for text in _texts_from_feed(feed, articles_per_lang):
                    if shortfall <= 0:
                        break
                    if text not in used:
                        collected.append(text)
                        used.add(text)
                        shortfall -= 1

        result[lang] = collected[:articles_per_lang]
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

    sys.stderr.write(f"[BENCH] adapter_names={adapter_names}\n")
    sys.stderr.flush()

    for adapter_name in adapter_names:
        try:
            adapter = get_adapter(adapter_name)
            sys.stderr.write(f"[BENCH] adapter={adapter_name}, instance={type(adapter).__name__}\n")
            sys.stderr.flush()
        except ValueError as exc:
            sys.stderr.write(f"[BENCH] adapter={adapter_name}, ERROR={exc}\n")
            sys.stderr.flush()
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
