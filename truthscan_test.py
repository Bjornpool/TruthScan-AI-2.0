"""
SKRYPT TESTOWY TRUTHSCAN AI - TEST PORÓWNAWCZY NYTimes I POLSAT NEWS
"""

import requests
import json
import time
import statistics
import os
import csv
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Any, Optional

EXPECTED_ADAPTERS = ["roberta", "xlm-roberta", "norbert", "herbert"]

BASE_URL = os.getenv("BACKEND_URL", "https://bjornpool-truthscan-ai-backend.hf.space")


class TruthScanComparativeTester:
    def __init__(self, base_url="http://localhost:8000", frontend_url="http://localhost:3000"):
        self.base_url = base_url
        self.frontend_url = frontend_url
        self.results = []
        self.errors = []
        self.performance_data = []
        self.nytimes_results = {}
        self.polsat_results = {}
        self.comparison_data = {}
        self.benchmark_data = []        # warm run (główny)
        self.benchmark_cold = []        # cold start
        self.benchmark_warm = []        # warm run (po rozgrzaniu)

    def log_test(self, test_name: str, status: str, details: str = "", duration: float = None):
        result = {
            "test_name": test_name,
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "details": details,
            "duration": duration
        }
        self.results.append(result)
        status_symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
        print(f"{status_symbol} {test_name}: {details}")
        if status == "FAIL":
            self.errors.append(result)

##########
# Test dostępności API
##########

    def test_api_availability(self):
        test_name = "API Availability"
        start = time.time()
        try:
            response = requests.get(f"{self.base_url}/docs", timeout=10)
            duration = time.time() - start
            if response.status_code == 200:
                self.log_test(test_name, "PASS",
                              f"Swagger UI dostępny ({response.status_code})", duration)
                return True
            else:
                self.log_test(test_name, "FAIL",
                              f"Status code: {response.status_code}", duration)
                return False
        except Exception as e:
            self.log_test(test_name, "FAIL", f"Błąd połączenia: {str(e)}", time.time() - start)
            return False

############
# Test: Sprawdzenie dostępnych źródeł
############

    def test_sources_endpoint(self):
        test_name = "GET /sources"
        start = time.time()
        try:
            response = requests.get(f"{self.base_url}/sources", timeout=15)
            duration = time.time() - start
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    details = f"Znaleziono {len(data)} źródeł"
                    sources_lower = [s.lower() for s in data]
                    nytimes_available = any("nytimes" in s for s in sources_lower)
                    polsat_available = any("polsat" in s for s in sources_lower)
                    if not nytimes_available:
                        details += " | ❌ NYTimes niedostępne"
                        status = "WARNING"
                    elif not polsat_available:
                        details += " | ❌ Polsat News niedostępne"
                        status = "WARNING"
                    else:
                        details += " | ✅ NYTimes dostępne | ✅ Polsat News dostępne"
                        status = "PASS"
                    self.log_test(test_name, status, details, duration)
                    return data
                else:
                    self.log_test(test_name, "FAIL", f"Nieoczekiwany typ danych: {type(data)}", duration)
                    return None
            else:
                self.log_test(test_name, "FAIL", f"Status code: {response.status_code}", duration)
                return None
        except Exception as e:
            self.log_test(test_name, "FAIL", f"Błąd: {str(e)}", time.time() - start)
            return None

    def test_single_source_detailed(self, source: str, source_name: str):
        print(f"\n{'='*60}")
        print(f"🔍 SZCZEGÓŁOWY TEST: {source_name} ({source})")
        print(f"{'='*60}")

        test_results = {
            "source": source,
            "source_name": source_name,
            "articles": [],
            "sentiment_distribution": defaultdict(int),
            "fake_scores": [],
            "performance": 0,
            "errors": [],
            "sample_titles": []
        }

#### Test 1: Pobieranie artykułów
        test_name = f"GET /news/{source}"
        start = time.time()
        try:
            response = requests.get(f"{self.base_url}/news/{source}", timeout=30)
            duration = time.time() - start
            test_results["performance"] = duration

            if response.status_code != 200:
                self.log_test(test_name, "FAIL", f"Status code: {response.status_code}", duration)
                test_results["errors"].append(f"HTTP {response.status_code}")
                return test_results

            data = response.json()
            if not data:
                self.log_test(test_name, "FAIL", "Brak danych w odpowiedzi", duration)
                return test_results

            if isinstance(data, dict) and "articles" in data:
                articles = data["articles"]
                source_from_response = data.get("source", source)
                test_results["articles"] = articles

                details = f"Pobrano {len(articles)} artykułów | Źródło: {source_from_response}"

                if len(articles) > 0:
                    first_article = articles[0]
                    available_fields = [f for f in ["title", "sentiment", "fake_probability", "summary", "link", "published"]
                                        if f in first_article]
                    details += f" | Pola: {', '.join(available_fields)}"
                    title = first_article.get("title", "Brak tytułu")
                    if len(title) > 50:
                        title = title[:50] + "..."
                    details += f" | Przykład: '{title}'"
                    for article in articles[:3]:
                        t = article.get("title", "")
                        if t:
                            test_results["sample_titles"].append(t[:80])

                self.log_test(test_name, "PASS", details, duration)
                self.performance_data.append({"endpoint": test_name, "duration": duration, "source": source})
            else:
                self.log_test(test_name, "WARNING", f"Nieoczekiwany format danych: {type(data)}", duration)
                return test_results

        except Exception as e:
            self.log_test(test_name, "FAIL", f"Błąd: {str(e)}", time.time() - start)
            test_results["errors"].append(str(e))
            return test_results

#### Test 2: Szczegółowa analiza NLP dla każdego artykułu
        if test_results["articles"]:
            print(f"\n📊 ANALIZA NLP DLA {source_name}:")
            for i, article in enumerate(test_results["articles"][:5]):
                print(f"\n  📄 Artykuł {i+1}:")
                title = article.get("title", "Brak tytułu")
                title_display = title[:60] + "..." if len(title) > 60 else title
                print(f"     Tytuł: {title_display}")

                sentiment = article.get("sentiment", "Nieznany")
                sentiment_score = article.get("sentiment_score", 0)
                print(f"     Sentyment: {sentiment} ({sentiment_score:.2f})")

                fake_prob = article.get("fake_probability", 0)
                if isinstance(fake_prob, (int, float)):
                    print(f"     Fake probability: {fake_prob}%")
                    risk = "NISKIE" if fake_prob < 15 else "ŚREDNIE" if fake_prob < 30 else "WYSOKIE"
                    print(f"     Ryzyko dezinformacji: {risk}")
                    test_results["fake_scores"].append(fake_prob)

                test_results["sentiment_distribution"][sentiment] += 1

                link = article.get("link", "")
                if link:
                    domain = link.split('/')[2] if len(link.split('/')) > 2 else link
                    print(f"     Źródło: {domain}")
                print(f"     Data publikacji: {article.get('published', 'Brak daty')}")

