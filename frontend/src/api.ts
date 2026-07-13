// Mock data layer — no backend yet. Same shapes/signatures the UI expects,
// backed by an in-memory store instead of network calls.

export interface Tag {
  id: string
  axis: string
  value: string
  source: string
  confidence: number
  is_accepted: boolean | null
  reasoning: string | null
}

export type Priority = 'high' | 'review' | 'low'
export type KnockoutStatus = 'Pass' | 'Fail' | null
export type ActivityType = 'created' | 'tagged' | 'reviewed' | 'edited'

export interface ActivityEntry {
  id: string
  type: ActivityType
  label: string
  date: string
}

export interface Note {
  id: string
  author: string
  text: string
  date: string
  reminder_date: string | null
}

export interface TaggingCommentLine {
  label: string
  note: string
}

export interface Company {
  id: string
  external_id: string
  name: string
  description: string
  priority: Priority
  updated_at: string
  domain: string
  location: string
  region: string
  diversity_status: string | null
  linkedin_url: string | null
  origin_source: string
  origin_category: string | null
  allie_knockout: KnockoutStatus
  andra_knockout: KnockoutStatus
  tags: Tag[]
  activity: ActivityEntry[]
  notes: Note[]
  tagging_comment: TaggingCommentLine[]
  tagging_action: string | null
}

export interface Metrics {
  total_ai_tags: number
  override_rate: number
  pending_review: number
  confidence_by_source: { source: string; avg: number; min: number; max: number }[]
}

export interface CompanyListItem {
  id: string
  external_id: string
  name: string
  description: string
  priority: Priority
  updated_at: string
  min_confidence: number | null
  has_pending: boolean | null
  tag_count: number
  region: string
  construction_stage: string | null
  technology_type: string | null
  product_type: string | null
  industry: string | null
  tag_source: string | null
  construction_stage_source: string | null
  technology_type_source: string | null
  product_type_source: string | null
  industry_source: string | null
}

export type QueueBadge = 'review' | 'low' | 'untagged'

export interface QueueListItem {
  id: string
  external_id: string
  name: string
  description: string
  updated_at: string
  badge: QueueBadge
  issue: string
  stale: boolean
  industry: string[]
  construction_stage: string[]
  product_type: string[]
  technology_type: string[]
  region: string
  tag_count: number
  has_pending: boolean
}

export const TAXONOMY: Record<string, string[]> = {
  industry: ['Commercial', 'Heavy Infrastructure', 'Industrial', 'Residential', 'Urban Planning'],
  construction_stage: ['Design & Planning', 'Facility Management', 'On-site Construction', 'Post-construction', 'Pre-construction', 'Sustainability/Demolition'],
  product_type: ['Building Materials', 'Hardware Device', 'Marketplace', 'Mobile App', 'Professional Services', 'Software Platform'],
  technology_type: ['3D Printing', 'Advanced Materials', 'Artificial Intelligence', 'Augmented Reality', 'Cloud Computing/SaaS', 'Digital Twin', 'Internet of Things (IoT)', 'Robotics & Automation'],
}

export const AXIS_LABELS: Record<string, string> = {
  industry: 'Industry',
  construction_stage: 'Construction Stage',
  product_type: 'Product Type',
  technology_type: 'Technology Type',
}

export const REGIONS = ['West US', 'East US', 'South US', 'Midwest US', 'Mountain US', 'Not specified']
export const ORIGIN_CATEGORIES = ['Inbound', 'Outbound', 'Referral', 'Conference', 'Other']

const AXES = ['construction_stage', 'technology_type', 'product_type', 'industry']

let nextTagId = 1
function makeTag(axis: string, value: string, source: string, confidence: number, is_accepted: boolean | null, reasoning: string | null = null): Tag {
  return { id: String(nextTagId++), axis, value, source, confidence, is_accepted, reasoning }
}

let nextActivityId = 1
function makeActivity(type: ActivityType, label: string, date: string): ActivityEntry {
  return { id: String(nextActivityId++), type, label, date }
}

