# Jev: A Better Way to Route AI Tools

TypeSafe AI has released **Jev**, its first System One Model. The company was founded by Diogo Almeida, formerly of OpenAI, and the idea behind Jev is simple: not every AI problem needs a model that generates paragraphs of text.

Sometimes software just needs to make a good decision.

That is exactly the problem I had in PocketRPG.

### The problem

PocketRPG has an AI game helper powered primarily by GPT-5.6 Luna. Players can ask natural-language questions and, where appropriate, the helper can use game tools to inspect their character or perform actions.

There are more than 60 tools available.

Sending every tool to GPT on every request would waste context and make tool selection harder, so the helper uses progressive discovery. Common tools are always available, while less common tools are found only when needed.

Until now, that discovery relied on a lexical search.

It was fast and effectively free, but humans do not speak in API names.

A player might say:

> "Take 20 sharks out of my bank."

The helper needs `withdraw_from_bank`.

Or:

> "Use credits to instantly kill the kraken."

That needs `kill_boss`, not the normal `fight_boss` tool.

Those requests are easy for a person to understand, but much harder to solve reliably with keyword matching.

### Where Jev fits

This is the sort of problem Jev is designed for.

Jev takes unstructured input and returns structured decisions, probabilities and confidence rather than generating prose. TypeSafe describes it as a model for fast decisions inside normal software rather than another general-purpose chatbot.

In PocketRPG, Jev has one narrow responsibility:

**Given what the player said, which tools are most likely to help?**

The flow is:

`Player → GPT-5.6 Luna → Jev → relevant tools → GPT-5.6 Luna`

Jev does not execute anything.

GPT still sees the real tool schemas and makes the final choice. Game rules, combat, saves, economy validation and permissions remain deterministic and server-authoritative.

If Jev is unavailable, the helper falls back to the existing lexical router.

That separation is why I like the approach. AI handles the fuzzy decision; normal software keeps control of the important rules.

### My benchmark

I wanted to test Jev against my real use case rather than rely on vendor benchmarks.

I created **53 routing cases** covering PocketRPG's hidden tools and ran each one three times, giving **159 live Jev requests**.

I also improved the lexical router first so the comparison was fair.

The result:

| Router | Top 1 | Top 3 | Top 6 |
| --- | ---: | ---: | ---: |
| Improved lexical | 64.2% | 73.6% | 84.9% |
| **Jev** | **98.1%** | **100%** | **100%** |

There were **zero API errors** during the final benchmark.

The most important number for PocketRPG is Top 6.

Jev is not making the final tool call; it is giving GPT a shortlist. The old router failed to include the correct tool in that shortlist on roughly **15% of requests**.

Jev included it **100% of the time** in this benchmark.

That means the main model is far less likely to reach a point where it simply does not have the capability needed to answer the player.

### Cost at scale

For a real product, the useful comparison is what happens once free allowances are gone and every model token is billable.

My benchmark averaged about **3,830 Jev input tokens per routing decision**.

At current list pricing:

- Jev: **$0.042 per million input tokens**, with output free.
- GPT-5.6 Luna: **$0.20 per million input tokens** and **$1.20 per million output tokens**.

So if the same 3,830-token routing context were sent to Luna, Jev is about **79% cheaper on input alone**.

| Routing decisions | Jev | GPT-5.6 Luna input only |
| --- | ---: | ---: |
| 1,000 | **$0.16** | $0.77 |
| 100,000 | **$16.09** | $76.60 |
| 1,000,000 | **$160.86** | $766.02 |

That Luna figure is a minimum because it excludes output tokens entirely. Jev's output is free.

This isn't a claim that I benchmarked Jev against Luna as the router — my accuracy comparison was Jev against the existing lexical search. It is simply the cost of giving both models the same amount of routing input at current list prices.

The old lexical router is still effectively free, but it also missed the correct tool entirely on **15.1%** of my test cases. At scale, those misses matter because they can create another GPT tool-search round, another model call, or another player message.

That gives Jev two useful economics for a high-volume product: it is much cheaper than using a general-purpose LLM for the semantic routing decision, while its better recall can also reduce expensive downstream retries.

Latency increased from roughly **1ms** for lexical search to around **155ms median** for Jev, with a **216ms p95**. Inside an interaction already involving LLM and tool calls, I think that is a reasonable trade.

[TypeSafe's Jev pricing and announcement](https://typesafe.ai/blog/introducing-system-one-models-and-jev)  
[OpenAI GPT-5.6 Luna pricing](https://developers.openai.com/api/docs/models/gpt-5.6-luna)

### Why I think Jev is interesting

What I like most about Jev is that it solves a smaller problem than an LLM.

It does not need to write the response. It does not need to run the workflow. It does not need authority over the application.

It just needs to make one fuzzy decision well.

For PocketRPG, that took tool recall from **84.9% to 100%**. At volume, it also gives me a semantic routing layer that is substantially cheaper than spending general-purpose LLM tokens on the same decision.

That combination — better routing and lower model cost at scale — is what makes it particularly interesting for high-volume products.

I would not use Jev where deterministic code already knows the correct answer. But for routing, classification and other places where humans express the same intent in dozens of different ways, it is a very compelling tool.

Sometimes the best use of AI is not asking a bigger model to do more.

It is giving a smaller, specialised model one decision to make and letting the rest of the software stay boring.

[TypeSafe's Jev announcement](https://typesafe.ai/blog/introducing-system-one-models-and-jev)
