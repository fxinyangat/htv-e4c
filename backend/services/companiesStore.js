import { randomUUID } from 'crypto'
import {
  fetchAllPages, NOTION_COMPANIES_DB_ID,
  readTitle, readText, readMultiSelect, readSelect, readUrl,
} from '../notion.js'
import { redis } from '../lib/redis.js'

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
export function mapCompany(page) {
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

// --- Redis-backed storage: the source of truth that survives across invocations. ---
// The full mapped list (~10k rows) is too big for one Redis value, so it's split into
// byte-bounded chunks rather than a fixed row count (descriptions/tags vary a lot in size).
const COMPANIES_META_KEY = 'htv:companies:meta'
const companyChunkKey = i => `htv:companies:chunk:${i}`
const CHUNK_BYTE_LIMIT = 800 * 1024 // safely under Upstash's ~1MB per-request payload ceiling

function chunkCompaniesByBytes(companies) {
  const chunks = []
  let current = []
  let currentBytes = 2 // account for the enclosing []
  for (const c of companies) {
    const size = Buffer.byteLength(JSON.stringify(c), 'utf8') + 1
    if (current.length > 0 && currentBytes + size > CHUNK_BYTE_LIMIT) {
      chunks.push(current)
      current = []
      currentBytes = 2
    }
    current.push(c)
    currentBytes += size
  }
  if (current.length) chunks.push(current)
  return chunks
}

async function writeCompaniesToRedis(companies, cached_at) {
  const chunks = chunkCompaniesByBytes(companies)
  const prevMeta = await redis.get(COMPANIES_META_KEY)
  await Promise.all(chunks.map((chunk, i) => redis.set(companyChunkKey(i), chunk)))
  // Clean up any leftover chunks from a previous write that had more chunks than this one.
  if (prevMeta?.chunkCount > chunks.length) {
    await Promise.all(
      Array.from({ length: prevMeta.chunkCount - chunks.length }, (_, k) => redis.del(companyChunkKey(chunks.length + k)))
    )
  }
  await redis.set(COMPANIES_META_KEY, { chunkCount: chunks.length, cached_at })
}

async function readCompaniesFromRedis() {
  const meta = await redis.get(COMPANIES_META_KEY)
  if (!meta || !meta.chunkCount) return null
  const chunks = await Promise.all(
    Array.from({ length: meta.chunkCount }, (_, i) => redis.get(companyChunkKey(i)))
  )
  if (chunks.some(c => c == null)) return null // partial/corrupted read — treat as a cache miss
  return { companies: chunks.flat(), cached_at: meta.cached_at }
}

// Distributed lock so two cold invocations landing on a stale cache at the same time don't
// both kick off a redundant ~60s Notion fetch. Scoped short (90s) so a crashed holder doesn't
// permanently wedge future refreshes.
const REFRESH_LOCK_KEY = 'htv:companies:refresh-lock'
const REFRESH_LOCK_TTL_S = 90

async function acquireRefreshLock() {
  const token = randomUUID()
  const ok = await redis.set(REFRESH_LOCK_KEY, token, { nx: true, ex: REFRESH_LOCK_TTL_S })
  return ok ? token : null
}
async function releaseRefreshLock(token) {
  // Only clear it if we still own it — guards against deleting a newer holder's lock in the
  // rare case ours already expired before we got here.
  const current = await redis.get(REFRESH_LOCK_KEY)
  if (current === token) await redis.del(REFRESH_LOCK_KEY)
}

// Serializes every read-modify-write against the cached company list (upsert/replace/remove all
// read the full list, change one entry, and rewrite the full list back to Redis). Without this,
// two of those happening concurrently on different invocations — e.g. our own POST /api/companies
// caching a fresh company, and moments later a Notion webhook firing because Dust's tagging
// automation just wrote to that same page — can race: each reads its own snapshot before the
// other's write has landed, and whichever writes back last silently discards the other's change.
// Unlike acquireRefreshLock (which skips the caller entirely on contention — fine, since a
// refresh is redundant if someone else is already doing one), a write must still happen, so this
// blocks with a short retry loop instead of failing fast.
const WRITE_LOCK_KEY = 'htv:companies:write-lock'
const WRITE_LOCK_TTL_S = 30 // bounded so a crashed holder can't wedge writes forever
const WRITE_LOCK_MAX_WAIT_MS = 10 * 1000
const WRITE_LOCK_RETRY_MS = 150

async function acquireWriteLock() {
  const token = randomUUID()
  const deadline = Date.now() + WRITE_LOCK_MAX_WAIT_MS
  while (Date.now() < deadline) {
    const ok = await redis.set(WRITE_LOCK_KEY, token, { nx: true, ex: WRITE_LOCK_TTL_S })
    if (ok) return token
    await new Promise(r => setTimeout(r, WRITE_LOCK_RETRY_MS))
  }
  return null
}
async function releaseWriteLock(token) {
  const current = await redis.get(WRITE_LOCK_KEY)
  if (current === token) await redis.del(WRITE_LOCK_KEY)
}

// Runs fn() holding the write lock. On the rare case the lock can't be acquired within the wait
// window (e.g. a holder is stuck), proceeds anyway rather than failing the caller's request —
// degraded safety for that one write beats hanging or erroring out entirely.
async function withCompaniesWriteLock(fn) {
  const token = await acquireWriteLock()
  if (!token) console.warn('Could not acquire companies write lock in time — proceeding unlocked')
  try {
    return await fn()
  } finally {
    if (token) await releaseWriteLock(token)
  }
}

// Full company list. In-memory copy is a same-process fast path (still useful within one warm
// invocation); Redis is the cross-invocation source of truth. A full Notion fetch takes ~60s
// at this row count, so both tiers exist to keep that off the user-facing request path.
const COMPANIES_TTL_MS = 60 * 60 * 1000 // 1 hour — a manual refresh button covers the "I need this now" case
// Floor between forced (?refresh=1) fetches, shared across every user/tab — stops someone
// mashing the Refresh button (or multiple people refreshing at once) from stacking up
// several ~60s Notion pulls at the same time.
const MIN_REFRESH_INTERVAL_MS = 60 * 1000
let companiesCache = null
let companiesCachedAt = 0
let companiesLoadPromise = null // in-flight fetch, shared so concurrent requests don't double-fetch

function isStale(cachedAt, wantsRefresh) {
  const age = Date.now() - cachedAt
  return age >= COMPANIES_TTL_MS || (wantsRefresh && age >= MIN_REFRESH_INTERVAL_MS)
}

function loadCompanies(fallback) {
  if (companiesLoadPromise) return companiesLoadPromise
  companiesLoadPromise = (async () => {
    const lockToken = await acquireRefreshLock()
    if (!lockToken) {
      // Another instance is already refreshing — serve what we have rather than double-fetch.
      const serve = fallback ?? companiesCache ?? { companies: [], cached_at: 0 }
      companiesCache = serve
      companiesCachedAt = serve.cached_at
      return serve
    }
    try {
      const pages = await fetchAllPages(NOTION_COMPANIES_DB_ID)
      const cached_at = Date.now()
      const companies = pages.map(mapCompany)
      const payload = { companies, cached_at }
      companiesCache = payload
      companiesCachedAt = cached_at
      await writeCompaniesToRedis(companies, cached_at)
      return payload
    } finally {
      await releaseRefreshLock(lockToken)
    }
  })()
  companiesLoadPromise.finally(() => { companiesLoadPromise = null })
  return companiesLoadPromise
}

// Shared by every route that needs the company list — returns the warm cache unless it's
// stale (TTL expired) or a caller explicitly asked to refresh (subject to its own cooldown).
// Checks memory, then Redis, before ever falling through to a live Notion fetch.
export async function getFreshCompanies(wantsRefresh) {
  if (companiesCache && !isStale(companiesCachedAt, wantsRefresh)) return companiesCache

  const fromRedis = await readCompaniesFromRedis()
  if (fromRedis && !isStale(fromRedis.cached_at, wantsRefresh)) {
    companiesCache = fromRedis
    companiesCachedAt = fromRedis.cached_at
    return fromRedis
  }

  return loadCompanies(fromRedis)
}

async function currentCacheOrEmpty() {
  if (companiesCache) return companiesCache
  return (await readCompaniesFromRedis()) ?? { companies: [], cached_at: 0 }
}

// Reads straight from the warm cache (memory, falling back to Redis) without triggering a
// Notion fetch — used for the single-company lookup's fast path, which falls back to a live
// Notion read on a genuine miss.
export async function getCachedCompany(id) {
  const base = await currentCacheOrEmpty()
  return base.companies.find(c => c.id === id) ?? null
}

// Inserts a newly-created company, or replaces an existing one in place (by id) — keeps both
// cache tiers consistent with a write instead of waiting on the next TTL refresh. Wrapped in the
// write lock so a concurrent upsert/replace/remove elsewhere can't race this one (see
// withCompaniesWriteLock's comment for why that matters).
export async function upsertCachedCompany(company) {
  return withCompaniesWriteLock(async () => {
    const base = await currentCacheOrEmpty()
    const idx = base.companies.findIndex(c => c.id === company.id)
    const companies = idx !== -1
      ? base.companies.map((c, i) => (i === idx ? company : c))
      : [company, ...base.companies]
    const payload = { companies, cached_at: base.cached_at }
    companiesCache = payload
    companiesCachedAt = payload.cached_at
    await writeCompaniesToRedis(companies, payload.cached_at)
  })
}

// Replaces an existing cache entry in place only — never inserts. Used after an edit, where
// a cache miss means the row fell out of the cache entirely and isn't worth re-adding out of
// update-order (the next TTL refresh will pick it back up naturally).
export async function replaceCachedCompany(company) {
  return withCompaniesWriteLock(async () => {
    const base = await currentCacheOrEmpty()
    const idx = base.companies.findIndex(c => c.id === company.id)
    if (idx === -1) return
    const companies = base.companies.map((c, i) => (i === idx ? company : c))
    const payload = { companies, cached_at: base.cached_at }
    companiesCache = payload
    companiesCachedAt = payload.cached_at
    await writeCompaniesToRedis(companies, payload.cached_at)
  })
}

export async function removeCachedCompany(id) {
  return withCompaniesWriteLock(async () => {
    const base = await currentCacheOrEmpty()
    if (!base.companies.some(c => c.id === id)) return
    const companies = base.companies.filter(c => c.id !== id)
    const payload = { companies, cached_at: base.cached_at }
    companiesCache = payload
    companiesCachedAt = payload.cached_at
    await writeCompaniesToRedis(companies, payload.cached_at)
  })
}

// Local dev only (see server.js's !process.env.VERCEL guard) — warms the companies cache
// immediately, then keeps refreshing it before the TTL expires so the ~60s Notion fetch never
// happens on a user-facing request. Not meaningful on Vercel: a background timer isn't
// guaranteed to keep running between invocations, which is exactly why Redis is now the
// cross-invocation source of truth instead.
export function warmCompaniesCache() {
  loadCompanies().catch(err => console.error('Failed to warm companies cache:', err.message))
  setInterval(() => {
    loadCompanies().catch(err => console.error('Failed to refresh companies cache:', err.message))
  }, COMPANIES_TTL_MS)
}
