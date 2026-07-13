# ComplianceIntel AI — Functional Overview

> **Read this file first.** It explains *what the product does*, page by page and API by API, in plain functional terms — no code. The `day-XX-*.md` files that follow explain *how* each part is built. Both are written to be dropped into a Copilot / Claude Code context window and used as ground truth during implementation.

---

## 1. What This Product Is

ComplianceIntel AI is a **self-hosted, multi-tenant compliance audit platform**. A compliance officer, auditor, or security architect uploads their organization's internal documents (security policies, infrastructure configs, vendor contracts, audit evidence) and asks natural-language questions like *"Does our current password rotation policy satisfy SOC2 CC6.1?"* The system retrieves the relevant passages from the uploaded corpus, reasons over them using a locally-hosted LLM, and produces a cited, structured compliance finding — **without any document content ever leaving the customer's own infrastructure.**

The non-negotiable constraint that shapes every architectural decision: **zero external network calls containing customer data.** No OpenAI, no Anthropic API, no hosted vector DB, no hosted embedding API. Every inference, embedding, and vector operation happens on hardware the customer controls.

### Who uses it
- **Compliance Officer** — uploads policy documents, runs audits against a named framework (SOC2, ISO 27001, HIPAA), reviews findings, exports reports.
- **Security Architect** — uploads infrastructure/config exports, asks the agent to cross-reference technical controls against policy claims.
- **Auditor (external or internal)** — read-only access to a tenant's evidence vault and prior audit reports, uses chat to interrogate evidence during fieldwork.
- **Org Admin** — manages users, roles, and tenant-level settings; has no special access to document *content*, only to *management* functions.

### The core loop, end to end
1. Admin creates an organization (tenant) and invites users.
2. A user uploads documents into the **Document Vault**.
3. Documents are parsed, chunked, embedded, and indexed **asynchronously** so the upload doesn't block the UI.
4. The user opens the **Audit Workspace** and asks a question or selects a standard to audit against.
5. A **LangGraph agent** plans the audit, retrieves relevant chunks via hybrid search, reasons over them with a local LLM, self-checks its own output, and streams the answer back token-by-token.
6. Findings are saved as a structured **Audit Report** with citations back to the exact source document/page/clause.
7. Reports can be reviewed, annotated, and exported.

Everything below maps this loop to concrete screens and endpoints.

---

## 2. Page-by-Page Functional Breakdown

Each page describes: purpose, who sees it, what data it shows, what actions it triggers, and which APIs it calls (API names are defined in full in Section 3).

### 2.1 Login / Organization Onboarding
**Purpose:** Authenticate a user and establish their tenant context before anything else loads.
**Who:** Everyone, unauthenticated.
**What it shows:** Email/password (or SSO) form; on first-ever login for a brand-new deployment, an "Create your organization" step.
**Actions →APIs:**
- Submit credentials → `POST /api/auth/login`
- Create new org (first-run only) → `POST /api/orgs`
- Refresh an expiring session → `POST /api/auth/refresh`

**Functional rule:** the JWT issued here is the *only* place `organization_id` and `role` get set. Every other page and API trusts the token, never a client-supplied org ID.

### 2.2 Dashboard
**Purpose:** Landing page after login. Gives a compliance officer a single-glance status of their org's audit posture.
**Who:** All roles, content scoped to their org.
**What it shows:** count of documents ingested (and how many are still processing), count of open vs. resolved findings, list of recent audit reports, a "start new audit" call to action.
**Actions → APIs:**
- Load summary counts → `GET /api/orgs/{org_id}/summary`
- Load recent reports → `GET /api/reports?limit=5`
- Load in-flight ingestion jobs → `GET /api/tasks?status=running`

