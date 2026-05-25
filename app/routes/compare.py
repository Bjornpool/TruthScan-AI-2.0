"""
Endpoint porównujący wyniki wszystkich adapterów NLP dla jednego tekstu.

Architektura:
  - fake news: jeden wspólny wynik z _shared_bart (BART large MNLI)
  - sentyment: każdy z 4 adapterów używa własnego modelu

Zwraca:
  - shared_fake_probability: float  — wynik BART (jeden dla wszystkich)
  - results: lista wyników sentymentu per adapter z czasem inferencji
  - explanation: wyjaśnienie różnic wygenerowane przez Claude API
"""

import time
from typing import Any, Dict, List

import anthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import ANTHROPIC_API_KEY, SENTIMENT_MAP
from ..nlp_service import get_adapter, analyze_fake_news_shared

router = APIRouter()

ADAPTER_NAMES = ["roberta", "xlm-roberta", "norbert", "herbert"]

LANG_NAMES = {
    "pl": "polski",
    "en": "angielski",
    "no": "norweski",
}

# Język odpowiedzi Claude zależny od lang w żądaniu
RESPONSE_LANG = {
    "pl": "polskim",
    "en": "English",
    "no": "norsk",
}

# Instrukcja do Claude w danym języku
EXPLAIN_INSTRUCTION = {
    "pl": (
        "Wyjaśnij w 3–4 zdaniach po polsku dlaczego modele oceniają sentyment tego tekstu tak jak oceniają. "
        "Uwzględnij: (1) czy tekst jest w języku {lang_name} i jak to wpływa na modele trenowane na innych językach, "
        "(2) co powoduje ewentualne rozbieżności między modelami, "
        "(3) który model jest prawdopodobnie najbardziej trafny dla tego języka i dlaczego. "
        "Pisz czystym tekstem — bez formatowania markdown, bez gwiazdek, bez nagłówków, bez list numerowanych."
    ),
    "en": (
        "Explain in 3–4 sentences in English why the models assess the sentiment of this text the way they do. "
        "Cover: (1) whether the text is in {lang_name} and how that affects models trained on other languages, "
        "(2) what causes any disagreements between the models, "
        "(3) which model is likely most accurate for this language and why. "
        "Write in plain text — no markdown, no asterisks, no headings, no numbered lists."
    ),
    "no": (
        "Forklar på norsk i 3–4 setninger hvorfor modellene vurderer sentimentet til denne teksten slik de gjør. "
        "Ta med: (1) om teksten er på {lang_name} og hvordan det påvirker modeller trent på andre språk, "
        "(2) hva som forårsaker eventuelle uenigheter mellom modellene, "
        "(3) hvilken modell som sannsynligvis er mest nøyaktig for dette språket og hvorfor. "
        "Skriv i ren tekst — ingen markdown, ingen stjerner, ingen overskrifter, ingen nummererte lister."
    ),
}

ADAPTER_DESCRIPTIONS = {
    "roberta":     "RoBERTa (trenowany na angielskich tweetach)",
    "xlm-roberta": "XLM-RoBERTa (wielojęzyczny, pl/en/no)",
    "norbert":     "NorBERT 3 (norweski model bazowy)",
    "herbert":     "HerBERT (polski model bazowy)",
}


CHART_COMMENT_PROMPT = {
    "pl": (
        "Na podstawie poniższych danych fake-news probability (0–100%) dla {n} źródeł mediów "
        "napisz dokładnie 2–3 zdania komentarza analitycznego po polsku. "
        "Wskaż źródło z najwyższym i najniższym wynikiem oraz co to może oznaczać dla czytelnika. "
        "Bądź zwięzły i obiektywny. Pisz czystym tekstem — bez markdown, bez gwiazdek, bez list.\n\n"
        "Dane:\n{rows}"
    ),
    "en": (
        "Based on the following fake-news probability data (0–100%) for {n} media sources "
        "write exactly 2–3 sentences of analytical commentary in English. "
        "Identify the source with the highest and lowest score and what this might mean for readers. "
        "Be concise and objective. Write in plain text — no markdown, no asterisks, no lists.\n\n"
        "Data:\n{rows}"
    ),
    "no": (
        "Basert på følgende fake-news sannsynlighetsdata (0–100 %) for {n} mediekilder "
        "skriv nøyaktig 2–3 setninger med analytisk kommentar på norsk. "
        "Pek på kilden med høyest og lavest score og hva dette kan bety for leseren. "
        "Vær kortfattet og objektiv. Skriv i ren tekst — ingen markdown, ingen stjerner, ingen lister.\n\n"
        "Data:\n{rows}"
    ),
}


