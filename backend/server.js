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
    created_at: (page.created_time || '').slice(0, 10),
    domain: stripDomain(readUrl(p['Domain'])),
    location: readText(p['Location']),
    region,
    diversity_status: diversity[0] || null,
    diversity_statuses: diversity, // full multi-select — needed for Inbound Stats combo buckets (e.g. "Female & BIPOC Founder")
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

// Shared by every route that needs the company list — returns the warm cache unless it's
// stale (TTL expired) or a caller explicitly asked to refresh (subject to its own cooldown).
async function getFreshCompanies(wantsRefresh) {
  const cacheAge = companiesCache ? Date.now() - companiesCachedAt : Infinity
  const shouldFetch = !companiesCache || cacheAge >= COMPANIES_TTL_MS || (wantsRefresh && cacheAge >= MIN_REFRESH_INTERVAL_MS)
  if (!shouldFetch) return companiesCache
  return loadCompanies()
}

app.get('/api/companies', async (req, res) => {
  try {
    res.json(await getFreshCompanies(req.query.refresh === '1'))
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ error: err.message })
  }
})

// --- list-shaping + scoring, ported from the frontend's api.ts (kept in sync manually) ---
// so the Companies/Review Queue lists can be searched, filtered, sorted, and paginated here
// instead of shipping the full ~10k-row list to every browser tab on every page load.

const FILLER_VALUES = {
  industry: ['NA', 'Out Of Scope'],
  construction_stage: ['FILL IN', 'Other'],
  product_type: ['Other'],
  technology_type: ['Other'],
  region: ['Unknown'],
}
const SCORE_AXES = ['industry', 'construction_stage', 'product_type', 'technology_type', 'region']

function axisValues(company, axis) {
  if (axis === 'region') return company.region
  return company.tags.filter(t => t.axis === axis && t.is_accepted !== false).map(t => t.value)
}
function isAxisClean(company, axis) {
  const values = axisValues(company, axis)
  if (values.length === 0) return false
  const filler = FILLER_VALUES[axis] ?? []
  return !values.some(v => filler.includes(v))
}
function computeScore(company) {
  let score = 0
  const wordCount = company.description.trim().split(/\s+/).filter(Boolean).length
  if (company.description.trim() && wordCount > 20) score += 40
  if (company.location.trim()) score += 20
  if (company.domain.trim()) score += 20
  for (const axis of SCORE_AXES) {
    if (isAxisClean(company, axis)) score += 4
  }
  const band = score >= 80 ? 'high' : score >= 50 ? 'needs_review' : 'insufficient'
  return { score, band }
}

function toListItem(c) {
  const active = c.tags.filter(t => t.is_accepted !== false)
  const pending = active.filter(t => t.source !== 'human' && t.is_accepted === null)
  const aiTags = c.tags.filter(t => t.source !== 'human')
  const bySource = axis => active.find(t => t.axis === axis)?.source ?? null
  const bestSource = active.some(t => t.source === 'human' && t.is_accepted === true) ? 'Human'
    : active.some(t => t.source === 'llm') ? 'LLM'
    : '—'
  const valuesFor = axis => {
    const vals = active.filter(t => t.axis === axis).map(t => t.value)
    return vals.length ? vals.join('; ') : null
  }
  return {
    id: c.id, external_id: c.external_id, name: c.name, description: c.description,
    priority: c.priority, updated_at: c.updated_at,
    min_confidence: aiTags.length ? Math.min(...aiTags.map(t => t.confidence)) : null,
    has_pending: pending.length > 0,
    tag_count: c.tags.length,
    tagged_by: c.tagged_by,
    region: c.region.length ? c.region.join('; ') : null,
    construction_stage: valuesFor('construction_stage'),
    technology_type: valuesFor('technology_type'),
    product_type: valuesFor('product_type'),
    industry: valuesFor('industry'),
    tag_source: bestSource,
    construction_stage_source: bySource('construction_stage'),
    technology_type_source: bySource('technology_type'),
    product_type_source: bySource('product_type'),
    industry_source: bySource('industry'),
  }
}

function toQueueItem(c) {
  const active = c.tags.filter(t => t.is_accepted !== false)
  const valuesFor = axis => active.filter(t => t.axis === axis).map(t => t.value)
  const { score, band } = computeScore(c)
  return {
    id: c.id, external_id: c.external_id, name: c.name, description: c.description,
    updated_at: c.updated_at, tagged_by: c.tagged_by, score, band,
    tagging_comment: c.tagging_comment, tagging_action: c.tagging_action,
    industry: valuesFor('industry'),
    construction_stage: valuesFor('construction_stage'),
    product_type: valuesFor('product_type'),
    technology_type: valuesFor('technology_type'),
    region: c.region,
    tag_count: c.tags.length,
  }
}

function applySearch(items, search) {
  if (!search) return items
  const q = String(search).toLowerCase()
  return items.filter(i =>
    i.name.toLowerCase().includes(q) ||
    i.description.toLowerCase().includes(q) ||
    i.external_id.toLowerCase().includes(q)
  )
}

