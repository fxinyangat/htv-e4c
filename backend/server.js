import express from 'express'
import cors from 'cors'
import {
  notionFetch, fetchAllPages, NOTION_COMPANIES_DB_ID,
  readTitle, readText, readMultiSelect, readSelect, readUrl, readOptions,
  toMultiSelect, toSelect, toTitle, toRichText, toUrl,
} from './notion.js'

const app = express()
app.use(cors())
app.use(express.json())

function stripDomain(url) {
  if (!url) return ''
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

// Agent writes JSON like { "Industry": "why NA/Out Of Scope", "Stage": "...", "Product": "...",
// "Technology": "...", "Region": "...", "Action": "single most important fix" } into the
// "Tagging Comment" rich_text property. Only keys with filler values are present.
function parseTaggingComment(raw) {
  const text = (raw || '').trim()
  if (!text) return { tagging_comment: [], tagging_action: null }
  try {
    const obj = JSON.parse(text)
    const tagging_action = typeof obj.Action === 'string' ? obj.Action : null
    const tagging_comment = Object.entries(obj)
      .filter(([key]) => key !== 'Action')
      .map(([label, note]) => ({ label, note: String(note) }))
    return { tagging_comment, tagging_action }
  } catch {
    // Agent wrote non-JSON text — surface it as a single note rather than dropping it.
    return { tagging_comment: [{ label: 'Note', note: text }], tagging_action: null }
  }
}

let nextTagId = 1

// Flatten a raw Notion page fitting thw frontend type expects.
function mapCompany(page) {
  const p = page.properties

  const industry = readMultiSelect(p['Industry (HVC)'])
  const constructionStage = readMultiSelect(p['Construction Stage (HVC)'])
  const productType = readMultiSelect(p['Product Type (HVC)'])
  const technologyType = readMultiSelect(p['Technology Type (HVC)'])
  const region = readMultiSelect(p['Region (HTV)'])
  const originCategory = readMultiSelect(p['Origin Category (HVC)'])
  const diversity = readMultiSelect(p['Diversity Status'])

  const taggedBy = readSelect(p['Tagged By']) || 'NA'
  const tagSource = taggedBy === 'Human' ? 'human' : taggedBy === 'AI Agent' ? 'llm' : 'human'
  const { tagging_comment, tagging_action } = parseTaggingComment(readText(p['Tagging Comment']))

  const tags = []
  const axes = [
    ['industry', industry],
    ['construction_stage', constructionStage],
    ['product_type', productType],
    ['technology_type', technologyType],
  ]
  for (const [axis, values] of axes) {
    for (const value of values) {
      tags.push({
        id: String(nextTagId++),
        axis, value, source: tagSource,
        confidence: 1, is_accepted: true, reasoning: null,
      })
    }
  }

  return {
    id: page.id,
    external_id: `HV-${page.id.slice(0, 8)}`,
    name: readTitle(p['Name']),
    description: readText(p['Description']),
    priority: 'review',
    updated_at: (page.last_edited_time || '').slice(0, 10),
    domain: stripDomain(readUrl(p['Domain'])),
    location: readText(p['Location']),
    region,
    diversity_status: diversity[0] || null,
    linkedin_url: readUrl(p['LinkedIn URL']),
    origin_source: readUrl(p['Origin Source']) || '',
    origin_category: originCategory[0] || null,
    allie_knockout: readSelect(p['Allie Knockout Pass/Fail']),
    andra_knockout: readSelect(p['Andra Knockout Pass/Fail']),
    tagged_by: taggedBy,
    tags,
    activity: [],
    notes: [],
    tagging_comment,
    tagging_action,
  }
}

// Full company list, cached in-memory so an uncapped fetch (now spanning every row,
// not just the first 1000 — currently ~10k) doesn't hit Notion on every page load.
// A full fetch takes ~60s at this row count, so the cache is warmed on startup and
// refreshed proactively in the background — requests should never hit a cold cache.
const COMPANIES_TTL_MS = 60 * 60 * 1000 // 1 hour — a manual refresh button covers the "I need this now" case
// Floor between forced (?refresh=1) fetches, shared across every user/tab — stops someone
// mashing the Refresh button (or multiple people refreshing at once) from stacking up
// several ~60s Notion pulls at the same time.
const MIN_REFRESH_INTERVAL_MS = 60 * 1000
let companiesCache = null
let companiesCachedAt = 0
let companiesLoadPromise = null // in-flight fetch, shared so concurrent requests don't double-fetch

function loadCompanies() {
  if (companiesLoadPromise) return companiesLoadPromise
  companiesLoadPromise = (async () => {
    const pages = await fetchAllPages(NOTION_COMPANIES_DB_ID)
    companiesCachedAt = Date.now()
    const payload = { companies: pages.map(mapCompany), cached_at: companiesCachedAt }
    companiesCache = payload
    return payload
  })()
  companiesLoadPromise.finally(() => { companiesLoadPromise = null })
  return companiesLoadPromise
}

app.get('/api/companies', async (req, res) => {
  try {
    const wantsRefresh = req.query.refresh === '1'
    const cacheAge = companiesCache ? Date.now() - companiesCachedAt : Infinity
    // A forced refresh only actually re-fetches if the cache is older than the cooldown —
    // otherwise it's treated like a normal request and just serves the (recent) cache.
    const shouldFetch = !companiesCache || cacheAge >= COMPANIES_TTL_MS || (wantsRefresh && cacheAge >= MIN_REFRESH_INTERVAL_MS)
    if (!shouldFetch) {
      return res.json(companiesCache)
    }
    res.json(await loadCompanies())
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ error: err.message })
  }
})