let nextNoteId = 1
function makeNote(author: string, text: string, date: string, reminder_date: string | null = null): Note {
  return { id: String(nextNoteId++), author, text, date, reminder_date }
}

function logActivity(company: Company, type: ActivityType, label: string) {
  company.activity.push(makeActivity(type, label, new Date().toISOString().slice(0, 10)))
}

let nextCompanyNum = 7
const store: Company[] = [
  {
    id: '1',
    external_id: 'HV-0001',
    name: 'Groforma',
    description: 'Collaborative construction management platform connecting field and office teams in real time.',
    priority: 'high',
    updated_at: '2025-06-12',
    domain: 'groforma.com',
    location: 'San Francisco, CA',
    region: 'West US',
    diversity_status: null,
    linkedin_url: 'https://linkedin.com/company/groforma',
    origin_source: 'LinkedIn',
    origin_category: 'Inbound',
    allie_knockout: null,
    andra_knockout: null,
    tags: [
      makeTag('industry', 'Commercial', 'human', 1, true),
      makeTag('construction_stage', 'On-site Construction', 'human', 1, true),
      makeTag('product_type', 'Software Platform', 'human', 1, true),
      makeTag('technology_type', 'Cloud Computing/SaaS', 'human', 1, true),
    ],
    activity: [
      makeActivity('created', 'Added to database via Inbound Pipeline', '2025-06-01'),
      makeActivity('tagged', 'AI auto-tagged via LLM', '2025-06-01'),
      makeActivity('reviewed', 'Tags approved — marked human-reviewed', '2025-06-12'),
    ],
    notes: [
      makeNote('Alexandria Lafci', 'Strong team, second-time founders. Worth a follow-up call.', '2025-06-11'),
    ],
    tagging_comment: [],
    tagging_action: null,
  },
  {
    id: '2',
    external_id: 'HV-0002',
    name: 'Tara Home',
    description: 'AI-powered home management platform using IoT sensors to automate post-construction maintenance.',
    priority: 'review',
    updated_at: '2025-06-10',
    domain: 'tarahome.io',
    location: 'Austin, TX',
    region: 'South US',
    diversity_status: 'Not specified',
    linkedin_url: 'https://linkedin.com/company/tarahome',
    origin_source: 'Partner referral',
    origin_category: 'Referral',
    allie_knockout: null,
    andra_knockout: null,
    tags: [
      makeTag('industry', 'Residential', 'llm', 0.79, null, 'Targets homeowners rather than commercial property managers.'),
      makeTag('construction_stage', 'Post-construction', 'llm', 0.88, null),
      makeTag('product_type', 'Hardware Device', 'llm', 0.71, null),
      makeTag('technology_type', 'Internet of Things (IoT)', 'llm', 0.9, null),
    ],
    activity: [
      makeActivity('created', 'Added to database via Referral', '2025-06-08'),
      makeActivity('tagged', 'AI auto-tagged via LLM', '2025-06-10'),
    ],
    notes: [],
    tagging_comment: [
      { label: 'Product Type', note: 'unclear between hardware platform and IoT device' },
      { label: 'Region', note: 'location field empty' },
    ],
    tagging_action: 'Check product page to confirm delivery model and verify US region from LinkedIn',
  },
  {
    id: '3',
    external_id: 'HV-0003',
    name: 'Feesback',
    description: 'Financial services platform streamlining fee management and invoicing for property transactions.',
    priority: 'review',
    updated_at: '2025-06-09',
    domain: 'feesback.com',
    location: 'New York, NY',
    region: 'East US',
    diversity_status: null,
    linkedin_url: null,
    origin_source: 'ConTech Summit 2025',
    origin_category: 'Conference',
    allie_knockout: 'Pass',
    andra_knockout: null,
    tags: [
      makeTag('industry', 'Commercial', 'llm', 0.65, null, 'Serves property transactions broadly, mostly commercial deals.'),
      makeTag('product_type', 'Software Platform', 'llm', 0.85, null),
      makeTag('technology_type', 'Cloud Computing/SaaS', 'llm', 0.8, null),
    ],
    activity: [
      makeActivity('created', 'Added to database via Conference', '2025-06-05'),
      makeActivity('tagged', 'AI auto-tagged via LLM', '2025-06-09'),
    ],
    notes: [
      makeNote('Tomas Garcia', 'Met founder at ConTech Summit — following up next week.', '2025-06-09', '2025-06-16'),
    ],
    tagging_comment: [
      { label: 'Industry', note: 'unclear between Commercial and Residential based on transaction description' },
    ],
    tagging_action: 'Confirm target industry segment directly with the founder — property transactions could serve either commercial or residential clients.',
  },
  {
    id: '4',
    external_id: 'HV-0004',
    name: 'BuildSafe AI',
    description: 'AI-driven jobsite safety monitoring combining computer vision and wearable IoT devices.',
    priority: 'high',
    updated_at: '2025-06-07',
    domain: 'buildsafe.ai',
    location: 'Chicago, IL',
    region: 'Midwest US',
    diversity_status: 'Woman-owned',
    linkedin_url: 'https://linkedin.com/company/buildsafeai',
    origin_source: 'LinkedIn',
    origin_category: 'Inbound',
    allie_knockout: 'Pass',
    andra_knockout: 'Pass',
    tags: [
      makeTag('industry', 'Industrial', 'human', 1, true),
      makeTag('construction_stage', 'On-site Construction', 'human', 1, true),
      makeTag('product_type', 'Software Platform', 'human', 1, true),
      makeTag('technology_type', 'Artificial Intelligence', 'human', 1, true),
    ],
    activity: [
      makeActivity('created', 'Added to database via Inbound Pipeline', '2025-06-01'),
      makeActivity('tagged', 'AI auto-tagged via LLM', '2025-06-02'),
      makeActivity('reviewed', 'Tags approved — marked human-reviewed', '2025-06-07'),
    ],
    notes: [],
    tagging_comment: [],
    tagging_action: null,
  },
  {
    id: '5',
    external_id: 'HV-0005',
    name: 'Test007',
    description: 'Demolition and end-of-life services provider; flagged as out of scope for current portfolio thesis.',
    priority: 'low',
    updated_at: '2025-06-05',
    domain: 'test007.com',
    location: 'Denver, CO',
    region: 'Mountain US',
    diversity_status: null,
    linkedin_url: null,
    origin_source: 'Cold email',
    origin_category: 'Outbound',
    allie_knockout: 'Fail',
    andra_knockout: null,
    tags: [
      makeTag('industry', 'Heavy Infrastructure', 'llm', 0.4, null, 'Low confidence — thesis fit is weak.'),
      makeTag('construction_stage', 'Sustainability/Demolition', 'llm', 0.55, null),
    ],
    activity: [
      makeActivity('created', 'Added to database via Cold Outreach', '2025-06-05'),
      makeActivity('tagged', 'AI auto-tagged via LLM — low confidence', '2025-06-05'),
    ],
    notes: [
      makeNote('System', 'Flagged as a possible test/demo entry — confirm before including in reports.', '2025-06-05'),
    ],
    tagging_comment: [
      { label: 'Industry', note: 'low confidence — thesis fit unclear, may be out of scope' },
      { label: 'Stage', note: 'demolition scope conflicts with active portfolio thesis' },
    ],
    tagging_action: 'Confirm whether this is a real inbound lead or a test entry before spending review time on it.',
  },
  {
    id: '6',
    external_id: 'HV-0006',
    name: 'NewBuild Co',
    description: 'New entrant in the modular construction space.',
    priority: 'review',
    updated_at: '2025-07-01',
    domain: 'newbuildco.com',
    location: 'Not specified',
    region: 'Not specified',
    diversity_status: null,
    linkedin_url: null,
    origin_source: 'Website contact form',
    origin_category: 'Inbound',
    allie_knockout: null,
    andra_knockout: null,
    tags: [],
    activity: [
      makeActivity('created', 'Added to database via Inbound Pipeline', '2025-07-01'),
    ],
    notes: [],
    tagging_comment: [],
    tagging_action: null,
  },
]

