import { Html5Qrcode } from 'html5-qrcode'

function looksBack(label) {
  return /back|rear|environment|tr\s?as|arriere|hinter/i.test(label || '')
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

async function testFacing(id) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { deviceId: { exact: id } },
    })
    const track = stream.getVideoTracks()[0]
    const facing = track && track.getSettings ? track.getSettings().facingMode : null
    stream.getTracks().forEach((t) => t.stop())
    return facing
  } catch {
    return null
  }
}

// Returns camera devices with the rear camera first (by label, then by a
// live hardware check), then unlabeled, then front. Works on desktop (only
// one webcam -> that one is returned) and on phones (rear camera first).
export async function enumerateCameras() {
  try {
    await withPermission()
    const devices = await navigator.mediaDevices.enumerateDevices()
    const inputs = devices.filter((d) => d.kind === 'videoinput')
    const detailed = await Promise.all(
      inputs.map(async (d) => ({
        id: d.deviceId,
        label: d.label || 'Camera',
        facing: looksBack(d.label)
          ? 'environment'
          : looksFront(d.label)
            ? 'user'
            : await testFacing(d.deviceId),
      }))
    )
    const env = detailed.filter((c) => c.facing === 'environment')
    const unk = detailed.filter((c) => c.facing !== 'environment' && c.facing !== 'user')
    const user = detailed.filter((c) => c.facing === 'user')
    return [...env, ...unk, ...user]
  } catch {
    return []
  }
}

// Hard deviceId (exact) + soft facingMode hint. The exact deviceId is what
// actually forces the rear camera on phones that ignore facingMode alone.
export function cameraId(list, index) {
  if (!list || list.length === 0) return 'any'
  return list[index % list.length].id
}

export function cameraFor(list, index) {
  if (!list || list.length === 0) return { facingMode: { ideal: 'environment' } }
  const cam = list[index % list.length]
  return { deviceId: { exact: cam.id }, facingMode: { ideal: 'environment' } }
}

export function cameraLabel(list, index) {
  if (!list || list.length === 0) return ''
  return list[index % list.length].label || ''
}