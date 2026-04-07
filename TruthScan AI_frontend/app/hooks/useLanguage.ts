/**
 * Hook zarządzający językiem interfejsu aplikacji.
 */

import { useState, useEffect, useRef } from 'react';

import type { Lang } from "../../lib/types";

const isLang = (v: unknown): v is Lang => v === "pl" || v === "en" || v === "no";

export function useLanguage() {
  const [language, setLanguage] = useState<Lang>("pl");
  const langRef = useRef<Lang>("pl");

  useEffect(() => {
    const htmlLang = document.documentElement.lang;
    if (isLang(htmlLang)) {
      setLanguage(htmlLang);
      langRef.current = htmlLang;
    }

    const stored = localStorage.getItem("lang");
    if (isLang(stored)) {
      setLanguage(stored);
      langRef.current = stored;
    }

    // Synchronizacja zmiany języka między komponentami i kartami przeglądarki
    const onCustom = (e: Event) => {
      const next = (e as CustomEvent).detail;
      if (isLang(next)) {
        setLanguage(next);
        langRef.current = next;
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === "lang" && isLang(e.newValue)) {
        setLanguage(e.newValue);
        langRef.current = e.newValue;
      }
    };

    window.addEventListener("app:langchange", onCustom as EventListener);
    window.addEventListener("storage", onStorage);
    
    return () => {
      window.removeEventListener("app:langchange", onCustom as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { language, langRef };
}