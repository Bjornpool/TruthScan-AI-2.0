"""
Narzędzia pomocnicze do pobierania i przetwarzania kanałów RSS oraz cache w pamięci.
"""

import time
import requests
import feedparser
from bs4 import BeautifulSoup
from typing import Dict, Any

from .config import CACHE_TTL_SECONDS

# Prosty cache w pamięci (key -> (value, timestamp))
_cache_data: Dict[str, tuple[Any, float]] = {}


def clean_html(text: str) -> str:
    # Usuwa znaczniki HTML z treści RSS
    return BeautifulSoup(text or "", "html.parser").get_text()


def get_from_cache(key: str):
    # Pobiera dane z cache, jeśli nie przekroczyły TTL
    entry = _cache_data.get(key)
    if not entry:
        return None

    value, ts = entry
    if time.time() - ts > CACHE_TTL_SECONDS:
        del _cache_data[key]
        return None

    return value


def set_to_cache(key: str, value):
    # Zapisuje dane do cache wraz z timestampem
    _cache_data[key] = (value, time.time())


class FeedFetchError(Exception):
    """Wyjątek rzucany gdy feed RSS jest niedostępny lub zwraca błąd HTTP."""
    def __init__(self, url: str, status_code: int, message: str = ""):
        self.url = url
        self.status_code = status_code
        super().__init__(message or f"Feed unavailable: HTTP {status_code} for {url}")


def fetch_feed(url: str):
    """
    Pobiera i parsuje kanał RSS z ustawionym User-Agent.
    Rzuca FeedFetchError jeśli serwer zwróci błąd HTTP (4xx/5xx),
    co pozwala wywołującemu zwrócić pustą listę zamiast HTTP 500.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
    }
    try:
        resp = requests.get(url, timeout=7, headers=headers)
    except requests.exceptions.Timeout:
        raise FeedFetchError(url, 408, f"Timeout fetching feed: {url}")
    except requests.exceptions.ConnectionError as e:
        raise FeedFetchError(url, 503, f"Connection error for {url}: {e}")

    if resp.status_code >= 400:
        raise FeedFetchError(url, resp.status_code,
                             f"HTTP {resp.status_code} for feed: {url}")

    return feedparser.parse(resp.content)
