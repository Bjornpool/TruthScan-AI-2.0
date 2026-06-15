/**
 * Komponent odpowiedzialny za generowanie i eksport artykułu do pliku PDF.
 *
 * Odpowiada za:
 * - opakowanie podglądu treści raportu,
 * - wywołanie mechanizmu eksportu (window.open + window.print) z inline CSS,
 * - obsługę akcji rozpoczęcia i zakończenia eksportu.
 */

import React from 'react';
import { usePDFExport, ArticlePrintData } from '../app/hooks/usePDFExport';

interface PDFGeneratorProps {
  children: React.ReactNode;
  title?: string;
  showButton?: boolean;
  buttonText?: string;
  buttonClass?: string;
  onExportStart?: () => void;
  onExportEnd?: () => void;
  articleData?: ArticlePrintData;
}

const PDFGenerator: React.FC<PDFGeneratorProps> = ({
  children,
  title = 'TruthScan_Analysis',
  showButton = true,
  buttonText = 'Eksportuj do PDF',
  buttonClass = 'bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600',
  onExportStart,
  onExportEnd,
  articleData,
}) => {
  const printArticle = usePDFExport();

  const handlePrint = () => {
    if (!articleData) return;
    onExportStart?.();
    printArticle(articleData, title);
    onExportEnd?.();
  };

  return (
    <div className="pdf-generator">
      {showButton && (
        <div className="no-print mb-4">
          <button
            onClick={handlePrint}
            disabled={!articleData}
            className={buttonClass}
          >
            {buttonText}
          </button>
        </div>
      )}

      <div className="pdf-content bg-white p-6 rounded-lg shadow-sm">
        <header className="mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          <div className="text-sm text-gray-500">
            Wygenerowano: {new Date().toLocaleDateString('pl-PL')}
          </div>
        </header>

        <div className="pdf-body">
          {children}
        </div>

        <footer className="mt-8 pt-4 border-t text-sm text-gray-500 text-center">
          TruthScan AI Report
        </footer>
      </div>
    </div>
  );
};

export default PDFGenerator;
