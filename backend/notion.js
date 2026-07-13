import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const NOTION_API_KEY = process.env.NOTION_API_KEY
export const NOTION_COMPANIES_DB_ID = '34429b38-2ad2-81c8-af21-cb2e927c1ded'
const NOTION_VERSION = '2022-06-28'

if (!NOTION_API_KEY) {
  console.warn('WARNING: NOTION_API_KEY is not set in .env.local')
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

export async function fetchAllPages(databaseId, pageCap = 1000) {
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
  } while (cursor && results.length < pageCap)
  return results
}
