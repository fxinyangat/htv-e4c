import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Queue from './pages/Queue'
import Companies from './pages/Companies'
import Metrics from './pages/Metrics'
import InboundStats from './pages/InboundStats'
import AppLayout from './components/AppLayout'
import { ChatProvider } from './context/ChatContext'
import { ToastProvider } from './context/ToastContext'
import { TaxonomyProvider } from './context/TaxonomyContext'

export default function App() {
  return (
    <ToastProvider>
      <TaxonomyProvider>
        <ChatProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route element={<AppLayout />}>
              <Route path="/queue" element={<Queue />} />
              <Route path="/companies" element={<Companies />} />
              <Route path="/metrics" element={<Metrics />} />
              <Route path="/inbound" element={<InboundStats />} />
            </Route>
          </Routes>
        </ChatProvider>
      </TaxonomyProvider>
    </ToastProvider>
  )
}
