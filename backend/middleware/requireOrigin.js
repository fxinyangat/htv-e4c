// CSRF hardening layered on top of the session cookie's SameSite attribute, not a replacement
// for it. Only checked on state-changing methods.
//
// Not compared against req.get('host'): Vite's dev proxy uses changeOrigin: true, which rewrites
// the Host header this server sees to match its own port (localhost:8000) — but the browser's
// real Origin header still correctly says http://localhost:5173 (the actual page origin,
// unchanged by the proxy). Comparing against Host would reject every legitimate mutating
// request made through the dev proxy. In production there's no such proxy — frontend and
// backend genuinely share one domain via vercel.json's rewrites — so the expected origin there
// really is just this request's own origin.
const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

function expectedOriginHost(req) {
  return process.env.VERCEL ? req.get('host') : 'localhost:5173'
}

export function requireOrigin(req, res, next) {
  if (!MUTATING_METHODS.has(req.method)) return next()

  const origin = req.get('origin') || req.get('referer')
  if (!origin) {
    return res.status(403).json({ status: 'error', message: 'Missing Origin header', data: null })
  }

  let originHost
  try {
    originHost = new URL(origin).host
  } catch {
    return res.status(403).json({ status: 'error', message: 'Invalid Origin header', data: null })
  }

  if (originHost !== expectedOriginHost(req)) {
    return res.status(403).json({ status: 'error', message: 'Cross-origin request rejected', data: null })
  }

  next()
}
