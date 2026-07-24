import { Outlet, NavLink, Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useChatContext } from '../context/ChatContext'

const navLink = ({ isActive }: { isActive: boolean }) =>
  `group relative px-1 py-4 text-sm font-medium transition-colors ${
    isActive ? 'text-ht-blue' : 'text-ht-blue/60 hover:text-ht-blue'
  }`

const NAV_LINKS = [
  { to: '/queue', label: 'Review Queue' },
  { to: '/companies', label: 'Companies' },
  { to: '/inbound', label: 'Inbound Stats' },
  { to: '/metrics', label: 'Portfolio Metrics' },
]

export default function AppLayout() {
  const { openChat } = useChatContext()

  return (
    <div className="min-h-screen bg-ht-bg font-sans text-ht-blue selection:bg-ht-orange/20 selection:text-ht-orange">
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-ht-blue/10 px-8 flex items-center gap-8">
        <Link to="/" className="flex flex-col items-center justify-center mr-4">
          <span
            className="font-display font-extrabold italic text-2xl bg-clip-text text-transparent leading-none tracking-tight"
            style={{ backgroundImage: 'linear-gradient(90deg, #FF411E 0%, #C12E5B 44%, #1525A8 100%)' }}
          >
            hometeam
          </span>
          <span className="font-display font-semibold text-[0.55rem] text-[#000899] uppercase tracking-[0.2em] leading-none mt-0.5">Ventures</span>
        </Link>
        <div className="flex-1" />
        <div className="flex gap-6 h-full">
          {NAV_LINKS.map(link => (
            <NavLink key={link.to} to={link.to} className={navLink}>
              {({ isActive }) => (
                <>
                  {link.label}
                  <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-ht-orange rounded-t-full transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                </>
              )}
            </NavLink>
          ))}
        </div>
        <button
          onClick={openChat}
          className="px-4 py-2 bg-ht-orange text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-lg hover:shadow-ht-orange/30 transition-all flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" /> Ask AI
        </button>
      </nav>
      <main className="max-w-[1400px] mx-auto px-8 py-10">
        <Outlet />
      </main>
    </div>
  )
}
