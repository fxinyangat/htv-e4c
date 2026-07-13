import { useEffect, useState } from 'react'
import {
  Search, X, PartyPopper, Loader2, ChevronDown, ShieldAlert, ShieldX, Tag as TagIcon, CheckCircle2,
} from 'lucide-react'
import {
  fetchQueue, fetchCompany, updateCompany, QueueListItem, Company, QueueBadge, TAXONOMY, AXIS_LABELS, REGIONS,
} from '../api'
import FilterSidebar from '../components/FilterSidebar'
import { useToast } from '../context/ToastContext'

const BADGE_META: Record<QueueBadge, { label: string; cls: string; icon: typeof ShieldAlert }> = {
  review: { label: 'Review', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20', icon: ShieldAlert },
  low: { label: 'Low', cls: 'bg-red-50 text-red-600 ring-red-600/20', icon: ShieldX },
  untagged: { label: 'Untagged', cls: 'bg-gray-100 text-gray-600 ring-gray-500/10', icon: TagIcon },
}

function badgePill(badge: QueueBadge) {
  const { label, cls, icon: Icon } = BADGE_META[badge]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${cls}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
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

function taggingCommentBlock(company: Company) {
  if (company.tagging_comment.length === 0 && !company.tagging_action) return null

  const highSeverity = company.tagging_comment.some(line => HIGH_SEVERITY_LABELS.includes(line.label))
  const bg = highSeverity ? '#FFF5F5' : '#FFFBEB'
  const border = highSeverity ? '#FECACA' : '#F5D87A'

  return (
    <div className="mt-3 rounded-lg px-3.5 py-3" style={{ backgroundColor: bg, border: `1px solid ${border}` }}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs leading-none">🤖</span>
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#92400E' }}>Agent Note</span>
      </div>
      <div style={{ lineHeight: 1.6 }}>
        {company.tagging_comment.map((line, i) => (
          <p key={i} className="text-[13px]" style={{ color: '#92400E' }}>
            • {line.label} — {line.note}
          </p>
        ))}
        {company.tagging_action && (
          <p className="text-[13px] font-semibold" style={{ color: '#92400E' }}>
            → Action: {company.tagging_action}
          </p>
        )}
      </div>
    </div>
  )
}

const SORT_OPTIONS = [
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
  region: string
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

function RegionRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-[10px] font-bold uppercase tracking-widest shrink-0 w-32 text-ht-blue/40">Region</span>
      <div className="flex-1 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-ht-blue/5 text-ht-blue text-xs font-medium">
          {value}
          <button type="button" onClick={() => onChange('Not specified')} className="hover:text-red-600 transition-colors">
            <X className="w-3 h-3" />
          </button>
        </span>
      </div>
      <AddChipPopover options={REGIONS.filter(r => r !== value)} onPick={onChange} />
    </div>
  )
}

function QueueRow({
  item, expanded, onToggle, onApproved,
}: {
  item: QueueListItem
  expanded: boolean
  onToggle: () => void
  onApproved: () => void
}) {
  const { showToast } = useToast()
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
    showToast('success', 'Tags approved', `${company.name}'s classification has been saved as human-reviewed.`)
    onApproved()
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all overflow-hidden ${expanded ? 'border-l-4 border-l-ht-orange border-ht-blue/10' : 'border-ht-blue/10 hover:border-ht-blue/20 hover:shadow-md'}`}>
      <div onClick={onToggle} className="p-6 flex items-center justify-between gap-6 cursor-pointer">
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold text-ht-blue text-base">{item.name}</h3>
          <p className="text-sm text-ht-blue/60 mt-1 line-clamp-1">{item.description}</p>
          {expanded ? (company && taggingCommentBlock(company)) : primaryPills(item)}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col items-end gap-1.5">
            {badgePill(item.badge)}
            <span className={`text-xs flex items-center gap-1.5 ${item.stale ? 'text-red-500' : 'text-ht-blue/40'}`}>
              {item.stale && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
              {item.issue || formatDate(item.updated_at)}
            </span>
            {item.issue && <span className="text-xs text-ht-blue/40">{formatDate(item.updated_at)}</span>}
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
              <AxisRow label={AXIS_LABELS.industry} values={state.industry} options={TAXONOMY.industry}
                onChange={v => setState(s => s && { ...s, industry: v })} />
              <AxisRow label="Stage" values={state.construction_stage} options={TAXONOMY.construction_stage}
                onChange={v => setState(s => s && { ...s, construction_stage: v })} />
              <AxisRow label={AXIS_LABELS.product_type} values={state.product_type} options={TAXONOMY.product_type}
                onChange={v => setState(s => s && { ...s, product_type: v })} />
              <AxisRow label="Tech Type" values={state.technology_type} options={TAXONOMY.technology_type}
                onChange={v => setState(s => s && { ...s, technology_type: v })} />
              <RegionRow value={state.region} onChange={v => setState(s => s && { ...s, region: v })} />

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
  const [items, setItems] = useState<QueueListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('updated_desc')
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>(
    Object.keys(TAXONOMY).reduce((acc, key) => ({ ...acc, [key]: false }), {})
  )

  const filterKey = JSON.stringify(filters)

  async function load(p = page) {
    setLoading(true)
    const data = await fetchQueue({ page: p, pageSize: 20, search, status, sort, filters })
    setItems(data.items)
    setTotal(data.total)
    setLoading(false)
  }

  useEffect(() => { load(1); setPage(1) }, [search, status, filterKey, sort])
  useEffect(() => { load() }, [page])

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
        status={status}
        setStatus={setStatus}
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
          <p className="text-sm text-ht-blue/50">
            <span className="font-semibold text-ht-blue">{total}</span> companies awaiting review
          </p>
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
