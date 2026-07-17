import { useEffect, useState } from 'react'
import {
  Search, X, PartyPopper, Loader2, ChevronDown, CheckCircle2, AlertTriangle, XCircle, Bot, UserRound, HelpCircle, RefreshCw,
} from 'lucide-react'
import {
  fetchQueue, fetchCompany, updateCompany, approveCompanyTags, refreshCompanies, REFRESH_COOLDOWN_S, getCompaniesCachedAt, formatRelativeTime, isRealCompanyId, QueueListItem, Company, ScoreBand, AXIS_LABELS,
} from '../api'
import FilterSidebar from '../components/FilterSidebar'
import { useToast } from '../context/ToastContext'
import { useTaxonomy } from '../context/TaxonomyContext'

const SCORE_BADGE_META: Record<ScoreBand, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  high: { label: 'High', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', icon: CheckCircle2 },
  needs_review: { label: 'Needs Review', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20', icon: AlertTriangle },
  insufficient: { label: 'Insufficient Data', cls: 'bg-red-50 text-red-600 ring-red-600/20', icon: XCircle },
}

function scoreBadge(band: ScoreBand, taggedBy: string) {
  // Once a human has approved, the score badge stops reflecting data-completeness
  // and just confirms the review happened.
  const { label, cls, icon: Icon } = taggedBy === 'Human'
    ? { label: 'Reviewed', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', icon: CheckCircle2 }
    : SCORE_BADGE_META[band]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${cls}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </span>
  )
}

const TAGGED_BY_ICON_META: Record<string, { icon: typeof Bot; cls: string; title: string }> = {
  'Human': { icon: UserRound, cls: 'text-emerald-600', title: 'Tagged by Human' },
  'AI Agent': { icon: Bot, cls: 'text-indigo-600', title: 'Tagged by AI Agent' },
  'NA': { icon: HelpCircle, cls: 'text-ht-blue/30', title: 'Untagged' },
}

function taggedByIcon(taggedBy: string) {
  const { icon: Icon, cls, title } = TAGGED_BY_ICON_META[taggedBy] ?? TAGGED_BY_ICON_META['NA']
  return (
    <span title={title} className="inline-flex items-center">
      <Icon className={`w-4 h-4 shrink-0 ${cls}`} />
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const PRIMARY_AXES: [keyof QueueListItem, string][] = [
  ['industry', 'Industry'],
  ['construction_stage', 'Stage'],
  ['product_type', 'Product'],
]

function primaryPills(item: QueueListItem) {
  const shown = PRIMARY_AXES
    .map(([axis, label]) => {
      const values = item[axis] as string[]
      return values.length ? { label, value: values[0] } : null
    })
    .filter((p): p is { label: string; value: string } => p !== null)
  const remaining = Math.max(0, item.tag_count - shown.length)
  return (
    <div className="flex items-center flex-wrap gap-x-2 gap-y-1.5 mt-3">
      {shown.map(p => (
        <span key={p.label} className="inline-flex items-center gap-1.5 text-xs">
          <span className="text-[10px] font-bold text-ht-blue/40 uppercase tracking-widest">{p.label}</span>
          <span className="px-2.5 py-1 rounded-full bg-ht-blue/5 text-ht-blue font-medium">{p.value}</span>
        </span>
      ))}
      {remaining > 0 && <span className="text-xs text-ht-blue/40">+{remaining} more</span>}
    </div>
  )
}

const HIGH_SEVERITY_LABELS = ['Industry', 'Stage', 'Construction Stage']

function taggingCommentBlock(item: QueueListItem) {
  if (item.tagging_comment.length === 0 && !item.tagging_action) return null

  const highSeverity = item.tagging_comment.some(line => HIGH_SEVERITY_LABELS.includes(line.label))
  const bg = highSeverity ? '#FFF5F5' : '#FFFBEB'
  const border = highSeverity ? '#FECACA' : '#F5D87A'
  const text = '#92400E'

  return (
    <div className="mt-3 rounded-lg px-3.5 py-3" style={{ backgroundColor: bg, border: `1px solid ${border}` }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Bot className="w-3 h-3" style={{ color: text }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: text }}>AI Agent Notes</span>
      </div>

      <div style={{ lineHeight: 1.6 }}>
        {item.tagging_comment.map((line, i) => (
          <p key={i} className="text-xs" style={{ color: text }}>
            • {line.label} — {line.note}
          </p>
        ))}
        {item.tagging_action && (
          <p className="text-xs" style={{ color: text }}>
            → {item.tagging_action}
          </p>
        )}
      </div>
    </div>
  )
}

const SORT_OPTIONS = [
  { value: 'score_asc', label: 'Lowest Score First' },
  { value: 'score_desc', label: 'Highest Score First' },
  { value: 'updated_desc', label: 'Recently Modified' },
  { value: 'name_asc', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' },
]

const selectArrowStyle = {
  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.75rem center',
  backgroundSize: '1em',
} as const

interface AxisState {
  industry: string[]
  construction_stage: string[]
  product_type: string[]
  technology_type: string[]
  region: string[]
}

function AddChipPopover({ options, onPick }: { options: string[]; onPick: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 pl-3 pr-2 py-1.5 text-xs font-semibold text-ht-blue bg-white border border-ht-blue/15 rounded-lg hover:bg-ht-blue/5 transition-colors"
      >
        + Add <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div
          onMouseLeave={() => setOpen(false)}
          className="absolute right-0 mt-1 w-48 max-h-64 overflow-y-auto custom-scrollbar bg-white rounded-xl shadow-lg border border-ht-blue/10 py-1.5 z-20"
        >
          {options.map(o => (
            <button
              key={o}
              type="button"
              onClick={() => { onPick(o); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-ht-blue hover:bg-ht-blue/5 flex items-center gap-2"
            >
              <span className="w-3.5 h-3.5 rounded-full border border-ht-blue/25 shrink-0" />
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AxisRow({
  label, values, options, onChange,
}: {
  label: string
  values: string[]
  options: string[]
  onChange: (v: string[]) => void
}) {
  const remaining = options.filter(o => !values.includes(o))
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-ht-blue/5 last:border-b-0">
      <span className="text-[10px] font-bold uppercase tracking-widest shrink-0 w-32 text-ht-blue/40">{label}</span>
      <div className="flex-1 flex flex-wrap items-center gap-1.5">
        {values.length === 0 ? (
          <span className="text-sm text-ht-blue/30 italic">No tags selected</span>
        ) : (
          values.map(v => (
            <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-ht-blue/5 text-ht-blue text-xs font-medium">
              {v}
              <button type="button" onClick={() => onChange(values.filter(x => x !== v))} className="hover:text-red-600 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
      </div>
      <AddChipPopover options={remaining} onPick={v => onChange([...values, v])} />
    </div>
  )
}

const AXIS_ROWS: [keyof AxisState, string][] = [
  ['industry', AXIS_LABELS.industry],
  ['construction_stage', AXIS_LABELS.construction_stage],
  ['product_type', AXIS_LABELS.product_type],
  ['technology_type', AXIS_LABELS.technology_type],
  ['region', AXIS_LABELS.region],
]

function QueueRow({
  item, expanded, onToggle, onApproved,
}: {
  item: QueueListItem
  expanded: boolean
  onToggle: () => void
  onApproved: () => void
}) {
  const { showToast } = useToast()
  const { taxonomy } = useTaxonomy()
  const [company, setCompany] = useState<Company | null>(null)
  const [state, setState] = useState<AxisState | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!expanded || company) return
    setLoading(true)
    fetchCompany(item.id).then(c => {
      setCompany(c)
      const active = c.tags.filter(t => t.is_accepted !== false)
      const valuesFor = (axis: string) => active.filter(t => t.axis === axis).map(t => t.value)
      setState({
        industry: valuesFor('industry'),
        construction_stage: valuesFor('construction_stage'),
        product_type: valuesFor('product_type'),
        technology_type: valuesFor('technology_type'),
        region: c.region,
      })
      setLoading(false)
    })
  }, [expanded, item.id, company])

  async function handleApprove() {
    if (!company || !state) return
    setSaving(true)
    if (isRealCompanyId(company.id)) {
      try {
        await approveCompanyTags(company.id, state)
        showToast('success', 'Tags approved', 'Classification has been saved as human-reviewed.')
        onApproved()
      } catch (err) {
        console.error('Failed to approve tags in Notion:', err)
        showToast('error', 'Approve failed', 'Could not save the review to Notion.')
      } finally {
        setSaving(false)
      }
      return
    }
    await updateCompany(company.id, {
      name: company.name,
      description: company.description,
      domain: company.domain,
      linkedin_url: company.linkedin_url,
      location: company.location,
      origin_source: company.origin_source,
      origin_category: company.origin_category,
      allie_knockout: company.allie_knockout,
      andra_knockout: company.andra_knockout,
      region: state.region,
      industry: state.industry,
      construction_stage: state.construction_stage,
      product_type: state.product_type,
      technology_type: state.technology_type,
    }, 'Tags approved — marked human-reviewed', 'reviewed')
    setSaving(false)
    showToast('success', 'Tags approved', 'Classification has been saved as human-reviewed.')
    onApproved()
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all overflow-hidden ${expanded ? 'border-l-4 border-l-ht-orange border-ht-blue/10' : 'border-ht-blue/10 hover:border-ht-blue/20 hover:shadow-md'}`}>
      <div onClick={onToggle} className="p-6 flex items-center justify-between gap-6 cursor-pointer">
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold text-ht-blue text-base">{item.name}</h3>
          <p className={`text-sm text-ht-blue/60 mt-1 ${expanded ? '' : 'line-clamp-1'}`}>
            {item.description.trim() || <span className="italic text-ht-blue/30">No company description</span>}
          </p>
          {expanded ? taggingCommentBlock(item) : primaryPills(item)}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2.5">
              {scoreBadge(item.band, item.tagged_by)}
              {taggedByIcon(item.tagged_by)}
            </div>
            <span className={`text-xs flex items-center gap-1.5 ${item.band === 'insufficient' ? 'text-red-500' : 'text-ht-blue/40'}`}>
              {item.band === 'insufficient' && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
              {item.score}/100
            </span>
            <span className="text-xs text-ht-blue/40">{formatDate(item.updated_at)}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-ht-blue/40 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="px-6 pb-6 border-t border-ht-blue/5 pt-2">
          {loading || !state ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-ht-orange animate-spin" />
            </div>
          ) : (
            <>
              {AXIS_ROWS.map(([axis, label]) => (
                <AxisRow
                  key={axis}
                  label={label}
                  values={state[axis]}
                  options={taxonomy[axis]}
                  onChange={v => setState(s => s && { ...s, [axis]: v })}
                />
              ))}

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleApprove}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-ht-orange text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-ht-orange/30 transition-all disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" /> {saving ? 'Approving…' : 'Approve Tags'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function Queue() {
  const { taxonomy } = useTaxonomy()
  const { showToast } = useToast()
  const [items, setItems] = useState<QueueListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sort, setSort] = useState('score_asc')
  // Defaults to Untagged + AI Tagged — the actual queue (anything awaiting review). Human-reviewed
  // companies live under "Recently Reviewed" and are opt-in via the Tagged By filter.
  const [filters, setFilters] = useState<Record<string, string[]>>({ tagged_by: ['NA', 'AI Agent'] })
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>(
    Object.keys(taxonomy).reduce((acc, key) => ({ ...acc, [key]: false }), { tagged_by: false })
  )

  const filterKey = JSON.stringify(filters)

  async function load(p = page) {
    setLoading(true)
    const data = await fetchQueue({ page: p, pageSize: 20, search, sort, filters })
    setItems(data.items)
    setTotal(data.total)
    setLoading(false)
  }

  useEffect(() => { load(1); setPage(1) }, [search, filterKey, sort])
  useEffect(() => { load() }, [page])

  const [refreshing, setRefreshing] = useState(false)
  const [cooldown, setCooldown] = useState(0) // seconds left before Refresh is clickable again
  const [, tick] = useState(0) // re-render periodically so the "X ago" label stays current

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 15000)
    return () => clearInterval(t)
  }, [])

  async function handleRefresh() {
    if (refreshing || cooldown > 0) return
    setRefreshing(true)
    try {
      await refreshCompanies()
      await load(page)
      showToast('success', 'Refreshed', 'Latest company data pulled from Notion.')
    } catch (err) {
      console.error('Failed to refresh companies from Notion:', err)
      showToast('error', 'Refresh failed', 'Could not pull the latest data from Notion.')
    } finally {
      setRefreshing(false)
      setCooldown(REFRESH_COOLDOWN_S)
    }
  }

  const activeFilterCount = Object.values(filters).reduce((n, tags) => n + tags.length, 0)

  function toggleFilter(axis: string, tag: string) {
    setFilters(prev => {
      const current = prev[axis] ?? []
      const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]
      if (next.length === 0) {
        const { [axis]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [axis]: next }
    })
  }

  function clearFilters() { setFilters({}) }

  return (
    <div className="flex gap-6">
      <FilterSidebar
        filters={filters}
        toggleFilter={toggleFilter}
        expandedCats={expandedCats}
        setExpandedCats={setExpandedCats}
        activeFilterCount={activeFilterCount}
        clearFilters={clearFilters}
      />

      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-display font-semibold text-ht-blue tracking-tight">Review Queue</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xl">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-ht-blue/40" />
            </div>
            <input
              type="text"
              placeholder="Search queue..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setSearch(searchInput)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-ht-blue/10 rounded-xl focus:outline-none focus:border-ht-blue/30 focus:ring-4 focus:ring-ht-blue/5 transition-all placeholder:text-ht-blue/30 text-ht-blue shadow-sm"
            />
          </div>
          <button
            onClick={() => setSearch(searchInput)}
            className="px-5 py-2.5 bg-white text-ht-blue font-medium text-sm rounded-xl border border-ht-blue/10 hover:bg-ht-blue/5 hover:border-ht-blue/20 transition-all shadow-sm"
          >
            Search
          </button>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="px-4 pr-10 py-2.5 bg-white border border-ht-blue/10 text-ht-blue text-sm rounded-xl focus:outline-none focus:ring-4 focus:ring-ht-blue/5 shadow-sm ml-2 appearance-none cursor-pointer hover:bg-ht-blue/5 transition-colors"
            style={selectArrowStyle}
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="relative ml-auto">
            <button
              onClick={handleRefresh}
              disabled={refreshing || cooldown > 0}
              className="px-4 py-2.5 bg-white text-ht-blue font-medium text-sm rounded-xl border border-ht-blue/10 hover:bg-ht-blue/5 hover:border-ht-blue/20 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : cooldown > 0 ? `Refresh (${cooldown}s)` : 'Refresh'}
            </button>
            {getCompaniesCachedAt() && (
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[11px] text-ht-blue/40 whitespace-nowrap">
                {formatRelativeTime(getCompaniesCachedAt()!)}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-ht-blue/10">
            <Loader2 className="w-8 h-8 text-ht-orange animate-spin mb-4" />
            <p className="text-sm font-medium text-ht-blue/50 animate-pulse">Loading queue...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-ht-blue/20">
            <div className="w-20 h-20 mb-6 rounded-full bg-white flex items-center justify-center shadow-sm border border-ht-blue/5">
              <PartyPopper className="w-8 h-8 text-ht-blue/30" />
            </div>
            <h3 className="text-xl font-display font-semibold text-ht-blue mb-2">Queue is empty</h3>
            <p className="text-sm text-ht-blue/60 max-w-md">All companies matching these filters have been reviewed.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <QueueRow
                key={item.id}
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(prev => prev === item.id ? null : item.id)}
                onApproved={() => { setExpandedId(null); load() }}
              />
            ))}

            {total > 20 && (
              <div className="flex items-center justify-between px-2 py-3">
                <span className="text-xs text-ht-blue/40">Page {page} of {Math.ceil(total / 20)}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1 text-xs border border-ht-blue/10 rounded-lg hover:bg-white disabled:opacity-40">Previous</button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)}
                    className="px-3 py-1 text-xs border border-ht-blue/10 rounded-lg hover:bg-white disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
