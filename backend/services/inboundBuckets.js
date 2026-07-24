// Bucketing helpers for the Inbound Stats page's quarterly deal-flow breakdown.

// Exact-combination bucketing (mutually exclusive) — a company tagged both SaaS and Hardware
// falls only into "SaaS + Hardware", never double-counted under standalone SaaS too.
export function tallyCombo(companies, getValues) {
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
export function tallyOverlap(companies, getValues) {
  const counts = new Map()
  for (const c of companies) {
    for (const v of getValues(c)) {
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}

export function tallySingle(companies, getValue) {
  const counts = new Map()
  for (const c of companies) {
    const v = getValue(c)
    if (!v) continue
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}

export const CONSTRUCTION_STAGES = ['Conception', 'Design&Engineering', 'Pre-Construction', 'Construction Execution', 'Post-Construction']
