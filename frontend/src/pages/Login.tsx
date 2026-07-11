import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import DarkBackdrop from '../components/DarkBackdrop'
import { isValidEmail } from '../utils/validation'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState(false)

  const emailError = email.trim() ? (!isValidEmail(email) ? 'Enter a valid email address' : '') : 'Email is required'
  const passwordError = password ? '' : 'Password is required'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (emailError || passwordError) return
    setLoading(true)
    setTimeout(() => navigate('/'), 500)
  }

  return (
    <DarkBackdrop>
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-ht-orange/90 shadow-lg shadow-ht-orange/30 flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <span
            className="font-display font-extrabold italic text-2xl bg-clip-text text-transparent leading-none tracking-tight"
            style={{ backgroundImage: 'linear-gradient(90deg, #FF411E 0%, #C12E5B 44%, #1525A8 100%)' }}
          >
            hometeam
          </span>
          <span className="font-display font-semibold text-[0.6rem] text-white/50 uppercase tracking-[0.25em] leading-none mt-1">Ventures</span>
        </div>

        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8">
          <h1 className="text-2xl font-display font-bold text-white">Welcome back</h1>
          <p className="text-sm text-white/50 mt-1 mb-6">Sign in to your Hometeam account</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@hometeam.vc"
                  className={`w-full pl-10 pr-4 py-2.5 text-sm bg-white/5 border rounded-xl focus:outline-none focus:ring-4 transition-all text-white placeholder:text-white/25 ${
                    touched && emailError ? 'border-red-400/60 focus:border-red-400/60 focus:ring-red-400/10' : 'border-white/10 focus:border-ht-orange/50 focus:ring-ht-orange/10'
                  }`}
                />
              </div>
              {touched && emailError && <p className="text-xs text-red-400 mt-1.5">{emailError}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Password</label>
                <button type="button" className="text-xs font-medium text-ht-orange hover:text-ht-orange/80 transition-colors">Forgot password?</button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-10 py-2.5 text-sm bg-white/5 border rounded-xl focus:outline-none focus:ring-4 transition-all text-white placeholder:text-white/25 ${
                    touched && passwordError ? 'border-red-400/60 focus:border-red-400/60 focus:ring-red-400/10' : 'border-white/10 focus:border-ht-orange/50 focus:ring-ht-orange/10'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {touched && passwordError && <p className="text-xs text-red-400 mt-1.5">{passwordError}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-ht-orange text-white text-sm font-semibold rounded-xl shadow-lg shadow-ht-orange/30 hover:shadow-ht-orange/50 hover:-translate-y-0.5 transition-all disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-xs text-white/25 mt-6">Hometeam Ventures · Internal platform</p>
      </div>
    </DarkBackdrop>
  )
}
