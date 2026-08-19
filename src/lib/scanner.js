import { Html5Qrcode } from 'html5-qrcode'

function looksBack(label) {
  return /back|rear|environment|tr\s?as|arriere|hinter|behind/i.test(label || '')
}

function looksFront(label) {
  return /front|user|selfie|vorne|face/i.test(label || '')
}

async function withPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
    stream.getTracks().forEach((t) => t.stop())
  } catch {
    /* ignore */
  }
}

export async function enumerateCameras() {
  try {
    await withPermission()
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices
      .filter((d) => d.kind === 'videoinput')
      .map((d) => ({ id: d.deviceId, label: d.label || 'Camera' }))
  } catch {
    return []
  }
}

async function testFacing(id) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { deviceId: { exact: id } },
    })
    const track = stream.getVideoTracks()[0]
    const facing = track && track.getSettings ? track.getSettings().facingMode : null
    stream.getTracks().forEach((t) => t.stop())
    return facing === 'environment' ? 'environment' : null
  } catch {
    return null
  }
}

export function cameraAt(cams, index) {
  if (!cams || cams.length === 0) return { facingMode: 'environment' }
  return cams[index % cams.length].id
}

export async function pickRearCamera() {
  const cams = await enumerateCameras()
  if (cams.length === 0) return { facingMode: 'environment' }
  const back = cams.find((c) => looksBack(c.label))
  if (back) return back.id
  for (const cam of cams) {
    const f = await testFacing(cam.id)
    if (f === 'environment') return cam.id
  }
  const nonFront = cams.find((c) => !looksFront(c.label))
  if (nonFront) return nonFront.id
  return cams[0].id
}