import { sendData, sendError } from '../lib/response.js'
import { getFreshCompanies } from '../services/companiesStore.js'
import { computeScore } from '../services/scoring.js'
import { tallyCombo, tallyOverlap, tallySingle, CONSTRUCTION_STAGES } from '../services/inboundBuckets.js'

// Quarterly deal-flow breakdown for the (external) Inbound Stats page. `ranges` is a JSON array
// of { from, to } date strings (one per selected quarter) — companies are scoped to the union of
// those ranges by created_at, then every axis is bucketed dynamically from whatever combinations
// actually occur, rather than a hardcoded predefined taxonomy of buckets.
export async function inboundStats(req, res) {
  try {
    let ranges = []
    try {
      ranges = JSON.parse(req.query.ranges || '[]')
    } catch {
      ranges = []
    }

    const { companies, cached_at } = await getFreshCompanies(req.query.refresh === '1')
    // r.from/r.to are bare "YYYY-MM-DD" quarter boundaries; created_at is now a full ISO
    // timestamp, so this compares actual instants rather than lexicographically comparing
    // strings of different lengths (which broke the moment created_at stopped being date-only).
    const inRange = (createdAt, r) => {
      const t = new Date(createdAt).getTime()
      return t >= new Date(`${r.from}T00:00:00.000Z`).getTime() && t <= new Date(`${r.to}T23:59:59.999Z`).getTime()
    }
    const scoped = ranges.length
      ? companies.filter(c => c.created_at && ranges.some(r => inRange(c.created_at, r)))
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

    sendData(res, {
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
    sendError(res, err)
  }
}

// Internal pipeline/tagging-health metrics for the Portfolio Metrics page — not the same
// thing as portfolio-company performance (that's Andra's future addition to that page).
export async function pipelineStats(req, res) {
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

    sendData(res, {
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
    sendError(res, err)
  }
}
