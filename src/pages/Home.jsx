import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Stethoscope, CalendarDays, Shield, Megaphone, Vote, ScanLine, FileDown, Users, HandCoins, Wrench, BookOpen, KeyRound, Newspaper, ClipboardCheck } from 'lucide-react'
import Ecg from '../components/Ecg'
import { useApp } from '../context/AppContext'
import { toolsFor } from '../rbac'
import { api } from '../lib/api'
import { seedFeeds, ORG_TAGLINE, PROGRAMS } from '../lib/mock'
import { timeAgo } from '../lib/format'
import EventModal from '../components/EventModal'
import Announcements from '../components/Announcements'
import PopulationBreakdown from '../components/PopulationBreakdown'

const TOOL_ICONS = {
  'feed.moderate': Shield,
  'announcements.post': Megaphone,
  'events.manage': CalendarDays,
  'polls.manage': Vote,
  'attendance.scan': ScanLine,
  'attendance.export': FileDown,
  'members.edit': Users,
  'fees.view': HandCoins,
  'fees.manage': HandCoins,
  'clearance.scan': ClipboardCheck,
  'console.access': Wrench,
  'directory.view': BookOpen,
  'settings.superadmin': KeyRound,
}

export default function Home() {
  const { user } = useApp()
  const navigate = useNavigate()
  const [feeds, setFeeds] = useState(() => ({ health: seedFeeds().health, tips: seedFeeds().tips, news: seedFeeds().news }))
  const [events, setEvents] = useState([])
  const [selected, setSelected] = useState(null)
  const [memberCount, setMemberCount] = useState(0)
  const tools = toolsFor(user)

  const reloadRounds = async () => {
    try {
      const evs = await api.getEvents()
      const upcoming = evs.filter((e) => new Date(e.ends_at) > Date.now()).slice(0, 3)
      setEvents(upcoming)
      setSelected((s) => (s ? evs.find((e) => e.id === s.id) || null : s))
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    api.getFeeds().then(setFeeds).catch(() => {})
    reloadRounds()
    api
      .getMemberCount()
      .then(setMemberCount)
      .catch(() => {})
  }, [])

  const stats = [
    { value: memberCount ? memberCount.toLocaleString() : '1K+', label: memberCount ? 'members' : 'students' },
    { value: `${Math.max(PROGRAMS.length, 1)}`, label: PROGRAMS.length > 1 ? 'programs' : 'program' },
    { value: '24/7', label: 'ai assistant' },
  ]

  return (
    <div className="page-c">
      <section className="seal-hero rise">
        <div className="hero-seal d1">
          <img src="/FNAHS.png" alt="FNAHS seal" />
        </div>
        <div className="hero-eyebrow d2">faculty of nursing &amp; allied health sciences</div>
        <h1 className="hero-title d3">
          FNAHS <em>PULSO</em>
        </h1>
        <div className="hero-fac d3">pulso · proactive &amp; united legion of student nurses organization</div>
        <p className="hero-tagline d4">{ORG_TAGLINE}</p>
        <Ecg className="hero-ecg d5" />
        <div className="hero-actions d6">
          {user ? (
            <>
              <button className="btn btn--primary" onClick={() => navigate('/app/feed')}>
                Open the feed <ArrowRight size={16} />
              </button>
              <button className="btn btn--ghost" onClick={() => window.dispatchEvent(new Event('florence:open'))}>
                <Stethoscope size={16} /> Talk to Florence
              </button>
            </>
          ) : (
            <>
              <button className="btn btn--primary" onClick={() => navigate('/login')}>
                Sign in <ArrowRight size={16} />
              </button>
              <button className="btn btn--ghost" onClick={() => navigate('/signup')}>
                Join the faculty
              </button>
            </>
          )}
        </div>
        <div className="vitals d7">
          {stats.map((s) => (
            <div key={s.label} className="vital">
              <b>{s.value}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {user && <Announcements />}

      <PopulationBreakdown title="Enrollment by Year Level" />

      {user && tools.length > 0 && (
        <section className="sec" aria-labelledby="h-tools">
          <div className="sec-head">
            <h2 id="h-tools">Your Tools</h2>
            <span className="sec-kicker">per-role tools</span>
          </div>
          <div className="tools-grid">
            {tools.map((t) => {
              const Icon = TOOL_ICONS[t.id] || Newspaper
              return (
                <button key={t.id} className="tool-card" onClick={() => navigate(t.route)}>
                  <Icon size={18} />
                  <div>
                    <b>{t.label}</b>
                    <span>{t.desc}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <div className="home-cols">
        <section className="sec" aria-labelledby="h-briefs">
          <div className="sec-head">
            <h2 id="h-briefs">Clinical Briefs</h2>
            <span className="sec-kicker">health feed</span>
            <Link to="/app/feed" className="sec-more">view feed <ArrowRight size={13} /></Link>
          </div>
          <div className="brief-list">
            {feeds.health.slice(0, 5).map((f) => (
              <article key={f.id} className="brief">
                {f.url ? (
                  <p className="brief-title"><a href={f.url} target="_blank" rel="noreferrer">{f.title}</a></p>
                ) : (
                  <p className="brief-title">{f.title}</p>
                )}
                <div className="brief-meta">{f.source} · {timeAgo(f.created_at)}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="sec" aria-labelledby="h-tips">
          <div className="sec-head">
            <h2 id="h-tips">Practice Notes</h2>
            <span className="sec-kicker">tips</span>
          </div>
          <div className="brief-list">
            {feeds.tips.slice(0, 5).map((f) => (
              <article key={f.id} className="brief brief--tip">
                <p className="brief-title">{f.title}</p>
                <div className="brief-meta">{f.source} · {timeAgo(f.created_at)}</div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="sec" aria-labelledby="h-news">
        <div className="sec-head">
          <h2 id="h-news">Health News Wire</h2>
          <span className="sec-kicker">who &amp; health orgs</span>
          <a className="sec-more" href="https://www.who.int/news" target="_blank" rel="noreferrer">
            who.int <ArrowRight size={13} />
          </a>
        </div>
        <div className="brief-list">
          {feeds.news.slice(0, 6).map((n) => (
            <article key={n.id} className="brief brief--tip">
              {n.url ? (
                <p className="brief-title"><a href={n.url} target="_blank" rel="noreferrer">{n.title}</a></p>
              ) : (
                <p className="brief-title">{n.title}</p>
              )}
              <div className="brief-meta">{n.source || 'WHO'} · {timeAgo(n.created_at)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="sec" aria-labelledby="h-rounds">
        <div className="sec-head">
          <h2 id="h-rounds">On the Rounds</h2>
          <span className="sec-kicker">upcoming events</span>
          <Link to="/app/events" className="sec-more">all events <ArrowRight size={13} /></Link>
        </div>
        {events.length === 0 ? (
          <div className="empty-state">
            <CalendarDays size={36} />
            <h3>Nothing on the rounds</h3>
            <p>New events will land here first.</p>
          </div>
        ) : (
          <div className="ledger">
            {events.map((e) => (
              <button key={e.id} className="round-row" onClick={() => setSelected(e)}>
                <div className="round-date">
                  <b>{new Date(e.starts_at).getDate()}</b>
                  <span>{new Date(e.starts_at).toLocaleString('en-US', { month: 'short' }).toUpperCase()}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600 }}>{e.title}</h4>
                  <div className="ev-meta" style={{ margin: '6px 0 0' }}>
                    <span>📍 {e.location}</span>
                    <span>🕐 {new Date(e.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && <EventModal event={selected} onClose={() => setSelected(null)} onChanged={reloadRounds} />}
    </div>
  )
}