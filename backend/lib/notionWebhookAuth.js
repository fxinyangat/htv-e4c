import { timingSafeEqual } from 'crypto'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Loaded independently here (matching notion.js/dust.js/jwt.js/googleAuth.js's pattern) — this
// file reads its env var at module-load time, so it can't assume some other module already ran
// dotenv.config() first (ES module import order isn't something to rely on for that).
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env.local') })

const NOTION_WEBHOOK_SECRET = process.env.NOTION_WEBHOOK_SECRET
if (!NOTION_WEBHOOK_SECRET) console.warn('WARNING: NOTION_WEBHOOK_SECRET is not set')

// Not Notion-signed — this is the database Automation "Send webhook" action, which sends no
// signature of its own ("doesn't require authentication," per Notion's docs). Security here is
// entirely on our side: a shared secret we generate ourselves and add as a custom header
// (X-Webhook-Secret) when configuring the automation. timingSafeEqual (not ===) avoids leaking
// anything about how close a forged secret got via response-time differences.
export function verifyWebhookSecret(providedSecret) {
  if (!providedSecret) return false
  const expectedBuf = Buffer.from(NOTION_WEBHOOK_SECRET)
  const actualBuf = Buffer.from(providedSecret)
  if (expectedBuf.length !== actualBuf.length) return false
  return timingSafeEqual(expectedBuf, actualBuf)
}
