/**
 * Selektor źródła wiadomości.
 *
 * Odpowiada za:
 * - wybór aktywnego źródła informacyjnego,
 * - przekazanie zmiany wyboru do komponentu nadrzędnego,
 * - prezentację listy dostępnych źródeł w aktualnym języku interfejsu.
 */


"use client";

import React from "react";
import type { Lang } from "../lib/types";

interface Props {
  selectedSource: string;
  setSelectedSource: (src: string) => void;
  language: Lang;
  locales: Record<string, any>;
}

export default function SourceSelector({ selectedSource, setSelectedSource, language, locales }: Props) {
  return (
    <select
      className="block w-full max-w-full min-w-0 p-2 bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded-md transition-colors"
      value={selectedSource}
      onChange={(e) => setSelectedSource(e.target.value)}
    >
      <option value="">🌍 {locales[language].allSources}</option>
      <optgroup label="🇬🇧 English">
        <option value="BBC">BBC</option>
        <option value="CNN">CNN</option>
        <option value="NYTimes">New York Times</option>
        <option value="Guardian">Guardian</option>
        <option value="AlJazeera">Al Jazeera</option>
      </optgroup>
      <optgroup label="🇵🇱 Polski">
        <option value="Money">Money</option>
        <option value="PolsatNews">Polsat News</option>
        <option value="GazetaPrawna">Gazeta Prawna</option>
        <option value="SpidersWeb">Spider’s Web</option>
        <option value="Bankier">Bankier</option>
      </optgroup>
      <optgroup label="🇳🇴 Norsk">
        <option value="NRK">NRK</option>
        <option value="VG">VG</option>
        <option value="Dagbladet">Dagbladet</option>
        <option value="Aftenposten">Aftenposten</option>
      </optgroup>
    </select>
  );
}


