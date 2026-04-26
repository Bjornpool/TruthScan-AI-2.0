/**
 * Komponent prezentujący porównawczy wykres słupkowy udziału fake newsów
 * w poszczególnych źródłach informacyjnych.
 *
 * Odpowiada za:
 * - wizualizację wyników analizy fake news w podziale na źródła,
 * - obsługę wielojęzycznych etykiet i opisów,
 * - czytelną prezentację danych z wykorzystaniem biblioteki Recharts,
 * - informowanie użytkownika o braku lub niepełnych danych.
 */

"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { useLanguage } from "../app/hooks/useLanguage"; 
import locales from "../lib/locales";

interface Props {
  data: { label: string; value: number }[];
  title?: string;
  footerNote?: string;
}

export default function FakeNewsBarChart({ data, title, footerNote }: Props) {
 
  const { language } = useLanguage();
  const t = locales[language];

  const rows = useMemo(() => data.map((d) => ({ ...d })), [data]);

  const NOTE_TEXT = {
    pl: "Wykres przedstawia oszacowany udział artykułów oznaczonych jako fake news w poszczególnych źródłach.",
    en: "The chart shows an estimated share of articles flagged as fake news across sources.",
    no: "Diagrammet viser en estimert andel artikler flagget som falske nyheter per kilde.",
  };

  const METRIC_NAME = {
    pl: "Prawdopodobieństwo fake news",
    en: "Fake-news probability",
    no: "Sannsynlighet for falske nyheter",
  };

  const NO_DATA_TEXT = {
    pl: "Brak danych",
    en: "No data",
    no: "Ingen data",
  };

  const note = footerNote ?? NOTE_TEXT[language];
  const metricName = METRIC_NAME[language];
  const noDataText = NO_DATA_TEXT[language];
  const formatTooltipValue = (v: number) => {
    const valNum = Number(v);
    const isEmpty = v == null || Number.isNaN(valNum) || valNum === 0;
    return isEmpty ? noDataText : `${valNum.toFixed(2)}%`;
  };

  const formatTooltipLabel = (label: string, items: any[]) => {
    const actualLabel = items?.[0]?.payload?.label ?? label;
    const v = Number(items?.[0]?.value);
    const empty = v == null || Number.isNaN(v) || v === 0;
    
    const prefix = language === "pl" ? "Źródło: " : language === "no" ? "Kilde: " : "Source: ";
    const suffix = empty
      ? language === "pl" ? " (brak danych)" : language === "no" ? " (ingen data)" : " (no data)"
      : "";
    
    return `${prefix}${actualLabel}${suffix}`;
  };

  return (
    <div className="w-full flex flex-col flex-1 min-h-0">
      <h3 className="text-m font-semibold mb-8 text-gray-800 dark:text-gray-100">
        {title ?? t.fakeNewsSources}
      </h3>

      <div className="flex-1 h-full min-h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{ top: 8, right: 16, left: 4, bottom: 12 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--chart-grid)"
              strokeDasharray="3 4"
            />

            <XAxis
              dataKey="label"
              interval={0}
              angle={-15}
              textAnchor="end"
              tickMargin={8}
              height={40}
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "#6B7280", strokeWidth: 1 }}
            />

            <YAxis
              allowDecimals={false}
              tickCount={5}
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "#6B7280", strokeWidth: 1 }}
            />

            <Tooltip
              formatter={(v: number) => [formatTooltipValue(v), metricName]}
              labelFormatter={formatTooltipLabel}
              contentStyle={{
                backgroundColor: "#1f2937",
                color: "#fff",
                borderRadius: 8,
                border: "none",
              }}
              itemStyle={{ color: "#e5e7eb" }}
              labelStyle={{ color: "#e5e7eb" }}
              cursor={{ fill: "rgba(59,130,246,0.06)" }}
            />

            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {rows.map((r, i) => (
                <Cell
                  key={i}
                  fill="#3b82f6"
                  fillOpacity={r.value ? 1 : 0.35}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-8 text-s text-center text-gray-500 dark:text-gray-400">
        {note}
      </p>
    </div>
  );
}