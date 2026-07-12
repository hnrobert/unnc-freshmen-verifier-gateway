/**
 * Server-side PNG decode for the captcha solver, using pngjs (pure JS — no native
 * build, works in Node and serverless). Mirror of the browser `src/lib/png.ts`
 * canvas decode, returning the same {@link DecodedImage} shape.
 */
import { PNG } from 'pngjs'
import type { DecodedImage } from '../src/lib/png'

export async function decodeImage(buffer: ArrayBuffer): Promise<DecodedImage> {
  const png = PNG.sync.read(Buffer.from(buffer))
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) }
}
