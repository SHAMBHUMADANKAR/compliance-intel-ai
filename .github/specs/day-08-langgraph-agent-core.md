# Day 8 — Stateful LangGraph Agent Core

**Page(s) touched:** none directly — no UI today. You're building the "brain" that the Audit Workspace page (Day 10) will sit on top of. This day is backend/AI only, and deliberately so: get the reasoning engine right in isolation before wiring a chat UI to it.
**You'll be able to say afterward:** "I understand why a compliance audit needs a graph instead of a single prompt, and what a 'state object' is actually doing across a multi-step agent run."

---

## Learning goal
Everything up to now — parsing, embedding, hybrid search — produces good *evidence*. Today's job is to build the thing that decides *what evidence to look for* and *how to reason over it*, potentially across several steps. This is the first day introducing agentic orchestration rather than a single LLM call.

## Why a single prompt isn't enough
Take the question "does our access control policy satisfy SOC2 CC6.1?" A single-shot approach — stuff the question plus some retrieved chunks into one prompt, ask for an answer — works for simple questions but breaks down for real audits, which often decompose into several sub-questions that need to be gathered and cross-checked against each other: *what does CC6.1 actually require*, *what does our policy document say about access control*, *does our live infrastructure config actually enforce what the policy claims*. A single prompt can't branch, can't retry a step that came back empty, and can't loop back for more evidence if the first pass wasn't enough. A **graph** — nodes that do specific jobs, edges that route between them based on the current state — can do all three.

## Stack
- LangGraph, built on top of LangChain primitives
- Ollama, serving the local reasoning model (an 8B-14B instruct model) — distinct from Day 6/7's small embedding and re-ranking models

### Why the reasoning model runs via Ollama, not in-process like Day 6/7's models
This is the mirror image of Day 6's "why in-process" argument, and worth holding both in your head at once: an 8B-14B parameter model needs serious memory pooling, GPU VRAM management, and a large context window (16,384+ tokens) — much heavier machinery than a small embedding model. Ollama runs as a separate background daemon process specifically so that if this large model runs out of VRAM mid-generation, *that* process crashes and restarts, not your FastAPI web workers serving every other tenant's requests at that moment. It's called once or a few times per user question (not thousands of times per document, like embedding), so the added HTTP-call overhead to the daemon is a small price for that isolation.

## The state object
```python
class ComplianceAgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]   # append-only, reducer-based history
    organization_id: str            # seeded once at graph invocation, from the verified JWT — never re-derived
    standard_id: str | None         # which framework, if the audit is scoped to one
    plan: list[str]                 # sub-questions the planner node produced
    evidence: list[RetrievedChunk]  # accumulated across retrieval steps
    draft_answer: str | None
    validation_errors: list[str]    # populated by Day 9's validator node
    finding: ComplianceFinding | None
```

### Learning note: what a "reducer" is doing here
`add_messages` is LangGraph's built-in pattern for letting multiple nodes each contribute to a shared list without needing to know about each other. Instead of a node having to fetch the current message list, append to it, and pass the whole thing forward, it just returns the *new* message(s) and the reducer function knows how to merge that into the existing state. This is the specific mechanism the product's original spec calls "append-reduces message histories" — now you know what that phrase actually means mechanically.

## Graph shape (today's scope — Day 9 adds the validation loop on top of this)
```
entry -> planner -> retriever -> reasoner -> formatter -> END
```
- **planner**: given the user's question and optional `standard_id`, produces `plan: list[str]` — one or more concrete sub-questions worth retrieving evidence for.
- **retriever**: for each item in `plan`, calls Day 7's `hybrid_search()`, appends results into `evidence`.
- **reasoner**: calls the Ollama-backed LLM with the accumulated `evidence`, producing `draft_answer` and a candidate structured finding.
- **formatter**: shapes the final output for downstream consumption (Day 9's validator sits between reasoner and formatter once it exists; Day 10's SSE stream and Day 11's Reports table are both fed by formatter's output).

## The one rule that matters more than the graph shape itself
`organization_id` enters `ComplianceAgentState` exactly once, at graph invocation, sourced from the same verified JWT context used everywhere else in this app (Day 3). No node — planner, retriever, reasoner — ever re-reads it from a user message or accepts it as a fresh parameter. This is Day 2's tenant-isolation discipline, carried all the way into the AI layer: the retriever node's call into `hybrid_search()` must use `state["organization_id"]`, not anything derivable from what the user typed.

## Deliverables checklist
- [ ] `ComplianceAgentState` defined and typed
- [ ] Planner, retriever, reasoner implemented as separate graph nodes (not one big function)
- [ ] Graph compiles and runs end-to-end for a single-hop question (multi-hop planning can be simple/naive today — Day 9 is where self-correction gets added, not where planning sophistication needs to peak)
- [ ] Manual test: trace a run and confirm `organization_id` is never read from anywhere except the initial state seed
