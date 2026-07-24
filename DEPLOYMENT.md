# Deployment (Vercel)

This app deploys as one Vercel project with two services defined in `vercel.json`: `frontend`
(Vite, served at `/`) and `backend` (Express, served at `/api`). Both live under the same
domain, so the frontend's relative `fetch('/api/...')` calls stay same-origin in both local dev
(via Vite's dev proxy) and production (via the rewrites below) — no CORS, no separate API base
URL to configure.

## `vercel.json`

```json
{
  "services": {
    "frontend": { "root": "frontend", "framework": "vite" },
    "backend": { "root": "backend", "entrypoint": "server.js" }
  },
  "rewrites": [
    { "source": "/api(/.*)?", "destination": { "type": "service", "service": "backend" } },
    { "source": "/(.*)", "destination": { "type": "service", "service": "frontend" } }
  ]
}
```

- `entrypoint: "server.js"` is required — without it, Vercel's Node runtime doesn't know which
  file exports the Express app.
- The `/api(/.*)?` rewrite must come before the catch-all `/(.*)` rewrite (order matters).

## Backend: adapting Express for Vercel

Vercel's Node runtime imports `backend/server.js` for its exported app and calls it directly
per request — it never runs `app.listen()` itself, and it doesn't guarantee one persistent
process across requests the way a traditional server does. `server.js` handles both:

```js
export default app

if (!process.env.VERCEL) {
  app.listen(PORT, ...)       // only bind a real port locally
  warmCompaniesCache()        // only meaningful with a long-lived process
}
```

`process.env.VERCEL` is set automatically by Vercel — never set it yourself locally.

## Environment variables

Set these in the Vercel project (Settings → Environment Variables), matching `.env.local`:

| Variable | Used for |
|---|---|
| `NOTION_API_KEY`, `NOTION_DATABASE_ID` | Notion API access (`backend/notion.js`) |
| `DUST_API_KEY`, `DUST_WORKSPACE_ID`, `DUST_AGENT_ID` | Ask AI chat agent (`backend/dust.js`) |
| `UPSTASH_REDIS_REST_KV_REST_API_URL`, `UPSTASH_REDIS_REST_KV_REST_API_TOKEN` | Redis cache (`backend/lib/redis.js`) |

The Redis vars come from Vercel's Upstash Marketplace integration (Project → Storage → Create
Database → Upstash for Redis) — note the names are **not** the plain `UPSTASH_REDIS_REST_URL`/
`_TOKEN` that `@upstash/redis`'s `Redis.fromEnv()` expects by default; the client in
`lib/redis.js` is built explicitly against the actual integration-generated names. The
integration also provides `UPSTASH_REDIS_REST_KV_URL` / `_REDIS_URL` (TCP-style, for clients
like ioredis) — unused here, since this app uses the REST client.

## Why the backend isn't a plain in-memory server anymore

Vercel Functions don't guarantee a persistent process between requests, which broke two
assumptions the backend was originally built on:

**Companies cache (`backend/services/companiesStore.js`)** — the ~10k-row company list is
expensive to fetch from Notion (~60s, paginated), and the app needs the full list in memory to
do custom scoring/filtering/sorting Notion's API can't do natively. It's cached two-tier:
in-process memory as a fast path when warm, backed by Redis as the cross-invocation source of
truth so a cold Vercel invocation reads Redis (~70ms, confirmed) instead of re-fetching from
Notion. Storage is chunked across multiple Redis keys by byte size (~800KB/chunk, not a fixed
row count) to stay under Upstash's per-request payload limits — 10k rows landed at 13 chunks in
testing. A short Redis lock (`htv:companies:refresh-lock`) prevents two cold invocations from
both kicking off a full Notion re-fetch at the same time.

**Chat (`backend/controllers/chatController.js`, `backend/dust.js`)** — Dust's multi-step
tool-calling replies can take a few minutes. The original design held one HTTP response open
the whole time; that's fragile (a dropped connection loses the in-progress result) and risks
exceeding Vercel's function duration cap. It's now a job-polling model instead:
`POST /api/chat` starts the Dust exchange in the background (via `waitUntil` on Vercel, a
plain un-awaited promise locally — see `backend/lib/background.js`) and returns a `jobId`
immediately; the frontend polls `GET /api/chat/:jobId/status` every ~1.5s. Job state lives in
Redis with a 1-hour TTL so finished/abandoned jobs don't accumulate. `dust.js`'s internal poll
timeout is 4 minutes (not 5) to leave safety margin under Vercel Hobby's 300s duration cap.

Both changes are transparent to the frontend/UI — same response shapes, same `ChatWidget`
status-update behavior, no visible difference except better reliability in production.

## Response envelope

Every backend endpoint (including each polled `/api/chat/:jobId/status` line) returns the same
shape: `{ status: 'success' | 'error' | 'progress', message, data }`. See
`backend/lib/response.js`.

## CORS

`backend/server.js` disables CORS entirely on Vercel (`origin: false`) and pins it to
`http://localhost:5173` locally — same-origin already covers both real usage paths (Vite's dev
proxy locally, `vercel.json`'s rewrites in production), so nothing legitimate needs cross-origin
access.

## Health check

`GET /api/healthz` → `{ status: 'success', message: 'OK', data: { ok: true } }`. Useful for
confirming a deploy is actually serving before testing anything else.

## Deploy checklist

1. All environment variables above are set in the Vercel project (not just `.env.local`).
2. `vercel.json` is committed at the repo root.
3. Gate access via Vercel Deployment Protection (Project Settings) until real app-level auth
   exists — nothing in the app itself currently restricts who can reach it.
4. After deploying: hit `/api/healthz`, then a real page load, then a chat question, to confirm
   the full path (frontend → backend → Notion/Dust/Redis) end-to-end.
