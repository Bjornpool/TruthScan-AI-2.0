/**
 * Komponent odpowiedzialny za generowanie i eksport widoku do pliku PDF.
 *
 * Odpowiada za:
 * - opakowanie przekazanej treści w strukturę raportu,
 * - integrację z mechanizmem eksportu PDF po stronie klienta,
 * - obsługę akcji rozpoczęcia i zakończenia eksportu.
 */

import React, { useRef } from 'react';
import { usePDFExport } from '../app/hooks/usePDFExport';

interface PDFGeneratorProps {
  children: React.ReactNode;
  title?: string;
  fileName?: string;
  showButton?: boolean;
  buttonText?: string;
  buttonClass?: string;
  onExportStart?: () => void;
  onExportEnd?: () => void;
}

const PDFGenerator: React.FC<PDFGeneratorProps> = ({
  children,
  title = 'ThruScan_Analysis',
  fileName = 'ThruScan_Analysis',
  showButton = true,
  buttonText = 'Eksportuj do PDF',
  buttonClass = 'bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600',
  onExportStart,
  onExportEnd
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const handleExportPDF = usePDFExport(contentRef, { title });

  const handlePrint = async () => {
    onExportStart?.();
    try {
      await handleExportPDF();
    } finally {
      onExportEnd?.();
    }
  };

  return (
    <div className="pdf-generator">
      {showButton && (
        <div className="pdf-generator-controls no-print mb-4">
          <button
            onClick={handlePrint}
            className={buttonClass}
            title={`Export ${fileName} as PDF`}
          >
            {buttonText}
          </button>
        </div>
      )}
      
      <div 
        ref={contentRef} 
        className="pdf-content bg-white p-6 rounded-lg shadow-sm"
      >
        <header className="pdf-header mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          <div className="text-sm text-gray-500">
            Wygenerowano: {new Date().toLocaleDateString('pl-PL')}
          </div>
        </header>
        
        <div className="pdf-body">
          {children}
        </div>
        
        <footer className="pdf-footer mt-8 pt-4 border-t text-sm text-gray-500 text-center">
          ThruScan AI Report • Strona 1
        </footer>
      </div>
    </div>
  );
};

export default PDFGenerator;