# Day 6 — Document Detail Page & Native Vector Embedding

**Page(s) touched:** Document Detail / Viewer
**You'll be able to say afterward:** "I understand what an embedding actually is, why we generate it locally instead of calling an API, and how a chunk of text becomes something searchable by meaning."

---

## Learning goal
This is the first genuinely "AI" day. Up to now, everything has been conventional web-app plumbing. Today you turn extracted text (Day 5) into vectors — lists of numbers that capture meaning well enough that "similar meaning" text ends up as "nearby" vectors — and store them so they can be searched later (Day 7). The Document Detail page exists so a human can see exactly what got indexed, which matters enormously for trust: if the agent later cites a document, a user should be able to click through and see the exact chunk it's citing.

## Functional recap
A user clicks "view" on a document in the Vault. They see the original file preview alongside the extracted chunks the system indexed, with page/section metadata — this is what makes the AI's later citations verifiable rather than a black box.

## Backend & AI — the embedding pipeline

### Stack
- `sentence-transformers` (e.g., `bge-small-en-v1.5`) — loaded directly into the Celery worker's Python process
- Qdrant — self-hosted vector database
- `qdrant-client` — Python driver

### What an embedding actually is (plain-language explainer)
A sentence-transformer model reads a chunk of text and outputs a fixed-length list of numbers (say, 384 of them) — a point in 384-dimensional space. The model is trained so that chunks with similar *meaning* end up close together in that space, even if they don't share exact words. "Password rotation every 90 days" and "credentials must be refreshed quarterly" would land near each other, even though they share almost no vocabulary. This is what lets Day 7's search find relevant policy text even when the user's question is phrased completely differently from the document.

### Chunking strategy
Split extracted text on detected section/heading boundaries first (using the metadata Day 5's parser captured); fall back to a recursive character splitter (~800 tokens per chunk, ~100 token overlap) where no clear structure exists. The overlap matters: without it, a clause that happens to fall right at a chunk boundary could be split in a way that neither half makes sense alone. Preserve `page_number` and `section_heading` on every chunk — this metadata is what the Document Detail page displays and what later powers citations in the Audit Report page (Day 11).

### Why embeddings run in-process, not via an HTTP call to Ollama
A 500-page document can produce thousands of chunks. If each chunk required a network round-trip to a separate Ollama daemon, ingestion would be dominated by network/serialization overhead repeated thousands of times. Loading the embedding model directly into the Celery worker's memory means embedding a batch of chunks is a local, batched matrix multiplication — as fast as the CPU/GPU allows, no network involved. Contrast this with Day 8, where the *reasoning* model runs via Ollama: that call happens once or a few times per user question, not thousands of times per document, so the daemon-isolation tradeoff (crash containment, VRAM management) is worth the overhead there but not here. This asymmetry — small model in-process, large model behind a daemon — is a specific, deliberate design decision worth understanding rather than memorizing.

### Qdrant collection design
```
collection: "compliance_chunks"
vector size: matches the model's output dimension (e.g., 384)
payload per point:
  {
    "organization_id": "<uuid>",   # MANDATORY on every point — the vector-DB equivalent of Day 2's rule
    "document_id": "<uuid>",
    "chunk_text": "...",
    "page_number": 12,
    "section_heading": "4.2 Access Control",
    "content_hash": "<sha256 of this chunk>"
  }
```
Every write (`upsert`) and every read (`search`, from Day 7 onward) includes an explicit `organization_id` filter. One shared collection across all tenants, filtered by payload, is the right call operationally (versus one Qdrant collection per tenant, which gets unwieldy fast) — but it means the filter is doing *all* the isolation work, so it can never be optional.

### Pipeline (continuation of Day 5's `embedding` step)
```
embed_chunks(document_id, chunks):
    1. batch chunks (e.g., 32 at a time) through the loaded model
    2. build a Qdrant PointStruct per chunk, payload includes organization_id + document_id + metadata
    3. upsert the batch to Qdrant
    4. on completion: documents.status = "ready"
```

## Frontend — the Document Detail page

### Components
- `DocumentDetailPage` — fetches `GET /api/documents/{id}` (metadata + chunk list) and `GET /api/documents/{id}/file` (raw file, for preview)
- `ChunkList` — renders each indexed chunk with its page/section label, in reading order
- `MetadataPanel` (Shadcn `Card`) — filename, page count, chunk count, content hash, uploader, status
- `FilePreview` — embeds the raw PDF/DOCX for side-by-side reference (a `<iframe>` or PDF.js viewer for PDFs; a simple "download to view" link is an acceptable first pass for DOCX/XLSX if a full in-browser renderer is out of scope for this day)

### Why this page exists at all
It would be entirely possible to ship this product without ever showing a user the raw chunks. This page exists specifically to build trust: compliance officers are being asked to rely on an AI's citations for regulatory decisions, and "here is exactly the text block the system indexed, and here's the original document it came from" is what makes that verifiable rather than an act of faith.

## Deliverables checklist
- [ ] Embedding model loaded once per Celery worker process (not reloaded per task — check this specifically, it's an easy performance mistake)
- [ ] Every Qdrant point payload includes `organization_id`
- [ ] `GET /api/documents/{id}` returns chunks in reading order with page/section metadata intact
- [ ] Document Detail page renders chunk list + metadata panel + file preview
- [ ] Deleting a document (Day 5's DELETE endpoint) cascades to delete its Qdrant points, filtered by `document_id` + `organization_id`
