import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Home as HomeIcon,
  Newspaper,
  CalendarDays,
  Users,
  CreditCard,
  ShieldCheck,
  Settings2,
  Search,
  Moon,
  Sun,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { initials } from '../lib/format'
import AccountSheet from './AccountSheet'
import SearchOverlay from './SearchOverlay'

const NAV = [
  { to: '/app', label: 'Home', icon: HomeIcon, end: true },
  { to: '/app/feed', label: 'Feed', icon: Newspaper },
  { to: '/app/events', label: 'Events', icon: CalendarDays },
  { to: '/app/directory', label: 'Directory', icon: Users },
  { to: '/app/idcard', label: 'My ID', icon: CreditCard },
]

const SECTION = [
  ['/app/feed', 'feed'],
  ['/app/events', 'events'],
  ['/app/directory', 'directory'],
  ['/app/idcard', 'my id'],
  ['/app/staff', 'staff tools'],
  ['/app/admin', 'admin'],
  ['/app', 'home'],
]

const ADMIN_ROLES = ['superadmin', 'staff', 'moderator']

export default function Layout() {
  const { user, theme, setTheme, logout, toast } = useApp()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const navigate = useNavigate()
  const loc = useLocation()

  const isStaff = ['staff', 'superadmin'].includes(user?.role)
  const isAdmin = ADMIN_ROLES.includes(user?.role)
  const section = (SECTION.find(([p]) => loc.pathname.startsWith(p)) || [, 'FNAHS'])[1]

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
      <aside className="seal-rail">
        <NavLink to="/app" className="seal" aria-label="FNAHS home" title="FNAHS">
          <img src="/FNAHS.png" alt="FNAHS seal" />
        </NavLink>
        <nav className="rail-nav" aria-label="Primary">
          {NAV.map(({ to, label, icon: Icon, end }) => (
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
          {isStaff && (
            <NavLink
              to="/app/staff"
              className={({ isActive }) => `rail-link${isActive ? ' rail-link--on' : ''}`}
              aria-label="Staff tools"
              title="Staff tools"
            >
              <ShieldCheck size={21} strokeWidth={2} />
            </NavLink>
          )}
          {isAdmin && (
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
          <span>FNAHS</span>
        </NavLink>
        <div className="top-ctx">
          FNAHS <b>/</b> {section}
        </div>
        <div className="spacer" />
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

      <nav className="tabbar" aria-label="Primary">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab${isActive ? ' tab--on' : ''}`}>
            <Icon size={21} />
            <span>{label}</span>
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink to="/app/admin" className={({ isActive }) => `tab${isActive ? ' tab--on' : ''}`}>
            <Settings2 size={21} />
            <span>Admin</span>
          </NavLink>
        )}
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