import { notionFetch, NOTION_COMPANIES_DB_ID, NOTION_USERS_DB_ID } from '../notion.js'
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
// The payload's `data` is NOT trustworthy as a complete page, even with "Select all existing
// properties" enabled on the automation's content config — confirmed live: a real delivery
// arrived with only 4 properties (missing Name and Domain entirely), which then got written
// straight into the cache, blanking fields that hadn't actually changed. Two earlier manual
// tests happened to receive fuller payloads, which is what led to that (wrong) assumption in
// the first place. So this only uses the payload to find out *which page changed* (id, parent
// database) — the actual field values always come from a fresh notionFetch, the same
// guaranteed-complete read every other part of this app uses.
export async function handleNotionWebhook(req, res) {
  const secret = req.get('X-Webhook-Secret')
  if (!verifyWebhookSecret(secret)) {
    return res.status(401).json({ status: 'error', message: 'Invalid webhook secret', data: null })
  }

  // Ack immediately — the automation doesn't need to wait on our cache write. Continues via
  // runInBackground (waitUntil on Vercel) so it isn't cut off the moment this response is sent —
  // same pattern the chat job uses.
  res.status(200).json({ status: 'success', message: 'OK', data: null })

  const pageId = req.body?.data?.id
  if (!pageId) return

  runInBackground((async () => {
    const page = await notionFetch(`/pages/${pageId}`)
    const databaseId = page.parent?.database_id
    if (databaseId === NOTION_COMPANIES_DB_ID) {
      await upsertCachedCompany(mapCompany(page))
    } else if (databaseId === NOTION_USERS_DB_ID) {
      upsertCachedUser(mapUser(page))
    }
  })())
}
