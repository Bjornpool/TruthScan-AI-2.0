/**
 * Hook odpowiedzialny za ustalenie i fallback ikonki (favicon) źródła artykułu.
 */

import { useState, useEffect, useMemo } from 'react';
import { Article } from '../../lib/fetchNews';

const SOURCE_DOMAINS: Record<string, string> = {
  bbc: "bbc.com",
  cnn: "cnn.com",
  nytimes: "nytimes.com",
  newyorktimes: "nytimes.com",
  guardian: "theguardian.com",
  theguardian: "theguardian.com",
  aljazeera: "aljazeera.com",
  dziennik: "dziennik.pl",
  polsatnews: "polsatnews.pl",
  gazetaprawna: "gazetaprawna.pl",
  spidersweb: "spidersweb.pl",
  bankier: "bankier.pl",
};

function normalizeKey(s?: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[''`"]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "");
}

export function useFavicon(article: Article) {
  // Lista potencjalnych favicon z fallbackami
  const candidates = useMemo(() => {
    const cand: string[] = [];
    const s2 = (host: string) => `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
    const ddg = (host: string) => `https://icons.duckduckgo.com/ip3/${host}.ico`;

    if (article.link) {
      try {
        const raw = article.link.startsWith("http") ? article.link : `https://${article.link}`;
        const host = new URL(raw).hostname;
        if (host) cand.push(s2(host), ddg(host));
      } catch {}
    }

    const srcKey = normalizeKey(article.source);
    const mapped = SOURCE_DOMAINS[srcKey];
    if (mapped) cand.push(s2(mapped), ddg(mapped));
    if (!mapped && srcKey) {
      cand.push(s2(`${srcKey}.com`), ddg(`${srcKey}.com`));
      cand.push(s2(`${srcKey}.pl`), ddg(`${srcKey}.pl`));
    }

    return [...new Set(cand)];
  }, [article]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentSrc = candidates[currentIndex];
  const sourceInitial = (article.source || "?").slice(0, 1).toUpperCase();

  useEffect(() => setCurrentIndex(0), [candidates.join("|")]);

  const nextFavicon = () => setCurrentIndex(prev => prev + 1);

  return {
    faviconSrc: currentSrc,
    sourceInitial,
    hasFavicon: !!currentSrc,  
    nextFavicon  
  };
}