import { useEffect, useState } from 'react'
import { TrendingUp, Loader2, Info } from 'lucide-react'
import { fetchPipelineStats, formatRelativeTime, PipelineStats } from '../api'

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group/tooltip">
      <Info className="w-3.5 h-3.5 text-ht-blue/30 hover:text-ht-blue/60 cursor-help transition-colors" />
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 rounded-lg bg-ht-blue text-white text-xs leading-snug px-3 py-2 opacity-0 scale-95 origin-bottom group-hover/tooltip:opacity-100 group-hover/tooltip:scale-100 transition-all duration-150 z-10 shadow-lg normal-case tracking-normal font-normal">
        {text}
      </span>
    </span>
  )
}

const TAGGED_BY_LABELS: Record<string, string> = {
  NA: 'Untagged',
  'AI Agent': 'AI-tagged, awaiting review',
  Human: 'Human-reviewed',
}

// Reuses the same status→color mapping as the Review Queue's tagged-by icons, so a company's
// tagging state reads the same color everywhere in the app.
const TAGGED_BY_COLORS: Record<string, string> = {
  NA: '#94a3b8',
  'AI Agent': '#4f46e5',
  Human: '#059669',
}

function TaggedByPieChart({ data, total }: { data: { key: string; label: string; value: number }[]; total: number }) {
  const RADIUS = 60
  const STROKE = 28
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  let offsetSoFar = 0

  return (
    <div className="bg-white rounded-2xl border border-ht-blue/10 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-bold text-ht-blue uppercase tracking-wide">Tagging Status</h3>
          <InfoTooltip text="How every company in the pipeline is currently tagged: untagged, AI-tagged and awaiting human review, or already reviewed by a person." />
        </div>
        <span className="text-xs text-ht-blue/40">{total.toLocaleString()} total</span>
      </div>
      <div className="flex items-center gap-8">
        <svg width={2 * (RADIUS + STROKE / 2)} height={2 * (RADIUS + STROKE / 2)} viewBox={`0 0 ${2 * (RADIUS + STROKE / 2)} ${2 * (RADIUS + STROKE / 2)}`} className="shrink-0 -rotate-90">
          {data.map(row => {
            const fraction = total ? row.value / total : 0
            const dash = fraction * CIRCUMFERENCE
            const circle = (
              <circle
                key={row.key}
                cx={RADIUS + STROKE / 2}
                cy={RADIUS + STROKE / 2}
                r={RADIUS}
                fill="none"
                stroke={TAGGED_BY_COLORS[row.key] ?? '#94a3b8'}
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                strokeDashoffset={-offsetSoFar}
              />
            )
            offsetSoFar += dash
            return circle
          })}
        </svg>
        <div className="flex-1 space-y-2.5">
          {data.map(row => (
            <div key={row.key} className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TAGGED_BY_COLORS[row.key] ?? '#94a3b8' }} />
              <span className="text-sm text-ht-blue/80 flex-1">{row.label}</span>
              <span className="text-sm font-semibold text-ht-blue">{row.value.toLocaleString()}</span>
              <span className="text-xs text-ht-blue/40 w-12 text-right">{total ? Math.round((row.value / total) * 100) : 0}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const SCORE_BAND_LABELS: Record<string, string> = {
  high: 'High',
  needs_review: 'Needs Review',
  insufficient: 'Insufficient Data',
}

function StatTile({ label, value, info }: { label: string; value: string | number; info?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-ht-blue/10 shadow-sm p-6">
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-bold text-ht-blue/40 uppercase tracking-widest">{label}</p>
        {info && <InfoTooltip text={info} />}
      </div>
      <p className="text-4xl font-display font-bold text-ht-orange mt-2">{value}</p>
    </div>
  )
}

function BreakdownSection({ title, data, total, info }: { title: string; data: { label: string; value: number }[]; total: number; info?: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="bg-white rounded-2xl border border-ht-blue/10 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-bold text-ht-blue uppercase tracking-wide">{title}</h3>
          {info && <InfoTooltip text={info} />}
        </div>
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
    .map(([key, value]) => ({ key, label: TAGGED_BY_LABELS[key] ?? key, value }))
    .sort((a, b) => b.value - a.value)

  const scoreBandData = (['high', 'needs_review', 'insufficient'] as const)
    .map(key => ({ label: SCORE_BAND_LABELS[key], value: stats.scoreBands[key] }))

  const humanReviewedRate = stats.total ? (stats.taggedBy['Human'] ?? 0) / stats.total : 0
  const aiTaggedRate = stats.total ? (stats.taggedBy['AI Agent'] ?? 0) / stats.total : 0

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-semibold text-ht-blue tracking-tight">Portfolio Metrics</h1>
        <p className="text-sm text-ht-blue/40 mt-1">Internal — pipeline & tagging health, last synced {formatRelativeTime(stats.cached_at)}</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatTile
          label="Human Reviewed"
          value={`${(humanReviewedRate * 100).toFixed(1)}%`}
          info="Share of all companies in the pipeline that have been reviewed and tagged by a person."
        />
        <StatTile
          label="AI Tagged"
          value={`${(aiTaggedRate * 100).toFixed(1)}%`}
          info="Share of all companies auto-tagged by the AI agent that are still awaiting human review."
        />
        <StatTile
          label="Avg Review Queue Score"
          value={stats.avgScore}
          info="Average data-completeness score (0–100) across all companies, based on description length, location, domain, and how many tagging axes have real (non-filler) values. This measures profile completeness, not deal quality."
        />
        <StatTile
          label="Reviewed, Last 7 Days"
          value={stats.reviewedLast7Days}
          info="Number of companies a human has reviewed and updated in the last 7 days."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TaggedByPieChart data={taggedByData} total={stats.total} />
        <BreakdownSection
          title="Review Queue Score Bands"
          data={scoreBandData}
          total={stats.total}
          info="Companies grouped by data-completeness score: High (≥80), Needs Review (50–79), Insufficient Data (<50)."
        />
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