class ChartCommentRequest(BaseModel):
    bars: list          # [{"label": "BBC", "value": 23.45}, ...]
    lang: str = "pl"


class ChartCommentResponse(BaseModel):
    comment: str


@router.post("/ai-chart-comment", response_model=ChartCommentResponse)
def ai_chart_comment(request: ChartCommentRequest):
    """Generuje krótki komentarz analityczny Claude do wykresu fake-news probability."""
    if not request.bars:
        raise HTTPException(status_code=422, detail="Brak danych wykresu.")

    lang = request.lang if request.lang in CHART_COMMENT_PROMPT else "pl"

    # Buduj czytelny opis danych (posortowany malejąco po value)
    sorted_bars = sorted(request.bars, key=lambda b: b.get("value", 0), reverse=True)
    rows = "\n".join(
        f"  {b['label']}: {b.get('value', 0):.2f}%"
        for b in sorted_bars
        if b.get("label")
    )
    prompt = CHART_COMMENT_PROMPT[lang].format(n=len(sorted_bars), rows=rows)

    if not ANTHROPIC_API_KEY:
        return ChartCommentResponse(comment="[Brak klucza ANTHROPIC_API_KEY]")

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        comment = message.content[0].text.strip() if message.content else ""
    except Exception as e:
        comment = f"[Błąd Claude API: {e}]"

    return ChartCommentResponse(comment=comment)


EMOTION_COMMENT_PROMPT = {
    "pl": (
        "Na podstawie danych o emocjach w artykułach: "
        "Pozytywne: {positive}, Neutralne: {neutral}, Negatywne: {negative} "
        "(łącznie {total} artykułów) — napisz 2–3 zdania komentarza analitycznego po polsku. "
        "Co dominujący sentyment mówi o obecnym klimacie medialnym? "
        "Bądź zwięzły i obiektywny. Pisz czystym tekstem — bez markdown, bez gwiazdek, bez list."
    ),
    "en": (
        "Based on emotion data from articles: "
        "Positive: {positive}, Neutral: {neutral}, Negative: {negative} "
        "(total {total} articles) — write 2–3 sentences of analytical commentary in English. "
        "What does the dominant sentiment say about the current media climate? "
        "Be concise and objective. Write in plain text — no markdown, no asterisks, no lists."
    ),
    "no": (
        "Basert på emosjonelle data fra artikler: "
        "Positive: {positive}, Nøytrale: {neutral}, Negative: {negative} "
        "(totalt {total} artikler) — skriv 2–3 setninger med analytisk kommentar på norsk. "
        "Hva sier det dominerende sentimentet om det nåværende mediaklimaet? "
        "Vær kortfattet og objektiv. Skriv i ren tekst — ingen markdown, ingen stjerner, ingen lister."
    ),
}


class EmotionCommentRequest(BaseModel):
    positive: int = 0
    neutral: int = 0
    negative: int = 0
    lang: str = "pl"


class EmotionCommentResponse(BaseModel):
    comment: str


@router.post("/ai-emotion-comment", response_model=EmotionCommentResponse)
def ai_emotion_comment(request: EmotionCommentRequest):
    """Generuje krótki komentarz analityczny Claude do wykresu emocji."""
    total = request.positive + request.neutral + request.negative
    if total == 0:
        raise HTTPException(status_code=422, detail="Brak danych emocji.")

    lang = request.lang if request.lang in EMOTION_COMMENT_PROMPT else "pl"
    prompt = EMOTION_COMMENT_PROMPT[lang].format(
        positive=request.positive,
        neutral=request.neutral,
        negative=request.negative,
        total=total,
    )

    if not ANTHROPIC_API_KEY:
        return EmotionCommentResponse(comment="[Brak klucza ANTHROPIC_API_KEY]")

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        comment = message.content[0].text.strip() if message.content else ""
    except Exception as e:
        comment = f"[Błąd Claude API: {e}]"

    return EmotionCommentResponse(comment=comment)