#### Test 3: Analiza statystyczna
        if test_results["fake_scores"]:
            avg_fake = statistics.mean(test_results["fake_scores"])
            min_fake = min(test_results["fake_scores"])
            max_fake = max(test_results["fake_scores"])
            print(f"\n  📈 STATYSTYKI {source_name}:")
            print(f"     Średnie fake_probability: {avg_fake:.2f}%")
            print(f"     Zakres: {min_fake:.2f}% - {max_fake:.2f}%")
            print(f"     Czas odpowiedzi: {test_results['performance']:.2f}s")
            if test_results["sentiment_distribution"]:
                print(f"     Rozkład sentymentu:")
                for sentiment, count in test_results["sentiment_distribution"].items():
                    pct = (count / len(test_results["articles"])) * 100
                    print(f"       {sentiment}: {count} ({pct:.1f}%)")

        return test_results

###########
# Porównanie wyników NYTimes i Gazety Prawnej
###########

    def compare_sources(self, nytimes_data: Dict, polsat_data: Dict):
        print(f"\n{'='*60}")
        print(f"🔄 PORÓWNANIE NYTimes vs POLSAT NEWS")
        print(f"{'='*60}")

        nytimes_fake_scores = nytimes_data.get("fake_scores", [])
        polsat_fake_scores = polsat_data.get("fake_scores", [])

        nytimes_avg_fake = statistics.mean(nytimes_fake_scores) if nytimes_fake_scores else 0
        polsat_avg_fake = statistics.mean(polsat_fake_scores) if polsat_fake_scores else 0

        comparison = {
            "source_count": {
                "NYTimes": len(nytimes_data.get("articles", [])),
                "Polsat News": len(polsat_data.get("articles", []))
            },
            "avg_fake_score": {
                "NYTimes": nytimes_avg_fake,
                "Polsat News": polsat_avg_fake
            },
            "sentiment_distribution": {
                "NYTimes": dict(nytimes_data.get("sentiment_distribution", {})),
                "Polsat News": dict(polsat_data.get("sentiment_distribution", {}))
            },
            "performance": {
                "NYTimes": nytimes_data.get("performance", 0),
                "Polsat News": polsat_data.get("performance", 0)
            },
            "sample_titles": {
                "NYTimes": nytimes_data.get("sample_titles", []),
                "Polsat News": polsat_data.get("sample_titles", [])
            }
        }

        print(f"\n📊 LICZBA ARTYKUŁÓW:")
        print(f"   NYTimes: {comparison['source_count']['NYTimes']}")
        print(f"   Polsat News: {comparison['source_count']['Polsat News']}")

        print(f"\n📊 ŚREDNIE RYZYKO DEZINFORMACJI:")
        print(f"   NYTimes: {comparison['avg_fake_score']['NYTimes']:.2f}%")
        print(f"   Polsat News: {comparison['avg_fake_score']['Polsat News']:.2f}%")

        if comparison['avg_fake_score']['NYTimes'] > 0 and comparison['avg_fake_score']['Polsat News'] > 0:
            fake_diff = abs(comparison['avg_fake_score']['NYTimes'] - comparison['avg_fake_score']['Polsat News'])
            print(f"   Różnica: {fake_diff:.2f}%")
            if fake_diff > 10:
                print(f"   ⚠️ Znacząca różnica w ryzyku dezinformacji")

        print(f"\n📊 ROZKŁAD SENTYMENTU:")
        for source in ["NYTimes", "Polsat News"]:
            print(f"\n   {source}:")
            dist = comparison['sentiment_distribution'][source]
            total = sum(dist.values()) if dist else 1
            if dist:
                for sentiment, count in dist.items():
                    pct = (count / total) * 100 if total > 0 else 0
                    print(f"     {sentiment}: {count} ({pct:.1f}%)")
            else:
                print("     Brak danych o sentymencie")

        print(f"\n📊 WYDAJNOŚĆ:")
        print(f"   NYTimes: {comparison['performance']['NYTimes']:.2f}s")
        print(f"   Polsat News: {comparison['performance']['Polsat News']:.2f}s")

        if comparison['performance']['NYTimes'] > 0 and comparison['performance']['Polsat News'] > 0:
            perf_diff = comparison['performance']['Polsat News'] - comparison['performance']['NYTimes']
            if perf_diff > 1:
                print(f"   ⏱️ Polsat News wolniejsza o {perf_diff:.2f}s (język polski)")
            elif perf_diff < -1:
                print(f"   ⏱️ NYTimes wolniejsze o {abs(perf_diff):.2f}s")
            else:
                print(f"   ⚡ Porównywalna wydajność")

        details = (f"NYTimes: {comparison['source_count']['NYTimes']} art, "
                   f"{comparison['avg_fake_score']['NYTimes']:.1f}% fake, "
                   f"{comparison['performance']['NYTimes']:.1f}s | "
                   f"Polsat: {comparison['source_count']['Polsat News']} art, "
                   f"{comparison['avg_fake_score']['Polsat News']:.1f}% fake, "
                   f"{comparison['performance']['Polsat News']:.1f}s")

        self.log_test("Source Comparison", "PASS", details)
        self.comparison_data = comparison
        return comparison

