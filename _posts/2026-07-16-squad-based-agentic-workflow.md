---
layout: post
title: "Squad-Based Agentic Workflows: When the Team Costs More Than the Work"
date: 2026-07-16 11:54:28 +0100
description: "Running a squad of AI agents produced my best output ever at fifteen times the cost. What I learned before tearing it out."
tags: [ai, agentic-workflows, projects]
redirect_from:
  - /Squad-Based_Agentic_Workflow
  - /Squad-Based_Agentic_Workflow.html
---

I was looking through my API usage the other day and had one of those quiet, uncomfortable moments every engineer knows. The output of my AI agent squad was the best I'd ever had. The bill was fifteen times what it should have been. Both of those things were true at once, and sitting with that contradiction taught me more about **agentic workflows** than any blog post I'd read on the subject.

For a couple of weeks I ran squad-based agent delivery on PocketRPG, my tick-based idle RPG. This is what I learned, when I'd still reach for a squad, and why I ultimately tore mine out.

### What a Squad Actually Is

The idea is seductive because it maps directly onto how real software teams work. Instead of one agent doing everything, you define a roster of roles as markdown charters that live in your repo: a technical BA that turns a feature request into a breakdown with acceptance criteria, a read-only architect that produces the implementation plan, domain builders (in my case a gameplay engineer, a frontend designer and a backend developer) that write the code, and an adversarial QA agent that tears the finished diff apart at the end.

A lead session triages each task, spawns the roles it needs, hands each one a prompt with a goal, a set of owned files and acceptance criteria, then integrates the results. Builders get **disjoint file ownership** so they never fight over the same file. QA judges the integrated diff against the written criteria rather than trusting the builders' own reports.

And I want to be honest here: it works. An agent told "you are adversarial, your job is to find where this change is wrong" catches bugs that a generalist agent, fresh off writing the code, sails straight past. The BA step catches ambiguity before anyone writes a line. The quality was real.

### The Bill That Matters

Anthropic's engineering write-up on their [multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) puts a number on the cost: multi-agent setups burn roughly **fifteen times the tokens** of a normal session. My experience matched that almost exactly. Squad-tier tasks on PocketRPG came in at around 15x what the same work would have cost in a single session.

The multiplier stops being mysterious once you trace where the tokens go. Every spawned agent starts cold. Each of my five or six roles independently re-loaded the always-on project context, re-read the same engine files the lead had already read, got re-briefed on constraints the lead already knew, and then wrote a prose report the lead had to hold in its own context to integrate. Same files, same rules, paid for five times per task.

There's a subtler cost too, and Cognition's [Don't Build Multi-Agents](https://cognition.com/blog/dont-build-multi-agents) is the best writing on it: the telephone game. When you split dependent work across agents, decision-making disperses and context degrades at every handoff. Their example is a Flappy Bird clone where one subagent builds a Super Mario background and another builds a bird that moves nothing like the real thing. It's funny right up until your backend agent and your frontend agent make subtly incompatible assumptions about a save-format field, and QA is the first to notice.

### When a Squad Earns Its Keep

I don't think the architecture is wrong. I think it's specific. Reading across Anthropic's post and the wider research, a squad pays for itself when three things are all true.

The work has to **decompose into genuinely independent directions**. Breadth-first research is the canonical case: due diligence, competitive analysis, literature review. Ten subagents reading different sources in parallel, each compressing findings into a summary, is a real win because the parallelism is real.

The subtasks have to **benefit from walled-off context**. Specialised code review is a good example. Security, performance and API-contract reviewers don't need to coordinate, so fanning them out costs little and each specialist genuinely beats a generalist.

And the task's value has to **cover the multiplier**. Anthropic is blunt about this: the economics only work when the answer is worth a lot of tokens.

Sequential feature work on a single codebase fails all three. My architect's plan fed the builders, and the builders' diff fed QA. Nothing actually ran in parallel; everyone waited on everyone else, so I paid the coordination tax and never collected the parallelism dividend. Everyone needed the *same* context, which is precisely the situation the research flags as a bad fit. And "add a slayer task chain to an idle RPG" is not legal due diligence. The answer was never worth 15x.

### What I Moved To

The insight that made the migration easy is that the squad's quality never came from process isolation. It came from **role discipline**: the BA's evidence-first breakdown, the architect's file-level plan, QA's adversarial framing. Discipline transfers to a single agent for free. You don't need a separate process to make an agent wear a different hat; you need the hat written down.

PocketRPG now runs what I call a delivery loop. One agent, one session, moving through dedicated steps. The role charters became step charters. Plan always runs and does the old BA work, resolving unknowns from repo evidence and emitting executable success criteria. Architect runs only when the work crosses a real boundary, like a save-format change or a migration. Engineer is one step for all the code, whichever domain it touches. World Designer runs for content and map work, which in a game codebase is a genuine discipline of its own. QA always runs, still adversarial, judging the raw diff against the criteria *written down in the Plan step* rather than against what the engineer step concluded.

The inter-agent plumbing got replaced by three small habits. The agent announces each step as it enters it, so the discipline is auditable in the transcript. Each step ends with a five-line handoff note covering decisions, files touched and open findings, so later steps rely on notes instead of re-reading. And a triage fast-path skips the loop entirely for trivial work, because ceremony on a typo fix burns tokens the same way a squad does, just more slowly.

I kept exactly one kind of subagent: read-only search agents for broad fan-out questions.

* "Where does anything touch the prayer drain pool?" -> That's a subagent.
* "Which screens still use the old modal component?" -> That's a subagent.
* "Now write the fix." -> That stays in my session, always.

Those read-only agents are the inverted case. They move file dumps *out* of the main context and return only conclusions, so they reduce net tokens rather than multiplying them. Writes stay single-threaded, which is Cognition's middle ground too.

The honest trade-off is reviewer independence. Squad QA started cold and couldn't inherit the builder's blind spots; step QA shares a context with the code it's reviewing. Pre-written criteria recover most of that, because the QA step is graded against a contract that existed before the code did. And if quality ever slips, the cheap escalation is a single cold review on demand, not a standing squad.

### The Numbers, Honestly

A study out of UIUC, summarised well in [Augment Code's comparison guide](https://www.augmentcode.com/guides/single-agent-vs-multi-agent-ai), measured multi-agent overhead at anywhere from **4x to 220x** the tokens of a single-agent equivalent, and found that with the budget held equal, a single agent matches or beats the multi-agent setup on dependent, multi-hop work. Read that range the other way round: moving to a single agent saves you anywhere from 4x to over 200x on the same work, depending on how badly your task fits the pattern. I was living at the 15x mark. Some teams are paying far worse without knowing it.

---

Ultimately, this comes down to the same instinct I apply everywhere else in engineering: measure what a practice costs, not just how it feels. The squad *felt* rigorous. Watching five specialists coordinate reads as maturity. But rigour that costs 15x and produces the same diff isn't rigour, it's theatre with a metered API key. Write the hats down, make one agent wear them in order, and spend the savings on shipping more.
