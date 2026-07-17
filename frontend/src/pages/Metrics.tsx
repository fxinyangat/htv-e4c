import { useEffect, useState } from 'react'
import { TrendingUp, Loader2 } from 'lucide-react'
import { fetchPipelineStats, formatRelativeTime, PipelineStats } from '../api'

const TAGGED_BY_LABELS: Record<string, string> = {
  NA: 'Untagged',
  'AI Agent': 'AI-tagged, awaiting review',
  Human: 'Human-reviewed',
}

const SCORE_BAND_LABELS: Record<string, string> = {
  high: 'High',
  needs_review: 'Needs Review',
  insufficient: 'Insufficient Data',
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border border-ht-blue/10 shadow-sm p-6">
      <p className="text-xs font-bold text-ht-blue/40 uppercase tracking-widest">{label}</p>
      <p className="text-4xl font-display font-bold text-ht-orange mt-2">{value}</p>
    </div>
  )
}

function BreakdownSection({ title, data, total }: { title: string; data: { label: string; value: number }[]; total: number }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="bg-white rounded-2xl border border-ht-blue/10 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-ht-blue uppercase tracking-wide">{title}</h3>
        <span className="text-xs text-ht-blue/40">{total.toLocaleString()} total</span>
      </div>
      <div className="space-y-2.5">
        {data.map(row => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-sm text-ht-blue/80">{row.label}</span>
              <span className="text-sm font-semibold text-ht-blue shrink-0">{row.value.toLocaleString()}</span>
            </div>
            <div className="w-full bg-ht-orange/10 rounded-full overflow-hidden h-3">
              <div
                className="h-full bg-ht-orange rounded-full"
                style={{ width: `${Math.max((row.value / max) * 100, row.value > 0 ? 3 : 0)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Metrics() {
  const [stats, setStats] = useState<PipelineStats | null>(null)

  useEffect(() => { fetchPipelineStats().then(setStats) }, [])

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-6 h-6 text-ht-orange animate-spin mb-3" />
        <p className="text-sm text-ht-blue/40">Loading pipeline stats…</p>
      </div>
    )
  }

  const taggedByData = Object.entries(stats.taggedBy)
    .map(([key, value]) => ({ label: TAGGED_BY_LABELS[key] ?? key, value }))
    .sort((a, b) => b.value - a.value)

  const scoreBandData = (['high', 'needs_review', 'insufficient'] as const)
    .map(key => ({ label: SCORE_BAND_LABELS[key], value: stats.scoreBands[key] }))

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-semibold text-ht-blue tracking-tight">Portfolio Metrics</h1>
        <p className="text-sm text-ht-blue/40 mt-1">Internal — pipeline & tagging health, last synced {formatRelativeTime(stats.cached_at)}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatTile label="AI Tagging Coverage" value={`${Math.round(stats.coverageRate * 100)}%`} />
        <StatTile label="Avg Review Queue Score" value={stats.avgScore} />
        <StatTile label="Reviewed, Last 7 Days" value={stats.reviewedLast7Days} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <BreakdownSection title="Tagging Status" data={taggedByData} total={stats.total} />
        <BreakdownSection title="Review Queue Score Bands" data={scoreBandData} total={stats.total} />
      </div>

      <div className="flex items-center gap-3 bg-white/50 border border-dashed border-ht-blue/20 rounded-2xl p-5">
        <TrendingUp className="w-5 h-5 text-ht-blue/30 shrink-0" />
        <p className="text-sm text-ht-blue/50">
          Portfolio company performance metrics - more details coming soon !
        </p>
      </div>
    </div>
  )
}
