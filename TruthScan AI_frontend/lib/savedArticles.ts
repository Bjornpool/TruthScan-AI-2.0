/**
 * Warstwa persystencji zapisanych artykułów — Supabase.
 *
 * Każda sesja przeglądarki otrzymuje unikalny session_id (UUID przechowywany
 * w localStorage), dzięki czemu artykuły są izolowane między sesjami.
 */

import { supabase } from "./supabase";
import type { Article } from "./fetchNews";

const SESSION_KEY = "truthscan_session_id";

export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export async function saveArticle(article: Article): Promise<void> {
  const session_id = getSessionId();
  const { error } = await supabase.from("saved_articles").insert({
    session_id,
    title:            article.title,
    description:      article.description ?? article.summary ?? null,
    content:          article.content ?? null,
    url:              article.url ?? article.link ?? null,
    source:           article.source,
    sentiment:        article.sentiment ?? null,
    fake_probability: article.fake_probability ?? null,
    published_at:     article.publishedAt ?? article.published ?? null,
  });

  if (error) throw error;
}

export async function getSavedArticles(): Promise<Article[]> {
  const session_id = getSessionId();
  const { data, error } = await supabase
    .from("saved_articles")
    .select("*")
    .eq("session_id", session_id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id:               row.id,
    title:            row.title,
    description:      row.description,
    content:          row.content,
    url:              row.url,
    link:             row.url,
    source:           row.source,
    sentiment:        row.sentiment,
    fake_probability: row.fake_probability,
    publishedAt:      row.published_at,
    published:        row.published_at,
  }));
}

export async function deleteSavedArticle(title: string): Promise<void> {
  const session_id = getSessionId();
  const { error } = await supabase
    .from("saved_articles")
    .delete()
    .eq("session_id", session_id)
    .eq("title", title);

  if (error) throw error;
}
