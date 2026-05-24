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

export default function LanguageSwitcher({ language, setLanguage }: Props) {
  return (
    <select
      className="p-2 bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded-md transition-colors"
      value={language}
      onChange={(e) => setLanguage(e.target.value as Lang)}
    >
      <option value="en">🇬🇧 English</option>
      <option value="pl">🇵🇱 Polski</option>
      <option value="no">🇳🇴 Norsk</option>
    </select>
  );
}

