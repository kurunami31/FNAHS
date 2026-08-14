import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { DEVELOPER } from '../lib/build'
import Ecg from './Ecg'

export default function MaintenanceScreen() {
  const { user } = useApp()
  return (
    <div
      className="auth-wrap"
    >
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/FNAHS.png" alt="FNAHS logo" />
          <div>
            <div style={{ fontFamily: 'var(--f-id)', fontSize: '1.3rem', lineHeight: 1.1 }}>
              FNAHS <span style={{ color: 'var(--gold)', fontStyle: 'italic' }}>PULSO</span>
            </div>
            <div
              style={{
                fontFamily: 'var(--f-ocr)',
                fontSize: '0.6rem',
                letterSpacing: '0.16em',
                color: 'var(--muted)',
                textTransform: 'uppercase',
              }}
            >
              proactive &amp; united legion of student nurses
            </div>
          </div>
        </div>
        <Ecg className="auth-ecg" />
        <h1 className="auth-title">
          Under <em>maintenance</em>
        </h1>
        <p className="auth-sub">The ward is being reworked — back soon.</p>

        <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 22px' }}>
          <img
            src="/loading-animation.gif"
            alt="Loading…"
            style={{ width: 170, maxWidth: '70vw', height: 'auto' }}
          />
        </div>

        <p
          className="auth-sub"
          style={{ marginBottom: 0, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}
        >
          FNAHS PULSO is currently being reworked. New features are on the way — please check back
          soon.
        </p>

        {!user && (
          <p className="auth-note">
            Are you an officer?{' '}
            <Link to="/login" style={{ color: 'var(--accent)' }}>Sign in</Link>
          </p>
        )}
        <p className="auth-note" style={{ marginTop: 12 }}>
          Developed by{' '}
          <a href={DEVELOPER.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
            {DEVELOPER.name}
          </a>
        </p>
      </div>
    </div>
  )
}
