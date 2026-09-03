// Server-side auth helpers — scrypt password hashing + HMAC-signed tokens.
// No external deps: Node's built-in crypto only. Tokens are bearer strings
// sent by the client in the Authorization header.

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { withDb } from './db'

// Sign tokens with this secret. In production set AUTH_SECRET in the env;
// a random value would invalidate tokens on every server restart.
const AUTH_SECRET = process.env.AUTH_SECRET || 'aarogya-dev-secret-change-me'
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

const b64url = (buf) => Buffer.from(buf).toString('base64url')
const fromB64url = (str) => Buffer.from(str, 'base64url')

// ── Password hashing (scrypt — memory-hard, no native deps) ──────
export function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `scrypt:${b64url(salt)}:${b64url(hash)}`
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, saltB64, hashB64] = String(stored).split(':')
    if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false
    const salt = fromB64url(saltB64)
    const expected = fromB64url(hashB64)
    const actual = scryptSync(password, salt, expected.length)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

// ── Tokens: base64url(payload).base64url(hmac) ────────────────────
// Payload is a compact JSON {uid, exp}. The HMAC covers tampering and
// gives expiry for free without a session store.
export function signToken(userId) {
  const payload = b64url(JSON.stringify({ uid: userId, exp: Date.now() + TOKEN_TTL_MS }))
  const sig = createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyToken(token) {
  try {
    const [payload, sig] = String(token || '').split('.')
    if (!payload || !sig) return null
    const expected = createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url')
    const a = fromB64url(sig)
    const b = fromB64url(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const data = JSON.parse(fromB64url(payload).toString())
    if (typeof data.uid !== 'string' || typeof data.exp !== 'number' || data.exp < Date.now()) return null
    return data.uid
  } catch {
    return null
  }
}

// Bearer token from the Authorization header → userId, or null.
export function getUserIdFromAuth(request) {
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  return token ? verifyToken(token) : null
}

// ── Account endpoints ────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/

export async function signup(request) {
  const raw = await request.json().catch(() => null)
  const email = String(raw?.email || '').trim().toLowerCase()
  const password = String(raw?.password || '')
  const name = String(raw?.name || '').trim().slice(0, 60)
  if (!EMAIL_RE.test(email)) return { status: 400, body: { error: 'Please enter a valid email address' } }
  if (password.length < 6) return { status: 400, body: { error: 'Password must be at least 6 characters' } }

  const doc = {
    _id: email,
    email,
    name: name || email.split('@')[0],
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  }
  try {
    await withDb(async (db) => db.collection('users').insertOne(doc))
  } catch (e) {
    if (e?.code === 11000) return { status: 409, body: { error: 'An account with this email already exists' } }
    throw e
  }
  return { status: 201, body: { token: signToken(email), user: { email, name: doc.name } } }
}

export async function login(request) {
  const raw = await request.json().catch(() => null)
  const email = String(raw?.email || '').trim().toLowerCase()
  const password = String(raw?.password || '')
  if (!EMAIL_RE.test(email)) return { status: 400, body: { error: 'Please enter a valid email address' } }

  const user = await withDb(async (db) => db.collection('users').findOne({ _id: email }))
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { status: 401, body: { error: 'Wrong email or password' } }
  }
  return { status: 200, body: { token: signToken(email), user: { email: user.email, name: user.name } } }
}

// Claims anonymous device data for a new account so a user who tried the
// app first and signed up later doesn't lose their history.
export async function claimDevice(request, authUserId) {
  const raw = await request.json().catch(() => null)
  const anonId = String(raw?.deviceId || '')
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(anonId)) return { status: 400, body: { error: 'Invalid deviceId' } }
  if (anonId === authUserId) return { status: 200, body: { claimed: 0 } }

  const counts = { checks: 0, reminders: 0, profile: 0 }
  await withDb(async (db) => {
    const res1 = await db.collection('health_checks').updateMany({ userId: anonId }, [{ $set: { userId: authUserId } }])
    counts.checks = res1.modifiedCount
    const res2 = await db.collection('reminders').updateMany({ userId: anonId }, [{ $set: { userId: authUserId } }])
    counts.reminders = res2.modifiedCount
    const res3 = await db.collection('profiles').updateMany({ userId: anonId }, [{ $set: { userId: authUserId } }])
    counts.profile = res3.modifiedCount
  })
  return { status: 200, body: { claimed: counts.checks + counts.reminders + counts.profile, counts } }
}

// Deletes the account (authUserId = email from a valid bearer token) and
// every app document stored under its data partition id. Mirrors the
// client's accountUid(): `user-` + base64url(email).
export async function deleteAccount(authUserId) {
  const dataUid = `user-${Buffer.from(authUserId, 'utf8').toString('base64url')}`
  let removed = 0
  await withDb(async (db) => {
    const r1 = await db.collection('health_checks').deleteMany({ userId: dataUid })
    const r2 = await db.collection('reminders').deleteMany({ userId: dataUid })
    const r3 = await db.collection('profiles').deleteMany({ userId: dataUid })
    const r4 = await db.collection('health_reports').deleteMany({ userId: dataUid })
    removed = r1.deletedCount + r2.deletedCount + r3.deletedCount + r4.deletedCount
    await db.collection('users').deleteOne({ _id: authUserId })
  })
  return { status: 200, body: { deleted: true, documentsRemoved: removed } }
}
