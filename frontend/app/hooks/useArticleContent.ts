/**
 * Hook odpowiedzialny za pobieranie pełnej treści artykułów
 * przez własny endpoint serwerowy /api/fetch-article-content.
 */

import { useCallback } from 'react';

export const useArticleContent = () => {
  const fetchFullContent = useCallback(async (url: string): Promise<string> => {
    if (!url || !url.startsWith('http')) return '';

    try {
      const response = await fetch(
        `/api/fetch-article-content?url=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(15000) }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      if (data.success && typeof data.content === 'string' && data.content.length > 0) {
        return data.content;
      }

      return '';
    } catch (error) {
      console.error('❌ Błąd pobierania treści artykułu:', error);
      return '';
    }
  }, []);

  return { fetchFullContent };
};
