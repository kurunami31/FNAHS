import { QRCodeSVG } from 'qrcode.react'
import { useApp } from '../context/AppContext'
import { QrCode, Download } from 'lucide-react'

export default function IdCard() {
  const { user, toast } = useApp()

  const qrValue = JSON.stringify({
    t: 'fnahs-id',
    id: user?.id || 'demo',
    n: user?.full_name || 'FNAHS Student',
    v: 1,
  })

  const download = () => {
    const node = document.getElementById('fnahs-id-card')
    if (!node) return
    // Simple snapshot via SVG foreignObject is unreliable; just toast.
    toast('Screenshot the card to save it as an image')
  }

  return (
    <div>
      <h1 className="page-title">MY ID</h1>
      <p className="page-sub">One QR ID for every FNAHS event — scan at the door, attendance logged.</p>

      <div className="id-stage">
        <div className="id-card" id="fnahs-id-card">
          <div className="id-top">
            <img src="/FNAHS.png" alt="FNAHS" />
            <div>
              <div className="id-org">FACULTY OF NURSING &<br />ALLIED HEALTH <em>SCIENCES</em></div>
              <div className="id-tag">student digital id · 2026</div>
            </div>
          </div>

          <div className="id-mid">
            <div className="qr">
              <QRCodeSVG value={qrValue} size={80} level="M" />
            </div>
            <div className="id-details">
              <div className="id-name">{user?.full_name || 'Student Member'}</div>
              <div className="id-row">PROGRAM&nbsp;&nbsp;<b>{user?.program || 'BS Nursing'}</b></div>
              <div className="id-row">YEAR LEVEL&nbsp;&nbsp;<b>{user?.year_level || '—'}</b></div>
              <div className="id-row">ROLE&nbsp;&nbsp;<b>{user?.role || 'student'}</b></div>
            </div>
          </div>

          <div className="id-bottom">
            <div className="id-num">{String(user?.id || 'FN-2026-0000').toUpperCase().slice(0, 14)}</div>
            <div className="id-stamp">◢ FNAHS</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn--ghost btn--sm" onClick={download}>
            <Download size={15} /> Save as image
          </button>
          <span className="chip"><QrCode size={14} /> QR verified by org staff</span>
        </div>
      </div>
    </div>
  )
}