function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms))
}

function toListItem(c: Company): CompanyListItem {
  const active = c.tags.filter(t => t.is_accepted !== false)
  const pending = active.filter(t => t.source !== 'human' && t.is_accepted === null)
  const aiTags = c.tags.filter(t => t.source !== 'human')
  const bySource = (axis: string) => {
    const t = active.find(t => t.axis === axis)
    return t?.source ?? null
  }
  const bestSource = active.some(t => t.source === 'human' && t.is_accepted === true) ? 'Human'
    : active.some(t => t.source === 'llm') ? 'LLM'
    : active.some(t => t.source === 'knn_classifier') ? 'KNN'
    : '—'
  const valuesFor = (axis: string) => {
    const vals = active.filter(t => t.axis === axis).map(t => t.value)
    return vals.length ? vals.join('; ') : null
  }
  return {
    id: c.id,
    external_id: c.external_id,
    name: c.name,
    description: c.description,
    priority: c.priority,
    updated_at: c.updated_at,
    min_confidence: aiTags.length ? Math.min(...aiTags.map(t => t.confidence)) : null,
    has_pending: pending.length > 0,
    tag_count: c.tags.length,
    region: c.region,
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

function queueBadge(c: Company): QueueBadge {
  if (c.tags.length === 0) return 'untagged'
  const aiTags = c.tags.filter(t => t.source !== 'human' && t.is_accepted !== false)
  if (!aiTags.length) return 'review'
  const min = Math.min(...aiTags.map(t => t.confidence))
  return min < 0.6 ? 'low' : 'review'
}

function queueIssue(c: Company): string {
  if (c.tags.length === 0) return 'Not yet processed'
  if (c.description.trim().length < 60) return 'Description too short'
  const aiTags = c.tags.filter(t => t.source !== 'human' && t.is_accepted !== false)
  if (!aiTags.length) return ''
  const weakest = aiTags.reduce((min, t) => (t.confidence < min.confidence ? t : min))
  return `${AXIS_LABELS[weakest.axis]} unclear`
}

function queueStale(c: Company): boolean {
  const aiTags = c.tags.filter(t => t.source !== 'human' && t.is_accepted !== false)
  if (!aiTags.length) return false
  return Math.min(...aiTags.map(t => t.confidence)) < 0.7
}

function toQueueItem(c: Company): QueueListItem {
  const active = c.tags.filter(t => t.is_accepted !== false)
  const valuesFor = (axis: string) => active.filter(t => t.axis === axis).map(t => t.value)
  return {
    id: c.id,
    external_id: c.external_id,
    name: c.name,
    description: c.description,
    updated_at: c.updated_at,
    badge: queueBadge(c),
    issue: queueIssue(c),
    stale: queueStale(c),
    industry: valuesFor('industry'),
    construction_stage: valuesFor('construction_stage'),
    product_type: valuesFor('product_type'),
    technology_type: valuesFor('technology_type'),
    region: c.region,
    tag_count: c.tags.length,
    has_pending: c.tags.some(t => t.is_accepted === null && t.source !== 'human'),
  }
}

export async function fetchQueue(params: {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  sort?: string
  filters?: Record<string, string[]>
} = {}): Promise<{ total: number; items: QueueListItem[] }> {
  const base = store.filter(c => c.tags.length === 0 || c.tags.some(t => t.is_accepted === null && t.source !== 'human'))
  let items = base.map(toQueueItem)

  if (params.search) {
    const q = params.search.toLowerCase()
    items = items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.external_id.toLowerCase().includes(q)
    )
  }

  if (params.status === 'untagged') items = items.filter(i => i.tag_count === 0)
  else if (params.status === 'pending') items = items.filter(i => i.has_pending)
  else if (params.status === 'reviewed') items = items.filter(i => !i.has_pending && i.tag_count > 0)

  if (params.filters) {
    for (const [axis, values] of Object.entries(params.filters)) {
      if (!values.length) continue
      items = items.filter(i => {
        const field = (i as unknown as Record<string, string | string[] | null>)[axis]
        if (!field) return false
        return Array.isArray(field) ? values.some(v => field.includes(v)) : values.includes(field)
      })
    }
  }

  const sort = params.sort ?? 'updated_desc'
  if (sort === 'name_asc') items.sort((a, b) => a.name.localeCompare(b.name))
  else if (sort === 'name_desc') items.sort((a, b) => b.name.localeCompare(a.name))
  else items.sort((a, b) => b.updated_at.localeCompare(a.updated_at))

  const pageSize = params.pageSize ?? 20
  const page = params.page ?? 1
  const start = (page - 1) * pageSize
  return delay({ total: items.length, items: items.slice(start, start + pageSize) })
}

export async function fetchCompany(id: string): Promise<Company> {
  const company = store.find(c => c.id === id)
  if (!company) throw new Error('Company not found')
  return delay({ ...company, tags: [...company.tags], activity: [...company.activity], notes: [...company.notes] })
}

export async function fetchMetrics(): Promise<Metrics> {
  const aiTags = store.flatMap(c => c.tags.filter(t => t.source !== 'human'))
  const overridden = aiTags.filter(t => t.is_accepted === false).length
  const pending = aiTags.filter(t => t.is_accepted === null).length
  const sources = [...new Set(aiTags.map(t => t.source))]
  const confidence_by_source = sources.map(source => {
    const confs = aiTags.filter(t => t.source === source).map(t => t.confidence)
    return {
      source,
      avg: confs.reduce((a, b) => a + b, 0) / confs.length,
      min: Math.min(...confs),
      max: Math.max(...confs),
    }
  })
  return delay({
    total_ai_tags: aiTags.length,
    override_rate: aiTags.length ? Math.round((overridden / aiTags.length) * 10000) / 10000 : 0,
    pending_review: pending,
    confidence_by_source,
  })
}

export async function fetchCompanies(params: {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  sort?: string
  filters?: Record<string, string[]>
}): Promise<{ total: number; items: CompanyListItem[] }> {
  let items = store.map(toListItem)

  if (params.search) {
    const q = params.search.toLowerCase()
    items = items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.external_id.toLowerCase().includes(q)
    )
  }

  if (params.status === 'untagged') items = items.filter(i => i.tag_count === 0)
  else if (params.status === 'pending') items = items.filter(i => i.has_pending)
  else if (params.status === 'reviewed') items = items.filter(i => !i.has_pending && i.tag_count > 0)

  if (params.filters) {
    for (const [axis, values] of Object.entries(params.filters)) {
      if (!values.length) continue
      items = items.filter(i => {
        const field = (i as unknown as Record<string, string | null>)[axis]
        if (!field) return false
        return axis === 'region' ? values.includes(field) : values.some(v => field.split('; ').includes(v))
      })
    }
  }

  const sort = params.sort ?? 'updated_desc'
  if (sort === 'name_asc') items.sort((a, b) => a.name.localeCompare(b.name))
  else if (sort === 'name_desc') items.sort((a, b) => b.name.localeCompare(a.name))
  else if (sort === 'confidence_asc') items.sort((a, b) => (a.min_confidence ?? 1) - (b.min_confidence ?? 1))
  else if (sort === 'tags_desc') items.sort((a, b) => b.tag_count - a.tag_count)
  else if (sort === 'tags_asc') items.sort((a, b) => a.tag_count - b.tag_count)
  else items.sort((a, b) => b.updated_at.localeCompare(a.updated_at))

  const pageSize = params.pageSize ?? 20
  const page = params.page ?? 1
  const start = (page - 1) * pageSize
  return delay({ total: items.length, items: items.slice(start, start + pageSize) })
}

