"""
Serwis NLP z architekturą plug-in.

Każdy model jest reprezentowany przez adapter dziedziczący z ModelAdapter.
Publiczne API (analyze_news, analyze_news_batch) pozostaje niezmienione,
więc routes/news.py nie wymaga modyfikacji.

Fake news detection używa jednej globalnej instancji BART (_shared_bart)
współdzielonej przez wszystkie adaptery — model ładowany jest leniwie
przy pierwszym wywołaniu get_shared_bart().
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from concurrent.futures import ThreadPoolExecutor

from transformers import pipeline

from .config import SENTIMENT_MAP


# ---------------------------------------------------------------------------
# Współdzielony BART do wykrywania fake news (jeden egzemplarz dla wszystkich)
# ---------------------------------------------------------------------------

_shared_bart = None


def get_shared_bart():
    """
    Zwraca globalną instancję potoku zero-shot-classification (BART).
    Ładuje model przy pierwszym wywołaniu (lazy init).
    """
    global _shared_bart
    if _shared_bart is None:
        _shared_bart = pipeline(
            "zero-shot-classification",
            model="facebook/bart-large-mnli",
        )
    return _shared_bart


def analyze_fake_news_shared(text: str) -> float:
    """
    Klasyfikuje tekst jako real/fake używając współdzielonego BART.

    Zwraca:
        Prawdopodobieństwo fake news w procentach (0.0 – 100.0).
    """
    result = get_shared_bart()(text, candidate_labels=["real", "fake"])
    for lbl, score in zip(result["labels"], result["scores"]):
        if lbl == "fake":
            return round(score * 100, 2)
    return 0.0


# ---------------------------------------------------------------------------
# Klasa bazowa
# ---------------------------------------------------------------------------

class ModelAdapter(ABC):
    """
    Abstrakcyjny adapter modelu NLP.

    Każdy konkretny adapter implementuje:
      - analyze_sentiment(text) -> {"label": str, "score": float}
      - analyze_fake_news(text) -> {"labels": List[str], "scores": List[float]}

    analyze_fake_news deleguje do współdzielonego BART (get_shared_bart),
    więc każda podklasa może użyć domyślnej implementacji z tej klasy bazowej.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        ...

    @property
    @abstractmethod
    def supported_languages(self) -> List[str]:
        ...

    @abstractmethod
    def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """
        Zwraca {"label": str, "score": float}
        gdzie label to: 'positive' | 'negative' | 'neutral'
        """
        ...

    def analyze_fake_news(self, text: str) -> Dict[str, Any]:
        """
        Klasyfikuje tekst używając współdzielonego BART.
        Podklasy mogą nadpisać, ale domyślnie korzystają z _shared_bart.
        """
        result = get_shared_bart()(text, candidate_labels=["real", "fake"])
        return {"labels": result["labels"], "scores": result["scores"]}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_pipeline_result(adapter_name: str, raw: Any) -> Dict[str, Any]:
    """
    Bezpiecznie wyciąga słownik {label, score} z surowego outputu pipeline.

    Pipeline text-classification może zwrócić:
      - [{"label": ..., "score": ...}]              (return_all_scores=False / top_k=1 stary format)
      - [[{"label": ..., "score": ...}, ...]]        (return_all_scores=True / top_k=None)
      - [{"label": ..., "score": ...}, ...]          (płaski flat list wszystkich labeli)
    """
    try:
        item = raw[0]
    except (IndexError, TypeError, KeyError):
        # KeyError: raw jest dictem i raw[0] podnosi KeyError
        print(f"[NLP] {adapter_name}: nieoczekiwany typ raw={type(raw).__name__!r}, raw={raw!r}")
        return {"label": "", "score": 0.0}

    if isinstance(item, dict):
        # Płaski flat list [dict, dict, ...] — może zawierać wiele labeli.
        # Bierzemy ten z najwyższym score, a nie tylko raw[0].
        try:
            candidates = [x for x in raw if isinstance(x, dict)]
            result = max(candidates, key=lambda x: x.get("score") or 0.0) if candidates else item
        except (ValueError, AttributeError):
            result = item
    elif isinstance(item, list):
        # Zagnieżdżony format [[dict, dict, ...]] — top_k=None lub return_all_scores=True
        if not item:
            return {"label": "", "score": 0.0}
        try:
            result = max(item, key=lambda x: x.get("score") or 0.0)
        except AttributeError:
            # Elementy nie są dictami (np. surowe tensory / floaty)
            print(f"[NLP] {adapter_name}: elementy listy nie są dictami: {type(item[0]).__name__!r}")
            return {"label": "", "score": 0.0}
    else:
        print(f"[NLP] {adapter_name}: nieobsługiwany format item={type(item).__name__!r}")
        return {"label": "", "score": 0.0}

    # Normalizuj score: None lub brak klucza → 0.0
    raw_score = result.get("score")
    if raw_score is None or not isinstance(raw_score, (int, float)):
        print(f"[NLP] {adapter_name}: score={raw_score!r} — zastępuję 0.0")
        result = {**result, "score": 0.0}

    return result