// Add Company: creates a new page in the real Notion Companies database. Tagged By is left
// unset (mapCompany defaults that to 'NA'/untagged), matching a fresh row the Dust agent
// hasn't picked up yet.
app.post('/api/companies', async (req, res) => {
  try {
    const { name, domain, description, origin_source, origin_category } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Company name is required' })
    }
    const properties = { 'Name': toTitle(name) }
    if (domain) properties['Domain'] = toUrl(/^https?:\/\//.test(domain) ? domain : `https://${domain}`)
    if (description) properties['Description'] = toRichText(description)
    if (origin_source) properties['Origin Source'] = toUrl(origin_source)
    if (origin_category) properties['Origin Category (HVC)'] = toMultiSelect([origin_category])

    const createdPage = await notionFetch('/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: NOTION_COMPANIES_DB_ID },
        properties,
      }),
    })
    const mapped = mapCompany(createdPage)
    if (companiesCache) {
      companiesCache.companies.unshift(mapped)
    }
    res.json(mapped)
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ error: err.message })
  }
})

app.get('/api/companies/:id', async (req, res) => {
  try {
    const page = await notionFetch(`/pages/${req.params.id}`)
    res.json(mapCompany(page))
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ error: err.message })
  }
})

// Maps editable app fields to their Notion property writers. Only keys present in the
// request body get touched — Approve Tags sends just the 5 axes, Edit Save sends everything.
const FIELD_WRITERS = {
  name: v => ({ 'Name': toTitle(v) }),
  description: v => ({ 'Description': toRichText(v) }),
  domain: v => ({ 'Domain': toUrl(v ? (/^https?:\/\//.test(v) ? v : `https://${v}`) : null) }),
  linkedin_url: v => ({ 'LinkedIn URL': toUrl(v) }),
  location: v => ({ 'Location': toRichText(v) }),
  origin_source: v => ({ 'Origin Source': toUrl(v) }),
  origin_category: v => ({ 'Origin Category (HVC)': toMultiSelect(v ? [v] : []) }),
  allie_knockout: v => ({ 'Allie Knockout Pass/Fail': toSelect(v) }),
  andra_knockout: v => ({ 'Andra Knockout Pass/Fail': toSelect(v) }),
  region: v => ({ 'Region (HTV)': toMultiSelect(v) }),
  industry: v => ({ 'Industry (HVC)': toMultiSelect(v) }),
  construction_stage: v => ({ 'Construction Stage (HVC)': toMultiSelect(v) }),
  product_type: v => ({ 'Product Type (HVC)': toMultiSelect(v) }),
  technology_type: v => ({ 'Technology Type (HVC)': toMultiSelect(v) }),
}

// Used by both Approve Tags (axes only) and Edit Save (full record) — both are human-initiated
// writes, so this always marks the company Tagged By → Human, matching the Edit modal's own copy.
app.patch('/api/companies/:id', async (req, res) => {
  try {
    let properties = { 'Tagged By': toSelect('Human') }
    for (const [key, value] of Object.entries(req.body || {})) {
      const writer = FIELD_WRITERS[key]
      if (writer) properties = { ...properties, ...writer(value) }
    }
    const updatedPage = await notionFetch(`/pages/${req.params.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    })
    const mapped = mapCompany(updatedPage)
    // this keeps the warm cache consistent with the write instead of waiting on the next TTL refresh.
    if (companiesCache) {
      const idx = companiesCache.companies.findIndex(c => c.id === mapped.id)
      if (idx !== -1) companiesCache.companies[idx] = mapped
    }
    res.json(mapped)
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ error: err.message })
  }
})

// "Delete" = Notion archive, the same soft-delete Notion's own UI trash uses. Reversible from
// within Notion (not from this app) — never a hard, unrecoverable destroy.
app.delete('/api/companies/:id', async (req, res) => {
  try {
    await notionFetch(`/pages/${req.params.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ archived: true }),
    })
    if (companiesCache) {
      companiesCache.companies = companiesCache.companies.filter(c => c.id !== req.params.id)
    }
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ error: err.message })
  }
})

