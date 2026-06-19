"""
Endpointy związane z pobieraniem, analizą i strumieniowaniem wiadomości.
"""

import asyncio
import json
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from fastapi_cache.decorator import cache

from ..config import CACHE_TTL, NEWS_FEEDS
from ..rss_utils import fetch_feed, clean_html, get_from_cache, set_to_cache, FeedFetchError, is_recent_entry
from ..nlp_service import analyze_news, set_active_adapter, get_adapter

router = APIRouter()

_PL_SOURCES = {"PolsatNews", "TVN24", "Bankier", "Money", "SpidersWeb"}
_NO_SOURCES = {"NRK", "VG", "E24", "Aftenposten"}
_EN_SOURCES = {"BBC", "CNN", "NYTimes", "Guardian", "AlJazeera"}


def _resolve_model(source: str, lang: str, model: Optional[str]) -> str:
    """Zwraca nazwę adaptera: respektuje ręczny wybór ?model=,
    następnie dopasowuje po źródle (pewne), a lang używa tylko jako fallback
    dla nieznanych źródeł (lang to język UI, nie artykułu)."""
    if model:
        return model
    if source in _PL_SOURCES:
        return "herbert"
    if source in _NO_SOURCES:
        return "norbert"
    if source in _EN_SOURCES:
        return "roberta"
    # Nieznane źródło — fallback na język UI
    if lang == "pl":
        return "herbert"
    if lang == "no":
        return "norbert"
    return "roberta"


