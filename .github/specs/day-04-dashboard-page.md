# Day 4 — The Dashboard Page

**Page(s) touched:** Dashboard
**You'll be able to say afterward:** "I understand how a landing page aggregates data from several tables into one fast summary call, instead of the frontend making five separate slow requests."

---

## Learning goal
The Dashboard is the first page a user sees after login, and the first place you'll practice a recurring pattern in this app: the frontend should ask the backend one question ("give me my org's summary") rather than reconstructing that summary itself from five raw tables. Today is about designing that summary endpoint well.

## Functional recap
A compliance officer logs in and immediately wants to know: how much has been ingested, how much is still processing, how many findings are open, and what happened recently. No digging required.

## Backend

### Endpoint
`GET /api/orgs/{org_id}/summary` — but per Day 3's rule, `org_id` in the path is never trusted for scoping; the handler ignores the path value for query purposes and uses `ctx.organization_id` from the verified token instead (the path param exists for readability/REST convention, not as a security boundary — this is worth sitting with, because it's a subtle but important distinction: **URL shape and authorization are two separate concerns**).

Response shape:
```json
{
  "documents": { "total": 184, "processing": 6, "failed": 1 },
  "findings": { "open": 12, "non_compliant": 3 },
  "reports": { "total": 27, "this_week": 4 },
  "standards_active": 3,
  "recent_reports": [ { "id": "...", "name": "...", "standard": "SOC2", "status": "needs_review", "created_at": "..." } ],
  "recent_tasks": [ { "id": "...", "file": "...", "status": "embedding" } ]
}
```

### Implementation shape
One repository function per stat group (`count_documents_by_status`, `count_open_findings`, `count_reports_this_week`, ...), all taking `organization_id`, composed inside a single service function so the route handler stays thin. Run the independent counts concurrently with `asyncio.gather` rather than sequentially — five small counts awaited one after another adds up to a noticeably slower dashboard load for no reason.

### Additional supporting endpoints used by this page
- `GET /api/reports?limit=5` — recent reports list (full endpoint defined in Day 11, but a minimal version can back this page today)
- `GET /api/tasks?status=running` — in-flight ingestion jobs (full endpoint defined in Day 5)

## Frontend

### Components
- `DashboardPage` — top-level route component, fetches summary on mount
- `StatCard` (Shadcn `Card`) — reusable, takes a label/value/sublabel — used four times (Documents, Findings, Reports, Standards)
- `RecentReportsTable` — Shadcn `Table`, status rendered as a colored `Badge` (compliant=green, needs_review=amber, non_compliant=red)
- `IngestionQueueTable` — same table pattern, polling-driven (see below)

### Data fetching pattern
Use a simple `useEffect` + fetch on mount for the one-shot summary; for `recent_tasks`, poll every 5-10 seconds while any task is non-terminal, and stop polling once nothing is `queued`/`parsing`/`embedding` — this avoids hammering the backend once ingestion settles down. (Day 9's SSE work is reserved specifically for the *agent chat* stream; simple polling is the right, simpler tool for a background status widget like this one — don't reach for a WebSocket/SSE connection here just because you have the pattern available from a later day.)

### Learning note: why not fetch five endpoints from the frontend instead of one summary endpoint
It's tempting to let the Dashboard component independently call a documents-count endpoint, a findings-count endpoint, etc. Resist this. A single summary endpoint means: one network round trip instead of five (real latency win on a slow VPN-backed enterprise network, which this product's users often are on), one place to add caching later, and a backend that can answer "what does a dashboard need" as a single coherent concept instead of the frontend gluing together loosely related data.

## AI/ML layer
None directly — the Dashboard surfaces counts and status, not model output. It does, however, indirectly reflect the state of the AI pipeline (how many documents have finished embedding, from Day 6) — a good moment to notice how a page can be "AI-adjacent" (shows AI-pipeline state) without itself calling a model.

## Deliverables checklist
- [ ] `GET /api/orgs/{org_id}/summary` returns all counts using `ctx.organization_id`, not the path param, for scoping
- [ ] Counts run concurrently, not sequentially
- [ ] Dashboard renders four stat cards + recent reports + ingestion queue
- [ ] Polling for in-flight tasks starts/stops based on whether anything is non-terminal
- [ ] Manual test: two different org logins show completely different dashboard numbers