### 2.3 Document Vault
**Purpose:** Central repository of every file the org has uploaded — the raw material the agent reasons over.
**Who:** Compliance Officer, Security Architect, Admin can upload; Auditor is read-only.
**What it shows:** table of documents (name, type, upload date, uploader, ingestion status: queued / parsing / embedding / ready / failed), drag-and-drop upload zone, per-document actions (view, delete, re-process).
**Actions → APIs:**
- Upload one or more files → `POST /api/documents/upload` (returns immediately with a task ID; actual parsing happens in the background)
- List documents → `GET /api/documents`
- Poll ingestion status for a specific file → `GET /api/tasks/{task_id}`
- Delete a document (and its vectors) → `DELETE /api/documents/{document_id}`
- Re-trigger a failed ingestion → `POST /api/documents/{document_id}/reprocess`

**Functional rule:** the UI never waits synchronously on parsing. Upload returns instantly; status updates arrive via polling or the notification stream. A 500-page PDF must not freeze the browser tab or time out an HTTP request.

**Functional rule (dedup):** before a file is queued for parsing, its content hash is checked against existing documents in the org. Exact duplicates are rejected client-side with a message rather than silently re-processed.

### 2.4 Document Detail / Viewer
**Purpose:** Inspect a single document's extracted content and see exactly which chunks were indexed — this is what lets a user trust (and debug) what the agent is retrieving from.
**Who:** Same permissions as the Vault.
**What it shows:** original file preview, extracted text broken into the chunks that were embedded, metadata (page numbers, section headers where detected).
**Actions → APIs:**
- Fetch document metadata + chunk list → `GET /api/documents/{document_id}`
- Fetch raw file for preview → `GET /api/documents/{document_id}/file`

### 2.5 Audit Workspace (Chat)
**Purpose:** The core product experience. A conversational interface where the user asks compliance questions and watches the agent plan, search, and answer in real time.
**Who:** Compliance Officer, Security Architect, Auditor (Auditor sees the same workspace, read-only on org settings elsewhere).
**What it shows:** chat thread, a visible "agent state" indicator (Planning → Retrieving → Reasoning → Validating → Answering) so the user knows what a 30-45 second local-inference wait is actually doing, streamed answer text, inline citations linking back to Document Detail chunks.
**Actions → APIs:**
- Start or continue a conversation, streamed → `POST /api/agent/query` (Server-Sent Events response)
- Select a compliance standard to scope the audit → provided as a parameter on the same call, backed by `GET /api/standards`
- Stop an in-flight generation → `POST /api/agent/query/{run_id}/cancel`

**Functional rule:** the frontend never talks to Ollama, Supabase Postgres (pgvector), or the LLM directly. It only ever calls the FastAPI gateway; all AI infrastructure is invisible to the browser.

### 2.6 Audit Report / Findings
**Purpose:** The durable, shareable output of an audit — a structured, citable record rather than an ephemeral chat transcript.
**Who:** All roles can view; Compliance Officer/Admin can edit status (open/resolved/dismissed) and export.
**What it shows:** the standard audited against, each control/clause evaluated, a verdict (compliant / non-compliant / needs review), the supporting citation (document, page, excerpt), and free-text officer notes.
**Actions → APIs:**
- List reports → `GET /api/reports`
- Load one report → `GET /api/reports/{report_id}`
- Update finding status/notes → `PATCH /api/reports/{report_id}/findings/{finding_id}`
- Export to PDF/CSV → `GET /api/reports/{report_id}/export`

### 2.7 Standards Library
**Purpose:** Reference and manage the regulatory frameworks the org audits against.
**Who:** Admin manages; everyone can browse.
**What it shows:** built-in frameworks (SOC2, ISO 27001, HIPAA) with their control lists, and any org-custom frameworks uploaded as structured documents.
**Actions → APIs:**
- List frameworks → `GET /api/standards`
- View a framework's controls → `GET /api/standards/{standard_id}`
- Upload a custom framework → `POST /api/standards`

### 2.8 Admin / Organization Settings
**Purpose:** Tenant and user management, isolated from all document/audit functionality.
**Who:** Admin only.
**What it shows:** user list with roles, pending invitations, org-level settings (retention policy, which local model is active).
**Actions → APIs:**
- Invite user → `POST /api/orgs/{org_id}/invitations`
- List/change user roles → `GET /api/orgs/{org_id}/users`, `PATCH /api/orgs/{org_id}/users/{user_id}`
- Remove user → `DELETE /api/orgs/{org_id}/users/{user_id}`

