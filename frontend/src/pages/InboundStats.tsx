import { useEffect, useState } from 'react'
import { Printer, ChevronDown, Check, Loader2 } from 'lucide-react'
import { fetchInboundStats, InboundStats as InboundStatsData, InboundBreakdown } from '../api'

interface QuarterOption {
  label: string
  from: string
  to: string
}

// Last 8 calendar quarters, newest first, as real { from, to } date ranges for the backend.
function generateQuarters(count: number): QuarterOption[] {
  const now = new Date()
  const currentQuarterIndex = now.getFullYear() * 4 + Math.floor(now.getMonth() / 3)
  const quarters: QuarterOption[] = []
  for (let i = 0; i < count; i++) {
    const idx = currentQuarterIndex - i
    const year = Math.floor(idx / 4)
    const q = idx % 4 // 0-indexed
    const from = new Date(year, q * 3, 1)
    const to = new Date(year, q * 3 + 3, 0)
    quarters.push({
      label: `Q${q + 1} ${year}`,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    })
  }
  return quarters
}

const QUARTER_OPTIONS = generateQuarters(8)

// "Q1 2026" / "Q4 2025 – Q1 2026" (contiguous range) / "3 quarters selected" (non-contiguous)
function periodLabel(selected: string[]): string {
  if (selected.length === 0) return 'No quarters selected'
  if (selected.length === 1) return selected[0]
  const ordered = QUARTER_OPTIONS.map(q => q.label).filter(l => selected.includes(l))
  const isContiguous = ordered.every((l, i) => {
    if (i === 0) return true
    const prevIdx = QUARTER_OPTIONS.findIndex(q => q.label === ordered[i - 1])
    const idx = QUARTER_OPTIONS.findIndex(q => q.label === l)
    return idx === prevIdx + 1
  })
  if (isContiguous) return `${ordered[ordered.length - 1]} – ${ordered[0]}`
  return `${selected.length} quarters selected`
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl border border-ht-blue/10 shadow-sm p-6">
      <p className="text-xs font-bold text-ht-blue/40 uppercase tracking-widest">{label}</p>
      <p className="text-5xl font-display font-bold text-ht-orange mt-2">{value.toLocaleString()}</p>
    </div>
  )
}

