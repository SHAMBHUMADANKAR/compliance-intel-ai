# Day 2 — Database Core & Multi-Tenancy

**Page(s) touched:** none directly — this is the foundation every page's data ultimately sits on. Think of it as "invisible plumbing" that the Dashboard, Vault, Reports, and every other page will read from starting Day 4.
**You'll be able to say afterward:** "I understand why every single query in this app is forced to filter by organization, and what breaks if it isn't."

---

## Learning goal
In a multi-tenant SaaS product, the single most dangerous class of bug is **data leaking between customers** — Org A seeing Org B's confidential compliance documents. This day builds the schema and query discipline that makes that class of bug structurally hard to write, not just something you promise to remember.

## Stack
- PostgreSQL — the relational store of record
- SQLAlchemy 2.0 (async engine, `asyncpg` driver) — Python ORM/query layer
- Alembic — schema migrations

## Core concept: tenant isolation
Every table that stores anything belonging to a specific customer ("organization" in this product) carries an `organization_id` column that is **NOT NULL** and **indexed**. Every single query against that table includes an `organization_id = ?` filter — no exceptions, no "just this once" queries. This is enforced two ways: at the application layer (a mandatory function argument, see below) and, later, as a second belt-and-suspenders layer using Postgres row-level security.

## Schema

```
organizations
  id (uuid, pk)
  name (text)
  created_at (timestamptz)
  retention_policy_days (int, nullable)

users
  id (uuid, pk)
  organization_id (uuid, fk -> organizations.id, NOT NULL, indexed)
  email (text, unique per org)
  hashed_password (text)
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

## The enforcement pattern (this is the part that matters most)

Every repository/query function takes `organization_id` as an **explicit, required, first-class argument** — never optional, never defaulted, never inferred:

```python
async def get_document(db: AsyncSession, organization_id: UUID, document_id: UUID) -> Document:
    stmt = select(Document).where(
        Document.id == document_id,
        Document.organization_id == organization_id,   # mandatory, always present
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
```

**Rule for any code — yours or an AI assistant's — added to this repo:** if a `select()` against `documents`, `audit_reports`, `findings`, `users`, or any future tenant-scoped table doesn't include an `organization_id` predicate, that's a bug, full stop, not a style nit. Day 15's test suite includes an automated check that greps for `select(` calls missing this filter — but the discipline starts here, on Day 2, before there's any code to check.

## Migrations
Alembic autogenerate handles structure, but manually verify every migration touching a tenant table adds `organization_id` as `NOT NULL` with an index — autogenerate sometimes gets nullability wrong on a first pass, and a nullable tenant key is the single worst thing this schema could ship with.

## Row-level security (defense in depth — optional for Day 2, worth knowing about)
Postgres supports a second, database-level enforcement layer:
```sql
CREATE POLICY tenant_isolation ON documents
  USING (organization_id = current_setting('app.current_org')::uuid);
```
The FastAPI session would set `app.current_org` from the verified JWT (Day 3) at the start of each request. This means even a buggy query that *forgot* the `organization_id` filter would still be blocked by Postgres itself. It's not required to ship Day 2, but understand it conceptually now — it's the "seatbelt AND airbag" argument for why application-level filtering alone, while necessary, isn't the only layer a serious multi-tenant product would eventually want.

## Deliverables checklist
- [ ] Alembic migrations for all tables above, each tenant table's `organization_id` verified NOT NULL + indexed
- [ ] SQLAlchemy models matching the schema
- [ ] A base repository class/mixin that forces `organization_id` as a required argument on every read/write method
- [ ] A test: seed two organizations, assert Org A's repository calls never return Org B's rows, even when queried by an ID that exists in Org B
