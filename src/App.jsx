import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { useApp } from './context/AppContext'
import { can } from './rbac'
import Layout from './components/Layout'
import ChatWidget from './components/ChatWidget'
import PrivacyNotice from './components/PrivacyNotice'
import MaintenanceScreen from './components/MaintenanceScreen'

const Home = lazy(() => import('./pages/Home'))
const Feed = lazy(() => import('./pages/Feed'))
const Archive = lazy(() => import('./pages/Archive'))
const Events = lazy(() => import('./pages/Events'))
const HealthCentre = lazy(() => import('./pages/HealthCentre'))
const Directory = lazy(() => import('./pages/Directory'))
const IdCard = lazy(() => import('./pages/IdCard'))
const Staff = lazy(() => import('./pages/Staff'))
const Admin = lazy(() => import('./pages/Admin'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))

export default function App() {
  const { user, toasts, maintenance, authLoading } = useApp()
  const location = useLocation()
  const consentPending = !!user && !user.privacy_policy_accepted_at

  // Maintenance mode blocks everyone except console officers. It covers
  // login and signup too, so students see the maintenance page before any
  // form. Officers reach the login form via /login?officer=1 (linked from
  // the maintenance screen) and bypass the gate once signed in.
  const maintenanceActive = maintenance && !can(user, 'console.access')
  // The officer=1 escape only applies to a signed-out visitor on the login
  // page — once signed in, a non-officer is back on the maintenance gate.
  const officerLogin =
    !user && location.pathname === '/login' && new URLSearchParams(location.search).get('officer') === '1'
  if (maintenanceActive && !authLoading && !officerLogin) {
    return <MaintenanceScreen />
  }

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
          <Route path="archive" element={<Page><Archive /></Page>} />
          <Route path="events" element={<Page><Events /></Page>} />
          <Route path="health" element={<Page><HealthCentre /></Page>} />
          <Route path="directory" element={<Page><RequireScope scope="directory.view"><Directory /></RequireScope></Page>} />
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

function LoadScreen({ small }) {
  return (
    <div
      style={{
        minHeight: small ? undefined : '100vh',
        padding: small ? '70px 0' : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src="/loading-animation.gif"
        alt="Loading…"
        style={{ width: small ? 140 : 220, maxWidth: '70vw', height: 'auto' }}
      />
    </div>
  )
}

function Page({ children }) {
  return (
    <Suspense fallback={<LoadScreen small />}>
      {children}
    </Suspense>
  )
}

function RequireAuth({ children }) {
  const { user, authLoading } = useApp()
  if (authLoading) {
    return <LoadScreen />
  }
  if (!user) return <Navigate to="/login" replace />
  if (!user.privacy_policy_accepted_at) return <PrivacyNotice />
  return children
}

function RequireScope({ scope, children }) {
  const { user } = useApp()
  if (!can(user, scope)) return <Navigate to="/app" replace />
  return children
}