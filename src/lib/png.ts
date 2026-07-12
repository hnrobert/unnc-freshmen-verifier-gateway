/**
 * Decode image bytes (PNG/JPEG/…) to RGBA pixels in the browser using a canvas.
 * Used by the captcha solver to read the slider background/piece bitmaps. No
 * external image library required.
 */
export interface DecodedImage {
  width: number
  height: number
  /** RGBA, row-major, length = width * height * 4. */
  data: Uint8ClampedArray
}

export async function decodeImage(buffer: ArrayBuffer): Promise<DecodedImage> {
  const blob = new Blob([buffer], { type: 'image/png' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return { width: canvas.width, height: canvas.height, data }
  } finally {
    URL.revokeObjectURL(url)
  }
}
