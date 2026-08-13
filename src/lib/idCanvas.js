import { initials } from './format'

export const ID_W = 856
export const ID_H = 540

const INK = '#2b2410'
const MUT = '#8a7d5c'
const ROW = '#6b5b2e'
const GOLD = '#c09000'
const GOLD_D = '#a06d00'
const OCR = '"Share Tech Mono", "Courier New", monospace'
const FACE = "'Fraunces', Georgia, serif"

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function fitFont(ctx, text, family, max, min, width) {
  let size = max
  for (; size > min; size -= 1) {
    ctx.font = `700 ${size}px ${family}`
    if (ctx.measureText(text).width <= width) break
  }
  return size
}

function ellipse(text, max) {
  let t = text
  while (t.length > 1 && t.length > max) t = t.slice(0, -1)
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

function loadImage(src, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
    setTimeout(() => reject(new Error('image load timed out')), timeout)
  })
}

async function loadAvatar(src) {
  try {
    const busted = `${src}${src.includes('?') ? '&' : '?'}dl=${Date.now()}`
    const res = await fetch(busted)
    if (!res.ok) throw new Error('fetch failed')
    const blob = await res.blob()
    return loadImage(URL.createObjectURL(blob))
  } catch {
    return loadImage(src, 4000)
  }
}

