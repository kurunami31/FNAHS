import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Download, ShieldCheck, Loader2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { can } from '../rbac'
import { api } from '../lib/api'
import { monthDay, timeAgo } from '../lib/format'
import { drawIdCanvas } from '../lib/idCanvas'

export default function IdCard() {
  const { user, toast } = useApp()
  const canvasRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [err, setErr] = useState(null)
  const [saving, setSaving] = useState(false)
  const [format, setFormat] = useState('png')
  const [saveImage, setSaveImage] = useState(null)
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
    try {
      const qr = await QRCode.toDataURL(qrValue, {
        width: 600,
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
      const isJpeg = format === 'jpeg'
      const mime = isJpeg ? 'image/jpeg' : 'image/png'
      const ext = isJpeg ? 'jpg' : 'png'
      const fileName = `FNAHS-ID.${ext}`

      const blob = await new Promise((res) => c.toBlob(res, mime, 0.92))
      if (!blob) throw new Error('Could not render the image.')
      const url = URL.createObjectURL(blob)
      const file = new File([blob], fileName, { type: mime })
      const ua = navigator.userAgent || ''
      const isIOS = /iPad|iPhone|iPod/.test(ua)
      const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|Edg|OPR/.test(ua)

      const revokeLater = (ms = 60_000) => setTimeout(() => URL.revokeObjectURL(url), ms)

      const saveToDownloads = () => {
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
        revokeLater()
        toast(`Saved — check your downloads folder (${ext.toUpperCase()})`)
      }

      // Mobile / Safari: native share sheet when supported, otherwise show the image
      // full-screen so it can be long-pressed / right-clicked to save.
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'FNAHS PULSO ID', text: 'My FNAHS PULSO digital ID.' })
          revokeLater()
        } catch (shareErr) {
          if (shareErr.name !== 'AbortError') {
            if (isIOS || isSafari) setSaveImage(url)
            else saveToDownloads()
          }
        }
      } else if (isIOS || isSafari) {
        setSaveImage(url)
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
      <p className="page-sub">One QR ID for every FNAHS PULSO event — scan at the door and attendance is logged on the fly.</p>

      <div className="id-stage">
        {preview ? (
          <img src={preview} alt="Your FNAHS digital ID" className="id-preview" />
        ) : (
          <div className="id-card-loading">{err || 'Rendering your ID…'}</div>
        )}

        <div className="id-actions">
          <div className="id-format" role="group" aria-label="Image format">
            <button type="button" className={format === 'png' ? 'is-on' : ''} onClick={() => setFormat('png')} disabled={saving}>
              PNG
            </button>
            <button type="button" className={format === 'jpeg' ? 'is-on' : ''} onClick={() => setFormat('jpeg')} disabled={saving}>
              JPEG
            </button>
          </div>
          <button className="btn btn--primary" onClick={download} disabled={saving || !preview}>
            {saving ? <Loader2 size={16} className="spin" /> : <Download size={16} />} Save as {format === 'jpeg' ? 'JPEG' : 'PNG'}
          </button>
          {isStaff && (
            <span className="chip chip--ok">
              <ShieldCheck size={14} /> Verified by org staff
            </span>
          )}
        </div>
      </div>

      {saveImage && (
        <div className="id-save-overlay" role="dialog" aria-modal="true" onClick={() => setSaveImage(null)}>
          <div className="id-save-pop" onClick={(e) => e.stopPropagation()}>
            <img src={saveImage} alt="Your FNAHS digital ID — press and hold to save" />
            <p>
              <b>Press and hold</b> the image, then choose <b>Save Image</b> or <b>Add to Photos</b>.
            </p>
            <button type="button" className="btn" onClick={() => setSaveImage(null)}>
              Done
            </button>
          </div>
        </div>
      )}

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