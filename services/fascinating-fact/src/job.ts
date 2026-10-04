import { archiveKey } from "./archive.js";
import { CATEGORIES, FactError, approved, publication, utcDate, validateCandidate, validateReview } from "./domain.js";
import type { Candidate, Category, Publication, Review } from "./domain.js";

export interface Transaction {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  setAlarm(time: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}
export interface Store { transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> }
export interface AI {
  generate(category: Category, day: string): Promise<Candidate>;
  review(candidate: Candidate, day: string): Promise<Review>;
}
export interface Job {
  day: string; attempts: number; status: "queued" | "running" | "retry" | "succeeded" | "stopped";
  nextAt: number;
  active?: { id: string; phase: "generation" | "review"; deadline: number };
  failure?: string;
  failurePermanent?: boolean;
}
export interface State { publication?: Publication; job?: Job }
export const MAX_ATTEMPTS = 10;
export const REQUEST_TIMEOUT_MS = 180_000;
const RECOVERY_GRACE_MS = 15_000;
// Older jobs did not persist failure permanence; only known retryable failures may resume.
const LEGACY_RETRYABLE_FAILURES = new Set([
  "openai_timeout", "openai_network_failure", "openai_transient", "openai_invalid_response",
  "openai_incomplete", "evidence_search_missing", "openai_refusal", "openai_invalid_json",
  "evidence_not_retrieved", "invalid_candidate", "invalid_review", "category_mismatch",
  "review_rejected", "interrupted_attempt", "expired_generation", "expired_review",
  "unexpected_failure", "attempts_exhausted"
]);
export class DailyJob {
  constructor(
    private readonly store: Store,
    private readonly ai: AI,
    private readonly now: () => number = Date.now,
    private readonly newId: () => string = () => crypto.randomUUID(),
    private readonly random: () => number = () => {
      const data = new Uint32Array(1); crypto.getRandomValues(data); return data[0] / 0x100000000;
    },
    private readonly log: (event: string, data: Record<string, unknown>) => void =
      (event, data) => console.log(JSON.stringify({ event, ...data }))
  ) {}

  async queue(day: string, bootstrap = false): Promise<"accepted" | "pending" | "published" | "stopped" | "obsolete"> {
    return this.store.transaction(async tx => {
      const now = this.now();
      const state = await tx.get<State>("state") ?? {};
      if (bootstrap && state.publication) return "published";
      if (day !== utcDate(now)) return "obsolete";
      if (state.publication?.public.id === day) return "published";
      if (state.job?.day === day) {
        const job = state.job;
        if (job.status !== "stopped") return "pending";
        const retryable = job.failurePermanent === false ||
          (job.failurePermanent === undefined && LEGACY_RETRYABLE_FAILURES.has(job.failure ?? ""));
        if (!bootstrap || !retryable || job.attempts >= MAX_ATTEMPTS) return "stopped";
        job.status = "queued"; job.nextAt = now; job.active = undefined;
        await tx.put("state", state); await tx.setAlarm(now + 1);
        return "accepted";
      }
      state.job = { day, attempts: 0, status: "queued", nextAt: now };
      await tx.put("state", state);
      await tx.setAlarm(now + 1);
      return "accepted";
    });
  }

  private owned(state: State, id: string): boolean {
    return state.job?.status === "running" && state.job.active?.id === id;
  }

  private async failIn(tx: Transaction, state: State, code: string, permanent: boolean, now: number) {
    const job = state.job!;
    job.active = undefined;
    job.failure = code;
    job.failurePermanent = permanent;
    if (permanent || job.attempts >= MAX_ATTEMPTS || job.day !== utcDate(now)) {
      job.status = "stopped"; await tx.deleteAlarm();
    } else {
      job.status = "retry";
      job.nextAt = now + (job.attempts === 1 ? 300_000 : 600_000);
      if (utcDate(job.nextAt) !== job.day) { job.status = "stopped"; await tx.deleteAlarm(); }
      else await tx.setAlarm(job.nextAt);
    }
    await tx.put("state", state);
  }

