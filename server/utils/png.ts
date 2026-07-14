/**
 * Server-side PNG decode for the captcha solver, using pngjs (pure JS — no native
 * build, works in Node and serverless). Returns the shared {@link DecodedImage}.
 */
import { PNG } from 'pngjs'
import type { DecodedImage } from '../../shared/types'

export async function decodeImage(buffer: ArrayBuffer): Promise<DecodedImage> {
  const png = PNG.sync.read(Buffer.from(buffer))
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) }
}
