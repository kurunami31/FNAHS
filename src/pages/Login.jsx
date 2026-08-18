import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, Info, ArrowRight, ShieldCheck } from 'lucide-react'
import Ecg from '../components/Ecg'
import { useApp } from '../context/AppContext'
import { DEVELOPER } from '../lib/build'

export default function Login() {
  const { login, finishMfa, toast, isDemo } = useApp()
  const navigate = useNavigate()
  const [gate, setGate] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mfa, setMfa] = useState(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await login(email, password)
      if (res?.mfa) {
        setMfa(res.mfa)
        toast('Enter your authenticator code to finish signing in.')
        return
      }
      toast('Welcome back!')
      navigate('/app')
    } catch (err) {
      setError(err.message || 'Invalid credentials — try again.')
    } finally {
      setBusy(false)
    }
  }

  const finishMfaStep = async (e) => {
    e.preventDefault()
    setError('')
    setMfaBusy(true)
    try {
      await finishMfa(mfa.factorId, mfaCode)
      toast('Welcome back!')
      navigate('/app')
    } catch (err) {
      setError(err.message || 'That code did not work — try again.')
    } finally {
      setMfaBusy(false)
    }
  }

  if (gate) {
    return (
      <div className="auth-wrap">
        <div className="welcome-inner">
          <div className="welcome-seals">
            <div className="gate-seal">
              <img src="/FNAHS.png" alt="FNAHS seal" />
            </div>
            <div className="gate-seal">
              <img src="/dorsu-logo.png" alt="Davao Oriental State University seal" />
            </div>
          </div>

          <p className="gate-eyebrow">Davao Oriental State University</p>
          <h1 className="gate-name">
            FNAHS <em>PULSO</em>
          </h1>
          <p className="gate-fac">Faculty of Nursing and Allied Health Sciences</p>

          <button className="btn btn--primary btn--lg" onClick={() => setGate(false)}>
            Log in <ArrowRight size={17} />
          </button>

          <p className="auth-note">
            No account yet?{' '}
            <Link to="/signup" style={{ color: 'var(--accent)' }}>
              Join FNAHS PULSO
            </Link>
          </p>
        </div>
      </div>
    )
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
        <h2 className="auth-title">Log <em>in</em></h2>
        <p className="auth-sub">Welcome back to the ward.</p>
        <Ecg className="auth-ecg" />

        {isDemo && (
          <div className="form-ok" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Info size={15} /> Demo mode — any email + password works.
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        {mfa ? (
          <form onSubmit={finishMfaStep}>
            <div className="form-ok" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <ShieldCheck size={15} /> Two-factor authentication is on for this account.
            </div>
            <div className="field">
              <label>Authenticator code</label>
              <input
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit code"
                autoFocus
              />
            </div>
            <button className="btn btn--primary btn--block btn--lg" disabled={mfaBusy}>
              <ShieldCheck size={17} /> {mfaBusy ? 'Checking…' : 'Verify & sign in'}
            </button>
            <button type="button" className="btn btn--ghost btn--block" style={{ marginTop: 8 }} onClick={() => setMfa(null)}>
              Back
            </button>
          </form>
        ) : (
        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@fnahs.edu.ph" autoComplete="email" />
          </div>
          <div className="field">
            <label>Password</label>
            <div className="password-row">
              <input type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button className="btn btn--primary btn--block btn--lg" disabled={busy}>
            <LogIn size={17} /> {busy ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        )}

        <p className="auth-note">
          No account yet? <Link to="/signup" style={{ color: 'var(--accent)' }}>Join FNAHS PULSO</Link><br />
          {isDemo ? 'Staff demo: staff@fnahs.edu.ph · Admin demo: fnahsadmin@fnahs.edu.ph / dorsufnahs2026' : 'Reserved for the students of the Faculty of Nursing and Allied Health Sciences.'}
        </p>
        <p className="auth-note" style={{ marginTop: 10 }}>
          Developed by{' '}
          <a href={DEVELOPER.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
            {DEVELOPER.name}
          </a>
        </p>
      </div>
    </div>
  )
}