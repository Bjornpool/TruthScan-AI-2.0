"""
Modele danych wykorzystywane do walidacji i serializacji artykułów.
"""

from pydantic import BaseModel


class Article(BaseModel):
    # Model artykułu wykorzystywany w komunikacji API
    title: str
    link: str
    summary: str
    published: str
    sentiment: str
    fake_probability: float
    source: str
