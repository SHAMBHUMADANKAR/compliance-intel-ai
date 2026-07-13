# Day 3 — Authentication, Security Guards & the Login Page

**Page(s) touched:** Login / Organization Onboarding
**You'll be able to say afterward:** "I understand how a JWT becomes the single source of truth for who's asking and which org they belong to, everywhere in the app."

---

## Learning goal
Day 2 built tenant isolation into the database layer. Today you build the piece that *feeds* `organization_id` into every one of those Day 2 functions safely: authentication. The core lesson is that identity and tenant membership must come from a cryptographically verified token, never from anything the client typed into a form field or URL.

## Functional recap (from the product's perspective)
A user lands on Login, enters credentials, and — on their very first login to a brand-new deployment — is prompted to create their organization. After that, every page they visit trusts that they are who the token says they a## Backend

### Stack
- `PyJWT` or `PyJWT` — for verifying Supabase-issued JWT signatures using Supabase JWKS (JSON Web Key Sets) or local secret key
- FastAPI's dependency injection system for reusable "guard" functions

### Token contract
Supabase Auth tokens contain a payload structure like:
```json
{
  "sub": "<user_id>",
  "email": "user@example.com",
  "app_metadata": {
    "org_id": "<organization_id>",
    "role": "compliance_officer"
  },
  "exp": 1234567890
}
```
During registration or organization creation, we write custom triggers in Supabase PostgreSQL (or handle it in an onboarding API route) to add `org_id` and `role` to the user's `app_metadata`.

### Endpoints
FastAPI relies on Supabase Auth, but exposes helper routes:
- `POST /api/orgs` — bootstrapping first org, linking to the admin user
- FastAPI routes decode the incoming bearer token sent by the client.

### The dependency chain
```python
from fastapi import Security, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt  # or jose

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> AuthContext:
    token = credentials.credentials
    try:
        # Decode and verify Supabase JWT
        payload = jwt.decode(token, settings.SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
        user_id = payload["sub"]
        org_id = payload.get("app_metadata", {}).get("org_id")
        role = payload.get("app_metadata", {}).get("role")
        
        if not org_id:
            raise HTTPException(status_code=401, detail="User organization context missing")
            
        return AuthContext(user_id=user_id, organization_id=org_id, role=role)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(*allowed: str):
    def _dep(ctx: AuthContext = Depends(get_current_user)):
        if ctx.role not in allowed:
            raise HTTPException(status_code=403, detail="Permission denied")
        return ctx
    return _dep
```
Every route handler declares `ctx: AuthContext = Depends(get_current_user)` and passes `ctx.organization_id` straight into the Day 2 repository functions.

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
- `LoginForm` (Shadcn `Input`, `Button`, `Card`) — email + password fields, submits directly using `@supabase/supabase-js` `signInWithPassword()`
- `OnboardingForm` — shown when the authenticated user does not have an `org_id` in their token yet (bootstrap organization context)
- `AuthProvider` (React context) — wraps `@supabase/supabase-js` client, provides session data, handles automatic token refreshes out-of-the-box

### Learning note: where to store the token client-side
Supabase JS client library handles storing and refreshing tokens automatically (using localStorage/sessionStorage securely or custom cookies in SSR environments).

### What the Login page actually does, step by step
1. On mount, `AuthProvider` checks the active Supabase session — if valid, inspect JWT `app_metadata.org_id`. If `org_id` exists, route to Dashboard; if missing, route to Onboarding.
2. If no session exists, render `LoginForm`.
3. On submit, call Supabase `auth.signInWithPassword(...)`.
4. On success, check organization claim. If none exists, show `OnboardingForm` which calls `POST /api/orgs` to create a tenant organization and updates Supabase user metadata.

## AI/ML layer
None on this page.

## Deliverables checklist
- [ ] Supabase Auth configured and running locally
- [ ] `get_current_user` / `require_role` implemented in FastAPI and verified using mock JWTs
- [ ] Onboarding API `/api/orgs` implemented to link Supabase auth user to newly created organization
- [ ] Login UI: integrated with `@supabase/supabase-js` client, including custom sign-in/sign-out logic
- [ ] Tests: verify signature verification, role enforcement, and invalid JWT rejectionests: expired token rejected, tampered signature rejected, wrong-role request 403s
