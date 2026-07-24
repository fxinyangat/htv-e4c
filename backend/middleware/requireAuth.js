import { verifySessionToken, SESSION_COOKIE_NAME } from '../lib/jwt.js'
import { getUserBySub } from '../services/usersStore.js'

// Verifies the session cookie, then re-checks the user's *current* Status/Role from the Users
// store rather than trusting anything in the token — the token only ever carries the stable
// Google `sub`, so a rejection or role change made directly in Notion takes effect on this
// user's next request (within the Users cache's short TTL), not just their next login.
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE_NAME]
  const payload = verifySessionToken(token)
  if (!payload) {
    return res.status(401).json({ status: 'error', message: 'Not authenticated', data: null })
  }

  let user
  try {
    user = await getUserBySub(payload.sub)
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Failed to verify session', data: null })
  }

  if (!user || user.status !== 'Approved') {
    return res.status(401).json({ status: 'error', message: 'Not authenticated', data: null })
  }

  req.user = { sub: user.sub, email: user.email, name: user.name, picture: user.picture, role: user.role }
  next()
}