BENCHMARK_COMMENT_PROMPT = {
    "pl": (
        "Przeanalizuj wyniki analizy porównawczej modeli NLP:\n\n{summary}\n\n"
        "Napisz 4–5 zdań analizy po polsku: który model jest najszybszy i o ile, "
        "które modele wykazują anomalie w klasyfikacji sentymentu, jak zachowują się modele "
        "w różnych językach, i jakie wnioski praktyczne można wyciągnąć dla użytkownika systemu. "
        "Bądź konkretny i podawaj liczby. "
        "Pisz czystym tekstem — bez markdown, bez gwiazdek, bez list."
    ),
    "en": (
        "Analyse the results of the NLP model comparative analysis:\n\n{summary}\n\n"
        "Write 4–5 sentences in English: which model is the fastest and by how much, "
        "which models show anomalies in sentiment classification, how models perform across "
        "different languages, and what practical conclusions can be drawn for system users. "
        "Be specific and include numbers. "
        "Write in plain text — no markdown, no asterisks, no lists."
    ),
    "no": (
        "Analyser resultatene av den komparative analysen av NLP-modeller:\n\n{summary}\n\n"
        "Skriv 4–5 setninger på norsk: hvilken modell er raskest og med hvor mye, "
        "hvilke modeller viser avvik i sentimentklassifisering, hvordan modellene presterer "
        "på tvers av ulike språk, og hvilke praktiske konklusjoner som kan trekkes for systembrukere. "
        "Vær konkret og oppgi tall. "
        "Skriv i ren tekst — ingen markdown, ingen stjerner, ingen lister."
    ),
}


class BenchmarkCommentRequest(BaseModel):
    results: List[Dict[str, Any]]
    lang: str = "pl"


class BenchmarkCommentResponse(BaseModel):
    comment: str


@router.post("/ai-benchmark-comment", response_model=BenchmarkCommentResponse)
def ai_benchmark_comment(request: BenchmarkCommentRequest):
    """Generuje analizę Claude na podstawie wyników benchmarku modeli NLP."""
    valid = [r for r in request.results if not r.get("error") and r.get("language")]
    if not valid:
        raise HTTPException(status_code=422, detail="Brak poprawnych wyników benchmarku.")

    lang = request.lang if request.lang in BENCHMARK_COMMENT_PROMPT else "pl"

    # Buduj czytelne podsumowanie wyników
    lines = []
    for r in valid:
        sent = ", ".join(f"{k}:{v}" for k, v in (r.get("sentiments_distribution") or {}).items())
        lines.append(
            f"  {r['adapter_name']} / {r['language']}: "
            f"śr. czas={r.get('avg_inference_time_ms', '?')} ms, "
            f"fake={r.get('avg_fake_probability', '?')}%, "
            f"sentyment=[{sent}]"
        )
    summary = "\n".join(lines)
    prompt = BENCHMARK_COMMENT_PROMPT[lang].format(summary=summary)

    if not ANTHROPIC_API_KEY:
        return BenchmarkCommentResponse(comment="[Brak klucza ANTHROPIC_API_KEY]")

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        comment = message.content[0].text.strip() if message.content else ""
    except Exception as e:
        comment = f"[Błąd Claude API: {e}]"

    return BenchmarkCommentResponse(comment=comment)


class CompareRequest(BaseModel):
    text: str
    title: str = ""
    source: str = ""
    lang: str = "pl"


class AdapterResult(BaseModel):
    adapter: str
    sentiment: str
    sentiment_score: float
    inference_time_ms: float


class CompareResponse(BaseModel):
    shared_fake_probability: float
    results: List[AdapterResult]
    explanation: str


