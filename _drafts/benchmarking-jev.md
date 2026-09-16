# Jev: A Better Way to Route AI Tools

On 14 September 2026, TypeSafe AI announced **Jev**, its first public System One Model, in early access. TypeSafe's founder and CEO, Diogo Almeida, previously worked at OpenAI.

The idea behind Jev is simple: not every AI problem needs a model that generates text. Sometimes software just needs to make a good decision.

That is exactly the problem I had in PocketRPG.

### The problem

PocketRPG has an AI game helper powered primarily by GPT-5.6 Luna. Players can ask natural-language questions and, where appropriate, the helper can inspect their character or propose game actions for confirmation.

At the time of this benchmark, the helper had **62 tool schemas**. Fourteen were always available to the main model and 48 were hidden behind progressive discovery.

That keeps the initial tool set smaller. When the helper needs a less common capability, it searches for the relevant tools and reveals a shortlist to the main model.

Until this experiment, that discovery used lexical matching.

It was fast and effectively free, but humans do not speak in API names.

A player might say:

> "Take 20 sharks out of my bank."

The helper needs `withdraw_from_bank`.

Or:

> "Use credits to instantly kill the kraken."

That needs `kill_boss`, not the normal `fight_boss` tool.

Those requests are easy for a person to understand, but keyword matching does not always surface the right capability.

### Where Jev fits

Jev takes unstructured input and returns structured decisions with probabilities and confidence scores rather than generating a prose answer. TypeSafe positions it for tasks such as routing, classification, scoring and branching inside normal software.

That makes tool discovery a good fit.

In my PocketRPG experiment, Jev has one narrow responsibility:

**Given what the player said, which hidden tools are most likely to help?**

The experimental flow is:

`Player → GPT-5.6 Luna → search_tools → Jev → candidate tools → GPT-5.6 Luna`

Jev does not execute the action. The main model still sees the candidate tool schemas and chooses what to call, while the existing authorization, validation and write-confirmation paths remain unchanged.

If Jev is unavailable or fails, the helper falls back to the lexical router.

Importantly, this is still an experiment: **Jev routing is feature-flagged off in both PocketRPG preview and production while I evaluate it.**

### My benchmark

I wanted to test Jev against my real use case rather than rely on vendor benchmarks.

The final benchmark used **53 cases**: 48 requests targeting hidden tools and five requests where no tool should match. Each case ran three times, giving **159 live Jev requests**.

I also improved the lexical router first by removing the 14 tools already available to GPT, so both routers searched the same hidden-tool space.

The result:

| Router | Top 1 | Top 3 | Top 6 |
| --- | ---: | ---: | ---: |
| Optimized lexical | 64.2% | 73.6% | 84.9% |
| **Jev** | **98.1%** | **100%** | **100%** |

There were **zero Jev API errors in those 159 requests**.

Top 6 is the most useful metric for this architecture because the router reveals up to six candidates rather than executing its first choice.

The optimized lexical router failed the Top 6 criterion in **8 of the 53 cases**. Jev satisfied it on **all 159 runs**: the expected tool was always present for the 48 tool cases, and the five unsupported cases correctly returned no match.

Jev's only repeated Top 1 miss was "start Dragon Slayer for me": it preferred `assign_slayer_task`, while the expected `start_quest` tool was still in its Top 3.

### Cost at scale

For this comparison I am deliberately ignoring complimentary allowances and using current list prices, because that is the more useful way to think about a product operating at volume.

The final benchmark used **608,988 Jev input tokens across 159 requests**, averaging about **3,830 input tokens per routing decision**.

As of **16 September 2026**:

- Jev is priced at **$0.042 per million input tokens**, with output tokens free.
- GPT-5.6 Luna is priced at **$0.20 per million uncached input tokens**, **$0.02 per million cached input tokens**, and **$1.20 per million output tokens**.

At Jev's measured average input volume, its routing input cost is about **$0.000161 per decision**, or:

| Routing decisions | Jev | Luna at uncached input rate only |
| --- | ---: | ---: |
| 1,000 | **$0.16** | $0.77 |
| 100,000 | **$16.09** | $76.60 |
| 1,000,000 | **$160.86** | $766.02 |

On uncached input list price, Jev is **79% cheaper than Luna** and Jev does not charge for output.

But that is not the same as proving a 79% end-to-end saving.

OpenAI supports prompt caching, and repeated static routing context can be billed at Luna's lower cached-input rate. I did **not** benchmark Luna as a replacement router, so the actual cost difference would depend on cache hit rate, output tokens and the exact routing prompt.

What I can say from this experiment is:

- Jev's measured routing cost is very small at volume.
- Its uncached input list price is materially lower than Luna's.
- Its output is currently free.
- On my benchmark, it also reduced Top 6 routing misses from **15.1% to 0%**, which can reduce the need for additional model/tool-search rounds.

That combination is what makes Jev interesting for high-volume products: a cheap specialist decision layer can sit in front of a more expensive general-purpose model and help reserve those model tokens for the work that actually needs them.

Latency is the trade-off. The optimized lexical router took about **1.0ms median**; Jev took **155.4ms median**, with a **215.6ms p95** in the final benchmark.

For an interaction that already involves an LLM and tool calls, I think that is a reasonable trade for this use case.

### Why I think Jev is interesting

What I like most about Jev is that it solves a smaller problem than a general-purpose LLM.

It does not need to write the player's response, execute an action or own application state. It just needs to make one fuzzy routing decision well.

In my PocketRPG benchmark, that moved correct-tool Top 6 recall from **84.9% to 100%**.

I would not use Jev where deterministic code already knows the answer. But for routing, classification and similar decisions where humans can express the same intent in many different ways, this is a compelling shape for AI inside software.

Sometimes the best use of AI is not asking a bigger model to do more.

It is giving a specialised model one decision to make and letting the rest of the software stay predictable.

### Sources

- [TypeSafe — Introducing System One Models and Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev)
- [TypeSafe — Team](https://typesafe.ai/team)
- [OpenAI — GPT-5.6 Luna pricing](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
- [PocketRPG — final production-shaped Jev benchmark](https://github.com/howellsryan/pocketRPG/pull/1010#issuecomment-5697269970)
