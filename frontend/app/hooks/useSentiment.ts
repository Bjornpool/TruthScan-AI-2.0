/**
 * Hook mapujący wynik analizy sentymentu na etykietę i kolor interfejsu.
 */

import { useMemo } from 'react';

export interface SentimentResult {
  label: string;
  color: string;
}

export function useSentiment(sentiment: string, language: "pl" | "en" | "no"): SentimentResult {
  return useMemo(() => {
    const sentimentUpper = (sentiment || "").toUpperCase();

    // "POZYTYWNE" nie zawiera "POS" (zawiera "POZ") — stąd osobny check dla PL.
    // "NEGATYWNE" zawiera "NEG" więc działa bez dodatkowego sprawdzenia.
    const isPositive = sentimentUpper.includes("POS") || sentimentUpper.includes("POZYT");
    const isNegative = sentimentUpper.includes("NEG");

    const label = language === "pl"
      ? isPositive ? "Pozytywne" : isNegative ? "Negatywne" : "Neutralne"
      : language === "no"
      ? isPositive ? "Positivt"  : isNegative ? "Negativt"  : "Nøytralt"
      : isPositive ? "Positive"  : isNegative ? "Negative"  : "Neutral";

    const positiveLabel = language === "pl" ? "Pozytywne" : language === "no" ? "Positivt" : "Positive";
    const negativeLabel = language === "pl" ? "Negatywne" : language === "no" ? "Negativt" : "Negative";

    const color = label === positiveLabel
      ? "text-green-500"
      : label === negativeLabel
      ? "text-red-500"
      : "text-blue-400";

    return { label, color };
  }, [sentiment, language]);
}