### 2.9 Integrations (MCP Connectors)
**Purpose:** Manage the Model Context Protocol tool servers the agent is permitted to call (e.g., a read-only connector into a live infrastructure inventory database) — kept separate from document upload because these connectors touch *live systems*, not static files.
**Who:** Admin only, configuration; Security Architect, usage during audits.
**What it shows:** list of registered MCP servers, their exposed tools, and an enable/disable toggle per tool.
**Actions → APIs:**
- List registered MCP tools → `GET /api/mcp/tools`
- Enable/disable a tool for the org → `PATCH /api/mcp/tools/{tool_id}`

**Functional rule:** any MCP tool capable of a write/destructive action is rejected at the gateway before it ever reaches a live system — the agent can read infrastructure state, never mutate it.

### 2.10 Notifications / Background Task Monitor
**Purpose:** Surface the state of everything happening asynchronously (ingestion, long audits) so nothing feels like it silently failed.
**Who:** All roles, scoped to their own actions plus org-wide ingestion status for Admin.
**What it shows:** toast-style notifications and a persistent tray of running/completed/failed Celery tasks.
**Actions → APIs:**
- Poll task list → `GET /api/tasks`
- Fetch single task detail (for error messages) → `GET /api/tasks/{task_id}`

---

## 3. API Surface — Functional Summary

Grouped by responsibility. Every endpoint below sits behind the auth guard and is implicitly scoped by `organization_id` extracted from the verified JWT — no endpoint accepts a client-supplied org ID as a trust boundary.

| Domain | Endpoint | Function |
|---|---|---|
| **Auth** | `POST /api/auth/login` | Verify credentials, issue JWT containing `user_id`, `organization_id`, `role`. |
| | `POST /api/auth/refresh` | Rotate an expiring token without forcing re-login. |
| | `POST /api/auth/logout` | Invalidate the current session. |
| **Organizations** | `POST /api/orgs` | Create a new tenant (first-run bootstrap). |
| | `GET /api/orgs/{org_id}/summary` | Dashboard counts: documents, findings, reports. |
| | `POST /api/orgs/{org_id}/invitations` | Invite a user by email with a role. |
| | `GET/PATCH/DELETE /api/orgs/{org_id}/users` | Manage tenant membership and roles. |
| **Documents** | `POST /api/documents/upload` | Accept file(s), hash-dedupe, enqueue a Celery ingestion job, return immediately. |
| | `GET /api/documents` | List org documents with ingestion status. |
| | `GET /api/documents/{id}` | Metadata + extracted chunk list for the viewer. |
| | `GET /api/documents/{id}/file` | Stream the original file for preview. |
| | `DELETE /api/documents/{id}` | Remove document and cascade-delete its vectors from Supabase Postgres (pgvector). |
| | `POST /api/documents/{id}/reprocess` | Re-queue a failed ingestion. |
| **Background Tasks** | `GET /api/tasks` | List Celery job states for the org (ingestion, long audits). |
| | `GET /api/tasks/{task_id}` | Poll one job's status/progress/error detail. |
| **Search** | `GET /api/search` (internal, used by the agent, not the UI directly) | Hybrid keyword + vector retrieval against Supabase Postgres (pgvector), cross-encoder re-ranked. |
| **Compliance Agent** | `POST /api/agent/query` | SSE-streamed entry point into the LangGraph audit agent: plan → retrieve → reason → validate → answer. |
| | `POST /api/agent/query/{run_id}/cancel` | Abort an in-flight generation. |
| **Standards** | `GET /api/standards` | List built-in and custom compliance frameworks. |
| | `GET /api/standards/{id}` | A framework's control list, used to scope an audit. |
| | `POST /api/standards` | Ingest a custom framework document as structured controls. |
| **Reports** | `GET /api/reports` | List audit reports for the org. |
| | `GET /api/reports/{id}` | Full report with findings and citations. |
| | `PATCH /api/reports/{id}/findings/{finding_id}` | Officer updates a finding's status/notes. |
| | `GET /api/reports/{id}/export` | Render report to PDF/CSV. |
| **MCP Gateway** | `GET /api/mcp/tools` | List registered MCP tool servers and their capabilities. |
| | `PATCH /api/mcp/tools/{id}` | Enable/disable a tool for the org. |

