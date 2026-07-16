---
layout: post
title: "The PocketRPG Helper: Building an AI Chatbot That Never Costs Me a Penny"
date: 2026-07-02 09:06:57 +0100
description: "Building an AI helper for my idle RPG, PocketRPG, that answers players' questions in their own words - and costs me nothing to run."
tags: [ai, projects]
redirect_from:
  - /Building_A_Free_Chatbot
  - /Building_A_Free_Chatbot.html
---

I've been building PocketRPG, my tick-based idle RPG, for a while now, and something kept nagging at me. Players would hit a wall — how does prayer drain work, what should I train next, why did my inventory stop filling — and the answers lived either in my head or buried in a help screen nobody read. A static wall of text is fine, but nobody reads fourteen collapsible guides. They want to ask *their* question and get *their* answer.

So I built a helper. A little 💬 button in the corner of the game that answers questions about PocketRPG — and only PocketRPG. This post is about why I did it, and how I did it without adding a single penny to my hosting bill.

### The "Why" That Matters

The honest answer is that the game got deeper than the documentation. Idle supplies, slayer tasks, combo food, auto-banking tied to your Agility level — mechanics stack up, and every player arrives at them in a different order. A chatbot flips the model: instead of me guessing what players need to know, they tell me. And because it can read the player's own character, the answer isn't generic. "What should I do next?" gets answered with *your* stats, *your* slayer task, *your* bank.

The second reason is less noble: I wanted to see if I could do it for free. Properly free. Not "free until it isn't."

### Standing on Cloudflare

The whole game runs on Cloudflare Pages, so the chatbot lives there too, as a Pages Function. Workers AI gives you access to hosted open-source models with a free allocation of 10,000 "neurons" a day — neurons being Cloudflare's billing unit for inference. The model I settled on is **GLM-4.7-Flash**, which is remarkably cheap ($0.06 per million input tokens), handles multi-turn tool calling well, and — I learned this the hard way — is actually still available. My first choice had been deprecated a month before I wired it up, and I spent an evening staring at error 5028 wondering what I'd broken.

### Grounding It: A Knowledge Index and an MCP Server

A model on its own will happily invent drop rates. I didn't want that, so the helper is grounded two ways.

First, a **knowledge index**. My player guide is a markdown file; a build script chops it into chunks and bakes it into the worker. Every question runs a lexical search over it, and the best matches get handed to the model as context with strict instructions: answer from this, or say you don't know.

Second, **tools**. PocketRPG already has an MCP server so AI assistants can play the game, and the chatbot borrows a slice of it — a read-only allowlist. It can inspect items, look up monsters, check your slayer task. It cannot spend, equip, or sell anything, and the character ID is pinned server-side so it can only ever see the person asking.

### The Guardrail: Never Pay a Penny

This is the part I'm most pleased with. I'm on the Workers Paid plan, which means going over the free allocation quietly becomes a bill. I didn't want a soft limit; I wanted a mathematical one.

Every message **reserves its worst-case cost up front** in a little D1 ledger — before any AI call happens. If the reservation doesn't fit inside the day's budget, no call is made. When the answer comes back, the actual token usage is metered and the unused reserve is refunded. The budget itself sits below the free allocation, with the gap sized so that even a message in flight can't push actual spend over the line. Failures make it *more* conservative, never less: if anything goes wrong mid-request, the full reserve stays charged. There is no code path where I pay.

* "What if two messages race for the last of the budget?" -> The reserve is atomic; one of them loses.
* "What if the API doesn't report usage?" -> Keep the whole reserve.
* "What if a request gets killed mid-generation?" -> The reserve was already counted.

### When the Budget Runs Out

The helper doesn't just go dark when the day's allocation is spent. It degrades to **retrieval-only answers**: the same knowledge search runs, and you get the relevant guide sections verbatim instead of a generated reply. Less polished, still useful, costs nothing. The player's daily question isn't counted against them for a degraded answer either — that felt only fair.

---

Ultimately, this was a project about constraints. Free-tier limits, a deprecated model, a hard rule that I'd never pay for a single message — every one of those constraints made the design better. The result is a helper that knows the game, knows your character, admits what it doesn't know, and runs on a budget of exactly zero. That's a standard I can live with.
