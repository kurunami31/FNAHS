import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, UserPlus, Info } from 'lucide-react'
import Ecg from '../components/Ecg'
import { useApp } from '../context/AppContext'

export default function Signup() {
  const { signup, toast, isDemo } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      const res = await signup(name, email, password)
      if (res.needsConfirmation) {
        setNotice(`We sent a confirmation link to ${email}. Check your inbox, then log in.`)
      } else {
        toast('Account created — welcome to FNAHS!')
        navigate('/app')
      }
    } catch (err) {
      setError(err.message || 'Could not create the account.')
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
              FNAHS
            </div>
            <div style={{ fontFamily: 'var(--f-ocr)', fontSize: '0.6rem', letterSpacing: '0.16em', color: 'var(--muted)', textTransform: 'uppercase' }}>community platform</div>
          </div>
        </div>
        <Ecg className="auth-ecg" />
        <h1 className="auth-title">Join <em>FNAHS</em></h1>
        <p className="auth-sub">One last step — then you're in.</p>

        {isDemo && (
          <div className="form-ok" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Info size={15} /> Demo mode — any email works; no real account needed.
          </div>
        )}

        {error && <div className="form-error">{error}</div>}
        {notice && <div className="form-ok">{notice}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label>Full name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Dela Cruz" autoComplete="name" />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@fnahs.edu.ph" autoComplete="email" />
          </div>
          <div className="field">
            <label>Password</label>
            <div className="password-row">
              <input type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" autoComplete="new-password" />
              <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button className="btn btn--primary btn--block btn--lg" disabled={busy}>
            <UserPlus size={17} /> {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-note">
          Already a member? <Link to="/login" style={{ color: 'var(--accent)' }}>Log in</Link><br />
          {isDemo ? 'Staff demo: staff@fnahs.edu.ph' : 'Reserved for the students of the Faculty of Nursing and Allied Health Sciences.'}
        </p>
      </div>
    </div>
  )
}
