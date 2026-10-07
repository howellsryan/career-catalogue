import { archiveKey } from "./archive.js";
import { CATEGORIES, FactError, approved, publication, utcDate, validateCandidate, validateReview } from "./domain.js";
import type { Candidate, Category, Publication, Review } from "./domain.js";
import { DEFAULT_DAILY_TOKEN_BUDGET, MAX_REQUEST_RESERVATION } from "./budget.js";
import type { RequestBudget } from "./budget.js";

export interface Transaction {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  setAlarm(time: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}
export interface Store { transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> }
export interface AI {
  generate(category: Category, day: string, budget: RequestBudget): Promise<Candidate>;
  review(candidate: Candidate, day: string, budget: RequestBudget): Promise<Review>;
}
export interface Job {
  day: string; attempts: number; status: "queued" | "running" | "retry" | "succeeded" | "stopped";
  nextAt: number;
  active?: { id: string; phase: "generation" | "review"; deadline: number; reserved?: boolean };
  budget?: { reservedTokens: number; requests: number };
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
      (event, data) => console.log(JSON.stringify({ event, ...data })),
    private readonly tokenBudget: number = DEFAULT_DAILY_TOKEN_BUDGET
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
      state.job = { day, attempts: 0, status: "queued", nextAt: now, budget: { reservedTokens: 0, requests: 0 } };
      await tx.put("state", state);
      await tx.setAlarm(now + 1);
      return "accepted";
    });
  }

  private owned(state: State, id: string): boolean {
    return state.job?.status === "running" && state.job.active?.id === id;
  }

  private requestBudget(id: string, day: string, phase: "generation" | "review"): RequestBudget {
    let deadline = 0;
    return {
      reserve: async tokens => {
        const result = await this.store.transaction(async tx => {
          const state = await tx.get<State>("state") ?? {};
          const now = this.now();
          if (!this.owned(state, id) || state.job!.day !== day || utcDate(now) !== day ||
              state.job!.active!.phase !== phase || now >= state.job!.active!.deadline) {
            throw new FactError("attempt_not_active");
          }
          const job = state.job!;
          if (job.active!.reserved) throw new FactError("request_already_reserved", true);
          if (!Number.isSafeInteger(tokens) || tokens <= 0 || tokens > MAX_REQUEST_RESERVATION ||
              !Number.isSafeInteger(this.tokenBudget) || this.tokenBudget <= 0 ||
              this.tokenBudget > DEFAULT_DAILY_TOKEN_BUDGET) throw new FactError("openai_budget_configuration", true);
          // Legacy input/tool usage was not bounded or persisted. Fail closed for
          // the rest of that UTC day rather than assume a safe remaining allowance.
          job.budget ??= {
            reservedTokens: job.attempts > 1 || phase === "review" ? this.tokenBudget : 0,
            requests: (job.attempts - 1) * 2 + (phase === "review" ? 1 : 0)
          };
          if (job.budget.reservedTokens + tokens > this.tokenBudget) {
            // Persist the fail-closed legacy reservation even when the first new request is denied.
            await tx.put("state", state);
            return { allowed: false, deadline: job.active!.deadline, total: job.budget.reservedTokens };
          }
          job.budget.reservedTokens += tokens; job.budget.requests++;
          job.active!.reserved = true;
          await tx.put("state", state);
          return { allowed: true, deadline: job.active!.deadline, total: job.budget.reservedTokens };
        });
        if (!result.allowed) throw new FactError("daily_token_budget_exhausted", true);
        deadline = result.deadline;
        this.log("token_budget_reserved", { day, attempt_id: id, phase, tokens,
          reserved_today: result.total, daily_limit: this.tokenBudget });
      },
      remainingMs: () => Math.max(0, deadline - this.now() - RECOVERY_GRACE_MS)
    };
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
      const candidate = validateCandidate(await this.ai.generate(category, attempt.day, this.requestBudget(attempt.id, attempt.day, "generation")));
      const reviewAllowed = await this.store.transaction(async tx => {
        const state = await tx.get<State>("state") ?? {};
        if (!this.owned(state, attempt.id)) return false;
        const now = this.now();
        if (utcDate(now) !== attempt.day || now >= state.job!.active!.deadline) {
          await this.failIn(tx, state, "expired_generation", false, now); return false;
        }
        state.job!.active!.phase = "review"; state.job!.active!.reserved = false;
        state.job!.active!.deadline = now + REQUEST_TIMEOUT_MS + RECOVERY_GRACE_MS;
        await tx.put("state", state); await tx.setAlarm(state.job!.active!.deadline);
        return true;
      });
      if (!reviewAllowed) return;
      const review = validateReview(await this.ai.review(candidate, attempt.day, this.requestBudget(attempt.id, attempt.day, "review")));
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
