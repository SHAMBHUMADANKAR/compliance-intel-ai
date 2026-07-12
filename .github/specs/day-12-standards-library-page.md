# Day 12 — The Standards Library Page

**Page(s) touched:** Standards Library
**You'll be able to say afterward:** "I understand how a regulatory framework becomes structured data the agent can actually scope a search against, instead of just a PDF sitting in the Vault."

---

## Learning goal
Up to now, "standards" (SOC2, ISO 27001, HIPAA) have been referenced as a scoping parameter without explaining where that structured control list actually comes from. Today builds the page and data model that makes a framework something the system can reason *about*, not just a label attached to a report.

## Functional recap
This page lists built-in frameworks (SOC2, ISO 27001, HIPAA) with their control lists, plus any org-custom frameworks a customer has uploaded. Selecting a standard on the Audit Workspace page (Day 10) draws from this list; a `standard_id` scopes the LangGraph planner (Day 8) toward the relevant controls.

## Backend

### Data model
Recall from Day 2: the `standards` table has `organization_id` nullable — `NULL` means a built-in/global framework available to every tenant, non-null means an org-custom framework. `controls_json` stores the actual control list as structured JSON:
```json
[
  { "ref": "CC6.1", "title": "Logical Access Controls", "description": "The entity implements logical access security software..." },
  { "ref": "CC6.6", "title": "Boundary Protection", "description": "..." }
]
```

### Seeding built-in frameworks
SOC2, ISO 27001, and HIPAA control lists ship as seed data (a migration or a one-time seed script) rather than something a customer uploads — these are static, well-known frameworks. Treat this as reference data bundled with the product, versioned alongside the codebase so an update to a framework's official language is a deliberate, reviewed code change, not a silent runtime edit.

### Endpoints
- `GET /api/standards` — lists built-in + this org's custom frameworks
- `GET /api/standards/{id}` — one framework's full control list
- `POST /api/standards` — ingest a custom framework; the uploaded document goes through a *variant* of Day 5-6's pipeline (parse → but instead of chunking freely, attempt to extract a structured control list — realistically this needs either a fairly rigid expected input format, e.g. a spreadsheet with `ref`/`title`/`description` columns via the XLSX path, or an LLM-assisted extraction step using the Day 8 reasoning model with a strict output schema similar to Day 9's `ComplianceFinding` pattern)

### Learning note: why custom framework ingestion is harder than document ingestion
A regular document (Day 5-6) just needs to become searchable chunks — any reasonable split is fine. A *framework* needs to become a specific, structured list of individually addressable controls, because the Day 8 planner needs to be able to say "evaluate the corpus against control CC6.1" as a discrete unit. This is a good moment to notice that not all "upload a file" flows in this product are the same underlying operation, even though they look similar from the Vault page's perspective — accuracy requirements differ based on what the structured data is used for downstream.

## Frontend

### Components
- `StandardsLibraryPage` — grid of framework cards (built-in ones visually distinguished from org-custom, e.g., a "built-in" badge)
- `FrameworkDetailPanel` or modal — expands to show the full control list for one framework
- `UploadCustomFrameworkDialog` — file picker + a brief format hint ("upload a spreadsheet with ref/title/description columns, or a well-structured policy PDF"), calls `POST /api/standards`

## AI/ML layer
Only touched for the custom-framework-upload path, and only when the input isn't already cleanly structured (e.g., a prose PDF rather than a spreadsheet) — in that case, the same local reasoning model from Day 8 extracts `{ref, title, description}` triples under a strict Pydantic schema, following the same "schema-valid isn't automatically correct, spot-check it" caution from Day 9. Built-in frameworks never touch the AI layer at all — they're static seed data.

## Deliverables checklist
- [ ] SOC2, ISO 27001, HIPAA seeded as built-in frameworks (`organization_id = NULL`), visible to every org
- [ ] `POST /api/standards` correctly scopes a new custom framework to the uploading org
- [ ] Standards Library page distinguishes built-in vs. custom visually
- [ ] `standard_id` selected here flows correctly into the Day 10 Audit Workspace's scope selector and into the Day 8 planner node
