# Day 14 — Admin Settings & Notifications Pages

**Page(s) touched:** Admin / Organization Settings, Notifications / Background Task Monitor
**You'll be able to say afterward:** "I understand why tenant/user management is deliberately kept separate from document/AI functionality, and how a single notification concept unifies status from very different backend systems."

---

## Learning goal
Two smaller pages today, grouped together because both are largely CRUD/UX work layered on infrastructure you've already built (Day 2's users table, Day 5's Celery tasks) — a good day to consolidate rather than introduce new architecture.

## Part 1 — Admin / Organization Settings

### Functional recap
Admin-only page: manage org membership (invite, change role, remove), view org-level settings (retention policy, which local model is currently active).

### Backend
- `POST /api/orgs/{org_id}/invitations` — invite a user by email + role; sends an invite (in a fully offline deployment, this likely means generating a one-time signup link rather than an actual email, depending on whether the customer's environment has any outbound mail capability — worth a product decision, not just a technical one)
- `GET /api/orgs/{org_id}/users` — list members with roles
- `PATCH /api/orgs/{org_id}/users/{user_id}` — change a user's role
- `DELETE /api/orgs/{org_id}/users/{user_id}` — remove a user
- All routes gated with `require_role("admin")` from Day 3 — this page is the clearest example in the whole product of the role matrix in action: every single endpoint here is admin-only, no exceptions

### Learning note: why Admin is deliberately isolated from document/AI functionality
An admin's job here is managing *who* can access the system and *what tenant-level policy* applies — not touching document content or audit findings. Keeping this page and its API routes structurally separate (a distinct router, distinct permission gate) means a security review of "what can an admin actually reach" is a bounded, readable question, instead of admin capabilities being scattered across every other router in the app.

### Frontend
- `AdminPage` — tabs or sections: `UserManagementTable` (Shadcn `Table` + `Select` for role, `Dialog` for invite), `OrgSettingsPanel` (retention policy input, read-only display of active models — changing the active model itself is an infrastructure/deployment concern, not something this page should expose as a live-editable dropdown, since swapping the reasoning model has real implications for Day 9's reproducibility guarantees)

## Part 2 — Notifications / Background Task Monitor

### Functional recap
A persistent tray (and toast notifications) surfacing everything happening asynchronously — Day 5's document ingestion, Day 10's long audit runs — so nothing silently fails without the user noticing.

### Backend
Nothing new — this page is a *view* over infrastructure built on Day 5 (`GET /api/tasks`, `GET /api/tasks/{task_id}`). Today's backend work, if any, is making sure task records carry enough detail (a human-readable `error` string, a `task_type` field distinguishing "ingestion" from "audit run") to render meaningfully here rather than just a bare status enum.

### Frontend
- `NotificationsTray` — a persistent, dismissible panel (not a full separate route necessarily — could be a slide-out panel accessible from any page via the topbar) listing running/recently-completed/failed tasks
- `ToastNotification` — fires on task completion/failure even if the user isn't looking at the tray, using the same polling data source already established on the Dashboard (Day 4) and Vault (Day 5) pages

### Learning note: one shared data source, several presentations
Notice that Days 4, 5, and 14 all render task status, but from the *same* `GET /api/tasks` endpoint, just filtered/sliced differently (Dashboard shows a short recent list, Vault shows only document-ingestion tasks, Notifications shows everything). This is worth internalizing as a pattern: build one well-designed endpoint and let each page ask a slightly different question of it, rather than building page-specific endpoints that each reimplement the same underlying query.

## Deliverables checklist
- [ ] Admin routes fully gated to `admin` role; verified a `compliance_officer` gets a 403 attempting any of them
- [ ] Invite flow produces something a new user can actually use to gain access, appropriate to the deployment's offline/self-hosted nature
- [ ] Notifications tray reflects both ingestion tasks (Day 5) and audit runs (Day 10) with human-readable status/error text
- [ ] Toast fires on completion/failure regardless of which page the user is currently viewing
