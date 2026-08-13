import { useEffect, useState } from 'react'
import { Save, LogOut, Info } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { initials } from '../lib/format'

export default function Settings() {
  const { user, theme, setTheme, toast, logout, isDemo, orgFull } = useApp()
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) setForm({ full_name: user.full_name || '', program: user.program || '', year_level: user.year_level || '' })
  }, [user])

  const save = async () => {
    setSaving(true)
    try {
      const updated = await api.upsertProfile({ id: user.id, ...form })
      toast('Saved')
      // best-effort refresh
      window.dispatchEvent(new CustomEvent('fnahs-profile-updated', { detail: updated }))
    } catch (e) {
      toast('Could not save', 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">SETTINGS</h1>
      <p className="page-sub">Profile, preferences, and account.</p>

      <div className="settings-grid">
        <div className="card">
          <h2 className="page-title" style={{ fontSize: '0.95rem', marginBottom: 18 }}>PROFILE</h2>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18 }}>
            <div className="avatar" style={{ width: 64, height: 64, fontSize: 22 }}>
              {user?.avatar_url ? <img src={user.avatar_url} alt="" /> : initials(user?.full_name)}
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>{user?.full_name || 'Student'}</div>
              <div className="badge badge--done" style={{ marginTop: 4 }}>{user?.role || 'student'} · {isDemo ? 'demo' : 'live'}</div>
            </div>
          </div>
          <div className="field">
            <label>Full name</label>
            <input value={form.full_name || ''} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="field">
            <label>Program</label>
            <select value={form.program || ''} onChange={(e) => setForm({ ...form, program: e.target.value })}>
              <option value="">Select program…</option>
              {api.PROGRAMS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Year level</label>
            <select value={form.year_level || ''} onChange={(e) => setForm({ ...form, year_level: e.target.value })}>
              {['', '1', '2', '3', '4', '5'].map((y) => (
                <option key={y} value={y}>{y === '' ? 'Select year…' : y}</option>
              ))}
            </select>
          </div>
          <button className="btn btn--primary" disabled={saving} onClick={save}>
            <Save size={16} /> {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>

        <div className="card">
          <h2 className="page-title" style={{ fontSize: '0.95rem', marginBottom: 6 }}>PREFERENCES</h2>
          <div className="settings-row">
            <div className="sr-txt">
              <h4>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</h4>
              <p>Match the terminal aesthetic — or go bright.</p>
            </div>
            <label className="switch">
              <input type="checkbox" checked={theme === 'dark'} onChange={() => setTheme()} />
              <span className="track" />
            </label>
          </div>
        </div>

        <div className="card">
          <h2 className="page-title" style={{ fontSize: '0.95rem', marginBottom: 6 }}>ACCOUNT</h2>
          <div className="settings-row">
            <div className="sr-txt">
              <h4>Email</h4>
              <p>{user?.email || 'student@fnahs.edu.ph'}</p>
            </div>
            <span className="chip">verified</span>
          </div>
          <div className="settings-row">
            <div className="sr-txt">
              <h4>Sign out</h4>
              <p>End your session on this device.</p>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={logout}>
              <LogOut size={14} /> Log out
            </button>
          </div>
          <div className="settings-row">
            <div className="sr-txt">
              <h4>Organization</h4>
              <p>{orgFull}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--muted)', fontSize: '0.8rem', marginTop: 10 }}>
            <Info size={14} />
            {isDemo
              ? 'Running in demo mode — data lives in this browser. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to go live.'
              : 'Connected to Supabase — data is stored in the org database.'}
          </div>
        </div>
      </div>
    </div>
  )
}
