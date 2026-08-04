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

/** Crop the bottom `fraction` of an image (where QR posters print the expiry
 * footer), upscale to `targetWidth`, and grayscale + normalize for OCR. */
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
 * The QR-expiry boilerplate ("Valid until M/D", "M月D日前") lives in a thin strip
 * at the very bottom of these posters. We OCR tight bottom bands only — crucially,
 * the band must EXCLUDE the dense QR code above it: once the QR leaks into the
 * crop (≥~20% of the height), tesseract's page segmentation is overwhelmed and it
 * returns nothing (even though the footer text is perfectly legible). Two close
 * fractions cover minor layout variation; both are upscaled so the small footer
 * glyphs are legible. (The earlier whole-image pass was both slow and always
 * empty for these posters — the QR defeats it — so it was dropped.) */
export async function ocrImage(buffer: Buffer): Promise<string> {
  const worker = await getWorker()
  const texts: string[] = []

  for (const frac of [0.12, 0.15]) {
    const band = await bottomCrop(buffer, frac, 2800)
    if (!band) continue
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO })
    const r = await worker.recognize(band)
    texts.push(r.data.text ?? '')
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
