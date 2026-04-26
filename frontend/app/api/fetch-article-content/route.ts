/**
 * Endpoint API odpowiedzialny za pobieranie i ekstrakcję treści artykułów.
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    console.log('Fetching BBC article from:', url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Ekstrakcja treści (BBC → fallback ogólny)
    let text = extractBBCArticleContent(html);
    if (!text || text.length < 300) {
      text = extractGenericArticleContent(html);
    }
    
    console.log('Extracted article length:', text.length);
    
    return NextResponse.json({ 
      content: text,
      success: true,
      contentLength: text.length
    });
    
  } catch (error) {
    console.error('Error fetching article:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch article content',
      success: false 
    }, { status: 500 });
  }
}

  /**
 * Ekstrakcja treści artykułu dla serwisu BBC.
 */
function extractBBCArticleContent(html: string): string {
  console.log('Extracting BBC article content...');
  const bbcSelectors = [
    /<main[^>]*id="main-content"[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*data-component="text-block"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*ssrcss-1ocoo3l-Wrap[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*story-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*data-entityid="story-content"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const regex of bbcSelectors) {
    const matches = html.match(regex);
    if (matches) {
      let content = '';
      if (regex.flags.includes('g')) {
        for (let i = 0; i < matches.length; i++) {
          content += matches[i] + ' ';
        }
      } else {
        content = matches[1] || matches[0];
      }
      
      const cleaned = cleanArticleContent(content);
      if (cleaned.length > 200) {
        console.log('Found BBC content with selector');
        return cleaned;
      }
    }
  }

  return '';
}

/**
 * Ogólna metoda ekstrakcji treści dla pozostałych serwisów.
 */
function extractGenericArticleContent(html: string): string {
  console.log('Using generic extraction...');
  
  const genericSelectors = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*story[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const regex of genericSelectors) {
    const match = html.match(regex);
    if (match && match[1]) {
      const content = cleanArticleContent(match[1]);
      if (content.length > 200) {
        return content;
      }
    }
  }

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch && bodyMatch[1]) {
    return cleanAndFilterContent(bodyMatch[1]);
  }

  return cleanAndFilterContent(html);
}

/**
 * Usuwa znaczniki HTML oraz elementy nienależące do treści artykułu.
 */
function cleanArticleContent(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, '')
    .replace(/<header\b[\s\S]*?<\/header>/gi, '')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, '')
    .replace(/<form\b[\s\S]*?<\/form>/gi, '')
    .replace(/<button\b[\s\S]*?<\/button>/gi, '')
    .replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<figure\b[\s\S]*?<\/figure>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Dodatkowe filtrowanie treści:
 * usuwa szum informacyjny (nawigacja, reklamy, social media).
 */
function cleanAndFilterContent(text: string): string {
  const noisePatterns = [
    /menu|navigation|nav|home|skip to content|skip to main|main menu/gi,
    /header|footer|sidebar|side-bar|panel boczny/gi,
    /share|udostępnij|comment|komentarz|like|follow|subscribe/gi,
    /facebook|twitter|instagram|youtube|linkedin|social media/gi,
    /reklama|advertisement|ads?|sponsored|promoted|partner/gi,
    /bbc\.com|bbc\.co\.uk|bbc news|bbc sport|bbc iplayer/gi,
    /home news|sport|business|innovation|culture|arts|travel/gi,
    /weather|climate|audio|video|live|newsletters|podcast/gi,
    /copyright|all rights reserved|privacy policy|terms of use/gi,
    /cookie policy|contact us|about us|o nas|regulamin/gi,
  ];

  let cleaned = text;
  
  const lines = cleaned.split('\n').filter(line => {
    const trimmed = line.trim();
    if (trimmed.length < 20) return false;
    
    for (const pattern of noisePatterns) {
      if (pattern.test(trimmed)) {
        return false;
      }
    }
    
    const hasProperSentence = /[.!?]/.test(trimmed) && trimmed.split(' ').length > 5;
    const isNoise = /^[^a-zA-Z]*$/.test(trimmed) || trimmed.includes('<!--') || trimmed.includes('-->');
    
    return hasProperSentence && !isNoise;
  });

  cleaned = lines.join('\n');
  
  for (const pattern of noisePatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned
    .replace(/\s+/g, ' ')
    .replace(/([.!?])\s+/g, '$1\n\n')
    .trim()
    .substring(0, 10000);
}