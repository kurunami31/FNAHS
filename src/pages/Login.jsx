import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, Info } from 'lucide-react'
import { useApp } from '../context/AppContext'

export default function Login() {
  const { login, toast, isDemo } = useApp()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      toast('Welcome back!')
      navigate('/app')
    } catch (err) {
      setError(err.message || 'Invalid credentials — try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap" style={{ background: 'radial-gradient(700px 400px at 80% -10%, var(--accent-glow-soft), transparent 60%), var(--bg)' }}>
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/FNAHS.png" alt="FNAHS logo" />
          <div>
            <div style={{ fontFamily: 'var(--f-id)', fontSize: '1.3rem', lineHeight: 1.1 }}>
              FNAHS<em style={{ color: 'var(--accent)' }}>·</em>NURSING
            </div>
            <div style={{ fontFamily: 'var(--f-ocr)', fontSize: '0.6rem', letterSpacing: '0.16em', color: 'var(--muted)', textTransform: 'uppercase' }}>community platform</div>
          </div>
        </div>
        <h1>Log <em>in</em></h1>
        <p className="auth-sub">Welcome back to the terminal.</p>

        {isDemo && (
          <div className="form-ok" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Info size={15} /> Demo mode — any email + password works.
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label>FNAHS email</label>
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

        <p className="auth-note">
          No account yet? <Link to="/signup" style={{ color: 'var(--accent)' }}>Join FNAHS</Link><br />
          {isDemo ? 'Staff demo: staff@fnahs.edu.ph' : 'Reserved for the students of the Faculty of Nursing and Allied Health Sciences.'}
        </p>
      </div>
    </div>
  )
}
