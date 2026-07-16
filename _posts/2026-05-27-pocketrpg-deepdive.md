---
layout: post
title: "PocketRPG Deepdive"
date: 2026-05-27 08:57:55 +0100
description: "A deep dive into PocketRPG, my browser-based idle RPG that runs on a 600ms tick and costs nothing to host."
tags: [projects, ai]
redirect_from:
  - /pocketrpg_deepdive
  - /pocketrpg_deepdive.html
---

PocketRPG is an idle/simulation RPG I've been building. It takes its cues from a fantasy RPG I played as a kid: combat, skilling, gathering, raids, clues and minigames, all advancing on a 600ms tick that keeps running while the tab is in the background. It runs in the browser, the layout works on both phones and desktops, and the production stack currently costs me nothing to run.

This is a write-up of how it's built, for a technical reader. I'll cover the stack, the server-authority model, the way I've used Cloudflare's free tiers, the save system, PvP, the economy and the responsive UI. I've left out anything that's an actual secret or key; where a detail is sensitive I've described the mechanism instead.

## The stack

The client is Preact rather than React. For a UI that's mostly lists, grids and one combat screen, the full React runtime would have been weight I didn't need, and Preact is a few KB. State lives in a Preact context with hooks. The game logic sits in separate modules that don't import anything from the UI.

That last point is a hard rule in the repo: `src/engine/` is pure game logic with no UI imports. The combat formulas, the XP curve and the loot rolls are all deterministic and can be tested on their own. The tick is 600ms, gameplay rounding always uses `Math.floor`, and the same inputs produce the same outputs every time. That determinism is what makes the regression tests worth having, and it's also what later made server-side PvP feasible.

Dev and the normal build run on Vite. There's an extra TypeScript transpile step feeding a custom concatenator, because the production artifact is a single `index.html`: every module transpiled and stitched into one file with Tailwind pulled in from a CDN, served as a static asset. For an offline-first app that means one file to cache and no module waterfall to resolve over a poor mobile connection.

Concatenating everything into one scope has a downside. Every top-level declaration has to be globally unique, or you get a duplicate-identifier error that breaks the whole app. A `check:single` step parses the output and fails the build if, say, two modules both define a top-level `formatGold`. It's caught me a few times, which is the point.

## Running on Cloudflare

The backend is Cloudflare Pages, Pages Functions and D1, with nothing else behind it.

- Pages serves the static app. Bandwidth and requests are effectively unmetered on the free plan, which suits a single-file SPA.
- Pages Functions are the API. Every endpoint under `/api/*` is a function. The free plan has a daily request limit (100k/day at the time of writing). An idle game doesn't need to talk to the server constantly, so that ceiling is comfortable.
- D1 is the database, SQLite at the edge. The free tier covers a few GB of storage and a daily allowance of rows read and rows written. The billing unit is rows, not connections or time.

That billing model shaped the data design more than anything else, and I'll come back to it. The result is that auth, cloud saves, a leaderboard, the economy and PvP all run for nothing a month, and the architecture doesn't need to change when usage grows past the free tier. It's the same Pages, Functions and D1; the only thing that changes is the bill. The design already respects the limits that scale would impose.

Deploys are driven from git. A push to a branch triggers a build and ship. Preview has its own D1 database and production has another, so I can test against realistic data on preview without touching live accounts. `wrangler.toml` wires the bindings, and secrets (the JWT signing key, OAuth client secrets, Stripe keys) live in the Pages dashboard rather than the repo.

## Treating the client as untrusted

Most of the more interesting decisions come from one assumption: the browser is untrusted. Not because players are malicious, but because anything in client memory can be edited, and an editable client means there's no real economy to speak of.

So the client computes and displays progression, but it doesn't get to commit anything that matters. XP ticking up as you grind, coins from a common drop, the HP bar: the client handles those locally and they feel instant. When something with economic weight happens (a boss unique, a raid drop, a clue reward, a credit purchase, a PvP loot transfer) the server is the only thing that writes it, and it validates the change itself.

