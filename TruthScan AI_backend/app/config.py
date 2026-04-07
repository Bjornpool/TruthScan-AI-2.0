"""
Centralna konfiguracja aplikacji oraz stałe wykorzystywane w wielu modułach.
"""

import os
from pathlib import Path

# Konfiguracja CORS
CORS_ALLOW_ORIGINS = ["*"]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ["*"]
CORS_ALLOW_HEADERS = ["*"]

# Lista obsługiwanych źródeł RSS
NEWS_FEEDS = {
    # Angielskie
    "BBC":          "https://feeds.bbci.co.uk/news/rss.xml",
    "CNN":          "http://rss.cnn.com/rss/edition.rss",
    "NYTimes":      "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
    "Guardian":     "https://www.theguardian.com/world/rss",
    "AlJazeera":    "https://www.aljazeera.com/xml/rss/all.xml",
    # Polskie
    "Money":        "https://www.money.pl/rss/",
    "PolsatNews":   "https://www.polsatnews.pl/rss/wszystkie.xml",
    "GazetaPrawna": "https://www.gazetaprawna.pl/rss.xml",
    "SpidersWeb":   "https://spidersweb.pl/feed",
    "Bankier":      "https://www.bankier.pl/rss/wiadomosci.xml",
    # Norweskie
    "NRK":          "https://www.nrk.no/toppsaker.rss",
    "VG":           "https://www.vg.no/rss/feed/?limit=10",
    "Dagbladet":    "https://www.dagbladet.no/rss",
    "Aftenposten":  "https://www.aftenposten.no/rss",
}

# Mapowanie wyników analizy sentymentu na etykiety językowe
SENTIMENT_MAP = {
    "negative": {"pl": "Negatywne", "en": "Negative", "no": "Negativt"},
    "neutral":  {"pl": "Neutralne", "en": "Neutral",  "no": "Nøytralt"},
    "positive": {"pl": "Pozytywne", "en": "Positive", "no": "Positivt"},
}

# Ścieżka do pliku z zapisanymi artykułami
SAVED_FILE = Path("saved_articles.json")

# Czas życia cache (sekundy)
CACHE_TTL_SECONDS = 120

# Konfiguracja Redis (jeśli używany jako backend cache)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
CACHE_TTL = 300
