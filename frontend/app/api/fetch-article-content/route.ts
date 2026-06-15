/**
 * Endpoint API zwracający treść artykułu z Supabase.
 * Zamiast pobierać zewnętrzne strony (CORS, rate-limit), odczytuje
 * pola content/description już zapisane przy zapisywaniu artykułu.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  console.log('Fetching URL:', url);

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('saved_articles')
      .select('content, description')
      .eq('url', url)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log('Supabase error:', error.message);
      return NextResponse.json({ error: 'Supabase query failed', success: false }, { status: 500 });
    }

    if (!data) {
      console.log('Article not found for URL:', url);
      return NextResponse.json({ content: '', success: false, contentLength: 0 });
    }

    const raw =
      data.content && data.content.length >= 200
        ? data.content
        : (data.description ?? data.content ?? '');

    const text = cleanArticleContent(raw);

    console.log('Content length:', text.length);

    return NextResponse.json({
      content: text,
      success: true,
      contentLength: text.length,
    });
  } catch (error) {
    console.error('Error fetching from Supabase:', error);
    return NextResponse.json({ error: 'Internal error', success: false }, { status: 500 });
  }
}

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