That's easy to say and a steady discipline to keep, because the convenient option is always to trust the save blob the client uploads. I did a hardening pass to close that gap, and it left a clear split:

- `PUT /api/save` is a sync channel for non-economy state: UI settings, theme, the current task, HP. When a save arrives the server doesn't store it wholesale. It diffs the incoming blob against its own copy and rejects any increase in protected items (boss, raid and clue uniques) that didn't arrive through a proper grant. Items that legitimately drop client-side from monsters and clues are on an allowlist and pass; anything else trying to appear in the bank is discarded.
- Protected rewards go through dedicated action-completion endpoints: `/api/actions/monster/complete`, `/api/actions/raid/complete`, `/api/actions/clue/complete` and so on. Those are the only authoritative grant paths, and each one validates every reward item against the canonical drop table for its source. Request a raid unique from a monster that doesn't drop it and the response is a 403.

The save ends up in three zones: server-owned (XP, bank, inventory, equipment, slayer points, never accepted from the client), client-owned (UI state, current action, theme) and revalidated (levels, which have to match what the server recomputes from the XP it holds). The client can claim any combat level it likes; the server recomputes it and ignores the claim.

## Saving often without burning rows

An idle game has to save often. The tab can close at any moment and the player expects to return exactly where they left off. The client saves on a short cadence and on every meaningful event (a kill, a clue completion, a minigame finish, a level-up), plus a heartbeat every 30 seconds while an active task runs.

Saving often against a database billed per row written needs some care. The approach is that a save is one row. Each character has a single row in `saves`, and a write is one `UPDATE`. There's no row per inventory slot or per skill; the whole state is one JSON document, gzipped into a blob column. Compression takes a fair chunk off a typical save, and a hard size ceiling stops a corrupted or oversized blob being stored.

Integrity comes from optimistic concurrency on a `save_revision` counter. Each save carries the revision it believes it's editing, and the write is a compare-and-swap:

```sql
UPDATE saves
   SET save_blob = ?, save_data = ?, updated_at = ?, save_revision = save_revision + 1
 WHERE character_id = ? AND save_revision = ?
```

If `meta.changes` is zero, something else advanced the state (another tab or device) and this write is stale. The server returns a 409 with the current revision, and the client pulls fresh and retries. There's no auto-merge and no grace window. Last-write-wins on game state is how a stale background tab overwrites the raid drop you earned in the foreground a moment ago, so I'd rather the write fail and force a re-pull.

Some state is monotonic and must never move backwards: boss kill counts, the collection log, and the nonces that block replayed actions. Kept in the save blob, a last-write-wins moment or a backup restore could reset a kill count from 500 to 10. So those live in their own tables instead:

- `kill_counts`, incremented server-side with `kill_count = kill_count + 1`, so it only goes up.
- `collection_log`, append-only, with a composite primary key of `(character_id, item_id, source_type, source_id)` so a replay is an idempotent no-op rather than a duplicate.
- `action_nonces`. Every protected action carries a single-use nonce, and the server does an `INSERT … ON CONFLICT DO NOTHING` on it before anything else. If the row already exists it's a replay and the action is refused. Because the nonce sits in its own table it stays consumed even if the save blob is rolled back, which matters: replay defence that depends on the save being trustworthy doesn't work.

A separate `character_idle_state` table is the authoritative record of when a character was last active and what task it was running, and the server stamps it with its own clock. Trusting the client clock for offline progression would let someone wind their system time forward a week and collect a week of rewards.

Reads stay cheap too. The leaderboard and the PvP combat-level band need `total_level` and `combat_level` for a lot of characters at once. Rather than joining `saves` and parsing a JSON blob per row in a Worker, those two values are denormalised onto the `characters` table and kept current on each save, so the leaderboard is a plain indexed `SELECT`.

