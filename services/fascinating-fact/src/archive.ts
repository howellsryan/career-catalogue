import type { FactHistory, Publication } from "./domain.js";
import type { State, Transaction } from "./job.js";

export const HISTORY_PAGE_SIZE = 50;
export const ARCHIVE_PREFIX = "fact:";
export const archiveKey = (day: string) => ARCHIVE_PREFIX + day;

// Preserve the publication from deployments that only stored the latest fact.
export async function archiveCurrent(tx: Transaction): Promise<void> {
  const state = await tx.get<State>("state");
  if (!state?.publication) return;
  const key = archiveKey(state.publication.public.fact_date);
  if (!await tx.get<Publication>(key)) await tx.put(key, state.publication);
}

export function historyPage(publications: Publication[]): FactHistory {
  const facts = publications.slice(0, HISTORY_PAGE_SIZE).map(({ public: fact }) => ({
    id: fact.id, fact_date: fact.fact_date, title: fact.title,
    category: fact.category, published_at: fact.published_at
  }));
  return { schema_version: 1, facts,
    next_before: publications.length > HISTORY_PAGE_SIZE ? facts[facts.length - 1].fact_date : null };
}
