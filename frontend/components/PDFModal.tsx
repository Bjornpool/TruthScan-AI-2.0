/**
 * Modal odpowiedzialny za prezentację podglądu i eksport analizy artykułu do PDF.
 *
 * Odpowiada za:
 * - wyświetlenie podglądu raportu analitycznego w oknie modalnym,
 * - przekazanie danych artykułu do generatora PDF (inline CSS, window.print),
 * - obsługę stanu ładowania pełnej treści artykułu,
 * - inicjację i zakończenie procesu eksportu.
 */

"use client";

import React from 'react';
import PDFGenerator from './PDFGenerator';
import { Article } from '../lib/fetchNews';
import type { Lang } from '../lib/types';

interface PDFModalProps {
  article: Article;
  language: Lang;
  sentimentLabel: string;
  sentimentColor: string;
  fullContent: string;
  isLoadingContent: boolean;
  showPDF: boolean;
  onClose: () => void;
  onExportStart: () => void;
  onExportEnd: () => void;
}

export default function PDFModal({
  article,
  language,
  sentimentLabel,
  sentimentColor,
  fullContent,
  isLoadingContent,
  showPDF,
  onClose,
  onExportStart,
  onExportEnd,
}: PDFModalProps) {
  if (!showPDF) return null;

  const T = (pl: string, no: string, en: string) =>
    language === 'pl' ? pl : language === 'no' ? no : en;

  const docTitle = `TruthScan_${article.title.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/gi, '_')}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {T('Eksport PDF', 'PDF-eksport', 'PDF Export')} — {article.title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          <PDFGenerator
            title={`${T('Analiza', 'Analyse', 'Analysis')}: ${article.title}`}
            showButton={true}
            buttonText={T('Drukuj do PDF', 'Skriv ut til PDF', 'Print to PDF')}
            buttonClass="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700"
            onExportStart={onExportStart}
            onExportEnd={onExportEnd}
            articleData={{
              title: article.title,
              source: article.source,
              published: article.published || article.publishedAt,
              sentimentLabel,
              fakeProbability: article.fake_probability,
              content: fullContent || article.summary || article.description || '',
              link: article.link || article.url,
              language,
            }}
          >
            {/* Podgląd w modalu — tylko do prezentacji, PDF budowany z danych powyżej */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">{article.title}</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                  <div>
                    <strong>{T('Źródło', 'Kilde', 'Source')}:</strong><br />
                    <span className="text-blue-600">{article.source}</span>
                  </div>
                  <div>
                    <strong>{T('Data publikacji', 'Publiseringsdato', 'Publication date')}:</strong><br />
                    {article.published || article.publishedAt}
                  </div>
                  <div>
                    <strong>{T('Sentyment', 'Sentimentanalyse', 'Sentiment')}:</strong><br />
                    <span className={sentimentColor}>{sentimentLabel}</span>
                  </div>
                  <div>
                    <strong>{T('Prawd. Fake News', 'Sannsynlighet falske nyheter', 'Fake News Prob.')}:</strong><br />
                    {typeof article.fake_probability === 'number'
                      ? `${article.fake_probability.toFixed(2)}%`
                      : 'N/A'}
                  </div>
                </div>
              </div>

              <section>
                <h2 className="text-xl font-semibold mb-3 text-gray-800 border-b pb-2">
                  {T('Pełna treść artykułu', 'Fullstendig artikkelinnhold', 'Full Article Content')}
                </h2>
                <div className="bg-gray-50 p-4 rounded-lg">
                  {isLoadingContent ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                      <p className="mt-2 text-gray-600">
                        {T('Pobieranie pełnej treści...', 'Laster inn fullstendig innhold...', 'Loading full content...')}
                      </p>
                    </div>
                  ) : (
                    <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                      {fullContent || article.summary || article.description ||
                        T('Brak dostępnej treści', 'Ingen innhold tilgjengelig', 'No content available')}
                    </div>
                  )}

                  {fullContent && fullContent.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded text-sm text-blue-700">
                      ℹ️ {T(
                        'Treść pobrana automatycznie z oryginalnego źródła',
                        'Innhold automatisk hentet fra original kilde',
                        'Content automatically fetched from original source',
                      )}
                    </div>
                  )}
                </div>
              </section>

              {article.link && (
                <section>
                  <h2 className="text-xl font-semibold mb-3 text-gray-800 border-b pb-2">
                    {T('Link do oryginalnego artykułu', 'Original artikkellenke', 'Original Article Link')}
                  </h2>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <a
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 break-all hover:text-blue-800"
                    >
                      {article.link}
                    </a>
                  </div>
                </section>
              )}

              <section className="text-sm text-gray-500 mt-8 pt-4 border-t">
                <p><strong>{T('Wygenerowano przez TruthScan Analysis', 'Generert av TruthScan Analysis', 'Generated by TruthScan Analysis')}</strong></p>
                <p>{new Date().toLocaleDateString(
                  language === 'pl' ? 'pl-PL' : language === 'no' ? 'nb-NO' : 'en-US',
                  { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' },
                )}</p>
              </section>
            </div>
          </PDFGenerator>
        </div>
      </div>
    </div>
  );
}
