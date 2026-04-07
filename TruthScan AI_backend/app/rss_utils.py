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


def fetch_feed(url: str):
    # Pobiera i parsuje kanał RSS z ustawionym User-Agent
    headers = {"User-Agent": "Mozilla/5.0 (compatible; ThruScanBot/1.0)"}
    resp = requests.get(url, timeout=7, headers=headers)
    resp.raise_for_status()

    return feedparser.parse(resp.content)
