import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, LogOut, X, AtSign, ShieldCheck, Loader2, Camera, Archive, HeartPulse, Users, Settings2, KeyRound, Smartphone } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { roleLabel, positionLabel, can } from '../rbac'
import { api } from '../lib/api'
import { initials } from '../lib/format'
import { PROGRAMS, ORG_FULL } from '../lib/mock'
import { BUILD_ID, DEVELOPER } from '../lib/build'
import Select from './Select'

export default function AccountSheet({ onClose, onLogout }) {
  const { user, setUser, toast } = useApp()
  const navigate = useNavigate()

  const go = (to) => {
    onClose()
    navigate(to)
  }
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const saveTimer = useRef(null)

  // ---- MFA (TOTP) state ----
  const isOfficer = can(user, 'attendance.scan') || can(user, 'console.access') || can(user, 'fees.manage')
  const [mfaFactors, setMfaFactors] = useState(null)
  const [enrolling, setEnrolling] = useState(null) // { factorId, totp }
  const [enrollCode, setEnrollCode] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)
  const [mfaMsg, setMfaMsg] = useState('')

  useEffect(() => {
    if (!isOfficer || !api.isSupabase) return
    api.mfaListFactors().then(setMfaFactors).catch(() => {})
  }, [isOfficer, user?.id])

  const startEnroll = async () => {
    setMfaMsg('')
    setMfaBusy(true)
    try {
      // Discard half-finished enrollments from earlier attempts so a stale
      // pending factor can never get in the way of a fresh setup.
      if (mfaFactors?.length) {
        await Promise.allSettled(
          mfaFactors.filter((f) => f.status !== 'verified').map((f) => api.mfaUnenroll(f.id))
        )
      }
      const f = await api.mfaEnroll()
      setEnrolling({ factorId: f.id, totp: f.totp })
      setEnrollCode('')
    } catch (e) {
      setMfaMsg(e.message || 'Could not start MFA setup.')
    } finally {
      setMfaBusy(false)
    }
  }

  const confirmEnroll = async (e) => {
    e.preventDefault()
    setMfaMsg('')
    setMfaBusy(true)
    try {
      const challengeId = await api.mfaChallenge(enrolling.factorId)
      await api.mfaVerify(enrolling.factorId, challengeId, enrollCode)
      setEnrolling(null)
      setMfaMsg('Two-factor authentication is on. A fresh code is required at every sign-in.')
      setMfaFactors(await api.mfaListFactors())
    } catch (err) {
      setEnrollCode('')
      const code = err?.code || err?.error_code
      if (code === 'mfa_verification_failed') {
        setMfaMsg('That code was rejected — enter the 6-digit code shown in your app right now. If it keeps failing, make sure your phone clock is set to automatic time.')
      } else if (code === 'otp_expired' || code === 'challenge_expired') {
        setMfaMsg('That code expired. Enter the newest code from your authenticator app.')
      } else {
        setMfaMsg(err.message || 'That code did not match — try again.')
      }
    } finally {
      setMfaBusy(false)
    }
  }

  const disableMfa = async (factorId) => {
    if (!window.confirm('Turn off two-factor authentication? Anyone with your password could then sign in directly.')) return
    setMfaMsg('')
    setMfaBusy(true)
    try {
      await api.mfaUnenroll(factorId)
      setMfaMsg('Two-factor authentication is off.')
      setMfaFactors(await api.mfaListFactors())
    } catch (e) {
      setMfaMsg(e.message || 'Could not disable MFA.')
    } finally {
      setMfaBusy(false)
    }
  }

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  useEffect(() => {
    if (user)
      setForm({
        surname: user.surname || '',
        first_name: user.first_name || '',
        middle_initial: user.middle_initial || '',
        id_no: user.id_no || '',
        program: user.program || '',
        year_level: user.year_level || '',
        section: user.section || '',
        avatar_url: user.avatar_url || '',
      })
  }, [user])

  const autoSave = () => {
    if (user?.role === 'superadmin' || user?.role === 'moderator') {
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => save(), 800)
    }
  }

  const onPick = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) {
      toast('Please pick an image file', 'err')
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      toast('Image too large — keep it under 5 MB', 'err')
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
        autoSave()
      }
      img.src = reader.result
    }
    reader.readAsDataURL(f)
  }

  const onNameChange = (key) => (v) => {
    setForm((f2) => ({ ...f2, [key]: v }))
    // Staff/leaders keep a plain name field — changes save automatically.
    autoSave()
  }

  const save = async () => {
    if (!form.first_name?.trim() || !form.surname?.trim()) {
      toast('First name and surname are required', 'err')
      return
    }
    const idNo = form.id_no?.trim() || ''
    if (idNo && !/^\d{4}-\d{4}$/.test(idNo)) {
      toast('ID no. must look like 2024-0001 (4 digits, dash, 4 digits)', 'err')
      return
    }
    setSaving(true)
    try {
      const updated = await api.upsertProfile({
        id: user.id,
        first_name: form.first_name.trim(),
        surname: form.surname.trim(),
        middle_initial: form.middle_initial || null,
        id_no: idNo || null,
        program: form.program,
        year_level: form.year_level,
        section: form.section,
        avatar_url: form.avatar_url || null,
      })
      if (updated) setUser({ ...user, ...updated })
      toast('Profile saved')
    } catch (e) {
      console.error(e)
      toast(`Could not save the profile${e?.message ? ` — ${e.message}` : ''}`, 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sheet" role="dialog" aria-label="Account settings">
      <div className="sheet-head">
        {user?.role === 'superadmin' ? (
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
        {user?.role !== 'superadmin' && (
          <div className="mm-pic">
            <button
              className="avatar avatar--ring avatar-btn"
              style={{ width: 56, height: 56, fontSize: 16, flex: 'none' }}
              onClick={() => fileRef.current?.click()}
              aria-label="Change photo"
            >
              {form.avatar_url ? <img src={form.avatar_url} alt="" /> : initials(form.first_name || user?.full_name || 'Member')}
            </button>
            <div>
              <button className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
                <Camera size={14} /> {form.avatar_url ? 'Change photo' : 'Add photo'}
              </button>
              {form.avatar_url && (
                <button className="btn btn--link btn--sm" onClick={() => { setForm((f2) => ({ ...f2, avatar_url: '' })); autoSave() }}>
                  Remove photo
                </button>
              )}
              <div className="mm-pic-hint">Squared JPG/PNG up to 5 MB — used on your ID card and in the directory.</div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
          </div>
        )}
        <div className="field">
          <label>Surname</label>
          <input
            value={form.surname || ''}
            onChange={(e) => onNameChange('surname')(e.target.value)}
            autoComplete="family-name"
            placeholder="Dela Cruz"
          />
        </div>
        <div className="field">
          <label>First name</label>
          <input
            value={form.first_name || ''}
            onChange={(e) => onNameChange('first_name')(e.target.value)}
            autoComplete="given-name"
            placeholder="Juan"
          />
        </div>
        <div className="field">
          <label>Middle initial</label>
          <input
            value={form.middle_initial || ''}
            onChange={(e) => onNameChange('middle_initial')(e.target.value)}
            maxLength={1}
            autoComplete="off"
            placeholder="M"
            style={{ textTransform: 'uppercase' }}
          />
        </div>
        <div className="mm-pic-hint">
          ID format: {form.surname ? form.surname.toUpperCase() : 'SURNAME'}, {form.first_name ? form.first_name.toUpperCase() : 'FIRST'}{form.middle_initial ? ` ${form.middle_initial.toUpperCase()}.` : ''}
        </div>
        {user?.role !== 'student' && <div className="mm-pic-hint">Changes are saved automatically.</div>}
        {user?.role === 'student' && (
          <>
            <div className="field">
              <label>ID no.</label>
              <input
                value={form.id_no || ''}
                onChange={(e) => setForm({ ...form, id_no: e.target.value })}
                placeholder="2024-0001"
                maxLength={9}
                autoComplete="off"
                inputMode="numeric"
              />
            </div>
            <div className="field">
              <label>Program</label>
              <Select
                value={form.program || ''}
                onChange={(v) => setForm({ ...form, program: v })}
                options={PROGRAMS.map((p) => ({ value: p, label: p }))}
                placeholder="Select program…"
              />
            </div>
            <div className="field">
              <label>Year level</label>
              <Select
                value={form.year_level || ''}
                onChange={(v) => setForm({ ...form, year_level: v })}
                options={['1', '2', '3', '4'].map((y) => ({ value: y, label: `Year ${y}` }))}
                placeholder="Select year…"
              />
            </div>
            <div className="field">
              <label>Section</label>
              <Select
                value={form.section || ''}
                onChange={(v) => setForm({ ...form, section: v })}
                options={['A', 'B', 'C', 'D'].map((s) => ({ value: s, label: `Section ${s}` }))}
                placeholder="Select section…"
              />
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
        <h4>More</h4>
        <div className="sheet-links">
          <button className="sheet-link" onClick={() => go('/app/archive')}>
            <Archive size={16} /> Archive
          </button>
          <button className="sheet-link" onClick={() => go('/app/health')}>
            <HeartPulse size={16} /> Health Centre
          </button>
          {can(user, 'directory.view') && (
            <button className="sheet-link" onClick={() => go('/app/directory')}>
              <Users size={16} /> Directory
            </button>
          )}
          {can(user, 'attendance.scan') && (
            <button className="sheet-link" onClick={() => go('/app/staff')}>
              <ShieldCheck size={16} /> Staff tools
            </button>
          )}
          {can(user, 'console.access') && (
            <button className="sheet-link" onClick={() => go('/app/admin')}>
              <Settings2 size={16} /> Admin console
            </button>
          )}
        </div>
      </div>

      {isOfficer && (
        <div className="sheet-sec">
          <h4>Security</h4>
          {!mfaFactors ? (
            <p className="mm-pic-hint">Loading two-factor status…</p>
          ) : mfaFactors.some((f) => f.status === 'verified') ? (
            <>
              <div className="sheet-row">
                <div className="sr-txt">
                  <h5>Two-factor authentication</h5>
                  <p>On — you'll enter a TOTP code at every sign-in.</p>
                </div>
                <KeyRound size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <button className="btn btn--ghost btn--block" onClick={() => disableMfa(mfaFactors[0].id)} disabled={mfaBusy} style={{ marginTop: 10 }}>
                <Loader2 size={14} className={mfaBusy ? 'spin' : ''} /> Turn off 2FA
              </button>
            </>
          ) : enrolling ? (
            <>
              <p className="mm-pic-hint" style={{ marginBottom: 8 }}>
                Scan the code with your authenticator app (Google Authenticator, Authy, 1Password, …), then enter the 6-digit code it shows.
              </p>
              {enrolling.totp?.qr_code ? (
                <img
                  src={enrolling.totp.qr_code}
                  alt="TOTP QR code"
                  style={{ width: 150, height: 150, borderRadius: 10, margin: '0 auto 10px', display: 'block', background: '#fff', padding: 6 }}
                />
              ) : (
                <p className="mm-pic-hint" style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '0.9rem', marginBottom: 8 }}>
                  {enrolling.totp?.secret}
                </p>
              )}
              <form onSubmit={confirmEnroll} style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={enrollCode}
                  onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit code"
                  style={{ flex: 1 }}
                  autoFocus
                />
                <button className="btn btn--primary" disabled={mfaBusy}>
                  {mfaBusy ? '…' : 'Verify'}
                </button>
              </form>
              <button className="btn btn--link btn--sm" onClick={() => setEnrolling(null)} disabled={mfaBusy}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <div className="sheet-row">
                <div className="sr-txt">
                  <h5>Two-factor authentication</h5>
                  <p>Extra protection for officer accounts — a TOTP code is required at sign-in.</p>
                </div>
                <Smartphone size={16} style={{ color: 'var(--muted)' }} />
              </div>
              <button className="btn btn--primary btn--block" onClick={startEnroll} disabled={mfaBusy} style={{ marginTop: 10 }}>
                <KeyRound size={14} /> Set up authenticator app
              </button>
            </>
          )}
          {mfaMsg && <p className="form-ok" style={{ marginTop: 8 }}>{mfaMsg}</p>}
        </div>
      )}

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
        <div className="mm-pic-hint" style={{ textAlign: 'center', marginTop: 14 }}>build {BUILD_ID}</div>
        <div className="mm-pic-hint" style={{ textAlign: 'center', marginTop: 4 }}>
          Developed by{' '}
          <a href={DEVELOPER.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
            {DEVELOPER.name}
          </a>
        </div>
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