# Day 3 — Authentication, Security Guards & the Login Page

**Page(s) touched:** Login / Organization Onboarding
**You'll be able to say afterward:** "I understand how a JWT becomes the single source of truth for who's asking and which org they belong to, everywhere in the app."

---

## Learning goal
Day 2 built tenant isolation into the database layer. Today you build the piece that *feeds* `organization_id` into every one of those Day 2 functions safely: authentication. The core lesson is that identity and tenant membership must come from a cryptographically verified token, never from anything the client typed into a form field or URL.

## Functional recap (from the product's perspective)
A user lands on Login, enters credentials, and — on their very first login to a brand-new deployment — is prompted to create their organization. After that, every page they visit trusts that they are who the token says they are.

## Backend

### Stack
- `passlib[bcrypt]` — password hashing
- `python-jose` (or `pyjwt`) — JWT signing/verification
- FastAPI's dependency injection system for reusable "guard" functions

### Token contract
```json
{
  "sub": "<user_id>",
  "org": "<organization_id>",
  "role": "compliance_officer",
  "exp": 1234567890,
  "iat": 1234567000
}
```
Signed with a server secret (HS256 is fine for a single-node self-hosted deployment; RS256 if the customer wants key rotation later). Access tokens are short-lived (15-30 min); a longer-lived refresh token is stored in an httpOnly, secure cookie and rotated on each use (old refresh token invalidated the moment a new one is issued — limits the damage window if one is ever stolen).

### Endpoints
- `POST /api/auth/login` — verify credentials against `users.hashed_password`, issue access + refresh tokens
- `POST /api/auth/refresh` — rotate an expiring access token using a valid refresh token
- `POST /api/auth/logout` — invalidate the current refresh token
- `POST /api/orgs` — first-run only: create a new organization + its first admin user

### The dependency chain (this is the piece that protects every other page)
```python
async def get_current_user(token: str = Depends(oauth2_scheme)) -> AuthContext:
    payload = decode_and_verify(token)          # raises 401 on bad signature/expiry
    return AuthContext(user_id=payload["sub"], organization_id=payload["org"], role=payload["role"])

def require_role(*allowed: Role):
    def _dep(ctx: AuthContext = Depends(get_current_user)):
        if ctx.role not in allowed:
            raise HTTPException(403)
        return ctx
    return _dep
```
Every route handler from Day 4 onward declares `ctx: AuthContext = Depends(get_current_user)` and passes `ctx.organization_id` straight into the Day 2 repository functions — **never** a client-supplied `organization_id` from a path, query string, or JSON body.

**Concrete anti-pattern to reject on sight in review:** a route signature like `def upload(organization_id: UUID, ...)` where that value comes from the request. If the product ever legitimately needs a cross-tenant operation (e.g., a future superadmin tool), that must be an explicit, separately-audited code path — never the default shape of a route.

### Role matrix (drives `require_role(...)` calls across every later day)

| Action | admin | compliance_officer | security_architect | auditor |
|---|---|---|---|---|
| Manage users/org settings | ✅ | ❌ | ❌ | ❌ |
| Upload/delete documents | ✅ | ✅ | ✅ | ❌ (read-only) |
| Run audits / chat | ✅ | ✅ | ✅ | ✅ |
| Edit finding status | ✅ | ✅ | ❌ | ❌ |
| Manage MCP connectors | ✅ | ❌ | ✅ (usage only) | ❌ |

## Frontend — the Login page

### Components
- `LoginForm` (Shadcn `Input`, `Button`, `Card`) — email + password fields, submit calls `POST /api/auth/login`
- `OnboardingForm` — shown only when the API signals "no organization exists yet" (first-run detection, e.g. a `GET /api/auth/bootstrap-status` check before rendering the form)
- `AuthProvider` (React context) — holds the decoded (client-side, non-authoritative) token claims for UI purposes only (e.g., showing the user's name), stores the access token in memory (not `localStorage` — see note below), and the refresh flow runs silently on a timer before expiry

### Learning note: where to store the token client-side
Storing the access token in `localStorage` is convenient but exposes it to any XSS vulnerability on the page. This project stores the access token in memory (a React context/state variable, lost on full page reload) and relies on the httpOnly refresh cookie to silently re-establish a session on reload — meaning a stolen XSS payload can't read the refresh token at all, and even the access token is only ever live in memory for its short 15-30 minute window.

### What the Login page actually does, step by step
1. On mount, `AuthProvider` attempts a silent refresh (`POST /api/auth/refresh` using the httpOnly cookie) — if it succeeds, skip Login and route straight to Dashboard.
2. If refresh fails, render `LoginForm`.
3. On submit, call `POST /api/auth/login`; on success, store the access token in memory, route to Dashboard; on failure, show an inline error (never reveal whether it was the email or the password that was wrong — that distinction leaks account existence).
4. First-run only: if `GET /api/auth/bootstrap-status` reports no organizations exist, render `OnboardingForm` instead, which calls `POST /api/orgs`.

## AI/ML layer
None on this page — Login and auth are pure application security, no model involvement. Worth stating explicitly: not every page in this product touches AI, and it's healthy to notice that up front rather than assume every screen needs a model behind it.

## Deliverables checklist
- [ ] `/api/auth/login`, `/refresh`, `/logout`, `/orgs` implemented and tested
- [ ] `get_current_user` / `require_role` used on every non-public route from this point forward
- [ ] No route accepts `organization_id` as client input for scoping
- [ ] Login page: silent-refresh-first flow, first-run onboarding branch, inline error handling
- [ ] Access token kept in memory only; refresh token in httpOnly cookie
- [ ] Tests: expired token rejected, tampered signature rejected, wrong-role request 403s
