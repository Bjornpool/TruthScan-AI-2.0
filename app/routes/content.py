"""
Endpoint pobierajacy pelna tresc artykulu ze strony zewnetrznej.
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

# Norweskie wzorce szumu
_NO_NOISE = re.compile(
    r"kl\.\s*\d{1,2}:\d{2}"
    r"|[–-]\s*Journalist\s+(i|fra)\b"
    r"|Foto\s*:"
    r"|^Kilde:"
    r"|Publiseringsdato:",
    re.IGNORECASE,
)

# Polskie wzorce szumu (w tym TVN24)
_PL_NOISE = re.compile(
    r"Czytaj wi[eę]cej"
    r"|WIDZISZ CO[SŚ] WA[ZŻ]NEGO"
    r"|Chcesz by[cć] na bie[zż][aą]co"
    r"|Pobierz z (App Store|Google Play|HUAWEI)"
    r"|PRZEJD[ZŹ] DO WRZUTNI"
    r"|Wykup subskrypcj[eę]"
    r"|Masz subskrypcj[eę]"
    r"|Dowiedz si[eę] wi[eę]cej"
    r"|ZOBACZ TAKE|ZOBACZ TAK[ZŻ]E"
    r"|TVN24\+?\s*Originals"
    r"|Udost[eę]pnij\s*:"
    r"|Link skopiowany do schowka"
    r"|^Tagi\s*:",
    re.IGNORECASE,
)

# Wzorzec autora: "Imię Nazwisko" lub "Imię Nazwisko 45 min"
_AUTHOR_LINE = re.compile(
    r"^[A-ZŁŚŻŹĆŃÓĄĘ][a-złśżźćńóąę]{1,20}"
    r"(\s+[A-ZŁŚŻŹĆŃÓĄĘ][a-złśżźćńóąę]{1,20})?"
    r"\s+[A-ZŁŚŻŹĆŃÓĄĘ][a-złśżźćńóąę]{1,30}"
    r"(\s+\d{1,3}\s+min)?\s*$"
)

# Angielskie wzorce szumu (Al Jazeera, BBC, CNN i inne)
_EN_NOISE = re.compile(
    r"Save\s+Share\s+facebook"
    r"|whatsapp-stroke\s+copylink"
    r"|By\s+Al\s+Jazeera\s+Staff"
    r"|Published\s+On\s+\d{1,2}"
    r"|^Advertisement$"
    r"|Recommended\s+Stories"
    r"|list\s+of\s+\d+\s+items"
    r"|list\s+\d+\s+of\s+\d+"
    r"|^end\s+of\s+list$",
    re.IGNORECASE,
)

# Linia z samych wielkich liter, krotsza niz 30 znakow (tagi tematyczne)
_ALL_CAPS_SHORT = re.compile(r"^[A-ZŁŚŻŹĆŃÓĄĘ\s\-]{4,29}$")

# Znaki konczace sekcje (wykrzyknik, pytajnik, cudzyslow zamykajacy).
# Wszystkie znaki przez chr() — unikamy literalnych cudzyslowow w source.
_CLOSING_QUOTES = (
    chr(0x22)    # “  ASCII double quote
    + chr(0x201C)  # left double quotation mark
    + chr(0x201D)  # right double quotation mark
    + chr(0xBB)    # right-pointing double angle quotation mark
    + chr(0x27)    # ASCII single quote / apostrophe
)
_SECTION_END = re.compile(
    r'[!?]\s*$|[' + _CLOSING_QUOTES + r']\s*[.!?]?\s*$'
)


def _is_noise_line(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    if _NO_NOISE.search(s):
        return True
    if _PL_NOISE.search(s):
        return True
    if _EN_NOISE.search(s):
        return True
    if _ALL_CAPS_SHORT.match(s):
        return True
    if _AUTHOR_LINE.match(s):
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
    # Grupuje kolejne niepuste linie w akapity.
    # Nowy akapit zaczyna sie przy pustej linii lub znaku konczacego sekcje.
    result = []
    current = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current:
                result.append(" ".join(current))
                current = []
            result.append("")
        else:
            current.append(stripped)
            if _SECTION_END.search(stripped):
                result.append(" ".join(current))
                current = []

    if current:
        result.append(" ".join(current))

    return result


def _remove_isolated_short(lines: list) -> list:
    # Usuwa linie krotsze niz 20 znakow otoczone pustymi liniami.
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
async def fetch_article_content(url: str = Query(..., description="URL artykulu do pobrania")):
    if not url.startswith("http"):
        raise HTTPException(status_code=400, detail="Nieprawidlowy URL")

    try:
        import httpx
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            response = await client.get(url, headers=_HEADERS)
            response.raise_for_status()
            html = response.text
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout podczas pobierania artykulu")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Blad HTTP: {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Blad pobierania: {str(e)}")

    content = extract_article_content(html)
    return {"content": content, "success": True, "contentLength": len(content)}
