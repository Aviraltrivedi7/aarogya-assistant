// Local symptom-photo heuristic — runs in the browser, no server needed.
// Screenshots/memes/documents/flat graphics are usually low-noise and
// skin-tone-free; camera photos of skin have skin-tone pixels and organic
// colour noise. Heuristic, not a classifier — the GPT vision check (when
// the API key works) is the accurate path; this is the fallback.

// YCbCr skin-tone range (standard detection bounds, tuned wide for all
// Indian skin tones).
function isSkinTone(r, g, b) {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  return cb >= 77 && cb <= 135 && cr >= 133 && cr <= 180
}

// Returns a promise of { skinRatio, colorNoise, edgeRatio, flatness }.
async function analyzePixels(img) {
  const W = 96
  const H = 96
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, W, H)
  const { data } = ctx.getImageData(0, 0, W, H)

  let skin = 0
  let total = 0
  const lum = new Float32Array(W * H)
  for (let i = 0, p = 0; p < W * H; p++, i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    if (isSkinTone(r, g, b)) skin++
    total++
    lum[p] = 0.299 * r + 0.587 * g + 0.114 * b
  }
  const skinRatio = skin / total

  // Colour noise: average per-pixel RGB delta vs its right neighbour.
  // Camera sensor noise keeps this above ~4 even on smooth skin;
  // synthetic flat fills (documents, solid backgrounds) sit near 0.
  let noiseSum = 0
  for (let p = 0; p < W * H - 1; p++) {
    const i = p * 4, j = (p + 1) * 4
    noiseSum += (Math.abs(data[i] - data[j]) + Math.abs(data[i + 1] - data[j + 1]) + Math.abs(data[i + 2] - data[j + 2])) / 3
  }
  const colorNoise = noiseSum / (W * H - 1)

  // Simple gradient edges (Sobel-ish) + flatness = share of near-zero-delta rows.
  let edge = 0
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x
      const gx = Math.abs(lum[p + 1] - lum[p - 1])
      const gy = Math.abs(lum[p + W] - lum[p - W])
      if (gx + gy > 24) edge++
    }
  }
  const edgeRatio = edge / (W * H)

  let flatRows = 0
  for (let y = 0; y < H; y++) {
    let maxDelta = 0
    for (let x = 1; x < W; x++) {
      const d = Math.abs(lum[y * W + x] - lum[y * W + x - 1])
      if (d > maxDelta) maxDelta = d
    }
    if (maxDelta < 3) flatRows++
  }
  const flatness = flatRows / H

  return { skinRatio, colorNoise, edgeRatio, flatness }
}

// Verdict: true = looks like a close-up photo of skin/body.
export async function looksLikeSymptomPhoto(img) {
  const { skinRatio, colorNoise, edgeRatio, flatness } = await analyzePixels(img)
  // Skin-dominant close-up: healthy share of skin tones, organic noise,
  // not a flat synthetic image.
  if (skinRatio >= 0.18 && colorNoise >= 3) return true
  // Some skin + real edges (body part partially in frame) is fine too.
  if (skinRatio >= 0.10 && edgeRatio >= 0.05 && colorNoise >= 4) return true
  // Flat / ultra-clean images (screenshots of text, solid fills) — reject.
  if (flatness >= 0.5 || colorNoise < 1.2) return false
  // Colourful noisy but no skin at all (meme, landscape, food) — reject.
  if (skinRatio < 0.03) return false
  return true
}