function BreakdownSection({ title, data, total, thick = false }: { title: string; data: InboundBreakdown[]; total: number; thick?: boolean }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="bg-white rounded-2xl border border-ht-blue/10 shadow-sm p-6 break-inside-avoid">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-ht-blue uppercase tracking-wide">{title}</h3>
        <span className="text-xs text-ht-blue/40">{total.toLocaleString()} total</span>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-ht-blue/30 italic py-4 text-center">No data for this period</p>
      ) : (
        <div className="space-y-2.5">
          {data.map(row => (
            <div key={row.label}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-sm text-ht-blue/80 truncate">{row.label}</span>
                <span className="text-sm font-semibold text-ht-blue shrink-0">{row.value.toLocaleString()}</span>
              </div>
              <div className={`w-full bg-ht-orange/10 rounded-full overflow-hidden ${thick ? 'h-3' : 'h-2'}`}>
                <div
                  className="h-full bg-ht-orange rounded-full"
                  style={{ width: `${Math.max((row.value / max) * 100, row.value > 0 ? 3 : 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function QuarterPicker({ selected, onChange }: { selected: string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false)

  function toggle(label: string) {
    if (selected.includes(label)) {
      if (selected.length === 1) return // keep at least one quarter selected
      onChange(selected.filter(s => s !== label))
    } else {
      onChange([...selected, label])
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-white rounded-xl border border-ht-blue/10 shadow-sm px-4 py-2.5 text-sm font-semibold text-ht-blue hover:bg-ht-blue/5 transition-colors"
      >
        {periodLabel(selected)}
        <ChevronDown className={`w-4 h-4 text-ht-blue/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          onMouseLeave={() => setOpen(false)}
          className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-ht-blue/10 overflow-hidden z-10 py-1.5"
        >
          <p className="px-3 pt-1.5 pb-2 text-[10px] font-bold text-ht-blue/40 uppercase tracking-widest">Select quarters to aggregate</p>
          {QUARTER_OPTIONS.map(q => {
            const active = selected.includes(q.label)
            return (
              <button
                key={q.label}
                onClick={() => toggle(q.label)}
                className="w-full text-left px-3 py-2 text-sm text-ht-blue hover:bg-ht-blue/5 flex items-center gap-2.5"
              >
                <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${active ? 'bg-ht-orange border-ht-orange text-white' : 'border-ht-blue/20 bg-white'}`}>
                  {active && <Check className="w-3 h-3 stroke-[3]" />}
                </span>
                {q.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function InboundStats() {
  const [selectedQuarters, setSelectedQuarters] = useState<string[]>([QUARTER_OPTIONS[0].label])
  const [stats, setStats] = useState<InboundStatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const ranges = QUARTER_OPTIONS
      .filter(q => selectedQuarters.includes(q.label))
      .map(q => ({ from: q.from, to: q.to }))
    fetchInboundStats(ranges).then(data => {
      setStats(data)
      setLoading(false)
    })
  }, [selectedQuarters])

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-ht-blue tracking-tight">Inbound Stats</h1>
          <p className="text-sm text-ht-blue/40 mt-1">Deal flow breakdown for {periodLabel(selectedQuarters)}</p>
        </div>
        <div className="flex items-center gap-3 no-print">
          <QuarterPicker selected={selectedQuarters} onChange={setSelectedQuarters} />
          <button
            onClick={() => window.print()}
            disabled={!stats}
            className="px-4 py-2.5 bg-ht-blue text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-ht-blue/30 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> Export as PDF
          </button>
        </div>
      </div>

      {loading || !stats ? (
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="w-6 h-6 text-ht-orange animate-spin mb-3" />
          <p className="text-sm text-ht-blue/40">Loading inbound stats…</p>
        </div>
      ) : (
        <>
          {/* Letterhead — print-only, since the on-screen nav/toolbar above is hidden when printing */}
          <div className="hidden print-only flex-col gap-3 pb-4 mb-2 border-b-2 border-ht-blue/10">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span
                  className="font-display font-extrabold italic text-4xl bg-clip-text text-transparent leading-none"
                  style={{ backgroundImage: 'linear-gradient(90deg, #FF411E 0%, #C12E5B 44%, #1525A8 100%)' }}
                >
                  hometeam
                </span>
                <span className="font-display font-semibold text-xs text-[#000899] uppercase tracking-[0.3em] leading-none mt-1">Ventures</span>
              </div>
              <div className="text-right">
                <p className="text-lg font-display font-bold text-ht-blue">Inbound Stats Report</p>
                <p className="text-sm text-ht-blue/50 mt-0.5">{periodLabel(selectedQuarters)}</p>
                <p className="text-xs text-ht-blue/30 mt-0.5">Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              </div>
            </div>
            <div className="h-1 w-full rounded-full" style={{ backgroundImage: 'linear-gradient(90deg, #FF411E 0%, #C12E5B 44%, #1525A8 100%)' }} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <StatTile label="Inbound Total" value={stats.inboundTotal} />
            <StatTile label="Female Founders" value={stats.femaleFounders} />
            <StatTile label="BIPOC Founders" value={stats.bipocFounders} />
          </div>

          <BreakdownSection title="Construction Stage" data={stats.constructionStage} total={stats.inboundTotal} thick />
          <div className="grid grid-cols-2 gap-4">
            {stats.constructionStageExtra.map(row => (
              <div key={row.label} className="bg-white rounded-2xl border border-ht-blue/10 shadow-sm p-6 flex items-center justify-between break-inside-avoid">
                <span className="text-sm text-ht-blue/70">{row.label}</span>
                <span className="text-2xl font-display font-bold text-ht-blue">{row.value}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <BreakdownSection title="Region" data={stats.region} total={stats.inboundTotal} />
            <BreakdownSection title="Lead Source" data={stats.source} total={stats.inboundTotal} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <BreakdownSection title="Industry Type" data={stats.industry} total={stats.inboundTotal} thick />
            <BreakdownSection title="Technology Type" data={stats.technologyType} total={stats.inboundTotal} thick />
          </div>

          <BreakdownSection title="Product Type" data={stats.productType} total={stats.inboundTotal} />
          <BreakdownSection title="Diversity Stats" data={stats.diversity} total={stats.inboundTotal} thick />
        </>
      )}
    </div>
  )
}
