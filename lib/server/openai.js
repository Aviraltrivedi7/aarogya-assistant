// GPT-powered triage enrichment (server-side only — the API key never
// reaches the browser). Calls OpenAI chat completions with JSON mode and
// a strict health-guidance system prompt. Returns null on any failure so
// the route can fall back to the deterministic rule engine.

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
// Keep well under the client's 20s budget so a hanging OpenAI call still
// returns the rule-based answer in time instead of aborting the request.
const TIMEOUT_MS = 12000
const MAX_TOKENS = 600

export function isOpenAIConfigured() {
  return !!process.env.OPENAI_API_KEY
}

// Safety rails baked into every request. The deterministic red-flag engine
// still runs first in the route — this prompt is guidance, not the only gate.
function systemPrompt(lang) {
  const replyLang = lang === 'hi'
    ? 'Hindi in Devanagari script (simple, everyday words)'
    : 'clear simple English'
  return [
    'You are the symptom-guidance assistant inside AarogyaGPT, a health companion app for India.',
    'You give GENERAL HEALTH GUIDANCE only — never a definitive diagnosis, never prescribe prescription medicines or doses.',
    'Always recommend seeing a qualified doctor for anything persistent, worsening, or worrying. In emergencies the user must call 112 (or 108 for an ambulance) immediately.',
    `Write every text field in ${replyLang}. If the user writes Hinglish or another language, still answer in ${replyLang}. Be warm, calm and practical — like a trusted family doctor listening on the phone, not a textbook.`,
    'Rules for the reply array: 2-3 short paragraphs (1-3 sentences each) — 1) acknowledge what they described in your own words, 2) practical self-care for the next few hours/days, 3) what to watch for and next step.',
    'The advice array holds 3-5 short self-care pointers (no numbering, each one line). The seek field is one sentence on when and where to see a doctor — name the right kind of doctor when obvious (e.g. general physician, dermatologist, ENT).',
    'severity must be exactly one of: low, moderate, high, emergency. Set emergency=true ONLY for life-threatening signs (chest pain/pressure, breathing difficulty, stroke signs, heavy bleeding, unconsciousness/seizure, severe allergic reaction, poisoning, self-harm thoughts). When in doubt, prefer the higher severity — better safe.',
    'summary is a short title (max 6 words) naming what the user described, in the reply language.',
    'Respond with JSON ONLY, matching: {"summary": string, "severity": "low"|"moderate"|"high"|"emergency", "advice": string[], "seek": string, "emergency": boolean, "reply": string[]}',
  ].join(' ')
}

const SEVERITIES = new Set(['low', 'moderate', 'high', 'emergency'])
const asArray = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : null)
const asString = (v, max = 600) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

// ── Symptom-photo verification (vision) ──────────────────────────────
// Checks that an uploaded image is a close-up photo of skin/body (rash,
// swelling, wound) and not a screenshot, document, meme etc. Returns:
//   { ok: true } | { ok: false } | null (couldn't check → treat as ok)
export async function gptVerifySymptomPhoto(dataUrl) {
  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 60,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You verify photos for a health app\'s "share a symptom photo" flow. Answer JSON only: {"is_symptom_photo": boolean}. true ONLY when the image is a real photograph (camera photo, not screenshot/graphic/meme/document/cartoon) AND shows a close-up of human skin or a body part where a visible concern could be (skin, arm, leg, face, torso, wound area). false for screenshots, documents, text images, drawings, landscapes, food, objects, animals — anything that is not a close-up body/skin photo.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Is this a symptom photo (close-up of skin/body)?' },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      console.error('OpenAI photo-verify failed:', res.status)
      return null
    }
    const data = await res.json()
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}')
    return { ok: parsed.is_symptom_photo === true }
  } catch (e) {
    console.error('OpenAI photo-verify error:', e?.name || '', e?.message?.slice(0, 100))
    return null
  }
}
export async function gptTriage(message, lang, profileContext = '', history = []) {
  // The user explicitly opted into health memory — their profile (age,
  // conditions, allergies, medicines) is included so guidance can account
  // for it. Emergency red flags are still decided by the rule engine
  // before this call, and context can never raise or excuse one.
  const contextLine = profileContext
    ? ` Known user context (use it to personalise, never to diagnose): ${profileContext}.`
    : ''
  // Recent turns of THIS session (follow-up questions like "and what about
  // medicine?" only make sense with them). Kept separate from profile
  // memory: this is the conversation the user is already having.
  const safeHistory = Array.isArray(history)
    ? history.filter((m) => m?.role === 'user' || m?.role === 'assistant').slice(-6)
    : []
  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: MAX_TOKENS,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt(lang) },
          ...safeHistory.map((m) => ({ role: m.role, content: String(m.content).slice(0, 600) })),
          { role: 'user', content: message.slice(0, 1000) + contextLine },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      console.error('OpenAI triage failed:', res.status, (await res.text()).slice(0, 200))
      return null
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content
    if (!raw) return null
    const parsed = JSON.parse(raw)

    const severity = SEVERITIES.has(parsed.severity) ? parsed.severity : null
    const reply = asArray(parsed.reply)
    const advice = asArray(parsed.advice)
    const summary = asString(parsed.summary, 80)
    const seek = asString(parsed.seek, 300)

    // Require the minimum that makes a useful answer.
    if (!severity || !reply?.length || !summary) return null

    return {
      summary,
      severity,
      advice: advice || [],
      seek: seek || '',
      emergency: parsed.emergency === true || severity === 'emergency',
      reply,
    }
  } catch (e) {
    console.error('OpenAI triage error:', e?.name || '', e?.message?.slice(0, 120))
    return null
  }
}