export async function drawIdCanvas(c, { profile, avatarUrl, qr }) {
  const ctx = c.getContext('2d')
  const W = ID_W
  const H = ID_H

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#fffdf6')
  bg.addColorStop(0.55, '#fdf9ef')
  bg.addColorStop(1, '#f6ecce')
  ctx.fillStyle = bg
  rr(ctx, 0, 0, W, H, 36)
  ctx.fill()
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 4
  ctx.stroke()

  try {
    const wm = await loadImage('/FNAHS.png')
    const wmH = 300
    const wmW = Math.round(wmH * (wm.width / wm.height))
    ctx.save()
    ctx.globalAlpha = 0.1
    ctx.drawImage(wm, (W - wmW) / 2, (H - wmH) / 2, wmW, wmH)
    ctx.restore()
  } catch {
    /* watermark optional */
  }

  const l = W - 28

  let sealOk = false
  try {
    const seal = await loadImage('/FNAHS.png')
    ctx.save()
    rr(ctx, 28, 28, 76, 76, 16)
    ctx.clip()
    ctx.drawImage(seal, 28, 28, 76, 76)
    ctx.restore()
    sealOk = true
  } catch {
    /* placeholder below */
  }
  if (!sealOk) {
    ctx.fillStyle = GOLD
    rr(ctx, 28, 28, 76, 76, 16)
    ctx.fill()
    ctx.fillStyle = '#fffdf6'
    ctx.font = `700 30px ${FACE}`
    ctx.textAlign = 'center'
    ctx.fillText('F', 66, 76)
    ctx.textAlign = 'left'
  }

  ctx.textAlign = 'right'
  ctx.fillStyle = GOLD_D
  ctx.font = `700 26px ${OCR}`
  ctx.fillText('FNAHS', l, 62)
  ctx.fillStyle = MUT
  ctx.font = `12px ${OCR}`
  ctx.fillText('FACULTY OF NURSING & ALLIED HEALTH SCIENCES', l, 86)
  ctx.textAlign = 'left'

  const sy = 112
  const strip = ctx.createLinearGradient(0, sy, W, sy)
  strip.addColorStop(0, GOLD)
  strip.addColorStop(1, GOLD_D)
  ctx.fillStyle = strip
  ctx.fillRect(0, sy, W, 30)
  ctx.fillStyle = '#fff8e6'
  ctx.font = `14px ${OCR}`
  ctx.textAlign = 'center'
  ctx.fillText('OFFICIAL STUDENT IDENTITY · FNAHS', W / 2, sy + 20)
  ctx.textAlign = 'left'

  const name = profile?.full_name || 'Student Member'
  const parts = name.trim().split(/\s+/)
  const firstName =
    (profile?.first_name || parts[0] || '').trim().replace(/\.$/, '') ||
    profile?.first_name ||
    ''
  const surname = (profile?.surname || parts[parts.length - 1] || firstName).trim()
  const middleInitial = (profile?.middle_initial || '').trim().replace(/\.$/, '').toUpperCase()
  const px = 44
  const py = 162
  const pw = 150
  const ph = 187
  let photoOk = false
  if (avatarUrl) {
    try {
      const img = await loadAvatar(avatarUrl)
      const scale = Math.min(img.width / pw, img.height / ph)
      const dw = img.width / scale
      const dh = img.height / scale
      const dx = px + (pw - dw) / 2
      const dy = py + (ph - dh) / 2
      ctx.save()
      rr(ctx, px, py, pw, ph, 16)
      ctx.clip()
      ctx.drawImage(img, dx, dy, dw, dh)
      ctx.restore()
      photoOk = true
    } catch {
      /* fallback below */
    }
  }
  if (!photoOk) {
    const pg = ctx.createLinearGradient(px, py, px + pw, py + ph)
    pg.addColorStop(0, '#f6e9c4')
    pg.addColorStop(1, '#e9d08f')
    ctx.fillStyle = pg
    rr(ctx, px, py, pw, ph, 16)
    ctx.fill()
    ctx.fillStyle = GOLD_D
    ctx.font = `700 46px ${FACE}`
    ctx.textAlign = 'center'
    ctx.fillText(initials(name), px + pw / 2, py + ph / 2 + 16)
    ctx.textAlign = 'left'
  }
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 4
  rr(ctx, px, py, pw, ph, 16)
  ctx.stroke()

  const qx = l - 210
  const qy = py
  const qs = 210
  if (qr) {
    try {
      const qImg = await loadImage(qr)
      ctx.drawImage(qImg, qx, qy, qs, qs)
      ctx.strokeStyle = INK
      ctx.lineWidth = 3
      rr(ctx, qx, qy, qs, qs, 8)
      ctx.stroke()
    } catch {
      /* qr skipped */
    }
  }
  ctx.fillStyle = MUT
  ctx.font = `11px ${OCR}`
  ctx.textAlign = 'center'
  ctx.fillText('SCAN ME', qx + qs / 2, qy + qs + 22)
  ctx.textAlign = 'left'

  const cx = 220
  const cw = qx - cx - 24
  ctx.fillStyle = MUT
  ctx.font = `11px ${OCR}`
  ctx.fillText('NAME', cx, py + 26)

  const smallName = `${firstName.toUpperCase()}${middleInitial ? ` ${middleInitial}.` : ''}`.trim()
  if (smallName) {
    ctx.fillStyle = INK
    ctx.font = `14px ${OCR}`
    ctx.fillText(ellipse(smallName, 34), cx, py + 50)
  }
  const ns = fitFont(ctx, surname.toUpperCase(), FACE, 42, 18, cw)
  ctx.font = `700 ${ns}px ${FACE}`
  ctx.fillStyle = INK
  ctx.fillText(ellipse(surname.toUpperCase(), 26), cx, py + 88)

  ctx.fillStyle = MUT
  ctx.font = `11px ${OCR}`
  ctx.fillText('DETAILS', cx, py + 122)

  const rows = []
  if (profile?.program) rows.push(['PROGRAM', profile.program])
  if (profile?.year_level) rows.push(['YEAR', profile.year_level])
  if (profile?.section) rows.push(['SEC', profile.section])
  if (profile?.role && profile.role !== 'student') rows.push(['ROLE', profile.role.replace(/^\w/, (ch) => ch.toUpperCase())])
  if (profile?.positions?.length) rows.push(['POSITION', profile.positions.join(' · ')])
  const serial = String(profile?.id || 'demo').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  rows.push(['ID', serial])

  ctx.font = `14px ${OCR}`
  const rowY = py + 148
  rows.forEach(([k, v], i) => {
    ctx.fillStyle = ROW
    ctx.fillText(`${k} : ${ellipse(String(v).toUpperCase(), 30)}`, cx, rowY + i * 24)
  })

  const ey = H - 76
  ctx.strokeStyle = 'rgba(192, 144, 0, 0.55)'
  ctx.lineWidth = 2
  ctx.beginPath()
  let x = 44
  ctx.moveTo(x, ey)
  x += 200
  ctx.lineTo(x, ey)
  ctx.lineTo(x + 14, ey - 12)
  ctx.lineTo(x + 28, ey + 10)
  ctx.lineTo(x + 42, ey)
  x += 42
  ctx.lineTo(l, ey)
  ctx.stroke()

  ctx.fillStyle = MUT
  ctx.font = `12px ${OCR}`
  ctx.fillText('DAVAO ORIENTAL STATE UNIVERSITY', 44, H - 30)
  ctx.fillStyle = GOLD_D
  ctx.textAlign = 'right'
  ctx.fillText('FNAHS · NURSING & ALLIED HEALTH SCIENCES', l, H - 30)
  ctx.textAlign = 'left'
}