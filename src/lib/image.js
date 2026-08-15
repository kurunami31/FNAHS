const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 4 * 1024 * 1024
const MAX_DATA_URL = 2_500_000

export function pickImageFile(file, toast, onReady) {
  if (!file) return
  if (!ALLOWED.includes(file.type)) {
    toast('Only JPEG, PNG, WebP or GIF images', 'err')
    return
  }
  if (file.size > MAX_BYTES) {
    toast('Image too large (max 4MB)', 'err')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const accept = (dataUrl) => {
      if (dataUrl.length > MAX_DATA_URL) {
        toast('Image too large — try a smaller photo', 'err')
        return
      }
      onReady(dataUrl, file.name)
    }
    if (file.type === 'image/gif') {
      accept(reader.result)
      return
    }
    const img = new Image()
    img.onload = () => {
      const MAX = 1200
      const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      accept(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => accept(reader.result)
    img.src = reader.result
  }
  reader.readAsDataURL(file)
}