export async function createCompany(data: {
  name: string
  domain: string
  description?: string
  origin_source?: string
  origin_category?: string
  external_id?: string
}): Promise<{ id: string; external_id: string }> {
  const id = String(store.length + nextCompanyNum++)
  const external_id = data.external_id || `HV-${String(store.length + 1).padStart(4, '0')}`
  if (store.some(c => c.external_id === external_id)) throw new Error('Company with this external_id already exists')

  const company: Company = {
    id, external_id, name: data.name, description: data.description ?? '',
    priority: 'review', updated_at: new Date().toISOString().slice(0, 10),
    domain: data.domain, location: 'Not specified', region: 'Not specified',
    diversity_status: null, linkedin_url: null,
    origin_source: data.origin_source ?? '',
    origin_category: data.origin_category || null,
    allie_knockout: null, andra_knockout: null,
    tags: [], activity: [], notes: [], tagging_comment: [], tagging_action: null,
  }
  logActivity(company, 'created', `Added to database via ${data.origin_category || 'Manual Entry'}`)
  store.push(company)

  // simulate async auto-tagging
  setTimeout(() => {
    for (const axis of AXES) {
      company.tags.push(makeTag(axis, placeholderTag(axis), 'llm', 0.7, null, 'Mock tag — no backend connected yet.'))
    }
    logActivity(company, 'tagged', 'AI auto-tagged via LLM')
  }, 1500)

  return delay({ id, external_id }, 200)
}

