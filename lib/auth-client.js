// Client-side auth for AarogyaGPT. A logged-in session switches the app's
// data partition from the anonymous device id to the account (email) id,
// so checks/reminders/profile follow the user across devices once claimed.
//
// Storage shape (localStorage):
//   aarogya.session.v1 = { token, email, name, uid, anonId, savedAt }
//   aarogya.uid.v1     = anonymous device id (kept even after login so
//                        logout returns to the same anonymous partition)

const SESSION_KEY = 'aarogya.session.v1'
const UID_KEY = 'aarogya.uid.v1'

export function getAnonId() {
  if (typeof window === 'undefined') return null
  let uid = window.localStorage.getItem(UID_KEY)
  if (!uid) {
    uid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`
    try { window.localStorage.setItem(UID_KEY, uid) } catch {}
  }
  return uid
}

export function getSession() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!session?.token || !session?.uid) return null
    return session
  } catch {
    return null
  }
}

export function setSession(session) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {}
}

export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {}
}

// Data partition id: account id when logged in, device id otherwise.
export function getDataUid() {
  const session = getSession()
  if (session) return session.uid
  return getAnonId()
}

async function call(path, body, anonId) {
  const res = await fetch(`/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong')
    err.status = res.status
    err.dbDown = !!data.dbDown
    throw err
  }
  return data
}

// Account ids must survive the API's X-User-Id validation
// (^[A-Za-z0-9_-]{8,64}$), so emails are url-safely encoded: "user" +
// base64url(email). Same email always maps to the same id.
function accountUid(email) {
  const b64 = btoa(unescape(encodeURIComponent(email))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `user-${b64}`
}

// Signup/login: create the session, then move this device's anonymous
// data to the account so nothing saved pre-login is lost.
export async function authenticate({ mode, name, email, password }) {
  const anonId = getAnonId()
  const data = await call(mode, { name, email, password })
  const uid = accountUid(data.user.email)
  const session = {
    token: data.token,
    email: data.user.email,
    name: data.user.name,
    uid,
    anonId,
    savedAt: new Date().toISOString(),
  }
  setSession(session)
  try {
    await fetch('/api/auth/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ deviceId: anonId }),
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    // Claim is best-effort — the app still works without it.
  }
  return session
}

export async function logout() {
  clearSession()
}
