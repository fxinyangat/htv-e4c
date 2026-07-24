// Data-completeness scoring, shared by the Companies/Review Queue list-shaping and the
// Portfolio Metrics pipeline stats.
export const FILLER_VALUES = {
  industry: ['NA', 'Out Of Scope'],
  construction_stage: ['FILL IN', 'Other'],
  product_type: ['Other'],
  technology_type: ['Other'],
  region: ['Unknown'],
}
export const SCORE_AXES = ['industry', 'construction_stage', 'product_type', 'technology_type', 'region']

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

export function computeScore(company) {
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
