import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Home, Newspaper, CalendarDays, Stethoscope, CreditCard, Settings as SettingsIcon,
  ShieldCheck, Search, Moon, Sun, Menu, LogOut,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { initials } from '../lib/format'

const NAV = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/feed', label: 'Feed', icon: Newspaper },
  { to: '/app/events', label: 'Events', icon: CalendarDays },
  { to: '/app/florence', label: 'Florence', icon: Stethoscope },
  { to: '/app/idcard', label: 'My ID', icon: CreditCard },
]

export default function Layout() {
  const { user, theme, setTheme, logout, toast } = useApp()
  const [drawer, setDrawer] = useState(false)
  const navigate = useNavigate()

  const isStaff = user?.role === 'staff' || user?.role === 'superadmin'

  const handleLogout = async () => {
    await logout()
    toast('Logged out. See you next duty!')
    navigate('/login')
  }

  return (
    <div className="app-shell scanlines">
      {drawer && <div className="drawer-backdrop" onClick={() => setDrawer(false)} />}
      <aside className={`sidebar ${drawer ? 'sidebar--open' : ''}`}>
        <div className="sidebar-brand">
          <img src="/FNAHS.png" alt="FNAHS logo" />
          <div>
            <div className="brand-name">
              FNAHS<em>·</em>NURSING
            </div>
            <div className="brand-sub">community platform</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link--on' : ''}`}
              onClick={() => setDrawer(false)}
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}

          {isStaff && (
            <>
              <div className="nav-sep" />
              <div className="nav-label">staff tools</div>
              <NavLink
                to="/app/staff"
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link--on' : ''}`}
                onClick={() => setDrawer(false)}
              >
                <ShieldCheck size={19} />
                Attendance
              </NavLink>
            </>
          )}

          <div className="nav-sep" />
          <div className="nav-label">account</div>
          <NavLink
            to="/app/settings"
            className={({ isActive }) => `nav-link ${isActive ? 'nav-link--on' : ''}`}
            onClick={() => setDrawer(false)}
          >
            <SettingsIcon size={19} />
            Settings
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip" onClick={() => navigate('/app/settings')}>
            <div className="avatar">
              {user?.avatar_url ? <img src={user.avatar_url} alt="" /> : initials(user?.full_name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="u-name">{user?.full_name || 'Student'}</div>
              <div className="u-role">{user?.role || 'student'}</div>
            </div>
          </div>
          <button className="icon-btn" title="Log out" onClick={handleLogout}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <header className="topbar">
        <button className="icon-btn icon-btn--menu" onClick={() => setDrawer(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <div className="brand-mobile">
          <img src="/FNAHS.png" alt="" />
          FNAHS
        </div>
        <SearchBar />
        <button className="icon-btn" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme()}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}

function SearchBar() {
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const submit = (e) => {
    e.preventDefault()
    if (!q.trim()) return
    navigate(`/app/feed?q=${encodeURIComponent(q.trim())}`)
    setQ('')
  }
  return (
    <form className="search-box" onSubmit={submit}>
      <Search size={16} />
      <input
        placeholder="Search the feed…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search the feed"
      />
    </form>
  )
}
