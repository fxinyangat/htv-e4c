# Authentication & RBAC

Google OAuth for identity, a Notion "Users" database as the authorization source of truth, and a
signed JWT session cookie. Consistent with this app's existing philosophy (see `DEPLOYMENT.md`)
of using Notion as the system of record rather than introducing a new database.

## Roles

Three roles, enforced identically on both the frontend (nav visibility + route redirects) and
the backend (the actual security boundary — the frontend checks are UX only):

| Role | Can access |
|---|---|
| **Admin** | Everything Analyst can, plus user management (done directly in Notion — no in-app admin panel) |
| **Analyst** | Full CRUD on companies: Review Queue, Companies, Portfolio Metrics, tagging/editing/deleting |
| **Investor** | View-only. Blocked from Review Queue, Companies, Portfolio Metrics. Can use Inbound Stats and Ask AI |

`/api/chat` (Ask AI) requires login but has no role restriction — all three roles get it.

## Sign-up / sign-in flow

There's one button — "Sign in with Google" — no separate sign-up form. Whether a given Google
login is a sign-up or sign-in is decided implicitly by whether a matching Notion Users row
exists (just-in-time provisioning):

1. User clicks "Sign in with Google" → Google OAuth consent → redirected back to
   `GET /api/auth/google/callback` with an authorization code.
