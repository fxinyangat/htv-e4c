import { useSearchParams } from 'react-router-dom'
import { Sparkles, Clock, AlertCircle } from 'lucide-react'
import DarkBackdrop from '../components/DarkBackdrop'

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3a7.4 7.4 0 0 1-11-3.9H1.08v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.07 14.19a7.2 7.2 0 0 1 0-4.38V6.72H1.08a12 12 0 0 0 0 10.56l3.99-3.09Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.08 6.72l3.99 3.09A7.16 7.16 0 0 1 12 4.77Z" />
    </svg>
  )
}

export default function Login() {
  const [searchParams] = useSearchParams()
  const isPending = searchParams.get('pending') === '1'
  const error = searchParams.get('error')

  function handleGoogleSignIn() {
    window.location.href = '/api/auth/google'
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

          {isPending && (
            <div className="flex items-start gap-3 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3 mb-5">
              <Clock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-200/90">
                Your account is pending approval. An admin needs to approve your access before you can sign in.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 mb-5">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-200/90">
                Sign-in failed. Please try again.
              </p>
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-2.5 py-3 bg-white text-ht-blue text-sm font-semibold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            <GoogleIcon /> Sign in with Google
          </button>
        </div>

        <p className="text-xs text-white/25 mt-6">Hometeam Ventures</p>
      </div>
    </DarkBackdrop>
  )
}