## The database tables

The schema is spread across nineteen migrations but stays fairly small:

- `oauth_identities`: one row per Google or GitHub login, i.e. the account.
- `characters`: an identity owns many characters, with unique case-insensitive usernames. It carries the denormalised `total_level` and `combat_level`, the ironman and one-life flags, the credit balance, and `active_match_id`, which is the PvP lock.
- `saves`: one per character. Gzipped blob, revision counter, server timestamp.
- `character_idle_state`: authoritative last-active time and current task.
- `collection_log`, `kill_counts`, `action_nonces`: the monotonic and dedup tables above.
- `audit_events`: a durable log of high-value mutations such as credit grants and spends, protected reward claims, PvP settlements and trading-post movements. Cloudflare's `console.log` output is ephemeral and hard to search, which is no help when a player asks where a drop went, so this is a real table I can query.
- `stripe_events` and `purchase_grants`: payment idempotency and a per-transaction ledger, so a retried Stripe webhook can't grant twice and I can answer "did this person receive what they paid for" without reading logs.
- `trading_post_offers`: the whole player economy in one table.
- `pvp_waiting_room`, `pvp_matches`, `pvp_invitations`, `pvp_intents`: PvP.

Indexes get the most deliberate attention, because they aren't free. Every secondary index is more data the database has to write and keep in order on each insert and update, and on a platform that bills per row written, an over-indexed table quietly multiplies the cost of every save. So the default is no index, and each one has to justify itself against a query that actually runs and runs often.

The indexes that exist map onto hot read paths. The leaderboard sorts by total level, so `characters` has a composite index on `(total_level DESC, id)`. The order book is searched by item and side at a given price, so `trading_post_offers` is indexed on `(item_id, offer_type, status, price, created_at)`, in that column order, because that's the order the query filters and then sorts in. The PvP match loop reads unapplied intents by match and tick on every poll, so `pvp_intents` has a composite index on `(match_id, tick_number, character_id, character_seq)`. Pending invitations get their own index because the lobby polls for them. Composite indexes are ordered to match how a query reads, not alphabetically or by gut feel, since a leading column the query doesn't filter on makes the index useless to it.

