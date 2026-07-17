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
export type KnockoutStatus = '01_Pass' | '02_Discuss' | '03_Revisit - Need More Info' | '04_Deck' | '05_Fail' | null
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
  created_at: string
  domain: string
  location: string
  region: string[]
  diversity_status: string | null
  linkedin_url: string | null
  origin_source: string
  origin_category: string | null
  allie_knockout: KnockoutStatus
  andra_knockout: KnockoutStatus
  tagged_by: string
  tags: Tag[]
  activity: ActivityEntry[]
  notes: Note[]
  tagging_comment: TaggingCommentLine[]
  tagging_action: string | null
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
  tagged_by: string
  region: string | null
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

export type ScoreBand = 'high' | 'needs_review' | 'insufficient'

export interface QueueListItem {
  id: string
  external_id: string
  name: string
  description: string
  updated_at: string
  tagged_by: string
  score: number
  band: ScoreBand
  tagging_comment: TaggingCommentLine[]
  tagging_action: string | null
  industry: string[]
  construction_stage: string[]
  product_type: string[]
  technology_type: string[]
  region: string[]
  tag_count: number
}

// Fallback snapshot used until the live schema loads (or if the backend is unreachable).
// The source of truth is Notion itself — see fetchTaxonomy() / TaxonomyContext.
export const DEFAULT_REGIONS = ['West US', 'Southwest US', 'Southeast US', 'Northeast US', 'Midwest US', 'International', 'International - Europe', 'Europe', 'Noncontiguous US', 'Unknown']
export const DEFAULT_ORIGIN_CATEGORIES = ['Automated Dealflow Search', 'Fund Fellows - Independent Research', 'Fund Fellows - Newsletter', 'Fund Fellows - Industry Events', 'Accelerators & Incubators', 'Hometeam Network', 'Harmonic_Automated Dealflow Search', 'Cold Inbound Via HTV Website', 'VC Co-investor', 'Cold Outreach', 'LP', 'Tracking Founders', 'Speaking Engagements', 'Unknown - DO NOT USE']
export const DEFAULT_ALLIE_KNOCKOUT_STATES = ['01_Pass', '02_Discuss', '03_Revisit - Need More Info', '04_Deck', '05_Fail']
export const DEFAULT_ANDRA_KNOCKOUT_STATES = ['01_Pass', '02_Discuss', '03_Revisit - Need More Info', '04_Deck', '05_Fail']

export const DEFAULT_TAXONOMY: Record<string, string[]> = {
  industry: ['ConTech', 'PropTech', 'Out Of Scope', 'NA'],
  construction_stage: ['Entire Value Chain', 'Post-Construction', 'Construction Execution', 'Conception', 'Pre-Construction', 'Design&Engineering', 'Other', 'FILL IN', 'Out Of Scope', 'Circularity', 'NA'],
  product_type: ['Sustainability - Energy', 'AI - ML - IoT', 'Digital Collaboration', 'Risk Management', 'Labor Solution', 'GovTech', 'Inventory - Supply Chain Optimization', 'FinTech Or Financial Services', 'InsurTech', 'Analytics', 'Programming - Financing - Permitting Solutions', 'Industrialized Construction', 'Design Tech', 'Procurement', 'Operation - Maintenance - Renovation', 'Other', 'Frontier Tech And Robotics', 'Renting Solutions', 'End of Life - Demolition & Waste - Recycling', 'Learning Platforms', 'ADD', 'Land Management Solutions', 'Homeownership', 'DeepTech', 'Legal Tasks', 'Geospatial Solution'],
  technology_type: ['Material Science', 'SaaS', 'Hardware'],
  region: DEFAULT_REGIONS,
}

export interface TaxonomyData {
  industry: string[]
  construction_stage: string[]
  product_type: string[]
  technology_type: string[]
  region: string[]
  origin_category: string[]
  allie_knockout_states: string[]
  andra_knockout_states: string[]
}

export async function fetchTaxonomy(): Promise<TaxonomyData> {
  const res = await fetch('/api/taxonomy')
  if (!res.ok) throw new Error('Failed to fetch taxonomy from Notion')
  return res.json()
}

