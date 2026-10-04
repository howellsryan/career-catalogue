import { utcDate, validFactDate } from "./domain.js";
import type { Env } from "./index.js";

async function authorised(request: Request, token: string | undefined) {
  if (!token || token.length < 32) return false;
  const header = request.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ") || header.length > 4096) return false;
  const encoder = new TextEncoder();
  const [expected, supplied] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(token)),
    crypto.subtle.digest("SHA-256", encoder.encode(header.slice(7)))
  ]);
  const left = new Uint8Array(expected); const right = new Uint8Array(supplied);
  let different = 0;
  for (let i = 0; i < left.length; i++) different |= left[i] ^ right[i];
  return different === 0;
}
// Network transports may represent an empty POST as a non-null body stream.
async function hasBody(request: Request) {
  if (!request.body) return false;
  const reader = request.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return false;
      if (value.byteLength > 0) return true;
    }
  } catch { return true; }
  finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
function json(request: Request, value: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(request.method === "HEAD" ? null : JSON.stringify(value), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};
function singleton(env: Env) { return env.DAILY_FACT.getByName("daily-fact"); }

export const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const latest = url.pathname === "/v1/fact";
    const history = url.pathname === "/v1/facts";
    const dated = url.pathname.startsWith("/v1/facts/");
    if (latest || history || dated) {
      const day = dated ? url.pathname.slice("/v1/facts/".length) : undefined;
      const before = url.searchParams.get("before") ?? undefined;
      if (dated && !validFactDate(day!)) return json(request, { error: "invalid_date" }, 400, cors);
      if (history) {
        if ([...url.searchParams.keys()].some(key => key !== "before") ||
            url.searchParams.getAll("before").length > 1 || (before !== undefined && !validFactDate(before))) {
          return json(request, { error: "invalid_query" }, 400, cors);
        }
      } else if (url.search) return json(request, { error: "query_not_supported" }, 400, cors);
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "Cache-Control": "no-store" } });
      if (!["GET", "HEAD"].includes(request.method)) return json(request, { error: "method_not_allowed" }, 405, { ...cors, Allow: "GET, HEAD, OPTIONS" });
      try {
        const store = singleton(env);
        const result = history ? await store.listFacts(before) : dated ? await store.getFactByDate(day!) : await store.getFact();
        if (!result) return json(request, { error: dated ? "fact_not_found" : "fact_unavailable" }, dated ? 404 : 503, cors);
        return json(request, result, 200, { ...cors, "Cache-Control": dated
          ? "public, max-age=86400, immutable"
          : "public, max-age=0, s-maxage=60, must-revalidate" });
      } catch {
        console.error(JSON.stringify({ event: "publication_read_failed", route: history ? "history" : dated ? "archive" : "latest" }));
        return json(request, { error: history ? "history_unavailable" : "fact_unavailable" }, 503, cors);
      }
    }
    if (url.pathname === "/internal/bootstrap") {
      if (!await authorised(request, env.BOOTSTRAP_TOKEN)) return json(request, { error: "unauthorised" }, 401);
      if (request.method !== "POST") return json(request, { error: "method_not_allowed" }, 405, { Allow: "POST" });
      if (url.search || await hasBody(request)) return json(request, { error: "parameters_not_supported" }, 400);
      try {
        const status = await singleton(env).start(utcDate(Date.now()), true);
        if (status === "unconfigured") return json(request, { error: "generation_not_configured" }, 503);
        if (status === "published") return json(request, { error: "bootstrap_closed" }, 409);
        if (status === "stopped" || status === "obsolete") return json(request, { error: "daily_job_unavailable" }, 409);
        return json(request, { status }, 202);
      } catch { return json(request, { error: "generation_unavailable" }, 503); }
    }
    return json(request, { error: "not_found" }, 404);
  },
  async scheduled(controller: ScheduledController, env: Env) {
    try {
      const result = await singleton(env).start(utcDate(controller.scheduledTime), false);
      console.log(JSON.stringify({ event: "daily_schedule", day: utcDate(controller.scheduledTime), result }));
    } catch { console.error(JSON.stringify({ event: "daily_schedule_failed" })); throw new Error("daily_schedule_failed"); }
  }
};
