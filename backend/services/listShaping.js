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

// Splits on commas or the word "and" — deliberately NOT on bare whitespace. Company names are
// frequently multi-word ("Flume AI", "Buildcrew AI"), so splitting on every space breaks those
// apart into single-word fragments; a lone "ai" fragment then substring-matches thousands of
// unrelated companies (anything containing "ai" — "domain", "maintain", "against"...), which
// looks like search returning the whole list unfiltered. Only an explicit separator the user
// actually typed ("Anori, NYXIUM" or "Anori and NYXIUM") indicates "these are separate terms" —
// anything else is treated as one literal phrase, same as before this feature existed.
function searchTerms(search) {
  return String(search)
    .toLowerCase()
    .split(/,|\band\b/)
    .map(t => t.trim())
    .filter(Boolean)
}

// Below this length, a company's own name is too short to safely use for the "does this name
// appear inside what the user typed" fallback below — a 1-2 char name would match almost
// anything, reintroducing the same over-matching problem term-splitting caused.
const MIN_NAME_FALLBACK_LENGTH = 3

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Whole-word(s) boundary check, not a raw substring check — a raw .includes() would let a short
// name like "Super" false-match because it's a *prefix* of an unrelated word in the search text
// ("SupervAIsor"), even though "super" never actually appears as its own word there. \b anchors
// require an actual word boundary on both sides, so a multi-word name still matches correctly as
// one combined phrase, just not as a fragment glued onto a longer unrelated word.
function nameAppearsAsWholeWordIn(name, rawSearchLower) {
  return new RegExp(`\\b${escapeRegExp(name)}\\b`).test(rawSearchLower)
}

// Classifies how (if at all) an item matches a search — 'name', 'other' (description/
// external_id only), or null (no match). Shared by applySearch and searchRelevanceCompare so
// the two can't drift out of sync on what counts as a match or a name-match.
//
// Two matching directions, both needed:
// 1. Forward — a search term appears inside the item's own fields. Handles normal partial
//    search ("flume" finds "Flume AI") and explicit multi-term search ("Anori, NYXIUM").
// 2. Reverse (name only) — the item's *entire* name appears, as whole word(s), inside the raw
//    search text. Handles space-separated multi-name search with no explicit delimiter ("Wyre AI
//    SpeciPlan Flume AI") — splitting that on whitespace would fragment multi-word names into
//    pieces like a lone "ai" that over-matches everything; checking whether each candidate's
//    *whole* name is present as its own word(s) instead doesn't have that failure mode.
function classifyMatch(item, terms, rawSearchLower) {
  const name = item.name.toLowerCase()
  const description = item.description.toLowerCase()
  const externalId = item.external_id.toLowerCase()

  if (terms.some(term => name.includes(term))) return 'name'
  if (name.length >= MIN_NAME_FALLBACK_LENGTH && nameAppearsAsWholeWordIn(name, rawSearchLower)) return 'name'
  if (terms.some(term => description.includes(term) || externalId.includes(term))) return 'other'
  return null
}

export function applySearch(items, search) {
  if (!search) return items
  const rawSearchLower = String(search).toLowerCase().trim()
  const terms = searchTerms(search)
  if (terms.length === 0 && !rawSearchLower) return items
  return items.filter(i => classifyMatch(i, terms, rawSearchLower) !== null)
}

// A comparator ranking name matches ahead of description/external_id-only matches, for use as
// the *primary* sort key when a search is active — the caller's selected sort (score, recency,
// etc.) still applies as the tiebreaker within each relevance group. Returns null when there's
// no active search, so callers can no-op cleanly rather than branching themselves.
export function searchRelevanceCompare(search) {
  if (!search) return null
  const rawSearchLower = String(search).toLowerCase().trim()
  const terms = searchTerms(search)
  if (terms.length === 0 && !rawSearchLower) return null
  const rank = item => classifyMatch(item, terms, rawSearchLower) === 'name' ? 1 : 0
  return (a, b) => rank(b) - rank(a)
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
