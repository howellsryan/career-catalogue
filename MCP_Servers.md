
## MCP Servers

We’re moving very quickly in tech and AI is at the forefront of almost all groundbreaking innovation and should be seen as an imperative step for all industries. However, letting an LLM directly act on your systems is risky, insecure, in-auditable and immensely unpredictable given its non-deterministic nature.

*Model Context Protocol* Servers are a simple yet powerful method to expose data and actions to AI that is observable, reusable and most importantly *controlled*.

### So what is an MCP Server?
It’s a service that allows you to register tools that a model can call. It’s primary function is to separate the reasoning and execution in their own concerns so that AI cannot complete the full lifecycle solely.

It was introduced in 2014 by Anthropic (creators of Claude) so that everyone was using a united format as opposed to what was happening previously.

### Benefits
- Security
- Observability
- Readability
- Modularity
- Governance


### A simple example

How many orders were there in the UK yesterday broken down by type of sale?

- RAG retrieves the approved query template and valid dimensions.
- LLM fills in parameters and selects `sql.ukorderquery`.
- MCP server validates the template, checks RBAC, executes safely.
- Result is returned

### Final Thought

MCP Servers is purely about platform resilience, it gives confidence that AI *can* act within an automated environment because we’ve provided the guardrails and necessary orchestration to ensure the result we expect.