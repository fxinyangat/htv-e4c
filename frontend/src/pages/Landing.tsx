import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sparkles, Send, ArrowRight, LogOut } from 'lucide-react'
import DarkBackdrop from '../components/DarkBackdrop'
import { useChatContext } from '../context/ChatContext'
import { useAuthContext } from '../context/AuthContext'

const NAV_LINKS = [
  { to: '/queue', label: 'Review Queue' },
  { to: '/companies', label: 'Companies' },
  { to: '/inbound', label: 'Inbound Stats' },
  { to: '/metrics', label: 'Portfolio Metrics' },
]

const SUGGESTIONS = [
  'What construction tech categories do we track?',
  'Show me our top AI construction startups',
  'What do we know about BuildTech AI?',
  "What's our inbound deal flow been like this month?",
]

export default function Landing() {
  const navigate = useNavigate()
  const { setPendingQuery, openChat } = useChatContext()
  const { user, isLoading: authLoading, logout } = useAuthContext()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // ChatWidget is mounted globally and opens in place on this page — hand the query off via
  // context, ChatWidget picks it up on mount (or already-mounted state) and sends it for real.
  // Checked here, before ever opening the widget, rather than letting it open and then close
  // again once the request 401s — that produced a visible flash-open-then-redirect for signed
  // out visitors instead of a clean, immediate redirect. Ignored while authLoading is true (the
  // brief window right after the app loads, before /api/auth/me resolves) — otherwise a fast
  // click could see a stale "not logged in" state and bounce an actually-signed-in user.
  function handleAsk(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim() || authLoading) return
    if (!user) return navigate('/login')
    setPendingQuery(query.trim())
    openChat()
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
            onClick={() => {
              if (authLoading) return
              if (!user) return navigate('/login')
              openChat()
              inputRef.current?.focus()
            }}
            className="px-4 py-2 bg-ht-orange text-white text-sm font-semibold rounded-xl shadow-lg shadow-ht-orange/20 hover:shadow-ht-orange/40 transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" /> Ask Hometeam-AI
          </button>

          {!authLoading && (
            user ? (
              <div className="flex items-center gap-2 pl-3 ml-1 border-l border-white/10">
                <div className="relative group/avatar">
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-full object-cover shrink-0 cursor-default"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-ht-orange/20 text-ht-orange text-sm font-bold flex items-center justify-center shrink-0 cursor-default">
                      {(user.name || user.email || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="pointer-events-none absolute right-0 top-full mt-2 w-56 rounded-xl bg-white text-ht-blue px-3.5 py-2.5 opacity-0 scale-95 origin-top-right group-hover/avatar:opacity-100 group-hover/avatar:scale-100 transition-all duration-150 z-10 shadow-lg">
                    <p className="text-sm font-semibold truncate">{user.name}</p>
                    {user.email && <p className="text-xs text-ht-blue/50 truncate mt-0.5">{user.email}</p>}
                    <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-ht-orange/10 text-ht-orange text-[10px] font-bold uppercase tracking-wider">
                      {user.role}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => logout()}
                  title="Sign out"
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 border border-white/15 text-white/80 text-sm font-medium rounded-xl hover:bg-white/5 hover:text-white transition-colors"
              >
                Sign in
              </Link>
            )
          )}
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