def _normalize_sentiment_label(raw_label: str) -> str:
    label = (raw_label or "").strip().lower()

    _POSITIVE = {"positive", "pos", "label_2", "2", "very positive"}
    _NEGATIVE = {"negative", "neg", "label_0", "0", "very negative"}
    # "mixed" (NorBERT3 sentence-sentiment) → traktujemy jako neutral
    _NEUTRAL  = {"neutral", "mixed", "label_1"}

    if label in _POSITIVE or label.startswith("pos"):
        return "positive"
    if label in _NEGATIVE or label.startswith("neg"):
        return "negative"
    if label in _NEUTRAL:
        return "neutral"
    return "neutral"


# ---------------------------------------------------------------------------
# Adaptery — każdy ładuje tylko swój model sentymentu
# ---------------------------------------------------------------------------

class RoBERTaAdapter(ModelAdapter):
    """
    Adapter anglojęzyczny.
      sentyment: cardiffnlp/twitter-roberta-base-sentiment-latest
      fake news: współdzielony BART (ModelAdapter.analyze_fake_news)
    """

    def __init__(self) -> None:
        self._sentiment_pipe = None

    def _load(self) -> None:
        if self._sentiment_pipe is None:
            self._sentiment_pipe = pipeline(
                "text-classification",
                model="cardiffnlp/twitter-roberta-base-sentiment-latest",
                top_k=1,
            )

    @property
    def name(self) -> str:
        return "roberta"

    @property
    def supported_languages(self) -> List[str]:
        return ["en"]

    def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        self._load()
        raw = self._sentiment_pipe(text)
        result = _extract_pipeline_result(self.name, raw)
        return {
            "label": _normalize_sentiment_label(result.get("label", "")),
            "score": float(result.get("score", 0.0)),
        }


class XLMRoBERTaAdapter(ModelAdapter):
    """
    Adapter wielojęzyczny (pl, en, no).
      sentyment: cardiffnlp/twitter-xlm-roberta-base-sentiment
      fake news: współdzielony BART
    """

    def __init__(self) -> None:
        self._sentiment_pipe = None
        self._logged = False

    def _load(self) -> None:
        if self._sentiment_pipe is None:
            self._sentiment_pipe = pipeline(
                "text-classification",
                model="cardiffnlp/twitter-xlm-roberta-base-sentiment",
                top_k=1,
            )

    @property
    def name(self) -> str:
        return "xlm-roberta"

    @property
    def supported_languages(self) -> List[str]:
        return ["pl", "en", "no"]

    def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        self._load()
        raw = self._sentiment_pipe(text)
        if not self._logged:
            print(f"[DEBUG XLM-RoBERTa] RAW OUTPUT: {raw}", flush=True)
            self._logged = True
        result = _extract_pipeline_result(self.name, raw)
        return {
            "label": _normalize_sentiment_label(result.get("label", "")),
            "score": float(result.get("score", 0.0)),
        }


class HerBERTAdapter(ModelAdapter):
    """
    Adapter dla języka polskiego (HerBERT).
      sentyment: Voicelab/herbert-large-cased-sentiment (fine-tuned na polskim sentymencie)
      fake news: współdzielony BART
    """

    SENTIMENT_MODEL: str = "Voicelab/herbert-large-cased-sentiment"

    def __init__(self, sentiment_model: Optional[str] = None) -> None:
        self._sentiment_model_id = sentiment_model or self.SENTIMENT_MODEL
        self._sentiment_pipe = None
        self._logged = False

    def _load(self) -> None:
        if self._sentiment_pipe is None:
            self._sentiment_pipe = pipeline(
                "text-classification",
                model=self._sentiment_model_id,
                top_k=1,
            )

    @property
    def name(self) -> str:
        return "herbert"

    @property
    def supported_languages(self) -> List[str]:
        return ["pl"]

    def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        self._load()
        raw = self._sentiment_pipe(text)
        if not self._logged:
            print(f"[DEBUG HerBERT] RAW OUTPUT: {raw}", flush=True)
            self._logged = True
        result = _extract_pipeline_result(self.name, raw)
        return {
            "label": _normalize_sentiment_label(result.get("label", "")),
            "score": float(result.get("score", 0.0)),
        }


