# Day 11 — The Audit Report Page

**Page(s) touched:** Audit Report / Findings
**You'll be able to say afterward:** "I understand why a chat transcript isn't a durable enough artifact for a compliance audit, and what turns an ephemeral answer into a citable record."

---

## Learning goal
Day 10 gave you a great *conversation*. Today's job is turning that conversation's output into a *durable, structured, shareable record* — the actual deliverable a compliance officer hands to an auditor. This is a good day to notice a general pattern: chat is a great interface for exploration, but the artifact a business actually keeps is usually a structured record, not the transcript.

## Functional recap
Every time a `finding` event completes on the Audit Workspace page (Day 10), it's persisted here. This page lists all audit reports, and drilling into one shows every control evaluated, its verdict, the supporting citation, and space for an officer's notes — plus the ability to change a finding's status (open/resolved/dismissed) and export the whole report.

## Backend

### Persistence, tying back to Day 8-9's LangGraph output
When the `formatter` node (Day 8) produces a final `ComplianceFinding` (validated by Day 9), the API layer writes it to the `audit_reports` / `findings` tables from Day 2's schema. A single Audit Workspace conversation may produce one `audit_reports` row with multiple `findings` rows underneath it (one per control evaluated) — worth designing for multi-finding reports even if Day 10's example only showed a single-control question, since a real audit session typically evaluates many controls per session.

### Endpoints
- `GET /api/reports` — list, filterable by standard/status, used by both this page and Day 4's Dashboard "recent reports" widget
- `GET /api/reports/{id}` — full report with all its findings and citations
- `PATCH /api/reports/{id}/findings/{finding_id}` — officer updates a finding's status (open/resolved/dismissed) and notes; role-gated to `admin`/`compliance_officer` per Day 3's role matrix — a `security_architect` or `auditor` can view but not change verdicts
- `GET /api/reports/{id}/export` — renders the report to PDF/CSV for sharing outside the tool

### Learning note: why finding status is separate from finding verdict
`verdict` (`compliant`/`non_compliant`/`needs_review`) is what the AI determined. `status` (`open`/`resolved`/`dismissed`) is a *human* workflow state layered on top — an officer might mark a `non_compliant` finding as `resolved` once they've fixed the underlying policy, without that retroactively changing what the AI originally found at audit time. Keeping these as two separate fields preserves an honest historical record (what did the system actually conclude, when) while still letting the team track remediation work.

## Frontend

### Components
- `ReportsListPage` — table of reports (standard, finding count, overall status, created date), links into individual reports
- `ReportDetailPage` — header (standard, created by/date, export button) + list of `FindingCard` components
- `FindingCard` — shows `control_ref`, a verdict `Badge` (green/amber/red, same color language as the Dashboard), the officer's editable `notes` field, and a `CitationExcerpt` block quoting the exact grounded text plus a link back to Document Detail
- `ExportButton` — triggers `GET /api/reports/{id}/export`, downloads the resulting file

### Editable notes / status — a small but important UX detail
Only `admin`/`compliance_officer` roles see the status dropdown and notes field as editable; other roles see them as read-only text. Don't hide the fields entirely for read-only roles — an auditor still needs to *see* the officer's notes, just not change them. This is a good general rule for permission-gated UI: prefer read-only rendering over hiding, unless the data itself is sensitive.

## AI/ML layer
No new AI work today — this page is purely about persisting and presenting what Days 8-9 already produced. It's worth explicitly noticing the boundary: the AI's job ends when a validated `ComplianceFinding` exists; everything from here is conventional CRUD plus a PDF export, deliberately kept simple and reliable because this is the artifact that ends up in front of an actual external auditor.

## Deliverables checklist
- [ ] A completed Audit Workspace conversation reliably produces a persisted `audit_reports` row with one or more `findings`
- [ ] `PATCH` on finding status/notes is role-gated correctly (test as both compliance_officer and auditor)
- [ ] Report detail page renders verdict, citation excerpt, and a working link back to the exact Document Detail chunk
- [ ] Export produces a readable PDF/CSV a human could hand to an external auditor without additional cleanup