function parseFilters(raw) {
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function paginate(items, page, pageSize) {
  const size = Number(pageSize) || 20
  const p = Number(page) || 1
  const start = (p - 1) * size
  return items.slice(start, start + size)
}

// Companies page list — search/status/filter/sort/paginate happens here, server-side,
// against the already-warm cache, so the browser only ever receives the current page.
app.get('/api/companies/list', async (req, res) => {
  try {
    const { companies, cached_at } = await getFreshCompanies(req.query.refresh === '1')
    let items = companies.map(toListItem)
    items = applySearch(items, req.query.search)

    // Tagged By (Untagged/AI Tagged/Human Tagged) flows through this same generic filter
    // mechanism as an axis named 'tagged_by' — no special-casing needed, since its field is
    // a plain string just like the others below.
    const filters = parseFilters(req.query.filters)
    for (const [axis, values] of Object.entries(filters)) {
      if (!values.length) continue
      items = items.filter(i => {
        const field = i[axis]
        if (!field) return false
        return values.some(v => field.split('; ').includes(v))
      })
    }

    const sort = req.query.sort ?? 'updated_desc'
    if (sort === 'name_asc') items.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'name_desc') items.sort((a, b) => b.name.localeCompare(a.name))
    else if (sort === 'confidence_asc') items.sort((a, b) => (a.min_confidence ?? 1) - (b.min_confidence ?? 1))
    else if (sort === 'tags_desc') items.sort((a, b) => b.tag_count - a.tag_count)
    else if (sort === 'tags_asc') items.sort((a, b) => a.tag_count - b.tag_count)
    else items.sort((a, b) => b.updated_at.localeCompare(a.updated_at))

    res.json({ total: items.length, items: paginate(items, req.query.page, req.query.pageSize), cached_at })
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ error: err.message })
  }
})

// Review Queue list — same idea as above, shaped/scored for the queue view instead.
app.get('/api/companies/queue', async (req, res) => {
  try {
    const { companies, cached_at } = await getFreshCompanies(req.query.refresh === '1')
    let items = companies.map(toQueueItem)
    items = applySearch(items, req.query.search)

    // Tagged By (Untagged/AI Tagged/Human Tagged) flows through this same generic filter
    // mechanism as an axis named 'tagged_by' — the frontend defaults its selection to
    // Untagged + AI Tagged (the actual queue), so there's no server-side default to apply here.
    const filters = parseFilters(req.query.filters)
    for (const [axis, values] of Object.entries(filters)) {
      if (!values.length) continue
      items = items.filter(i => {
        const field = i[axis]
        if (!field) return false
        return Array.isArray(field) ? values.some(v => field.includes(v)) : values.includes(field)
      })
    }

    const sort = req.query.sort ?? 'score_asc'
    if (sort === 'name_asc') items.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'name_desc') items.sort((a, b) => b.name.localeCompare(a.name))
    else if (sort === 'score_asc') items.sort((a, b) => a.score - b.score)
    else if (sort === 'score_desc') items.sort((a, b) => b.score - a.score)
    else items.sort((a, b) => b.updated_at.localeCompare(a.updated_at))

    res.json({ total: items.length, items: paginate(items, req.query.page, req.query.pageSize), cached_at })
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ error: err.message })
  }
})

