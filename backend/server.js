import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRouter from './routes/auth.js'
import companiesRouter from './routes/companies.js'
import statsRouter from './routes/stats.js'
import chatRouter from './routes/chat.js'
import taxonomyRouter from './routes/taxonomy.js'
import healthRouter from './routes/health.js'
import webhooksRouter from './routes/webhooks.js'
import { warmCompaniesCache } from './services/companiesStore.js'
import { requireAuth } from './middleware/requireAuth.js'
import { requireRole } from './middleware/requireRole.js'
import { requireOrigin } from './middleware/requireOrigin.js'

// Safety net: a single stray unhandled rejection (e.g. from a background job, or a Redis
// client edge case) shouldn't take the whole process down. Log it instead — the request path
// that triggered it should already have its own error handling.
process.on('unhandledRejection', err => console.error('Unhandled rejection:', err))

const app = express()
// Vercel terminates TLS upstream and forwards over its own proxy — without this, req.protocol
// would report 'http' even in production, breaking the OAuth redirect_uri Google is asked to
// match exactly (see authController.js's callbackRedirectUri).
app.set('trust proxy', true)

// Neither environment actually needs cross-origin requests: Vite's dev server proxies /api/*
// to this backend (frontend/vite.config.ts), so the browser talks same-origin to localhost:5173
// in dev; in production, vercel.json's rewrites put both services on the same domain. So this
// is deliberately narrow rather than a wildcard — production disables CORS outright, dev is
// pinned to the exact Vite origin.
app.use(cors({ origin: process.env.VERCEL ? false : 'http://localhost:5173' }))
app.use(express.json())
app.use(cookieParser())

// Access control map — every route group's auth requirement is visible here in one place.
// requireOrigin only actually checks mutating methods internally, so it's safe to apply
// wherever requireAuth is, even to routers that also serve GET requests.
app.use('/api/auth', authRouter) // public entry points; requireAuth/requireOrigin applied per-route inside auth.js
app.use('/api/healthz', healthRouter) // public
app.use('/api/webhooks', webhooksRouter) // public — Notion isn't a logged-in browser; authenticity comes from a shared-secret header, not cookies/CORS
app.use('/api/chat', requireAuth, requireOrigin, chatRouter) // any approved role — Admin/Analyst/Investor all get chat
app.use('/api/companies', requireAuth, requireOrigin, requireRole('Admin', 'Analyst'), companiesRouter)
app.use('/api/taxonomy', requireAuth, taxonomyRouter) // any approved role
app.use('/api/stats', requireAuth, requireOrigin, statsRouter) // per-route role restriction inside stats.js (pipeline is Admin/Analyst-only, inbound is any role)

// Vercel's Node runtime imports this file for its exported Express app and calls it directly
// per-request — it never runs app.listen() itself. Only bind a real port for local dev.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 8000
  app.listen(PORT, () => console.log(`HTV backend listening on http://localhost:${PORT}`))

  // Warm the companies cache immediately, then keep refreshing it before the TTL expires
  // so the ~60s Notion fetch never happens on a user-facing request. Background timers like
  // this don't reliably do anything on Vercel (invocations aren't guaranteed to share a
  // process), so this only runs for the local, always-on dev server.
  warmCompaniesCache()
}

export default app