export interface InboundBreakdown {
  label: string
  value: number
}

export interface InboundStats {
  inboundTotal: number
  femaleFounders: number
  bipocFounders: number
  constructionStage: InboundBreakdown[]
  constructionStageExtra: InboundBreakdown[]
  region: InboundBreakdown[]
  source: InboundBreakdown[]
  industry: InboundBreakdown[]
  productType: InboundBreakdown[]
  technologyType: InboundBreakdown[]
  diversity: InboundBreakdown[]
  cached_at: number
}

// `ranges` is one { from, to } date pair per selected quarter — the backend scopes companies
// to the union of those ranges by created_at and buckets every axis dynamically server-side.
export async function fetchInboundStats(ranges: { from: string; to: string }[]): Promise<InboundStats> {
  const res = await fetch(`/api/stats/inbound?ranges=${encodeURIComponent(JSON.stringify(ranges))}`)
  if (!res.ok) throw new Error('Failed to fetch inbound stats from Notion')
  return res.json()
}

// Internal pipeline/tagging-health metrics for the Portfolio Metrics page — not portfolio
// company performance (that's a separate, future addition to that same page).
export interface PipelineStats {
  total: number
  taggedBy: Record<string, number>
  scoreBands: { high: number; needs_review: number; insufficient: number }
  avgScore: number
  coverageRate: number
  reviewedLast7Days: number
  reviewedLast30Days: number
  backlogOver30Days: number
  backlogOver60Days: number
  backlogOver90Days: number
  cached_at: number
}

export async function fetchPipelineStats(): Promise<PipelineStats> {
  const res = await fetch('/api/stats/pipeline')
  if (!res.ok) throw new Error('Failed to fetch pipeline stats from Notion')
  return res.json()
}

export const AXIS_LABELS: Record<string, string> = {
  industry: 'Industry',
  construction_stage: 'Construction Stage',
  product_type: 'Product Type',
  technology_type: 'Technology Type',
  region: 'Region',
}

// Tagged By is a review-workflow state, not a classification tag — kept separate from
// AXIS_LABELS/taxonomy, but filterable through the same multi-select mechanism as the axes above.
export const TAGGED_BY_OPTIONS = ['NA', 'AI Agent', 'Human']
export const TAGGED_BY_LABELS: Record<string, string> = {
  NA: 'Untagged',
  'AI Agent': 'AI Tagged',
  Human: 'Human Tagged',
}

// Values that mean "not really tagged" per axis — mirrors the agent's own Tagging Comment schema.
export const FILLER_VALUES: Record<string, string[]> = {
  industry: ['NA', 'Out Of Scope'],
  construction_stage: ['FILL IN', 'Other'],
  product_type: ['Other'],
  technology_type: ['Other'],
  region: ['Unknown'],
}

const SCORE_AXES = ['industry', 'construction_stage', 'product_type', 'technology_type', 'region']

function axisValues(company: Company, axis: string): string[] {
  if (axis === 'region') return company.region
  return company.tags.filter(t => t.axis === axis && t.is_accepted !== false).map(t => t.value)
}

function isAxisClean(company: Company, axis: string): boolean {
  const values = axisValues(company, axis)
  if (values.length === 0) return false
  const filler = FILLER_VALUES[axis] ?? []
  return !values.some(v => filler.includes(v))
}