export interface CompanyUpdate {
  name: string
  description: string
  domain: string
  linkedin_url: string | null
  location: string
  origin_source: string
  origin_category: string | null
  allie_knockout: KnockoutStatus
  andra_knockout: KnockoutStatus
  region: string
  industry: string[]
  construction_stage: string[]
  product_type: string[]
  technology_type: string[]
}

export async function updateCompany(
  id: string,
  update: CompanyUpdate,
  activityLabel = 'Company details edited',
  activityType: ActivityType = 'edited'
): Promise<void> {
  const company = store.find(c => c.id === id)
  if (!company) throw new Error('Company not found')

  company.name = update.name
  company.description = update.description
  company.domain = update.domain
  company.linkedin_url = update.linkedin_url
  company.location = update.location
  company.origin_source = update.origin_source
  company.origin_category = update.origin_category
  company.allie_knockout = update.allie_knockout
  company.andra_knockout = update.andra_knockout
  company.region = update.region
  company.updated_at = new Date().toISOString().slice(0, 10)

  const axes: [string, string[]][] = [
    ['industry', update.industry],
    ['construction_stage', update.construction_stage],
    ['product_type', update.product_type],
    ['technology_type', update.technology_type],
  ]

  for (const [axis, values] of axes) {
    company.tags = company.tags.filter(t => t.axis !== axis)
    values.forEach(v => company.tags.push(makeTag(axis, v, 'human', 1, true)))
  }

  logActivity(company, activityType, activityLabel)

  return delay(undefined, 250)
}

