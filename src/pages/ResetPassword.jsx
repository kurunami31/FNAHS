import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
import Ecg from '../components/Ecg'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'

export default function ResetPassword() {
  const { toast, refreshUser } = useApp()
  const navigate = useNavigate()
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

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
          ? 'This reset link has expired or was already used — request a fresh one from the login page.'
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
            <button className="btn btn--primary btn--block btn--lg" disabled={busy}>
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