  async alarm(): Promise<void> {
    const attempt = await this.store.transaction(async tx => {
      const now = this.now();
      const state = await tx.get<State>("state") ?? {};
      const job = state.job;
      if (!job) { await tx.deleteAlarm(); return null; }
      if (job.day !== utcDate(now)) {
        job.status = "stopped"; job.active = undefined; job.failure = "day_expired";
        await tx.put("state", state); await tx.deleteAlarm(); return null;
      }
      if (state.publication?.public.id === job.day || ["succeeded", "stopped"].includes(job.status)) {
        await tx.deleteAlarm(); return null;
      }
      if (job.status === "running") {
        if (job.active && now < job.active.deadline) { await tx.setAlarm(job.active.deadline); return null; }
        await this.failIn(tx, state, "interrupted_attempt", false, now); return null;
      }
      if (now < job.nextAt) { await tx.setAlarm(job.nextAt); return null; }
      if (job.attempts >= MAX_ATTEMPTS) { await this.failIn(tx, state, "attempts_exhausted", true, now); return null; }
      const id = this.newId();
      job.attempts++;
      job.status = "running";
      job.active = { id, phase: "generation", deadline: now + REQUEST_TIMEOUT_MS + RECOVERY_GRACE_MS };
      await tx.put("state", state); await tx.setAlarm(job.active.deadline);
      return { id, day: job.day, number: job.attempts };
    });
    if (!attempt) return;
    const started = this.now();
    this.log("attempt_started", { day: attempt.day, attempt_id: attempt.id, attempt: attempt.number });
    try {
      const category = CATEGORIES[Math.min(CATEGORIES.length - 1, Math.floor(this.random() * CATEGORIES.length))];
      const candidate = validateCandidate(await this.ai.generate(category, attempt.day));
      const reviewAllowed = await this.store.transaction(async tx => {
        const state = await tx.get<State>("state") ?? {};
        if (!this.owned(state, attempt.id)) return false;
        const now = this.now();
        if (utcDate(now) !== attempt.day || now >= state.job!.active!.deadline) {
          await this.failIn(tx, state, "expired_generation", false, now); return false;
        }
        state.job!.active!.phase = "review";
        state.job!.active!.deadline = now + REQUEST_TIMEOUT_MS + RECOVERY_GRACE_MS;
        await tx.put("state", state); await tx.setAlarm(state.job!.active!.deadline);
        return true;
      });
      if (!reviewAllowed) return;
      const review = validateReview(await this.ai.review(candidate, attempt.day));
      if (!approved(review)) {
        this.log("candidate_rejected", { day: attempt.day, attempt_id: attempt.id, reasons: review.reasons });
        throw new FactError("review_rejected");
      }
      const published = await this.store.transaction(async tx => {
        const state = await tx.get<State>("state") ?? {};
        const now = this.now();
        if (!this.owned(state, attempt.id)) return false;
        if (utcDate(now) !== attempt.day || now >= state.job!.active!.deadline) {
          await this.failIn(tx, state, "expired_review", false, now); return false;
        }
        if (state.publication?.public.id === attempt.day) return false;
        state.publication = publication(candidate, review, now);
        state.job!.status = "succeeded"; state.job!.active = undefined;
        await tx.put(archiveKey(attempt.day), state.publication);
        await tx.put("state", state); await tx.deleteAlarm(); return true;
      });
      if (published) this.log("fact_published", { day: attempt.day, attempt_id: attempt.id, duration_ms: this.now() - started });
    } catch (error) {
      const failure = error instanceof FactError ? error : new FactError("unexpected_failure");
      const outcome = await this.store.transaction(async tx => {
        const state = await tx.get<State>("state") ?? {};
        if (!this.owned(state, attempt.id)) return null;
        await this.failIn(tx, state, failure.code, failure.permanent, this.now());
        return { status: state.job!.status, next_at: state.job!.status === "retry" ? state.job!.nextAt : null };
      });
      if (outcome) this.log("attempt_failed", { day: attempt.day, attempt_id: attempt.id, code: failure.code,
        duration_ms: this.now() - started, ...outcome });
    }
  }
}
