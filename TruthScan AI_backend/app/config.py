"""
Centralna konfiguracja aplikacji oraz stałe wykorzystywane w wielu modułach.
"""

import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass  # python-dotenv opcjonalne; zmienne można też ustawić w środowisku

# Konfiguracja CORS
# Uwaga: credentials=True jest niekompatybilne z origins=["*"] w przeglądarkach
# (spec CORS odrzuca tę kombinację). Dla dev/thesis używamy credentials=False.
CORS_ALLOW_ORIGINS = ["*"]
CORS_ALLOW_CREDENTIALS = False
CORS_ALLOW_METHODS = ["GET", "POST", "DELETE", "OPTIONS"]
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
    "TVN24":        "https://tvn24.pl/najnowsze.xml",
    "SpidersWeb":   "https://spidersweb.pl/feed",
    "Bankier":      "https://www.bankier.pl/rss/wiadomosci.xml",
    # Norweskie
    "NRK":          "https://www.nrk.no/toppsaker.rss",
    "VG":           "https://www.vg.no/rss/feed/?limit=10",
    "E24":          "https://e24.no/rss",
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

# Klucz API Anthropic (Claude)
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
