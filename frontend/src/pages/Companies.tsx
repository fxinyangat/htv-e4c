import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X, Plus, Building2, SearchX, Loader2, ShieldCheck, ShieldAlert, ShieldX, Pencil, Trash2 } from 'lucide-react'
import { fetchCompanies, fetchCompany, createCompany, deleteCompany, isRealCompanyId, TAXONOMY, AXIS_LABELS, ORIGIN_CATEGORIES, CompanyListItem, Company, Priority } from '../api'
import { useChatContext } from '../context/ChatContext'
import { useToast } from '../context/ToastContext'

import CompanyDetailPanel from '../components/CompanyDetailPanel'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import FilterSidebar from '../components/FilterSidebar'
import { isValidDomain } from '../utils/validation'

const PRIORITY_BADGE: Record<Priority, { label: string; cls: string; icon: typeof ShieldCheck }> = {
  high: { label: 'High', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', icon: ShieldCheck },
  review: { label: 'Review', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20', icon: ShieldAlert },
  low: { label: 'Low', cls: 'bg-red-50 text-red-600 ring-red-600/20', icon: ShieldX },
}

function priorityBadge(priority: Priority) {
  const { label, cls, icon: Icon } = PRIORITY_BADGE[priority]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${cls}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const PRIMARY_AXES: [string, string][] = [
  ['industry', 'Industry'],
  ['construction_stage', 'Stage'],
  ['product_type', 'Product'],
]

function primaryPills(item: CompanyListItem) {
  const shown = PRIMARY_AXES
    .map(([axis, label]) => {
      const field = (item as unknown as Record<string, string | null>)[axis]
      return field ? { label, value: field.split('; ')[0] } : null
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

const SORT_OPTIONS = [
  { value: 'updated_desc', label: 'Recently Modified' },
  { value: 'created_desc', label: 'Date Added (Newest)' },
  { value: 'name_asc', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' },
  { value: 'confidence_asc', label: 'AI Confidence (Lowest)' },
  { value: 'tags_desc', label: 'Tags (Most)' },
  { value: 'status_pending', label: 'Needs Review' },
]

export default function Companies() {
  const { showToast } = useToast()
  const [items, setItems] = useState<CompanyListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('updated_desc')
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Company | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const { setContext } = useChatContext()
  const [showAdd, setShowAdd] = useState(false)
  const [taggingIds, setTaggingIds] = useState<Set<string>>(new Set())
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>(
    Object.keys(TAXONOMY).reduce((acc, key) => ({ ...acc, [key]: false }), {})
  )

  useEffect(() => {
    const companyId = searchParams.get('id')
    if (companyId) {
      setLoading(true)
      fetchCompany(companyId).then(data => {
        setSelected(data)
        setContext(data.id, data.name)
      }).catch(err => {
        console.error("Failed to fetch linked company:", err)
      }).finally(() => {
        setLoading(false)
      })
    } else {
      setSelected(null)
      setContext(null, null)
    }
  }, [searchParams, setContext])

  const handleCloseCard = () => {
    // Remove 'id' param from URL without refreshing the page
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('id')
    setSearchParams(newParams, { replace: true })
  }
  const loadRef = useRef<(p?: number) => Promise<void>>()

  const filterKey = JSON.stringify(filters)

  async function load(p = page) {
    setLoading(true)
    const data = await fetchCompanies({ page: p, pageSize: 10, search, status, sort, filters })
    setItems(data.items)
    setTotal(data.total)
    setLoading(false)
  }

  loadRef.current = load

  useEffect(() => { load(1); setPage(1) }, [search, status, filterKey, sort])
  useEffect(() => { load() }, [page])

  useEffect(() => {
    if (taggingIds.size === 0) return
    const interval = setInterval(async () => {
      const done: string[] = []
      await Promise.all([...taggingIds].map(async id => {
        const company = await fetchCompany(id)
        if (company.tags.length > 0) done.push(id)
      }))
      if (done.length > 0) {
        setTaggingIds(prev => {
          const next = new Set(prev)
          done.forEach(id => next.delete(id))
          return next
        })
        loadRef.current?.()
      }
    }, 2500)
    return () => clearInterval(interval)
  }, [taggingIds])

  async function selectCompany(id: string) {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('id', id)
    setSearchParams(newParams)
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

  function removeFilter(axis: string, tag: string) { toggleFilter(axis, tag) }
  function clearFilters() { setFilters({}) }

  async function refreshSelected() {
    if (!selected) return
    const updated = await fetchCompany(selected.id)
    setSelected(updated)
    load()
  }

  const [deleteTarget, setDeleteTarget] = useState<CompanyListItem | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  async function confirmDelete() {
    if (!deleteTarget) return
    if (isRealCompanyId(deleteTarget.id)) {
      setDeleteTarget(null)
      showToast('info', 'Not connected yet', 'Deleting Notion-backed companies isn\'t wired up yet.')
      return
    }
    setDeleteLoading(true)
    await deleteCompany(deleteTarget.id)
    setDeleteLoading(false)
    showToast('success', 'Company deleted', `${deleteTarget.name} has been removed from the database.`)
    if (selected?.id === deleteTarget.id) handleCloseCard()
    setDeleteTarget(null)
    load()
  }

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

      {/* main content */}
      <div className="flex-1 min-w-0 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xl">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-ht-blue/40" />
                </div>
                <input
                  type="text"
                  placeholder="Search companies..."
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
                style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em' }}
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                onClick={() => setShowAdd(true)}
                className="px-5 py-2.5 bg-ht-blue text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-ht-blue/30 hover:-translate-y-0.5 transition-all ml-auto flex items-center gap-2"
              >
                <Plus className="w-4 h-4 stroke-[3]" /> Add Company
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-500">{total.toLocaleString()} companies</p>
              {activeFilterCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-gray-400">Filtered by:</span>
                  {Object.entries(filters).flatMap(([axis, tags]) =>
                    tags.map(tag => (
                      <span key={`${axis}:${tag}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-ht-blue/5 text-ht-blue rounded-full text-xs font-semibold">
                        {AXIS_LABELS[axis]}: {tag}
                        <button onClick={() => removeFilter(axis, tag)} className="hover:text-ht-orange transition-colors flex items-center justify-center">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))
                  )}
                  <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-600 ml-1">Clear all</button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-ht-blue/10">
                <Loader2 className="w-8 h-8 text-ht-orange animate-spin mb-4" />
                <p className="text-sm font-medium text-ht-blue/50 animate-pulse">Loading companies...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 px-6 text-center bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-ht-blue/20">
                <div className="w-20 h-20 mb-6 rounded-full bg-white flex items-center justify-center shadow-sm border border-ht-blue/5">
                  {(search || activeFilterCount > 0) ? (
                    <SearchX className="w-8 h-8 text-ht-blue/30" />
                  ) : (
                    <Building2 className="w-8 h-8 text-ht-blue/30" />
                  )}
                </div>
                <h3 className="text-xl font-display font-semibold text-ht-blue mb-2">
                  {(search || activeFilterCount > 0) ? "No companies found" : "No companies yet"}
                </h3>
                <p className="text-sm text-ht-blue/60 max-w-md mb-8 leading-relaxed">
                  {(search || activeFilterCount > 0) 
                    ? `Your search did not match any companies. Try adjusting your filters or search terms.`
                    : `Get started by adding your first company data.`}
                </p>
                <div className="flex items-center gap-4">
                  {(search || activeFilterCount > 0) && (
                    <button 
                      onClick={() => { clearFilters(); setSearchInput(''); setSearch(''); }} 
                      className="px-6 py-2.5 bg-white border border-ht-blue/10 text-ht-blue text-sm font-semibold rounded-xl hover:bg-ht-blue/5 transition-all shadow-sm"
                    >
                      Clear search
                    </button>
                  )}
                  <button
                    onClick={() => setShowAdd(true)}
                    className="px-6 py-2.5 bg-ht-blue text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-ht-blue/30 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" /> Add Company
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map(item => (
                  <div
                    key={item.id}
                    onClick={() => selectCompany(item.id)}
                    className={`group bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all p-6 flex items-center justify-between gap-6 cursor-pointer
                      ${selected?.id === item.id ? 'border-l-4 border-l-ht-orange border-ht-blue/10 bg-ht-blue/[0.03]' : 'border-ht-blue/10 hover:border-ht-blue/20'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-semibold text-ht-blue text-base">{item.name}</h3>
                      <p className="text-sm text-ht-blue/60 mt-1 line-clamp-1">{item.description}</p>
                      {primaryPills(item)}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden group-hover:flex items-center gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); selectCompany(item.id) }}
                          className="p-1.5 rounded-lg border border-ht-blue/10 text-ht-blue/50 hover:text-ht-blue hover:bg-ht-blue/5 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteTarget(item) }}
                          className="p-1.5 rounded-lg border border-ht-blue/10 text-ht-blue/50 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {taggingIds.has(item.id)
                          ? <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-ht-blue/5 text-ht-blue/50 animate-pulse ring-1 ring-inset ring-ht-blue/10">Tagging…</span>
                          : priorityBadge(item.priority)}
                        <span className="text-xs text-ht-blue/40">{formatDate(item.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {total > 10 && (
                  <div className="flex items-center justify-between px-2 py-3">
                    <span className="text-xs text-ht-blue/40">Page {page} of {Math.ceil(total / 10)}</span>
                    <div className="flex gap-2">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="px-3 py-1 text-xs border border-ht-blue/10 rounded-lg hover:bg-white disabled:opacity-40">Previous</button>
                      <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 10)}
                        className="px-3 py-1 text-xs border border-ht-blue/10 rounded-lg hover:bg-white disabled:opacity-40">Next</button>
                    </div>
                  </div>
                )}
              </div>
            )}
      </div>

      {/* company detail panel */}
      {selected && (
        <CompanyDetailPanel
          company={selected}
          onClose={handleCloseCard}
          onDeleted={() => { handleCloseCard(); load() }}
          onUpdated={refreshSelected}
        />
      )}

      {/* delete confirmation */}
      {deleteTarget && (
        <ConfirmDeleteModal
          name={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          loading={deleteLoading}
        />
      )}

      {/* add company modal */}
      {showAdd && <AddCompanyModal onClose={() => setShowAdd(false)} onAdded={(id) => { setShowAdd(false); setTaggingIds(prev => new Set([...prev, id])); load() }} />}
    </div>
  )
}

const modalInputCls = "w-full px-4 py-2.5 text-sm bg-white border border-ht-blue/10 rounded-xl focus:outline-none focus:border-ht-orange/40 focus:ring-4 focus:ring-ht-orange/10 transition-all text-ht-blue placeholder:text-ht-blue/30 shadow-sm"
const modalInputErrorCls = "w-full px-4 py-2.5 text-sm bg-white border border-red-300 rounded-xl focus:outline-none focus:border-red-400 focus:ring-4 focus:ring-red-100 transition-all text-ht-blue placeholder:text-ht-blue/30 shadow-sm"
const modalSelectArrowStyle = {
  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.85rem center',
  backgroundSize: '1em',
} as const

function AddCompanyModal({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [description, setDescription] = useState('')
  const [originSource, setOriginSource] = useState('')
  const [originCategory, setOriginCategory] = useState('')
  const [extId, setExtId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)

  const nameError = name.trim() ? '' : 'Company name is required'
  const domainError = domain.trim() ? (!isValidDomain(domain) ? 'Enter a valid domain (e.g. buildtech.ai)' : '') : 'Domain is required'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (nameError || domainError) return
    setLoading(true)
    setError('')
    try {
      const result = await createCompany({
        name: name.trim(),
        domain: domain.trim(),
        description: description.trim() || undefined,
        origin_source: originSource.trim() || undefined,
        origin_category: originCategory || undefined,
        external_id: extId.trim() || undefined,
      })
      showToast('info', 'Added as demo data', `${name.trim()} was added to local demo data only — creating real Notion companies isn't wired up yet, so it won't appear in this list.`)
      onAdded(result.id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add company'
      setError(message)
      showToast('error', 'Failed to add company', message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ht-blue/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-8 py-5 border-b border-ht-blue/10 shrink-0">
          <h2 className="text-xl font-display font-semibold text-ht-blue tracking-tight">Add New Company</h2>
          <button onClick={onClose} className="text-ht-blue/40 hover:text-ht-blue transition-colors flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form id="add-company-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-ht-blue/70 mb-1.5">Company Name <span className="text-ht-orange">*</span></label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. BuildTech AI"
              className={touched && nameError ? modalInputErrorCls : modalInputCls}
            />
            {touched && nameError && <p className="text-xs text-red-500 mt-1.5">{nameError}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-ht-blue/70 mb-1.5">Domain <span className="text-ht-orange">*</span></label>
            <input
              type="text"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="e.g. buildtech.ai"
              className={touched && domainError ? modalInputErrorCls : modalInputCls}
            />
            {touched && domainError && <p className="text-xs text-red-500 mt-1.5">{domainError}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-ht-blue/70 mb-1.5">Description <span className="text-ht-blue/40 font-normal">— optional</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what the company does, its technology, and target market..."
              rows={4}
              className={`${modalInputCls} resize-none`}
            />
            <p className="text-[11px] font-medium text-ht-blue/40 mt-1.5">The AI will use this description to generate tags automatically.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-ht-blue/70 mb-1.5">Origin Source <span className="text-ht-blue/40 font-normal">— optional</span></label>
              <input
                type="text"
                value={originSource}
                onChange={e => setOriginSource(e.target.value)}
                placeholder="e.g. LinkedIn, Email"
                className={modalInputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ht-blue/70 mb-1.5">Origin Category <span className="text-ht-blue/40 font-normal">— optional</span></label>
              <select
                value={originCategory}
                onChange={e => setOriginCategory(e.target.value)}
                className={`${modalInputCls} appearance-none pr-10 cursor-pointer ${originCategory ? '' : 'text-ht-blue/30'}`}
                style={modalSelectArrowStyle}
              >
                <option value="">Select category</option>
                {ORIGIN_CATEGORIES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-ht-blue/70 mb-1.5">Company ID <span className="text-ht-blue/40 font-normal">— optional</span></label>
            <input
              type="text"
              value={extId}
              onChange={e => setExtId(e.target.value)}
              placeholder="e.g. HV-1001 (auto-generated if blank)"
              className={modalInputCls}
            />
          </div>
          {error && <p className="text-sm font-medium text-red-500">{error}</p>}
        </form>
        <div className="flex gap-3 px-8 py-5 border-t border-ht-blue/10 shrink-0">
          <button
            type="submit"
            form="add-company-form"
            disabled={loading || !name.trim() || !domain.trim()}
            className="flex-1 py-3 bg-ht-blue text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-ht-blue/30 transition-all disabled:opacity-50"
          >
            {loading ? 'Adding & tagging...' : 'Add & Auto-tag'}
          </button>
          <button type="button" onClick={onClose}
            className="px-6 py-3 bg-white border border-ht-blue/10 text-ht-blue text-sm font-semibold rounded-xl hover:bg-ht-blue/5 transition-all shadow-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
