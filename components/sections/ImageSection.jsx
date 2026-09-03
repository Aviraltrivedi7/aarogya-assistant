'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, Camera, Check, ImagePlus, Info, ShieldX, Upload, XCircle } from 'lucide-react'

import { looksLikeSymptomPhoto } from '@/lib/imagecheck'

const BODY_AREAS = {
  en: ['Face or head', 'Arm or hand', 'Leg or foot', 'Torso / back', 'Anywhere else'],
  hi: ['चेहरा या सिर', 'बांह या हाथ', 'टांग या पैर', 'धड़ / पीठ', 'कहीं और'],
}

// Downscale to ≤512px JPEG before anything else — verification and any
// future upload both work on a compact copy, not the raw file.
function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('decode'))
    img.src = URL.createObjectURL(file)
  })
}

function toDataUrl(img, max = 512) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.8)
}

export function ImageSection({ t, lang }) {
  const [preview, setPreview] = useState(null)
  const [fileName, setFileName] = useState('')
  const [area, setArea] = useState('')
  const [duration, setDuration] = useState('')
  const [pain, setPain] = useState('')
  const [result, setResult] = useState(null)
  // photoState: 'checking' | 'accepted' | 'rejected' — a photo must pass
  // verification before the questions and analysis become usable.
  const [photoState, setPhotoState] = useState(null)
  const inputRef = useRef(null)

  const pick = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return
    if (file.size > 8 * 1024 * 1024) return
    setFileName(file.name)
    setResult(null)
    setPhotoState('checking')

    let img
    try {
      img = await fileToImage(file)
    } catch {
      setPhotoState('rejected')
      setPreview(null)
      return
    }
    setPreview(img.src)

    // Accurate path first: GPT vision via the server. When the API can't
    // answer (no key, no credits, network), fall back to the local
    // heuristic — the user is never blocked without a verdict.
    let accepted = null
    try {
      const res = await fetch('/api/verify-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: toDataUrl(img) }),
        signal: AbortSignal.timeout(15000),
      })
      if (res.ok) {
        const data = await res.json()
        if (typeof data.isSymptomPhoto === 'boolean') accepted = data.isSymptomPhoto
      }
    } catch { /* fall through to local check */ }

    if (accepted === null) {
      try {
        accepted = await looksLikeSymptomPhoto(img)
      } catch {
        accepted = true // can't even decode locally — don't brick the flow
      }
    }
    setPhotoState(accepted ? 'accepted' : 'rejected')
  }

  const canAnalyze = preview && photoState === 'accepted' && area && duration && pain

  const analyze = () => {
    const moreThanWeek = duration === 'week'
    const bothering = pain === 'bothering'
    // Bilingual advice — picked per active language at render time so a
    // language switch re-renders an existing result too.
    setResult({
      advice: {
        en: [
          'Keep the area clean and dry; avoid scratching.',
          'Hold off on new cosmetics or oils over the spot.',
          bothering && 'A pharmacist can suggest an anti-itch cream; a cool compress also helps.',
          moreThanWeek && 'It has been over a week — showing it to a dermatologist is the right next step.',
        ].filter(Boolean),
        hi: [
          'जगह को साफ़ और सूखा रखें; खुजलाने से बचें।',
          'नए प्रसाधन/तेल इस जगह पर इस्तेमाल न करें।',
          bothering && 'फार्मासिस्ट से एंटी-इच क्रीम पूछ सकते हैं; ठंडी सेंक भी राहत देती है।',
          moreThanWeek && 'हफ़्ते से ज़्यादा हो चुका है — त्वचा विशेषज्ञ (डर्मेटोलॉजिस्ट) से दिखाना सही रहेगा।',
        ].filter(Boolean),
      },
      urgent: moreThanWeek && bothering,
    })
  }

  return (
    <div data-testid="section-images" className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t('imagesTitle')}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">{t('imagesIntro')}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Upload + preview */}
        <div className="rounded-3xl border border-stone-200/80 bg-[#faf6ec] p-5 shadow-[0_7px_24px_-18px_rgba(15,23,42,.4)]">
          <input
            ref={inputRef}
            id="image-input"
            data-testid="image-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={pick}
            aria-label={t('imagePick')}
            className="sr-only"
          />
          {preview ? (
            <div className="space-y-3">
              <div className="relative">
                <img src={preview} alt={lang === 'hi' ? 'अपलोड की गई फोटो का पूर्वावलोकन' : 'Preview of the uploaded photo'} data-testid="image-preview" className={`h-56 w-full rounded-2xl object-cover ${photoState === 'rejected' ? 'opacity-50 grayscale' : ''}`} />
                {photoState === 'rejected' && (
                  <span className="absolute left-2 top-2 flex items-center gap-1 rounded-lg bg-[#fffdf7] px-2 py-1 text-[10px] font-bold text-red-700 shadow-sm" data-testid="image-rejected-tag">
                    <XCircle size={12} aria-hidden="true" />
                    {t('imageRejectTitle')}
                  </span>
                )}
              </div>
              <p className="truncate text-center text-[11px] text-stone-600" aria-hidden="true">{fileName}</p>
              <button onClick={() => inputRef.current?.click()} data-testid="image-replace" className="w-full rounded-xl border border-stone-200 py-2.5 text-xs font-bold text-[#8a6215] hover:bg-[#f4e9d2]">
                {photoState === 'rejected' ? t('imageRejectRetry') : t('imageReplace')}
              </button>
            </div>
          ) : (
            <button onClick={() => inputRef.current?.click()} data-testid="image-pick" className="flex h-56 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 transition hover:border-[#b8974f] hover:bg-[#f4f0e2]">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#faf6ec] text-[#8a6215] shadow-sm">
                <ImagePlus size={22} aria-hidden="true" />
              </span>
              <span className="text-sm font-bold text-stone-700">{t('imagePick')}</span>
              <span className="text-[11px] text-stone-600">{t('imagePickHint')}</span>
            </button>
          )}

          {photoState === 'checking' && (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-stone-200 bg-[#faf6ec] p-4" role="status" data-testid="image-checking">
            <span className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-stone-300 border-t-[#b8974f]" aria-hidden="true" />
            <p className="text-xs font-semibold text-stone-700">{t('imageCheckWait')}</p>
          </div>
        )}
        {photoState === 'accepted' && (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#b8974f]/50 bg-[#f4efdf] p-4" role="status" data-testid="image-accepted">
            <Check size={16} className="mt-0.5 shrink-0 text-[#8a6215]" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold text-[#8a6215]">{t('imageConfirmTitle')}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-stone-700">{t('imageConfirmBody')}</p>
            </div>
          </div>
        )}
        {photoState === 'rejected' && (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4" role="alert" data-testid="image-rejected">
            <ShieldX size={16} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold text-red-800">{t('imageRejectTitle')}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-red-700">{t('imageRejectBody')}</p>
              <button onClick={() => inputRef.current?.click()} data-testid="image-reject-retry" className="mt-2.5 flex min-h-9 items-center gap-1.5 rounded-xl bg-red-600 px-3 text-[11px] font-bold text-white hover:bg-red-700">
                <ImagePlus size={13} aria-hidden="true" />
                {t('imageRejectRetry')}
              </button>
            </div>
          </div>
        )}
        </div>

        {/* Questions */}
        <div className={`space-y-5 rounded-3xl border border-stone-200/80 bg-[#faf6ec] p-5 shadow-[0_7px_24px_-18px_rgba(15,23,42,.4)] ${photoState !== 'accepted' ? 'pointer-events-none opacity-40' : ''}`}>
          <fieldset>
            <legend className="text-xs font-bold text-stone-800">{t('bodyArea')}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {BODY_AREAS[lang === 'hi' ? 'hi' : 'en'].map((label) => (
                <button
                  key={label}
                  onClick={() => setArea(label)}
                  data-testid={`image-area-${label}`}
                  aria-pressed={area === label}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${area === label ? 'border-[#b8974f] bg-[#f4efdf] text-[#8a6215]' : 'border-stone-200 bg-[#faf6ec] text-stone-700 hover:border-[#b8974f]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-bold text-stone-800">{t('duration')}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(t('durationOptions')).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setDuration(key)}
                  data-testid={`image-duration-${key}`}
                  aria-pressed={duration === key}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${duration === key ? 'border-[#b8974f] bg-[#f4efdf] text-[#8a6215]' : 'border-stone-200 bg-[#faf6ec] text-stone-700 hover:border-[#b8974f]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-bold text-stone-800">{t('painLevel')}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(t('painOptions')).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPain(key)}
                  data-testid={`image-pain-${key}`}
                  aria-pressed={pain === key}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${pain === key ? 'border-[#b8974f] bg-[#f4efdf] text-[#8a6215]' : 'border-stone-200 bg-[#faf6ec] text-stone-700 hover:border-[#b8974f]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            onClick={analyze}
            disabled={!canAnalyze}
            data-testid="image-analyze"
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#0f241a] bg-[#eda33c] text-sm font-extrabold text-[#26251c] shadow-[4px_4px_0_0_#0f241a] transition hover:bg-[#f2c063] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Camera size={16} aria-hidden="true" />
            {t('analyzeBtn')}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className={`mt-6 rounded-3xl border p-6 ${result.urgent ? 'border-red-200 bg-red-50' : 'border-[#b8974f]/40 bg-[#f4efdf]'}`} data-testid="image-result" role="status">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-stone-900">
            <Check size={16} className={result.urgent ? 'text-red-600' : 'text-[#b8974f]'} aria-hidden="true" />
            {t('imageResultTitle')}
          </h2>
          <ul className="mt-4 space-y-2">
            {(Array.isArray(result.advice) ? result.advice : (result.advice[lang === 'hi' ? 'hi' : 'en'] || [])).map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-5 text-stone-700">
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${result.urgent ? 'bg-red-500' : 'bg-[#eda33c]'}`} aria-hidden="true" />
                {a}
              </li>
            ))}
          </ul>
          <div className={`mt-4 flex items-start gap-2 rounded-xl p-3 text-[11px] leading-5 ${result.urgent ? 'bg-red-100 text-red-800' : 'bg-[#faf6ec] text-stone-600'}`}>
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>{t('imageRedFlag')}</p>
          </div>
          <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-stone-600">
            <Info size={14} className="mt-0.5 shrink-0 text-stone-600" aria-hidden="true" />
            {t('imageDisclaimer')}
          </p>
        </div>
      )}

      {/* How it works */}
      <div className="mt-6 rounded-3xl border border-stone-200/80 bg-[#faf6ec] p-6">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-stone-900">
          <Upload size={16} className="text-[#8a6215]" aria-hidden="true" />
          {t('imagesHow')}
        </h2>
        <ol className="mt-4 space-y-3">
          {t('imagesSteps').map((step, i) => (
            <li key={step} className="flex items-start gap-3 text-xs leading-5 text-stone-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#f4efdf] text-[11px] font-extrabold text-[#8a6215]" aria-hidden="true">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
