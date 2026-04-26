/**
 * Sekcja dashboardu umożliwiająca porównanie wielu źródeł informacyjnych.
 *
 * Renderuje zestaw bloków źródeł, pozwalając użytkownikowi analizować
 * i porównywać dane pochodzące z różnych serwisów informacyjnych.
 */

"use client";

import { useState } from "react";
import SourceBlock from "../../../components/SourceBlock";
import locales from "../../../lib/locales";

import type { Lang } from "../../../lib/types";

interface Props {
	language: Lang;
}

const ALL_SOURCES = [
	"BBC", "CNN", "NYTimes", "Guardian", "AlJazeera",
	"Money", "PolsatNews", "TVN24", "SpidersWeb", "Bankier",
	"NRK", "VG", "E24", "Aftenposten",
] as const;

export default function SourceComparison({ language }: Props) {
	const [compareSources, setCompareSources] = useState<string[]>([
		...ALL_SOURCES,
	]);

	const updateCompareSource = (idx: number, src: string) =>
		setCompareSources((prev) => prev.map((s, i) => (i === idx ? src : s)));

	return (
		<section>
			<h2 className="text-2xl font-semibold mb-4">
				{language === "pl" ? "Porównanie źródeł" : language === "no" ? "Kildesammenligning" : "Sources comparison"}
			</h2>

			<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
				{compareSources.map((src, idx) => (
					<SourceBlock
						key={`${idx}-${src}`}
						source={src}
						onChangeSource={(next) => updateCompareSource(idx, next)}
						language={language}
						locales={locales}
					/>
				))}
			</div>
		</section>
	);
}
