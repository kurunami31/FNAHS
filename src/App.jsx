import { Routes, Route, Navigate } from 'react-router-dom'
import { useApp } from './context/AppContext'
import Layout from './components/Layout'
import ChatWidget from './components/ChatWidget'
import Home from './pages/Home'
import Feed from './pages/Feed'
import Events from './pages/Events'
import IdCard from './pages/IdCard'
import Settings from './pages/Settings'
import Staff from './pages/Staff'
import Login from './pages/Login'
import Signup from './pages/Signup'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'

export default function App() {
  const { user, toasts } = useApp()

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/app"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Home />} />
          <Route path="feed" element={<Feed />} />
          <Route path="events" element={<Events />} />
          <Route path="idcard" element={<IdCard />} />
          <Route path="settings" element={<Settings />} />
          <Route path="staff" element={<Staff />} />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>

      {user && <ChatWidget />}

      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`}>
            {t.kind === 'ok' && <CheckCircle2 size={18} color="var(--ok)" />}
            {t.kind === 'err' && <AlertCircle size={18} color="var(--danger)" />}
            {t.kind === 'info' && <Info size={18} color="var(--accent)" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function RequireAuth({ children }) {
  const { user, authLoading } = useApp()
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="typing" style={{ transform: 'scale(1.6)' }}>
          <i /><i /><i />
        </div>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}
