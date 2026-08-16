import sharp from 'sharp'

/**
 * Build the watermark SVG overlay (dense, orderly rows of repeated text) for a
 * canvas of the given pixel size. Exported so callers can composite it in a
 * single sharp pass alongside resize / re-encode (e.g. the email pipeline).
 *
 * Each ROW is one `<text>` element containing the watermark string repeated
 * end-to-end (joined by spaces) so words on the same row share a baseline and
 * line up neatly — rendered row by row. Rows are stacked at a fixed vertical
 * step, the whole group is rotated −30° about the centre, and each row
 * overflows the image width on both sides so no corner is left bare after the
 * rotation. Kept semi-transparent (fill-opacity 0.22 + faint dark outline) so
 * the underlying art stays visible.
 */
export function buildWatermarkSvg(width: number, height: number, text: string): Buffer {
  // Font size scales with the image but stays within a readable band.
  const fontSize = Math.max(16, Math.min(64, Math.round(Math.min(width, height) / 11)))
  // Approx text width (sans-serif ≈ 0.62 em per glyph).
  const textWidth = Math.ceil(text.length * fontSize * 0.62)
  // Horizontal period between repeats (text + gap); vertical step between rows.
  const period = textWidth + Math.round(fontSize * 0.8)
  const stepY = Math.round(fontSize * 1.8)
  // Overflow so the rotated rows cover every corner of the image.
  const over = Math.round(Math.hypot(width, height))

  const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // One row = the word repeated enough to span image + overflow, joined by a few
  // preserved spaces (xml:space="preserve" keeps them from collapsing).
  const repeats = Math.max(1, Math.ceil((width + 2 * over) / period))
  const line = Array.from({ length: repeats }, () => escapedText).join('   ')

  const strokeW = Math.max(0.8, fontSize / 45).toFixed(2)
  const rows: string[] = []
  for (let y = -over; y < height + over; y += stepY) {
    rows.push(
      `<text x="${-over}" y="${y}" xml:space="preserve" font-family="-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="600" fill="#ffffff" fill-opacity="0.22" stroke="#000000" stroke-opacity="0.12" stroke-width="${strokeW}">${line}</text>`,
    )
  }

  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(-30 ${width / 2} ${height / 2})">${rows.join('')}</g></svg>`,
  )
}

/**
 * Composites a dense watermark over a base64 image (data: URL) and returns the
 * result as a PNG data URL. Used by the public welcome-image endpoint (website
 * flow), where format/size don't matter. The email flow composites
 * `buildWatermarkSvg` directly so it can resize + re-encode in one pass.
 *
 * No-op (returns original) if text is empty or the image isn't a `data:` URL.
 */
export async function watermarkImage(base64Image: string, text: string): Promise<string> {
  if (!text || !base64Image.startsWith('data:')) return base64Image

  const match = base64Image.match(/^data:([^;]+);base64,(.*)$/s)
  if (!match?.[1] || !match?.[2]) return base64Image
  const inputBuffer = Buffer.from(match[2], 'base64')

  const metadata = await sharp(inputBuffer).metadata()
  const width = metadata.width ?? 480
  const height = metadata.height ?? 360
  const svg = buildWatermarkSvg(width, height, text)

  const watermarked = await sharp(inputBuffer)
    .composite([{ input: svg, gravity: 'center' }])
    .png()
    .toBuffer()

  return `data:image/png;base64,${watermarked.toString('base64')}`
}
