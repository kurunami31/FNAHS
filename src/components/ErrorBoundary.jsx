import { Component } from 'react'

/**
 * Catches any uncaught render/effect error so the app shows a recoverable
 * screen instead of unmounting into a blank page. The error message is
 * surfaced on screen so it can be reported back for a fix.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    const message = String(this.state.error?.message || this.state.error)
    return (
      <div
        className="err-boundary"
        style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)', color: 'var(--ink)' }}
      >
        <div style={{ maxWidth: 460, width: '100%', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: '1.5rem', marginBottom: 10 }}>Something went wrong</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            The app hit an unexpected error while showing this screen. Reload to continue — if it keeps
            happening, tell the org admins what you were doing and what the message below says.
          </p>
          {message && (
            <pre
              style={{
                fontSize: 11,
                color: 'var(--danger)',
                background: 'var(--deep)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-md)',
                padding: 10,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                textAlign: 'left',
                maxHeight: 140,
                overflow: 'auto',
                margin: '14px 0',
              }}
            >
              {message}
            </pre>
          )}
          <button className="btn btn--primary" onClick={() => window.location.reload()}>
            Reload app
          </button>
        </div>
      </div>
    )
  }
}
