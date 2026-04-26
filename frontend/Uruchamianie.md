ThruScan AI - Instrukcja uruchomienia

 Wymagania wstępne
- Windows 10+
- Node.js 18+ 
- Python 3.9+

Backend
- py -3.11 -m pip install –opgrade pip
- py -3.11 -m pip install -r requirements.txt

Uruchomienie aplikacji w wierszu polecenia (przykładowa ścieżka) D:\>Studia\Semestr 7\PRACA DYPLOMOWA\TruthScan AI\TruthScan AI_backend
python -m uvicorn app.main:app 

Test API w przeglądarce lub w programie Postman:
http://127.0.0.1:8000/news/BBC
http://127.0.0.1:8000/sources - zwraca słownik wszystkich źródeł RSS
http://127.0.0.1:8000/news/BBC - pobiera 5 najnowszych artykułów
http://127.0.0.1:8000/emotion-stats/BBC - oblicza rozkład sentymentu
http://127.0.0.1:8000/stream-news/bbc - strumieniuje artykuły w czasie rzeczywistym (Server-Sent Events)

Testowanie endpointów w Swagger (OpenAPI) dla backendu
http://localhost:8000/docs

Frontend
- npm install

Uruchomienie aplikacji w wierszu polecenia (przykładowa ścieżka) D:\>Studia\Semestr 7\PRACA DYPLOMOWA\TruthScan AI\TruthScan AI_frontend
npm run dev
http://localhost:3000
