import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const NOTION_API_KEY = process.env.NOTION_API_KEY
export const NOTION_COMPANIES_DB_ID = process.env.NOTION_DATABASE_ID
const NOTION_VERSION = '2022-06-28'

if (!NOTION_API_KEY) {
  console.warn('WARNING: NOTION_API_KEY is not set')
}
if (!NOTION_COMPANIES_DB_ID) {
  console.warn('WARNING: NOTION_DATABASE_ID is not set')
}

export async function notionFetch(pathSuffix, options = {}) {
  const res = await fetch(`https://api.notion.com/v1${pathSuffix}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.message || 'Notion API error')
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

// --- property readers ---
export function readTitle(prop) {
  return prop?.title?.map(t => t.plain_text).join('') || ''
}
export function readText(prop) {
  return prop?.rich_text?.map(t => t.plain_text).join('') || ''
}
export function readMultiSelect(prop) {
  return prop?.multi_select?.map(o => o.name) || []
}
export function readSelect(prop) {
  return prop?.select?.name || null
}
export function readUrl(prop) {
  return prop?.url || null
}

// Read the configured dropdown options off a select/multi_select property definition
// (as returned by GET /databases/:id), not off a page's property value.
export function readOptions(propDef) {
  if (!propDef) return []
  const type = propDef.type
  return (propDef[type]?.options || []).map(o => o.name)
}

// --- property writers, for PATCH /pages/:id ---
export function toMultiSelect(values) {
  return { multi_select: (values || []).map(name => ({ name })) }
}
export function toSelect(value) {
  return { select: value ? { name: value } : null }
}
export function toTitle(value) {
  return { title: value ? [{ text: { content: value } }] : [] }
}
export function toRichText(value) {
  return { rich_text: value ? [{ text: { content: value } }] : [] }
}
export function toUrl(value) {
  return { url: value || null }
}

// Pages through a database query 100 rows at a time until Notion reports no more pages left.
export async function fetchAllPages(databaseId) {
  const results = []
  let cursor
  do {
    const data = await notionFetch(`/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
      }),
    })
    results.push(...data.results)
    cursor = data.has_more ? data.next_cursor : null
  } while (cursor)
  return results
}
