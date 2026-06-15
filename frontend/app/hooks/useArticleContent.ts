/**
 * Hook pobierający pełną treść artykułu przez endpoint FastAPI /fetch-article-content.
 */

import { useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export const useArticleContent = () => {
  const fetchFullContent = useCallback(async (url: string): Promise<string> => {
    if (!url || !url.startsWith('http')) return '';

    try {
      const response = await fetch(
        `${API_BASE}/fetch-article-content?url=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(20000) }
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
