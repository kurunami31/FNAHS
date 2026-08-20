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
// live hardware check), then unlabeled, then front. On desktop there is
// usually a single webcam, so the list length is 1.
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

// Build the getUserMedia video constraints. We rely on facingMode alone:
// pinning an exact deviceId is what causes iOS Safari to open the FRONT
// camera (deviceId from enumerateDevices is unreliable there and an exact
// constraint overrides the rear-camera hint). iOS and modern Android both
// honour `facingMode: { ideal }`.
export function cameraConstraints(list, index, useEnv) {
  return { facingMode: { ideal: useEnv ? 'environment' : 'user' } }
}