export function computeScore(company: Company): { score: number; band: ScoreBand } {
  let score = 0
  const wordCount = company.description.trim().split(/\s+/).filter(Boolean).length
  if (company.description.trim() && wordCount > 20) score += 40
  if (company.location.trim()) score += 20
  if (company.domain.trim()) score += 20
  for (const axis of SCORE_AXES) {
    if (isAxisClean(company, axis)) score += 4
  }
  const band: ScoreBand = score >= 80 ? 'high' : score >= 50 ? 'needs_review' : 'insufficient'
  return { score, band }
}

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
    created_at: '2025-06-01',
    domain: 'groforma.com',
    location: 'San Francisco, CA',
    region: ['West US'],
    diversity_status: null,
    linkedin_url: 'https://linkedin.com/company/groforma',
    origin_source: 'LinkedIn',
    origin_category: 'Inbound',
    allie_knockout: null,
    andra_knockout: null,
    tagged_by: 'Human',
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
    created_at: '2025-06-08',
    domain: 'tarahome.io',
    location: 'Austin, TX',
    region: ['South US'],
    diversity_status: 'Not specified',
    linkedin_url: 'https://linkedin.com/company/tarahome',
    origin_source: 'Partner referral',
    origin_category: 'Referral',
    allie_knockout: null,
    andra_knockout: null,
    tagged_by: 'AI Agent',
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
    created_at: '2025-06-06',
    domain: 'feesback.com',
    location: 'New York, NY',
    region: ['East US'],
    diversity_status: null,
    linkedin_url: null,
    origin_source: 'ConTech Summit 2025',
    origin_category: 'Conference',
    allie_knockout: '01_Pass',
    andra_knockout: null,
    tagged_by: 'AI Agent',
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
    created_at: '2025-06-03',
    domain: 'buildsafe.ai',
    location: 'Chicago, IL',
    region: ['Midwest US'],
    diversity_status: 'Woman-owned',
    linkedin_url: 'https://linkedin.com/company/buildsafeai',
    origin_source: 'LinkedIn',
    origin_category: 'Inbound',
    allie_knockout: '01_Pass',
    andra_knockout: '01_Pass',
    tagged_by: 'Human',
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
    created_at: '2025-06-04',
    domain: 'test007.com',
    location: 'Denver, CO',
    region: ['Mountain US'],
    diversity_status: null,
    linkedin_url: null,
    origin_source: 'Cold email',
    origin_category: 'Outbound',
    allie_knockout: '05_Fail',
    andra_knockout: null,
    tagged_by: 'AI Agent',
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
    created_at: '2025-07-01',
    domain: 'newbuildco.com',
    location: 'Not specified',
    region: ['Not specified'],
    diversity_status: null,
    linkedin_url: null,
    origin_source: 'Website contact form',
    origin_category: 'Inbound',
    allie_knockout: null,
    andra_knockout: null,
    tagged_by: 'NA',
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

// Builds the query string shared by /api/companies/list and /api/companies/queue —
// search/status/sort/pagination are plain params, filters is JSON-encoded since it's a
// Record<string, string[]> and query strings don't have a native way to express that.
function buildListQuery(params: {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  sort?: string
  filters?: Record<string, string[]>
}): string {
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', String(params.page))
  if (params.pageSize) qs.set('pageSize', String(params.pageSize))
  if (params.search) qs.set('search', params.search)
  if (params.status) qs.set('status', params.status)
  if (params.sort) qs.set('sort', params.sort)
  if (params.filters && Object.keys(params.filters).length) qs.set('filters', JSON.stringify(params.filters))
  return qs.toString()
}

export async function fetchQueue(params: {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  sort?: string
  filters?: Record<string, string[]>
} = {}): Promise<{ total: number; items: QueueListItem[] }> {
  const qs = buildListQuery(params)
  const res = await fetch(`/api/companies/queue?${qs}`)
  if (!res.ok) throw new Error('Failed to fetch queue from Notion')
  const data = await res.json()
  if (data.cached_at) companiesCachedAt = data.cached_at
  return { total: data.total, items: data.items }
}

// Real Notion company IDs are UUIDs (contain dashes); mock/demo IDs are plain digits.
export function isRealCompanyId(id: string): boolean {
  return id.includes('-')
}

// Tracks when the company data was last pulled from Notion, for the "X ago" label —
// updated by whichever list/queue/refresh call last touched the backend. The full company
// list itself is never held client-side anymore — the backend keeps the warm cache and
// serves search/filter/sort/pagination itself, so the browser only ever gets the current page.
let companiesCachedAt: number | null = null

export function getCompaniesCachedAt(): number | null {
  return companiesCachedAt
}

// Mirrors the backend's MIN_REFRESH_INTERVAL_MS — used to disable the Refresh button
// client-side so the UI cooldown matches what the server will actually honor.
export const REFRESH_COOLDOWN_S = 60

