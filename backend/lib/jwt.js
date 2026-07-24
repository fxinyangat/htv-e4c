import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Loaded independently here (matching notion.js/dust.js's pattern) rather than assuming some
// other module already ran dotenv.config() first — ES module import order isn't something to
// rely on for that, and this file reads its env var at module-load time, not inside a function.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env.local') })

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) console.warn('WARNING: JWT_SECRET is not set')

const SESSION_TTL = '7d'
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const SESSION_COOKIE_NAME = 'htv_session'

// Payload is deliberately minimal — just the Google `sub` (stable account id). Role/status are
// never trusted from the token; requireAuth always re-looks them up from the Users store so a
// Notion-side change (rejection, role change) takes effect on the next request, not just on
// the next login.
export function signSessionToken(sub) {
  return jwt.sign({ sub }, JWT_SECRET, { expiresIn: SESSION_TTL })
}

// Returns the decoded payload, or null if missing/invalid/expired — callers treat null as
// "not authenticated" rather than needing their own try/catch around this.
export function verifySessionToken(token) {
  if (!token) return null
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}
