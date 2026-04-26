"""
Warstwa dostępu do danych dla zapisanych artykułów (plik JSON).
"""

import json
import threading
from fastapi import HTTPException

from .config import SAVED_FILE

# Blokada wątków dla operacji zapisu/odczytu
_lock = threading.Lock()


def ensure_file():
    # Tworzy plik danych, jeśli nie istnieje
    if not SAVED_FILE.exists():
        SAVED_FILE.write_text("[]", encoding="utf-8")


def read_all():
    # Zwraca wszystkie zapisane artykuły
    ensure_file()
    try:
        return json.loads(SAVED_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def append_article(article: dict):
    # Dodaje nowy artykuł do pliku JSON
    ensure_file()
    try:
        with _lock, open(SAVED_FILE, "r+", encoding="utf-8") as f:
            data = json.load(f)
            data.append(article)
            f.seek(0)
            json.dump(data, f, ensure_ascii=False, indent=4)

        return {"message": "Artykuł zapisany pomyślnie."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def delete_by_title(title: str):
    # Usuwa artykuł na podstawie tytułu
    ensure_file()
    try:
        with _lock, open(SAVED_FILE, "r+", encoding="utf-8") as f:
            saved = json.load(f)
            new_saved = [
                a for a in saved if a.get("title") != title
            ]
            f.seek(0)
            f.truncate()
            json.dump(new_saved, f, ensure_ascii=False, indent=4)

        return {"message": "Artykuł usunięty."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
