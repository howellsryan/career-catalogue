# Fascinating Fact API

One shared English fact, generated internally at 01:00 UTC and published only after an independent automated evidence review. Public requests read stored content and cannot initiate AI calls.

## Architecture

The TypeScript Worker owns HTTP routes and the daily cron. One SQLite-backed Durable Object named daily-fact owns the publication and transactional job state. Generation and review call the configured OpenAI model with web search. Evidence stays internal. Workers Caching stores successful reads for 60 seconds; publication changes may take up to one minute to appear at every edge location.

No fact archive, historical endpoint, repetition index, UI, or separate database is included.

## API

GET /v1/fact returns schema_version, id, title, fact, explanation, category, fact_date, and published_at. Dates describe the actual publication, including when a previous day's fact remains available. There is no stale flag and no citation field.

HEAD and public CORS preflights are supported. Queries are rejected. Before any publication or when a canonical read fails, return 503 {"error":"fact_unavailable"}, never an AI request. Successful reads use Cache-Control: public, max-age=0, s-maxage=60, must-revalidate. Errors are not cached.

## Setup and release prerequisites

Use Node 22 or newer from this service directory:

    npm ci
    npm run check

Runtime secrets are separate from Cloudflare Builds variables:

    npx wrangler secret put OPENAI_API_KEY
    npx wrangler secret put BOOTSTRAP_TOKEN

OPENAI_API_KEY must be the dedicated credential agreed for this service. BOOTSTRAP_TOKEN must contain at least 32 characters and be randomly generated. Never commit credentials, write them to build output, or put them in command arguments.

OPENAI_MODEL is gpt-6.1-sol. Do not substitute another model silently. Run npm run verify-model in a securely configured operator environment to check availability. That read-only check does not prove web-search/structured-output capability; the initial bootstrap verifies the complete integration.

OPENAI_BUDGET_ENFORCED is enabled for this deployment following operator confirmation of a blocking OpenAI spending control. For any new account or project, keep it false until verifying that the actual OpenAI spending control blocks requests when the allowance is exhausted. Budget alerts alone are insufficient. The application implements no monetary cap and cannot track unrelated shared-plan spending. This release prerequisite belongs to the operator; do not enable generation merely because an alert exists.

Missing credentials or an unconfirmed spending control leaves generation disabled. Public stored reads still work.

## First publication

After model/budget verification and deployment, invoke:

    npm run bootstrap -- https://fascinating-fact.<account-subdomain>.workers.dev

The script prompts for the token without echoing it. It also accepts BOOTSTRAP_TOKEN from a securely prepared environment. Do not paste secrets into shell history.

The protected POST /internal/bootstrap accepts no body, query, prompt, fact, date, model override, or allowance override. It queues the ordinary daily job; acceptance is not a publication success. Observe fact_published in Cloudflare logs and GET /v1/fact.

Bootstrap shares the daily attempt limit with cron and becomes permanently unavailable after the first publication. Remove BOOTSTRAP_TOKEN from Cloudflare after that success:

    npx wrangler secret delete BOOTSTRAP_TOKEN

A protected bootstrap can resume a retryable stopped initial job when its recorded attempt count is below the current daily limit, for example after increasing that limit. It preserves the existing count; it cannot restart billing/permanent failures or a job that has used all ten attempts. Older jobs without a persisted failure classification resume only for known retryable failures. Deployments do not bootstrap or erase state.

## Retry and recovery

Ten TOTAL attempts per UTC day, not ten retries in addition to the first attempt. Each attempt has one generation request and at most one separate review request. Automatic SDK retries are absent. Retry after 5 minutes following attempt one and 10 minutes after every subsequent retryable failure while allowance remains.

Each model request has a 180-second deadline, a 4,000-output-token limit and at most four hosted search/tool calls. Provider usage includes those tools. Duplicate alarms, concurrent schedules, and restart recovery obey durable ownership markers. Interrupted requests are not replayed within an attempt; their watchdog consumes the attempt and schedules the next allowed one. Superseded or previous-day responses cannot publish.

Rejection, malformed output, refusal, network error and timeout are retryable within the allowance. Billing/quota rejection and permanent model/configuration errors stop that day. A previous fact remains published indefinitely if replacements fail. Exactly one new fact each day cannot be guaranteed during provider failures, evidence rejection or exhausted quota.

## Evidence and content

Both prompts exclude graphic/adult content and require clear, engaging English. Generation targets a randomly selected broad category without historical deduplication. The reviewer independently retrieves supporting sources and checks fascination, format, audience restrictions, and every factual claim.

Accepted evidence must be an authoritative supporting primary source or independent reputable corroboration. Developing news and disputed claims require corroboration. Source URLs must occur in provider evidence-retrieval output, not just be invented in model JSON. Automated evidence review reduces factual errors but is not an absolute correctness guarantee.

## Cloudflare Builds

Connect howellsryan/career-catalogue to this Worker:

- Production branch: main.
- Root directory: services/fascinating-fact.
- Build command: npm ci && npm run check.
- Deploy command: npm run deploy.
- No preview/staging deployments or live OpenAI calls in builds.
- Every main push builds; failed checks prevent deployment.
- Keep runtime secrets in Worker settings, not build variables.

Use the pinned Wrangler version in package.json. The v1 migration creates the SQLite-backed class. Never delete or rename the class, singleton name, or binding without a deliberate migration. Rolling code back must preserve the existing namespace and storage.

## Observability

Cloudflare Workers observability is enabled. Events include daily_schedule, attempt_started, openai_response, candidate_rejected, attempt_failed, fact_published, publication_read_failed and daily_schedule_failed.

Records include job date, attempt identifier, phase, duration, provider request IDs, usage when available, and failure classification. They exclude credentials and authorisation headers. Inspect stopped jobs and billing failures in Cloudflare logs; normal operation requires no human review.

## Verification

npm run check generates runtime types, type-checks the service, runs the behaviour suite and a real local Workers runtime smoke test, then runs a Wrangler deployment dry run. Tests use fake provider responses and never require or call a live OpenAI key. No browser UI exists to inspect; interaction checks exercise JSON, status codes, CORS, authentication and scheduled delivery.
