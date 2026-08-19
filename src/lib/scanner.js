import { Html5Qrcode } from 'html5-qrcode'

export async function pickRearCamera() {
  try {
    const cameras = await Html5Qrcode.getCameras()
    if (cameras && cameras.length > 0) {
      const back = cameras.find((c) => /back|rear|environment|tr\s?as|arriere/i.test(c.label || ''))
      if (back && back.id) return back.id
    }
  } catch {
    /* permission denied or enumeration unsupported — fall back below */
  }
  return { facingMode: 'environment' }
}