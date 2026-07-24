import sharp from 'sharp'

/**
 * Composites a semi-transparent text watermark onto a base64 image (data: URL).
 * Uses sharp: loads the image → composites an SVG text layer → returns base64.
 * No-op (returns original) if text is empty or image isn't a data: URL.
 */
export async function watermarkImage(base64Image: string, text: string): Promise<string> {
  if (!text || !base64Image.startsWith('data:')) return base64Image

  const match = base64Image.match(/^data:([^;]+);base64,(.*)$/s)
  if (!match?.[1] || !match?.[2]) return base64Image
  const mime = match[1]
  const inputBuffer = Buffer.from(match[2], 'base64')

  // Read image metadata for sizing the SVG overlay
  const metadata = await sharp(inputBuffer).metadata()
  const width = metadata.width ?? 480
  const height = metadata.height ?? 360

  // SVG text overlay: centered, large, semi-transparent white with dark shadow
  const fontSize = Math.max(24, Math.round(width / 12))
  const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
        font-family="sans-serif" font-size="${fontSize}" font-weight="700"
        fill="white" fill-opacity="0.35" stroke="black" stroke-opacity="0.2" stroke-width="2"
        transform="rotate(-30, ${width / 2}, ${height / 2})">${escapedText}</text>
    </svg>`,
  )

  const watermarked = await sharp(inputBuffer)
    .composite([{ input: svg, gravity: 'center' }])
    .png()
    .toBuffer()

  return `data:image/png;base64,${watermarked.toString('base64')}`
}
