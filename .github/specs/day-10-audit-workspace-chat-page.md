# Day 10 — The Audit Workspace (Chat) Page & SSE Streaming

**Page(s) touched:** Audit Workspace (Chat)
**You'll be able to say afterward:** "I understand how a 30-45 second local inference wait gets turned into a live, legible experience instead of a frozen spinner."

---

## Learning goal
Days 6-9 built a genuinely capable but *slow* pipeline — local inference on modest hardware can take 30-45 seconds for a full plan→retrieve→reason→validate cycle. Today's entire job is perceived performance: streaming partial progress and partial output so that wait feels engaged rather than frozen. This is the day all the invisible backend work from the last four days finally becomes a page a user actually looks at.

## Functional recap
A user types a compliance question (optionally scoped to a standard, e.g., SOC2). They watch a phase indicator move through Planning → Retrieving → Reasoning → Validating → Answering, see the answer's text stream in token by token, and see citations appear inline, clickable back to Document Detail.

## Backend — the SSE gateway

### Why this works cleanly with FastAPI + a React SPA (and specifically wouldn't with Next.js in front)
`uvicorn` holds a Server-Sent Events connection open on Python's `asyncio` event loop without blocking any other request on the same process — this is the concrete payoff of Day 1's "why FastAPI" argument. Because the React SPA talks to FastAPI directly (no Next.js Node process proxying in between, per Day 1), the stream is a single hop from browser to the actual LangGraph run — nothing in the middle needs to buffer or re-emit it.

### Endpoint contract
`POST /api/agent/query` streams named SSE events as the LangGraph run (Days 8-9) progresses:
```
event: state
data: {"phase": "planning"}

event: state
data: {"phase": "retrieving"}

event: token
data: {"text": "Based on "}

event: token
data: {"text": "your access "}
...
event: state
data: {"phase": "validating"}

event: finding
data: {"finding": {...}}

event: done
data: {}
```
- `state` events fire whenever the graph transitions between nodes — this is what drives the phase indicator.
- `token` events stream the reasoner's output as it's generated (Ollama supports streaming generation; wire that straight through to the SSE response instead of waiting for the full completion).
- `finding` carries the final validated `ComplianceFinding` (Day 9) once it passes validation — this is also what gets persisted to the Reports table (Day 11).
- `done` closes the stream.

`POST /api/agent/query/{run_id}/cancel` — aborts an in-flight LangGraph run; wired to a cancel button so a user isn't stuck waiting on a question they no longer care about.

## Frontend — the chat page

### Components
- `AuditWorkspacePage` — top-level layout: chat panel + side panel (scope selector, retrieved evidence list, cancel button)
- `PhaseIndicator` — five-step progress bar, updates from `state` events; this single component is what makes Day 8-9's multi-step graph legible to a non-technical user instead of looking like a single opaque "thinking..." spinner
- `ChatThread` — renders user/agent messages; agent messages accumulate `token` events into visible text as they arrive
- `CitationChip` — inline clickable citation, routes to Document Detail (Day 6) at the specific chunk
- `ScopeSelector` — dropdown to pick a standard (calls `GET /api/standards`, built out fully on Day 12)

### The streaming hook
```javascript
function useAgentStream(query, standardId) {
  const [phase, setPhase] = useState("idle");
  const [answer, setAnswer] = useState("");
  const [finding, setFinding] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchEventStream("/api/agent/query", { query, standardId }, controller.signal, {
      onState: (p) => setPhase(p.phase),
      onToken: (t) => setAnswer((prev) => prev + t.text),
      onFinding: (f) => setFinding(f.finding),
      onDone: () => setPhase("idle"),
    });
    return () => controller.abort();   // wired to the cancel button
  }, [query, standardId]);

  return { phase, answer, finding };
}
```

### Learning note: why `EventSource` alone isn't used here
The native browser `EventSource` API only supports GET requests with no custom body — but this endpoint needs to accept a JSON payload (the question, the scope). The common workaround is a `fetch()` call with a streaming response body reader, manually parsing the `event:`/`data:` frames — which is what `fetchEventStream` above is doing under the hood. Worth knowing this distinction so you don't go looking for a simpler `new EventSource(url)` call and wonder why it can't send a request body.

## Deliverables checklist
- [ ] `/api/agent/query` streams `state`/`token`/`finding`/`done` events matching the contract above
- [ ] Phase indicator visibly progresses through all five phases during a real query against real documents
- [ ] Cancel button aborts both the client-side stream and the server-side LangGraph run (not just the UI — verify the backend run actually stops, e.g., by checking it doesn't still write a `finding` to the DB after cancel)
- [ ] Citations in the chat are clickable and land on the correct chunk in Document Detail
- [ ] A dropped connection (simulate by killing the network mid-stream) doesn't leave the UI stuck in a permanent "loading" state
