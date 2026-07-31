import { createWorker, PSM, type Worker } from 'tesseract.js'
import sharp from 'sharp'
import { resolve } from 'node:path'
import { parseExpiryFromText } from './qrExpiry'

/**
 * OCR for welcome/QR images, backed by tesseract.js (WASM, self-contained JS).
 * Loads `chi_sim` + `chi_tra` + `eng` — the QR posters mix simplified and
 * traditional Chinese in their footer text. A single worker is created lazily
 * and reused.
 *
 * Traineddata files are bundled locally in `tessdata/` (no CDN dependency,
 * works fully offline). OCR is **best-effort**: any failure (unreadable image,
 * no match) degrades to `null`, and the caller falls back to manual entry.
 *
 * Path resolution uses process.cwd() — in dev that's the project root, in
 * Docker it's WORKDIR (/app). Override with TESSDATA_PATH env var if needed.
 */
const TESSDATA_PATH = process.env.TESSDATA_PATH || resolve(process.cwd(), 'tessdata')

let workerPromise: Promise<Worker> | null = null

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker(['chi_sim', 'chi_tra', 'eng'], 1, {
      langPath: TESSDATA_PATH,
      // The committed files are uncompressed `<lang>.traineddata` (not `.gz`),
      // so don't have tesseract.js append `.gz` / expect gzip magic bytes.
      gzip: false,
    })
    workerPromise.catch(() => {
      workerPromise = null
    })
  }
  return workerPromise
}

/** Crop the bottom region of an image (where QR posters print the expiry
 * footer), upscale it, and binarise for OCR. */
async function bottomCrop(
  buffer: Buffer,
  fraction: number,
  targetWidth: number,
): Promise<Buffer | null> {
  const meta = await sharp(buffer).metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  if (w === 0 || h === 0) return null
  const cropH = Math.max(1, Math.floor(h * fraction))
  return sharp(buffer)
    .extract({ left: 0, top: h - cropH, width: w, height: cropH })
    .resize({ width: targetWidth, withoutEnlargement: false })
    .grayscale()
    .normalize()
    .png()
    .toBuffer()
}

/** Run OCR on an image buffer, returning the recognised text. Throws on failure.
 *
 * OCRs two regions and concatenates: the whole image (catches large date text
 * and the English "Valid until …" line) and an upscaled bottom crop (the small
 * footer where the expiry usually sits — needs aggressive upscaling to be
 * legible). The bottom pass uses PSM.SPARSE_TEXT which handles the spaced-out
 * footer glyphs far better than the default. */
export async function ocrImage(buffer: Buffer): Promise<string> {
  const worker = await getWorker()
  const texts: string[] = []

  // Pass 1 — whole image, auto segmentation.
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO })
  const whole = await sharp(buffer).grayscale().normalize().png().toBuffer()
  const r1 = await worker.recognize(whole)
  texts.push(r1.data.text ?? '')

  // Pass 2 — upscaled bottom footer crop, sparse-text segmentation.
  const bottom = await bottomCrop(buffer, 0.2, 3500)
  if (bottom) {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
    const r2 = await worker.recognize(bottom)
    texts.push(r2.data.text ?? '')
  }

  return texts.join('\n')
}

/**
 * OCR the welcome/QR image and try to detect an expiry date. Never throws —
 * returns null on any OCR or parse failure so callers can fall back to manual.
 */
export async function detectWelcomeExpiry(buffer: Buffer): Promise<Date | null> {
  try {
    const text = await ocrImage(buffer)
    return parseExpiryFromText(text)
  } catch {
    return null
  }
}
