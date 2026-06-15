"""
Endpoint pobierający pełną treść artykułu ze strony zewnętrznej.
"""

import re

from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8,no;q=0.7",
}

_CONTENT_SELECTORS = [
    "article",
    "[class*='article-content']",
    "[class*='article-body']",
    "[class*='article-text']",
    "[class*='post-content']",
    "[class*='entry-content']",
    "[class*='story-content']",
    "[class*='news-content']",
    "[class*='story__content']",
    "[class*='content-area']",
    "[role='main']",
    "main",
]


# Wzorce szumu na końcu artykułu — po napotkaniu zatrzymujemy ekstrakcję
_NOISE_PATTERNS = re.compile(
    r"(Czytaj wi[eę]cej"
    r"|WIDZISZ CO[SŚ] WA[ZŻ]NEGO"
    r"|Chcesz by[cć] na bie[zż][aą]co"
    r"|Dost[eę]pne w Google Play"
    r"|Pobierz z App Store)",
    re.IGNORECASE,
)

# Linia złożona wyłącznie z wielkich liter i spacji (tagi tematyczne)
_ALL_CAPS_LINE = re.compile(r"^[A-ZŁŚŻŹĆŃÓĄĘ\s]{4,}$")


def _cut_at_noise(lines: list[str]) -> list[str]:
    """Zatrzymuje ekstrakcję przy pierwszym wzorcu szumu lub linii tagów."""
    result = []
    for line in lines:
        stripped = line.strip()
        if _NOISE_PATTERNS.search(stripped):
            break
        if stripped and _ALL_CAPS_LINE.match(stripped):
            break
        result.append(line)
    return result


def _join_broken_lines(lines: list[str]) -> list[str]:
    """Łączy linie które nie kończą się kropką, przecinkiem ani cudzysłowem."""
    result: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        # Jeśli linia nie kończy się znakiem kończącym i jest następna — złącz
        if (
            line
            and not re.search(r'[.,;"»")\]]\s*$', line)
            and i + 1 < len(lines)
            and lines[i + 1].strip()
        ):
            result.append(line + " " + lines[i + 1].strip())
            i += 2
        else:
            result.append(line)
            i += 1
    return result


def _remove_isolated_short(lines: list[str]) -> list[str]:
    """Usuwa linie krótsze niż 20 znaków otoczone pustymi liniami."""
    result = []
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if len(stripped) < 20 and stripped:
            prev_empty = idx == 0 or not lines[idx - 1].strip()
            next_empty = idx == len(lines) - 1 or not lines[idx + 1].strip()
            if prev_empty and next_empty:
                continue
        result.append(line)
    return result


def extract_article_content(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")

    # Usuń elementy nienależące do treści
    for tag in soup(["script", "style", "nav", "header", "footer", "aside",
                     "form", "button", "figure", "iframe"]):
        tag.decompose()

    # Szukaj głównego kontenera treści
    content_el = None
    for selector in _CONTENT_SELECTORS:
        el = soup.select_one(selector)
        if el and len(el.get_text(strip=True)) > 200:
            content_el = el
            break

    if content_el:
        text = content_el.get_text(separator="\n")
    else:
        # Fallback: zbierz akapity dłuższe niż 60 znaków
        paragraphs = [
            p.get_text(strip=True)
            for p in soup.find_all("p")
            if len(p.get_text(strip=True)) > 60
        ]
        text = "\n\n".join(paragraphs[:30])

    # Oczyść encje HTML
    text = (
        text
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#x27;", "'")
        .replace("&nbsp;", " ")
    )
    text = re.sub(r" {2,}", " ", text)

    lines = text.split("\n")
    lines = _cut_at_noise(lines)
    lines = _join_broken_lines(lines)
    lines = _remove_isolated_short(lines)

    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


@router.get("/fetch-article-content")
async def fetch_article_content(url: str = Query(..., description="URL artykułu do pobrania")):
    if not url.startswith("http"):
        raise HTTPException(status_code=400, detail="Nieprawidłowy URL")

    try:
        import httpx
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            response = await client.get(url, headers=_HEADERS)
            response.raise_for_status()
            html = response.text
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout podczas pobierania artykułu")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Błąd HTTP: {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Błąd pobierania: {str(e)}")

    content = extract_article_content(html)
    return {"content": content, "success": True, "contentLength": len(content)}