class NorBERTAdapter(ModelAdapter):
    """
    Adapter dla języka norweskiego.
      sentyment: cardiffnlp/twitter-xlm-roberta-base-sentiment-multilingual
                 (wielojęzyczny XLM-RoBERTa Cardiff, obsługuje norweski)
      fake news: współdzielony BART
    """

    # cardiffnlp/twitter-xlm-roberta-base-sentiment-multilingual —
    # wielojęzyczny model Cardiff fine-tuned na sentymencie (obsługuje norweski),
    # standardowa architektura XLM-RoBERTa kompatybilna z pipeline("text-classification").
    SENTIMENT_MODEL: str = "cardiffnlp/twitter-xlm-roberta-base-sentiment-multilingual"

    def __init__(self, sentiment_model: Optional[str] = None) -> None:
        self._sentiment_model_id = sentiment_model or self.SENTIMENT_MODEL
        self._sentiment_pipe = None

    def _load(self) -> None:
        if self._sentiment_pipe is None:
            self._sentiment_pipe = pipeline(
                "text-classification",
                model=self._sentiment_model_id,
                top_k=1,
            )

    @property
    def name(self) -> str:
        return "norbert"

    @property
    def supported_languages(self) -> List[str]:
        return ["no"]

    def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        self._load()
        raw = self._sentiment_pipe(text)
        result = _extract_pipeline_result(self.name, raw)
        return {
            "label": _normalize_sentiment_label(result.get("label", "")),
            "score": float(result.get("score", 0.0)),
        }


# ---------------------------------------------------------------------------
# Rejestr adapterów — lazy initialization
# ---------------------------------------------------------------------------

_REGISTRY: Dict[str, ModelAdapter] = {}
_active_adapter: Optional[ModelAdapter] = None
executor = ThreadPoolExecutor(max_workers=3)
_BUILTIN_ADAPTERS = {"roberta", "xlm-roberta", "herbert", "norbert"}


def _init_registry() -> None:
    if _REGISTRY:
        return
    _REGISTRY["roberta"]     = RoBERTaAdapter()
    _REGISTRY["xlm-roberta"] = XLMRoBERTaAdapter()
    _REGISTRY["herbert"]     = HerBERTAdapter()
    _REGISTRY["norbert"]     = NorBERTAdapter()


def get_adapter(name: str) -> ModelAdapter:
    _init_registry()
    if name not in _REGISTRY:
        raise ValueError(
            f"Nieznany adapter: '{name}'. Dostępne: {list(_REGISTRY.keys())}"
        )
    return _REGISTRY[name]


def set_active_adapter(name: str) -> None:
    global _active_adapter
    _active_adapter = get_adapter(name)


def register_adapter(adapter: ModelAdapter) -> None:
    _init_registry()
    _REGISTRY[adapter.name] = adapter


def _get_active_adapter() -> ModelAdapter:
    global _active_adapter
    if _active_adapter is None:
        _active_adapter = get_adapter("roberta")
    return _active_adapter


# ---------------------------------------------------------------------------
# Publiczne API
# ---------------------------------------------------------------------------

def analyze_news(
    text: str,
    lang: str = "pl",
    adapter: Optional[ModelAdapter] = None,
) -> dict:
    """
    Analizuje pojedynczy tekst pod kątem sentymentu i fake news.

    Returns:
        {"sentiment": str, "fake_probability": float, "sentiment_score": float}
    """
    _neutral = SENTIMENT_MAP["neutral"].get(lang, "Neutral")

    if not text or len(text.strip()) < 10:
        return {"sentiment": _neutral, "fake_probability": 0.0, "sentiment_score": 0.0}

    _adapter = adapter or _get_active_adapter()

    try:
        sentiment_result = _adapter.analyze_sentiment(text)
    except Exception:
        sentiment_result = {"label": "neutral", "score": 0.0}

    label = sentiment_result.get("label", "neutral")
    sentiment_translated = SENTIMENT_MAP.get(label, {}).get(lang, _neutral)

    try:
        fake_result = _adapter.analyze_fake_news(text)
        fake_score = 0.0
        for lbl, score in zip(fake_result["labels"], fake_result["scores"]):
            if lbl == "fake":
                fake_score = score
                break
        fake_probability: Optional[float] = round(fake_score * 100, 2)
    except Exception:
        fake_probability = None

    return {
        "sentiment": sentiment_translated,
        "fake_probability": fake_probability,
        "sentiment_score": round(float(sentiment_result.get("score", 0.0)), 2),
    }


def analyze_news_batch(
    texts: List[str],
    lang: str = "pl",
    adapter: Optional[ModelAdapter] = None,
) -> List[Dict[str, Any]]:
    """Analiza wielu tekstów w trybie batch z użyciem ThreadPoolExecutor."""
    if not texts:
        return []

    _adapter = adapter or _get_active_adapter()
    results: List[Dict[str, Any]] = []
    batch_size = 3

    batches = [texts[i:i + batch_size] for i in range(0, len(texts), batch_size)]

    for batch in batches:
        futures = [
            executor.submit(analyze_news, text, lang, _adapter)
            for text in batch
        ]
        for future in futures:
            try:
                results.append(future.result())
            except Exception:
                _neutral = SENTIMENT_MAP["neutral"].get(lang, "Neutral")
                results.append(
                    {"sentiment": _neutral, "fake_probability": 0.0, "sentiment_score": 0.0}
                )

    return results


def analyze_news_single(text: str, lang: str) -> Dict[str, Any]:
    """Wrapper dla analizy pojedynczego tekstu (używany w batch processing)."""
    return analyze_news(text, lang)
