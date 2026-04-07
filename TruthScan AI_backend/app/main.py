"""
Główna konfiguracja i uruchomienie aplikacji FastAPI.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

# Konfiguracja CORS (źródła, metody, nagłówki itp.)
from .config import (
    CORS_ALLOW_ORIGINS,
    CORS_ALLOW_CREDENTIALS,
    CORS_ALLOW_METHODS,
    CORS_ALLOW_HEADERS
)

# Routery aplikacji
from .routes import misc, news, saved

# Inicjalizacja aplikacji FastAPI
app = FastAPI()

# Middleware CORS – umożliwia dostęp do API z innych domen
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=CORS_ALLOW_CREDENTIALS,
    allow_methods=CORS_ALLOW_METHODS,
    allow_headers=CORS_ALLOW_HEADERS,
)

# Logika wykonywana przy starcie aplikacji
@app.on_event("startup")
async def startup():
    # Inicjalizacja cache w pamięci (np. do cache’owania newsów)
    FastAPICache.init(InMemoryBackend(), prefix="news-cache")
    print("✓ Cache initialized (5 minut TTL)")

# Rejestracja routerów
app.include_router(misc.router)
app.include_router(news.router)
app.include_router(saved.router)

# Endpoint główny – informacja o stanie API
@app.get("/")
async def root():
    return {
        "message": "ThruScan API",
        "status": "running",
        "cached": True
    }

# Endpoint zdrowia – używany np. przez monitoring / load balancer
@app.get("/health")
async def health_check():
    return {"status": "healthy"}