// Forces the backend past its 1h TTL to re-fetch from Notion (subject to its own cooldown).
// Only triggers the refresh — the caller re-runs its own list/queue fetch right after to
// pick up the result. Piggybacks on /api/companies/list with pageSize=1 so the refresh
// side-effect happens without shipping the full company list just to read cached_at.
export async function refreshCompanies(): Promise<void> {
  const res = await fetch('/api/companies/list?refresh=1&pageSize=1')
  if (!res.ok) throw new Error('Failed to refresh companies from Notion')
  const data = await res.json()
  if (data.cached_at) companiesCachedAt = data.cached_at
}

export interface AxisApproval {
  industry: string[]
  construction_stage: string[]
  product_type: string[]
  technology_type: string[]
  region: string[]
}

// Shared write path for real Notion companies — backend PATCH /api/companies/:id only touches
// whichever fields are present in the body, and always marks the company Tagged By → Human
// since this is only ever called from human-initiated actions (Approve Tags, Edit Save).
async function patchRealCompany(id: string, fields: AxisApproval | CompanyUpdate): Promise<Company> {
  const res = await fetch(`/api/companies/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  if (!res.ok) throw new Error('Failed to save changes to Notion')
  return res.json() as Promise<Company>
}

// Approve Tags: marks a company human-reviewed and persists the (possibly human-corrected)
// classification axes. Deliberately narrow — never touches name/description/domain/etc.
export async function approveCompanyTags(id: string, axes: AxisApproval): Promise<Company> {
  return patchRealCompany(id, axes)
}

// Edit Save: writes the full editable record for a real Notion company.
export async function updateRealCompany(id: string, update: CompanyUpdate): Promise<Company> {
  return patchRealCompany(id, update)
}

// "Delete" = archive in Notion — soft, reversible from within Notion itself.
export async function deleteRealCompany(id: string): Promise<void> {
  const res = await fetch(`/api/companies/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete company in Notion')
}

// "5 mins ago" style relative time, for showing when the company list was last pulled from Notion.
export function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin === 1) return '1 min ago'
  if (diffMin < 60) return `${diffMin} mins ago`
  const diffHr = Math.floor(diffMin / 60)
  return diffHr === 1 ? '1 hour ago' : `${diffHr} hours ago`
}

export async function fetchCompany(id: string, force = false): Promise<Company> {
  if (isRealCompanyId(id)) {
    // The backend keeps its own warm cache and serves single-company lookups from it, so
    // this stays fast without the frontend holding the full list. `force` bypasses that
    // cache — needed by the tagging-in-progress poll, which must see live Notion state,
    // not a snapshot that could be up to an hour old.
    const res = await fetch(`/api/companies/${id}${force ? '?fresh=1' : ''}`)
    if (!res.ok) throw new Error('Failed to fetch company from Notion')
    return res.json()
  }
  const company = store.find(c => c.id === id)
  if (!company) throw new Error('Company not found')
  return delay({ ...company, tags: [...company.tags], activity: [...company.activity], notes: [...company.notes] })
}

export async function fetchCompanies(params: {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  sort?: string
  filters?: Record<string, string[]>
}): Promise<{ total: number; items: CompanyListItem[] }> {
  const qs = buildListQuery(params)
  const res = await fetch(`/api/companies/list?${qs}`)
  if (!res.ok) throw new Error('Failed to fetch companies from Notion')
  const data = await res.json()
  if (data.cached_at) companiesCachedAt = data.cached_at
  return { total: data.total, items: data.items }
}

export interface NewCompany {
  name: string
  domain?: string
  description?: string
  origin_source?: string
  origin_category?: string
}

// Add Company: creates a real page in the live Notion Companies database.
export async function createRealCompany(data: NewCompany): Promise<Company> {
  const res = await fetch('/api/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to create company in Notion')
  }
  return res.json()
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
    created_at: new Date().toISOString().slice(0, 10),
    domain: data.domain, location: 'Not specified', region: ['Not specified'],
    diversity_status: null, linkedin_url: null,
    origin_source: data.origin_source ?? '',
    origin_category: data.origin_category || null,
    allie_knockout: null, andra_knockout: null, tagged_by: 'NA',
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
  region: string[]
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
