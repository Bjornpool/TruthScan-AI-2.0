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

    // Normalizacja wyniku sentymentu do formy prezentacyjnej (UI)
    const label = language === "pl"
      ? sentimentUpper.includes("POS") ? "Pozytywne"
      : sentimentUpper.includes("NEG") ? "Negatywne"
      : "Neutralne"
      : language === "no"
      ? sentimentUpper.includes("POS") ? "Positivt"
      : sentimentUpper.includes("NEG") ? "Negativt"
      : "Nøytralt"
      : sentimentUpper.includes("POS") ? "Positive"
      : sentimentUpper.includes("NEG") ? "Negative"
      : "Neutral";

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