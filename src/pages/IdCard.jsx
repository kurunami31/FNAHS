import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { toPng } from 'html-to-image'
import { Download, ShieldCheck, Loader2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { can, roleLabel, positionLabel } from '../rbac'
import { api } from '../lib/api'
import { initials, monthDay, timeAgo } from '../lib/format'

export default function IdCard() {
  const { user, toast } = useApp()
  const cardRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => {
    api
      .getMyAttendance()
      .then(setHistory)
      .catch(() => {})
  }, [])

  const isStaff = can(user, 'feed.moderate') || can(user, 'events.manage') || can(user, 'attendance.scan')
  const name = user?.full_name || 'Student Member'
  const qrValue = JSON.stringify({ t: 'fnahs-id', id: user?.id || 'demo', n: name, v: 1 })
  const serial =
    (user?.id || 'demo')
      .toString()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 12)
      .padEnd(12, '·') || 'DEMO·······'

  const download = async () => {
    const node = cardRef.current
    if (!node || saving) return
    setSaving(true)
    try {
      try {
        await document.fonts.ready
      } catch {
        /* ignore */
      }
      const dataUrl = await toPng(node, { pixelRatio: Math.min(window.devicePixelRatio || 1, 2) })
      const file = new File([await (await fetch(dataUrl)).blob()], 'FNAHS-ID.png', { type: 'image/png' })
      const fallback = () => {
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = 'FNAHS-ID.png'
        a.click()
        toast('Saved — check your downloads folder')
      }
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'FNAHS ID', text: 'My FNAHS digital ID.' })
        } catch (err) {
          if (err.name !== 'AbortError') fallback()
        }
      } else {
        fallback()
      }
    } catch (e) {
      console.error(e)
      toast('Could not export the ID image', 'err')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-c">
      <h1 className="page-title">
        MY ID <span className="page-kicker">digital id pass</span>
      </h1>
      <p className="page-sub">One QR ID for every FNAHS event — scan at the door and attendance is logged on the fly.</p>

      <div className="id-stage">
        <div className="id-card" ref={cardRef}>
          <div className="id-sheen" />
          <div className="id-head">
            <div className="seal-mini">
              <img src="/FNAHS.png" alt="" />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="id-org">FNAHS</div>
              <div className="id-fac">Faculty of Nursing &amp; Allied Health Sciences</div>
            </div>
            <div className="id-valid">
              VALID<br />2026–2027
            </div>
          </div>
          <div className="id-mid">
            <div className="id-photo">
              {user?.avatar_url ? <img src={user.avatar_url} alt="" /> : <span className="ph-initials">{initials(name)}</span>}
            </div>
            <div className="id-details">
              <div className="id-name">{name}</div>
              <div className="id-rows">
                <div className="id-row">PROGRAM&nbsp;&nbsp;<b>{user?.program || 'BS Nursing'}</b></div>
                <div className="id-row">YEAR&nbsp;&nbsp;<b>{user?.year_level || '—'}</b></div>
                <div className="id-row">ROLE&nbsp;&nbsp;<b>{roleLabel(user?.role)}</b></div>
                {!!user?.positions?.length && (
                  <div className="id-row">POSITION&nbsp;&nbsp;<b>{user.positions.map(positionLabel).join(' · ')}</b></div>
                )}
              </div>
            </div>
          </div>
          <div className="id-foot">
            <div>
              <div className="id-qr-box">
                <QRCodeSVG value={qrValue} size={70} level="M" />
              </div>
              <div className="id-qr-note">scan at events</div>
            </div>
            <div className="id-foot-right">
              <div className="id-serial">ID {serial}</div>
              <div className="id-stamp">FNAHS</div>
            </div>
          </div>
        </div>

        <div className="id-actions">
          <button className="btn btn--primary" onClick={download} disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : <Download size={16} />} Save as image
          </button>
          <span className="chip chip--ok">
            <ShieldCheck size={14} /> Verified by org staff
          </span>
        </div>
      </div>

      <section className="sec" aria-labelledby="h-history" style={{ maxWidth: 640, margin: '34px auto 0', width: '100%' }}>
        <div className="sec-head">
          <h2 id="h-history">Attendance History</h2>
          <span className="sec-kicker">{history.length} scan{history.length === 1 ? '' : 's'}</span>
        </div>
        {history.length === 0 ? (
          <p className="panel-muted">You haven't been scanned into any event yet — your next one is a great start.</p>
        ) : (
          <div className="ledger">
            {history.map((h) => (
              <div key={`${h.event_id}-${h.scanned_at}`} className="ledger-row">
                <div className="round-date" style={{ borderRight: 'none', width: 44 }}>
                  <b style={{ fontSize: '1.15rem' }}>{monthDay(h.starts_at).day}</b>
                  <span>{monthDay(h.starts_at).month}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.93rem' }}>{h.title}</div>
                  <div className="ledger-meta">{h.location || '—'} · scanned {timeAgo(h.scanned_at)}</div>
                </div>
                <span className="badge badge--ok">present</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}