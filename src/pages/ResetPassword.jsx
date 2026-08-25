import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, ShieldCheck, Loader2 } from 'lucide-react'
import Ecg from '../components/Ecg'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { supabase, SUPABASE_ENABLED } from '../supabase'

export default function ResetPassword() {
  const { toast, refreshUser } = useApp()
  const navigate = useNavigate()

  // boot: figure out how we can establish a session
  //   1. implicit link already exchanged -> session exists
  //   2. ?token=...&email=... (OTP link) -> verifyOtp
  //   3. neither -> manual 6-digit code entry
  const [phase, setPhase] = useState('boot') // boot | ready | code
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let alive = true
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token') || ''
    const urlEmail = params.get('email') || ''
    if (urlEmail) setEmail(urlEmail)
    if (urlToken) setCode(urlToken.replace(/\s/g, ''))

    const materialize = async (refreshToken) => {
      // make sure the session is fully persisted server-side
      await supabase.auth.refreshSession({ refresh_token: refreshToken }).catch(() => {})
    }

    const verifyOtp = async (em, tk, silentBoot) => {
      setVerifying(true)
      try {
        const { data, error } = await supabase.auth.verifyOtp({ type: 'recovery', email: em, token: tk })
        if (alive) setVerifying(false)
        if (error) throw error
        await materialize(data.session?.refresh_token)
        if (!alive) return
        setPhase('ready')
        if (!silentBoot) toast('Code verified — choose your new password')
      } catch (e) {
        if (!alive) return
        setVerifying(false)
        if (silentBoot) {
          setPhase('code')
          setError(`The link could not be verified (${e.message}). Enter the 6-digit code from the email instead.`)
        } else {
          setError(e.message || 'That code did not work.')
        }
      }
    }

    const establish = async () => {
      if (!SUPABASE_ENABLED || !supabase) {
        if (alive) setPhase(urlToken && urlEmail ? 'code' : 'code')
        return
      }
      // 1) did the implicit link already produce a session?
      try {
        const t0 = Date.now()
        while (Date.now() - t0 < 5000) {
          const { data } = await supabase.auth.getSession()
          if (!alive) return
          if (data?.session) {
            await materialize(data.session.refresh_token)
            if (!alive) return
            setPhase('ready')
            return
          }
          await new Promise((r) => setTimeout(r, 400))
        }
      } catch { /* fall through */ }
      if (!alive) return

      // 2) OTP token from the email link?
      if (urlToken && urlEmail) {
        await verifyOtp(urlEmail, urlToken, true)
        return
      }
      // 3) manual code entry
      if (alive) setPhase('code')
    }

    establish()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitCode = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Enter your account email.'); return }
    if (!code.trim()) { setError('Enter the 6-digit code from the email.'); return }
    setVerifying(true)
    try {
      const { data, error } = await supabase.auth.verifyOtp({ type: 'recovery', email: email.trim(), token: code.trim().replace(/\s/g, '') })
      if (error) throw error
      await supabase.auth.refreshSession({ refresh_token: data.session?.refresh_token }).catch(() => {})
      setPhase('ready')
      toast('Code verified — choose your new password')
    } catch (err) {
      setError(err.message || 'That code did not work.')
    } finally {
      setVerifying(false)
    }
  }

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
        /session|expired|token|not found/i.test(msg)
          ? `${msg} — verify the code again and retry immediately.`
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

        {phase === 'boot' ? (
          <>
            <h2 className="auth-title">Checking <em>link</em></h2>
            <p className="auth-sub"><Loader2 size={14} className="spin" style={{ verticalAlign: '-2px' }} /> Verifying your reset link…</p>
            <Ecg className="auth-ecg" />
          </>
        ) : (
          <>
            <h2 className="auth-title">{phase === 'ready' ? <>New <em>password</em></> : <>Enter <em>code</em></>}</h2>
            <p className="auth-sub">
              {phase === 'ready'
                ? 'Choose a new password for your account.'
                : 'Open the newest reset email and enter its 6-digit code below.'}
            </p>
            <Ecg className="auth-ecg" />

            {error && <div className="form-error">{error}</div>}

            {phase === 'boot-note' && null}

            {phase === 'code' && (
              <form onSubmit={submitCode}>
                <div className="field">
                  <label>Email</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@fnahs.edu.ph" autoComplete="email" />
                </div>
                <div className="field">
                  <label>6-digit code</label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^\w]/g, ''))}
                    placeholder="e.g. 482913"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>
                <button className="btn btn--primary btn--block btn--lg" disabled={verifying}>
                  {verifying ? <Loader2 size={16} className="spin" /> : <KeyRound size={17} />} {verifying ? 'Verifying…' : 'Verify code'}
                </button>
                <p className="auth-note" style={{ marginTop: 10 }}>
                  Tip: the newest email shows a 6-digit code near “Set new password”. Requesting a new email invalidates older codes.
                </p>
              </form>
            )}

            {phase === 'ready' && (
              done ? (
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
              )
            )}

            {phase !== 'ready' && (
              <p className="auth-note" style={{ marginTop: 12 }}>
                Need a code? <Link to="/login" style={{ color: 'var(--accent)' }}>Request a reset email</Link> from the login page.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
