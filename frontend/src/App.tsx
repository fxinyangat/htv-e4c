import { Routes, Route, useLocation } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Queue from './pages/Queue'
import Companies from './pages/Companies'
import Metrics from './pages/Metrics'
import InboundStats from './pages/InboundStats'
import AppLayout from './components/AppLayout'
import ChatWidget from './components/ChatWidget'
import { RequireAuth, RequireRole } from './components/RequireAuth'
import { ChatProvider } from './context/ChatContext'
import { ToastProvider } from './context/ToastContext'
import { TaxonomyProvider } from './context/TaxonomyContext'
import { AuthProvider } from './context/AuthContext'

export default function App() {
  const location = useLocation()

  return (
    <ToastProvider>
      <AuthProvider>
        <TaxonomyProvider>
          <ChatProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                  <Route path="/inbound" element={<InboundStats />} />
                  <Route element={<RequireRole allowed={['Admin', 'Analyst']} />}>
                    <Route path="/queue" element={<Queue />} />
                    <Route path="/companies" element={<Companies />} />
                    <Route path="/metrics" element={<Metrics />} />
                  </Route>
                </Route>
              </Route>
            </Routes>
            {/* Mounted globally (not just inside AppLayout) so it's reachable from Landing without
                navigating into the internal app — hidden only on /login. */}
            {location.pathname !== '/login' && <ChatWidget />}
          </ChatProvider>
        </TaxonomyProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
