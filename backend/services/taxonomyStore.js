import { notionFetch, NOTION_COMPANIES_DB_ID, readOptions } from '../notion.js'

// Live dropdown options straight off the Notion schema, cached in-memory so we don't hit
// Notion on every request — schema changes are rare, unlike row data.
const TAXONOMY_TTL_MS = 60 * 60 * 1000 // 1 hour
let taxonomyCache = null
let taxonomyCachedAt = 0

export async function getTaxonomy(wantsRefresh) {
  if (!wantsRefresh && taxonomyCache && Date.now() - taxonomyCachedAt < TAXONOMY_TTL_MS) {
    return taxonomyCache
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
  return taxonomy
}
