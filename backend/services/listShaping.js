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
    priority: c.priority, updated_at: c.updated_at, created_at: c.created_at,
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

const EXPLICIT_SEPARATOR = /,|\band\b/

// Comma/"and" are explicit separators the user deliberately typed — when present, split ONLY on
// those, so each resulting segment stays intact as one phrase ("Flume AI" stays "flume ai", not
// fragmented into "flume" + "ai"; regex alternation would otherwise split on *any* alternative
// it matches, so naively adding whitespace to the same pattern would tear multi-word names apart
// even inside an explicitly comma-separated list). Only fall back to also splitting on
// whitespace when there's no explicit separator at all — that's the only way to look up several
// loose keywords ("BIM flume Africa") without an explicit delimiter, accepting that this looser
// mode can cast a wider net if a term happens to be a common word (see appearsAsWholeWordIn).
function searchTerms(search) {
  const lower = String(search).toLowerCase()
  const pattern = EXPLICIT_SEPARATOR.test(lower)
    ? EXPLICIT_SEPARATOR
    : /,|\band\b|\s+/
  return lower.split(pattern).map(t => t.trim()).filter(Boolean)
}

// Below this length, a company's own name is too short to safely use for the "does this name
// appear inside what the user typed" fallback below — a 1-2 char name would match almost
// anything, reintroducing the same over-matching problem term-splitting caused.
const MIN_NAME_FALLBACK_LENGTH = 3

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Whole-word(s) boundary check, not a raw substring check — a raw .includes("ai") would match
// "ai" *embedded* inside unrelated words ("domain", "maintain", "against"), which is what made
// splitting on whitespace unsafe in the first place. \b anchors require an actual word boundary
// on both sides, so short/common terms only match when they genuinely appear as their own word
// (or, for a multi-word company name, as that whole phrase) — not as a fragment glued onto a
// longer unrelated word.
function appearsAsWholeWordIn(term, text) {
  return new RegExp(`\\b${escapeRegExp(term)}\\b`).test(text)
}

// Graduated relevance score (0 = no match) — replaces a binary name/other flag, which tied
// every name-containing result together and left the caller's selected sort (e.g. "Recently
// Modified") to arbitrarily decide the order, so an exact match could end up buried below loosely
// related ones. Cheap to compute — only ever runs over the already-filtered match set (never all
// ~10k rows), and each call is a handful of string ops over a short name, not a real search index.
//
// Name matching stays raw-substring (not word-boundary) — names are short, so the false-positive
// risk is low, and it preserves useful partial-prefix search ("flu" finding "Flume"). Description/
// external_id matching uses the word-boundary check — those fields are much longer, so a raw
// substring check on a short/common term (like "ai") would match constantly (see
// appearsAsWholeWordIn's comment). Tiers, highest first:
//   1000  exact full-name match
//    900  name starts with the full typed phrase
//  800+   name contains the full typed phrase as one substring, weighted by how much of the
//         name that phrase covers (less leftover text = more relevant)
//  500+   partial term coverage — scored by *two* ratios: how many search terms were found in
//         the name, and how many of the name's own words were accounted for by those terms, so
//         "Foundation Industries" (both words) outranks "Grab A Byte Industries, LLC" (one of
//         five words) for the same query
//    400  reverse fallback — the whole name appears inside the raw search text (weaker signal
//         than the name actually containing the query)
//  150-200 description/external_id-only matches — always below any name-level signal
function relevanceScore(item, terms, rawSearchLower) {
  const name = item.name.toLowerCase()
  const description = item.description.toLowerCase()
  const externalId = item.external_id.toLowerCase()

  if (rawSearchLower && name === rawSearchLower) return 1000
  if (rawSearchLower && name.startsWith(rawSearchLower)) return 900

  const nameWords = name.split(/\s+/).filter(Boolean)
  const wordRelates = (word, term) => word.includes(term) || term.includes(word)
  const matchedNameWords = nameWords.filter(w => terms.some(t => wordRelates(w, t)))
  const nameCoverage = nameWords.length ? matchedNameWords.length / nameWords.length : 0
  const termCoverage = terms.length ? terms.filter(t => name.includes(t)).length / terms.length : 0

  if (rawSearchLower && name.includes(rawSearchLower)) return 800 + nameCoverage * 50
  if (termCoverage > 0) return 500 + termCoverage * 100 + nameCoverage * 100
  if (name.length >= MIN_NAME_FALLBACK_LENGTH && appearsAsWholeWordIn(name, rawSearchLower)) return 400
  if (terms.some(t => appearsAsWholeWordIn(t, description))) return 200
  if (terms.some(t => appearsAsWholeWordIn(t, externalId))) return 150
  return 0
}

export function applySearch(items, search) {
  if (!search) return items
  const rawSearchLower = String(search).toLowerCase().trim()
  const terms = searchTerms(search)
  if (terms.length === 0 && !rawSearchLower) return items
  return items.filter(i => relevanceScore(i, terms, rawSearchLower) > 0)
}

// A comparator ranking by relevance score, for use as the *primary* sort key when a search is
// active — the caller's selected sort (score, recency, etc.) still applies as the tiebreaker
// among equally-relevant results. Returns null when there's no active search, so callers can
// no-op cleanly rather than branching themselves.
export function searchRelevanceCompare(search) {
  if (!search) return null
  const rawSearchLower = String(search).toLowerCase().trim()
  const terms = searchTerms(search)
  if (terms.length === 0 && !rawSearchLower) return null
  return (a, b) => relevanceScore(b, terms, rawSearchLower) - relevanceScore(a, terms, rawSearchLower)
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
  const size = Number(pageSize) || 10
  const p = Number(page) || 1
  const start = (p - 1) * size
  return items.slice(start, start + size)
}
