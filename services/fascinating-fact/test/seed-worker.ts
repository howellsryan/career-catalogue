// Local migration fixture only; never referenced by the deployment configuration.
import { DailyFactStore as ProductionStore } from "../src/index.js";
import type { Env } from "../src/index.js";
import type { Publication } from "../src/domain.js";

export class DailyFactStore extends ProductionStore {
  async seed(publications: Publication[]) {
    await this.ctx.storage.transaction(async tx => {
      for (const fact of publications.slice(0, -1)) await tx.put("fact:" + fact.public.fact_date, fact);
      await tx.put("state", { publication: publications[publications.length - 1] });
    });
  }
}
export default {
  async fetch(request: Request, env: Env) {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/test/seed") return new Response(null, { status: 404 });
    const facts = await request.json() as Publication[];
    await (env.DAILY_FACT.getByName("daily-fact") as unknown as DailyFactStore).seed(facts);
    return new Response(null, { status: 204 });
  }
};
