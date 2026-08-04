import {
  notionFetch, fetchAllPages, NOTION_USERS_DB_ID,
  readTitle, readText, readEmail, readSelect,
  toTitle, toEmail, toRichText, toSelect,
} from '../notion.js'

export function mapUser(page) {
  const p = page.properties
  return {
    id: page.id,
    name: readTitle(p['Name']),
    email: readEmail(p['Email']),
    sub: readText(p['Google sub']),
    picture: readText(p['Profile URL']) || null,
    status: readSelect(p['Status']) || 'Pending',
    role: readSelect(p['Role']) || null,
  }
}

// The Users table is tiny (a handful to a few dozen rows for an internal team) compared to the
// ~10k-row Companies table, so a much shorter TTL is affordable — correctness of access
// decisions (a rejection or role change taking effect promptly) matters more here than shaving
// off Notion round-trips the way the Companies cache needs to.
const USERS_TTL_MS = 30 * 1000
let usersCache = null
let usersCachedAt = 0
let usersLoadPromise = null

function loadUsers() {
  if (usersLoadPromise) return usersLoadPromise
  usersLoadPromise = (async () => {
    const pages = await fetchAllPages(NOTION_USERS_DB_ID)
    usersCache = pages.map(mapUser)
    usersCachedAt = Date.now()
    return usersCache
  })()
  usersLoadPromise.finally(() => { usersLoadPromise = null })
  return usersLoadPromise
}

async function getFreshUsers() {
  const age = usersCache ? Date.now() - usersCachedAt : Infinity
  if (usersCache && age < USERS_TTL_MS) return usersCache
  return loadUsers()
}

// Looked up by Google's `sub` claim — the stable per-account identifier — not email, which can
// change or be reassigned.
export async function getUserBySub(sub) {
  const users = await getFreshUsers()
  return users.find(u => u.sub === sub) ?? null
}

// A first-time Google sign-in with no matching Users row yet — created as Pending/no-role,
// awaiting a human admin to flip Status (and set Role) directly in Notion.
export async function createPendingUser({ sub, name, email, picture }) {
  const createdPage = await notionFetch('/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: { database_id: NOTION_USERS_DB_ID },
      properties: {
        'Name': toTitle(name || email),
        'Email': toEmail(email),
        'Google sub': toRichText(sub),
        'Profile URL': toRichText(picture),
        'Status': toSelect('Pending'),
      },
    }),
  })
  const user = mapUser(createdPage)
  if (usersCache) usersCache = [user, ...usersCache]
  return user
}

// Called by the Notion webhook handler when a Users-database page changes — keeps a Role/Status
// edit made directly in Notion from waiting out the 30s cache TTL before it takes effect.
export function upsertCachedUser(user) {
  if (!usersCache) return
  const idx = usersCache.findIndex(u => u.id === user.id)
  if (idx !== -1) usersCache[idx] = user
  else usersCache = [user, ...usersCache]
}
