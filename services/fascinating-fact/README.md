# Fascinating Fact API

One shared English fact, generated internally at 01:00 UTC and published only after an independent automated evidence review. Public requests read stored content and cannot initiate AI calls.

## Architecture

The TypeScript Worker owns HTTP routes and the daily cron. One SQLite-backed Durable Object named daily-fact owns the latest publication, immutable daily archive records, and transactional job state. Generation and review use gpt-5.6-terra with strict JSON output and Worker-fetched public evidence. Neither OpenAI request declares tools: there are no hosted searches or paid-model fallbacks. Evidence stays internal. Workers Caching stores successful reads for 60 seconds; publication changes may take up to one minute to appear at every edge location.

The Daily Fact page in Career Catalogue defaults to the latest fact and lets readers select an archived date. No separate database or historical deduplication index is needed.

Approved publications are retained under fact:YYYY-MM-DD in the existing Durable Object. The archive and latest pointer are committed in the same transaction. Failed or rejected generations never enter the archive. Dates are UTC publication dates, not dates mentioned in the content; days without a successful publication have no record.

On startup, an idempotent transaction archives the existing latest publication without changing job state or alarms. Older facts overwritten before this feature cannot be recovered. The existing class, singleton, namespace, and v1 migration remain unchanged. A rollback to older code keeps archive records but stops archiving new publications while that code runs.

## API

GET /v1/fact returns schema_version, id, title, fact, explanation, category, fact_date, and published_at. Dates describe the actual publication, including when a previous day's fact remains available. There is no stale flag and no citation field.

GET /v1/facts returns {"schema_version":1,"facts":[...],"next_before":null}. Each entry contains id, fact_date, title, category, and published_at only. Results are newest first, with up to 50 dates per page. If next_before is a date, request GET /v1/facts?before=YYYY-MM-DD to read the next page; the cursor is exclusive. All approved days are retained, with no archive expiry.

GET /v1/facts/YYYY-MM-DD returns the same public schema as GET /v1/fact for that date. Unpublished dates return 404 {"error":"fact_not_found"}. Invalid calendar dates or malformed/unknown/duplicate queries return 400. Only the history list accepts the optional before parameter. Archive responses contain no internal evidence, citations, or stale flags.

HEAD and public CORS preflights are supported for all three routes. Public write methods are rejected and browsing history never queues a job. Dated facts use Cache-Control: public, max-age=86400, immutable; latest and date-list responses use the existing 60-second shared cache. Storage failures return uncached 503 responses. Before any publication or when a canonical read fails, return 503 {"error":"fact_unavailable"}, never an AI request. Successful reads use Cache-Control: public, max-age=0, s-maxage=60, must-revalidate. Errors are not cached.

## Setup and release prerequisites

Use Node 22 or newer from this service directory:

    npm ci
    npm run check

Runtime secrets are separate from Cloudflare Builds variables:

    npx wrangler secret put OPENAI_API_KEY
    npx wrangler secret put BOOTSTRAP_TOKEN

OPENAI_API_KEY must be the dedicated credential agreed for this service. BOOTSTRAP_TOKEN must contain at least 32 characters and be randomly generated. Never commit credentials, write them to build output, or put them in command arguments.

OPENAI_MODEL is gpt-5.6-terra. Other model IDs are refused rather than falling back to a paid model. Run npm run verify-model in a securely configured operator environment to check availability. The read-only check does not prove structured-output/evidence-review capability; initial bootstrap verifies the complete integration.

Terra is in the 2.5-million-token complimentary daily group for eligible Tier 1/2 (Build-tier) organizations enrolled in OpenAI's data-sharing program. The allowance includes input/output, resets at 00:00 UTC, and is shared by eligible models/projects in the organization. Confirm enrollment for this key's project. This Worker removes hosted-tool fees, but cannot reserve the shared organization-wide pool or see other applications' usage. OpenAI can bill a request crossing the remaining allowance. $0 additional AI cost depends on eligibility and sufficient shared tokens. See https://help.openai.com/en/articles/10306912-sharing-feedback-evaluation-and-fine-tuning-data-and-api-inputs-and-outputs-with-openai for current terms.

OPENAI_BUDGET_ENFORCED is enabled for this deployment following operator confirmation of a blocking OpenAI spending control. For any new account or project, keep it false until verifying that the actual OpenAI spending control blocks requests when the allowance is exhausted. Budget alerts alone are insufficient. The application implements durable local token reservations, not a monetary cap, and cannot track unrelated shared-plan spending. This release prerequisite belongs to the operator; do not enable generation merely because an alert exists.

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

The model selects fetched evidence with zero-based document and excerpt indices. The service copies the selected contiguous excerpts and publisher metadata exactly, then applies the same quotation, authority, independent-source, and claim-level checks. This prevents model transcription errors from consuming otherwise valid attempts.

After fixing a failed day's publisher, an operator may configure a temporary random RECOVERY_TOKEN (at least 32 characters) and send an empty authenticated POST to /internal/retry. It accepts no query, date, model, prompt, or budget override. Recovery may resume only a retryable stopped current-day job with recorded budget remaining, once per day, permitting at most ten additional attempts. It preserves the existing attempt count, every token reservation, yesterday's fact, and independent review. Permanent failures and exhausted/unknown budgets cannot be resumed. Concurrent requests share one recovery and a published current-day fact cannot be replaced. Remove the temporary secret after acceptance; queued work does not need it. Subsequent days return to the ordinary ten-attempt allowance.