@router.get("/news/{source}")
def get_news(source: str, lang: str = "pl", model: Optional[str] = None):
    # Walidacja źródła
    if source not in NEWS_FEEDS:
        raise HTTPException(status_code=404, detail="Źródło nieobsługiwane")

    resolved = _resolve_model(source, lang, model)

    # Ustawienie aktywnego adaptera NLP
    try:
        set_active_adapter(resolved)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Nieznany model: {resolved}")

    url = NEWS_FEEDS[source]

    # Pobranie RSS — FeedFetchError (404/timeout) zwraca pustą listę zamiast HTTP 500
    try:
        feed = fetch_feed(url)
    except FeedFetchError as e:
        print(f"⚠️  Feed niedostępny [{source}]: {e}")
        return {"source": source, "articles": [], "error": str(e)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd pobierania newsów: {str(e)}")

    if not feed.entries:
        return {"source": source, "articles": []}

    MAX_ARTICLES = 3
    articles: List[dict] = []

    # Przetwarzanie i analiza artykułów — tylko artykuły z ostatnich 30 dni
    for entry in [e for e in feed.entries if is_recent_entry(e)][:MAX_ARTICLES]:
        summary = clean_html(entry.get("summary", "Brak opisu"))
        text_to_analyze = (summary or "").strip() or entry.get("title", "")
        analysis = analyze_news(text_to_analyze, lang)

        articles.append({
            "title": entry.get("title", "Bez tytułu"),
            "link": entry.get("link", ""),
            "summary": summary,
            "published": entry.get("published", "Brak daty"),
            "source": source,
            "model": resolved,
            **analysis
        })

    return {"source": source, "articles": articles}


# Strumieniowanie newsów przez SSE
@router.get("/stream-news/{source}")
async def stream_news(source: str, lang: str = "pl", model: Optional[str] = None):
    if source not in NEWS_FEEDS:
        raise HTTPException(status_code=404, detail="Źródło nieobsługiwane")

    resolved = _resolve_model(source, lang, model)

    # Pobierz adapter przez get_adapter() — nie mutuje globalnego _active_adapter,
    # więc współbieżne żądania do innych źródeł nie nadpiszą modelu tego strumienia
    try:
        adapter = get_adapter(resolved)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Nieznany model: {resolved}")

    async def event_generator():
        # Próba pobrania RSS z cache
        try:
            cached = get_from_cache(source)
            if cached:
                feed = cached
            else:
                feed = fetch_feed(NEWS_FEEDS[source])
                set_to_cache(source, feed)
        except FeedFetchError as e:
            print(f"⚠️  Feed niedostępny [{source}]: {e}")
            yield f"event: backend_error\ndata: {json.dumps({'message': str(e), 'status': e.status_code})}\n\n"
            yield f"event: done\ndata: {json.dumps({'count': 0})}\n\n"
            return
        except Exception as e:
            yield f"event: backend_error\ndata: {json.dumps({'message': str(e)})}\n\n"
            yield f"event: done\ndata: {json.dumps({'count': 0})}\n\n"
            return

        entries = feed.entries or []
        MAX_ARTICLES = 3
        to_send = [e for e in entries if is_recent_entry(e)][:MAX_ARTICLES]

        # Metadane dla klienta
        yield f"event: meta\ndata: {json.dumps({'total': len(to_send)})}\n\n"

        sent = 0
        for entry in to_send:
            summary = clean_html(entry.get("summary", "Brak opisu"))
            text_to_analyze = (summary or "").strip() or entry.get("title", "")

            # Analiza NLP uruchamiana w executorze (CPU-bound).
            # Adapter i tekst przechwycone przez domyślne argumenty lambdy —
            # izoluje od globalnego _active_adapter który może być zmieniony
            # przez współbieżne żądanie w trakcie await.
            loop = asyncio.get_event_loop()
            analysis = await loop.run_in_executor(
                None, lambda t=text_to_analyze, a=adapter: analyze_news(t, lang, a)
            )

            article = {
                "title": entry.get("title", "Bez tytułu"),
                "link": entry.get("link", ""),
                "summary": summary,
                "published": entry.get("published", "Brak daty"),
                "source": source,
                "model": resolved,
                **analysis,
            }

            yield f"data: {json.dumps(article, ensure_ascii=False)}\n\n"
            sent += 1
            await asyncio.sleep(0.3)

        yield f"event: done\ndata: {json.dumps({'count': sent})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Content-Type": "text/event-stream",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/api/charts/summary")
@cache(expire=CACHE_TTL)
async def get_charts_summary(lang: str = "pl"):
    """
    Szybkie statystyki zbiorcze dla wszystkich źródeł
    (uproszczona analiza oparta na tytułach).
    """
    sources = [
        "BBC", "CNN", "NYTimes", "Guardian", "AlJazeera",
        "PolsatNews", "Money", "Bankier", "SpidersWeb", "GazetaPrawna"
    ]

    summary_data = {}

    for source in sources:
        if source not in NEWS_FEEDS:
            continue

        try:
            feed = fetch_feed(NEWS_FEEDS[source])

            if not feed.entries:
                summary_data[source] = {
                    "count": 0,
                    "emotions": {"Pozytywne": 0, "Negatywne": 0, "Neutralne": 0}
                }
                continue

            # Analiza tylko kilku tytułów (szybko)
            articles = feed.entries[:3]
            emotion_counts = {"Pozytywne": 0, "Negatywne": 0, "Neutralne": 0}

            for entry in articles:
                title = entry.get("title", "").lower()
                if any(word in title for word in ["good", "positive", "gain", "up", "success", "dobry", "wzrost", "zysk"]):
                    emotion_counts["Pozytywne"] += 1
                elif any(word in title for word in ["bad", "negative", "fall", "down", "loss", "crisis", "zły", "spadek", "kryzys"]):
                    emotion_counts["Negatywne"] += 1
                else:
                    emotion_counts["Neutralne"] += 1

            summary_data[source] = {
                "count": len(feed.entries),
                "analyzed": len(articles),
                "emotions": emotion_counts,
                "latest_title": articles[0].get("title", "")[:50] if articles else ""
            }

        except Exception:
            summary_data[source] = {
                "count": 0,
                "emotions": {"Pozytywne": 0, "Negatywne": 0, "Neutralne": 0}
            }

    return {
        "summary": summary_data,
        "total_sources": len(summary_data),
        "cache_ttl": CACHE_TTL
    }


@router.get("/emotion-stats/{source}")
@cache(expire=CACHE_TTL)
def get_emotion_stats(source: str, lang: str = "pl", model: str = "roberta"):
    # Statystyki emocji dla jednego źródła
    if source not in NEWS_FEEDS:
        raise HTTPException(status_code=404, detail="Źródło nieobsługiwane")

    try:
        news_data = get_news(source, lang, model)
        articles = news_data.get("articles", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Błąd generowania statystyk: {str(e)}")

    emotion_counts = {"Pozytywne": 0, "Negatywne": 0, "Neutralne": 0}

    for article in articles:
        sentiment = article.get("sentiment", "Neutralne")
        if sentiment in emotion_counts:
            emotion_counts[sentiment] += 1

    total = len(articles)
    emotion_percentages = {
        emotion: (round((count / total) * 100, 2) if total > 0 else 0)
        for emotion, count in emotion_counts.items()
    }

    return {
        "source": source,
        "total_articles": total,
        "emotion_counts": emotion_counts,
        "emotion_percentages": emotion_percentages
    }


@router.get("/charts-data")
@cache(expire=CACHE_TTL)
async def get_all_charts_data(lang: str = "pl"):
    """
    Kompatybilność ze starszym frontendem – agreguje dane ze wszystkich źródeł.
    """
    sources = [
        "BBC", "CNN", "NYTimes", "Guardian", "AlJazeera",
        "PolsatNews", "Money", "Bankier", "SpidersWeb", "GazetaPrawna"
    ]

    async def fetch_stats(source):
        try:
            return {source: await get_emotion_stats(source, lang)}
        except Exception:
            return {source: None}

    tasks = [fetch_stats(source) for source in sources]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_data = {}
    for result in results:
        if isinstance(result, dict):
            all_data.update(result)

    return {"charts": all_data}


# TYMCZASOWY ENDPOINT DEBUG — usunąć po weryfikacji
@router.get("/debug-sentiments")
def debug_sentiments():
    """
    Zwraca artykuły ze wszystkich źródeł z polem sentiment i model.
    Dane z cache RSS (TTL 120s) lub pobrane na żywo jeśli cache pusty.
    Posortowane po sentiment — łatwo sprawdzić rozkład.
    """
    results = []

    for source in NEWS_FEEDS:
        resolved = _resolve_model(source, "pl", None)
        try:
            set_active_adapter(resolved)
        except ValueError:
            continue

        feed = get_from_cache(source)
        if not feed:
            try:
                feed = fetch_feed(NEWS_FEEDS[source])
                set_to_cache(source, feed)
            except Exception:
                continue

        entries = [e for e in (feed.entries or []) if is_recent_entry(e)][:3]
        for entry in entries:
            summary = clean_html(entry.get("summary", ""))
            text = (summary or "").strip() or entry.get("title", "")
            try:
                analysis = analyze_news(text, "pl")
            except Exception:
                continue
            results.append({
                "source": source,
                "model": resolved,
                "sentiment": analysis.get("sentiment", ""),
                "title": entry.get("title", "")[:50],
            })

    results.sort(key=lambda x: x["sentiment"])
    return {"count": len(results), "articles": results}
