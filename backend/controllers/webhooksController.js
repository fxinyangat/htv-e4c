import { verifyWebhookSecret } from '../lib/notionWebhookAuth.js'

// This is Notion's database Automation "Send webhook" action (configured directly on the
// Companies database's Automations tab) — not the developer-dashboard Integration webhook
// subscription. No verification handshake, no Notion-computed signature; auth is a shared
// secret we generate ourselves, checked against a custom header added when configuring the
// automation (X-Webhook-Secret).
//
// The exact JSON body shape isn't documented by Notion and depends on which properties are
// selected when configuring the automation's webhook content — this handler is intentionally
// a stub until a real captured payload (via webhook.site, per Notion's own suggested testing
// approach) confirms the actual shape to parse and which cache-refresh logic to wire in.
export async function handleNotionWebhook(req, res) {
  const secret = req.get('X-Webhook-Secret')
  if (!verifyWebhookSecret(secret)) {
    return res.status(401).json({ status: 'error', message: 'Invalid webhook secret', data: null })
  }

  console.log('=== Notion automation webhook received ===')
  console.log(JSON.stringify(req.body, null, 2))
  console.log('===========================================')

  res.status(200).json({ status: 'success', message: 'OK', data: null })
}
