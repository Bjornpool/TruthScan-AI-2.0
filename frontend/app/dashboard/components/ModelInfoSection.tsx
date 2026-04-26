"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
import locales from "../../../lib/locales";
import type { Lang } from "../../../lib/types";

interface Props {
  language: Lang;
}

type ModelCard = {
  name: string;
  flag: string;
  badges: string[];
  desc1Key: keyof typeof locales.pl;
  desc2Key: keyof typeof locales.pl;
  accentColor: string;
  hfLink: string;
};

const MODELS: ModelCard[] = [
  {
    name: "RoBERTa",
    flag: "🇬🇧",
    badges: ["EN"],
    desc1Key: "modelsSection_roberta_desc1",
    desc2Key: "modelsSection_roberta_desc2",
    accentColor: "blue",
    hfLink: "https://huggingface.co/cardiffnlp/twitter-roberta-base-sentiment-latest",
  },
  {
    name: "XLM-RoBERTa",
    flag: "🌍",
    badges: ["PL", "EN", "NO"],
    desc1Key: "modelsSection_xlm_desc1",
    desc2Key: "modelsSection_xlm_desc2",
    accentColor: "purple",
    hfLink: "https://huggingface.co/cardiffnlp/twitter-xlm-roberta-base-sentiment",
  },
  {
    name: "NorBERT 3",
    flag: "🇳🇴",
    badges: ["NO"],
    desc1Key: "modelsSection_norbert_desc1",
    desc2Key: "modelsSection_norbert_desc2",
    accentColor: "red",
    hfLink: "https://huggingface.co/cardiffnlp/twitter-xlm-roberta-base-sentiment-multilingual",
  },
  {
    name: "HerBERT",
    flag: "🇵🇱",
    badges: ["PL"],
    desc1Key: "modelsSection_herbert_desc1",
    desc2Key: "modelsSection_herbert_desc2",
    accentColor: "green",
    hfLink: "https://huggingface.co/allegro/herbert-base-cased",
  },
];

const ACCENT: Record<string, string> = {
  blue:   "border-blue-400 dark:border-blue-500",
  purple: "border-purple-400 dark:border-purple-500",
  red:    "border-red-400 dark:border-red-500",
  green:  "border-green-400 dark:border-green-500",
};

const BADGE: Record<string, string> = {
  blue:   "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  red:    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  green:  "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

export default function ModelInfoSection({ language }: Props) {
  const [open, setOpen] = useState(false);
  const t = locales[language] ?? locales.pl;

  return (
    <div className="rounded-xl bg-white/70 dark:bg-gray-800/70 shadow backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60">
      {/* Nagłówek — zawsze widoczny, klikalny */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left select-none"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
          <Bot className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
          {t.modelsSection}
        </span>
        <span
          className="text-gray-400 dark:text-gray-500 transition-transform duration-200"
          style={{ display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      {/* Karty — widoczne tylko gdy open */}
      {open && (
        <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {MODELS.map((m) => (
            <a
              key={m.name}
              href={m.hfLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-col gap-2 rounded-lg border-l-4 bg-gray-50 dark:bg-gray-900/50 p-4 shadow-sm hover:shadow-md transition-shadow ${ACCENT[m.accentColor]}`}
            >
              {/* Nagłówek karty */}
              <div className="flex items-center gap-2">
                <span className="text-2xl">{m.flag}</span>
                <span className="font-bold text-gray-800 dark:text-gray-100">{m.name}</span>
              </div>

              {/* Opis */}
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-snug">
                {t[m.desc1Key] as string}{" "}
                {t[m.desc2Key] as string}
              </p>

              {/* Badges języków */}
              <div className="flex flex-wrap gap-1 mt-auto pt-1">
                {m.badges.map((b) => (
                  <span
                    key={b}
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${BADGE[m.accentColor]}`}
                  >
                    {b}
                  </span>
                ))}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
