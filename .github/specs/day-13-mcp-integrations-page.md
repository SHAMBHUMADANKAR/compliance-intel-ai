# Day 13 — Integrations Page & Model Context Protocol (MCP)

**Page(s) touched:** Integrations (MCP Connectors)
**You'll be able to say afterward:** "I understand why letting an AI agent read from a live system is a fundamentally different risk than letting it read from an uploaded document, and how MCP contains that risk."

---

## Learning goal
Everything the agent has read so far (Days 6-7) is a static snapshot — a document uploaded once, embedded, done. Today introduces a different, riskier category: **live systems** (e.g., a security architect's real infrastructure inventory database). The Model Context Protocol (MCP) is the contract that lets the agent read from those systems without ever getting a path to *write* to them.

## Functional recap
This page lists registered MCP tool servers, the read-only capability each one exposes, and a per-org enable/disable toggle. It's kept structurally separate from the Document Vault specifically because these connectors touch live infrastructure, not files sitting in storage — a meaningfully different trust boundary deserves its own page, not a tab bolted onto Vault.

## Backend & AI

### Stack
- MCP Python SDK — tool servers communicating over stdio JSON-RPC
- A gateway layer inside the FastAPI/LangGraph stack that mediates every tool call the agent attempts

### Why MCP instead of direct integration
If the Day 8 LangGraph agent called a customer's database driver directly, every new data source would mean new bespoke integration code inside the core reasoning graph — and any failure in the LLM's tool-call reasoning (a classic risk with agentic systems: prompt injection tricking the model into calling a tool it shouldn't) would have a direct path to a live system. MCP tool servers declare a narrow, explicit contract — exactly which read operations they expose — and the gateway becomes a single choke point where every tool call is inspected before it executes, regardless of which tool server it's headed to.

### The stdio JSON-RPC rule — the single most important implementation detail this day
MCP tool servers talk to the host process over stdin/stdout using JSON-RPC. **`stdout` must contain nothing but protocol messages.** Any logging, debug `print()` statement, or unexpected console output from inside a tool server corrupts the JSON-RPC stream and silently breaks the tool call — with a confusing failure mode, because the error won't look like a normal exception. Every log line, every debug statement, in every MCP tool server file, goes to `sys.stderr`. This is easy to get wrong specifically because `print()`-for-debugging is completely normal everywhere else in this codebase — it's only inside `mcp_servers/` that it becomes a protocol-breaking bug.

### Gateway responsibilities, in order, for every proposed tool call
1. Look up the tool's declared capability (read-only vs. write) in a registry.
2. Reject outright any call to a write/destructive capability — such tools shouldn't be registered for this agent at all in the current product scope, but the gateway checks anyway as a second layer, matching the "seatbelt and airbag" philosophy from Day 2's row-level security discussion.
3. For read tools, validate requested parameters against an allowlist pattern (e.g., a database-query tool accepts only a small set of pre-approved query templates, never arbitrary SQL).
4. Log every invocation — tool name, parameters, `organization_id`, outcome — to structured logs (`sys.stderr`-routed). Appropriate here specifically because this is a compliance product; its own tool-call audit trail should meet the bar it's asking the customer's systems to meet.

### Org scoping for tools
Each registered MCP tool server is associated with an `organization_id` (set via `PATCH /api/mcp/tools/{id}` from this page). The gateway only exposes to the Day 8 agent's tool-call step the set of tools enabled for `state["organization_id"]` — same tenant-isolation discipline as every other day, now applied to *tool availability* rather than data rows.

### Endpoints
- `GET /api/mcp/tools` — list registered tool servers and their declared capabilities
- `PATCH /api/mcp/tools/{id}` — enable/disable a tool for the current org

## Frontend

### Components
- `IntegrationsPage` — table of registered tool servers: name, capability badge (always "read-only" in this product's current scope), scope description, enable/disable `Switch`
- A visible note on the page (not just in docs) that write-capable tools are never exposed here — a small but meaningful trust signal for the security architects who are this page's primary audience

## Deliverables checklist
- [ ] At least one example read-only MCP tool server implemented (e.g., an infra inventory lookup), running over stdio
- [ ] Verified: zero `print()`/stdout writes anywhere under the MCP tool server code — grep for it
- [ ] Gateway rejects any tool call not explicitly marked read-only in the registry, tested with a deliberately misconfigured write tool to confirm the rejection actually fires
- [ ] Tool availability correctly filtered by `organization_id` before being offered to the agent
- [ ] Every tool invocation logged with enough detail to reconstruct what the agent did, after the fact
