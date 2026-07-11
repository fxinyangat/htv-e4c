import { BarChart3 } from 'lucide-react'

export default function InboundStats() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-display font-semibold text-ht-blue tracking-tight">
        Inbound Stats
        <span className="ml-3 text-lg font-normal text-ht-blue/40">— coming soon</span>
      </h1>

      <div className="flex flex-col items-center justify-center py-32 px-6 text-center bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-ht-blue/20">
        <BarChart3 className="w-8 h-8 text-ht-blue/30 mb-4" />
        <p className="text-sm text-ht-blue/50">Inbound stats will appear here.</p>
      </div>
    </div>
  )
}
