import { NextResponse } from 'next/server'
import { z } from 'zod'

import { buildAssessment, SEVERITY } from '@/lib/triage'
import { isConfigured, withDb } from '@/lib/server/db'
import { signup, login, claimDevice, deleteAccount, getUserIdFromAuth } from '@/lib/server/auth'
import { gptTriage, gptVerifySymptomPhoto, isOpenAIConfigured } from '@/lib/server/openai'
import { parseLabText } from '@/lib/labs'

// ══════════════════════════════════════════════════════════════════
// AarogyaGPT backend — all endpoints live under /api/* via this catch-all.
//
//   GET    /api/health            → service + db status
//   POST   /api/auth/signup       → create account (email+password)
//   POST   /api/auth/login        → log in, returns bearer token
//   POST   /api/auth/claim         → move anonymous device data to account
//   DELETE /api/auth/account       → delete account + all its data (bearer)
//   POST   /api/assistant          → server-side symptom triage
//   GET    /api/checks            → list health checks (X-User-Id)
//   POST   /api/checks            → save a health check
//   DELETE /api/checks            → clear all checks
//   DELETE /api/checks/:id        → delete one check
//   GET    /api/reminders         → list reminders
//   POST   /api/reminders         → save reminder(s)
//   PATCH  /api/reminders/:id     → toggle done
//   DELETE /api/reminders/:id     → delete one
//   GET    /api/profile           → get profile
//   PUT    /api/profile           → upsert profile
//   GET    /api/nearby?lat&lon    → OpenStreetMap Overpass proxy
//   POST   /api/status            → platform template (kept)
//   GET    /api/status            → platform template (kept)
// ══════════════════════════════════════════════════════════════════

// ── CORS ──────────────────────────────────────────────────────────
function handleCORS(response) {
  const origin = process.env.CORS_ORIGINS || '*'
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id')
  if (process.env.CORS_ORIGINS) {
    response.headers.set('Access-Control-Allow-Credentials', 'true')
  }
  response.headers.set('Vary', 'Origin')
  return response
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 204 }))
}

const json = (data, status = 200) => handleCORS(NextResponse.json(data, { status }))

// ── Rate limiting (per instance, in-memory) ───────────────────────
const RATE_LIMIT = 120
const RATE_WINDOW = 60_000
const hits = new Map()

function rateLimited(ip) {
  const now = Date.now()
  const bucket = hits.get(ip) || { count: 0, start: now }
  if (now - bucket.start > RATE_WINDOW) {
    hits.set(ip, { count: 1, start: now })
    return false
  }
  bucket.count += 1
  hits.set(ip, bucket)
  if (hits.size > 5000) {
    for (const [key, b] of hits) if (now - b.start > RATE_WINDOW * 2) hits.delete(key)
  }
  return bucket.count > RATE_LIMIT
}

// ── User identity (anonymous device id — privacy-first, no accounts) ──
const USER_ID_RE = /^[A-Za-z0-9_-]{8,64}$/

function getUserId(request) {
  const id = request.headers.get('x-user-id') || ''
  return USER_ID_RE.test(id) ? id : null
}

function requireUser(request) {
  const userId = getUserId(request)
  if (!userId) return { error: json({ error: 'Missing or invalid X-User-Id header' }, 401) }
  return { userId }
}

// ── Validation schemas ────────────────────────────────────────────
const langEnum = z.enum(['en', 'hi']).default('en')
const severityEnum = z.enum([SEVERITY.LOW, SEVERITY.MODERATE, SEVERITY.HIGH, SEVERITY.EMERGENCY])

const assistantSchema = z.object({
  message: z.string().trim().min(1).max(500),
  lang: langEnum,
  // Optional recent turns for GPT context (user messages + assistant replies,
  // oldest first). Ignored by the rules engine — only the model sees it.
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(500),
  })).max(6).optional(),
})

// Symptom-photo verification: a data-URL image (≤2.5 MB base64) checked
// against the vision model. 512px cap is enforced client-side before send.
const photoSchema = z.object({
  image: z.string().startsWith('data:image/').max(3_500_000),
})

const checkSchema = z.object({
  id: z.string().trim().min(6).max(80).regex(/^[A-Za-z0-9_-]+$/),
  text: z.string().max(500).default(''),
  summary: z.string().max(200).default(''),
  severity: severityEnum,
  lang: langEnum,
  createdAt: z.string().datetime().optional(),
})

