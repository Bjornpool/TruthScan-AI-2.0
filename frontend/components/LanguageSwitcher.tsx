/**
 * Komponent przełącznika języka interfejsu użytkownika.
 *
 * Odpowiada za:
 * - umożliwienie użytkownikowi wyboru języka aplikacji (PL / EN),
 * - przekazanie wybranego języka do komponentu nadrzędnego,
 * - wizualną prezentację aktualnego języka w formie listy rozwijanej.
 */


import React from "react";
import type { Lang } from "../lib/types";

interface Props {
  language: Lang;
  setLanguage: (lang: Lang) => void;
}

const FLAGS: Record<Lang, string> = { en: "🇬🇧", pl: "🇵🇱", no: "🇳🇴" };
const CYCLE: Lang[] = ["pl", "en", "no"];

export default function LanguageSwitcher({ language, setLanguage }: Props) {
  const cycleNext = () => {
    const i = CYCLE.indexOf(language);
    setLanguage(CYCLE[(i + 1) % CYCLE.length]);
  };

  return (
    <>
      {/* Mobile: sama flaga — kliknięcie cykluje język */}
      <button
        onClick={cycleNext}
        className="sm:hidden p-2 bg-gray-200 dark:bg-gray-700 rounded-md text-base leading-none"
        title={`Language: ${language.toUpperCase()} (click to switch)`}
        aria-label={`Current language: ${language}. Click to switch.`}
      >
        {FLAGS[language]}
      </button>

      {/* Desktop: flaga + pełna nazwa w select */}
      <select
        className="hidden sm:block p-2 bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded-md transition-colors"
        value={language}
        onChange={(e) => setLanguage(e.target.value as Lang)}
      >
        <option value="en">🇬🇧 English</option>
        <option value="pl">🇵🇱 Polski</option>
        <option value="no">🇳🇴 Norsk</option>
      </select>
    </>
  );
}