Several of these are partial, with a `WHERE` clause that trims the index down to the rows that are ever queried. The leaderboard index only covers `WHERE deleted_at IS NULL AND total_level > 33`, so deleted and brand-new characters never take up space in it. The "one active match per character" constraint is a `UNIQUE` index with `WHERE status = 'active'`, which does two jobs at once: it enforces the rule (a second active match for either side fails on the constraint instead of on application code I'd have to remember to write) and it stays small, because completed and aborted matches drop straight out of it. A partial index is smaller, faster to scan and cheaper to maintain than a full one, so where a column has a clear "live" subset it's the natural choice.

The other half of the decision is the tables left almost unindexed on purpose. `saves` is the hottest write path in the game, and it's read and written almost entirely by primary key (`character_id`), so it carries nothing beyond that key; a secondary index there would tax every save for a query that doesn't exist. Low-cardinality flags like the ironman boolean are the same story, since indexing a column with two possible values rarely helps the planner and still adds write cost. The line I hold is that an index is a standing tax on writes paid in exchange for one read being fast, so it's only worth adding when that read is both real and frequent.

## Authentication

There's no password handling in PocketRPG: no password storage, no reset emails, no hashes to leak. Sign-in is Google or GitHub only.

It's a standard three-leg OAuth flow, written directly against the Workers runtime with no SDK. Hitting `/api/auth/google` (or `/github`) generates a random state nonce, stores it in a short-lived `oauth_state` cookie (`HttpOnly; Secure; SameSite=Lax`, ten minutes) and redirects to the provider. The redirect URI is built from the incoming request's host rather than hardcoded, so the same code works on preview and production. The callback checks the state cookie against the query parameter, exchanges the code for an access token using the provider client secret, and uses the provider's stable user ID (`sub` on Google, `id` on GitHub) as the identity key.

Sessions are stateless JWTs signed with HS256 through the Web Crypto API, with no JWT library involved. The token holds the identity row ID, the provider and a display name, and expires after 30 days. Going stateless was deliberate: a protected request is verified with a signature check and no database round-trip, which keeps the per-request row cost at zero and scales horizontally without effort. `requireAuth` reads the bearer token, verifies the signature and expiry, and hands the endpoint a known identity. Characters attach to that identity by `owner_id`.

The trade-off is worth stating. A stateless 30-day JWT held client-side scales well but is awkward to revoke. Moving it into an `HttpOnly` cookie and adding a token-version check for instant revocation is still on the list rather than done.

## PvP and the tick

PvP is where the determinism work paid off, and also where I had to be realistic about what free infrastructure can do.

The engine is server-authoritative and shared. A single pure-logic module, `pvpEngine.js`, runs both in the client (for a responsive view) and inside the Pages Function (as the source of truth). Clients don't send "I hit you for 14". They send intents tagged with a tick number ("eat the food in slot 3", "queue a special", "switch to the second weapon"), the server applies them, and it produces the next authoritative state. The client renders state it doesn't own.

Because the engine is deterministic, the server resolves a tick unambiguously. Within a tick, intents apply in a fixed order (`tick_number`, then `character_id`, then a per-character sequence number), timers decrement, then both attacks resolve off the snapshot taken at the start of resolution, so neither player sees the other's hit before their own lands. If both players die on the same tick, the lower character ID wins. The outcome is identical on every run, which is what you need when two clients and a server all have to agree on what happened.

The 600ms tick is the unit of fairness here. Attack speed, freeze duration, stun length and special-attack energy regen are all counted in ticks rather than wall-clock milliseconds, so latency changes when you see an outcome, not the outcome itself.

Match concurrency is optimistic, like saves. Both clients poll and try to advance the tick, and the advancing `UPDATE` carries `WHERE current_tick = ?`. Whoever lands first takes the tick; the other gets `changes === 0`, re-reads and continues. The database does the arbitration, and it's the one component both clients already share.

The lock that keeps PvP consistent with the rest of the game is `characters.active_match_id`. While it's set, `/api/save`, `/api/idle` and `/api/purchase` all refuse writes for that character. Inventory during a match lives inside the match state and is written back atomically when the match ends. That's what makes loot transfer trustworthy: the loser's tradeable items move to the winner's bank in the same atomic batch that ends the match, coins are special-cased so they transfer despite being flagged untradeable elsewhere, and a forfeit runs through the same path as a death.

Version one of the transport is HTTP polling, roughly every 600ms, so on mobile the state on screen is 600–1500ms stale. It's near-real-time rather than real-time. I chose polling because it costs nothing and it's correct, and the upgrade path is already designed: move the match loop into a Durable Object behind a WebSocket. The engine, schema and UI stay as they are and only the transport changes, so I'm not writing combat twice.

## The economy

The most important economic decision in PocketRPG is that there's barely any player-to-player economy at all.

MMO economies inflate because the world spawns endless common goods, players sell them to one another, and the gold supply climbs. PocketRPG doesn't have that loop. The trading post is one table, `trading_post_offers`, and its order book only accepts three kinds of item: boss uniques, raid uniques and clue rewards, the genuinely rare drops. Everything else falls into one of two buckets. Common items with a shop value are instant-sold to the game at a fixed price, which is a sink with no player on the other side. Everything beyond that is untradeable.

A single gate function decides this: untradeable items are rejected, order-book items (the uniques) are allowed onto the book, and anything else with a shop value goes to the instant-sell path. The same check runs on both listing and search, server-side, so the client can't push an item onto the market that doesn't belong there.

The order book is an escrow system. Listing an offer debits your coins or items first and writes them into escrow on your save, and only then inserts the offer and runs matching against the opposing side (cheapest sells first for a buyer, best bids first for a seller, with any price improvement refunded inline). If matching fails after escrow there's a compensating refund, so you're never debited for an offer that didn't take. Partial fills accumulate into `coins_pending` and `items_pending` for collection later. Concurrent fills against the same resting offer use a conditional relative update, `quantity_remaining = quantity_remaining - ? WHERE quantity_remaining >= ?`, so if two buyers race for the last unit the second write affects zero rows, raises an "offer changed" error, and matching moves on to the next offer.

There's a deliberate gold sink on the way out, too. You can instant-sell an existing listing: it detaches from you, stays in the book at its original price for someone else to buy, and pays you 80%. The other 20% disappears. A small, unique-only economy leaves very few places for inflation to start, and sinks like this cover the rest.

Ironman accounts can't use any of it, and the server enforces that rather than leaving it to the client to hide the button.

## Responsive layout

PocketRPG started mobile-first and looked bad on a desktop for a long time: full-width nav tabs stranded across a 1440px viewport, single columns everywhere, no hover behaviour. Fixing it followed one rule: additive only, with the mobile DOM left untouched.

Every desktop change is a Tailwind breakpoint prefix or a `hidden md:block` / `md:hidden` toggle. The mobile layout doesn't change at all; desktop is layered on at `md:` (768px). That breakpoint is where the bottom tab bar becomes a side navigation rail, single columns become master/detail, and grids widen out. Inventory goes from 4 columns on a phone to 10 on a wide screen, the bank goes to 12, and active combat splits into three panes (monster on the left, log and actions in the middle, inventory, prayers and spells on the right) so you can see the whole fight rather than scrolling it.

The goal was a desktop layout that feels like a desktop game (side navigation, multiple columns, hover and keyboard support, Esc to close modals) rather than a phone frame centred on a big screen. Mobile keeps the compact, thumb-friendly layout with 44px tap targets. The components and logic are shared; only the available space differs. Since it's all CSS and conditional layout rather than separate screens, none of it needed new logic tests.

Two things caught me out. When a scrolling combat log becomes a grid child it needs `min-h-0` on the container or the auto-scroll quietly stops working. And hover styles need wrapping in `@media (hover: hover)`, or they stick on touch devices after a tap. Both are easy fixes that stay invisible until a real device shows them.

## CI and deployment

The pipeline is deliberately simple. GitHub Actions runs on every push and pull request: install, then `npm run ci`, which is the full build, the single-file rebuild and the `check:single` duplicate-identifier guard. The logic regression tests (Vitest, logic-only and deterministic) gate the build through a `prebuild` hook, so a build can't be produced with failing tests. Deployment is Cloudflare Pages watching the repo: the preview branch goes to the preview environment and its own database, and main goes to production. There's no separate CI server or deploy script to maintain.

The commit gate I run locally is the same one CI runs, so passing locally and passing in CI mean the same thing. For a single-file artifact with global-scope constraints, the duplicate-identifier check is the one that catches the most real problems.

## What I'd do again

A few things I'd repeat on another project of this shape. Designing to the free tier's actual constraint (for D1, that it bills per row) is what produced the one-row save, the denormalised leaderboard columns and the stateless JWT, and the result was better than if the limit hadn't been there. Deciding what the server owns up front matters, because retrofitting authority onto a system that trusted the client is slow and error-prone; I know because I did some of it. And keeping the free version and the eventual paid version on the same code, as with PvP polling now and a Durable Object later, means scaling is a transport and a billing change rather than a rewrite.

PocketRPG is still in progress. The JWT-to-cookie move, the WebSocket PvP transport and more economy sinks are all still open. The structure holds up, it costs nothing to run today, and the point at which it starts costing something will be the point at which enough people are playing for that to be fine.

The game's live if you want to try to break it.
