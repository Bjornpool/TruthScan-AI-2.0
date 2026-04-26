"use client";

import { useEffect, useRef, useState } from "react";
import locales from "../../../lib/locales";
import type { Lang } from "../../../lib/types";

interface Props {
  language: Lang;
  intervalMs?: number;
}

export default function RotatingFact({ language, intervalMs = 5000 }: Props) {
  const facts: string[] = (locales[language] ?? locales.pl).loadingFacts;

  const [index, setIndex]     = useState(() => Math.floor(Math.random() * facts.length));
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tick = () => {
      setVisible(false);
      timerRef.current = setTimeout(() => {
        setIndex((i) => (i + 1) % facts.length);
        setVisible(true);
      }, 350);
    };

    const interval = setInterval(tick, intervalMs);
    return () => {
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [facts.length, intervalMs]);

  return (
    <p
      className="flex items-start gap-1.5 text-sm font-medium text-gray-800 dark:text-gray-200 leading-relaxed transition-opacity duration-[350ms] min-h-[2.5rem]"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <span className="shrink-0">💡</span>
      <span>{facts[index]}</span>
    </p>
  );
}
