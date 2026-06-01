"""
Endpointy związane z obsługą dostępnych źródeł wiadomości oraz narzędziami deweloperskimi.
"""

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query

from ..config import NEWS_FEEDS
from ..benchmark import run_benchmark, export_json, export_csv, _summary_only

router = APIRouter()

# Katalog, do którego endpoint zapisuje artefakty benchmarku
_BENCHMARK_OUT = Path("benchmark_results")


@router.get("/sources")
def get_sources():
    return list(NEWS_FEEDS.keys())


@router.get("/benchmark")
def benchmark(
    adapters: Optional[str] = Query(
        default=None,
        description="Przecinkowa lista adapterów: roberta,xlm-roberta,norbert,herbert",
    ),
    langs: Optional[str] = Query(
        default=None,
        description="Przecinkowa lista języków: en,pl,no",
    ),
    save: bool = Query(
        default=True,
        description="Czy zapisać wyniki do JSON i CSV w katalogu benchmark_results/",
    ),
    full: bool = Query(
        default=False,
        description="Czy zwrócić szczegółowe wyniki per_text (domyślnie tylko podsumowanie)",
    ),
    mode: str = Query(
        default="static",
        description=(
            "Tryb danych: 'static' = hardkodowane SAMPLE_TEXTS (powtarzalne, default), "
            "'rss' = aktualne artykuły pobrane z RSS (BBC/NYTimes, PolsatNews/TVN24, NRK/VG)"
        ),
    ),
):
    """
    Uruchamia benchmark NLP i zwraca wyniki.

    Czas odpowiedzi zależy od liczby adapterów i języków — może wynosić kilkadziesiąt sekund
    przy pierwszym uruchomieniu (lazy-loading modeli HuggingFace).

    Przykłady:
    - GET /benchmark
    - GET /benchmark?mode=rss
    - GET /benchmark?adapters=roberta,xlm-roberta&langs=en,pl&mode=rss
    - GET /benchmark?full=true&save=false
    """
    adapter_names = [a.strip() for a in adapters.split(",")] if adapters else None
    lang_list = [l.strip() for l in langs.split(",")] if langs else None

    results = run_benchmark(adapter_names=adapter_names, langs=lang_list, mode=mode)

    if save:
        export_json(results, _BENCHMARK_OUT / "benchmark.json")
        export_csv(results, _BENCHMARK_OUT / "benchmark.csv")

    return {
        "results": results if full else _summary_only(results),
        "saved": save,
        "output_dir": str(_BENCHMARK_OUT) if save else None,
        "mode": mode,
    }

