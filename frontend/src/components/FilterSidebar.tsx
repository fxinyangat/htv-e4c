import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { AXIS_LABELS, TAGGED_BY_OPTIONS, TAGGED_BY_LABELS } from '../api'
import { useTaxonomy } from '../context/TaxonomyContext'

interface Props {
  filters: Record<string, string[]>
  toggleFilter: (axis: string, tag: string) => void
  expandedCats: Record<string, boolean>
  setExpandedCats: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void
  activeFilterCount: number
  clearFilters: () => void
}

export default function FilterSidebar({
  filters, toggleFilter, expandedCats, setExpandedCats, activeFilterCount, clearFilters,
}: Props) {
  const { taxonomy } = useTaxonomy()
  return (
    <aside className="w-56 shrink-0 flex flex-col bg-white/50 backdrop-blur-sm rounded-2xl border border-ht-blue/5 shadow-sm overflow-hidden h-[calc(100vh-8rem)] sticky top-24">
      <div className="p-5 flex-1 overflow-y-auto custom-scrollbar space-y-8">
        <div>
          <p className="text-[10px] font-bold text-ht-blue/40 uppercase tracking-widest mb-3">Tagged By</p>
          <button
            onClick={() => setExpandedCats(prev => ({ ...prev, tagged_by: !prev.tagged_by }))}
            className="w-full flex items-center justify-between mb-2 group"
          >
            <p className="text-xs font-semibold text-ht-blue/60 group-hover:text-ht-blue transition-colors">Review status</p>
            <span className="text-ht-blue/40 flex items-center">{expandedCats.tagged_by ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</span>
          </button>
          {expandedCats.tagged_by && (
            <div className="space-y-1">
              {TAGGED_BY_OPTIONS.map(tag => {
                const active = filters.tagged_by?.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => toggleFilter('tagged_by', tag)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium transition-all flex items-start gap-2
                      ${active ? 'bg-ht-blue/5 text-ht-blue' : 'text-ht-blue/60 hover:bg-white hover:shadow-sm'}`}
                  >
                    <span className={`w-4 h-4 mt-0.5 rounded border shrink-0 flex items-center justify-center transition-colors
                      ${active ? 'bg-ht-orange border-ht-orange text-white shadow-inner shadow-black/10' : 'border-ht-blue/20 bg-white'}`}>
                      {active && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                    <span className="leading-tight pt-0.5">{TAGGED_BY_LABELS[tag]}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-ht-blue/40 uppercase tracking-widest">Filter by Tag</p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs font-medium text-ht-orange hover:text-ht-orange/80">Clear all</button>
            )}
          </div>
          {Object.entries(taxonomy).map(([axis, tags]) => (
            <div key={axis} className="mb-4 last:mb-0">
              <button
                onClick={() => setExpandedCats(prev => ({ ...prev, [axis]: !prev[axis] }))}
                className="w-full flex items-center justify-between mb-2 group"
              >
                <p className="text-xs font-semibold text-ht-blue/60 group-hover:text-ht-blue transition-colors">{AXIS_LABELS[axis]}</p>
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
