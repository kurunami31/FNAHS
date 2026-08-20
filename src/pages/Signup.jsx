import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, UserPlus, Info, ShieldCheck, X } from 'lucide-react'
import Ecg from '../components/Ecg'
import PrivacyNoticeContent from '../components/PrivacyNoticeContent'
import Select from '../components/Select'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'

const STRENGTH = [
  { label: 'too weak', min: 0 },
  { label: 'weak', min: 1 },
  { label: 'okay', min: 2 },
  { label: 'strong', min: 3 },
]

export default function Signup() {
  const { signup, toast, isDemo } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accountType, setAccountType] = useState('student')
  const [show, setShow] = useState(false)
  const [agree, setAgree] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!agree) {
      setError('Please read and agree to the Data Privacy Notice to create an account.')
      return
    }
    if (api.passwordStrength(password) < 2) {
      setError('Password must be at least 8 characters with at least one letter and one number.')
      return
    }
    setBusy(true)
    try {
      const res = await signup(name, email, password, accountType)
      if (res.needsConfirmation) {
        setNotice(
          accountType === 'faculty'
            ? `We sent a confirmation link to ${email}. Once you confirm, your faculty request goes to an administrator for approval before you can sign in as faculty.`
            : `We sent a confirmation link to ${email}. Check your inbox, then log in.`
        )
      } else {
        toast(accountType === 'faculty' ? 'Account created — your faculty request is pending admin approval.' : 'Account created — welcome to FNAHS!')
        navigate('/app')
      }
    } catch (err) {
      setError(err.message || 'Could not create the account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/FNAHS.png" alt="FNAHS logo" />
          <div>
            <div style={{ fontFamily: 'var(--f-id)', fontSize: '1.3rem', lineHeight: 1.1 }}>
              FNAHS <span style={{ color: 'var(--gold)', fontStyle: 'italic' }}>PULSO</span>
            </div>
            <div style={{ fontFamily: 'var(--f-ocr)', fontSize: '0.6rem', letterSpacing: '0.16em', color: 'var(--muted)', textTransform: 'uppercase' }}>proactive &amp; united legion of student nurses</div>
          </div>
        </div>
        <Ecg className="auth-ecg" />
        <h1 className="auth-title">Join <em>FNAHS PULSO</em></h1>
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
            <label>Account type</label>
            <Select
              value={accountType}
              onChange={setAccountType}
              ariaLabel="Account type"
              options={[
                { value: 'student', label: 'Student' },
                { value: 'faculty', label: 'Faculty' },
              ]}
            />
            <p className="field-hint" style={{ marginTop: 6 }}>
              {accountType === 'faculty' ? (
                <>Faculty accounts are created as <b>pending</b> — an administrator approves them before you get faculty access.</>
              ) : (
                <>Students sign up instantly and are ready to go.</>
              )}
            </p>
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@fnahs.edu.ph" autoComplete="email" />
          </div>
          <div className="field">
            <label>Password</label>
            <div className="password-row">
              <input type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters, letter + number" autoComplete="new-password" />
              <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {password && (
              <div className="pw-meter" aria-label={`Password strength: ${STRENGTH[api.passwordStrength(password)].label}`}>
                <span className={`pw-bar pw-bar--${api.passwordStrength(password)}`} />
                <em>{STRENGTH[api.passwordStrength(password)].label}</em>
              </div>
            )}
          </div>
          <label className="privacy-agree" style={{ marginBottom: 14 }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              I have read the{' '}
              <button
                type="button"
                className="privacy-link"
                style={{ color: 'var(--accent)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
                onClick={() => setNoticeOpen(true)}
              >
                Data Privacy Notice
              </button>{' '}
              and consent to the processing of my information as described.
            </span>
          </label>
          <button className="btn btn--primary btn--block btn--lg" disabled={busy}>
            <UserPlus size={17} /> {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-note">
          Already a member? <Link to="/login" style={{ color: 'var(--accent)' }}>Log in</Link><br />
          {isDemo ? 'Staff demo: staff@fnahs.edu.ph' : 'Reserved for the students of the Faculty of Nursing and Allied Health Sciences.'}
        </p>
      </div>

      {noticeOpen && (
        <div className="modal-backdrop" onClick={() => setNoticeOpen(false)}>
          <div className="modal privacy-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Data Privacy Notice">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <ShieldCheck size={20} style={{ color: 'var(--accent)' }} />
              <h2 style={{ margin: 0 }}>DATA PRIVACY NOTICE</h2>
              <button className="icon-btn" onClick={() => setNoticeOpen(false)} aria-label="Close notice" style={{ marginLeft: 'auto' }}>
                <X size={18} />
              </button>
            </div>
            <PrivacyNoticeContent />
            <div className="modal-actions">
              <button className="btn btn--primary" onClick={() => setNoticeOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
