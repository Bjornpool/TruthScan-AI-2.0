"""
Skrypt diagnostyczny — testuje każdy adapter NLP osobno.
Uruchom z katalogu TruthScan AI_backend/:
    python debug_adapters.py

Wyświetla surowy output pipeline dla każdego modelu,
żeby zidentyfikować dlaczego sentiment_score = 0.0.
"""

import sys
import traceback
from transformers import pipeline

# Teksty testowe dla każdego języka
TEXTS = {
    "en": "The government announced a major economic recovery plan with strong results.",
    "pl": "Rząd ogłosił poważny plan odbudowy gospodarczej z dobrymi wynikami.",
    "no": "Regjeringen kunngjorde en stor plan for økonomisk gjenoppretting med gode resultater.",
}

ADAPTERS = [
    {
        "name": "roberta",
        "model": "cardiffnlp/twitter-roberta-base-sentiment-latest",
        "lang": "en",
    },
    {
        "name": "xlm-roberta",
        "model": "cardiffnlp/twitter-xlm-roberta-base-sentiment",
        "lang": "pl",
    },
    {
        "name": "herbert",
        "model": "allegro/herbert-base-cased",
        "lang": "pl",
    },
    {
        "name": "norbert",
        "model": "cardiffnlp/twitter-xlm-roberta-base-sentiment-multilingual",
        "lang": "no",
    },
]


def test_adapter(cfg: dict):
    name = cfg["name"]
    model_id = cfg["model"]
    lang = cfg["lang"]
    text = TEXTS[lang]

    print(f"\n{'='*60}")
    print(f"  Adapter : {name}")
    print(f"  Model   : {model_id}")
    print(f"  Język   : {lang}")
    print(f"  Tekst   : {text[:80]}...")
    print(f"{'='*60}")

    trust = cfg.get("trust_remote_code", False)

    # --- return_all_scores=False (domyślne użycie) ---
    print("\n[1] pipeline z return_all_scores=False:")
    try:
        pipe = pipeline("text-classification", model=model_id,
                        return_all_scores=False, trust_remote_code=trust)
        raw = pipe(text)
        print(f"    raw output       = {raw}")
        print(f"    type(raw)        = {type(raw)}")
        print(f"    type(raw[0])     = {type(raw[0])}")
        item = raw[0] if isinstance(raw[0], dict) else raw[0][0]
        print(f"    item (używany)   = {item}")
        print(f"    item.get('score')= {item.get('score')}")
        print(f"    item.get('label')= {item.get('label')}")
    except Exception:
        print(f"    BŁĄD:")
        traceback.print_exc()

    # --- return_all_scores=True (porównanie) ---
    print("\n[2] pipeline z return_all_scores=True:")
    try:
        pipe2 = pipeline("text-classification", model=model_id,
                         return_all_scores=True, trust_remote_code=trust)
        raw2 = pipe2(text)
        print(f"    raw output = {raw2}")
    except Exception:
        print(f"    BŁĄD:")
        traceback.print_exc()

    # --- top_k=None (nowy API, odpowiednik return_all_scores=True) ---
    print("\n[3] pipeline z top_k=None:")
    try:
        pipe3 = pipeline("text-classification", model=model_id, top_k=None)
        raw3 = pipe3(text)
        print(f"    raw output = {raw3}")
    except Exception:
        print(f"    BŁĄD:")
        traceback.print_exc()


if __name__ == "__main__":
    # Możesz uruchomić konkretny adapter: python debug_adapters.py xlm-roberta
    target = sys.argv[1] if len(sys.argv) > 1 else None

    for cfg in ADAPTERS:
        if target and cfg["name"] != target:
            continue
        test_adapter(cfg)

    print(f"\n{'='*60}")
    print("  Gotowe.")
    print(f"{'='*60}\n")