// Exact-combination bucketing (mutually exclusive) — a company tagged both SaaS and Hardware
// falls only into "SaaS + Hardware", never double-counted under standalone SaaS too.
function tallyCombo(companies, getValues) {
  const counts = new Map()
  for (const c of companies) {
    const values = getValues(c)
    if (!values.length) continue
    const label = [...values].sort().join(' + ')
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}

// Overlap counting — a company with 3 product types is counted once under each, so this can
// sum to more than the total. Matches how Product Type behaves in the source spreadsheet.
function tallyOverlap(companies, getValues) {
  const counts = new Map()
  for (const c of companies) {
    for (const v of getValues(c)) {
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}

function tallySingle(companies, getValue) {
  const counts = new Map()
  for (const c of companies) {
    const v = getValue(c)
    if (!v) continue
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}

const CONSTRUCTION_STAGES = ['Conception', 'Design&Engineering', 'Pre-Construction', 'Construction Execution', 'Post-Construction']

// Quarterly deal-flow breakdown for the (external) Inbound Stats page. `ranges` is a JSON array
// of { from, to } date strings (one per selected quarter) — companies are scoped to the union of
// those ranges by created_at, then every axis is bucketed dynamically from whatever combinations
// actually occur, rather than a hardcoded predefined taxonomy of buckets.
app.get('/api/stats/inbound', async (req, res) => {
  try {
    let ranges = []
    try {
      ranges = JSON.parse(req.query.ranges || '[]')
    } catch {
      ranges = []
    }

    const { companies, cached_at } = await getFreshCompanies(req.query.refresh === '1')
    const scoped = ranges.length
      ? companies.filter(c => c.created_at && ranges.some(r => c.created_at >= r.from && c.created_at <= r.to))
      : companies

    const axisValues = (c, axis) => c.tags.filter(t => t.axis === axis).map(t => t.value)

    // Construction Stage is special-cased, not a generic combo bucket: a company with the
    // literal "Entire Value Chain" tag goes there; 2+ discrete stage tags go to "multi-stage";
    // otherwise it lands in its one named stage.
    const stageCounts = Object.fromEntries(CONSTRUCTION_STAGES.map(s => [s, 0]))
    let entireValueChain = 0
    let multiStage = 0
    for (const c of scoped) {
      const stages = axisValues(c, 'construction_stage')
      if (stages.length === 1 && stages[0] === 'Entire Value Chain') entireValueChain++
      else if (stages.length > 1) multiStage++
      else if (stages.length === 1 && stageCounts[stages[0]] !== undefined) stageCounts[stages[0]]++
    }

    res.json({
      inboundTotal: scoped.length,
      femaleFounders: scoped.filter(c => (c.diversity_statuses || []).includes('Female Founder')).length,
      bipocFounders: scoped.filter(c => (c.diversity_statuses || []).includes('BIPOC Founder')).length,
      constructionStage: Object.entries(stageCounts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
      constructionStageExtra: [
        { label: 'Entire Value Chain', value: entireValueChain },
        { label: 'Focused on more than one stage', value: multiStage },
      ],
      region: tallyCombo(scoped, c => c.region),
      source: tallySingle(scoped, c => c.origin_category),
      industry: tallyCombo(scoped, c => axisValues(c, 'industry')),
      productType: tallyOverlap(scoped, c => axisValues(c, 'product_type')),
      technologyType: tallyCombo(scoped, c => axisValues(c, 'technology_type')),
      diversity: tallyCombo(scoped, c => c.diversity_statuses || []),
      cached_at,
    })
  } catch (err) {
    console.error(err)
    res.status(err.status || 500).json({ error: err.message })
  }
})

// Internal pipeline/tagging-health metrics for the Portfolio Metrics page — not the same
// thing as portfolio-company performance (that's Andra's future addition to that page).
app.get('/api/stats/pipeline', async (req, res) => {
  try {
    const { companies, cached_at } = await getFreshCompanies(req.query.refresh === '1')
    const total = companies.length
    const DAY_MS = 24 * 60 * 60 * 1000
    const now = Date.now()

    const taggedBy = {}
    const scoreBands = { high: 0, needs_review: 0, insufficient: 0 }
    let scoreSum = 0
    let reviewedLast7Days = 0
    let reviewedLast30Days = 0
    let backlogOver30Days = 0
    let backlogOver60Days = 0
    let backlogOver90Days = 0

    for (const c of companies) {
      taggedBy[c.tagged_by] = (taggedBy[c.tagged_by] ?? 0) + 1
      const { score, band } = computeScore(c)
      scoreBands[band]++
      scoreSum += score

      if (c.tagged_by === 'Human' && c.updated_at) {
        const daysAgo = (now - new Date(c.updated_at).getTime()) / DAY_MS
        if (daysAgo <= 7) reviewedLast7Days++
        if (daysAgo <= 30) reviewedLast30Days++
      }
      if (c.tagged_by !== 'Human' && c.created_at) {
        const ageDays = (now - new Date(c.created_at).getTime()) / DAY_MS
        if (ageDays >= 30) backlogOver30Days++
        if (ageDays >= 60) backlogOver60Days++
        if (ageDays >= 90) backlogOver90Days++
      }
    }

    const aiTouched = (taggedBy['AI Agent'] ?? 0) + (taggedBy['Human'] ?? 0)

    res.json({
      total,
      taggedBy,
      scoreBands,
      avgScore: total ? Math.round((scoreSum / total) * 10) / 10 : 0,
      coverageRate: total ? Math.round((aiTouched / total) * 10000) / 10000 : 0,
      reviewedLast7Days,
      reviewedLast30Days,
      backlogOver30Days,
      backlogOver60Days,
      backlogOver90Days,
      cached_at,
    })
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
    // Served from the warm cache by default — fast, and avoids a live Notion round-trip
    // for every click. ?fresh=1 bypasses it entirely (used by the tagging-in-progress poll,
    // which needs to see live Notion state, not a snapshot that's up to an hour old).
    const wantsFresh = req.query.fresh === '1'
    if (!wantsFresh && companiesCache) {
      const cached = companiesCache.companies.find(c => c.id === req.params.id)
      if (cached) return res.json(cached)
    }
    const page = await notionFetch(`/pages/${req.params.id}`)
    const mapped = mapCompany(page)
    if (companiesCache) {
      const idx = companiesCache.companies.findIndex(c => c.id === mapped.id)
      if (idx !== -1) companiesCache.companies[idx] = mapped
      else companiesCache.companies.unshift(mapped)
    }
    res.json(mapped)
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
