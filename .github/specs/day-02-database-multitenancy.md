# Day 2 — Database Core & Multi-Tenancy

**Page(s) touched:** none directly — this is the foundation every page's data ultimately sits on. Think of it as "invisible plumbing" that the Dashboard, Vault, Reports, and every other page will read from starting Day 4.
**You'll be able to say afterward:** "I understand why every single query in this app is forced to filter by organization, and what breaks if it isn't."

---

## Learning goal
In a multi-tenant SaaS product, the single most dangerous class of bug is **data leaking between customers** — Org A seeing Org B's confidential compliance documents. This day builds the schema and query discipline that makes that class of bug structurally hard to write, not just something you promise to remember.

## Stack
- Supabase Local Stack — local emulator running PostgreSQL, Auth, and Storage in Docker
- SQLAlchemy 2.0 (async engine, `asyncpg` driver) — Python ORM/query layer for FastAPI
- Supabase CLI — manages schema migrations and local dev lifecycle

## Core concept: tenant isolation
Every table that stores anything belonging to a specific organization carries an `organization_id` column that is **NOT NULL** and **indexed**. Every single query against that table includes an `organization_id = ?` filter — no exceptions. 
Furthermore, tenant isolation is strictly enforced at the database level using Postgres **Row-Level Security (RLS)**.

---

## Schema

```
organizations
  id (uuid, pk)
  name (text)
  created_at (timestamptz)
  retention_policy_days (int, nullable)

users
  id (uuid, pk)                        -- maps to auth.users.id from Supabase Auth
  organization_id (uuid, fk -> organizations.id, NOT NULL, indexed)
  email (text, unique per org)
  role (enum: admin, compliance_officer, security_architect, auditor)
  created_at (timestamptz)

documents
  id (uuid, pk)
  organization_id (uuid, fk, NOT NULL, indexed)
  uploaded_by (uuid, fk -> users.id)
  filename (text)
  content_hash (text, indexed)          -- powers Day 5's dedupe logic
  status (enum: queued, parsing, embedding, ready, failed)
  created_at (timestamptz)

audit_reports
  id (uuid, pk)
  organization_id (uuid, fk, NOT NULL, indexed)
  standard_id (uuid, fk -> standards.id)
  created_by (uuid, fk -> users.id)
  created_at (timestamptz)

findings
  id (uuid, pk)
  report_id (uuid, fk -> audit_reports.id, NOT NULL, indexed)
  organization_id (uuid, fk, NOT NULL, indexed)   -- denormalized on purpose, see below
  control_ref (text)
  verdict (enum: compliant, non_compliant, needs_review)
  citation_document_id (uuid, fk -> documents.id)
  citation_excerpt (text)
  notes (text, nullable)

standards
  id (uuid, pk)
  organization_id (uuid, nullable)   -- NULL = built-in/global framework, non-null = org-custom
  name (text)
  controls_json (jsonb)
```

### Learning note: why `organization_id` is duplicated onto `findings`
`findings` could technically get its org scope by joining through `audit_reports`. We put it directly on `findings` anyway. This is a deliberate trade: a little extra storage and a little extra write-time bookkeeping, in exchange for making it *impossible* to write a `findings` query that forgets tenant scoping through a missed or broken join. When in doubt in this codebase, denormalize the tenant key onto the leaf table — cheap insurance against an expensive class of bug.

---

## The enforcement pattern (this is the part that matters most)

We employ a "belt-and-suspenders" security architecture:

### 1. Application-Level Scoping
Every repository/query function takes `organization_id` as an **explicit, required, first-class argument**:

```python
async def get_document(db: AsyncSession, organization_id: UUID, document_id: UUID) -> Document:
    stmt = select(Document).where(
        Document.id == document_id,
        Document.organization_id == organization_id,   # mandatory, always present
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
```

### 2. Database-Level Row-Level Security (RLS)
We enable RLS on every tenant-scoped table. When executing queries from the frontend or through the API, policies isolate data based on the authenticated user's organization:
```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON documents
  USING (organization_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);
```
During local testing, we verify that session contexts correctly filter out rows from other tenants.

## Migrations
We manage the schema using native Supabase SQL migrations placed in `supabase/migrations/`. These files are applied locally via `npx supabase db reset` or `npx supabase migration up`.

## Deliverables checklist
- [ ] Local Supabase initialized and running via CLI (`npx supabase init` + `npx supabase start`)
- [ ] SQL migrations for all tables above, with all tenant tables' `organization_id` verified NOT NULL + indexed
- [ ] Row-Level Security (RLS) policies defined and enabled on all tenant tables in the migration script
- [ ] SQLAlchemy models matching the schema
- [ ] Repository functions that require `organization_id` as a parameter
- [ ] A test: seed two organizations, and verify that query results and RLS policies prevent Org A from accessing Org B's rows under any circumstances
