import { useEffect, useState } from 'react'
import { HeartPulse, RefreshCw, ExternalLink } from 'lucide-react'
import { api } from '../lib/api'
import { timeAgo } from '../lib/format'

function stripMarker(text) {
  return (text || '')
    .replace(/\[[^\]]*Upgrade subscription plan[^\]]*\]/gi, '')
    .replace(/\[Test mode[^\]]*\]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export default function HealthCentre() {
  const [articles, setArticles] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async (refresh = false) => {
    if (refresh) setBusy(true)
    setError('')
    try {
      const arts = await api.getWhoNews()
      setArticles(arts.filter((a) => a.title))
    } catch {
      setError("Couldn't reach the health news feed right now — pull refresh to try again.")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const [first, ...rest] = articles || []

  return (
    <div className="page-c">
      <h1 className="page-title">
        WHO HEALTH CENTRE <span className="page-kicker">global health news</span>
      </h1>
      <p className="page-sub">Curated health headlines from around the world, via the APITube News API.</p>

      <div className="hc-tools">
        <span className="hc-live" title="Live feed">
          <i /> LIVE
        </span>
        <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => load(true)}>
          <RefreshCw size={14} className={busy ? 'spinning' : ''} /> {busy ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {!articles && !error && (
        <div className="hc-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="hc-skel" key={i}>
              <div className="hc-thumb" />
              <div className="hc-lines">
                <i />
                <i />
              </div>
            </div>
          ))}
        </div>
      )}

      {articles?.length === 0 && !error && (
        <div className="empty-state">
          <HeartPulse size={28} />
          <p>No headlines right now — try refreshing in a minute.</p>
        </div>
      )}

      {first && (
        <a className="hc-featured" href={first.url} target="_blank" rel="noopener noreferrer">
          {first.image ? (
            <img className="hc-feat-img" src={first.image} alt="" loading="lazy" />
          ) : (
            <div className="hc-feat-img hc-feat-img--none">
              <HeartPulse size={34} />
            </div>
          )}
          <div className="hc-feat-body">
            <span className="chip chip--accent">TOP STORY</span>
            <h2 className="hc-feat-title">{stripMarker(first.title)}</h2>
            <div className="hc-meta">
              {first.source && <span>{first.source}</span>}
              {first.published_at && <span>{timeAgo(first.published_at)}</span>}
              <ExternalLink size={13} />
            </div>
          </div>
        </a>
      )}

      {rest.length > 0 && (
        <div className="hc-grid">
          {rest.map((a) => (
            <a className="hc-card" key={a.url} href={a.url} target="_blank" rel="noopener noreferrer">
              {a.image && <img className="hc-thumb-img" src={a.image} alt="" loading="lazy" />}
              <div className="hc-body">
                <h3 className="hc-title">{stripMarker(a.title)}</h3>
                <div className="hc-meta">
                  {a.source && <span>{a.source}</span>}
                  {a.published_at && <span>{timeAgo(a.published_at)}</span>}
                  <ExternalLink size={13} />
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      <p className="hc-note">
        Headlines and links come from third-party news sources. For information only — not medical advice. When in
        doubt, consult clinical instructors or official references.
      </p>
    </div>
  )
}