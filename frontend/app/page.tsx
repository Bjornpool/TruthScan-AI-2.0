/**
 * Strona główna aplikacji TruthScan AI.
 */

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Zap, Globe, BarChart2, Search, BookOpen,
  CheckCircle, TrendingUp, AlertTriangle,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import locales from "../lib/locales";
import TipModal from "../app/TipModel";
import { fetchAllNews } from "../lib/fetchNews";
import { useNewsCache, newsKey } from "./stores/newsCache";
import type { Lang } from "../lib/types";

const PREFETCH_SOURCES = [
  "BBC", "CNN", "NYTimes", "Guardian", "AlJazeera",
  "Money", "PolsatNews", "TVN24", "SpidersWeb", "Bankier",
  "NRK", "VG", "E24", "Aftenposten",
] as const;

export default function HomePage() {

  const [language, setLanguage] = useState<Lang>("pl");
  const [activeTip, setActiveTip] = useState<number | null>(null);

  useEffect(() => {
    // Synchronizacja języka interfejsu (localStorage + zdarzenie globalne)
    const stored = localStorage.getItem("lang");
    if (stored === "pl" || stored === "en" || stored === "no") setLanguage(stored as Lang);

    const onLangChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === "pl" || detail === "en" || detail === "no") setLanguage(detail as Lang);
    };
    window.addEventListener("app:langchange", onLangChange as EventListener);

    return () => window.removeEventListener("app:langchange", onLangChange as EventListener);
  }, []);

  // Prefetching artykułów w tle — dane trafiają do cache zanim użytkownik otworzy dashboard
  useEffect(() => {
    const timer = setTimeout(() => {
      const lang = (localStorage.getItem("lang") as Lang) || "pl";
      const cacheState = useNewsCache.getState();

      // Pobierz tylko źródła których nie ma jeszcze w cache
      const missing = PREFETCH_SOURCES.filter(
        (src) => !cacheState.get(newsKey(src))
      );
      if (missing.length === 0) return;

      console.log(`[PREFETCH] start: ${missing.length} źródeł, lang=${lang}`);

      fetchAllNews([...missing], lang, {
        concurrency: 3,
        onPartial: ({ source, articles }) => {
          if (articles.length === 0) return;
          // Zapis do Zustand — wyzwoli subskrypcję useDashboardCharts
          useNewsCache.getState().set(newsKey(source), articles);
          console.log(`[PREFETCH] [${source}] zapisano ${articles.length} art.`);
        },
      }).then(() => {
        console.log("[PREFETCH] gotowe");
      }).catch(() => {
        // Prefetch cichy — błędy ignorujemy
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const t = locales[language];
    const T = (pl: string, no: string, en: string) =>
    language === "pl" ? pl : language === "no" ? no : en;

  const tips = [
    {
      pl: "Sprawdź źródło artykułu",
      no: "Sjekk kilden til artikkelen",
      en: "Check the article source",
      morePl: "Zwróć uwagę na autora i wydawcę. Sprawdź czy strona ma sekcję 'O nas', dane kontaktowe i politykę redakcyjną. Unikaj anonimowych blogów i stron bez informacji o zespole. Prawdziwe media zwykle podają swoje dane i mają przejrzystą strukturę własności.",
      moreNo: "Vær oppmerksom på forfatteren og utgiveren. Sjekk om nettstedet har en 'Om oss'-seksjon, kontaktinformasjon og redaksjonell policy. Unngå anonyme blogger og nettsteder uten teaminformasjon. Legitime medier oppgir vanligvis sine data og har en gjennomsiktig eierskapsstruktur.",
      moreEn: "Pay attention to the author and publisher. Check if the site has an 'About us' section, contact details and editorial policy. Avoid anonymous blogs and sites without team information. Legitimate media usually provide their data and have transparent ownership structure.",
      link: { href: "https://demagog.org.pl/edukacja/", labelPl: "Demagog: Jak weryfikować źródła", labelNo: "Demagog: Slik verifiserer du kilder", labelEn: "Demagog: How to verify sources" },
      Icon: Search, iconClass: "w-5 h-5 text-blue-400",
    },
    {
      pl: "Analizuj emocjonalny język",
      no: "Analyser emosjonelt språk",
      en: "Analyze emotional language",
      morePl: "Teksty pełne wykrzykników, CAPS LOCKA i ostrych epitetów często manipulują emocjami. Prawdziwe newsy starają się być neutralne. Zwróć uwagę na clickbaitowe nagłówki obiecujące szokujące rewelacje bez pokrycia w treści.",
      moreNo: "Tekster fulle av utropstegn, STORE BOKSTAVER og harde epiteter manipulerer ofte følelser. Ekte nyheter prøver å være nøytrale. Vær oppmerksom på clickbait-overskrifter som lover sjokkerende avsløringer uten innhold.",
      moreEn: "Texts full of exclamation marks, ALL CAPS and harsh epithets often manipulate emotions. Real news tries to be neutral. Pay attention to clickbait headlines promising shocking revelations without substance.",
      link: { href: "https://www.snopes.com/collections/fact-checking-101/", labelPl: "Snopes: Podstawy fact-checkingu", labelNo: "Snopes: Grunnleggende fakta-sjekk", labelEn: "Snopes: Fact-checking basics" },
      Icon: BarChart2, iconClass: "w-5 h-5 text-orange-400",
    },
    {
      pl: "Weryfikuj w wielu źródłach",
      no: "Verifiser i flere kilder",
      en: "Verify in multiple sources",
      morePl: "Nie polegaj na jednym źródle. Sprawdź tę samą informację w co najmniej 2-3 wiarygodnych mediach. Użyj wyszukiwarki z operatorami jak 'site:.gov.pl' lub 'site:.edu'. Sprawdź datę publikacji - stare newsy często są udostępniane jako aktualne.",
      moreNo: "Ikke stol på én kilde. Sjekk samme informasjon i minst 2-3 pålitelige medier. Bruk søkemotorer med operatorer som 'site:.gov.no' eller 'site:.edu'. Sjekk publiseringsdatoen - gamle nyheter deles ofte som nye.",
      moreEn: "Don't rely on one source. Check the same information in at least 2-3 reliable media. Use search engines with operators like 'site:.gov' or 'site:.edu'. Check the publication date - old news is often shared as current.",
      link: { href: "https://factcheck.afp.com/", labelPl: "AFP Fact Check", labelNo: "AFP Fact Check", labelEn: "AFP Fact Check" },
      Icon: CheckCircle, iconClass: "w-5 h-5 text-green-400",
    },
    {
      pl: "Sprawdź dowody i cytaty",
      no: "Sjekk bevis og sitater",
      en: "Check evidence and quotes",
      morePl: "Prawdziwe artykuły zawierają konkretne dane, statystyki, cytaty ekspertów i odnośniki do badań. Fake newsy operują ogólnikami i emocjami. Sprawdź czy cytowane osoby rzeczywiście istnieją i czy zostały poprawnie przytoczone.",
      moreNo: "Ekte artikler inneholder spesifikke data, statistikk, ekspertsitater og henvisninger til forskning. Falske nyheter opererer med generaliseringer og følelser. Sjekk om siterte personer faktisk eksisterer og ble korrekt sitert.",
      moreEn: "Real articles contain specific data, statistics, expert quotes and references to research. Fake news operates on generalizations and emotions. Check if quoted people actually exist and were correctly cited.",
      link: { href: "https://www.politifact.com/", labelPl: "PolitiFact: Weryfikacja faktów", labelNo: "PolitiFact: Faktaverifisering", labelEn: "PolitiFact: Fact verification" },
      Icon: TrendingUp, iconClass: "w-5 h-5 text-purple-400",
    },
    {
      pl: "Uważaj na deepfakes i manipulacje",
      no: "Vær forsiktig med deepfakes og manipulasjoner",
      en: "Beware of deepfakes and manipulations",
      morePl: "Coraz częściej spotykamy zmontowane zdjęcia, filmy i nagrania audio. Sprawdź oryginalne źródło materiału. Użyj narzędzi do odwrotnego wyszukiwania obrazów. Zwróć uwagę na nienaturalne ruchy twarzy w filmach.",
      moreNo: "Vi møter stadig mer manipulerte bilder, videoer og lydopptak. Sjekk den originale kilden til materialet. Bruk verktøy for omvendt bildesøk. Vær oppmerksom på unaturlige ansiktsbevegelser i videoer.",
      moreEn: "We increasingly encounter edited photos, videos and audio recordings. Check the original source of the material. Use reverse image search tools. Pay attention to unnatural facial movements in videos.",
      link: { href: "https://euvsdisinfo.eu/", labelPl: "EU vs Disinfo: Walka z dezinformacją", labelNo: "EU vs Disinfo: Kamp mot desinformasjon", labelEn: "EU vs Disinfo: Fighting disinformation" },
      Icon: AlertTriangle, iconClass: "w-5 h-5 text-red-400",
    }
  ];

  const sources = [
    { href: "https://demagog.org.pl",                label: "Demagog",          tag: "PL" },
    { href: "https://konkret24.tvn24.pl",            label: "Konkret24",        tag: "PL" },
    { href: "https://fakehunter.pap.pl",             label: "FakeHunter",       tag: "PL" },
    { href: "https://www.faktisk.no",                label: "Faktisk.no",       tag: "NO" },
    { href: "https://www.nrk.no/faktasjekk",         label: "Faktasjekk NRK",  tag: "NO" },
    { href: "https://www.vg.no/nyheter/faktasjekk",  label: "VG Fakta",         tag: "NO" },
    { href: "https://www.snopes.com",                label: "Snopes",           tag: "EN" },
    { href: "https://www.politifact.com",            label: "PolitiFact",       tag: "EN" },
    { href: "https://factcheck.afp.com",             label: "AFP Fact Check",   tag: "EN" },
  ];

  type Feature = {
    Icon: React.ComponentType<LucideProps>;
    iconClass: string;
    title: string;
    description: string;
  };

  const features: Feature[] = [
    {
      Icon: Bot,
      iconClass: "w-8 h-8 text-blue-500",
      title: T("Analiza AI", "AI-analyse", "AI Analysis"),
      description: T(
        "Zaawansowane modele NLP do analizy sentymentu i wykrywania dezinformacji",
        "Avanserte NLP-modeller for sentimentanalyse og oppdagelse av desinformasjon",
        "Advanced NLP models for sentiment analysis and misinformation detection"
      )
    },
    {
      Icon: Zap,
      iconClass: "w-8 h-8 text-yellow-500",
      title: T("Analiza w Czasie Rzeczywistym", "Sanntidsanalyse", "Real-time Analysis"),
      description: T(
        "Natychmiastowe przetwarzanie najnowszych wiadomości ze strumieni RSS",
        "Umiddelbar behandling av siste nyheter fra RSS-strømmer",
        "Instant processing of latest news from RSS feeds"
      )
    },
    {
      Icon: Globe,
      iconClass: "w-8 h-8 text-green-500",
      title: T("Wiele Źródeł", "Flere kilder", "Multiple Sources"),
      description: T(
        "Porównuj wiadomości z 10+ zaufanych źródeł krajowych i międzynarodowych",
        "Sammenlign nyheter fra 10+ pålitelige innenlandske og internasjonale kilder",
        "Compare news from 10+ trusted domestic and international sources"
      )
    },
    {
      Icon: BarChart2,
      iconClass: "w-8 h-8 text-purple-500",
      title: T("Dashboard z Wykresami", "Dashbord med diagrammer", "Chart Dashboard"),
      description: T(
        "Interaktywne wizualizacje danych i statystyki emocjonalne",
        "Interaktive datavisualiseringer og emosjonell statistikk",
        "Interactive data visualizations and emotional statistics"
      )
    }
  ];

  return (
  <div className="min-h-screen bg-gradient-to-b from-blue-200 via-purple-100/80 to-pink-100/30 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 text-gray-900 dark:text-gray-100 font-sans">

    <section className="relative py-16 px-4 md:px-8 flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 text-center space-y-8 w-full max-w-4xl mx-auto"
      >
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-5xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"
        >
          TruthScan AI
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 max-w-2xl mx-auto"
        >
          {T(
            "Inteligentny system do analizy wiarygodności newsów i wykrywania dezinformacji",
            "Intelligent system for troverdighetanalyse av nyheter og oppdagelse av desinformasjon",
            "Intelligent system for news credibility analysis and misinformation detection"
          )}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex justify-center gap-8 py-4"
        >
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">14</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {T("Źródeł", "Kilder", "Sources")}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">2s</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {T("Analiza", "Analyse", "Analysis")}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">AI</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {T("Modele NLP", "NLP-modeller", "NLP Models")}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center pt-4"
        >
          <a
            href="/dashboard"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-lg text-lg font-semibold transition-all hover:scale-105 shadow-lg"
          >
            {T("Przejdź do Dashboardu →", "Gå til dashbordet →", "Go to Dashboard →")}
          </a>
          
        </motion.div>
      </motion.div>
    </section>

    <section id="features" className="py-12 px-4 md:px-8">
      <div className="container mx-auto max-w-6xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            {T(" Dlaczego TruthScan AI?", " Hvorfor TruthScan AI?", " Why TruthScan AI?")}
          </h2>
          <p className="text-gray-700 dark:text-gray-300 max-w-2xl mx-auto">
            {T(
              "Nowoczesne narzędzie wspierające krytyczne myślenie",
              "Moderne verktøy som støtter kritisk tenkning",
              "Modern tool supporting critical thinking"
            )}
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50"
            >
              <div className="mb-4"><feature.Icon className={feature.iconClass} /></div>
              <h3 className="text-lg font-bold mb-3 text-gray-800 dark:text-gray-100">
                {feature.title}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    <section className="py-12 px-4 md:px-8">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <div className="space-y-6">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-800 dark:text-gray-100">
              <Search className="w-6 h-6 text-blue-500 shrink-0" />
              {T("Jak rozpoznać fake newsy?", "Hvordan gjenkjenne falske nyheter?", "How to Spot Fake News")}
            </h2>
            
            <div className="space-y-3">
              {tips.map((tip, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTip(i)}
                  className="w-full flex items-start gap-3 p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg shadow hover:shadow-md transition-all text-left border border-gray-200/50 dark:border-gray-700/50"
                >
                  <tip.Icon className={tip.iconClass} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                      {language === "pl" ? tip.pl : language === "no" ? tip.no : tip.en}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                      {T("Kliknij, aby dowiedzieć się więcej", "Klikk for å lære mer", "Click to learn more")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-800 dark:text-gray-100">
              <BookOpen className="w-6 h-6 text-green-500 shrink-0" />
              {T("Polecane źródła", "Anbefalte kilder", "Recommended Sources")}
            </h2>
            
            <div className="grid grid-cols-1 gap-3">
              {sources.map((source) => (
                <a
                  key={source.href}
                  href={source.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg shadow hover:shadow-md transition-all border border-gray-200/50 dark:border-gray-700/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800 dark:text-gray-100">
                        {source.label}
                      </span>
                      <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-1 rounded">
                        {source.tag}
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
    <AnimatePresence>
      {activeTip !== null && (
        <TipModal
            title={language === "pl" ? tips[activeTip].pl : language === "no" ? tips[activeTip].no : tips[activeTip].en}
            body={language === "pl" ? tips[activeTip].morePl : language === "no" ? tips[activeTip].moreNo : tips[activeTip].moreEn}
            linkHref={tips[activeTip].link.href}
            linkLabel={language === "pl" ? tips[activeTip].link.labelPl : language === "no" ? tips[activeTip].link.labelNo : tips[activeTip].link.labelEn}
            onClose={() => setActiveTip(null)}
          />
      )}
    </AnimatePresence>
  </div>
);
}