// Live dropdown options straight off the Notion schema, cached in-memory so we don't
// hit Notion on every request — schema changes are rare, unlike row data.
const TAXONOMY_TTL_MS = 60 * 60 * 1000 // 1 hour
let taxonomyCache = null
let taxonomyCachedAt = 0

app.get('/api/taxonomy', async (req, res) => {
  try {
    const fresh = req.query.refresh === '1'
    if (!fresh && taxonomyCache && Date.now() - taxonomyCachedAt < TAXONOMY_TTL_MS) {
      return res.json(taxonomyCache)
    }

    const db = await notionFetch(`/databases/${NOTION_COMPANIES_DB_ID}`)
    const p = db.properties

    const taxonomy = {
      industry: readOptions(p['Industry (HVC)']),
      construction_stage: readOptions(p['Construction Stage (HVC)']),
      product_type: readOptions(p['Product Type (HVC)']),
      technology_type: readOptions(p['Technology Type (HVC)']),
      region: readOptions(p['Region (HTV)']),
      origin_category: readOptions(p['Origin Category (HVC)']),
      allie_knockout_states: readOptions(p['Allie Knockout Pass/Fail']),
      andra_knockout_states: readOptions(p['Andra Knockout Pass/Fail']),
    }

    taxonomyCache = taxonomy
    taxonomyCachedAt = Date.now()
    res.json(taxonomy)
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ error: err.message })
  }
})

const PORT = process.env.PORT || 8000
app.listen(PORT, () => console.log(`HTV backend listening on http://localhost:${PORT}`))

// Warm the companies cache immediately, then keep refreshing it before the TTL expires
// so the ~60s Notion fetch never happens on a user-facing request.
loadCompanies().catch(err => console.error('Failed to warm companies cache:', err.message))
setInterval(() => {
  loadCompanies().catch(err => console.error('Failed to refresh companies cache:', err.message))
}, COMPANIES_TTL_MS)
