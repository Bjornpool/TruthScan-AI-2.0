/**
 * Hook odpowiedzialny za pobieranie i wstępne czyszczenie treści artykułów.
 */

import { useCallback } from 'react';

export const useArticleContent = () => {
  const fetchFullContent = useCallback(async (url: string): Promise<string> => {
    try {
      console.log("🔄 Pobieranie pełnej treści z:", url);
      // Pobranie treści artykułu przez proxy (obejście CORS)
      const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'pl,en-US;q=0.7,en;q=0.3',
      },
      signal: AbortSignal.timeout(15000),
    });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const html = await response.text();
    
    if (!html || html.length < 500) {
      console.log("⚠️ Treść zbyt krótka lub pusta");
      return "";
    }
      // Parsowanie HTML i usunięcie elementów nienależących do treści
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const elementsToRemove = doc.querySelectorAll(
        'script, style, nav, header, footer, aside, .ad, .ads, [class*="ad-"], .navigation, .menu, .social, .share, .comments, iframe'
      );
      elementsToRemove.forEach(el => el.remove());
      
      // Próba znalezienia głównej treści artykułu
      const contentSelectors = [
        'article',
        '.article-content',
        '.post-content',
        '.entry-content',
        '.story-content',
        '.news-content',
        '.content-area',
        '[role="main"]',
        'main',
        '.content',
        '.story__content',
        '.article-body',
        '.article-text',
        '.post-body',
        '.news-body',
        '.td-post-content',
        '.single-content',
        '.article__content'
      ];
      
      let contentElement = null;
      for (const selector of contentSelectors) {
        const element = doc.querySelector(selector);
        if (element && element.textContent && element.textContent.length > 200) {
          contentElement = element;
          break;
        }
      }
      
      let content = '';
      if (contentElement) {
        content = contentElement.textContent || '';
      } else {
        const paragraphs = doc.querySelectorAll('p');
        const paragraphTexts = Array.from(paragraphs)
          .map(p => p.textContent?.trim())
          .filter(text => text && text.length > 50) 
          .slice(0, 20); 
        
        content = paragraphTexts.join('\n\n');
      }
      
      content = content
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
      
      if (content.length < 100) {
        console.log("⚠️ Za mało treści, próbuję fallback...");
        const metaDescription = doc.querySelector('meta[name="description"]')?.getAttribute('content');
        const ogDescription = doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
        
        content = metaDescription || ogDescription || doc.title || '';
      }
      
      console.log("✅ Pobrano treść, długość:", content.length);
      return content;
      
    } catch (error) {
      console.error("❌ Błąd pobierania treści:", error);
      
      try {
        console.log("🔄 Próba bez proxy...");
        const directResponse = await fetch(url, {
          mode: 'no-cors', 
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        // Fallback w przypadku błędu pobierania treści
        return "";
      } catch (directError) {
        console.error("❌ Błąd przy próbie bez proxy:", directError);
        return "";
      }
    }
  }, []);

  return { fetchFullContent };
};