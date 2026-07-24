import express from 'express'
import cors from 'cors'
import companiesRouter from './routes/companies.js'
import statsRouter from './routes/stats.js'
import chatRouter from './routes/chat.js'
import taxonomyRouter from './routes/taxonomy.js'
import healthRouter from './routes/health.js'
import { warmCompaniesCache } from './services/companiesStore.js'

// Safety net: a single stray unhandled rejection (e.g. from a background job, or a Redis
// client edge case) shouldn't take the whole process down. Log it instead — the request path
// that triggered it should already have its own error handling.
process.on('unhandledRejection', err => console.error('Unhandled rejection:', err))

const app = express()
// Neither environment actually needs cross-origin requests: Vite's dev server proxies /api/*
// to this backend (frontend/vite.config.ts), so the browser talks same-origin to localhost:5173
// in dev; in production, vercel.json's rewrites put both services on the same domain. So this
// is deliberately narrow rather than a wildcard — production disables CORS outright, dev is
// pinned to the exact Vite origin.
app.use(cors({ origin: process.env.VERCEL ? false : 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/companies', companiesRouter)
app.use('/api/stats', statsRouter)
app.use('/api/chat', chatRouter)
app.use('/api/taxonomy', taxonomyRouter)
app.use('/api/healthz', healthRouter)

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
