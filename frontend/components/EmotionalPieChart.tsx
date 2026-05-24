/**
 * Komponent wizualizujący rozkład emocji w artykułach w formie wykresu kołowego.
 *
 * Odpowiada za:
 * - normalizację i agregację danych sentymentu,
 * - tłumaczenie etykiet w zależności od języka interfejsu,
 * - prezentację danych z wykorzystaniem biblioteki Recharts,
 * - obsługę tooltipów i etykiet procentowych.
 */

"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useLanguage } from "../app/hooks/useLanguage"; 
import locales from "../lib/locales";

interface EmotionalPieChartProps {
  data: { name: string; value: number }[];
  title?: string;
}

type Canonical = "POSITIVE" | "NEGATIVE" | "NEUTRAL";

const EMOTION_COLORS = {
  POSITIVE: "#22c55e", // green
  NEGATIVE: "#ef4444", // red
  NEUTRAL: "#3b82f6",  // blue
} as const;

const EMOTION_LABELS = {
  pl: {
    POSITIVE: "Pozytywne",
    NEGATIVE: "Negatywne",
    NEUTRAL:  "Neutralne",
  },
  en: {
    POSITIVE: "Positive",
    NEGATIVE: "Negative",
    NEUTRAL:  "Neutral",
  },
  no: {
    POSITIVE: "Positivt",
    NEGATIVE: "Negativt",
    NEUTRAL:  "Nøytralt",
  },
} as const;

export default function EmotionalPieChart({ data, title }: EmotionalPieChartProps) {
  const { language } = useLanguage();
  const t = locales[language];

  const toCanonical = (raw: string): Canonical | null => {
    const u = (raw || "").trim().toUpperCase();
    if (u === "POSITIVE" || u === "POZYTYWNE") return "POSITIVE";
    if (u === "NEGATIVE" || u === "NEGATYWNE") return "NEGATIVE";
    if (u === "NEUTRAL"  || u === "NEUTRALNE") return "NEUTRAL";
    return null;
  };

  const translatedData = useMemo(() => {
    const initialData: Record<Canonical, number> = {
      POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0
    };

    for (const item of data) {
      const c = toCanonical(item.name);
      if (!c) continue;
      initialData[c] = (initialData[c] ?? 0) + (item.value ?? 0);
    }

    return (["POSITIVE", "NEUTRAL", "NEGATIVE"] as Canonical[])
      .map(canonical => ({
        canonical,
        name: EMOTION_LABELS[language][canonical],
        value: initialData[canonical],
        color: EMOTION_COLORS[canonical]
      }))
      .filter(item => item.value > 0);
  }, [data, language]);

  const totalValue = useMemo(() => 
    translatedData.reduce((sum, item) => sum + item.value, 0), 
    [translatedData]
  );

  const RAD = Math.PI / 180;

  const renderLabel = ({ cx, cy, midAngle, outerRadius, name, value, payload }: any) => {
    const r = (outerRadius ?? 0) + 14;
    const x = cx + r * Math.cos(-midAngle * RAD);
    const y = cy + r * Math.sin(-midAngle * RAD);
    const anchor: "start" | "end" = x > cx ? "start" : "end";

    const fill = EMOTION_COLORS[(payload?.canonical as Canonical) ?? "NEUTRAL"];
    return (
      <text x={x} y={y} fill={fill} textAnchor={anchor} dominantBaseline="central" 
            className="text-[12px] select-none font-medium">
        {`${name}: ${value}`}
      </text>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = totalValue > 0 ? (data.value / totalValue) * 100 : 0;
      
      return (
        <div className="bg-gray-900 dark:bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-lg">
          <p className="text-white font-medium">{data.name}</p>
          <p className="text-gray-300">
            {language === "pl" ? "Liczba artykułów: " : language === "no" ? "Antall artikler: " : "Number of articles: "}
            <span className="text-white font-semibold">{data.value}</span>
          </p>
          <p className="text-gray-300">
            {language === "pl" ? "Procent: " : language === "no" ? "Prosent: " : "Percentage: "}
            <span className="text-white font-semibold">{percentage.toFixed(1)}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (translatedData.length === 0) {
    return (
      <div className="w-full">
        <h3 className="text-m font-semibold mb-2 text-gray-800 dark:text-gray-100">
          {title || t.emotionsInArticles}
        </h3>
        <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400 text-center">
            {language === "pl" ? "Brak danych do wyświetlenia" : language === "no" ? "Ingen data å vise" : "No data to display"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-m font-semibold mb-2 text-gray-800 dark:text-gray-100">
        {title || t.emotionsInArticles}
      </h3>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 8, right: 28, left: 28, bottom: 0 }}>
            <Pie
              data={translatedData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius="70%"
              label={renderLabel}
              labelLine={false}
              isAnimationActive={true}
              animationDuration={500}
            >
              {translatedData.map((item, idx) => (
                <Cell key={idx} fill={item.color} stroke="#1f2937" strokeWidth={1} />
              ))}
            </Pie>

            <Tooltip content={<CustomTooltip />} />
            
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value, entry: any) => (
                <span style={{ color: entry.color, fontSize: '12px' }}>{value}</span>
              )}
              wrapperStyle={{ paddingTop: '10px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <p className="text-s text-center text-gray-500 dark:text-gray-400 mt-4">
        {language === "pl"
          ? "Wykres pokazuje rozkład emocji w analizowanych artykułach."
          : language === "no"
          ? "Diagrammet viser fordelingen av følelser i analyserte artikler."
          : "This chart shows the distribution of detected emotions in articles."}
      </p>
    </div>
  );
}