import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { ShieldAlert, Users, Newspaper, CalendarDays, Wrench, Plus, Pencil, Trash2, X, Search, IdCard, Download, HandCoins, RefreshCw, FileText, GraduationCap } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { can, POSITIONS, positionLabel, roleLabel } from '../rbac'
import { api } from '../lib/api'
import { initials, timeAgo, monthDay } from '../lib/format'
import { PROGRAMS } from '../lib/mock'
import { drawIdCanvas } from '../lib/idCanvas'
import { attendanceWorkbook, feeReportWorkbook, downloadWorkbook } from '../lib/exportXlsx'
import { currentSchoolYear, feeSummary, fmtPeso } from '../lib/fees'
import Select from '../components/Select'
import PopulationBreakdown from '../components/PopulationBreakdown'

const ROLES = ['student', 'faculty', 'moderator', 'superadmin']

export default function Admin() {
  const { user, toast, maintenance, setMaintenanceFlag } = useApp()
  const [tab, setTab] = useState('members')
  const [saving, setSaving] = useState(false)
  const [members, setMembers] = useState([])
  const [posts, setPosts] = useState([])
  const [events, setEvents] = useState([])
  const [q, setQ] = useState('')
  const [memberModal, setMemberModal] = useState(null)
  const [idModal, setIdModal] = useState(null)
  const [postModal, setPostModal] = useState(null)
  const [eventModal, setEventModal] = useState(null)
  const [attEventId, setAttEventId] = useState('')
  const [attRows, setAttRows] = useState([])
  const [attPayments, setAttPayments] = useState([])
  const [attQ, setAttQ] = useState('')
  const attEventIdRef = useRef('')
  const [feeYear, setFeeYear] = useState(currentSchoolYear())
  const [feePayments, setFeePayments] = useState([])
  const [annualFee, setAnnualFee] = useState(200)
  const [auditLogs, setAuditLogs] = useState([])

  const loadAudit = async () => {
    try {
      const rows = await api.getAuditLogs(100)
      setAuditLogs(rows)
    } catch (e) {
      console.error(e)
      toast('Could not load the audit log', 'err')
    }
  }
const [feeQ, setFeeQ] = useState('')
const [searchQ, setSearchQ] = useState('')
const [feeFilter, setFeeFilter] = useState('all')
  const [feeModal, setFeeModal] = useState(null)

  const canFees = can(user, 'fees.view')
  const canManageFees = can(user, 'fees.manage')

  // school years offered by the selector: the current AY plus three back
  const feeYears = useMemo(() => {
    const cur = currentSchoolYear().split('-')[0]
    return Array.from({ length: 4 }, (_, i) => `${Number(cur) - i}-${Number(cur) - i + 1}`)
  }, [])

  const isSuperadmin = user?.role === 'superadmin'

  const load = useCallback(async () => {
    try {
      const [ms, ps, evs] = await Promise.all([api.getUsers(), api.getPosts(), api.getAllEvents()])
      setMembers(ms)
      setPosts(ps)
      setEvents(evs)
    } catch (e) {
      console.error(e)
      toast('Could not load admin data', 'err')
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  // default the attendance picker to the first event once events arrive
  useEffect(() => {
    if (!attEventId && events.length) setAttEventId(events[0].id)
  }, [events, attEventId])

  useEffect(() => {
    attEventIdRef.current = attEventId
  }, [attEventId])

  useEffect(() => {
    const id = attEventIdRef.current
    if (!id) return
    let alive = true
    api
      .getAttendance(id)
      .then((rows) => alive && setAttRows(rows))
      .catch((e) => console.error(e))
    const ev = events.find((e) => e.id === id)
    if (Number(ev?.fee_amount) > 0) {
      api
        .getEventPayments(id)
        .then((rows) => alive && setAttPayments(rows))
        .catch((e) => console.error(e))
    } else {
      setAttPayments([])
    }
    return () => {
      alive = false
    }
  }, [attEventId, events])

  const loadFees = useCallback(async () => {
    try {
      const [payments, annual] = await Promise.all([api.getFeePayments(feeYear), api.getAnnualFee()])
      setFeePayments(payments)
      setAnnualFee(annual)
    } catch (e) {
      console.error(e)
      toast('Could not load membership fees', 'err')
    }
  }, [feeYear, toast])

  useEffect(() => {
    if (canFees) loadFees()
  }, [canFees, loadFees])

  useEffect(() => {
    if (tab === 'audit') loadAudit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // Auto-refresh payment confirmations: whenever the window regains focus
  // and on a light 30s poll, so marks made by admins/mods/officers on other
  // devices show up without a manual refresh.
  const refreshLive = useCallback(() => {
    const id = attEventIdRef.current
    if (id) {
      api
        .getEventPayments(id)
        .then((rows) => setAttPayments(rows))
        .catch(() => {})
    }
    if (canFees) loadFees()
  }, [canFees, loadFees])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshLive()
    }
    document.addEventListener('visibilitychange', onVisible)
    const t = setInterval(refreshLive, 30000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(t)
    }
  }, [refreshLive])

  const recordFee = async (memberId, opts) => {
    await api.recordFeePayment(memberId, feeYear, opts)
    await loadFees()
    toast('Payment recorded')
  }

  const voidFee = async (paymentId) => {
    await api.voidFeePayment(paymentId)
    await loadFees()
    toast('Payment voided')
  }

  const changeAnnualFee = async () => {
    const raw = window.prompt('Annual membership fee amount (₱)', String(annualFee))
    if (raw === null) return
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) {
      toast('Enter a valid amount', 'err')
      return
    }
    try {
      await api.setAnnualFee(n)
      setAnnualFee(n)
      toast(`Annual fee set to ₱${fmtPeso(n)}`)
    } catch (e) {
      console.error(e)
      toast('Could not update the annual fee', 'err')
    }
  }

  const exportAttXlsx = async () => {
    try {
      const ev = events.find((e) => e.id === attEventId)
      // Always pull fresh payment confirmations at export time so the file
      // reflects the latest marks (screen state may be older).
      let payments = attPayments
      if (Number(ev?.fee_amount) > 0) {
        try {
          payments = await api.getEventPayments(attEventId)
        } catch (e) {
          console.error(e)
        }
      }
      const { workbook, filename } = await attendanceWorkbook(ev, attRows, payments)
      await downloadWorkbook(workbook, filename)
      toast(`Exported ${attRows.length} record${attRows.length === 1 ? '' : 's'}`)
    } catch (e) {
      console.error(e)
      toast('Could not export attendance', 'err')
    }
  }

  const exportFeeReport = async () => {
    try {
      // Fresh membership fee data at export time — never export stale state.
      let payments = feePayments
      let annual = annualFee
      try {
        ;[payments, annual] = await Promise.all([api.getFeePayments(feeYear), api.getAnnualFee()])
      } catch (e) {
        console.error(e)
      }
      const { workbook, filename } = await feeReportWorkbook({ members, feePayments: payments, annualFee: annual, schoolYear: feeYear })
      await downloadWorkbook(workbook, filename)
      toast('Fee report exported')
    } catch (e) {
      console.error(e)
      toast('Could not export the fee report', 'err')
    }
  }

  if (!can(user, 'console.access')) {
    return (
      <div className="empty-state">
        <ShieldAlert size={44} />
        <h3>Admin console</h3>
        <p>This page is reserved for FNAHS PULSO officers and administrators.</p>
      </div>
    )
  }

  const needle = q.trim().toLowerCase()
  // superadmin accounts stay invisible in the console — nobody can manage
  // the owner account from the UI, and it never shows up in member lists.
  const visibleMembers = members
    .filter((m) => m.role !== 'superadmin')
    .filter(
      (m) => !needle || m.full_name?.toLowerCase().includes(needle) || m.email?.toLowerCase().includes(needle)
    )

  const changeRole = async (m, role) => {
    if (m.id === user.id && role !== 'superadmin') {
      toast('You cannot demote your own account', 'err')
      return
    }
    try {
      await api.changeRole(m.id, role)
      setMembers((ms) => ms.map((x) => (x.id === m.id ? { ...x, role } : x)))
      toast(`${m.full_name} is now ${role}`)
    } catch (e) {
      console.error(e)
      toast(e.message?.includes('insufficient') ? 'Only a superadmin can change roles' : 'Role update failed', 'err')
    }
  }

  const changePositions = async (m, positions) => {
    try {
      await api.setPositions(m.id, positions)
      setMembers((ms) => ms.map((x) => (x.id === m.id ? { ...x, positions } : x)))
      toast(positions.length ? `${m.full_name}'s position: ${positions.map(positionLabel).join(', ')}` : `${m.full_name} is now a plain member`)
    } catch (e) {
      console.error(e)
      toast(e.message?.includes('insufficient') ? 'Only a superadmin can change positions' : 'Position update failed', 'err')
    }
  }

  const pendingFaculty = members.filter((m) => m.requested_role === 'faculty' && m.role !== 'faculty')

  const approveFacultyRequest = async (m) => {
    try {
      await api.resolveFacultyRequest(m.id, true)
      setMembers((ms) => ms.map((x) => (x.id === m.id ? { ...x, role: 'faculty', requested_role: null } : x)))
      toast(`${m.full_name} is now faculty`)
    } catch (e) {
      console.error(e)
      toast(e.message || 'Could not approve the faculty request', 'err')
    }
  }

  const dismissFacultyRequest = async (m) => {
    try {
      await api.resolveFacultyRequest(m.id, false)
      setMembers((ms) => ms.map((x) => (x.id === m.id ? { ...x, requested_role: null } : x)))
      toast(`Faculty request from ${m.full_name} dismissed`)
    } catch (e) {
      console.error(e)
      toast(e.message || 'Could not dismiss the request', 'err')
    }
  }

  const removeMember = async (m) => {
    if (m.id === user.id) {
      toast('You cannot delete your own account', 'err')
      return
    }
    if (!window.confirm(`Delete ${m.full_name} and their posts?`)) return
    try {
      await api.deleteUser(m.id)
      setMembers((ms) => ms.filter((x) => x.id !== m.id))
      toast('Member deleted')
    } catch (e) {
      console.error(e)
      toast('Could not delete member', 'err')
    }
  }

  const removePost = async (p, archive) => {
    if (archive && !window.confirm('Archive this post? It disappears from the feed.')) return
    if (!archive && !window.confirm('Permanently delete this post?')) return
    try {
      if (archive) await api.archivePost(p.id)
      else await api.deletePost(p.id)
      setPosts((ps) => ps.filter((x) => x.id !== p.id))
      toast(archive ? 'Post archived' : 'Post deleted')
    } catch (e) {
      console.error(e)
      toast('Could not remove post', 'err')
    }
  }

  const removeEvent = async (e) => {
    if (!window.confirm(`Delete the event "${e.title}"?`)) return
    try {
      await api.deleteEvent(e.id)
      setEvents((evs) => evs.filter((x) => x.id !== e.id))
      toast('Event deleted')
    } catch (err) {
      console.error(err)
      toast('Could not delete event', 'err')
    }
  }

  return (
    <div className="page-c">
      <h1 className="page-title">
        ADMIN <span className="page-kicker">moderation console</span>
      </h1>
      <p className="page-sub">Create, edit, and remove members, posts, and events. Changes apply immediately.</p>

      <div className="tabs" role="tablist" aria-label="Admin sections">
        <button className={`tab-btn${tab === 'members' ? ' tab-btn--on' : ''}`} onClick={() => setTab('members')}>
          <Users size={15} /> Members
        </button>
        <button className={`tab-btn${tab === 'ids' ? ' tab-btn--on' : ''}`} onClick={() => setTab('ids')}>
          <IdCard size={15} /> Digital IDs
        </button>
        <button className={`tab-btn${tab === 'posts' ? ' tab-btn--on' : ''}`} onClick={() => setTab('posts')}>
          <Newspaper size={15} /> Posts
        </button>
        <button className={`tab-btn${tab === 'events' ? ' tab-btn--on' : ''}`} onClick={() => setTab('events')}>
          <CalendarDays size={15} /> Events
        </button>
        <button className={`tab-btn${tab === 'attendance' ? ' tab-btn--on' : ''}`} onClick={() => setTab('attendance')}>
          <Users size={15} /> Attendance
        </button>
        <button className={`tab-btn${tab === 'reports' ? ' tab-btn--on' : ''}`} onClick={() => setTab('reports')}>
          <FileText size={15} /> Report
        </button>
        {canFees && (
          <button className={`tab-btn${tab === 'fees' ? ' tab-btn--on' : ''}`} onClick={() => setTab('fees')}>
            <HandCoins size={15} /> Fees
          </button>
        )}
        <button className={`tab-btn${tab === 'maintenance' ? ' tab-btn--on' : ''}`} onClick={() => setTab('maintenance')}>
          <Wrench size={15} /> Maintenance
        </button>
        <button className={`tab-btn${tab === 'audit' ? ' tab-btn--on' : ''}`} onClick={() => setTab('audit')}>
          <ShieldAlert size={15} /> Audit
        </button>
      </div>

      {tab === 'members' && (
        <section className="panel">
          <PopulationBreakdown title="Population by Year Level" kicker="members" />
          <div className="admin-toolbar">
            <div className="dir-search">
              <Search size={17} />
              <input placeholder="Search members…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className="btn btn--primary" onClick={() => setMemberModal({ mode: 'create' })}>
              <Plus size={15} /> Add member
            </button>
          </div>
          {isSuperadmin && pendingFaculty.length > 0 && (
            <div className="panel" style={{ marginBottom: 12, padding: 12, borderColor: 'var(--gold)' }}>
              <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <GraduationCap size={16} /> Pending faculty requests ({pendingFaculty.length})
              </div>
              <div className="ledger ledger-scroll" style={{ maxHeight: 220 }}>
                {pendingFaculty.map((m) => (
                  <div className="ledger-row mem-row" key={m.id}>
                    <div className="avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
                      {m.avatar_url ? <img src={m.avatar_url} alt="" /> : initials(m.full_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.93rem' }}>{m.full_name}</div>
                      <div className="ledger-meta">{m.email}</div>
                    </div>
                    <button className="btn btn--primary btn--sm" onClick={() => approveFacultyRequest(m)}>
                      Approve as faculty
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={() => dismissFacultyRequest(m)}>
                      Dismiss
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="ledger ledger-scroll">
            {visibleMembers.map((m) => (
              <div className="ledger-row mem-row" key={m.id}>
                <div className="avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
                  {m.avatar_url ? <img src={m.avatar_url} alt="" /> : initials(m.full_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.93rem' }}>{m.full_name}</div>
                  <div className="ledger-meta">{m.email} · {m.program || '—'}{m.role !== 'faculty' ? ` · YR ${m.year_level || '—'}` : ''}</div>
                  {!!m.positions?.length && (
                    <div className="dir-positions">
                      {m.positions.map((p) => (
                        <span key={p} className="badge">{positionLabel(p)}</span>
                      ))}
                    </div>
                  )}
                  {m.requested_role === 'faculty' && m.role !== 'faculty' && (
                    <span className="badge" style={{ background: 'var(--gold)', color: '#000', marginTop: 4 }}>
                      Awaiting faculty approval
                    </span>
                  )}
                </div>
                <Select
                  compact
                  className="role-select"
                  value={m.positions?.length === 1 ? `pos:${m.positions[0]}` : `role:${m.role || 'student'}`}
                  onChange={(v) => {
                    if (v.startsWith('role:')) changeRole(m, v.slice(5))
                    else changePositions(m, [v.slice(4)])
                  }}
                  ariaLabel={`Role or position of ${m.full_name}`}
                  options={[
                    { label: 'Roles', options: ROLES.map((r) => ({ value: `role:${r}`, label: roleLabel(r) })) },
                    { label: 'Officer positions', options: POSITIONS.map((p) => ({ value: `pos:${p}`, label: positionLabel(p) })) },
                  ]}
                />
                <div className="admin-actions">
                  <button className="icon-btn" title="View digital ID" onClick={() => setIdModal(m)}>
                    <IdCard size={15} />
                  </button>
                  <button className="icon-btn" title="Edit" onClick={() => setMemberModal({ mode: 'edit', m })}>
                    <Pencil size={15} />
                  </button>
                  {isSuperadmin && (
                    <button className="icon-btn icon-btn--danger" title="Delete" onClick={() => removeMember(m)}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'ids' && (
        <section className="panel">
          <div className="admin-toolbar">
            <p className="page-sub" style={{ margin: 0 }}>
              Digital IDs of all registered members — click Save PNG to export each card.
            </p>
          </div>
          <div className="id-grid id-grid-scroll">
            {members.filter((m) => m.role !== 'superadmin').map((m) => (
              <MemberIdCard key={m.id} member={m} />
            ))}
            {!members.some((m) => m.role !== 'superadmin') && (
              <div className="empty-state">
                <Users size={40} />
                <h3>No members yet</h3>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === 'posts' && (
        <section className="panel">
          <div className="admin-toolbar">
            <div className="dir-search">
              <Search size={17} />
              <input placeholder="Search posts…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="ledger ledger-scroll">
            {posts
              .filter((p) => !needle || p.content?.toLowerCase().includes(needle) || p.author?.full_name?.toLowerCase().includes(needle))
              .map((p) => (
                <div className="ledger-row" key={p.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="post-clamp">{p.content}</div>
                    <div className="ledger-meta">{p.author?.full_name || 'unknown'} · {timeAgo(p.created_at)} · {p.likes?.length || 0} likes</div>
                  </div>
                  <div className="admin-actions">
                    <button className="icon-btn" title="Edit" onClick={() => setPostModal(p)}>
                      <Pencil size={15} />
                    </button>
                    <button className="icon-btn" title="Archive" onClick={() => removePost(p, true)}>
                      <X size={15} />
                    </button>
                    <button className="icon-btn icon-btn--danger" title="Delete" onClick={() => removePost(p, false)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {tab === 'events' && (
        <section className="panel">
          <div className="ledger ledger-scroll">
            {events.map((e) => (
              <div className="ledger-row" key={e.id}>
                <div className="round-date" style={{ borderRight: 'none', width: 44 }}>
                  <b style={{ fontSize: '1.15rem' }}>{monthDay(e.starts_at).day}</b>
                  <span>{monthDay(e.starts_at).month}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.93rem' }}>{e.title}</div>
                  <div className="ledger-meta">
                    {e.location} · {timeAgo(e.starts_at)}
                    {Number(e.fee_amount) > 0 ? ` · fee ₱${fmtPeso(e.fee_amount)}` : ''}
                  </div>
                </div>
                <div className="admin-actions">
                  <button className="icon-btn" title="Edit" onClick={() => setEventModal(e)}>
                    <Pencil size={15} />
                  </button>
                  <button className="icon-btn icon-btn--danger" title="Delete" onClick={() => removeEvent(e)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'reports' && (
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">
              <FileText size={16} /> Live report
            </h2>
            <span className="chip chip--gold">auto-refreshes</span>
            <button className="btn btn--tiny" onClick={exportAttXlsx} disabled={!attEventId || attRows.length === 0}>
              <Download size={13} /> Event XLSX
            </button>
            <button className="btn btn--tiny" onClick={exportFeeReport} disabled={members.length === 0}>
              <Download size={13} /> Fees XLSX
            </button>
          </div>
          <p className="page-sub" style={{ marginTop: 8 }}>
            Everything the exports contain, in one place — it updates itself (every 30 seconds and whenever you
            return to this tab) as admins, moderators, faculty, and officers confirm payments. Use the XLSX buttons
            only when you need a saved copy.
          </p>

          <h3 style={{ margin: '18px 0 4px', fontSize: '1.02rem' }}>Event contributions</h3>
          <div className="dir-search" style={{ marginTop: 16 }}>
            <Search size={17} />
            <input
              placeholder="Search names, IDs, or emails"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
          </div>
          <div className="admin-toolbar">
            <div className="field" style={{ marginBottom: 0, minWidth: 240, flex: 1 }}>
              <label>Event</label>
              <Select
                value={attEventId}
                onChange={setAttEventId}
                options={events.map((e) => ({ value: e.id, label: e.title }))}
                placeholder="Select an event…"
              />
            </div>
          </div>
          {(() => {
            const ev = events.find((e) => e.id === attEventId)
            const fee = Number(ev?.fee_amount) || 0
            if (!ev) return <p className="panel-muted">Pick an event to see its contribution report.</p>
            if (fee <= 0)
              return <p className="panel-muted">{ev.title} has no contribution fee — nothing to collect.</p>
            const paidCount = attPayments.length
            const collected = attPayments.reduce((t, p) => t + Number(p.amount || 0), 0)
            const unpaid = attRows.length - paidCount
            const paidBy = new Set(attPayments.map((p) => p.member_id))
            const q = searchQ.trim().toLowerCase()
            const shownAtt = q
              ? attRows.filter((a) =>
                  [a.profiles?.full_name, a.profiles?.id_no, a.profiles?.email, a.profiles?.program].some((v) =>
                    v ? String(v).toLowerCase().includes(q) : false
                  )
                )
              : attRows
            return (
              <>
                <div className="tally-strip">
                  <span className="chip chip--ok">
                    <b>{attRows.length}</b> present
                  </span>
                  <span className="chip chip--gold">
                    <b>{paidCount}</b> paid · <b>₱{fmtPeso(collected)}</b> collected
                  </span>
                  <span className="chip">
                    <b>{unpaid}</b> unpaid · ₱{fmtPeso(unpaid * fee)} outstanding
                  </span>
                </div>
                {attRows.length === 0 ? (
                  <p className="panel-muted">No scans recorded for this event yet.</p>
                ) : shownAtt.length === 0 ? (
                  <p className="panel-muted">No members match “{searchQ}” for this event.</p>
                ) : (
                  <div className="ledger ledger-scroll">
                    {shownAtt.map((a) => (
                      <div className="ledger-row" key={`${a.event_id}-${a.user_id}`}>
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
                          {(a.profiles?.full_name || '?')
                            .split(' ')
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.93rem' }}>
                            {a.profiles?.full_name || a.user_id.slice(0, 10)}
                          </div>
                          <div className="ledger-meta">
                            {a.profiles?.id_no ? `ID ${a.profiles.id_no} · ` : ''}
                            {a.profiles?.program || '—'}
                            {a.profiles?.year_level ? ` (Yr ${a.profiles.year_level})` : ''}
                            {a.profiles?.section ? ` · Sec ${a.profiles.section}` : ''}
                          </div>
                        </div>
                        <span className={`chip${paidBy.has(a.user_id) ? ' chip--ok' : ''}`}>
                          {paidBy.has(a.user_id) ? `PAID ₱${fmtPeso(fee)}` : 'UNPAID'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )
          })()}

          <h3 style={{ margin: '22px 0 4px', fontSize: '1.02rem' }}>Membership fees · {feeYear}</h3>
          {(() => {
            const roster = members.filter((m) => m.role !== 'superadmin')
            const q = searchQ.trim().toLowerCase()
            const shownRoster = q
              ? roster.filter((m) =>
                  [m.full_name, m.email, m.program, m.id_no].some((v) => v && String(v).toLowerCase().includes(q))
                )
              : roster
            const states = shownRoster.map((m) => feeSummary(feePayments.filter((p) => p.member_id === m.id), annualFee))
            const paid = states.filter((s) => s.status === 'paid').length
            const partial = states.filter((s) => s.status === 'partial').length
            const unpaid = states.filter((s) => s.status === 'unpaid').length
            const collected = feePayments.reduce((t, p) => t + Number(p.amount || 0), 0)
            return (
              <>
                <div className="tally-strip">
                  <span className="chip">
                    <b>{roster.length}</b> members
                  </span>
                  <span className="chip chip--ok">
                    <b>{paid}</b> paid
                  </span>
                  <span className="chip chip--warn">
                    <b>{partial}</b> partial
                  </span>
                  <span className="chip">
                    <b>{unpaid}</b> unpaid
                  </span>
                  <span className="chip chip--gold">
                    <b>₱{fmtPeso(collected)}</b> collected of ₱{fmtPeso(annualFee * roster.length)} potential
                  </span>
                </div>
                {shownRoster.length === 0 ? (
                  <p className="panel-muted">No members match “{searchQ}”.</p>
                ) : (
                  <div className="ledger ledger-scroll">
                    {shownRoster.map((m) => {
                      const s = feeSummary(feePayments.filter((p) => p.member_id === m.id), annualFee)
                      return (
                      <div className="ledger-row" key={m.id}>
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
                          {m.avatar_url ? <img src={m.avatar_url} alt="" /> : initials(m.full_name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.93rem' }}>{m.full_name}</div>
                          <div className="ledger-meta">
                            {m.email} · {m.program || '—'}{m.role !== 'faculty' ? ` · YR ${m.year_level || '—'}` : ''}
                            {m.section ? ` · Sec ${m.section}` : ''}
                          </div>
                        </div>
                        <span
                          className={`chip${s.status === 'paid' ? ' chip--ok' : s.status === 'partial' ? ' chip--warn' : ''}`}
                        >
                          {s.status === 'paid'
                            ? `Paid ₱${fmtPeso(s.paid)}`
                            : s.status === 'partial'
                              ? `Partial ₱${fmtPeso(s.paid)} of ₱${fmtPeso(s.annual)}`
                              : 'Unpaid'}
                        </span>
                      </div>
                    )
                  })}
                  </div>
                )}
              </>
            )
          })()}
        </section>
      )}

      {tab === 'attendance' && (
        <section className="panel">
          <div className="admin-toolbar">
            <div className="field" style={{ marginBottom: 0, minWidth: 240, flex: 1 }}>
              <label>Event</label>
              <Select
                value={attEventId}
                onChange={setAttEventId}
                options={events.map((e) => ({ value: e.id, label: e.title }))}
                placeholder="Select an event…"
              />
            </div>
            <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
              <label>Search</label>
              <input
                type="search"
                placeholder="Name or ID no…"
                value={attQ}
                onChange={(e) => setAttQ(e.target.value)}
              />
            </div>
            <button className="btn btn--primary" onClick={exportAttXlsx} disabled={attRows.length === 0}>
              <Download size={15} /> Export XLSX
            </button>
          </div>
          <div className="tally-strip" style={{ marginBottom: 14 }}>
            {events.map((e) => (
              <span key={e.id} className={`chip${e.id === attEventId ? ' chip--ok' : ''}`}>
                <b style={{ marginRight: 5 }}>{attEventId === e.id ? attRows.length : 0}</b> {e.title}
              </span>
            ))}
            {Number(events.find((e) => e.id === attEventId)?.fee_amount) > 0 && (
              <span className="chip chip--gold">
                {attPayments.length} paid · ₱{fmtPeso(Number(events.find((e) => e.id === attEventId)?.fee_amount) || 0)}
              </span>
            )}
          </div>
          {attRows.length === 0 ? (
            <p className="panel-muted">No scans recorded for this event yet.</p>
          ) : (
            (() => {
              const n = attQ.trim().toLowerCase()
              const shown = attRows.filter(
                (a) => !n || (a.profiles?.full_name || '').toLowerCase().includes(n) || (a.profiles?.id_no || '').toLowerCase().includes(n)
              )
              return (
                <div className={`ledger${shown.length > 10 ? ' ledger-scroll' : ''}`}>
                  {shown.map((a) => (
                  <div className="ledger-row" key={`${a.event_id}-${a.user_id}`}>
                    <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
                      {(a.profiles?.full_name || '?')
                        .split(' ')
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.93rem' }}>
                        {a.profiles?.full_name || a.user_id.slice(0, 10)}
                      </div>
                      <div className="ledger-meta">
                        {a.profiles?.id_no ? `ID ${a.profiles.id_no} · ` : ''}
                        {a.profiles?.program ? `${a.profiles.program}${a.profiles.year_level ? ` (Yr ${a.profiles.year_level})` : ''}` : ''}
                        {' · '}
                        {a.profiles?.email || 'no email'} · scanned {timeAgo(a.scanned_at)}
                      </div>
                    </div>
                    <span className="badge badge--ok">present</span>
                    {attPayments.some((p) => p.member_id === a.user_id) && (
                      <span className="chip chip--ok">paid</span>
                    )}
                  </div>
                ))}
                </div>
              )
            })()
          )}
        </section>
      )}

      {tab === 'fees' && (
        <section className="panel">
          <div className="admin-toolbar">
            <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
              <label>School year</label>
              <Select
                value={feeYear}
                onChange={setFeeYear}
                options={feeYears.map((y) => ({ value: y, label: y }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 220 }}>
              <label>Search</label>
              <input
                type="search"
                placeholder="Search by name or email…"
                value={feeQ}
                onChange={(e) => setFeeQ(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div className="btn-group" role="group" aria-label="Filter by status">
                {['all', 'paid', 'partial', 'unpaid'].map((s) => (
                  <button
                    key={s}
                    className={`btn btn--sm${feeFilter === s ? ' btn--active' : ''}`}
                    onClick={() => setFeeFilter(s)}
                  >
                    {s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              <button className="btn btn--primary" onClick={exportFeeReport} disabled={members.length === 0}>
                <Download size={15} /> Export Report
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <span className="chip chip--gold">Annual fee ₱{fmtPeso(annualFee)}</span>
            {canManageFees && (
              <button className="btn btn--tiny" onClick={changeAnnualFee}>
                <Pencil size={12} style={{ verticalAlign: -1 }} /> Set
              </button>
            )}
            <p className="page-sub" style={{ margin: 0 }}>
              Payments: <b>FULL</b> = {fmtPeso(annualFee)}, <b>HALF</b> = {fmtPeso(annualFee / 2)} · a member is
              PAID once the sum of payments reaches the annual fee.
            </p>
          </div>
          <div className="ledger ledger-scroll">
            {members
              .filter((m) => m.role !== 'superadmin')
              .filter((m) => {
                if (!feeQ.trim()) return true
                const n = feeQ.trim().toLowerCase()
                return m.full_name?.toLowerCase().includes(n) || m.email?.toLowerCase().includes(n)
              })
              .map((m) => {
                const payments = feePayments.filter((p) => p.member_id === m.id)
                const s = feeSummary(payments, annualFee)
                if (feeFilter !== 'all' && s.status !== feeFilter) return null
                return (
                  <div className="ledger-row fee-row" key={m.id}>
                    <div className="avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
                      {m.avatar_url ? <img src={m.avatar_url} alt="" /> : initials(m.full_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.93rem' }}>{m.full_name}</div>
                      <div className="ledger-meta">{m.email} · {m.program || '—'}{m.role !== 'faculty' ? ` · YR ${m.year_level || '—'}` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {payments.length > 0 &&
                        payments.slice(0, 3).map((p) => (
                          <span key={p.id} className={`chip${p.payment_type === 'full' ? ' chip--ok' : ''}`}>
                            {p.payment_type === 'full' ? 'FULL' : '½'} ₱{fmtPeso(p.amount)}
                            {p.receipt ? ` · ${p.receipt}` : ''}
                          </span>
                        ))}
                      {payments.length > 3 && <span className="chip">+{payments.length - 3} more</span>}
                      <span
                        className={`chip${s.status === 'paid' ? ' chip--ok' : s.status === 'partial' ? ' chip--warn' : ''}`}
                      >
                        {s.status === 'paid' ? 'Paid' : s.status === 'partial' ? `Partial ₱${fmtPeso(s.paid)}` : 'Unpaid'}
                        {s.status !== 'paid' && s.balance > 0 ? ` · balance ₱${fmtPeso(s.balance)}` : ''}
                      </span>
                    </div>
                    {canManageFees && (
                      <button className="icon-btn" title={`Record fees for ${m.full_name}`} onClick={() => setFeeModal(m)}>
                        <Pencil size={15} />
                      </button>
                    )}
                  </div>
                )
              })}
          </div>
        </section>
      )}

      {tab === 'maintenance' && (
        <section className="panel">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>Maintenance mode</h3>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.85rem', lineHeight: 1.7 }}>
                When on, students and visitors see the maintenance page instead of the app.
                Officers with console access can still get in to manage things.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label className="switch" aria-label="Toggle maintenance mode">
                <input
                  type="checkbox"
                  checked={maintenance}
                  disabled={saving}
                  onChange={async (e) => {
                    setSaving(true)
                    try {
                      await setMaintenanceFlag(e.target.checked)
                      toast(
                        e.target.checked
                          ? 'Maintenance is ON — students see the maintenance page'
                          : 'Maintenance is OFF — the app is live again'
                      )
                    } catch (err) {
                      console.error(err)
                      toast('Could not update maintenance mode', 'err')
                    } finally {
                      setSaving(false)
                    }
                  }}
                />
                <span className="switch-slider" />
              </label>
              <b style={{ fontSize: '0.95rem' }}>{maintenance ? 'On' : 'Off'}</b>
            </div>
          </div>
          {maintenance && (
            <div className="form-ok" style={{ marginTop: 16 }}>
              Students are currently seeing the maintenance page. You can still use the app.
            </div>
          )}
        </section>
      )}

      {tab === 'audit' && (
        <section className="panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Audit log</h3>
            <p className="page-sub" style={{ margin: 0 }}>
              Sensitive actions (role changes, fees, events, member edits) with the actor id — no PII stored.
            </p>
            <button className="btn btn--tiny" onClick={loadAudit} disabled={saving}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
          {auditLogs.length === 0 ? (
            <p className="panel-muted">No audit entries yet.</p>
          ) : (
            <div className="ledger ledger-scroll">
              {auditLogs.map((l) => (
                <div className="ledger-row" key={l.id}>
                  <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
                    {initials(l.actor_id ? 'Officer' : 'System')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.93rem' }}>
                      {l.action} <span className="badge">{l.entity}</span>
                    </div>
                    <div className="ledger-meta">
                      actor {l.actor_id || 'system'} · {timeAgo(l.created_at)}
                      {l.entity_id ? ` · ${String(l.entity_id).slice(0, 8)}…` : ''}
                      {Object.keys(l.meta || {}).length > 0 ? ` · ${JSON.stringify(l.meta)}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {memberModal && (
        <MemberFormModal
          mode={memberModal.mode}
          member={memberModal.m}
          onClose={() => setMemberModal(null)}
          onSaved={(row) => {
            setMembers((ms) => (memberModal.mode === 'edit' ? ms.map((x) => (x.id === row.id ? row : x)) : [row, ...ms]))
            setMemberModal(null)
            toast(memberModal.mode === 'edit' ? 'Member updated' : 'Member created')
          }}
        />
      )}
      {idModal && <MemberIdModal member={idModal} onClose={() => setIdModal(null)} />}
      {postModal && (
        <PostEditModal
          post={postModal}
          onClose={() => setPostModal(null)}
          onSaved={() => {
            load()
            setPostModal(null)
            toast('Post updated')
          }}
        />
      )}
      {eventModal && (
        <EventEditModal
          event={eventModal}
          onClose={() => setEventModal(null)}
          onSaved={() => {
            load()
            setEventModal(null)
            toast('Event updated')
          }}
        />
      )}
      {feeModal && (
        <FeeModal
          member={feeModal}
          payments={feePayments.filter((p) => p.member_id === feeModal.id)}
          annualFee={annualFee}
          schoolYear={feeYear}
          onClose={() => setFeeModal(null)}
          onRecord={async (opts) => {
            try {
              await recordFee(feeModal.id, opts)
            } catch (e) {
              console.error(e)
              toast('Could not record the payment', 'err')
              return false
            }
            return true
          }}
          onVoid={async (id) => {
            try {
              await voidFee(id)
            } catch (e) {
              console.error(e)
              toast('Could not void the payment', 'err')
              return false
            }
            return true
          }}
        />
      )}
    </div>
  )
}

function MemberIdCard({ member }) {
  const { toast } = useApp()
  const canvasRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        await Promise.allSettled([
          document.fonts.load('700 40px Fraunces'),
          document.fonts.load('700 26px "Share Tech Mono"'),
          document.fonts.load('700 14px "Share Tech Mono"'),
        ])
      } catch {
        /* fonts optional */
      }
      if (alive) await draw()
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.id])

  const draw = async () => {
    const c = document.createElement('canvas')
    try {
      const qr = await QRCode.toDataURL(
        JSON.stringify({ t: 'fnahs-id', id: member.id, n: member.full_name || '', v: 1 }),
        { width: 600, margin: 1, color: { dark: '#2b2410', light: '#ffffff' }, errorCorrectionLevel: 'M' }
      )
      await drawIdCanvas(c, { profile: member, avatarUrl: member.avatar_url, qr })
      canvasRef.current = c
      setPreview(c.toDataURL('image/png'))
      setErr(null)
    } catch (e) {
      console.error(e)
      setErr('Could not render the ID card.')
    }
  }

  const download = () => {
    const c = canvasRef.current
    if (!c) return
    try {
      const a = document.createElement('a')
      a.href = c.toDataURL('image/png')
      a.download = `FNAHS-ID-${(member.full_name || 'member').replace(/\s+/g, '-')}.png`
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      toast(`Saved — ${a.download}`)
    } catch (e) {
      console.error(e)
      toast('Could not export the ID image', 'err')
    }
  }

  return (
    <div className="id-card-cell">
      {preview ? (
        <img src={preview} alt={`Digital ID of ${member.full_name || 'member'}`} className="id-preview" />
      ) : (
        <div className="id-card-loading">{err || 'Rendering ID…'}</div>
      )}
      <div className="id-card-name">{member.full_name || '—'}</div>
      <div className="id-card-meta">
        {member.email} · {member.program || '—'}{member.role !== 'faculty' ? ` · YR ${member.year_level || '—'}` : ''}
      </div>
      <button className="btn btn--ghost btn--sm" disabled={!preview} onClick={download}>
        <Download size={14} /> Save PNG
      </button>
    </div>
  )
}

function MemberIdModal({ member, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          DIGITAL ID <span className="page-kicker">{member.full_name || 'Member'}</span>
        </h2>
        <p className="modal-sub" style={{ margin: '-10px 0 16px', color: 'var(--muted)', fontSize: '0.82rem' }}>
          {member.email} · {member.program || '—'}{member.role !== 'faculty' ? ` · YR ${member.year_level || '—'}` : ''}
        </p>
        <MemberIdCard member={member} />
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

function MemberFormModal({ mode, member, onClose, onSaved }) {
  const { user } = useApp()
  const [form, setForm] = useState(() =>
    mode === 'edit'
      ? { full_name: member.full_name || '', email: member.email || '', program: member.program || PROGRAMS[0], year_level: member.year_level || '1', role: member.role || 'student', positions: member.positions || [] }
      : { full_name: '', email: '', password: '', program: PROGRAMS[0], year_level: '1', role: 'student', positions: [] }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const isSuperadmin = user?.role === 'superadmin'

  // One grouped dropdown for role + positions. Picking an officer position
  // replaces the position list with exactly that one; "Advanced" reveals the
  // multi-select grid for members holding several posts.
  const singlePos = form.positions?.length === 1 ? form.positions[0] : null
  const rolePosValue = singlePos ? `pos:${singlePos}` : `role:${form.role || 'student'}`
  const pickRolePos = (v) => {
    if (v.startsWith('role:')) setForm((f) => ({ ...f, role: v.slice(5) }))
    if (v.startsWith('pos:')) setForm((f) => ({ ...f, positions: [v.slice(4)] }))
  }

  const submit = async () => {
    if (!form.full_name.trim() || !form.email.trim()) {
      setError('Name and email are required.')
      return
    }
    if (mode === 'create' && api.passwordStrength(form.password || '') < 2) {
      setError('Password must be at least 8 characters with at least one letter and one number.')
      return
    }
    setSaving(true)
    try {
      if (mode === 'edit') {
        const { role, positions, ...rest } = form
        const row = await api.updateUser(member.id, rest)
        if (role && role !== member.role) await api.changeRole(member.id, role)
        if (JSON.stringify(positions || []) !== JSON.stringify(member.positions || [])) {
          await api.setPositions(member.id, positions || [])
        }
        onSaved({ ...(row || { ...member, ...rest }), role, positions })
      } else {
        const row = await api.createUser(form)
        onSaved(row)
      }
    } catch (e) {
      console.error(e)
      setError(e.message || 'Could not save the member.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{mode === 'edit' ? 'EDIT MEMBER' : 'ADD MEMBER'}</h2>
        {error && <div className="form-error">{error}</div>}
        <div className="field">
          <label>Full name</label>
          <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Juan Dela Cruz" />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="student@fnahs.edu.ph" />
        </div>
        {mode === 'create' && (
          <div className="field">
            <label>Password <span className="field-hint">(min 8 chars, letter + number — the member signs in with this)</span></label>
            <input type="text" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" autoComplete="new-password" />
          </div>
        )}
        <div className="field">
          <label>Program</label>
          <Select
            value={form.program}
            onChange={(v) => setForm({ ...form, program: v })}
            options={PROGRAMS.map((p) => ({ value: p, label: p }))}
          />
        </div>
        {form.role !== 'faculty' && (
          <div className="field">
            <label>Year level</label>
            <Select
              value={form.year_level}
              onChange={(v) => setForm({ ...form, year_level: v })}
              options={['1', '2', '3', '4', '—'].map((y) => ({ value: y, label: y === '—' ? 'Faculty' : `Year ${y}` }))}
            />
          </div>
        )}
        {isSuperadmin && (
          <>
            <div className="field">
              <label>Role / Officer position</label>
              <Select
                value={rolePosValue}
                onChange={pickRolePos}
                options={[
                  { label: 'Roles', options: ROLES.map((r) => ({ value: `role:${r}`, label: roleLabel(r) })) },
                  { label: 'Officer positions', options: POSITIONS.map((p) => ({ value: `pos:${p}`, label: positionLabel(p) })) },
                ]}
                placeholder="Choose a role or position…"
              />
              <p className="field-hint">
                Pick a position to grant exactly its toolset. Members holding several posts can use Advanced.
              </p>
            </div>
            {advanced && (
              <div className="field">
                <label>Positions <span className="field-hint">(multi-select)</span></label>
                <div className="pos-grid">
                  {POSITIONS.map((p) => {
                    const on = form.positions?.includes(p)
                    return (
                      <button
                        key={p}
                        type="button"
                        className={`pos-chip${on ? ' pos-chip--on' : ''}`}
                        onClick={() =>
                          setForm((f) => ({ ...f, positions: on ? f.positions.filter((x) => x !== p) : [...(f.positions || []), p] }))
                        }
                      >
                        {positionLabel(p)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <button type="button" className="btn btn--tiny" onClick={() => setAdvanced((a) => !a)}>
              {advanced ? 'Hide advanced positions' : 'Advanced positions…'}
            </button>
          </>
        )}
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={saving} onClick={submit}>
            {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create member'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PostEditModal({ post, onClose, onSaved }) {
  const [content, setContent] = useState(post.content || '')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!content.trim()) return
    setSaving(true)
    try {
      await api.updatePost(post.id, { content: content.trim() })
      onSaved()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>EDIT POST</h2>
        <div className="field">
          <label>Content</label>
          <textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
<div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={saving} onClick={submit}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FeeModal({ member, payments, annualFee, schoolYear, onClose, onRecord, onVoid }) {
  const [type, setType] = useState('full')
  const [receipt, setReceipt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const s = feeSummary(payments, annualFee)
  const amount = annualFee * (type === 'half' ? 0.5 : 1)

  const submit = async () => {
    setSaving(true)
    setError('')
    try {
      const ok = await onRecord({ type, receipt: receipt.trim() })
      if (ok) {
        setReceipt('')
        setType('full')
      }
    } catch (e) {
      console.error(e)
      setError(e.message || 'Could not record the payment.')
    } finally {
      setSaving(false)
    }
  }

  const voidOne = async (id, label) => {
    if (!window.confirm(`Void ${label}? This cannot be undone.`)) return
    setError('')
    try {
      await onVoid(id)
    } catch (e) {
      console.error(e)
      setError(e.message || 'Could not void the payment.')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          FEES <span className="page-kicker">{member.full_name}</span>
        </h2>
        <p className="modal-sub" style={{ margin: '-10px 0 16px', color: 'var(--muted)', fontSize: '0.82rem' }}>
          {schoolYear} · {member.program || '—'}{member.role !== 'faculty' ? ` · YR ${member.year_level || '—'}` : ''}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <span
            className={`chip${s.status === 'paid' ? ' chip--ok' : s.status === 'partial' ? ' chip--warn' : ''}`}
          >
            {s.status === 'paid' ? 'PAID' : s.status === 'partial' ? 'PARTIAL' : 'UNPAID'}
          </span>
          <span className="chip">
            Paid ₱{fmtPeso(s.paid)} · Annual fee ₱{fmtPeso(annualFee)}
          </span>
          {s.balance > 0 && <span className="chip">Balance ₱{fmtPeso(s.balance)}</span>}
        </div>

        {payments.length > 0 && (
          <div className="ledger" style={{ marginBottom: 18 }}>
            {payments.map((p) => (
              <div className="ledger-row" key={p.id}>
                <div
                  className="avatar"
                  style={{ width: 30, height: 30, fontSize: 11, background: p.payment_type === 'full' ? 'var(--ok)' : 'var(--gold)' }}
                >
                  {p.payment_type === 'full' ? 'F' : '½'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {p.payment_type === 'full' ? 'Full payment' : 'Half payment'} · ₱{fmtPeso(p.amount)}
                  </div>
                  <div className="ledger-meta">
                    {new Date(p.paid_at).toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' })}
                    {p.receipt ? ` · OR ${p.receipt}` : ' · no OR recorded'}
                  </div>
                </div>
                <button className="btn btn--tiny btn--danger" onClick={() => voidOne(p.id, `${p.payment_type} payment`)}>
                  Void
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="btn-group" style={{ marginBottom: 12 }}>
          {['full', 'half'].map((t) => (
            <button
              key={t}
              type="button"
              className={`btn${type === t ? ' btn--active' : ''}`}
              onClick={() => setType(t)}
              style={{ borderRadius: 12 }}
            >
              {t === 'full' ? `Full — ₱${fmtPeso(annualFee)}` : `Half — ₱${fmtPeso(annualFee / 2)}`}
            </button>
          ))}
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Receipt / OR number <span className="field-hint">(optional)</span></label>
          <input
            value={receipt}
            onChange={(e) => setReceipt(e.target.value)}
            placeholder="OR-2026-001"
            disabled={saving}
          />
        </div>
        {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
          <button className="btn btn--primary" disabled={saving || amount <= 0} onClick={submit}>
            {saving ? 'Recording…' : `Record ₱${fmtPeso(amount)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function EventEditModal({ event, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: event.title || '',
    description: event.description || '',
    location: event.location || '',
    starts_at: event.starts_at ? event.starts_at.slice(0, 16) : '',
    ends_at: event.ends_at ? event.ends_at.slice(0, 16) : '',
    fee_amount: event.fee_amount ? String(event.fee_amount) : '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.title.trim() || !form.location.trim() || !form.starts_at) {
      setError('Title, location, and start time are required.')
      return
    }
    const fee = Number(form.fee_amount)
    if (form.fee_amount.trim() && (!Number.isFinite(fee) || fee < 0)) {
      setError('Enter a valid contribution fee.')
      return
    }
    setSaving(true)
    try {
      await api.updateEvent(event.id, {
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : new Date(new Date(form.starts_at).getTime() + 2 * 3600e3).toISOString(),
        fee_amount: form.fee_amount.trim() ? fee : 0,
      })
      onSaved()
    } catch (e) {
      console.error(e)
      setError(e.message || 'Could not save the event.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>EDIT EVENT</h2>
        {error && <div className="form-error">{error}</div>}
        <div className="field">
          <label>Event title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="field">
          <label>Location</label>
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </div>
        <div className="field">
          <label>Starts at</label>
          <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
        </div>
        <div className="field">
          <label>Ends at <span className="hint">(optional)</span></label>
          <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
        </div>
        <div className="field">
          <label>Contribution fee <span className="field-hint">(₱, 0 for free)</span></label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.fee_amount}
            onChange={(e) => setForm({ ...form, fee_amount: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" disabled={saving} onClick={submit}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
