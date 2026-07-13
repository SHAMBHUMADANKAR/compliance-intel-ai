# Day 1 — Project Setup & Tooling Foundations

**Page(s) touched:** none yet — this day builds the ground every page will stand on.
**You'll be able to say afterward:** "I understand why this stack looks the way it does, not just what's in it."

---

## Learning goal
Before writing a single feature, you need the skeleton every later day plugs into: a FastAPI backend project, a React+Vite frontend project, and the package managers/build tools wired correctly. This day is 100% about *why this stack*, because every later day assumes you already agree with these choices — if you don't understand the "why" now, later days will feel arbitrary.

## Why FastAPI (Python), not Node/Express or Django
- **AI ecosystem gravity.** LangChain, LangGraph, Hugging Face `transformers`, `sentence-transformers`, and `supabase_postgres-client` are all Python-native. Picking a Python backend means zero translation layer between "the web framework" and "the AI code" — they're the same process, same imports, same virtualenv.
- **Async I/O for streaming.** FastAPI runs on `uvicorn` over Python's `asyncio` event loop. This matters concretely on Day 10, when a single HTTP connection needs to stay open for 30-45 seconds streaming tokens (Server-Sent Events) *without* blocking every other user's requests on the same server process. A synchronous framework (classic Flask/Django) would need a thread or worker process per open stream; FastAPI multiplexes many open streams on one event loop.
- Compare: Django is batteries-included but opinionated in ways (ORM, ORM-coupled admin) that fight a system where Supabase Postgres (pgvector), not Postgres, is doing a lot of the "querying." FastAPI is a thin, unopinionated layer — you bring your own DB layer (Day 2), your own auth (Day 3).

## Why React + Vite (SPA), not Next.js
- **No dual-runtime bottleneck.** Next.js's App Router encourages you to write Node.js API routes that proxy to your real backend. Here, the real backend is already a full Python server — adding a Node proxy in front of it means every request pays for two servers instead of one, and you now maintain routing logic in two languages.
- **Direct streaming.** The browser's `EventSource`/`fetch` streaming reader talks straight to FastAPI. No Node process sits in the middle re-buffering the stream — which matters a lot for the token-by-token chat experience in the Audit Workspace (Day 10).
- Vite gives you a dev server with instant hot-module-reload and a production build (`vite build`) that outputs a static `dist/` folder — trivial to serve from nginx or even FastAPI's `StaticFiles` mount.

## Why Shadcn UI, not Material UI / Ant Design / Chakra
Shadcn isn't an npm dependency you import — it's a CLI that *copies* component source code directly into `/src/components/ui/`. You own the file. This matters specifically for AI-assisted development: when you ask Copilot/Claude Code to "make the button in the Vault page smaller," it can open the actual component file and edit it, instead of being stuck outside a black-box library's compiled CSS.

## Why pnpm, not npm or yarn
`npm install` historically "flattens" the dependency tree — a package can end up accessible in your code even though it's not listed in your `package.json`, just because some other dependency happened to pull it in ("phantom dependency"). pnpm uses a content-addressable store with strict symlinks: if it's not in `package.json`, your import fails, full stop. For a project where an AI coding assistant is writing a lot of the code, this is a guardrail — it can't accidentally depend on something that will vanish the moment the dependency tree shifts slightly.

## What you actually build today

**Backend skeleton (`/backend`):**
```
backend/
  app/
    main.py            # FastAPI() app instance, mounts routers (empty for now)
    core/
      config.py         # Settings via pydantic-settings, reads .env
    api/                # routers land here from Day 2 onward
  requirements.txt / pyproject.toml
  .env.example
```
`main.py` should boot with zero routes and return 200 on `/health` — that's the whole Day 1 backend deliverable.

**Frontend skeleton (`/frontend`):**
```
frontend/
  src/
    main.tsx
    App.tsx             # router shell, no real pages yet
    components/ui/       # shadcn init output lands here
  vite.config.ts
  package.json
  pnpm-lock.yaml
```
Run `pnpm create vite frontend --template react-ts`, then `pnpm dlx shadcn-ui@latest init`. Confirm `pnpm dev` boots and hot-reloads.

**Monorepo layout decision:** keep `/backend` and `/frontend` as sibling folders under one repo root (not a full Nx/Turborepo monorepo tool — overkill at this stage). Day 15's Docker Compose file will reference both by relative path.

## Learning note: what "self-contained on localized hardware" means in practice
Every tool selected today (FastAPI, Python, React, Vite) runs as a normal local process — none of them phone home to a vendor's cloud to function. Contrast this with, say, a managed Next.js deployment on Vercel, which nudges you toward Vercel's edge network by default. This is the first of many small decisions across the 15 days that all point the same direction: everything runs on hardware you control.

## Deliverables checklist
- [ ] `backend/` boots with `uvicorn app.main:app --reload`, `/health` returns `{"status": "ok"}`
- [ ] `frontend/` boots with `pnpm dev`, shows a placeholder page
- [ ] Shadcn CLI initialized, one test component (e.g., `Button`) copied in and rendering
- [ ] `.env.example` documents every environment variable later days will need (placeholders fine for now: `DATABASE_URL`, `REDIS_URL`, `QDRANT_URL`, `OLLAMA_HOST`)
- [ ] `pnpm-lock.yaml` committed
