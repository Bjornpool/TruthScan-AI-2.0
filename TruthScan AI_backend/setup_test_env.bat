@echo off
echo ========================================
echo 🛠  Przygotowanie środowiska testowego
echo ========================================

echo.
echo 📦 Instalowanie wymaganych bibliotek...
pip install requests pandas

echo.
echo 🔍 Sprawdzanie czy backend działa...
timeout /t 3 /nobreak > nul

echo.
echo 🚀 Uruchamianie testów...
python test_truthscan.py

echo.
echo 📊 Testy zakończone!
echo Otwórz raport: truthscan_test_report.html
pause