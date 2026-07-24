import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { Sparkles, LogOut } from 'lucide-react'
import { useChatContext } from '../context/ChatContext'
import { useAuthContext } from '../context/AuthContext'

const navLink = ({ isActive }: { isActive: boolean }) =>
  `group relative flex items-center h-full px-1 text-sm font-medium transition-colors ${
    isActive ? 'text-ht-blue' : 'text-ht-blue/60 hover:text-ht-blue'
  }`

const NAV_LINKS = [
  { to: '/queue', label: 'Review Queue', roles: ['Admin', 'Analyst'] },
  { to: '/companies', label: 'Companies', roles: ['Admin', 'Analyst'] },
  { to: '/inbound', label: 'Inbound Stats', roles: ['Admin', 'Analyst', 'Investor'] },
  { to: '/metrics', label: 'Portfolio Metrics', roles: ['Admin', 'Analyst'] },
]

export default function AppLayout() {
  const { openChat } = useChatContext()
  const { user, logout } = useAuthContext()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const visibleLinks = NAV_LINKS.filter(link => !user || link.roles.includes(user.role))

  return (
    <div className="min-h-screen bg-ht-bg font-sans text-ht-blue selection:bg-ht-orange/20 selection:text-ht-orange">
      {/* h-[72px] is explicit rather than content-driven — items-center otherwise sizes the row
          to its tallest child, so a role with fewer (or zero) visible nav links would make the
          whole bar visibly shrink instead of just having emptier middle space. */}
      <nav className="sticky top-0 z-50 h-[72px] bg-white/70 backdrop-blur-md border-b border-ht-blue/10 px-8 flex items-center gap-8">
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
          {visibleLinks.map(link => (
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
        {user && (
          <div className="flex items-center gap-2 pl-3 ml-1 border-l border-ht-blue/10">
            <div className="relative group/avatar">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover shrink-0 cursor-default"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-ht-orange/15 text-ht-orange text-sm font-bold flex items-center justify-center shrink-0 cursor-default">
                  {(user.name || user.email || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="pointer-events-none absolute right-0 top-full mt-2 w-56 rounded-xl bg-ht-blue text-white px-3.5 py-2.5 opacity-0 scale-95 origin-top-right group-hover/avatar:opacity-100 group-hover/avatar:scale-100 transition-all duration-150 z-10 shadow-lg">
                <p className="text-sm font-semibold truncate">{user.name}</p>
                {user.email && <p className="text-xs text-white/60 truncate mt-0.5">{user.email}</p>}
                <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-ht-orange/20 text-ht-orange text-[10px] font-bold uppercase tracking-wider">
                  {user.role}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-1.5 rounded-lg text-ht-blue/40 hover:text-ht-blue hover:bg-ht-blue/5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </nav>
      <main className="max-w-[1400px] mx-auto px-8 py-10">
        <Outlet />
      </main>
    </div>
  )
}
