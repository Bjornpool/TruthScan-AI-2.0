"""
Endpointy związane z pobieraniem, analizą i strumieniowaniem wiadomości.
"""

import asyncio
import json
from typing import List

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from fastapi_cache.decorator import cache

from ..config import CACHE_TTL, NEWS_FEEDS
from ..rss_utils import fetch_feed, clean_html, get_from_cache, set_to_cache, FeedFetchError, filter_entries
from ..nlp_service import analyze_news, set_active_adapter

router = APIRouter()


@router.get("/news/{source}")
def get_news(source: str, lang: str = "pl", model: str = "roberta"):
    # Walidacja źródła
    if source not in NEWS_FEEDS:
        raise HTTPException(status_code=404, detail="Źródło nieobsługiwane")

    # Ustawienie aktywnego adaptera NLP
    try:
        set_active_adapter(model)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Nieznany model: {model}")

    url = NEWS_FEEDS[source]

    # Pobranie RSS z cache — ten sam mechanizm co w stream_news
    cached = get_from_cache(source)
    if cached:
        feed = cached
    else:
        try:
            feed = fetch_feed(url)
            set_to_cache(source, feed)
        except FeedFetchError as e:
            print(f"⚠️  Feed niedostępny [{source}]: {e}")
            return {"source": source, "articles": [], "error": str(e)}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Błąd pobierania newsów: {str(e)}")

    if not feed.entries:
        return {"source": source, "articles": []}

    MAX_ARTICLES = 3
    articles: List[dict] = []

    # Przetwarzanie i analiza artykułów (CNN: pierwsze 3; reszta: ostatnie 30 dni)
    for entry in filter_entries(feed.entries, source)[:MAX_ARTICLES]:
        summary = clean_html(entry.get("summary", ""))
        text_to_analyze = (summary or "").strip() or entry.get("title", "")
        analysis = analyze_news(text_to_analyze, lang)

        articles.append({
            "title": entry.get("title", ""),
            "link": entry.get("link", ""),
            "summary": summary,
            "published": entry.get("published", ""),
            "source": source,
            "model": model,
            **analysis
        })

    return {"source": source, "articles": articles}


# Strumieniowanie newsów przez SSE
@router.get("/stream-news/{source}")
async def stream_news(source: str, lang: str = "pl", model: str = "roberta"):
    if source not in NEWS_FEEDS:
        raise HTTPException(status_code=404, detail="Źródło nieobsługiwane")

    # Walidacja i ustawienie adaptera przed uruchomieniem generatora
    try:
        set_active_adapter(model)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Nieznany model: {model}")

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
        to_send = filter_entries(entries, source)[:MAX_ARTICLES]

        # Metadane dla klienta
        yield f"event: meta\ndata: {json.dumps({'total': len(to_send)})}\n\n"

        sent = 0
        for entry in to_send:
            summary = clean_html(entry.get("summary", ""))
            text_to_analyze = (summary or "").strip() or entry.get("title", "")

            # Analiza NLP uruchamiana w executorze (CPU-bound)
            loop = asyncio.get_event_loop()
            analysis = await loop.run_in_executor(
                None, lambda: analyze_news(text_to_analyze, lang)
            )

            article = {
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "summary": summary,
                "published": entry.get("published", ""),
                "source": source,
                "model": model,
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
