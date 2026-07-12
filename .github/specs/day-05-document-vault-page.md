# Day 5 — The Document Vault Page & Async Ingestion

**Page(s) touched:** Document Vault
**You'll be able to say afterward:** "I understand why file upload can't just be a normal request/response, and what actually happens between clicking upload and seeing 'ready.'"

---

## Learning goal
This is the first page where a naive implementation (parse the file inside the HTTP request handler) would visibly break the product — a 500-page PDF would freeze the browser tab and likely hit a request timeout. Today introduces background job processing, the pattern that makes long-running work invisible to the user.

## Functional recap
A user drags a file onto the Vault page. The page should feel instant — the file appears in the table immediately with a "queued" status, then progresses through "parsing" → "embedding" → "ready" (or "failed") on its own, with no page reload needed.

## Backend

### Stack added today
- Celery — task queue
- Redis — Celery's broker + result backend

### Why Celery, not FastAPI `BackgroundTasks` or a bare `asyncio.create_task`
FastAPI's `BackgroundTasks` still runs inside the same process serving your HTTP requests — a crash or memory spike while parsing a huge PDF takes down the same process handling every other tenant's requests at that moment. Celery workers are **separate OS processes**. If a worker crashes parsing a malformed file, the API tier never notices — it just sees that task's status flip to `failed` in Redis. This isolation is the entire reason this day exists as its own milestone rather than being folded into a "just add file upload" afternoon.

### Upload endpoint
`POST /api/documents/upload`:
1. Stream the incoming file and compute its SHA-256 hash as it arrives (don't buffer the whole file in memory first if avoidable).
2. Check `documents` for an existing `(organization_id, content_hash)` match. If found, return that existing document immediately — no re-parse, no duplicate storage. This is the "hashing to drop redundant file operations early" the product spec calls for.
3. If new: persist the raw file to a local/customer-mounted volume (never a public cloud bucket — consistent with the whole product's no-external-calls constraint), insert a `documents` row with `status="queued"`, enqueue `ingest_document.delay(document_id)`, and return the row. This whole handler should return in well under a second regardless of file size, because steps 3 onward are fire-and-forget from the API's perspective.

### Celery task pipeline
```
ingest_document(document_id):
    1. status = "parsing"
    2. extract raw text + page/section metadata (pypdf / unstructured / python-docx / openpyxl depending on file type)
    3. status = "embedding"      # chunking + embedding is Day 6's territory, called from here
    4. status = "ready"
    on exception at any step:
    5. status = "failed", persist a human-readable error string
```

### Supporting endpoints
- `GET /api/documents` — list with status, for the table
- `GET /api/tasks/{task_id}` — poll one job's Celery status/progress/error, joined with `documents.status`
- `DELETE /api/documents/{id}` — remove document row + raw file (cascades to Qdrant vectors, Day 6)
- `POST /api/documents/{id}/reprocess` — re-enqueue a failed ingestion

## Frontend

### Components
- `VaultPage` — fetches `GET /api/documents` on mount, holds the table
- `UploadDropzone` — drag-and-drop + click-to-browse, uses the browser's native `FormData`/`fetch` (or `XMLHttpRequest` if you want an upload progress bar — `fetch` alone doesn't expose upload progress events, `XMLHttpRequest` does)
- `DocumentsTable` — Shadcn `Table`, one row per document, status column rendered as a `Badge` with distinct colors per state (queued=gray, parsing/embedding=amber, ready=green, failed=red)
- Row actions: `view` (routes to Document Detail, Day 6), `retry` (only shown when `status="failed"`, calls reprocess)

### Polling for status updates
Same pattern as Day 4's ingestion queue widget: poll `GET /api/documents` every few seconds while any row is non-terminal (`queued`/`parsing`/`embedding`), stop once everything settles. A toast notification (or an update to the shared Notifications tray built out in Day 14) fires when a document flips to `ready` or `failed`.

### Learning note: optimistic UI
When the user drops a file, insert a placeholder row into the table *immediately*, before the upload request even completes, showing "uploading..." — then reconcile it with the real document row once the server responds. This is the general pattern called "optimistic UI": update the interface based on the action the user just took, then correct it if the server disagrees. It's what makes an async-backed page still feel responsive.

## AI/ML layer
None yet on this page directly — parsing (text extraction) is not itself an AI operation, it's structured/unstructured document parsing. The AI work (embedding those extracted chunks) is Day 6's subject, triggered from step 3 of today's pipeline but implemented tomorrow. Worth noticing: "ingestion" as a user-facing concept spans two days of actual build work (parsing today, embedding tomorrow) even though the Vault page shows it as a single progress bar — a good example of a page's simplicity hiding real backend sequencing.

## Deliverables checklist
- [ ] Upload endpoint returns in <1s regardless of file size
- [ ] Content-hash dedupe verified: uploading the same file twice produces one document row, not two
- [ ] Celery worker process running separately from the API process (even in dev, two terminal windows)
- [ ] Vault page shows optimistic "uploading" row, then live status progression without a page reload
- [ ] Failed ingestion shows a human-readable error, never a raw stack trace, in the UI
