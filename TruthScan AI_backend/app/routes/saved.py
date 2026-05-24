"""
Endpointy związane z zapisywaniem i zarządzaniem zapisanymi artykułami.
"""

from fastapi import APIRouter, HTTPException, Request

from ..storage import read_all, append_article, delete_by_title
from ..models import Article

router = APIRouter()


@router.get("/saved-articles")
def get_saved_articles():
    # Zwraca listę wszystkich zapisanych artykułów
    return read_all()


@router.post("/save-article")
def save_article(article: Article):
    # Zapisuje nowy artykuł do magazynu danych
    return append_article(article.dict())


@router.delete("/delete-article")
async def delete_article(request: Request):
    # Usuwa artykuł na podstawie tytułu przekazanego w body requestu
    data = await request.json()
    title = data.get("title")

    if not title:
        raise HTTPException(status_code=400, detail="Brak pola 'title'")

    return delete_by_title(title)
