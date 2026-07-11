import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sparkles, Send, ArrowRight } from 'lucide-react'
import DarkBackdrop from '../components/DarkBackdrop'
import { useToast } from '../context/ToastContext'

const NAV_LINKS = [
  { to: '/queue', label: 'Review Queue' },
  { to: '/companies', label: 'Companies' },
  { to: '/inbound', label: 'Inbound Stats' },
  { to: '/metrics', label: 'Portfolio Metrics' },
]

const SUGGESTIONS = [
  'Which companies need tagging?',
  'Show me top AI construction startups',
  'Any unreviewed deals this week?',
  "What's our pipeline look like?",
]

export default function Landing() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleAsk(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    showToast('info', 'Hometeam AI is coming soon', "This landing search isn't wired up yet — try the Ask AI widget inside the app for now.")
  }

  return (
    <DarkBackdrop>
      <div className="min-h-screen flex flex-col">
        <nav className="sticky top-0 z-20 px-8 py-4 flex items-center gap-8 border-b border-white/5 backdrop-blur-md">
          <Link to="/" className="flex flex-col items-center justify-center mr-4">
            <span
              className="font-display font-extrabold italic text-xl bg-clip-text text-transparent leading-none tracking-tight"
              style={{ backgroundImage: 'linear-gradient(90deg, #FF411E 0%, #C12E5B 44%, #1525A8 100%)' }}
            >
              hometeam
            </span>
            <span className="font-display font-semibold text-[0.5rem] text-white/50 uppercase tracking-[0.2em] leading-none mt-0.5">Ventures</span>
          </Link>
          <div className="flex-1" />
          <div className="flex gap-6">
            {NAV_LINKS.map(link => (
              <Link key={link.to} to={link.to} className="group relative px-1 py-1.5 text-sm font-medium text-white/60 hover:text-white transition-colors">
                {link.label}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ht-orange rounded-t-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
          <button
            onClick={() => inputRef.current?.focus()}
            className="px-4 py-2 bg-ht-orange text-white text-sm font-semibold rounded-xl shadow-lg shadow-ht-orange/20 hover:shadow-ht-orange/40 transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" /> Ask AI
          </button>
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/60 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-ht-orange" /> Hometeam AI — your deal intelligence layer
          </span>

          <h1 className="font-display font-bold text-white text-5xl sm:text-6xl leading-tight max-w-3xl">
            Find the next great deal.
          </h1>
          <p className="text-white/50 text-base mt-5 max-w-xl">
            Ask anything about your pipeline, companies, tags, and review queue — instantly.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-8 max-w-2xl">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          <form onSubmit={handleAsk} className="w-full max-w-xl mt-8">
            <div className="relative flex items-center bg-white/5 border border-white/10 rounded-2xl shadow-xl pl-4 pr-1.5 py-1.5">
              <Sparkles className="w-4 h-4 text-ht-orange shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Ask about your deal pipeline..."
                className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-ht-orange text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-ht-orange/30 transition-all shrink-0"
              >
                Ask AI <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 mt-14">
            {NAV_LINKS.map(link => (
              <button
                key={link.to}
                onClick={() => navigate(link.to)}
                className="flex items-center gap-1 text-sm text-white/30 hover:text-white/60 transition-colors"
              >
                {link.label} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </DarkBackdrop>
  )
}
