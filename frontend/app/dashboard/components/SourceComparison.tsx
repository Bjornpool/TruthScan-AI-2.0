/**
 * Sekcja dashboardu umożliwiająca porównanie wielu źródeł informacyjnych.
 *
 * Renderuje zestaw bloków źródeł, pozwalając użytkownikowi analizować
 * i porównywać dane pochodzące z różnych serwisów informacyjnych.
 */

"use client";

import { useEffect, useState } from "react";
import SourceBlock from "../../../components/SourceBlock";
import locales from "../../../lib/locales";
import { fetchAllNews } from "../../../lib/fetchNews";
import { useNewsCache, newsKey } from "../../../app/stores/newsCache";

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

	// Prefetch all uncached sources in parallel using REST (not SSE) to bypass
	// the browser's 6-connection-per-domain limit that serialises SSE streams.
	useEffect(() => {
		const cacheState = useNewsCache.getState();
		const missing = ALL_SOURCES.filter((src) => !cacheState.get(newsKey(src)));
		if (missing.length === 0) return;

		fetchAllNews([...missing], language, {
			concurrency: missing.length,
			onPartial: ({ source, articles }) => {
				if (articles.length === 0) return;
				useNewsCache.getState().set(newsKey(source), articles);
			},
		}).catch(() => {});
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

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
