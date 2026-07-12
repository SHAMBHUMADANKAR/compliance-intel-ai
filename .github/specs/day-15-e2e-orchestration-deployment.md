# Day 15 — Automated E2E Orchestration & Deployment

**Page(s) touched:** none directly — this day proves that every page built across Days 3-14 actually works together as one deployable system, and packages that system for a real customer environment.
**You'll be able to say afterward:** "I understand what 'done' means for a self-hosted AI product beyond 'it works on my machine,' and how to prove the RAG pipeline is actually good, not just plausible."

---

## Learning goal
A self-hosted compliance product's entire value proposition is "runs entirely on your infrastructure, exactly as specified." A deployment that works on one developer's laptop but drifts in production — a different model version pulled into Ollama, a slightly different dependency resolution — undermines that promise almost as much as an actual data leak would. Today is about closing that gap with reproducible builds and a real validation suite, not just a `docker-compose up` that happens to work today.

## Stack
- Docker multi-stage builds, one per service
- `docker-compose.yml` for local/dev orchestration (a production manifest — Kubernetes, Nomad, or a customer's own orchestrator — follows the same container images, out of scope to fully specify here since it's customer-environment-dependent)
- `pytest` for backend tests
- A small hand-labeled evaluation set for RAG precision (the seed of this was written down back on Day 7 — today it becomes an automated, repeatable check)

## Container topology
```
services:
  postgres    - persistent volume, relational data (Day 2)
  redis       - Celery broker/result backend (Day 5)
  qdrant      - persistent volume, vector data (Day 6)
  ollama      - persistent volume for pulled models, GPU passthrough if available (Days 8-9)
  api         - FastAPI app (uvicorn), depends_on: postgres, redis, qdrant
  worker      - Celery worker, same image as api, different entrypoint, depends_on: postgres, redis, qdrant, ollama
  frontend    - built React/Vite static bundle, served via nginx (or served directly by the api image, to avoid a second network hop — a legitimate simplification for a self-hosted single-tenant-per-deployment product)
```
Every page you built across Days 3-14 depends on some subset of this topology being up and correctly networked — this is the day that's finally verified end to end rather than assumed.

## Multi-stage builds

**Backend image:** stage 1 installs dependencies (`pip install`, cached as its own layer so application code changes don't invalidate it); stage 2 copies only the installed environment plus application source into a slim runtime image, keeping build toolchains out of what actually ships.

**Frontend image:** stage 1 runs `pnpm install --frozen-lockfile` + `pnpm build`; stage 2 copies the static `dist/` output into a minimal nginx image. `--frozen-lockfile` here is Day 1's pnpm rationale made concrete: the build *fails* rather than silently resolving a drifted dependency tree — exactly the guarantee this stage exists to enforce, now actually wired into CI rather than just a stated principle.

## The validation suite — what "done" actually means

- **Multi-tenancy tests** (Day 2/3): cross-tenant reads return empty rather than erroring or leaking; expired/tampered JWTs rejected.
- **Ingestion test** (Day 5/6): upload a sample multi-page PDF through the real API, assert it reaches `status="ready"` with the expected chunk count within a defined time budget.
- **RAG precision test** (Day 7): run the hand-labeled (question, expected supporting chunk) pairs from Day 7 through the full hybrid search + rerank pipeline, assert the correct chunk lands in the top-k at some minimum hit rate. This is the concrete, numeric proof that Day 7's architecture choice (hybrid, not vector-only, plus cross-encoder re-ranking) is actually paying off — not just a theoretical argument anymore.
- **Grounding test** (Day 9): run several queries through the full LangGraph agent, assert every returned `citation_excerpt` is a verifiable substring of the retrieved evidence — exercising the Day 9 validator against real runs, not just the isolated unit tests written that day.
- **E2E smoke test**: bring up the full `docker-compose` stack from a clean state, upload a document via the real API, run one agent query via SSE (Day 10), assert a `finding` event arrives with a valid citation, assert it's queryable back from the Reports API (Day 11). This is the single test that proves every service boundary in the topology above actually talks to its neighbors correctly — the test that would have caught it if, say, the worker container couldn't reach Qdrant.

## Deliverables checklist
- [ ] `docker-compose.yml` brings up all seven services with one command, no manual steps
- [ ] Multi-stage builds for both the `api`/`worker` image and the `frontend` image
- [ ] `pnpm-lock.yaml` committed, build uses `--frozen-lockfile`, and a deliberately drifted lockfile is confirmed to fail the build (test the guardrail, don't just trust it)
- [ ] Full test suite (multi-tenancy, ingestion, RAG precision, grounding, E2E smoke) runnable via a single CI command
- [ ] A documented rollback/restart procedure for each stateful service (Postgres, Qdrant, Redis volumes) — this is what makes the "your infrastructure, your control" promise operationally real, not just architecturally true
