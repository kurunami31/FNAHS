import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Download, ShieldCheck, Loader2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { can } from '../rbac'
import { api } from '../lib/api'
import { monthDay, timeAgo } from '../lib/format'
import { drawIdCanvas, ID_W, ID_H } from '../lib/idCanvas'

export default function IdCard() {
  const { user, toast } = useApp()
  const canvasRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [err, setErr] = useState(null)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => {
    api
      .getMyAttendance()
      .then(setHistory)
      .catch(() => {})
  }, [])

  const name = user?.full_name || 'Student Member'
  const qrValue = JSON.stringify({ t: 'fnahs-id', id: user?.id || 'demo', n: name, v: 1 })

  const draw = async () => {
    const c = document.createElement('canvas')
    c.width = ID_W
    c.height = ID_H
    try {
      const qr = await QRCode.toDataURL(qrValue, {
        width: 480,
        margin: 1,
        color: { dark: '#2b2410', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      })
      await drawIdCanvas(c, { profile: user, avatarUrl: user?.avatar_url, qr })
      canvasRef.current = c
      setPreview(c.toDataURL('image/png'))
      setErr(null)
    } catch (e) {
      console.error(e)
      setErr('Could not render your ID. Pull to refresh and try again.')
    }
  }

  const profileKey = JSON.stringify([
    user?.id,
    user?.full_name,
    user?.avatar_url,
    user?.program,
    user?.year_level,
    user?.section,
    user?.role,
    user?.positions,
  ])

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
  }, [profileKey])

  const download = async () => {
    const c = canvasRef.current
    if (!c || saving) return
    setSaving(true)
    try {
      const blob = await new Promise((res) => c.toBlob(res, 'image/png'))
      if (!blob) throw new Error('Could not render the PNG.')
      const url = URL.createObjectURL(blob)
      const file = new File([blob], 'FNAHS-ID.png', { type: 'image/png' })
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '')

      const saveToDownloads = () => {
        const a = document.createElement('a')
        a.href = url
        a.download = 'FNAHS-ID.png'
        a.rel = 'noopener'
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 4000)
        toast('Saved — check your downloads folder')
      }

      // Mobile path: native share sheet (Save to Files / Save Image on iOS, Share on Android).
      // Desktop path: file share sheet if supported (Chromium/Edge), else direct download.
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'FNAHS ID', text: 'My FNAHS digital ID.' })
          setTimeout(() => URL.revokeObjectURL(url), 4000)
        } catch (shareErr) {
          if (shareErr.name !== 'AbortError') saveToDownloads()
        }
      } else if (isIOS) {
        // iOS without file sharing: open the image so the user can long-press → Save Image.
        window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
        toast('Tap and hold the image to save it')
      } else {
        saveToDownloads()
      }
    } catch (e) {
      console.error(e)
      toast('Could not export the ID image', 'err')
    } finally {
      setSaving(false)
    }
  }

  const isStaff = can(user, 'feed.moderate') || can(user, 'events.manage') || can(user, 'attendance.scan')

  return (
    <div className="page-c">
      <h1 className="page-title">
        MY ID <span className="page-kicker">digital id pass</span>
      </h1>
      <p className="page-sub">One QR ID for every FNAHS event — scan at the door and attendance is logged on the fly.</p>

      <div className="id-stage">
        {preview ? (
          <img src={preview} alt="Your FNAHS digital ID" className="id-preview" />
        ) : (
          <div className="id-card-loading">{err || 'Rendering your ID…'}</div>
        )}

        <div className="id-actions">
          <button className="btn btn--primary" onClick={download} disabled={saving || !preview}>
            {saving ? <Loader2 size={16} className="spin" /> : <Download size={16} />} Save as image
          </button>
          {isStaff && (
            <span className="chip chip--ok">
              <ShieldCheck size={14} /> Verified by org staff
            </span>
          )}
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