####################
# Test benchmarku modeli NLP — cold start + warm run
####################

    def _call_benchmark_once(self, run_label: str) -> Optional[List[Dict]]:
        """
        Jedno wywołanie GET /benchmark. Zwraca listę wyników lub None przy błędzie.
        run_label: "cold" | "warm" — używany wyłącznie do logów i CSV.
        """
        start = time.time()
        try:
            response = requests.get(f"{self.base_url}/benchmark", timeout=360)
            duration = time.time() - start

            if response.status_code != 200:
                print(f"  ❌ [{run_label}] HTTP {response.status_code} ({duration:.2f}s)")
                return None

            data = response.json()
            if "results" not in data:
                print(f"  ❌ [{run_label}] Brak klucza 'results' w odpowiedzi ({duration:.2f}s)")
                return None

            results = data["results"]
            # Oznacz każdy rekord etykietą run
            for r in results:
                r["_run"] = run_label
                r["_total_request_time_ms"] = round(duration * 1000, 1)

            ok_adapters = {r["adapter_name"] for r in results if "error" not in r}
            print(f"  ✅ [{run_label}] {len(results)} rekordów | "
                  f"adaptery: {sorted(ok_adapters)} | czas req: {duration:.2f}s")
            return results

        except Exception as e:
            elapsed = time.time() - start
            print(f"  ❌ [{run_label}] Wyjątek: {e} ({elapsed:.2f}s)")
            return None

    def _print_benchmark_results(self, results: List[Dict], label: str):
        """Wypisz per adapter × język."""
        by_adapter: Dict[str, List] = {}
        for r in results:
            by_adapter.setdefault(r["adapter_name"], []).append(r)

        print(f"\n{'='*60}")
        print(f"🤖 BENCHMARK [{label.upper()}] — {len(results)} rekordów")
        print(f"{'='*60}")

        for adapter_name in EXPECTED_ADAPTERS:
            if adapter_name not in by_adapter:
                print(f"\n  [{adapter_name}] BRAK WYNIKÓW")
                continue
            print(f"\n  [{adapter_name}]")
            for r in by_adapter[adapter_name]:
                if "error" in r:
                    print(f"    lang={r.get('language', '?')} → BŁĄD: {r['error']}")
                    continue
                lang = r.get("language", "?")
                avg_t = r.get("avg_inference_time_ms") or 0
                avg_f = r.get("avg_fake_probability", "-")
                sentiments = r.get("sentiments_distribution", {})
                ok = r.get("successful_runs", 0)
                total = r.get("sample_size", 0)
                req_t = r.get("_total_request_time_ms", "-")
                print(f"    lang={lang} | inferencja={avg_t:.1f}ms | "
                      f"req={req_t}ms | fake={avg_f}% | "
                      f"sentymenty={sentiments} | ok={ok}/{total}")

    def test_benchmark_endpoint(self):
        """
        Dwuetapowy benchmark:
          1. Cold start  — pierwsze wywołanie (modele mogą się ładować)
          2. Warm run    — drugie wywołanie po 5 s (modele w pamięci)
        Wyniki obu runów trafiają do self.benchmark_cold / self.benchmark_warm.
        self.benchmark_data = warm run (używany przez raporty HTML/TXT/CSV).
        """
        WARM_DELAY_S = 5   # sekund przerwy między cold a warm

        print(f"\n{'='*60}")
        print(f"🤖 BENCHMARK MODELI NLP: cold start + warm run")
        print(f"{'='*60}")

        # --- Cold start ---
        print(f"\n🥶 Cold start (może potrwać do 120s przy lazy-load modeli)...")
        cold_start = time.time()
        cold_results = self._call_benchmark_once("cold")
        cold_total = time.time() - cold_start

        if cold_results:
            self.benchmark_cold = cold_results
            self._print_benchmark_results(cold_results, "cold")
        else:
            self.log_test("GET /benchmark [cold]", "FAIL",
                          "Brak odpowiedzi na cold start", cold_total)

        # --- Przerwa ---
        print(f"\n⏳ Oczekiwanie {WARM_DELAY_S}s przed warm run...")
        time.sleep(WARM_DELAY_S)

        # --- Warm run ---
        print(f"\n🔥 Warm run (modele powinny być w pamięci)...")
        warm_start = time.time()
        warm_results = self._call_benchmark_once("warm")
        warm_total = time.time() - warm_start

        if warm_results:
            self.benchmark_warm = warm_results
            self.benchmark_data = warm_results   # używane w raportach
            self._print_benchmark_results(warm_results, "warm")
        else:
            self.log_test("GET /benchmark [warm]", "FAIL",
                          "Brak odpowiedzi na warm run", warm_total)

        # --- Porównanie cold vs warm ---
        if cold_results and warm_results:
            print(f"\n📊 COLD vs WARM — przyspieszenie per adapter:")
            cold_map: Dict[str, Dict] = {}
            for r in cold_results:
                if "error" not in r:
                    cold_map[(r["adapter_name"], r.get("language", "?"))] = r
            for r in warm_results:
                if "error" in r:
                    continue
                key = (r["adapter_name"], r.get("language", "?"))
                if key in cold_map:
                    c_t = cold_map[key].get("avg_inference_time_ms") or 0
                    w_t = r.get("avg_inference_time_ms") or 0
                    speedup = (c_t - w_t) / c_t * 100 if c_t > 0 else 0
                    arrow = "⬇️ " if speedup > 0 else "⬆️ "
                    print(f"  {key[0]} [{key[1]}]: cold={c_t:.1f}ms → warm={w_t:.1f}ms "
                          f"({arrow}{abs(speedup):.1f}%)")

        # --- Status ogólny ---
        all_results = (warm_results or cold_results or [])
        returned_adapters = {r["adapter_name"] for r in all_results if "error" not in r}
        missing = [a for a in EXPECTED_ADAPTERS if a not in returned_adapters]

        if missing:
            status = "WARNING"
            details = (f"Brakujące adaptery: {missing} | "
                       f"Dostępne: {sorted(returned_adapters)} | "
                       f"cold={cold_total:.1f}s warm={warm_total:.1f}s")
        else:
            status = "PASS"
            details = (f"Wszystkie 4 adaptery | cold={cold_total:.1f}s | warm={warm_total:.1f}s | "
                       f"rekordów warm: {len(warm_results or [])}")

        self.log_test("GET /benchmark [cold+warm]", status, details,
                      cold_total + WARM_DELAY_S + warm_total)
        self.performance_data.append({
            "endpoint": "GET /benchmark",
            "duration": warm_total,
            "source": "benchmark_warm"
        })
        self.performance_data.append({
            "endpoint": "GET /benchmark [cold]",
            "duration": cold_total,
            "source": "benchmark_cold"
        })

        # --- Eksport CSV ---
        self.export_benchmark_csv()

        return warm_results or cold_results

    def export_benchmark_csv(self, filename: str = "truthscan_benchmark.csv"):
        """
        Zapisuje wyniki cold + warm do CSV z kolumnami:
        run, adapter_name, language, avg_inference_time_ms,
        min_inference_time_ms, max_inference_time_ms,
        avg_fake_probability, sentiments_distribution,
        successful_runs, sample_size, total_request_time_ms, timestamp
        """
        rows = []
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        for run_label, dataset in [("cold", self.benchmark_cold),
                                    ("warm", self.benchmark_warm)]:
            for r in dataset:
                if "error" in r:
                    rows.append({
                        "run": run_label,
                        "adapter_name": r.get("adapter_name", "?"),
                        "language": r.get("language", "?"),
                        "avg_inference_time_ms": "",
                        "min_inference_time_ms": "",
                        "max_inference_time_ms": "",
                        "avg_fake_probability": "",
                        "sentiments_distribution": f"ERROR: {r['error']}",
                        "successful_runs": 0,
                        "sample_size": r.get("sample_size", 0),
                        "total_request_time_ms": r.get("_total_request_time_ms", ""),
                        "timestamp": ts,
                    })
                else:
                    sentiments_str = "; ".join(
                        f"{k}={v}"
                        for k, v in r.get("sentiments_distribution", {}).items()
                    )
                    rows.append({
                        "run": run_label,
                        "adapter_name": r.get("adapter_name", "?"),
                        "language": r.get("language", "?"),
                        "avg_inference_time_ms": r.get("avg_inference_time_ms", ""),
                        "min_inference_time_ms": r.get("min_inference_time_ms", ""),
                        "max_inference_time_ms": r.get("max_inference_time_ms", ""),
                        "avg_fake_probability": r.get("avg_fake_probability", ""),
                        "sentiments_distribution": sentiments_str,
                        "successful_runs": r.get("successful_runs", 0),
                        "sample_size": r.get("sample_size", 0),
                        "total_request_time_ms": r.get("_total_request_time_ms", ""),
                        "timestamp": ts,
                    })

        if not rows:
            print("⚠️  Brak danych benchmarku do eksportu CSV")
            return None

        fieldnames = [
            "run", "adapter_name", "language",
            "avg_inference_time_ms", "min_inference_time_ms", "max_inference_time_ms",
            "avg_fake_probability", "sentiments_distribution",
            "successful_runs", "sample_size", "total_request_time_ms", "timestamp"
        ]

        with open(filename, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        print(f"\n📊 CSV benchmarku zapisany: {filename} ({len(rows)} wierszy)")
        return filename

##################### Raport tekstowy ##########

    def generate_text_report(self, filename: str = "truthscan_report.txt"):
        total_tests = len(self.results)
        passed = sum(1 for r in self.results if r["status"] == "PASS")

        report = f"""
{'='*80}
RAPORT PORÓWNAWCZY TRUTHSCAN AI - NYTimes vs POLSAT NEWS
{'='*80}
Data wykonania: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Backend URL: {self.base_url}
Frontend URL: {self.frontend_url}
{'='*80}

PODSUMOWANIE TESTOW:
{'='*80}
Wszystkie testy: {total_tests}
Przepuszczone:   {passed}
Nieudane:        {sum(1 for r in self.results if r["status"] == "FAIL")}
Ostrzeżenia:     {sum(1 for r in self.results if r["status"] == "WARNING")}
Wskaźnik sukcesu: {passed/total_tests*100:.1f}%

{'='*80}
WYNIKI PORÓWNANIA:
{'='*80}
"""

        if self.comparison_data:
            report += f"""
NYTimes:
  • Artykułów: {self.comparison_data['source_count']['NYTimes']}
  • Średnie fake_probability: {self.comparison_data['avg_fake_score']['NYTimes']:.2f}%
  • Czas odpowiedzi: {self.comparison_data['performance']['NYTimes']:.2f}s
  • Rozkład sentymentu: {json.dumps(self.comparison_data['sentiment_distribution']['NYTimes'], ensure_ascii=False)}

Polsat News:
  • Artykułów: {self.comparison_data['source_count']['Polsat News']}
  • Średnie fake_probability: {self.comparison_data['avg_fake_score']['Polsat News']:.2f}%
  • Czas odpowiedzi: {self.comparison_data['performance']['Polsat News']:.2f}s
  • Rozkład sentymentu: {json.dumps(self.comparison_data['sentiment_distribution']['Polsat News'], ensure_ascii=False)}

ANALIZA RÓŻNIC:
  • Różnica w fake_probability: {abs(self.comparison_data['avg_fake_score']['NYTimes'] - self.comparison_data['avg_fake_score']['Polsat News']):.2f}%
  • Różnica w czasie odpowiedzi: {abs(self.comparison_data['performance']['NYTimes'] - self.comparison_data['performance']['Polsat News']):.2f}s
"""

        if self.benchmark_cold or self.benchmark_warm:
            report += f"\n{'='*80}\nBENCHMARK MODELI NLP (cold + warm):\n{'='*80}\n"
            for run_label, dataset in [("cold", self.benchmark_cold), ("warm", self.benchmark_warm)]:
                if not dataset:
                    continue
                report += f"\n  --- {run_label.upper()} RUN ---\n"
                by_adapter = {}
                for r in dataset:
                    by_adapter.setdefault(r["adapter_name"], []).append(r)
                for adapter_name in EXPECTED_ADAPTERS:
                    valid = [r for r in by_adapter.get(adapter_name, []) if "error" not in r]
                    if not valid:
                        report += f"\n  [{adapter_name}] BRAK WYNIKÓW\n"
                        continue
                    report += f"\n  [{adapter_name}]\n"
                    for r in valid:
                        report += (f"    lang={r.get('language','?')} | "
                                   f"czas={r.get('avg_inference_time_ms')}ms | "
                                   f"fake={r.get('avg_fake_probability')}% | "
                                   f"sentymenty={r.get('sentiments_distribution',{})} | "
                                   f"ok={r.get('successful_runs',0)}/{r.get('sample_size',0)}\n")

        report += f"\n{'='*80}\nWYNIKI SZCZEGÓŁOWE:\n{'='*80}\n"

        for result in self.results:
            status_icon = "✅" if result["status"] == "PASS" else "❌" if result["status"] == "FAIL" else "⚠️"
            duration = f"[{result['duration']:.2f}s]" if result["duration"] else ""
            report += f"{status_icon} {result['test_name']} {duration}\n"
            report += f"   {result['details']}\n"
            report += f"   Czas: {result['timestamp'][11:19]}\n\n"

        if self.nytimes_results.get("sample_titles") or self.polsat_results.get("sample_titles"):
            report += f"\n{'='*80}\nPRZYKŁADOWE ARTYKUŁY:\n{'='*80}\n"
            if self.nytimes_results.get("sample_titles"):
                report += "NYTimes:\n"
                for i, title in enumerate(self.nytimes_results["sample_titles"][:3]):
                    report += f"  {i+1}. {title}\n"
            if self.polsat_results.get("sample_titles"):
                report += "\nPolsat News:\n"
                for i, title in enumerate(self.polsat_results["sample_titles"][:3]):
                    report += f"  {i+1}. {title}\n"

        report += f"""
{'='*80}
WNIOSKI I REKOMENDACJE:
{'='*80}
1. System {'działa poprawnie' if passed > total_tests/2 else 'wymaga poprawy'}
2. Obsługa języka polskiego: {'SPRAWNIE' if self.polsat_results.get('articles') else 'PROBLEMY'}
3. Średni czas odpowiedzi: {statistics.mean([r['duration'] for r in self.results if r.get('duration')]):.2f}s
4. Główne problemy: {len(self.errors)} błędów
5. Gotowość do dalszych testów: {'TAK' if len(self.errors) < 3 else 'NIE'}

REKOMENDACJE:
1. {'Naprawić wykryte błędy' if self.errors else 'Wszystko działa poprawnie'}
2. Przeprowadzić testy manualne interfejsu
3. Przetestować więcej źródeł RSS
4. Sprawdzić działanie na różnych przeglądarkach
5. {'Wymagany fine-tuning modeli dla języka polskiego'
    if self.comparison_data and abs(self.comparison_data['avg_fake_score']['NYTimes'] - self.comparison_data['avg_fake_score']['Polsat News']) > 15
    else 'Modele działają spójnie dla obu języków'}
"""

        with open(filename, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f"📝 Raport tekstowy zapisany jako: {filename}")
        return report

    def generate_comparative_html_report(self, filename: str = "truthscan_report.html"):
        total_tests = len(self.results)
        passed = sum(1 for r in self.results if r["status"] == "PASS")

        # Dane do wykresów porównawczych NYTimes vs GP
        if self.comparison_data:
            sources = ["NYTimes", "Polsat News"]
            fake_scores = [
                self.comparison_data['avg_fake_score']['NYTimes'],
                self.comparison_data['avg_fake_score']['Polsat News']
            ]
            performance_times = [
                self.comparison_data['performance']['NYTimes'],
                self.comparison_data['performance']['Polsat News']
            ]
            nytimes_sentiments = self.comparison_data['sentiment_distribution']['NYTimes']
            polsat_sentiments = self.comparison_data['sentiment_distribution']['Polsat News']
            nytimes_sentiment_labels = list(nytimes_sentiments.keys()) if nytimes_sentiments else ['Neutralny', 'Pozytywny', 'Negatywny']
            nytimes_sentiment_values = list(nytimes_sentiments.values()) if nytimes_sentiments else [1, 1, 1]
            polsat_sentiment_labels = list(polsat_sentiments.keys()) if polsat_sentiments else ['Neutralny', 'Pozytywny', 'Negatywny']
            polsat_sentiment_values = list(polsat_sentiments.values()) if polsat_sentiments else [1, 1, 1]
        else:
            sources = ["NYTimes", "Polsat News"]
            fake_scores = [0, 0]
            performance_times = [0, 0]
            nytimes_sentiment_labels = ['Neutralny', 'Pozytywny', 'Negatywny']
            nytimes_sentiment_values = [1, 1, 1]
            polsat_sentiment_labels = ['Neutralny', 'Pozytywny', 'Negatywny']
            polsat_sentiment_values = [1, 1, 1]

        # Dane benchmarku: uśrednienie po językach dla każdego adaptera (warm run)
        by_adapter = {}
        for r in self.benchmark_data:   # warm run
            if "error" not in r:
                by_adapter.setdefault(r["adapter_name"], []).append(r)

        bm_avg_times = []
        bm_avg_fakes = []
        for adapter_name in EXPECTED_ADAPTERS:
            rows = by_adapter.get(adapter_name, [])
            times = [r["avg_inference_time_ms"] for r in rows if r.get("avg_inference_time_ms") is not None]
            fakes = [r["avg_fake_probability"] for r in rows if r.get("avg_fake_probability") is not None]
            bm_avg_times.append(round(sum(times) / len(times), 1) if times else 0)
            bm_avg_fakes.append(round(sum(fakes) / len(fakes), 1) if fakes else 0)

        # Wiersze tabeli benchmarku — cold + warm razem
        benchmark_rows_html = ""
        all_benchmark = self.benchmark_cold + self.benchmark_warm
        if all_benchmark:
            for r in all_benchmark:
                if "error" in r:
                    benchmark_rows_html += (
                        f'<tr><td><strong>{r["adapter_name"]}</strong></td>'
                        f'<td>-</td>'
                        f'<td colspan="6" class="fail">BŁĄD: {r.get("error", "")}</td></tr>'
                    )
                else:
                    sentiments_str = ", ".join(
                        f"{k}: {v}" for k, v in r.get("sentiments_distribution", {}).items()
                    )
                    avg_t = r.get("avg_inference_time_ms")
                    min_t = r.get("min_inference_time_ms")
                    max_t = r.get("max_inference_time_ms")
                    avg_f = r.get("avg_fake_probability")
                    run_label = r.get("_run", "")
                    benchmark_rows_html += (
                        f'<tr>'
                        f'<td><strong>{r["adapter_name"]}</strong></td>'
                        f'<td>{r.get("language", "-")}</td>'
                        f'<td>{f"{avg_t:.1f}" if avg_t is not None else "-"}</td>'
                        f'<td>{f"{min_t:.1f}" if min_t is not None else "-"}</td>'
                        f'<td>{f"{max_t:.1f}" if max_t is not None else "-"}</td>'
                        f'<td>{f"{avg_f:.1f}" if avg_f is not None else "-"}</td>'
                        f'<td>{sentiments_str}</td>'
                        f'<td>{r.get("successful_runs", 0)}/{r.get("sample_size", 0)}</td>'
                        f'<td style="color:#7f8c8d;font-size:0.85em">{run_label}</td>'
                        f'</tr>'
                    )
        else:
            benchmark_rows_html = (
                '<tr><td colspan="8" style="text-align:center;color:#7f8c8d;">'
                'Brak danych benchmarku</td></tr>'
            )

        html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Raport porównawczy TruthScan AI - NYTimes vs Polsat News</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {{
            font-family: 'Segoe UI', Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f0f2f5;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }}
        h1 {{
            color: #2c3e50;
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }}
        .header {{ text-align: center; margin-bottom: 30px; }}
        .test-date {{ color: #7f8c8d; font-size: 1em; margin-top: 5px; }}
        .comparison-section {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        .comparison-card {{
            background: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.08);
            border-left: 4px solid #3498db;
        }}
        .comparison-card h3 {{ color: #2c3e50; margin-top: 0; }}
        .chart-container {{ position: relative; height: 250px; margin: 15px 0; }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }}
        .stat-box {{ padding: 15px; border-radius: 6px; color: white; text-align: center; }}
        .nytimes-stat {{ background: linear-gradient(135deg, #e74c3c, #c0392b); }}
        .polsat-stat {{ background: linear-gradient(135deg, #27ae60, #229954); }}
        .source-details {{ background: #ecf0f1; padding: 15px; border-radius: 6px; margin: 20px 0; }}
        .benchmark-section {{ margin: 30px 0; }}
        .benchmark-section > h3 {{
            color: #2c3e50;
            border-bottom: 2px solid #9b59b6;
            padding-bottom: 8px;
        }}
        .results-table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
        .results-table th, .results-table td {{
            padding: 10px 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        .results-table th {{ background-color: #3498db; color: white; }}
        .results-table tr:hover {{ background-color: #f5f5f5; }}
        .pass {{ color: #27ae60; font-weight: bold; }}
        .fail {{ color: #e74c3c; font-weight: bold; }}
        .warn {{ color: #f39c12; font-weight: bold; }}
        .highlight {{
            background: #fff3cd;
            padding: 10px;
            border-radius: 5px;
            border-left: 4px solid #ffc107;
            margin: 15px 0;
        }}
        .conclusions {{
            background: #2c3e50;
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-top: 30px;
        }}
        .footer {{
            text-align: center;
            margin-top: 30px;
            color: #7f8c8d;
            font-size: 0.9em;
            border-top: 1px solid #ecf0f1;
            padding-top: 15px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 RAPORT PORÓWNAWCZY TRUTHSCAN AI</h1>
            <h2>NYTimes vs Polsat News - Analiza systemu detekcji dezinformacji</h2>
            <div class="test-date">Data testów: {datetime.now().strftime('%d.%m.%Y %H:%M:%S')}</div>
        </div>

        <div class="stats-grid">
            <div class="stat-box nytimes-stat">
                <h3>NYTimes</h3>
                <p>Artykułów: {self.comparison_data.get('source_count', {}).get('NYTimes', 0)}</p>
                <p>Fake: {fake_scores[0]:.1f}%</p>
                <p>Czas: {performance_times[0]:.2f}s</p>
            </div>
            <div class="stat-box polsat-stat">
                <h3>Polsat News</h3>
                <p>Artykułów: {self.comparison_data.get('source_count', {}).get('Polsat News', 0)}</p>
                <p>Fake: {fake_scores[1]:.1f}%</p>
                <p>Czas: {performance_times[1]:.2f}s</p>
            </div>
        </div>

        <div class="comparison-section">
            <div class="comparison-card">
                <h3>📈 Średnie ryzyko dezinformacji</h3>
                <div class="chart-container"><canvas id="fakeScoreChart"></canvas></div>
            </div>
            <div class="comparison-card">
                <h3>⚡ Wydajność systemu</h3>
                <div class="chart-container"><canvas id="performanceChart"></canvas></div>
            </div>
        </div>

        <div class="comparison-section">
            <div class="comparison-card">
                <h3>🎭 Rozkład sentymentu - NYTimes</h3>
                <div class="chart-container"><canvas id="nytimesSentimentChart"></canvas></div>
            </div>
            <div class="comparison-card">
                <h3>🎭 Rozkład sentymentu - Polsat News</h3>
                <div class="chart-container"><canvas id="polsatSentimentChart"></canvas></div>
            </div>
        </div>

        <div class="highlight">
            <h4>🔍 Kluczowe różnice NYTimes vs Polsat News:</h4>
            <p>• Różnica w ryzyku dezinformacji: <strong>{abs(fake_scores[0] - fake_scores[1]):.1f}%</strong></p>
            <p>• Różnica w czasie analizy: <strong>{abs(performance_times[0] - performance_times[1]):.2f}s</strong></p>
            {"<p style='color:#e74c3c;'>• ⚠️ Znacząca różnica w wykrywaniu dezinformacji między językami</p>"
             if abs(fake_scores[0] - fake_scores[1]) > 10 else
             "<p style='color:#27ae60;'>• ✅ Spójna skuteczność detekcji między językami</p>"}
        </div>

        <div class="source-details">
            <h4>📰 Przykładowe artykuły z analizą</h4>
            <h5>NYTimes:</h5>"""

        if self.nytimes_results.get("sample_titles"):
            for i, title in enumerate(self.nytimes_results["sample_titles"][:2]):
                html += f"<p><strong>{i+1}.</strong> {title}...</p>"
        else:
            html += "<p>Brak przykładowych artykułów</p>"

        html += "<h5>Polsat News:</h5>"

        if self.polsat_results.get("sample_titles"):
            for i, title in enumerate(self.polsat_results["sample_titles"][:2]):
                html += f"<p><strong>{i+1}.</strong> {title}...</p>"
        else:
            html += "<p>Brak przykładowych artykułów</p>"

        html += f"""
        </div>

        <div class="benchmark-section">
            <h3>🤖 Benchmark modeli NLP: {', '.join(EXPECTED_ADAPTERS)}</h3>

            <div class="comparison-section">
                <div class="comparison-card">
                    <h3>⏱️ Śr. czas inferencji [ms]</h3>
                    <div class="chart-container"><canvas id="bmTimeChart"></canvas></div>
                </div>
                <div class="comparison-card">
                    <h3>🎯 Śr. ryzyko dezinformacji [%]</h3>
                    <div class="chart-container"><canvas id="bmFakeChart"></canvas></div>
                </div>
            </div>

            <table class="results-table">
                <thead>
                    <tr>
                        <th>Model</th>
                        <th>Język</th>
                        <th>Śr. czas [ms]</th>
                        <th>Min [ms]</th>
                        <th>Max [ms]</th>
                        <th>Śr. fake [%]</th>
                        <th>Sentymenty</th>
                        <th>Próbek ok</th>
                        <th>Run</th>
                    </tr>
                </thead>
                <tbody>
                    {benchmark_rows_html}
                </tbody>
            </table>
        </div>

        <h3>📋 Wyniki testów ({passed}/{total_tests} przepuszczonych)</h3>
        <table class="results-table">
            <thead>
                <tr>
                    <th>Test</th>
                    <th>Status</th>
                    <th>Szczegóły</th>
                    <th>Czas [s]</th>
                </tr>
            </thead>
            <tbody>"""

        for result in self.results:
            status_class = "pass" if result["status"] == "PASS" else "fail" if result["status"] == "FAIL" else "warn"
            status_display = {"PASS": "✅", "FAIL": "❌", "WARNING": "⚠️"}.get(result["status"], "?")
            duration = f"{result['duration']:.2f}" if result["duration"] else "-"
            html += f"""
                <tr>
                    <td>{result['test_name']}</td>
                    <td class="{status_class}">{status_display} {result['status']}</td>
                    <td>{result['details']}</td>
                    <td>{duration}</td>
                </tr>"""

        html += f"""
            </tbody>
        </table>

        <div class="conclusions">
            <h4>Wnioski i rekomendacje</h4>
            <h5>Kluczowe wnioski:</h5>
            <ul>
                <li>System analizuje źródła anglojęzyczne (NYTimes) i polskojęzyczne (Polsat News)</li>
                <li>Benchmark obejmuje {len(EXPECTED_ADAPTERS)} modele NLP: {', '.join(EXPECTED_ADAPTERS)}</li>
                <li>Różnica w wykrywaniu dezinformacji między źródłami: {abs(fake_scores[0] - fake_scores[1]):.1f}%</li>
                <li>{"Spójna skuteczność detekcji między językami" if abs(fake_scores[0] - fake_scores[1]) <= 10 else "Znacząca różnica w skuteczności detekcji między językami"}</li>
            </ul>
            <h5>Rekomendacje:</h5>
            <ol>
                <li>Fine-tuning modeli NLP na polskich danych fact-checkingowych</li>
                <li>Optymalizacja parsowania polskich znaków diakrytycznych</li>
                <li>Implementacja cache'owania wyników dla często analizowanych źródeł</li>
                <li>Rozszerzenie testów o więcej polskich źródeł informacji</li>
                <li>Przeprowadzenie testów z rzeczywistymi użytkownikami</li>
            </ol>
        </div>
    </div>

    <div class="footer">
        <p>Raport wygenerowany automatycznie przez TruthScan AI Comparative Tester</p>
        <p>System TruthScan AI - Prototyp do walki z dezinformacją</p>
        <p>Wskaźnik sukcesu testów: {passed/total_tests*100:.1f}% | Błędy: {len(self.errors)}</p>
    </div>
</div>

<script>
    // Wykres ryzyka dezinformacji NYTimes vs GP
    new Chart(document.getElementById('fakeScoreChart').getContext('2d'), {{
        type: 'bar',
        data: {{
            labels: {json.dumps(sources)},
            datasets: [{{
                label: 'Średnie ryzyko dezinformacji (%)',
                data: {json.dumps(fake_scores)},
                backgroundColor: ['#e74c3c', '#27ae60'],
                borderColor: ['#c0392b', '#229954'],
                borderWidth: 1
            }}]
        }},
        options: {{
            responsive: true,
            plugins: {{ legend: {{ display: true, position: 'top' }} }},
            scales: {{
                y: {{
                    beginAtZero: true,
                    max: Math.max({max(fake_scores) if fake_scores else 50}, 50),
                    title: {{ display: true, text: 'Procent ryzyka' }}
                }}
            }}
        }}
    }});

    // Wykres wydajności NYTimes vs GP
    new Chart(document.getElementById('performanceChart').getContext('2d'), {{
        type: 'line',
        data: {{
            labels: {json.dumps(sources)},
            datasets: [{{
                label: 'Czas analizy (sekundy)',
                data: {json.dumps(performance_times)},
                backgroundColor: 'rgba(52,152,219,0.2)',
                borderColor: '#3498db',
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }}]
        }},
        options: {{
            responsive: true,
            plugins: {{ legend: {{ display: true, position: 'top' }} }},
            scales: {{ y: {{ beginAtZero: true, title: {{ display: true, text: 'Czas (s)' }} }} }}
        }}
    }});

    function getSentimentColors(labels) {{
        const colorMap = {{
            'Negatywne': '#e74c3c', 'Neutralne': '#3498db', 'Pozytywne': '#2ecc71',
            'bardzo negatywne': '#c0392b', 'bardzo pozytywne': '#27ae60'
        }};
        return labels.map(l => colorMap[l] || '#95a5a6');
    }}

    // Sentymenty NYTimes
    new Chart(document.getElementById('nytimesSentimentChart').getContext('2d'), {{
        type: 'doughnut',
        data: {{
            labels: {json.dumps(nytimes_sentiment_labels)},
            datasets: [{{
                data: {json.dumps(nytimes_sentiment_values)},
                backgroundColor: getSentimentColors({json.dumps(nytimes_sentiment_labels)}),
                hoverOffset: 10
            }}]
        }},
        options: {{ responsive: true, plugins: {{ legend: {{ position: 'bottom' }} }} }}
    }});

    // Sentymenty Polsat News
    new Chart(document.getElementById('polsatSentimentChart').getContext('2d'), {{
        type: 'doughnut',
        data: {{
            labels: {json.dumps(polsat_sentiment_labels)},
            datasets: [{{
                data: {json.dumps(polsat_sentiment_values)},
                backgroundColor: getSentimentColors({json.dumps(polsat_sentiment_labels)}),
                hoverOffset: 10
            }}]
        }},
        options: {{ responsive: true, plugins: {{ legend: {{ position: 'bottom' }} }} }}
    }});

    // Benchmark - czas inferencji per model
    new Chart(document.getElementById('bmTimeChart').getContext('2d'), {{
        type: 'bar',
        data: {{
            labels: {json.dumps(EXPECTED_ADAPTERS)},
            datasets: [{{
                label: 'Śr. czas inferencji [ms]',
                data: {json.dumps(bm_avg_times)},
                backgroundColor: ['#3498db', '#9b59b6', '#e67e22', '#27ae60'],
                borderColor: ['#2980b9', '#8e44ad', '#d35400', '#229954'],
                borderWidth: 1
            }}]
        }},
        options: {{
            responsive: true,
            plugins: {{ legend: {{ display: true, position: 'top' }} }},
            scales: {{ y: {{ beginAtZero: true, title: {{ display: true, text: 'Czas [ms]' }} }} }}
        }}
    }});

    // Benchmark - fake_probability per model
    new Chart(document.getElementById('bmFakeChart').getContext('2d'), {{
        type: 'bar',
        data: {{
            labels: {json.dumps(EXPECTED_ADAPTERS)},
            datasets: [{{
                label: 'Śr. fake_probability [%]',
                data: {json.dumps(bm_avg_fakes)},
                backgroundColor: ['#3498db', '#9b59b6', '#e67e22', '#27ae60'],
                borderColor: ['#2980b9', '#8e44ad', '#d35400', '#229954'],
                borderWidth: 1
            }}]
        }},
        options: {{
            responsive: true,
            plugins: {{ legend: {{ display: true, position: 'top' }} }},
            scales: {{ y: {{ beginAtZero: true, max: 100, title: {{ display: true, text: 'Ryzyko [%]' }} }} }}
        }}
    }});
</script>
</body>
</html>"""

        with open(filename, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"\n📄 Raport HTML zapisany jako: {filename}")
        print(f"   Otwórz w przeglądarce: file://{os.path.abspath(filename)}")
        return filename

    def run_comparative_tests(self):
        print("=" * 70)
        print("🎯 TRUTHSCAN AI - TESTY PORÓWNAWCZE NYTimes vs POLSAT NEWS")
        print("=" * 70)
        print("Ten skrypt przeprowadzi szczegółowe testy obu źródeł")
        print("i porówna ich wyniki analizy NLP.")
        print("=" * 70)

        print("\n1️⃣ Sprawdzanie dostępności systemu...")
        if not self.test_api_availability():
            print("❌ API niedostępne! Sprawdź czy backend działa.")
            return False

        print("\n2️⃣ Weryfikacja dostępnych źródeł...")
        sources = self.test_sources_endpoint()
        if not sources:
            print("⚠️ Nie udało się pobrać źródeł, używam domyślnych...")
            sources = ["NYTimes", "PolsatNews"]
        else:
            print(f"✅ Znaleziono {len(sources)} źródeł")

        print("\n3️⃣ Testowanie źródła NYTimes...")
        self.nytimes_results = self.test_single_source_detailed("NYTimes", "NYTimes News")

        print("\n4️⃣ Testowanie źródła Polsat News...")
        self.polsat_results = self.test_single_source_detailed("PolsatNews", "Polsat News")

        if self.nytimes_results.get("articles") and self.polsat_results.get("articles"):
            print("\n5️⃣ Porównywanie wyników NYTimes i Gazety Prawnej...")
            self.compare_sources(self.nytimes_results, self.polsat_results)
        else:
            print("⚠️ Brak danych do porównania")

        print("\n6️⃣ Benchmarking modeli NLP...")
        self.test_benchmark_endpoint()

        print("\n" + "=" * 70)
        print("📊 GENEROWANIE RAPORTÓW")
        print("=" * 70)

        html_report = self.generate_comparative_html_report()
        text_report = self.generate_text_report()

        passed = sum(1 for r in self.results if r["status"] == "PASS")
        total = len(self.results)

        print(f"\n{'='*70}")
        print(f"📋 PODSUMOWANIE TESTOW:")
        print(f"   Przepuszczono: {passed}/{total} ({passed/total*100:.1f}%)")

        if self.errors:
            print(f"   Błędy: {len(self.errors)}")

        if self.comparison_data:
            fake_diff = abs(self.comparison_data['avg_fake_score']['NYTimes'] - self.comparison_data['avg_fake_score']['Polsat News'])
            time_diff = abs(self.comparison_data['performance']['NYTimes'] - self.comparison_data['performance']['Polsat News'])
            print(f"\n🔍 WNIOSKI Z PORÓWNANIA:")
            print(f"   • Różnica w ryzyku dezinformacji: {fake_diff:.1f}%")
            print(f"   • Różnica w czasie analizy: {time_diff:.2f}s")
            if fake_diff > 10:
                print(f"   • ⚠️ Znacząca różnica w NLP między językami")
            if time_diff > 2:
                print(f"   • ⏱️ Analiza polskiego języka wymaga więcej czasu")

        print(f"\n📁 Raporty wygenerowane:")
        print(f"   HTML: {html_report}")
        print(f"   Tekst: {text_report}")
        print(f"   CSV benchmarku: truthscan_benchmark.csv")
        print(f"{'='*70}")

        return passed > total * 0.7


def main():
    print("🎯 TruthScan AI - Testy porównawcze NYTimes vs Polsat News")
    print("=" * 70)
    tester = TruthScanComparativeTester(base_url=BASE_URL)
    success = tester.run_comparative_tests()
    print("\n" + "=" * 70)
    if success:
        print("✅ TESTY ZAKOŃCZONE SUKCESEM!")
    else:
        print("⚠️ TESTY WYKAZAŁY PROBLEMY - sprawdź raport")
    print("=" * 70)
    print("\n📋 Otwórz raport HTML w przeglądarce:")
    print(f"   file://{os.path.abspath('truthscan_report.html')}")
    print(f"📊 Dane benchmarku CSV:")
    print(f"   {os.path.abspath('truthscan_benchmark.csv')}")
    return success


if __name__ == "__main__":
    try:
        import requests
    except ImportError:
        print("❌ Brak biblioteki 'requests'")
        print("💡 Zainstaluj: pip install requests")
        exit(1)
    main()