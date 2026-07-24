import sharp from 'sharp'

/**
 * Composites a dense, tiled text watermark over the whole image so it reaches
 * every corner. Uses sharp: loads the image → composites an SVG layer of
 * explicitly-placed text elements (a rotated grid) → returns base64.
 *
 * An explicit grid is used (rather than SVG `<pattern>` + `patternTransform`)
 * because librsvg renders rotated patterns with uneven density. With one text
 * per grid cell, density is mathematically uniform across the surface. The grid
 * overflows the image in every direction (so the −30° rotation never exposes a
 * bare corner), and the SVG viewport clips it back to the image bounds. Kept
 * semi-transparent (fill-opacity 0.22 + faint dark outline) so the underlying
 * art stays visible. No-op (returns original) if text is empty or the image
 * isn't a `data:` URL.
 */
export async function watermarkImage(base64Image: string, text: string): Promise<string> {
  if (!text || !base64Image.startsWith('data:')) return base64Image

  const match = base64Image.match(/^data:([^;]+);base64,(.*)$/s)
  if (!match?.[1] || !match?.[2]) return base64Image
  const inputBuffer = Buffer.from(match[2], 'base64')

  // Read image metadata for sizing the SVG overlay.
  const metadata = await sharp(inputBuffer).metadata()
  const width = metadata.width ?? 480
  const height = metadata.height ?? 360

  // Font size scales with the image but stays within a readable band.
  const fontSize = Math.max(16, Math.min(64, Math.round(Math.min(width, height) / 11)))
  // Approx text width (sans-serif ≈ 0.6 em per glyph) — sizes the grid cell.
  const textWidth = Math.ceil(text.length * fontSize * 0.62)
  // Tight spacing → dense coverage. Cell = text width + small gaps.
  const stepX = textWidth + Math.round(fontSize * 0.6)
  const stepY = Math.round(fontSize * 1.7)
  // Overflow so the rotated grid covers every corner of the image.
  const over = Math.round(Math.hypot(width, height))

  const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const strokeW = Math.max(0.8, fontSize / 45).toFixed(2)
  // Build one <text> per grid cell; the whole group is rotated −30° about center.
  const cells: string[] = []
  for (let y = -over; y < height + over; y += stepY) {
    for (let x = -over; x < width + over; x += stepX) {
      cells.push(
        `<text x="${x}" y="${y}" font-family="-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="600" fill="#ffffff" fill-opacity="0.22" stroke="#000000" stroke-opacity="0.12" stroke-width="${strokeW}">${escapedText}</text>`,
      )
    }
  }

  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(-30 ${width / 2} ${height / 2})">${cells.join('')}</g></svg>`,
  )

  const watermarked = await sharp(inputBuffer)
    .composite([{ input: svg, gravity: 'center' }])
    .png()
    .toBuffer()

  return `data:image/png;base64,${watermarked.toString('base64')}`
}
