import { useEffect, useState } from 'react'
import { fetchMetrics, Metrics as MetricsType } from '../api'

export default function Metrics() {
  const [data, setData] = useState<MetricsType | null>(null)

  useEffect(() => { fetchMetrics().then(setData) }, [])

  if (!data) return <p className="text-ht-blue/40 text-sm">Loading...</p>

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-display font-semibold text-ht-blue tracking-tight">System Metrics</h1>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-xl shadow-ht-blue/5 p-6">
          <p className="text-[11px] font-bold text-ht-blue/50 uppercase tracking-widest">Total AI Tags</p>
          <p className="text-4xl font-display font-bold text-ht-blue mt-2">{data.total_ai_tags.toLocaleString()}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-xl shadow-ht-blue/5 p-6">
          <p className="text-[11px] font-bold text-ht-blue/50 uppercase tracking-widest">Override Rate</p>
          <p className={`text-4xl font-display font-bold mt-2 ${data.override_rate < 0.15 ? 'text-emerald-500' : data.override_rate < 0.3 ? 'text-amber-500' : 'text-ht-orange'}`}>
            {(data.override_rate * 100).toFixed(1)}%
          </p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-xl shadow-ht-blue/5 p-6">
          <p className="text-[11px] font-bold text-ht-blue/50 uppercase tracking-widest">Pending Review</p>
          <p className="text-4xl font-display font-bold text-ht-blue mt-2">{data.pending_review.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-xl shadow-ht-blue/5 p-8">
        <h2 className="text-sm font-bold text-ht-blue tracking-wide mb-6">Confidence by Source</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ht-blue/40 border-b border-ht-blue/10">
              <th className="pb-3 text-[10px] font-bold uppercase tracking-widest">Source</th>
              <th className="pb-3 text-[10px] font-bold uppercase tracking-widest">Avg</th>
              <th className="pb-3 text-[10px] font-bold uppercase tracking-widest">Min</th>
              <th className="pb-3 text-[10px] font-bold uppercase tracking-widest">Max</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ht-blue/5">
            {data.confidence_by_source.map(row => (
              <tr key={row.source} className="hover:bg-white transition-colors">
                <td className="py-4 font-semibold text-ht-blue capitalize">{row.source.replace('_', ' ')}</td>
                <td className="py-4 font-mono text-xs text-ht-blue/70">{(row.avg * 100).toFixed(1)}%</td>
                <td className="py-4 font-mono text-xs text-ht-blue/70">{(row.min * 100).toFixed(1)}%</td>
                <td className="py-4 font-mono text-xs text-ht-blue/70">{(row.max * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
