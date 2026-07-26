import { Link } from 'react-router-dom'
import { Ban } from 'lucide-react'
import DarkBackdrop from '../components/DarkBackdrop'

export default function NotFound() {
  return (
    <DarkBackdrop>
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-ht-orange/90 shadow-lg shadow-ht-orange/30 flex items-center justify-center mb-6">
          <Ban className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-3xl font-display font-bold text-white">Page Not Found</h1>
        <p className="text-sm text-white/50 mt-2 max-w-sm">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <Link
          to="/"
          className="mt-8 px-5 py-2.5 bg-ht-orange text-white text-sm font-semibold rounded-xl shadow-lg shadow-ht-orange/30 hover:shadow-ht-orange/50 hover:-translate-y-0.5 transition-all"
        >
          Back to home
        </Link>
      </div>
    </DarkBackdrop>
  )
}
