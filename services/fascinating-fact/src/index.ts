import { DurableObject } from "cloudflare:workers";
import { OpenAI } from "./ai.js";
import type { PublicFact } from "./domain.js";
import { DailyJob } from "./job.js";
import type { State, Store } from "./job.js";

export interface Env {
  DAILY_FACT: DurableObjectNamespace<DailyFactStore>;
  OPENAI_API_KEY?: string;
  BOOTSTRAP_TOKEN?: string;
  OPENAI_MODEL: string;
  OPENAI_BUDGET_ENFORCED: string;
}
function ready(env: Env) {
  return !!env.OPENAI_API_KEY && !!env.OPENAI_MODEL && env.OPENAI_BUDGET_ENFORCED === "true";
}
export class DailyFactStore extends DurableObject<Env> {
  private readonly job: DailyJob;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const store: Store = { transaction: callback => ctx.storage.transaction(tx => callback(tx)) };
    this.job = new DailyJob(store, new OpenAI(env.OPENAI_API_KEY ?? "", env.OPENAI_MODEL, fetch, undefined, ready(env)));
  }
  async getFact(): Promise<PublicFact | null> {
    return (await this.ctx.storage.get<State>("state"))?.publication?.public ?? null;
  }
  async start(day: string, bootstrap: boolean) {
    if (!ready(this.env)) return "unconfigured" as const;
    return this.job.queue(day, bootstrap);
  }
  async alarm() { await this.job.alarm(); }
}
import { handler } from "./http.js";
export default handler;