Ordinary scheduling permits ten TOTAL attempts per UTC day, not ten retries in addition to the first attempt. Only the authenticated operator recovery described above can grant a bounded additional batch. Each attempt has one generation request and at most one separate review request. Automatic SDK retries are absent. Retry after 5 minutes following attempt one and 10 minutes after every subsequent retryable failure while allowance remains.

Each phase retains its existing 180-second work allowance and watchdog grace. Evidence retrieval is bounded to 40 seconds; the model request uses the phase's remaining time, with up to 4,000 output tokens including reasoning. Duplicate alarms, concurrent schedules, and restart recovery obey durable ownership markers. Interrupted requests are not replayed within an attempt; their watchdog consumes the attempt and schedules the next allowed one. Superseded or previous-day responses cannot publish.

Rejection, malformed output, refusal, network error and timeout are retryable within the allowance. Billing/quota rejection and permanent model/configuration errors stop that day. A previous fact remains published indefinitely if replacements fail. Exactly one new fact each day cannot be guaranteed during provider failures, evidence rejection or exhausted quota.

## Daily token reservations

OPENAI_DAILY_TOKEN_BUDGET defaults to 1,000,000 and can be lowered to a positive integer. Invalid values or values above 1,000,000 disable generation. This is a ceiling, not expected daily usage or a guarantee about the shared complimentary pool. No new secret or Cloudflare resource is required.

Before each generation/review POST, an owning Durable Object transaction reserves UTF-8 bytes of the complete request (evidence, instructions and schema), a 4,096-token framing margin, and all 4,000 possible output tokens. Bodies over 40,000 bytes are rejected before reservation or POST. Reservations persist in the job state and are never refunded after model errors, rejected facts, timeouts, restarts, alarms or bootstrap recovery. Each phase can reserve only once. Provider input/output usage is logged; usage exceeding its reservation permanently stops that day's job.

Ten attempts remain the ordinary maximum; operator recovery cannot increase the daily token ceiling or refund reservations. If the configured ceiling cannot cover the next request, that day's job stops and retains the previous fact. New UTC days start a fresh job budget. Legacy jobs with earlier attempts and no token record stop for that UTC day rather than assume a safe remaining allowance; the next day's cron starts fresh. A legacy job that has made no prior request may start normally. The existing namespace, class and storage migration stay unchanged. Cloudflare Workers AI/neurons accounting is not included. Rolling back to the older search implementation restores its hosted-search charges.

## Evidence and content

Both prompts exclude graphic/adult content and require clear, engaging English. Generation targets a randomly selected broad category without historical deduplication. Category feeds include NASA, MIT News, Smithsonian Magazine, BBC and The Guardian. Sport also discovers random entries in Olympedia's own results/biographical research database, which the IOC's Olympic Studies Centre introduces at https://oscnewsletter.olympics.com/index_newsletterid%3D15%26lang%3Den.html. The primary flag permits original records/research only; quoted outside assertions still need corroboration. Wikimedia search is discovery only: Wikipedia summaries never become evidence. The Worker reads reference URLs through Wikimedia's small public API responses and fetches approved cited publishers. It also follows available primary references in fetched articles; discovery responses themselves never become evidence. Review uses freshly fetched candidate pages plus available additional references in a separate model request, checking fascination, format, audience restrictions and every substantive claim in the fact and explanation.

Each accepted claim requires direct primary support or two independent reputable organizations. News requires two organizations even with a primary source. Publisher identity and primary eligibility come from the Worker's curated registry, and hosts of the same organization cannot corroborate each other. The reviewer must reject syndicated support, contested claims without corroboration, invented precision and unqualified changing records. Quotes must literally match whitespace-normalized retrieved text. Publisher names, dates and authority flags cannot be invented. Institutional pages qualify as primary only when reporting their own research/observation/collection/record; review may downgrade that flag. Automated review reduces factual errors but is not an absolute correctness guarantee.

Retrieval permits HTTPS on a fixed publisher list, without credentials or nonstandard ports. Each redirect is revalidated; HTTP, private destinations and unapproved hosts are rejected. Per phase: at most 16 fetches, three redirects per URL, 512,000 bytes per response, six documents and 3,500 text characters per document. Pinned htmlparser2 parses HTML/XML, excluding navigation, scripts, forms and other page chrome. Only fetched article text is evidence; feed snippets and search-result excerpts are discovery data. Slow, oversized, blocked, unsupported and future-dated pages are skipped. No usable evidence prevents the model POST. Fetch headers contain no OpenAI credentials. No paywall or bot-protection bypass is attempted.

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

Cloudflare Workers observability is enabled. Events include daily_schedule, attempt_started, evidence_retrieved, token_budget_reserved, openai_response, candidate_rejected, attempt_failed, fact_published, publication_read_failed and daily_schedule_failed.

Records include job date, attempt identifier, phase, duration, provider request IDs, usage when available, and failure classification. They exclude credentials and authorisation headers. Inspect stopped jobs and billing failures in Cloudflare logs; normal operation requires no human review.

## Verification

npm run check generates runtime types, type-checks the service, runs the behaviour suite and a real local Workers runtime smoke test, then runs a Wrangler deployment dry run. Tests use fake provider responses and never require or call a live OpenAI key. Native runtime tests seed an isolated local Durable Object, restart it with production code, and verify migration, retained facts, exclusive pagination, and restart persistence. The seed fixture is not included in the production entrypoint. Page checks cover date selection, Today, shared links, browser navigation, rapid changes, history failures, mobile layout, and both themes. Live verification uses read-only requests; no archive or deployment check invokes OpenAI.
