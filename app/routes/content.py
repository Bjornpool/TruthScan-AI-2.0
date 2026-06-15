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

# Norweskie wzorce szumu — filtruj linie zawierające
_NO_NOISE = re.compile(
    r"kl\.\s*\d{1,2}:\d{2}"        # timestampy: kl. 14:32
    r"|–\s*Journalist\s+(i|fra)\b"  # byline: – Journalist i NRK
    r"|Foto\s*:"                     # podpis zdjęcia
    r"|^Kilde:"                      # źródło
    r"|Publiseringsdato:",
    re.IGNORECASE,
)

# Polskie wzorce szumu — filtruj linie zawierające
_PL_NOISE = re.compile(
    r"Czytaj wi[eę]cej"
    r"|WIDZISZ CO[SŚ] WA[ZŻ]NEGO"
    r"|Chcesz by[cć] na bie[zż][aą]co"
    r"|Pobierz z (App Store|Google Play|HUAWEI)"
    r"|PRZEJD[ZŹ] DO WRZUTNI",
    re.IGNORECASE,
)

# Linia złożona z samych wielkich liter, krótsza niż 30 znaków (tagi tematyczne)
_ALL_CAPS_SHORT = re.compile(r"^[A-ZŁŚŻŹĆŃÓĄĘ\s\-]{4,29}$")


def _is_noise_line(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    if _NO_NOISE.search(s):
        return True
    if _PL_NOISE.search(s):
        return True
    if _ALL_CAPS_SHORT.match(s):
        return True
    return False


def _deduplicate(lines: list) -> list:
    seen: set = set()
    result = []
    for line in lines:
        key = line.strip()
        if key in seen:
            continue
        seen.add(key)
        result.append(line)
    return result


def _join_broken_lines(lines: list) -> list:
    """Łączy linie nie kończące się interpunkcją, gdy następna zaczyna się małą literą."""
    result = []
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        next_line = lines[i + 1].strip() if i + 1 < len(lines) else ""
        if (
            line
            and not re.search(r'[.,;:!?"»”)\]]\s*$', line)
            and next_line
            and next_line[0].islower()
        ):
            result.append(line + " " + next_line)
            i += 2
        else:
            result.append(line)
            i += 1
    return result


def _remove_isolated_short(lines: list) -> list:
    """Usuwa linie krótsze niż 20 znaków otoczone pustymi liniami."""
    result = []
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if stripped and len(stripped) < 20:
            prev_empty = idx == 0 or not lines[idx - 1].strip()
            next_empty = idx == len(lines) - 1 or not lines[idx + 1].strip()
            if prev_empty and next_empty:
                continue
        result.append(line)
    return result


def extract_article_content(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup(["script", "style", "nav", "header", "footer", "aside",
                     "form", "button", "figure", "iframe"]):
        tag.decompose()

    content_el = None
    for selector in _CONTENT_SELECTORS:
        el = soup.select_one(selector)
        if el and len(el.get_text(strip=True)) > 200:
            content_el = el
            break

    if content_el:
        text = content_el.get_text(separator="\n")
    else:
        paragraphs = [
            p.get_text(strip=True)
            for p in soup.find_all("p")
            if len(p.get_text(strip=True)) > 60
        ]
        text = "\n\n".join(paragraphs[:30])

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
    lines = _deduplicate(lines)
    lines = [ln for ln in lines if not _is_noise_line(ln)]
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
