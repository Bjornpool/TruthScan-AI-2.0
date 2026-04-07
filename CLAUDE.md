# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TruthScan AI is a master's thesis full-stack application for real-time news credibility analysis. It fetches articles from RSS feeds, runs them through HuggingFace Transformer models (sentiment analysis + fake news detection), and presents results in a bilingual (PL/EN) Next.js dashboard.

## Commands

### Backend (`TruthScan AI_backend/`)

```bash
# Install dependencies
cd "TruthScan AI_backend"
pip install -r requirements.txt

# Start dev server (http://127.0.0.1:8000)
python -m uvicorn app.main:app

# Run tests
python truthscan_test.py
```

Swagger UI available at `http://localhost:8000/docs`.

### Frontend (`TruthScan AI_frontend/`)

```bash
# Install dependencies
cd "TruthScan AI_frontend"
npm install

# Start dev server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Lint
npm run lint
```

## Architecture

### Data Flow

```
Browser (Next.js :3000)
  → HTTP/SSE → FastAPI (:8000)
  → RSS fetch → feedparser + BeautifulSoup
  → NLP pipeline → HuggingFace Transformers
  → JSON/SSE response → React UI
```

### Backend (`app/`)

- **`config.py`** — All constants: 10 RSS sources (BBC, CNN, NYTimes, Guardian, AlJazeera, PolsatNews, etc.), CORS settings, sentiment label mappings (PL/EN), cache TTLs.
- **`nlp_service.py`** — Plug-in NLP pipeline:
  - Abstract base class `ModelAdapter` with `analyze_sentiment()` and `analyze_fake_news()`.
  - Three adapters: `RoBERTaAdapter` (en), `XLMRoBERTaAdapter` (pl/en/no), `NorBERTAdapter` (no).
  - All adapters lazy-load their pipelines on first use.
  - Global registry `_REGISTRY`; active adapter changed via `set_active_adapter(name)`.
  - `register_adapter(adapter)` adds custom/fine-tuned checkpoints at runtime.
  - Public functions `analyze_news()` / `analyze_news_batch()` preserve the original interface — `routes/news.py` requires no changes.
  - Uses `ThreadPoolExecutor` (max 3 workers) for parallel batch processing.
- **`rss_utils.py`** — RSS fetching with 7s timeout, HTML stripping via BeautifulSoup, simple in-memory TTL cache.
- **`storage.py`** — Thread-safe JSON file persistence for saved articles (`saved_articles.json`).
- **`routes/news.py`** — Main endpoints: `GET /news/{source}` (5 articles with NLP), `GET /stream-news/{source}` (SSE streaming), `GET /emotion-stats/{source}`, `GET /charts-data`.
- **`routes/saved.py`** — CRUD for saved articles.
- **`routes/misc.py`** — `GET /sources` lists available RSS sources.

### Frontend (`app/` + `components/` + `lib/`)

- **Routing**: Next.js App Router — pages at `app/page.tsx` (home), `app/dashboard/page.tsx`, `app/saved/page.tsx`.
- **State**: Zustand store in `stores/newsCache.tsx` — caches articles per source/language with 5-min TTL, persisted to `localStorage` (key: `truthscan_news_cache_v1`).
- **API client**: `lib/fetchNews.ts` — `fetchOneSource()` and `fetchAllNews()` (concurrent, 3 workers default), plus `normalizeArticle()`.
- **SSE streaming**: `hooks/useNewsStream.ts` consumes `GET /stream-news/{source}`, tracks progress and collects articles, writes to Zustand cache on completion.
- **i18n**: `lib/locales.js` holds all PL/EN UI strings. Language state managed in `hooks/useLanguage.ts`, synced via `localStorage` and `app:langchange` custom event.
- **Charts**: Recharts via `hooks/useDashboardCharts.ts` and `hooks/useCachedEmotionStats.ts`.
- **PDF export**: `hooks/usePDFExport.ts` (jsPDF) + `components/PDFGenerator.tsx` (react-to-print).
- **Dark mode**: Tailwind `.dark` class toggle, CSS variables in `styles/globals.css`.

## Master's Thesis Goals

The thesis extends TruthScan AI by comparing NLP models across three languages: **Polish**, **Norwegian**, and **English**. Models under comparison: **XLM-RoBERTa**, **NorBERT 3**, **HerBERT**.

Planned work items:

1. **`nlp_service.py` plug-in architecture** — replace the hardcoded model with a swappable interface so each model (XLM-RoBERTa, NorBERT 3, HerBERT) can be loaded and hot-swapped without changing route logic.

2. **Norwegian RSS sources in `config.py`** — add NRK, VG, and Dagbladet alongside the existing 10 sources.

3. **`SENTIMENT_MAP` extension** — add a `"no"` (Norwegian) key to the sentiment label mapping in `config.py`, parallel to the existing `"pl"` and `"en"` keys.

4. **Benchmarking module** — new module that measures **F1**, **accuracy**, and **inference time** per model/language combination and exposes results via a dedicated API endpoint (or offline report).

5. **PostgreSQL migration** — replace `storage.py` / `saved_articles.json` with a PostgreSQL backend (SQLAlchemy or asyncpg). `storage.py` read/write interface should be preserved so routes need minimal changes.

6. **Public deployment** — frontend on **Vercel**, backend + models on **Hugging Face Spaces**.

### Environment

- Backend API base URL: `process.env.NEXT_PUBLIC_API_URL` (defaults to `http://127.0.0.1:8000`).
- Backend CORS is open (`"*"`) — intentional for thesis/dev use.
- NLP models are downloaded automatically by HuggingFace on first run (can be slow).