export async function deleteCompany(id: string): Promise<void> {
  const idx = store.findIndex(c => c.id === id)
  if (idx !== -1) store.splice(idx, 1)
  return delay(undefined, 150)
}

export async function addNote(companyId: string, text: string, reminderDate: string | null = null): Promise<Note> {
  const company = store.find(c => c.id === companyId)
  if (!company) throw new Error('Company not found')
  const note = makeNote('You', text, new Date().toISOString().slice(0, 10), reminderDate)
  company.notes.push(note)
  return delay(note, 200)
}

export async function deleteNote(companyId: string, noteId: string): Promise<void> {
  const company = store.find(c => c.id === companyId)
  if (!company) throw new Error('Company not found')
  company.notes = company.notes.filter(n => n.id !== noteId)
  return delay(undefined, 150)
}

function placeholderTag(axis: string): string {
  const options: Record<string, string> = {
    construction_stage: 'Design & Planning',
    technology_type: 'Cloud Computing/SaaS',
    product_type: 'Software Platform',
    industry: 'Commercial',
  }
  return options[axis]
}

export interface ChatSource {
  type: 'company' | 'policy'
  id?: string
  name: string
}

export async function sendChatMessage(
  _messages: { role: string; content: string }[],
  _contextCompanyId: string | null
): Promise<{ response: string; sources: ChatSource[] }> {
  return delay({
    response: "I'm not wired up to a backend yet — this is placeholder text so the chat UI can be demoed without a live server.",
    sources: [],
  }, 500)
}
