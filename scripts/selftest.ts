/**
 * Unit tests for the portable parts of the admission client (the slider-captcha
 * offset ranking math and the result-HTML parser). These run in Node and need no
 * portal/proxy — the only pieces that can't be tested here are the live HTTP
 * flow and the browser PNG decode.
 *
 *   pnpm test
 */
import { parseResultHtml, rankOffsets } from '../src/lib/admissionCore'
import type { DecodedImage } from '../src/lib/png'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) {
    passed++
    console.log(`✓ ${name}${extra ? '  — ' + extra : ''}`)
  } else {
    failed++
    console.error(`✗ FAIL  ${name}${extra ? '  — ' + extra : ''}`)
  }
}

/* ----------------------------------------------------------- parseResultHtml */

const admittedHtml =
  '<div class="stage"><div class="overlay-name">张三</div>' +
  '<div class="overlay-message">已被录取</div>' +
  '<div class="overlay-university">宁波诺丁汉大学</div>' +
  '<div class="overlay-date">2026-08-15</div></div>'

const r1 = parseResultHtml(admittedHtml)
check('admitted html → admitted=true', r1.ok === true && r1.admitted === true)
check('admitted html → name extracted', r1.name === '张三', JSON.stringify(r1.name))
check('admitted html → university extracted', r1.university === '宁波诺丁汉大学')
check('admitted html → date extracted', r1.date === '2026-08-15')

const r2 = parseResultHtml('<div class="no-result-box">未找到录取信息！</div>')
check('no-result → admitted=false', r2.ok === true && r2.admitted === false)

const r3 = parseResultHtml('some 未找到录取信息 here')
check('未找到 keyword → admitted=false', r3.ok === true && r3.admitted === false)

const r4 = parseResultHtml('error=1 请先完成验证码验证')
check('captcha rejected → ok=false', r4.ok === false && r4.admitted === null)

const r5 = parseResultHtml('<html><body>??? nothing recognizable ???</body></html>')
check('unrecognized page → ok=false, admitted=null', r5.ok === false && r5.admitted === null)

/* --------------------------------------------------------------- rankOffsets */

function makeImage(w: number, h: number, fill: (x: number, y: number) => [number, number, number]): DecodedImage {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fill(x, y)
      const i = (y * w + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
  return { width: w, height: h, data }
}

// Background: uniform gray, with a distinctive textured notch at x=60 matching
// the piece. The ranking should place x=60 among the top candidates (peak NCC).
const PW = 20
const PH = 30
const TARGET_Y = 5
const NOTCH_X = 60
const BW = 120
const BH = 40

const pattern = (dx: number, dy: number): [number, number, number] => {
  const v = (dx * 7 + dy * 3) % 200
  return [v, (v + 40) % 256, (v + 80) % 256]
}

const bg = makeImage(BW, BH, (x, y) => {
  if (x >= NOTCH_X && x < NOTCH_X + PW && y >= TARGET_Y && y < TARGET_Y + PH) {
    return pattern(x - NOTCH_X, y - TARGET_Y)
  }
  return [50, 50, 50]
})
const piece = makeImage(PW, PH, (x, y) => pattern(x, y))

const offsets = rankOffsets(bg, piece, TARGET_Y)
check('rankOffsets returns candidates', Array.isArray(offsets) && offsets.length > 0, `count=${offsets.length}`)
check('rankOffsets values are in range', offsets.every((x) => x >= 0 && x <= BW - PW))
check('rankOffsets ranks the matching notch highly', offsets.includes(NOTCH_X), `top=${offsets.slice(0, 5).join(',')}`)
// The algorithm returns candidates from four heuristic buckets (std/border/ncc
// asc/desc); the portal verifies each. The meaningful guarantee is that the
// matching offset lands within the tried window (default maxOffsetTries = 25).
const notchIndex = offsets.indexOf(NOTCH_X)
check('rankOffsets notch is within the tried window', notchIndex >= 0 && notchIndex < 25, `index=${notchIndex}`)

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
