/**
 * Hook umożliwiający eksport wybranego fragmentu interfejsu do PDF (druk przeglądarki).
 */

import { useCallback } from 'react';

interface PDFOptions {
  title?: string;
  margins?: string;
}

export const usePDFExport = (
  componentRef: React.RefObject<HTMLDivElement | null>,
  options: PDFOptions = {}
) => {
  const {
    title = 'ThruScan_Analysis',
    margins = '15mm'
  } = options;

  const handlePrint = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!componentRef.current) {
        reject(new Error('Component reference is not available'));
        return;
      }

      const printWindow = window.open('', '_blank');

      // Fallback: jeśli okno nie może zostać otwarte (blokada popupów),
      // zapisujemy zawartość jako statyczny plik HTML
      if (!printWindow) {
        const content = componentRef.current.innerHTML;
        const blob = new Blob([`
          <!DOCTYPE html>
          <html lang="pl">
          <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
            </style>
          </head>
          <body>${content}</body>
          </html>
        `], { type: 'text/html' });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title}.html`;
        link.click();
        URL.revokeObjectURL(url);
        resolve();
        return;
      }

      try {
        const content = componentRef.current.cloneNode(true) as HTMLDivElement;

        // Usunięcie elementów interaktywnych z eksportowanego widoku
        const interactiveElements = content.querySelectorAll('button, input, select, textarea, .pdf-generator-controls');
        interactiveElements.forEach(el => el.remove());

        const style = `
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            
            @page {
              margin: ${margins};
              size: A4;
            }
            
            body {
              margin: 0;
              padding: 0;
              font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              color: #000;
              background: white;
              line-height: 1.4;
            }
            
            * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            
            .pdf-content {
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              border: none !important;
            }
            
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 10px 0;
            }
            
            th, td { 
              border: 1px solid #ddd; 
              padding: 8px; 
              text-align: left; 
            }
            
            th { 
              background-color: #f5f5f5 !important; 
            }
          </style>
        `;

        printWindow.document.write(`
          <!DOCTYPE html>
          <html lang="pl">
            <head>
              <title>${title}</title>
              <meta charset="UTF-8">
              <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
              ${style}
            </head>
            <body>
              ${content.innerHTML}
            </body>
          </html>
        `);
        
        printWindow.document.close();

        setTimeout(() => {
          printWindow.focus();
          printWindow.print();

          const checkPrint = setInterval(() => {
            if (printWindow.closed) {
              clearInterval(checkPrint);
              resolve();
            }
          }, 100);

          setTimeout(() => {
            if (!printWindow.closed) {
              printWindow.close();
              resolve();
            }
          }, 10000);
          
        }, 1000);
        
      } catch (error) {
        printWindow?.close();
        reject(error);
      }
    });
  }, [componentRef, title, margins]);

  return handlePrint;
};