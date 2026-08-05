import { notionFetch, NOTION_COMPANIES_DB_ID, toMultiSelect, toSelect, toTitle, toRichText, toUrl } from '../notion.js'
import { sendData, sendError } from '../lib/response.js'
import {
  mapCompany, getFreshCompanies, getCachedCompany, upsertCachedCompany, replaceCachedCompany, removeCachedCompany,
} from '../services/companiesStore.js'
import { toListItem, toQueueItem, applySearch, searchRelevanceCompare, parseFilters, paginate } from '../services/listShaping.js'

export async function getAllCompanies(req, res) {
  try {
    sendData(res, await getFreshCompanies(req.query.refresh === '1'))
  } catch (err) {
    sendError(res, err)
  }
}

// Companies page list — search/status/filter/sort/paginate happens here, server-side,
// against the already-warm cache, so the browser only ever receives the current page.
export async function listCompanies(req, res) {
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
    const sortCompare =
      sort === 'name_asc' ? (a, b) => a.name.localeCompare(b.name)
      : sort === 'name_desc' ? (a, b) => b.name.localeCompare(a.name)
      : sort === 'confidence_asc' ? (a, b) => (a.min_confidence ?? 1) - (b.min_confidence ?? 1)
      : sort === 'tags_desc' ? (a, b) => b.tag_count - a.tag_count
      : sort === 'tags_asc' ? (a, b) => a.tag_count - b.tag_count
      : (a, b) => b.updated_at.localeCompare(a.updated_at)
    // When a search is active, name matches rank ahead of description/external_id-only matches
    // — the selected sort still decides ordering within each relevance group.
    const relevanceCompare = searchRelevanceCompare(req.query.search)
    items.sort(relevanceCompare ? (a, b) => relevanceCompare(a, b) || sortCompare(a, b) : sortCompare)

    sendData(res, { total: items.length, items: paginate(items, req.query.page, req.query.pageSize), cached_at })
  } catch (err) {
    sendError(res, err)
  }
}

// Review Queue list — same idea as above, shaped/scored for the queue view instead.
export async function queueCompanies(req, res) {
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
    const sortCompare =
      sort === 'name_asc' ? (a, b) => a.name.localeCompare(b.name)
      : sort === 'name_desc' ? (a, b) => b.name.localeCompare(a.name)
      : sort === 'score_asc' ? (a, b) => a.score - b.score
      : sort === 'score_desc' ? (a, b) => b.score - a.score
      : (a, b) => b.updated_at.localeCompare(a.updated_at)
    const relevanceCompare = searchRelevanceCompare(req.query.search)
    items.sort(relevanceCompare ? (a, b) => relevanceCompare(a, b) || sortCompare(a, b) : sortCompare)

    sendData(res, { total: items.length, items: paginate(items, req.query.page, req.query.pageSize), cached_at })
  } catch (err) {
    sendError(res, err)
  }
}

// Add Company: creates a new page in the real Notion Companies database. Tagged By is left
// unset (mapCompany defaults that to 'NA'/untagged), matching a fresh row the Dust agent
// hasn't picked up yet.
export async function createCompany(req, res) {
  try {
    const { name, domain, description, origin_source, origin_category } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ status: 'error', message: 'Company name is required', data: null })
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
    await upsertCachedCompany(mapped)
    sendData(res, mapped, 'Company created', 201)
  } catch (err) {
    sendError(res, err)
  }
}

export async function getCompanyById(req, res) {
  try {
    // Served from the warm cache by default — fast, and avoids a live Notion round-trip
    // for every click. ?fresh=1 bypasses it entirely (used by the tagging-in-progress poll,
    // which needs to see live Notion state, not a snapshot that's up to an hour old).
    const wantsFresh = req.query.fresh === '1'
    if (!wantsFresh) {
      const cached = await getCachedCompany(req.params.id)
      if (cached) return sendData(res, cached)
    }
    const page = await notionFetch(`/pages/${req.params.id}`)
    const mapped = mapCompany(page)
    await upsertCachedCompany(mapped)
    sendData(res, mapped)
  } catch (err) {
    sendError(res, err)
  }
}

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
export async function updateCompany(req, res) {
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
    await replaceCachedCompany(mapped)
    sendData(res, mapped, 'Company updated')
  } catch (err) {
    sendError(res, err)
  }
}

// "Delete" = Notion archive, the same soft-delete Notion's own UI trash uses. Reversible from
// within Notion (not from this app) — never a hard, unrecoverable destroy.
export async function deleteCompany(req, res) {
  try {
    await notionFetch(`/pages/${req.params.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ archived: true }),
    })
    await removeCachedCompany(req.params.id)
    sendData(res, null, 'Company deleted')
  } catch (err) {
    sendError(res, err)
  }
}