def _sentiment_only_with_timing(adapter_name: str, text: str, lang: str) -> AdapterResult:
    """Uruchamia tylko analizę sentymentu i mierzy jej czas."""
    adapter = get_adapter(adapter_name)
    neutral = SENTIMENT_MAP["neutral"].get(lang, "Neutral")

    if not text or len(text.strip()) < 10:
        print(f"[DEBUG] {adapter_name}: tekst za krótki, zwracam neutral/0.0")
        return AdapterResult(
            adapter=adapter_name,
            sentiment=neutral,
            sentiment_score=0.0,
            inference_time_ms=0.0,
        )

    start = time.perf_counter()
    try:
        sentiment_result = adapter.analyze_sentiment(text)
    except Exception as exc:
        elapsed = (time.perf_counter() - start) * 1000
        print(f"[DEBUG] {adapter_name}: WYJĄTEK w analyze_sentiment: {type(exc).__name__}: {exc}")
        return AdapterResult(
            adapter=adapter_name,
            sentiment=neutral,
            sentiment_score=0.0,
            inference_time_ms=round(elapsed, 1),
        )
    elapsed_ms = (time.perf_counter() - start) * 1000

    print(f"[DEBUG] {adapter_name}: sentiment_result = {sentiment_result}")

    raw_label = sentiment_result.get("label", "neutral")
    raw_score = sentiment_result.get("score", None)

    print(f"[DEBUG] {adapter_name}: raw_label={raw_label!r}  raw_score={raw_score!r}  type(score)={type(raw_score)}")

    sentiment_translated = SENTIMENT_MAP.get(raw_label, {}).get(lang, neutral)
    score_float = round(float(raw_score) if raw_score is not None else 0.0, 4)

    print(f"[DEBUG] {adapter_name}: → sentiment={sentiment_translated!r}  score_float={score_float}  time={elapsed_ms:.1f}ms")

    return AdapterResult(
        adapter=adapter_name,
        sentiment=sentiment_translated,
        sentiment_score=score_float,
        inference_time_ms=round(elapsed_ms, 1),
    )


def _build_prompt(
    request: CompareRequest,
    results: List[AdapterResult],
    shared_fake_probability: float,
) -> str:
    lang_name = LANG_NAMES.get(request.lang, request.lang)
    text_snippet = request.text[:600] + ("..." if len(request.text) > 600 else "")

    header_parts = []
    if request.title:
        header_parts.append(f"Tytuł artykułu: {request.title}")
    if request.source:
        header_parts.append(f"Źródło: {request.source}")
    header_parts.append(f"Język tekstu: {lang_name}")
    header_parts.append(f"Prawdopodobieństwo fake news (BART, wspólne dla wszystkich modeli): {shared_fake_probability:.1f}%")
    header_str = "\n".join(header_parts)

    rows = "\n".join(
        f"  {ADAPTER_DESCRIPTIONS[r.adapter]}: {r.sentiment} (pewność: {r.sentiment_score * 100:.0f}%, czas: {r.inference_time_ms:.0f} ms)"
        for r in results
    )

    sentiments = [r.sentiment for r in results]
    unique_sentiments = set(sentiments)
    agreement = (
        "zgodne" if len(unique_sentiments) == 1
        else f"różne ({', '.join(unique_sentiments)})"
    )

    lang = request.lang
    response_lang = RESPONSE_LANG.get(lang, "polskim")
    instruction = EXPLAIN_INSTRUCTION.get(lang, EXPLAIN_INSTRUCTION["pl"]).format(
        lang_name=lang_name
    )

    return f"""Odpowiedz w języku: {response_lang}.

{header_str}

Fragment tekstu:
{text_snippet}

Wyniki analizy sentymentu:
{rows}

Zgodność modeli: {agreement}

{instruction}"""


@router.post("/compare", response_model=CompareResponse)
def compare_models(request: CompareRequest):
    """
    Analizuje tekst przez wszystkie 4 adaptery NLP:
      - fake news: jeden wynik ze współdzielonego BART
      - sentyment: każdy adapter osobno z pomiarem czasu
    Zwraca wyniki + wyjaśnienie Claude API.
    """
    if not request.text or len(request.text.strip()) < 10:
        raise HTTPException(status_code=422, detail="Tekst jest za krótki (min. 10 znaków).")

    # Fake news — jeden wspólny wynik z BART (uruchamiamy raz)
    try:
        shared_fake_probability = analyze_fake_news_shared(request.text)
    except Exception as e:
        shared_fake_probability = 0.0

    # Sentyment — każdy adapter osobno z pomiarem czasu
    results: List[AdapterResult] = [
        _sentiment_only_with_timing(name, request.text, request.lang)
        for name in ADAPTER_NAMES
    ]

    # Wyjaśnienie Claude
    explanation = ""
    if ANTHROPIC_API_KEY:
        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            prompt = _build_prompt(request, results, shared_fake_probability)
            message = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=800,
                messages=[{"role": "user", "content": prompt}],
            )
            explanation = message.content[0].text if message.content else ""
        except Exception as e:
            explanation = f"[Błąd Claude API: {str(e)}]"
    else:
        explanation = "[Brak klucza ANTHROPIC_API_KEY — wyjaśnienie niedostępne]"

    return CompareResponse(
        shared_fake_probability=shared_fake_probability,
        results=results,
        explanation=explanation,
    )
