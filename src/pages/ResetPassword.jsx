import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, ShieldCheck, AlertTriangle } from 'lucide-react'
import Ecg from '../components/Ecg'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { supabase, SUPABASE_ENABLED } from '../supabase'

export default function ResetPassword() {
  const { toast, refreshUser } = useApp()
  const navigate = useNavigate()
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [checked, setChecked] = useState(false)

  // The recovery link establishes the session while this page boots. Poll
  // briefly for it; if it never appears (stale service worker serving an old
  // bundle, link opened on another device, or a reused/expired link), tell
  // the user plainly instead of failing mysteriously on submit.
  useEffect(() => {
    let alive = true
    const t0 = Date.now()
    const check = async () => {
      try {
        if (!SUPABASE_ENABLED) {
          if (alive) { setSessionReady(true); setChecked(true) }
          return
        }
        const { data } = await supabase.auth.getSession()
        if (!alive) return
        if (data?.session) {
          // Recovery tokens from the email link aren't fully materialized
          // server-side until the refresh token is used — without this,
          // updateUser dies with "session not found". Force the exchange.
          await supabase.auth
            .refreshSession({ refresh_token: data.session.refresh_token })
            .catch((e) => console.warn('recovery session refresh:', e?.message))
          setSessionReady(true)
          setChecked(true)
          return
        }
        if (Date.now() - t0 < 8000) setTimeout(check, 500)
        else setChecked(true)
      } catch {
        if (alive && Date.now() - t0 >= 8000) setChecked(true)
        else if (alive) setTimeout(check, 500)
      }
    }
    check()
    return () => { alive = false }
  }, [])

  // A stale PWA bundle can keep the old backend alive after a cutover — the
  // surest sign is the project ref in storage not matching what we ship.
  const [staleApp, setStaleApp] = useState(false)
  useEffect(() => {
    if (!SUPABASE_ENABLED || !supabase) return
    try {
      const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
      if (!key) return
      const raw = localStorage.getItem(key)
      if (raw && !raw.includes('roorltaytdaktlpygqwv')) setStaleApp(true)
    } catch { /* ignore */ }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if ((pw || '').length < 6) {
      setError('Use at least 6 characters for your new password.')
      return
    }
    setBusy(true)
    try {
      await api.updatePassword(pw)
      setDone(true)
      toast('Password updated — welcome back!')
      await refreshUser().catch(() => {})
      setTimeout(() => navigate('/app'), 900)
    } catch (err) {
      const msg = String(err?.message || '')
      setError(
        /session|expired|token/i.test(msg)
          ? 'This reset link can no longer be used. Open the newest reset email on this device, or request a fresh one from the login page.'
          : msg || 'Could not update the password — try again.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-lockup">
          <div className="auth-seal">
            <img src="/FNAHS.png" alt="FNAHS seal" />
          </div>
          <div>
            <h1 className="auth-brand">
              FNAHS<span className="auth-bullet">•</span>
              <em>PULSO</em>
            </h1>
            <div className="auth-brand-sub">Proactive &amp; United Legion of Student Nurses</div>
          </div>
        </div>
        <h2 className="auth-title">New <em>password</em></h2>
        <p className="auth-sub">Choose a new password for your account.</p>
        <Ecg className="auth-ecg" />

        {error && <div className="form-error">{error}</div>}

        {checked && !sessionReady && (
          <div className="form-error" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', textAlign: 'left' }}>
            <AlertTriangle size={15} style={{ flex: 'none', marginTop: 2 }} />
            <span>
              No reset session was found on this device. Open the <b>newest</b> reset email here, or{' '}
              <Link to="/login" style={{ color: 'var(--accent)' }}>request a fresh link</Link>. If it still fails,
              hold refresh / clear site data — the app may be running an outdated offline copy.
              {staleApp && ' An outdated offline copy was detected — clear this site’s data and reload.'}
            </span>
          </div>
        )}

        {done ? (
          <div className="form-ok" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ShieldCheck size={15} /> Password updated — taking you to the app…
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label>New password</label>
              <div className="password-row">
                <input
                  type={show ? 'text' : 'password'}
                  required
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  autoFocus
                />
                <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              className="btn btn--primary btn--block btn--lg"
              disabled={busy || (checked && !sessionReady)}
            >
              <KeyRound size={17} /> {busy ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        )}

        <p className="auth-note" style={{ marginTop: 12 }}>
          After saving you'll be signed in on this device.
        </p>
      </div>
    </div>
  )
}
