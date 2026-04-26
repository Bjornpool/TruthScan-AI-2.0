"""
Główna konfiguracja i uruchomienie aplikacji FastAPI.
"""

from fastapi import FastAPI, Request
from fastapi.responses import Response
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

from .routes import misc, news, saved, compare

app = FastAPI()

_CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
}


@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    # Odpowiedź na preflight OPTIONS bez przekazywania do routera
    if request.method == "OPTIONS":
        return Response(status_code=204, headers=_CORS_HEADERS)

    response = await call_next(request)

    for key, value in _CORS_HEADERS.items():
        response.headers[key] = value

    return response


@app.on_event("startup")
async def startup():
    FastAPICache.init(InMemoryBackend(), prefix="news-cache")
    print("✓ Cache initialized (5 minut TTL)")


app.include_router(misc.router)
app.include_router(news.router)
app.include_router(saved.router)
app.include_router(compare.router)


@app.get("/")
async def root():
    return {"message": "TruthScan API", "status": "running", "cached": True}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
