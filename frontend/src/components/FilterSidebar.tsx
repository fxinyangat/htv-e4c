import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { TAXONOMY, AXIS_LABELS, REGIONS } from '../api'

export const STATUS_OPTIONS: { value: string; label: string; dot?: string }[] = [
  { value: 'all', label: 'All Companies' },
  { value: 'untagged', label: 'Untagged' },
  { value: 'pending', label: 'Pending Review', dot: 'bg-amber-500' },
  { value: 'reviewed', label: 'Recently Reviewed', dot: 'bg-emerald-500' },
]

interface Props {
  status: string
  setStatus: (v: string) => void
  filters: Record<string, string[]>
  toggleFilter: (axis: string, tag: string) => void
  expandedCats: Record<string, boolean>
  setExpandedCats: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void
  activeFilterCount: number
  clearFilters: () => void
}

export default function FilterSidebar({
  status, setStatus, filters, toggleFilter, expandedCats, setExpandedCats, activeFilterCount, clearFilters,
}: Props) {
  return (
    <aside className="w-56 shrink-0 flex flex-col bg-white/50 backdrop-blur-sm rounded-2xl border border-ht-blue/5 shadow-sm overflow-hidden h-[calc(100vh-8rem)] sticky top-24">
      <div className="p-5 flex-1 overflow-y-auto custom-scrollbar space-y-8">
        <div>
          <p className="text-[10px] font-bold text-ht-blue/40 uppercase tracking-widest mb-3">Status</p>
          <div className="space-y-1">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2
                  ${status === opt.value ? 'bg-ht-blue text-white shadow-md shadow-ht-blue/20' : 'text-ht-blue/70 hover:bg-ht-blue/5 hover:text-ht-blue'}`}
              >
                {opt.dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${opt.dot}`} />}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-ht-blue/40 uppercase tracking-widest">Filter by Tag</p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs font-medium text-ht-orange hover:text-ht-orange/80">Clear all</button>
            )}
          </div>
          {[...Object.entries(TAXONOMY), ['region', REGIONS] as [string, string[]]].map(([axis, tags]) => (
            <div key={axis} className="mb-4 last:mb-0">
              <button
                onClick={() => setExpandedCats(prev => ({ ...prev, [axis]: !prev[axis] }))}
                className="w-full flex items-center justify-between mb-2 group"
              >
                <p className="text-xs font-semibold text-ht-blue/60 group-hover:text-ht-blue transition-colors">{axis === 'region' ? 'Region' : AXIS_LABELS[axis]}</p>
                <span className="text-ht-blue/40 flex items-center">{expandedCats[axis] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</span>
              </button>
              {expandedCats[axis] && (
                <div className="space-y-1">
                  {tags.map(tag => {
                    const active = filters[axis]?.includes(tag)
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleFilter(axis, tag)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium transition-all flex items-start gap-2
                          ${active ? 'bg-ht-blue/5 text-ht-blue' : 'text-ht-blue/60 hover:bg-white hover:shadow-sm'}`}
                      >
                        <span className={`w-4 h-4 mt-0.5 rounded border shrink-0 flex items-center justify-center transition-colors
                          ${active ? 'bg-ht-orange border-ht-orange text-white shadow-inner shadow-black/10' : 'border-ht-blue/20 bg-white'}`}>
                          {active && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <span className="leading-tight pt-0.5">{tag}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
