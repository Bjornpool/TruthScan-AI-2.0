"""
Serwis NLP z architekturą plug-in.

Każdy model jest reprezentowany przez adapter dziedziczący z ModelAdapter.
Publiczne API (analyze_news, analyze_news_batch) pozostaje niezmienione,
więc routes/news.py nie wymaga modyfikacji.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from concurrent.futures import ThreadPoolExecutor

from transformers import pipeline

from .config import SENTIMENT_MAP


# ---------------------------------------------------------------------------
# Klasa bazowa
# ---------------------------------------------------------------------------

class ModelAdapter(ABC):
    """
    Abstrakcyjny adapter modelu NLP.

    Każdy konkretny adapter musi zaimplementować:
      - analyze_sentiment(text) -> {"label": str, "score": float}
      - analyze_fake_news(text) -> {"labels": List[str], "scores": List[float]}
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unikalny identyfikator adaptera (np. 'roberta', 'xlm-roberta')."""
        ...

    @property
    @abstractmethod
    def supported_languages(self) -> List[str]:
        """Kody języków obsługiwanych przez model (np. ['pl', 'en', 'no'])."""
        ...

    @abstractmethod
    def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """
        Analizuje sentyment tekstu.

        Zwraca:
            {"label": str, "score": float}
            gdzie label to jedna z wartości: 'positive' | 'negative' | 'neutral'
        """
        ...

    @abstractmethod
    def analyze_fake_news(self, text: str) -> Dict[str, Any]:
        """
        Klasyfikuje tekst jako real/fake.

        Zwraca:
            {"labels": List[str], "scores": List[float]}
        """
        ...


# ---------------------------------------------------------------------------
# Adaptery
# ---------------------------------------------------------------------------

def _normalize_sentiment_label(raw_label: str) -> str:
    """
    Normalizuje etykietę sentymentu z modelu do jednego z trzech wariantów:
    'positive' | 'negative' | 'neutral'.

    Obsługuje różne konwencje nazewnictwa stosowane przez modele HuggingFace.
    """
    label = (raw_label or "").strip().lower()

    _POSITIVE = {"positive", "pos", "label_2", "2", "very positive"}
    _NEGATIVE = {"negative", "neg", "label_0", "0", "very negative"}

    if label in _POSITIVE or label.startswith("pos"):
        return "positive"
    if label in _NEGATIVE or label.startswith("neg"):
        return "negative"
    return "neutral"


class RoBERTaAdapter(ModelAdapter):
    """
    Adapter dla modeli anglojęzycznych (domyślny, zachowuje obecne zachowanie):
      - sentyment : cardiffnlp/twitter-roberta-base-sentiment-latest
      - fake news : facebook/bart-large-mnli (zero-shot)
    """

    def __init__(self) -> None:
        self._sentiment_pipe = None
        self._fake_pipe = None

    def _load(self) -> None:
        if self._sentiment_pipe is None:
            self._sentiment_pipe = pipeline(
                "text-classification",
                model="cardiffnlp/twitter-roberta-base-sentiment-latest",
                return_all_scores=False,
            )
        if self._fake_pipe is None:
            self._fake_pipe = pipeline(
                "zero-shot-classification",
                model="facebook/bart-large-mnli",
            )

    @property
    def name(self) -> str:
        return "roberta"

    @property
    def supported_languages(self) -> List[str]:
        return ["en"]

    def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        self._load()
        result = self._sentiment_pipe(text)[0]
        return {
            "label": _normalize_sentiment_label(result.get("label", "")),
            "score": float(result.get("score", 0.0)),
        }

    def analyze_fake_news(self, text: str) -> Dict[str, Any]:
        self._load()
        result = self._fake_pipe(text, candidate_labels=["real", "fake"])
        return {"labels": result["labels"], "scores": result["scores"]}


class XLMRoBERTaAdapter(ModelAdapter):
    """
    Adapter wielojęzyczny (pl, en, no):
      - sentyment : cardiffnlp/twitter-xlm-roberta-base-sentiment
      - fake news : facebook/bart-large-mnli (zero-shot, transfer między językami)
    """

    def __init__(self) -> None:
        self._sentiment_pipe = None
        self._fake_pipe = None

    def _load(self) -> None:
        if self._sentiment_pipe is None:
            self._sentiment_pipe = pipeline(
                "text-classification",
                model="cardiffnlp/twitter-xlm-roberta-base-sentiment",
                return_all_scores=False,
            )
        if self._fake_pipe is None:
            self._fake_pipe = pipeline(
                "zero-shot-classification",
                model="facebook/bart-large-mnli",
            )

    @property
    def name(self) -> str:
        return "xlm-roberta"

    @property
    def supported_languages(self) -> List[str]:
        return ["pl", "en", "no"]

    def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        self._load()
        result = self._sentiment_pipe(text)[0]
        return {
            "label": _normalize_sentiment_label(result.get("label", "")),
            "score": float(result.get("score", 0.0)),
        }

    def analyze_fake_news(self, text: str) -> Dict[str, Any]:
        self._load()
        result = self._fake_pipe(text, candidate_labels=["real", "fake"])
        return {"labels": result["labels"], "scores": result["scores"]}


class HerBERTAdapter(ModelAdapter):
    """
    Adapter dla języka polskiego (HerBERT):
      - sentyment : allegro/herbert-base-cased
        UWAGA: to model bazowy – wymaga fine-tuningu na zbiorze sentymentu
        (np. PolEmo 2.0). Aby podmienić checkpoint, przekaż sentiment_model
        w konstruktorze lub zmień SENTIMENT_MODEL przed pierwszym użyciem.
      - fake news : facebook/bart-large-mnli (zero-shot, transfer EN→PL)
    """

    SENTIMENT_MODEL: str = "allegro/herbert-base-cased"

    def __init__(self, sentiment_model: Optional[str] = None) -> None:
        self._sentiment_model_id = sentiment_model or self.SENTIMENT_MODEL
        self._sentiment_pipe = None
        self._fake_pipe = None

    def _load(self) -> None:
        if self._sentiment_pipe is None:
            self._sentiment_pipe = pipeline(
                "text-classification",
                model=self._sentiment_model_id,
                return_all_scores=False,
            )
        if self._fake_pipe is None:
            self._fake_pipe = pipeline(
                "zero-shot-classification",
                model="facebook/bart-large-mnli",
            )

    @property
    def name(self) -> str:
        return "herbert"

    @property
    def supported_languages(self) -> List[str]:
        return ["pl"]

    def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        self._load()
        result = self._sentiment_pipe(text)[0]
        return {
            "label": _normalize_sentiment_label(result.get("label", "")),
            "score": float(result.get("score", 0.0)),
        }

    def analyze_fake_news(self, text: str) -> Dict[str, Any]:
        self._load()
        result = self._fake_pipe(text, candidate_labels=["real", "fake"])
        return {"labels": result["labels"], "scores": result["scores"]}


class NorBERTAdapter(ModelAdapter):
    """
    Adapter dla języka norweskiego (NorBERT 3):
      - sentyment : ltgoslo/norbert3-base
        UWAGA: to model bazowy – wymaga fine-tuningu na zbiorze sentymentu
        (np. NoReC). Aby podmienić checkpoint, przekaż sentiment_model
        w konstruktorze lub zmień SENTIMENT_MODEL przed pierwszym użyciem.
      - fake news : facebook/bart-large-mnli (zero-shot, transfer EN→NO)
    """

    SENTIMENT_MODEL: str = "ltgoslo/norbert3-base"

    def __init__(self, sentiment_model: Optional[str] = None) -> None:
        self._sentiment_model_id = sentiment_model or self.SENTIMENT_MODEL
        self._sentiment_pipe = None
        self._fake_pipe = None

    def _load(self) -> None:
        if self._sentiment_pipe is None:
            self._sentiment_pipe = pipeline(
                "text-classification",
                model=self._sentiment_model_id,
                return_all_scores=False,
            )
        if self._fake_pipe is None:
            self._fake_pipe = pipeline(
                "zero-shot-classification",
                model="facebook/bart-large-mnli",
            )

    @property
    def name(self) -> str:
        return "norbert"

    @property
    def supported_languages(self) -> List[str]:
        return ["no"]

    def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        self._load()
        result = self._sentiment_pipe(text)[0]
        return {
            "label": _normalize_sentiment_label(result.get("label", "")),
            "score": float(result.get("score", 0.0)),
        }

    def analyze_fake_news(self, text: str) -> Dict[str, Any]:
        self._load()
        result = self._fake_pipe(text, candidate_labels=["real", "fake"])
        return {"labels": result["labels"], "scores": result["scores"]}


# ---------------------------------------------------------------------------
# Rejestr adapterów — lazy initialization
# ---------------------------------------------------------------------------

# Przy imporcie pusty — żaden adapter nie jest tworzony ani ładowany.
# Adaptery są instancjonowane dopiero przy pierwszym wywołaniu get_adapter().
_REGISTRY: Dict[str, ModelAdapter] = {}

# Adapter aktywny globalnie; None oznacza „jeszcze nie wybrano".
_active_adapter: Optional[ModelAdapter] = None

# Executor do równoległej analizy (ograniczenie obciążenia CPU)
executor = ThreadPoolExecutor(max_workers=3)

# Zbiór nazw wbudowanych adapterów — służy do walidacji przed inicjalizacją
_BUILTIN_ADAPTERS = {"roberta", "xlm-roberta", "herbert", "norbert"}


def _init_registry() -> None:
    """
    Tworzy wbudowane adaptery i wpisuje je do rejestru.

    Wywoływana leniwie przy pierwszym get_adapter() lub set_active_adapter().
    Kolejne wywołania są bezoperacyjne (idempotentna).
    """
    if _REGISTRY:
        return
    _REGISTRY["roberta"]     = RoBERTaAdapter()
    _REGISTRY["xlm-roberta"] = XLMRoBERTaAdapter()
    _REGISTRY["herbert"]     = HerBERTAdapter()
    _REGISTRY["norbert"]     = NorBERTAdapter()


def get_adapter(name: str) -> ModelAdapter:
    """
    Zwraca adapter o podanej nazwie.

    Przy pierwszym wywołaniu inicjalizuje rejestr (bez ładowania wag modeli).
    Rzuca ValueError dla nieznanej nazwy.
    """
    _init_registry()
    if name not in _REGISTRY:
        raise ValueError(
            f"Nieznany adapter: '{name}'. Dostępne: {list(_REGISTRY.keys())}"
        )
    return _REGISTRY[name]


def set_active_adapter(name: str) -> None:
    """
    Ustawia aktywny adapter dla całej aplikacji.

    Przykład:
        from app.nlp_service import set_active_adapter
        set_active_adapter("xlm-roberta")
    """
    global _active_adapter
    _active_adapter = get_adapter(name)


def register_adapter(adapter: ModelAdapter) -> None:
    """
    Rejestruje nowy adapter (np. fine-tuned checkpoint) pod jego nazwą.
    Może być wywołane przed lub po _init_registry().

    Przykład:
        norbert_ft = NorBERTAdapter(sentiment_model="user/norbert3-norec")
        register_adapter(norbert_ft)
        set_active_adapter("norbert")
    """
    _init_registry()
    _REGISTRY[adapter.name] = adapter


def _get_active_adapter() -> ModelAdapter:
    """
    Zwraca aktualnie aktywny adapter.
    Jeśli nie ustawiono, domyślnie inicjalizuje i zwraca RoBERTaAdapter.
    """
    global _active_adapter
    if _active_adapter is None:
        _active_adapter = get_adapter("roberta")
    return _active_adapter


# ---------------------------------------------------------------------------
# Publiczne API – interfejs niezmieniony względem poprzedniej wersji
# ---------------------------------------------------------------------------

def analyze_news(
    text: str,
    lang: str = "pl",
    adapter: Optional[ModelAdapter] = None,
) -> dict:
    """
    Analizuje pojedynczy tekst pod kątem sentymentu i fake news.

    Args:
        text:    Tekst do analizy.
        lang:    Kod języka wynikowych etykiet ('pl' | 'en' | 'no').
        adapter: Opcjonalny adapter; jeśli None, używa _active_adapter.

    Returns:
        {"sentiment": str, "fake_probability": float, "sentiment_score": float}
    """
    _neutral = SENTIMENT_MAP["neutral"].get(lang, "Neutral")

    if not text or len(text.strip()) < 10:
        return {"sentiment": _neutral, "fake_probability": 0.0, "sentiment_score": 0.0}

    _adapter = adapter or _get_active_adapter()

    try:
        sentiment_result = _adapter.analyze_sentiment(text)
        fake_result = _adapter.analyze_fake_news(text)
    except Exception:
        return {"sentiment": _neutral, "fake_probability": 0.0, "sentiment_score": 0.0}

    label = sentiment_result.get("label", "neutral")
    sentiment_translated = SENTIMENT_MAP.get(label, {}).get(lang, _neutral)

    fake_score = 0.0
    for lbl, score in zip(fake_result["labels"], fake_result["scores"]):
        if lbl == "fake":
            fake_score = score
            break

    return {
        "sentiment": sentiment_translated,
        "fake_probability": round(fake_score * 100, 2),
        "sentiment_score": round(float(sentiment_result.get("score", 0.0)), 2),
    }


def analyze_news_batch(
    texts: List[str],
    lang: str = "pl",
    adapter: Optional[ModelAdapter] = None,
) -> List[Dict[str, Any]]:
    """
    Analiza wielu tekstów w trybie batch z użyciem ThreadPoolExecutor.

    Args:
        texts:   Lista tekstów do analizy.
        lang:    Kod języka wynikowych etykiet.
        adapter: Opcjonalny adapter; jeśli None, używa _active_adapter.
    """
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
