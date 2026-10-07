import { ARCHIVE_PREFIX, HISTORY_PAGE_SIZE, archiveCurrent, archiveKey, historyPage } from "./archive.js";
import { DurableObject } from "cloudflare:workers";
import { OpenAI } from "./ai.js";
import { FREE_MODEL, dailyTokenBudget } from "./budget.js";
import type { FactHistory, Publication, PublicFact } from "./domain.js";
import { DailyJob } from "./job.js";
import type { State, Store } from "./job.js";

export interface Env {
  DAILY_FACT: DurableObjectNamespace<DailyFactStore>;
  OPENAI_API_KEY?: string;
  BOOTSTRAP_TOKEN?: string;
  OPENAI_MODEL: string;
  OPENAI_BUDGET_ENFORCED: string;
  OPENAI_DAILY_TOKEN_BUDGET?: string;
}
function ready(env: Env) {
  return !!env.OPENAI_API_KEY && env.OPENAI_MODEL === FREE_MODEL && env.OPENAI_BUDGET_ENFORCED === "true" && dailyTokenBudget(env.OPENAI_DAILY_TOKEN_BUDGET) > 0;
}
export class DailyFactStore extends DurableObject<Env> {
  private readonly job: DailyJob;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(() => ctx.storage.transaction(tx => archiveCurrent(tx)));
    const store: Store = { transaction: callback => ctx.storage.transaction(tx => callback(tx)) };
    this.job = new DailyJob(store, new OpenAI(env.OPENAI_API_KEY ?? "", env.OPENAI_MODEL, fetch, undefined, ready(env)),
      undefined, undefined, undefined, undefined, dailyTokenBudget(env.OPENAI_DAILY_TOKEN_BUDGET));
  }
  async getFact(): Promise<PublicFact | null> {
    return (await this.ctx.storage.get<State>("state"))?.publication?.public ?? null;
  }
  async getFactByDate(day: string): Promise<PublicFact | null> {
    return (await this.ctx.storage.get<Publication>(archiveKey(day)))?.public ?? null;
  }
  async listFacts(before?: string): Promise<FactHistory> {
    const entries = await this.ctx.storage.list<Publication>({
      prefix: ARCHIVE_PREFIX, reverse: true, limit: HISTORY_PAGE_SIZE + 1,
      ...(before ? { end: archiveKey(before) } : {})
    });
    return historyPage([...entries.values()]);
  }
  async start(day: string, bootstrap: boolean) {
    if (!ready(this.env)) return "unconfigured" as const;
    return this.job.queue(day, bootstrap);
  }
  async alarm() { await this.job.alarm(); }
}
import { handler } from "./http.js";
export default handler;
