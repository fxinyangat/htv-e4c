import { NOTION_COMPANIES_DB_ID, NOTION_USERS_DB_ID } from '../notion.js'
import { verifyWebhookSecret } from '../lib/notionWebhookAuth.js'
import { runInBackground } from '../lib/background.js'
import { mapCompany, upsertCachedCompany } from '../services/companiesStore.js'
import { mapUser, upsertCachedUser } from '../services/usersStore.js'

// This is Notion's database Automation "Send webhook" action (configured directly on the
// Companies database's Automations tab), not the developer-dashboard Integration webhook
// subscription — no verification handshake, no Notion-computed signature. Auth is a shared
// secret we generate ourselves, checked against a custom header added when configuring the
// automation (X-Webhook-Secret).
//
// Captured live (see AUTHENTICATION.md-style project notes): with "Select all existing
// properties" enabled on the automation's webhook content, the payload's `data` field is
// already a complete Notion page object — same shape as GET /pages/:id (id, properties,
// parent.database_id, last_edited_time, created_time all present) — so mapCompany/mapUser can
// consume it directly with no extra Notion API round-trip.
export async function handleNotionWebhook(req, res) {
  const secret = req.get('X-Webhook-Secret')
  if (!verifyWebhookSecret(secret)) {
    return res.status(401).json({ status: 'error', message: 'Invalid webhook secret', data: null })
  }

  // Ack immediately — the automation doesn't need to wait on our cache write, which can involve
  // several Redis round-trips (see writeCompaniesToRedis's chunked rewrite in companiesStore.js).
  // Continues via runInBackground (waitUntil on Vercel) so it isn't cut off the moment this
  // response is sent — same pattern the chat job uses.
  res.status(200).json({ status: 'success', message: 'OK', data: null })

  const page = req.body?.data
  if (!page || page.object !== 'page') return

  runInBackground((async () => {
    const databaseId = page.parent?.database_id
    if (databaseId === NOTION_COMPANIES_DB_ID) {
      await upsertCachedCompany(mapCompany(page))
    } else if (databaseId === NOTION_USERS_DB_ID) {
      upsertCachedUser(mapUser(page))
    }
  })())
}
