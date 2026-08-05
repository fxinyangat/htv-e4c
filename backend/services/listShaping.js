import { computeScore } from './scoring.js'

// --- list-shaping, ported from the frontend's api.ts (kept in sync manually) — so the
// Companies/Review Queue lists can be searched, filtered, sorted, and paginated here instead
// of shipping the full ~10k-row list to every browser tab on every page load.

export function toListItem(c) {
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

export function toQueueItem(c) {
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

// Splits on commas, the word "and", or whitespace — so a single search box can look up several
// companies at once ("Anori, NYXIUM" or "Anori and NYXIUM") instead of only ever matching the
// input as one literal phrase, which no company's name/description would ever contain whole.
function searchTerms(search) {
  return String(search)
    .toLowerCase()
    .split(/,|\band\b|\s+/)
    .map(t => t.trim())
    .filter(Boolean)
}

function matchesAnyTerm(fields, terms) {
  return terms.some(term => fields.some(field => field.includes(term)))
}

export function applySearch(items, search) {
  if (!search) return items
  const terms = searchTerms(search)
  if (terms.length === 0) return items
  return items.filter(i => matchesAnyTerm(
    [i.name.toLowerCase(), i.description.toLowerCase(), i.external_id.toLowerCase()], terms
  ))
}

// A comparator ranking name matches ahead of description/external_id-only matches, for use as
// the *primary* sort key when a search is active — the caller's selected sort (score, recency,
// etc.) still applies as the tiebreaker within each relevance group. Returns null when there's
// no active search, so callers can no-op cleanly rather than branching themselves.
export function searchRelevanceCompare(search) {
  if (!search) return null
  const terms = searchTerms(search)
  if (terms.length === 0) return null
  const nameMatches = item => terms.some(term => item.name.toLowerCase().includes(term))
  return (a, b) => Number(nameMatches(b)) - Number(nameMatches(a))
}

export function parseFilters(raw) {
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function paginate(items, page, pageSize) {
  const size = Number(pageSize) || 20
  const p = Number(page) || 1
  const start = (p - 1) * size
  return items.slice(start, start + size)
}
