import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { useApp } from './context/AppContext'
import Layout from './components/Layout'
import ChatWidget from './components/ChatWidget'
import PrivacyNotice from './components/PrivacyNotice'

const Home = lazy(() => import('./pages/Home'))
const Feed = lazy(() => import('./pages/Feed'))
const Events = lazy(() => import('./pages/Events'))
const HealthCentre = lazy(() => import('./pages/HealthCentre'))
const Directory = lazy(() => import('./pages/Directory'))
const IdCard = lazy(() => import('./pages/IdCard'))
const Staff = lazy(() => import('./pages/Staff'))
const Admin = lazy(() => import('./pages/Admin'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))

export default function App() {
  const { user, toasts } = useApp()
  const consentPending = !!user && !user.privacy_policy_accepted_at

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
          <Route index element={<Page><Home /></Page>} />
          <Route path="feed" element={<Page><Feed /></Page>} />
          <Route path="events" element={<Page><Events /></Page>} />
          <Route path="health" element={<Page><HealthCentre /></Page>} />
          <Route path="directory" element={<Page><Directory /></Page>} />
          <Route path="idcard" element={<Page><IdCard /></Page>} />
          <Route path="staff" element={<Page><Staff /></Page>} />
          <Route path="admin" element={<Page><Admin /></Page>} />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>

      {user && !consentPending && <ChatWidget />}

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

function Page({ children }) {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '70px 0', display: 'flex', justifyContent: 'center' }}>
          <div className="typing">
            <i /><i /><i />
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
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
  if (!user.privacy_policy_accepted_at) return <PrivacyNotice />
  return children
}