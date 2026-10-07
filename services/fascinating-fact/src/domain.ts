export const CATEGORIES = ["news", "history", "science", "nature", "sport", "human", "technology", "culture", "other"] as const;
export type Category = typeof CATEGORIES[number];
export interface Evidence { url: string; publisher: string; quote: string; primary: boolean; published_at: string | null }
export interface Candidate { title: string; fact: string; explanation: string; category: Category; sources: Evidence[] }
export interface Review {
  fascinating: boolean; specification: boolean; factual: boolean; reasons: string[];
  claims: { claim: string; supported: boolean; source_urls: string[] }[];
  sources: Evidence[];
}
export interface PublicFact {
  schema_version: 1; id: string; title: string; fact: string; explanation: string;
  category: Category; fact_date: string; published_at: string;
}
export interface FactSummary { id: string; fact_date: string; title: string; category: Category; published_at: string }
export interface FactHistory { schema_version: 1; facts: FactSummary[]; next_before: string | null }
export function validFactDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export interface Publication { public: PublicFact; candidate: Candidate; review: Review }
export class FactError extends Error {
  constructor(public readonly code: string, public readonly permanent = false) { super(code); }
}
export const utcDate = (time: number) => new Date(time).toISOString().slice(0, 10);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max;
function exact(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
export function sourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    return url.href;
  } catch { return null; }
}
function evidence(value: unknown): value is Evidence[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 8 && value.every(item =>
    record(item) && exact(item, ["url", "publisher", "quote", "primary", "published_at"]) &&
    sourceUrl(item.url) !== null && text(item.publisher, 200) && text(item.quote, 1500) &&
    typeof item.primary === "boolean" &&
    (item.published_at === null || (typeof item.published_at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.published_at))));
}
const words = (value: string) => value.trim().split(/\s+/u).length;
const cleanPublicText = (value: string) => !/https?:\/\/|\[\d+\]|\[[^\]]+\]\(/u.test(value);
export function validateCandidate(value: unknown): Candidate {
  if (!record(value) || !exact(value, ["title", "fact", "explanation", "category", "sources"]) ||
      !text(value.title, 200) || !text(value.fact, 2000) || !text(value.explanation, 1200) ||
      !CATEGORIES.includes(value.category as Category) || !evidence(value.sources)) throw new FactError("invalid_candidate");
  if (words(value.title) < 4 || words(value.title) > 12 ||
      words(value.fact) < 40 || words(value.fact) > 100 ||
      words(value.explanation) < 20 || words(value.explanation) > 60 ||
      ![value.title, value.fact, value.explanation].every(cleanPublicText)) throw new FactError("invalid_candidate");
  return value as unknown as Candidate;
}
export function validateReview(value: unknown): Review {
  if (!record(value) || !exact(value, ["fascinating", "specification", "factual", "reasons", "claims", "sources"]) ||
      !["fascinating", "specification", "factual"].every(k => typeof value[k] === "boolean") ||
      !Array.isArray(value.reasons) || value.reasons.length < 1 || value.reasons.length > 8 ||
      !value.reasons.every(r => text(r, 500)) || !evidence(value.sources) ||
      !Array.isArray(value.claims) || value.claims.length < 1 || value.claims.length > 12 ||
      !value.claims.every(c => record(c) && exact(c, ["claim", "supported", "source_urls"]) &&
        text(c.claim, 500) && typeof c.supported === "boolean" && Array.isArray(c.source_urls) &&
        c.source_urls.length >= 1 && c.source_urls.length <= 8 && c.source_urls.every(u => sourceUrl(u) !== null))) {
    throw new FactError("invalid_review");
  }
  return value as unknown as Review;
}
export function approved(review: Review): boolean {
  const known = new Set(review.sources.map(s => sourceUrl(s.url)));
  const used = new Set(review.claims.flatMap(c => c.source_urls.map(u => sourceUrl(u))));
  const usedSources = review.sources.filter(s => used.has(sourceUrl(s.url)));
  const independentHosts = new Set(usedSources.map(s => new URL(s.url).hostname.replace(/^www\./, "")));
  return review.claims.length > 0 && review.fascinating && review.specification && review.factual &&
    review.claims.every(c => c.supported && c.source_urls.every(u => known.has(sourceUrl(u)))) &&
    (usedSources.some(s => s.primary) || independentHosts.size >= 2);
}
export function publication(candidate: Candidate, review: Review, now: number): Publication {
  const day = utcDate(now);
  return { candidate, review, public: {
    schema_version: 1, id: day, title: candidate.title, fact: candidate.fact,
    explanation: candidate.explanation, category: candidate.category, fact_date: day,
    published_at: new Date(now).toISOString()
  }};
}