2. Backend exchanges the code, **verifies Google's ID token** (signature against Google's JWKS,
   audience = our client ID, issuer, expiry — not just an unauthenticated userinfo call), and
   gets the verified `sub` (Google's permanent per-account ID), `email`, `name`, `picture`.
3. Looks up a Notion Users row by `sub`.
   - **No row exists** → creates one with `Status: Pending`, no `Role`. This is the sign-up.
   - **Row exists but `Status !== Approved`** (`Pending` or `Rejected`) → same outcome as above.
   - **Row exists and `Status === Approved`** → real sign-in: JWT session cookie issued.
4. In the not-yet-approved cases, the user is redirected to `/login?pending=1` — **no session
   cookie is ever issued** until an admin manually flips `Status → Approved` (and sets `Role`)
   directly in the Notion Users database. Their next login attempt after that succeeds normally.

First admin is bootstrapped the same way, manually, in Notion — there's no env-var allowlist.

## OAuth security details

- **State + PKCE** — `GET /api/auth/google` generates a random `state` and a PKCE
  `code_verifier`/`code_challenge` (S256), stored in a short-lived (~10 min), `httpOnly`,
  `sameSite: lax` cookie scoped to `Path=/api/auth`. The callback rejects the exchange if the
  returned `state` doesn't match — blocks an attacker tricking a victim into linking the
  attacker's Google account to the victim's session.
- **Verified ID token**, not a bare userinfo call — see step 2 above (`backend/lib/googleIdToken.js`,
  using `jose`'s `createRemoteJWKSet`/`jwtVerify`).
- **User keyed by Google `sub`**, not email — emails can change/be reassigned, `sub` never does.

## Session

- Signed JWT (`jsonwebtoken`), payload is deliberately minimal: `{ sub }` only. Role/status are
  **never** trusted from the token — every request re-looks them up from the Users store, so a
  rejection or role change made directly in Notion takes effect on the user's *next request*
  (within the Users cache's 30s TTL), not just their next login.
- Cookie: `httpOnly`, `sameSite: strict`, `secure` in production, 7-day expiry.
- **Known limitation**: this is a stateless JWT, not a server-side session store — "logout" only
  clears the browser's cookie (`res.clearCookie`); it cannot truly revoke the token itself. A
  captured copy of the exact token string would remain valid until its natural 7-day expiry even
  after logout. Mitigated by `httpOnly`/`sameSite: strict`/`secure` making that copy hard to
  obtain in the first place. If true instant revocation is ever needed, the addition is a small
  Redis-backed denylist keyed on a `jti` claim — not built, since Redis-backed sessions were
  explicitly traded away in favor of this simpler design.

## CSRF protection

Two layers, neither alone sufficient:
1. `sameSite: strict` on the session cookie (blocks it from riding cross-site requests at all).
2. `requireOrigin` middleware (`backend/middleware/requireOrigin.js`) — every mutating request
   (POST/PATCH/PUT/DELETE) must have an `Origin` (or `Referer`) header matching the app's own
   origin, or it's rejected with 403. The expected origin is environment-aware: in production
   it's the request's own host (frontend and backend share one domain via `vercel.json`'s
   rewrites); in local dev it's hardcoded to `http://localhost:5173`, **not** derived from the
   request's `Host` header — Vite's dev proxy (`changeOrigin: true`) rewrites `Host` to match the
   backend's own port, which would otherwise cause every legitimate request through the proxy to
   be falsely rejected.

## Route enforcement (backend — the actual security boundary)

| Route | Auth required? | Role restriction |
|---|---|---|
| `/api/auth/google`, `/google/callback` | No | — |
| `/api/auth/logout` | No (but CSRF-checked) | — |
| `/api/auth/me` | Yes | any approved role |
| `/api/healthz` | No | — |
| `/api/chat*` | Yes | any approved role |
| `/api/companies*` (all CRUD) | Yes | **Admin/Analyst only** |
| `/api/taxonomy` | Yes | any approved role |
| `/api/stats/inbound` | Yes | any approved role |
| `/api/stats/pipeline` | Yes | **Admin/Analyst only** |

Wired via `requireAuth`/`requireRole`/`requireOrigin` middleware, applied at router-mount time
in `server.js` (visible as one access-control map) or per-route inside `routes/stats.js` where
`/inbound` and `/pipeline` need different role levels within the same router.

## Frontend enforcement (UX only — mirrors, does not replace, the backend)

- `RequireAuth` (`frontend/src/components/RequireAuth.tsx`) wraps the whole internal app route
  group — redirects to `/login` if not signed in.
- `RequireRole` nested one level deeper, wraps `/queue`, `/companies`, `/metrics` — redirects
  `Investor` to `/inbound` with a toast, guarded against firing that toast twice for the same
  blocked path.
- `AppLayout.tsx`'s nav hides links a role can't access.
- `AuthContext` (`frontend/src/context/AuthContext.tsx`) calls `GET /api/auth/me` once on app
  load (the session cookie is `httpOnly`, so this is the *only* way the frontend learns identity/
  role) and exposes `{ user, isLoading, logout }` app-wide.
- Both `Landing.tsx` and `AppLayout.tsx` show the signed-in user's avatar (Google profile picture,
  or an initials fallback) with a hover tooltip (name, email, role badge) and a logout button;
  Landing shows a "Sign in" link instead when logged out.
- `/api/chat` requires login now too (a deliberate reversal of an earlier "public chat from the
  Landing page for anonymous visitors" design) — `ChatWidget`/`Landing` catch the resulting 401
  as a distinct `ChatAuthError` and redirect to `/login` cleanly, checked *before* the chat panel
  ever opens so there's no flash-open-then-redirect for signed-out visitors.

## Notion "Users" database schema

Created manually (same pattern as the Companies database):

| Property | Type | Notes |
|---|---|---|
| `Name` | title | |
| `Email` | email | Contact/display only — **not** the lookup key |
| `Google sub` | rich_text | The actual lookup key — note lowercase "sub" |
| `Profile URL` | rich_text | Google's profile picture URL — not a Notion `url` property type |
| `Status` | select | `Pending` / `Approved` / `Rejected` |
| `Role` | select | `Admin` / `Analyst` / `Investor` |

Property names are exact-match and case-sensitive against the Notion API — two of the five were
initially mismatched during setup (`Google Sub` vs the actual `Google sub`, and an assumed
`Picture`/url-type field vs the actual `Profile URL`/rich_text) and had to be corrected in code
to match what was actually created, rather than the other way around.

## Required environment variables

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NOTION_USERS_DB_ID`, `JWT_SECRET` — needed in both
`.env.local` (local dev) and the Vercel project's Environment Variables (production; see
`DEPLOYMENT.md`). Google Cloud Console needs the exact redirect URI registered for each
environment: `http://localhost:8000/api/auth/google/callback` (local) and
`https://<production-domain>/api/auth/google/callback` (prod) — Google's redirect URI matching
is an exact string match, no wildcards.
