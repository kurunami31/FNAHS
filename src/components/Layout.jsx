import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Home as HomeIcon,
  Newspaper,
  Archive as ArchiveIcon,
  CalendarDays,
  HeartPulse,
  Users,
  CreditCard,
  ShieldCheck,
  Settings2,
  Search,
  Moon,
  Sun,
  AlertTriangle,
  X,
  Facebook,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { can } from '../rbac'
import { api } from '../lib/api'
import { initials } from '../lib/format'
import AccountSheet from './AccountSheet'
import SearchOverlay from './SearchOverlay'
import NotificationsBell from './NotificationsBell'

const NAV = [
  { to: '/app', label: 'Home', icon: HomeIcon, end: true },
  { to: '/app/feed', label: 'Feed', icon: Newspaper },
  { to: '/app/archive', label: 'Archive', icon: ArchiveIcon },
  { to: '/app/events', label: 'Events', icon: CalendarDays },
  { to: '/app/health', label: 'Health', icon: HeartPulse },
  { to: '/app/directory', label: 'Directory', icon: Users },
  { to: '/app/idcard', label: 'My ID', icon: CreditCard },
]

const SECTION = [
  ['/app/feed', 'feed'],
  ['/app/archive', 'archive'],
  ['/app/events', 'events'],
  ['/app/health', 'health centre'],
  ['/app/directory', 'directory'],
  ['/app/idcard', 'my id'],
  ['/app/staff', 'staff tools'],
  ['/app/admin', 'admin'],
  ['/app', 'home'],
]

// Mobile keeps only the five core destinations; the rest live in the account
// sheet's "More" section so the bottom bar stays uncluttered.
const MOBILE_TABS = [
  { to: '/app', label: 'Home', icon: HomeIcon, end: true },
  { to: '/app/feed', label: 'Feed', icon: Newspaper },
  { to: '/app/events', label: 'Events', icon: CalendarDays },
  { to: '/app/idcard', label: 'My ID', icon: CreditCard },
]

export default function Layout() {
  const { user, theme, setTheme, logout, toast } = useApp()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const navigate = useNavigate()
  const loc = useLocation()

  const canScan = can(user, 'attendance.scan')
  const canConsole = can(user, 'console.access')
  const canDirectory = can(user, 'directory.view')
  const section = (SECTION.find(([p]) => loc.pathname.startsWith(p)) || ['', 'FNAHS PULSO'])[1]
  const [dbNotice, setDbNotice] = useState(false)

  useEffect(() => {
    const check = () => setDbNotice(api.dbStatus === 'missing' && api.isSupabase)
    check()
    window.addEventListener('fnahs:dbstatus', check)
    return () => window.removeEventListener('fnahs:dbstatus', check)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setSheetOpen(false)
        setSearchOpen(false)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((s) => !s)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleLogout = async () => {
    setSheetOpen(false)
    await logout()
    toast('Logged out — rest well, and see you next duty.')
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <div className="fold-panels" aria-hidden="true" />
      {dbNotice && (
        <div className="db-banner" role="alert">
          <AlertTriangle size={16} />
          <p>
            <b>Database not set up yet.</b> Run <code>supabase/schema.sql</code> in your Supabase SQL editor to
            enable the community pages.
          </p>
          <button className="icon-btn" onClick={() => setDbNotice(false)} aria-label="Dismiss" title="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
      <aside className="seal-rail">
        <NavLink to="/app" className="seal" aria-label="FNAHS home" title="FNAHS">
          <img src="/FNAHS.png" alt="FNAHS seal" />
        </NavLink>
        <nav className="rail-nav" aria-label="Primary">
          {NAV.filter(({ to }) => to !== '/app/directory' || canDirectory).map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `rail-link${isActive ? ' rail-link--on' : ''}`}
              aria-label={label}
              title={label}
            >
              <Icon size={21} strokeWidth={2} />
            </NavLink>
          ))}
          {canScan && (
            <NavLink
              to="/app/staff"
              className={({ isActive }) => `rail-link${isActive ? ' rail-link--on' : ''}`}
              aria-label="Staff tools"
              title="Staff tools"
            >
              <ShieldCheck size={21} strokeWidth={2} />
            </NavLink>
          )}
          {canConsole && (
            <NavLink
              to="/app/admin"
              className={({ isActive }) => `rail-link${isActive ? ' rail-link--on' : ''}`}
              aria-label="Admin console"
              title="Admin console"
            >
              <Settings2 size={21} strokeWidth={2} />
            </NavLink>
          )}
        </nav>
        <div className="rail-foot">
          <button
            className="rail-avatar"
            onClick={() => setSheetOpen(true)}
            aria-label="Account settings"
            title="Account"
          >
            {user?.avatar_url ? <img src={user.avatar_url} alt="" /> : initials(user?.full_name)}
          </button>
        </div>
      </aside>

      <header className="topbar">
        <NavLink to="/app" className="brand-mobile" aria-label="FNAHS home">
          <img src="/FNAHS.png" alt="" />
          <span>FNAHS PULSO</span>
        </NavLink>
        <div className="top-ctx">
          FNAHS PULSO <b>/</b> {section}
        </div>
        <div className="spacer" />
        <NotificationsBell />
        <button className="icon-btn" onClick={() => setSearchOpen(true)} aria-label="Search" title="Search (Ctrl+K)">
          <Search size={19} />
        </button>
        <button className="icon-btn" onClick={() => setTheme()} aria-label="Toggle theme" title="Toggle theme">
          {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="app-foot">
        <a href="https://www.facebook.com/fnahspulsodorsu" target="_blank" rel="noreferrer" className="app-foot-link">
          <Facebook size={15} /> FNAHS PULSO on Facebook
        </a>
        <span className="app-foot-legal">
          © {new Date().getFullYear()} Faculty of Nursing and Allied Health Sciences · DOrSU
        </span>
      </footer>

      <nav className="tabbar" aria-label="Primary">
        {MOBILE_TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab${isActive ? ' tab--on' : ''}`}>
            <Icon size={21} />
            <span>{label}</span>
          </NavLink>
        ))}
        {canScan && (
          <NavLink to="/app/staff" className={({ isActive }) => `tab${isActive ? ' tab--on' : ''}`}>
            <ShieldCheck size={21} />
            <span>Staff</span>
          </NavLink>
        )}
        <button className="tab" onClick={() => setSheetOpen(true)} aria-label="Account & more" title="Account & more">
          <span className="avatar tab-avatar">
            {user?.avatar_url ? <img src={user.avatar_url} alt="" /> : initials(user?.full_name)}
          </span>
          <span>Me</span>
        </button>
      </nav>

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}

      {sheetOpen && (
        <>
          <div className="sheet-backdrop" onClick={() => setSheetOpen(false)} aria-hidden="true" />
          <AccountSheet onClose={() => setSheetOpen(false)} onLogout={handleLogout} />
        </>
      )}
    </div>
  )
}