---

## 4. Data Flow Summary (Functional, Not Code)

**Ingestion path:** Vault upload → hash check → Celery worker parses file (PDF/XLSX/DOCX) → text chunked → chunks embedded in-process via a local sentence-transformers model → vectors written to Supabase Postgres (pgvector) tagged with `organization_id` → document status flips to `ready` → Notifications tray updates.

**Audit path:** Workspace chat submits a question (optionally scoped to a standard) → LangGraph agent plans sub-questions → hybrid search hits Supabase Postgres (pgvector) filtered by `organization_id` → cross-encoder re-ranks top hits → local LLM (via Ollama) reasons over re-ranked context → validator node checks the answer against a JSON schema and citation requirements, looping back on failure → final answer streamed token-by-token over SSE → on completion, structured findings persisted to the Reports table.

**Tenant isolation is the golden rule that touches every path above:** nothing is ever fetched, embedded, searched, or returned without an `organization_id` filter matched against the JWT.

---

## 5. Day ↔ Page Build Map (15-Day Plan)

The build order below is sequenced so each page's frontend has the backend/AI pieces it depends on already in place. Days without a "Page" entry are infrastructure/AI-engine days — they don't ship a screen themselves, but the page listed under "Feeds into" is where their work becomes visible.

| Day | File | Page built | Layers covered |
|---|---|---|---|
| 1 | `day-01-project-setup-tooling.md` | — (project skeleton) | Frontend + Backend scaffolding |
| 2 | `day-02-database-multitenancy.md` | — (feeds every page) | Backend |
| 3 | `day-03-auth-login-page.md` | Login / Onboarding | Frontend + Backend |
| 4 | `day-04-dashboard-page.md` | Dashboard | Frontend + Backend |
| 5 | `day-05-document-vault-page.md` | Document Vault | Frontend + Backend |
| 6 | `day-06-document-detail-vector-pipeline.md` | Document Detail | Frontend + Backend + AI |
| 7 | `day-07-hybrid-search-rag-engine.md` | — (feeds Audit Workspace) | Backend + AI |
| 8 | `day-08-langgraph-agent-core.md` | — (feeds Audit Workspace) | Backend + AI |
| 9 | `day-09-self-correcting-validator.md` | — (feeds Audit Workspace) | Backend + AI |
| 10 | `day-10-audit-workspace-chat-page.md` | Audit Workspace (Chat) | Frontend + Backend + AI |
| 11 | `day-11-audit-report-page.md` | Audit Report / Findings | Frontend + Backend |
| 12 | `day-12-standards-library-page.md` | Standards Library | Frontend + Backend + AI (custom framework extraction) |
| 13 | `day-13-mcp-integrations-page.md` | Integrations (MCP) | Frontend + Backend + AI |
| 14 | `day-14-admin-notifications-pages.md` | Admin Settings + Notifications | Frontend + Backend |
| 15 | `day-15-e2e-orchestration-deployment.md` | — (proves every page works together) | Backend + Infra |

Each day file follows the same internal structure so it's predictable to hand to a coding assistant: **Learning goal → Functional recap → Backend → Frontend → AI/ML layer (where applicable) → Deliverables checklist.**

## 6. How to Use This Document Set

- Use **this file** to understand product behavior before touching code — what should exist, from a user's perspective, and which day builds which page.
- Use the **`day-01` through `day-15` files** in build order; each assumes every previous day is done, and each names the exact page (if any) it delivers.
- When a coding assistant is asked to implement a feature, point it at the relevant day file *and* the relevant section of this file so it has both the "why" (functional intent) and the "how" (technical contract, plus the reasoning behind each architectural choice — the day files are written to teach, not just instruct).
- The single-file HTML mockup (`complianceintel-mockup.html`) is a clickable reference for what each page looks like structurally — open it alongside the day files when building the corresponding page.