const reminderSchema = z.object({
  id: z.string().trim().min(6).max(80).regex(/^[A-Za-z0-9_-]+$/),
  title: z.string().trim().min(1).max(80),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  when: z.enum(['today', 'tomorrow', 'daily']).default('today'),
  type: z.enum(['medication', 'appointment', 'exercise', 'water', 'sleep', 'followup', 'other']).default('other'),
  done: z.boolean().default(false),
  // Local date the reminder was completed (YYYY-MM-DD) — daily reminders
  // render pending again the next day; absent for legacy rows (done forever).
  doneOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  createdAt: z.string().datetime().optional(),
})

// Partial update — used for toggling done (doneOn rides along), snoozing
// and editing in place. `doneOn: null` explicitly clears the done-for-day
// marker (undo path), so it is a separate nullable key, not `.optional()`.
const reminderPatchSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  when: z.enum(['today', 'tomorrow', 'daily']).optional(),
  type: z.enum(['medication', 'appointment', 'exercise', 'water', 'sleep', 'followup', 'other']).optional(),
  done: z.boolean().optional(),
  doneOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' })

const profileSchema = z.object({
  name: z.string().trim().max(60).default(''),
  age: z.union([z.string().regex(/^\d{0,3}$/), z.number().int().min(0).max(120)]).transform((v) => String(v ?? '')).default(''),
  gender: z.enum(['', 'male', 'female', 'other']).default(''),
  bloodGroup: z.enum(['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).default(''),
  height: z.union([z.string().regex(/^\d{0,3}$/), z.number().int().min(0).max(300)]).transform((v) => String(v ?? '')).default(''),
  weight: z.union([z.string().regex(/^\d{0,3}(\.\d)?$/), z.number().min(0).max(400)]).transform((v) => String(v ?? '')).default(''),
  conditions: z.string().trim().max(200).default(''),
  allergies: z.string().trim().max(200).default(''),
  medications: z.string().trim().max(200).default(''),
  emergencyContact: z.string().trim().max(120).default(''),
  memberSince: z.string().trim().max(9).default(''),
  // Consent gate for the assistant memory: only when explicitly enabled
  // does /api/assistant read this profile to personalise guidance.
  memoryEnabled: z.boolean().default(false),
})

const nearbyQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
})

// Medical report analyzer: raw report text → parsed lab rows (server-side,
// so the original text never has to be stored unless the user saves).
const reportSchema = z.object({
  text: z.string().trim().min(10).max(60000),
  lang: langEnum,
})

function parseBody(schema, body) {
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: json({ error: `${first.path.join('.') || 'body'}: ${first.message}` }, 400) }
  }
  return { data: parsed.data }
}

const stripMongo = ({ _id, ...rest }) => rest

// ── DB-down helper ────────────────────────────────────────────────
function dbError(error) {
  if (error?.code === 'DB_NOT_CONFIGURED' || error?.dbDown) {
    return json({ error: 'Database unavailable', dbDown: true }, 503)
  }
  console.error('API Error:', error.message)
  return json({ error: 'Internal server error' }, 500)
}

// ══════════════════════════════════════════════════════════════════
// Overpass proxy — searches nearby hospitals/clinics/pharmacies.
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

async function fetchNearby(lat, lon) {
  const radius = 3000
  const filters = ['hospital', 'clinic', 'pharmacy']
    .map((a) => `node(around:${radius},${lat},${lon})[amenity=${a}];way(around:${radius},${lat},${lon})[amenity=${a}];`)
    .join('')
  const query = `[out:json][timeout:20];(${filters});out center 60;`

  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // Overpass rejects requests whose User-Agent contains URL-like
          // brackets/parens (406) — keep this plain and simple.
          'User-Agent': 'AarogyaGPT/0.2',
        },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) {
        console.error('Overpass mirror failed:', mirror, res.status)
        continue
      }
      const data = await res.json()
      return (data.elements || [])
        .map((el) => ({
          id: `${el.type}/${el.id}`,
          kind: el.tags?.amenity || 'clinic',
          name: el.tags?.name || null,
          phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
          lat: el.lat ?? el.center?.lat ?? null,
          lon: el.lon ?? el.center?.lon ?? null,
        }))
        .filter((p) => p.lat != null && p.lon != null)
    } catch (e) {
      console.error('Overpass mirror error:', mirror, e?.name, e?.cause?.code || e?.message?.slice(0, 120))
      continue // try next mirror
    }
  }
  throw new Error('overpass unavailable')
}

