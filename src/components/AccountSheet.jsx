import { useEffect, useRef, useState } from 'react'
import { Save, LogOut, X, AtSign, ShieldCheck, Loader2, Camera } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { roleLabel, positionLabel } from '../rbac'
import { api } from '../lib/api'
import { initials } from '../lib/format'
import { PROGRAMS, ORG_FULL } from '../lib/mock'

export default function AccountSheet({ onClose, onLogout }) {
  const { user, setUser, toast } = useApp()
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const saveTimer = useRef(null)

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  useEffect(() => {
    if (user) setForm({ full_name: user.full_name || '', program: user.program || '', year_level: user.year_level || '', section: user.section || '', avatar_url: user.avatar_url || '' })
  }, [user])

  const onPick = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) {
      toast('Please pick an image file', 'err')
      return
    }
    if (f.size > 512 * 1024) {
      toast('Image too large — keep it under 512 KB', 'err')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const size = 256
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        const side = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
        setForm((f2) => ({ ...f2, avatar_url: canvas.toDataURL('image/jpeg', 0.85) }))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(f)
  }

  const onNameChange = (v) => {
    setForm((f2) => ({ ...f2, full_name: v }))
    // Staff/leaders keep a plain name field — changes save automatically.
      if (user?.role !== 'student') {
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        if (v.trim()) save()
      }, 800)
    }
  }

  const save = async () => {
    if (!form.full_name?.trim()) {
      toast('Name cannot be empty', 'err')
      return
    }
    setSaving(true)
    try {
      const updated = await api.upsertProfile({ id: user.id, full_name: form.full_name.trim(), program: form.program, year_level: form.year_level, section: form.section, avatar_url: form.avatar_url || null })
      if (updated) setUser({ ...user, ...updated })
      toast('Profile saved')
    } catch (e) {
      console.error(e)
      toast('Could not save the profile', 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sheet" role="dialog" aria-label="Account settings">
      <div className="sheet-head">
        {user?.role !== 'student' ? (
          <div className="avatar avatar--ring">
            {user?.avatar_url ? <img src={user.avatar_url} alt="" /> : initials(user?.full_name)}
          </div>
        ) : (
          <button className="avatar avatar--ring avatar-btn" onClick={() => fileRef.current?.click()} aria-label="Change photo">
            {user?.avatar_url ? <img src={user.avatar_url} alt="" /> : initials(user?.full_name)}
          </button>
        )}
        <div className="who">
          <h3>{user?.full_name || 'Member'}</h3>
          <span>
            {user?.role || 'student'}
            {user?.role !== 'student' ? '' : ` · ${user?.program || 'no program'}`}
          </span>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close settings">
          <X size={18} />
        </button>
      </div>

      <div className="sheet-sec">
        <h4>Profile</h4>
        {user?.role === 'student' && (
          <div className="mm-pic">
            <button
              className="avatar avatar--ring avatar-btn"
              style={{ width: 56, height: 56, fontSize: 16, flex: 'none' }}
              onClick={() => fileRef.current?.click()}
              aria-label="Change photo"
            >
              {form.avatar_url ? <img src={form.avatar_url} alt="" /> : initials(form.full_name)}
            </button>
            <div>
              <button className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
                <Camera size={14} /> {form.avatar_url ? 'Change photo' : 'Add photo'}
              </button>
              {form.avatar_url && (
                <button className="btn btn--link btn--sm" onClick={() => setForm((f2) => ({ ...f2, avatar_url: '' }))}>
                  Remove photo
                </button>
              )}
              <div className="mm-pic-hint">Squared JPG/PNG up to 512 KB — used on your ID card and in the directory.</div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
          </div>
        )}
        <div className="field">
          <label>Full name</label>
          <input value={form.full_name || ''} onChange={(e) => onNameChange(e.target.value)} autoComplete="name" />
          {user?.role !== 'student' && <div className="mm-pic-hint">Changes are saved automatically.</div>}
        </div>
        {user?.role === 'student' && (
          <>
            <div className="field">
              <label>Program</label>
              <select value={form.program || ''} onChange={(e) => setForm({ ...form, program: e.target.value })}>
                {PROGRAMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Year level</label>
              <select value={form.year_level || ''} onChange={(e) => setForm({ ...form, year_level: e.target.value })}>
                {['1', '2', '3', '4'].map((y) => (
                  <option key={y} value={y}>Year {y}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Section</label>
              <select value={form.section || ''} onChange={(e) => setForm({ ...form, section: e.target.value })}>
                <option value="">Select section…</option>
                {['A', 'B', 'C', 'D'].map((s) => (
                  <option key={s} value={s}>Section {s}</option>
                ))}
              </select>
            </div>
          </>
        )}
        {user?.role === 'student' && (
          <button className="btn btn--primary btn--block" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Save profile
          </button>
        )}
      </div>

      <div className="sheet-sec">
        <h4>Account</h4>
        <div className="sheet-row">
          <div className="sr-txt">
            <h5>Email</h5>
            <p>{user?.email || 'demo account'}</p>
          </div>
          <AtSign size={16} style={{ color: 'var(--muted)' }} />
        </div>
        <div className="sheet-row">
          <div className="sr-txt">
            <h5>Role</h5>
            <p>{roleLabel(user?.role)} — {accessText(user)}</p>
          </div>
          <ShieldCheck size={16} style={{ color: 'var(--muted)' }} />
        </div>
        {!!user?.positions?.length && (
          <div className="sheet-row">
            <div className="sr-txt">
              <h5>Position</h5>
              <p>{user.positions.map(positionLabel).join(' · ')}</p>
            </div>
            <ShieldCheck size={16} style={{ color: 'var(--muted)' }} />
          </div>
        )}
        <div className="sheet-row">
          <div className="sr-txt">
            <h5>Organization</h5>
            <p>{ORG_FULL}</p>
          </div>
        </div>
        <button className="btn btn--ghost btn--block" onClick={onLogout} style={{ marginTop: 16 }}>
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </div>
  )
}

function accessText(u) {
  if (!u) return 'member access'
  if (u.role === 'superadmin') return 'owner access'
  if (u.role === 'moderator') return 'moderator tools'
  if (u.positions?.length) return 'officer tools'
  return 'member access'
}