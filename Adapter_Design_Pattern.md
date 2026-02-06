# The Adapter Design Pattern: Making Mismatched Systems Play Nicely

Sometimes you design something clean, modern, and intentionally shaped for your domain… and then reality arrives with a system that refuses to fit. Legacy APIs, third‑party platforms, or just “the thing we haven’t rewritten yet” - they all have their own ideas about how data should look and how operations should behave.

That’s where the **Adapter pattern** earns its keep.

The Adapter pattern provides a **translator** between two incompatible interfaces, allowing your application to speak in its preferred vocabulary while another system continues doing things its own way. Rather than forcing your core codebase to bend around an awkward dependency, the Adapter absorbs the mismatch.

***

## Why use an Adapter?

Real systems are rarely consistent. Different platforms evolve separately, teams have different design philosophies, and vendors make decisions you cannot undo. Adapters let you:

*   Introduce clean, domain‑focused interfaces without waiting for dependent systems to change.
*   Integrate third‑party services without leaking their quirks into your own code.
*   Gradually modernise a system - new code talks to the new interface, while the adapter keeps the old world running.
*   Maintain clarity: **your domain stays pure, the complexity stays at the boundary.**

***

## What an Adapter *actually* does

At its core, an Adapter is a small piece of code that:

1.  **Receives a request** using your preferred interface.
2.  **Translates** that request into the format the external system expects.
3.  **Invokes the external system** and gathers its response.
4.  **Maps the response** back into your own domain concepts.

It doesn’t add business logic.
It doesn’t orchestrate workflows.
It simply converts **intent** from one shape to another.

Think of it as an interpreter and not a decision‑maker.

***

## When *not* to use an Adapter

Although powerful, an Adapter isn’t always the right tool. Avoid it when:

*   You fully control both systems and can safely update one to match the other.
*   The mismatch is conceptual, not structural (e.g., one system thinks in versions, another in endorsements). In those cases, you need a **façade** or **anti‑corruption layer**, not a simple Adapter.
*   You’re tempted to add retries, caching, or domain rules. That’s service‑layer behaviour, not Adapter behaviour.

Adapters should stay **boring and predictable**.

***

## Why the Adapter pattern matters

Adapters help you defend the **shape** of your system. They ensure that:

*   Vendor oddities don’t leak into your domain.
*   Your interfaces stay stable even when external systems don’t.
*   Integrations remain replaceable; swap the adapter, keep the interface.
*   Technical debt stays isolated rather than spreading through your entire codebase.

It’s a small pattern with a big architectural impact.

***

## Final thoughts

Clean design isn’t about eliminating every legacy system in sight, it’s about preventing yesterday’s decisions from dictating tomorrow’s architecture. The Adapter pattern helps you draw that line. Build the interfaces *you* want, then write adapters that translate them to whatever the outside world requires. Your domain stays consistent, your integrations stay manageable and your code becomes more manageable.