// ══════════════════════════════════════════════════════════════════
// Main router
async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method
  const [root, ...rest] = path

  try {
    // Health — no auth, no DB requirement.
    if (route === '/health' && method === 'GET') {
      let dbStatus = 'unavailable'
      if (isConfigured()) {
        try {
          await withDb(async (db) => db.command({ ping: 1 }))
          dbStatus = 'connected'
        } catch {
          dbStatus = 'unavailable'
        }
      }
      return json({ ok: true, db: dbStatus, time: new Date().toISOString() })
    }

    // Rate limit (per IP) for everything else.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
    if (rateLimited(ip)) return json({ error: 'Too many requests' }, 429)

    // ── /api/auth/* — signup, login, claim, account delete ──
    if (root === 'auth') {
      if (rest[0] === 'signup' && method === 'POST') {
        const r = await signup(request)
        return json(r.body, r.status)
      }
      if (rest[0] === 'login' && method === 'POST') {
        const r = await login(request)
        return json(r.body, r.status)
      }
      if (rest[0] === 'claim' && method === 'POST') {
        const authUserId = getUserIdFromAuth(request)
        if (!authUserId) return json({ error: 'Missing or invalid bearer token' }, 401)
        // The client partitions data under `user-<base64url(email)>` (see
        // lib/auth-client.js accountUid) — claim into THAT id, not the raw
        // email, so pre-signup device data actually lands in the account.
        const dataUid = `user-${Buffer.from(authUserId, 'utf8').toString('base64url')}`
        const r = await claimDevice(request, dataUid)
        return json(r.body, r.status)
      }
      // DELETE /api/auth/account — remove the account and every document
      // stored under its id. Bearer-authenticated so only the owner can do it.
      if (rest[0] === 'account' && method === 'DELETE') {
        const authUserId = getUserIdFromAuth(request)
        if (!authUserId) return json({ error: 'Missing or invalid bearer token' }, 401)
        const r = await deleteAccount(authUserId)
        return json(r.body, r.status)
      }
      return json({ error: `Route ${route} not found` }, 404)
    }

    // ── POST /api/verify-photo — vision check: is this a symptom photo? ──
    // Returns { isSymptomPhoto } when the model could decide, or
    // { unchecked: true } when the API is unavailable — the client then
    // falls back to its local heuristic and never hard-blocks the user.
    if (route === '/verify-photo' && method === 'POST') {
      const raw = await request.json().catch(() => null)
      const parsed = parseBody(photoSchema, raw)
      if (parsed.error) return parsed.error
      if (!isOpenAIConfigured()) return json({ unchecked: true })
      const verdict = await gptVerifySymptomPhoto(parsed.data.image)
      if (verdict === null) return json({ unchecked: true })
      return json({ isSymptomPhoto: verdict.ok })
    }

    // ── POST /api/assistant — GPT triage (rule engine as base + fallback) ──
    if (route === '/assistant' && method === 'POST') {
      const raw = await request.json().catch(() => null)
      const parsed = parseBody(assistantSchema, raw)
      if (parsed.error) return parsed.error
      const { message, lang } = parsed.data
      const { result, replyParts } = buildAssessment(message)

      // Personal context is opt-in: only when the user enabled health
      // memory does the server load their profile to enrich the prompt.
      // Without consent (or a missing profile) the call stays generic.
      let profileContext = ''
      try {
        const uid = getUserId(request)
        if (uid) {
          const doc = await withDb(async (db) => db.collection('profiles').findOne({ userId: uid }))
          if (doc?.memoryEnabled) {
            const bits = []
            if (doc.age) bits.push(`age ${doc.age}`)
            if (doc.gender) bits.push(`sex ${doc.gender}`)
            if (doc.conditions) bits.push(`ongoing conditions: ${doc.conditions}`)
            if (doc.allergies) bits.push(`allergies: ${doc.allergies}`)
            if (doc.medications) bits.push(`current medicines: ${doc.medications}`)
            profileContext = bits.join('; ')
          }
        }
      } catch {
        // DB down or unreadable → answer without context; never block triage.
      }

      // Safety first: the deterministic engine runs before anything else.
      // If it flags an emergency, that verdict stands — the model can't
      // downgrade a red flag. Otherwise, try GPT for a richer answer.
      let payload = {
        reply: replyParts,
        summary: result.summary,
        severity: result.severity,
        advice: result.advice,
        seek: result.seek,
        emergency: result.emergency,
        source: 'rules',
      }

      if (!result.emergency && isOpenAIConfigured()) {
        const gpt = await gptTriage(message, lang, profileContext, parsed.data.history)
        if (gpt) {
          // GPT answers arrive in the REQUEST language. Keep the bilingual
          // rules payload alongside as `alt` so the client can show the
          // other language on a language switch without a re-request.
          payload = {
            reply: gpt.reply,
            summary: { en: gpt.summary, hi: gpt.summary },
            severity: gpt.severity,
            advice: gpt.advice,
            seek: gpt.seek ? [gpt.seek] : result.seek[lang === 'hi' ? 'hi' : 'en'],
            emergency: gpt.emergency,
            source: 'gpt',
            alt: {
              reply: replyParts[lang === 'hi' ? 'en' : 'hi'],
              advice: result.advice[lang === 'hi' ? 'en' : 'hi'],
              seek: result.seek[lang === 'hi' ? 'en' : 'hi'],
            },
          }
          // Never let the model go BELOW the rule engine's severity —
          // rules are the safety floor, GPT adds nuance on top.
          const rank = { low: 0, moderate: 1, high: 2, emergency: 3 }
          if (rank[gpt.severity] < rank[result.severity]) {
            payload.severity = result.severity
            payload.emergency = false
          }
        }
      }

      return json({ ...payload, lang })
    }

    // ── GET /api/nearby?lat=&lon= — Overpass proxy ──
    if (route === '/nearby' && method === 'GET') {
      const url = new URL(request.url)
      const parsed = nearbyQuery.safeParse({ lat: url.searchParams.get('lat'), lon: url.searchParams.get('lon') })
      if (!parsed.success) return json({ error: 'lat and lon query params are required' }, 400)
      const places = await fetchNearby(parsed.data.lat, parsed.data.lon)
      return json({ places, count: places.length, center: parsed.data })
    }

    // Everything below needs a user id.
    const user = requireUser(request)
    if (user.error) return user.error
    const userId = user.userId

    // ── /api/checks (health history) ──
    if (root === 'checks') {
      if (route === '/checks' && method === 'GET') {
        const docs = await withDb(async (db) =>
          db.collection('health_checks').find({ userId }).sort({ createdAt: -1 }).limit(200).toArray()
        )
        return json(docs.map(stripMongo))
      }
      if (route === '/checks' && method === 'POST') {
        // Accepts one check or an array (offline back-sync).
        const raw = await request.json().catch(() => null)
        const list = Array.isArray(raw) ? raw : [raw]
        if (list.length > 100) return json({ error: 'Too many items in one request' }, 400)
        const docs = []
        for (const item of list) {
          const parsed = parseBody(checkSchema, item)
          if (parsed.error) return parsed.error
          docs.push({ ...parsed.data, createdAt: parsed.data.createdAt || new Date().toISOString(), userId })
        }
        await withDb(async (db) => {
          if (docs.length === 1) {
            await db.collection('health_checks').updateOne({ userId, id: docs[0].id }, { $set: docs[0] }, { upsert: true })
          } else {
            const ops = docs.map((d) => ({ updateOne: { filter: { userId, id: d.id }, update: { $set: d }, upsert: true } }))
            await db.collection('health_checks').bulkWrite(ops, { ordered: false })
          }
        })
        return json({ saved: docs.length }, 201)
      }
      if (route === '/checks' && method === 'DELETE') {
        await withDb(async (db) => db.collection('health_checks').deleteMany({ userId }))
        return json({ cleared: true })
      }
      if (rest.length === 1 && method === 'DELETE') {
        const r = await withDb(async (db) => db.collection('health_checks').deleteOne({ userId, id: rest[0] }))
        return json({ deleted: r.deletedCount })
      }
    }

    // ── /api/reminders ──
    if (root === 'reminders') {
      if (route === '/reminders' && method === 'GET') {
        const docs = await withDb(async (db) =>
          db.collection('reminders').find({ userId }).sort({ createdAt: -1 }).limit(500).toArray()
        )
        return json(docs.map(stripMongo))
      }
      if (route === '/reminders' && method === 'POST') {
        const raw = await request.json().catch(() => null)
        const list = Array.isArray(raw) ? raw : [raw]
        if (list.length > 100) return json({ error: 'Too many items in one request' }, 400)
        const docs = []
        for (const item of list) {
          const parsed = parseBody(reminderSchema, item)
          if (parsed.error) return parsed.error
          docs.push({ ...parsed.data, createdAt: parsed.data.createdAt || new Date().toISOString(), userId })
        }
        await withDb(async (db) => {
          const ops = docs.map((d) => ({ updateOne: { filter: { userId, id: d.id }, update: { $set: d }, upsert: true } }))
          await db.collection('reminders').bulkWrite(ops, { ordered: false })
        })
        return json({ saved: docs.length }, 201)
      }
      if (rest.length === 1 && method === 'PATCH') {
        const raw = await request.json().catch(() => null)
        const parsed = parseBody(reminderPatchSchema, raw)
        if (parsed.error) return parsed.error
        const r = await withDb(async (db) =>
          db.collection('reminders').updateOne({ userId, id: rest[0] }, { $set: parsed.data })
        )
        return json({ updated: r.matchedCount })
      }
      if (rest.length === 1 && method === 'DELETE') {
        const r = await withDb(async (db) => db.collection('reminders').deleteOne({ userId, id: rest[0] }))
        return json({ deleted: r.deletedCount })
      }
    }

    // ── /api/profile ──
    if (root === 'profile') {
      if (route === '/profile' && method === 'GET') {
        const doc = await withDb(async (db) => db.collection('profiles').findOne({ userId }))
        return json(stripMongo(doc || { userId, exists: false }))
      }
      if (route === '/profile' && method === 'PUT') {
        const raw = await request.json().catch(() => null)
        const parsed = parseBody(profileSchema, raw)
        if (parsed.error) return parsed.error
        const doc = { ...parsed.data, userId, updatedAt: new Date().toISOString() }
        await withDb(async (db) =>
          db.collection('profiles').updateOne({ userId }, { $set: doc, $setOnInsert: { createdAt: doc.updatedAt } }, { upsert: true })
        )
        return json({ saved: true, profile: doc }, 201)
      }
    }

    // ── /api/reports — lab report analyzer (parse + save/list/delete) ──
    if (root === 'reports') {
      if (route === '/reports' && method === 'POST') {
        const raw = await request.json().catch(() => null)
        const parsed = parseBody(reportSchema, raw)
        if (parsed.error) return parsed.error
        const { rows, found, abnormal } = parseLabText(parsed.data.text)
        if (found === 0) return json({ error: 'No known lab tests found in this text' }, 422)
        const doc = {
          id: `rep_${crypto.randomUUID().slice(0, 12)}`,
          userId,
          lang: parsed.data.lang,
          rows,
          found,
          abnormal,
          createdAt: new Date().toISOString(),
        }
        await withDb(async (db) => db.collection('health_reports').insertOne(doc))
        return json({ saved: doc, message: 'Report analyzed' }, 201)
      }
      if (route === '/reports' && method === 'GET') {
        const docs = await withDb(async (db) =>
          db.collection('health_reports').find({ userId }).sort({ createdAt: -1 }).limit(50).toArray()
        )
        return json(docs.map(stripMongo))
      }
      if (rest.length === 1 && method === 'DELETE') {
        const r = await withDb(async (db) => db.collection('health_reports').deleteOne({ userId, id: rest[0] }))
        return json({ deleted: r.deletedCount })
      }
    }

    // ── Platform template endpoints (kept for compatibility) ──
    if (route === '/status' && method === 'POST') {
      const raw = await request.json().catch(() => null)
      const statusSchema = z.object({ client_name: z.string().trim().min(1).max(100) })
      const parsed = parseBody(statusSchema, raw)
      if (parsed.error) return parsed.error
      const statusObj = { id: crypto.randomUUID(), client_name: parsed.data.client_name, timestamp: new Date() }
      await withDb(async (db) => db.collection('status_checks').insertOne(statusObj))
      return json(stripMongo(statusObj), { status: 201 })
    }
    if (route === '/status' && method === 'GET') {
      const statusChecks = await withDb(async (db) =>
        db.collection('status_checks').find({}).sort({ timestamp: -1 }).limit(500).toArray()
      )
      return json(statusChecks.map(stripMongo))
    }

    // Route not found
    return json({ error: `Route ${route} not found` }, 404)

  } catch (error) {
    return dbError(error)
  }
}

// Export all HTTP methods
export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
