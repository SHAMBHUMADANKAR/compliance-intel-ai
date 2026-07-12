# Day 7 — Hybrid Search RAG Engine

**Page(s) touched:** none directly — no dedicated page today. This is the retrieval engine that powers the Audit Workspace page you'll build on Day 10. Treat today as building a well-tested library function, not a feature with a UI.
**You'll be able to say afterward:** "I understand why pure semantic search fails on compliance text specifically, and what a cross-encoder re-ranker is actually doing."

---

## Learning goal
Day 6 gave you semantic search (find chunks with *similar meaning*). Today you learn why that alone isn't good enough for this product, and build the two additions — keyword search and re-ranking — that fix it. This is the engine room of the whole product: every answer the Audit Workspace ever gives depends on this day's code finding the right evidence.

## Why vector search alone fails here specifically
Compliance language is full of exact identifiers that carry almost no semantic signal on their own: "Clause 4.2," "CC6.1," "§164.312(a)(1)." An embedding model sees these as fairly meaningless token sequences — it has no strong sense that "CC6.1" is "close" to anything in particular. A user who asks "does our policy satisfy CC6.1" needs the system to find the *exact string* "CC6.1" wherever it appears, which is precisely what keyword/full-text search is good at and vector search is weak at. Conversely, a user who asks "do we rotate credentials often enough" (no exact terms matching the policy's wording) needs semantic search, which keyword search would miss entirely. Neither approach alone covers both cases — hence *hybrid*.

## Stack
- Qdrant dense vector search (from Day 6)
- Postgres full-text search (`tsvector`/`tsquery`) over chunk text — a lightweight, no-new-infrastructure way to get keyword recall
- A local cross-encoder model (e.g., an `ms-marco-MiniLM`-class model via `sentence-transformers`'s `CrossEncoder`), loaded in-process — same in-process rationale as Day 6's embedding model

## The pipeline

```python
def hybrid_search(organization_id, query_text, standard_scope=None, top_k=8):
    vector_hits  = qdrant.search(query_embedding(query_text), filter={organization_id, standard_scope}, limit=25)
    keyword_hits = postgres_fts(query_text, filter={organization_id}, limit=25)
    candidates   = merge_and_dedupe(vector_hits, keyword_hits)   # union by chunk id
    reranked     = cross_encoder.predict([(query_text, c.text) for c in candidates])
    return top_k_by_score(candidates, reranked)
```

### Step 1 & 2: two independent candidate lists
Run vector search and keyword search independently, each pulling a generous number of candidates (25, not 8) — the goal at this stage is *recall* (don't miss anything plausible), not precision. Precision is the re-ranker's job.

### Step 3: merge
Union the two candidate sets by chunk ID, so a chunk that scored well on either method survives into the next round. (A more sophisticated approach, reciprocal rank fusion, combines each list's *rank position* rather than raw scores — worth knowing the term, not essential to implement on day one, since BM25/tsvector scores and cosine similarity scores aren't on comparable scales anyway and the re-ranker is about to override both.)

### Step 4: cross-encoder re-ranking — the step that matters most
This is the part worth understanding deeply. Day 6's embedding model is a **bi-encoder**: it scores the query and each chunk *independently*, then compares the resulting vectors — fast (you can pre-compute chunk embeddings once, at ingestion time), but coarse, because the model never actually looks at the query and the chunk *together*. A **cross-encoder** takes the (query, chunk) pair as joint input and outputs a single relevance score — much more accurate, because the model can reason about how this *specific* chunk relates to this *specific* question, but too slow to run against your entire corpus (hence: use it only on the ~40-50 candidates that survived steps 1-3, not all 10,000+ chunks in the org).

**Why this specific step is the main defense against hallucinated compliance findings:** if the LLM (Day 8) is handed 8 chunks that are only vaguely relevant, it has to either say "I don't know" (rare, models like to be helpful) or stretch to construct an answer from weak evidence — which is exactly how ungrounded, wrong compliance verdicts happen. Good re-ranking is upstream of that failure mode, and no amount of prompt engineering downstream fixes a bad retrieval set.

## Where this lives in the codebase
Not exposed as a general user-facing API — it's called internally by the LangGraph retriever node you'll build on Day 8. If you want a debug endpoint during development to sanity-check retrieval quality by hand, gate it behind an admin-only or dev-only flag (`GET /api/search`), never ship it as a general endpoint the frontend calls directly.

## Deliverables checklist
- [ ] Postgres full-text index on chunk text (or equivalent)
- [ ] Cross-encoder model loaded once per worker process
- [ ] `hybrid_search()` filters both the vector leg and the keyword leg by `organization_id`
- [ ] A hand-built test set of ~10 (question, expected chunk) pairs, used to sanity-check that hybrid+rerank actually outperforms vector-only search — write this down now, it becomes part of Day 15's formal validation suite
