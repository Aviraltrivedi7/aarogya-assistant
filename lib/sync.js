// AarogyaGPT sync layer — server-first with localStorage fallback.
// Every read tries the API first; every write mirrors to localStorage.
// If the backend is unreachable the app keeps working in device-only mode.

import * as local from './storage'
import { getAnonId, getDataUid, getSession } from './auth-client'

const listeners = new Set()
let mode = 'local' // 'cloud' | 'local' — until a server call succeeds

export function getMode() {
  return mode
}

export function subscribeToMode(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function setMode(next) {
  if (mode === next) return
  mode = next
  listeners.forEach((cb) => {
    try { cb(next) } catch {}
  })
}

// ── Data identity (account when logged in, device otherwise) ──────
export function getUserId() {
  if (typeof window === 'undefined') return null
  return getDataUid()
}

// ── Fetch wrapper ────────────────────────────────────────────────
// Exported for feature sections that need raw responses (reports etc.).
export async function api(path, { method = 'GET', body, timeout = 15000, headers = {} } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': getUserId() || '',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  })
  return res
}

// Calls the API; on success marks cloud mode. A 5xx/network failure
// downgrades to local mode and throws so callers can fall back.
async function apiOrThrow(path, opts) {
  let res
  try {
    res = await api(path, opts)
  } catch {
    setMode('local')
    throw new Error('network')
  }
  if (res.status === 503) {
    setMode('local')
    throw new Error('db-down')
  }
  if (!res.ok) throw new Error(`status-${res.status}`)
  setMode('cloud')
  return res.json()
}

// Fire-and-forget server mirror — used after local writes. Silence is
// golden: a failure only downgrades the mode, the UI never blocks.
function mirror(path, opts) {
  api(path, opts).catch(() => setMode('local'))
}

const newest = (a, b) => new Date(b.createdAt) - new Date(a.createdAt)

// ── Initial load: server first, merge with local, back-sync ─────
export async function loadAll() {
  const localHistory = local.getHistory()
  const localReminders = local.getReminders()
  const localProfile = local.getProfile()

  let history = localHistory
  let reminders = localReminders
  let profile = localProfile

  try {
    const [serverHistory, serverReminders, serverProfile] = await Promise.all([
      apiOrThrow('/checks'),
      apiOrThrow('/reminders'),
      apiOrThrow('/profile'),
    ])

    // Merge by id; server entries win, local-only entries are kept and
    // pushed back so devices that were offline come back into sync.
    const mergeById = (server, localList, preferServer) => {
      const map = new Map()
      for (const item of localList) map.set(item.id, item)
      for (const item of server) {
        map.set(item.id, preferServer ? { ...map.get(item.id), ...item } : { ...item, ...(map.get(item.id) || {}) })
      }
      const merged = [...map.values()].sort(newest)
      const localOnly = localList.filter((i) => !server.some((s) => s.id === i.id))
      return { merged, localOnly }
    }

    const h = mergeById(serverHistory.map((d) => {
      const { userId, ...rest } = d; return rest
    }), localHistory, true)
    const r = mergeById(serverReminders.map((d) => {
      const { userId, ...rest } = d; return rest
    }), localReminders, true)

    history = h.merged
    reminders = r.merged

    if (serverProfile && serverProfile.exists !== false) {
      const { userId, exists, ...p } = serverProfile
      profile = { ...localProfile, ...p }
    }

    // Persist merged state locally.
    try {
      window.localStorage.setItem('aarogya.history.v1', JSON.stringify(history))
      window.localStorage.setItem('aarogya.reminders.v1', JSON.stringify(reminders))
      window.localStorage.setItem('aarogya.profile.v1', JSON.stringify(profile))
    } catch {}

    // Back-sync items created while offline.
    if (h.localOnly.length) mirror('/checks', { method: 'POST', body: h.localOnly })
    if (r.localOnly.length) mirror('/reminders', { method: 'POST', body: r.localOnly })
  } catch {
    setMode('local') // server unreachable — local data already loaded
  }

  return { history, reminders, profile, mode }
}

// ── Health checks ────────────────────────────────────────────────
export function addHistoryCheck(entry) {
  const item = local.addHistoryCheck(entry)
  mirror('/checks', { method: 'POST', body: item })
  return item
}

export function deleteHistoryCheck(id) {
  const list = local.getHistory().filter((x) => x.id !== id)
  local.deleteHistoryCheck(id)
  mirror('/checks/' + encodeURIComponent(id), { method: 'DELETE' })
  return list
}

export function clearHistory() {
  local.clearHistory()
  mirror('/checks', { method: 'DELETE' })
}

// ── Reminders ────────────────────────────────────────────────────
export function getRemindersFromLocal() {
  return local.getReminders()
}

export function addReminder(data) {
  const item = local.addReminder(data)
  mirror('/reminders', { method: 'POST', body: item })
  return item
}

export function toggleReminder(id) {
  const list = local.toggleReminder(id)
  const changed = list.find((r) => r.id === id)
  if (changed) mirror('/reminders/' + encodeURIComponent(id), { method: 'PATCH', body: { done: changed.done } })
  return list
}

export function updateReminder(id, patch) {
  const list = local.updateReminder(id, patch)
  const changed = list.find((r) => r.id === id)
  if (changed) mirror('/reminders/' + encodeURIComponent(id), { method: 'PATCH', body: patch })
  return list
}

export function deleteReminder(id) {
  const list = local.deleteReminder(id)
  mirror('/reminders/' + encodeURIComponent(id), { method: 'DELETE' })
  return list
}

// ── Profile ──────────────────────────────────────────────────────
export function saveProfile(patch) {
  const next = local.saveProfile(patch)
  mirror('/profile', { method: 'PUT', body: next })
  return next
}

// ── Privacy: export / erase everything ──────────────────────────
// Builds the full local data set for download (client-side JSON file).
export function exportLocalData() {
  return {
    exportedAt: new Date().toISOString(),
    app: 'AarogyaGPT',
    profile: local.getProfile(),
    healthChecks: local.getHistory(),
    reminders: local.getReminders(),
  }
}

export function eraseAllLocal() {
  local.clearHistory()
  window.localStorage.removeItem('aarogya.reminders.v1')
  window.localStorage.removeItem('aarogya.profile.v1')
}

// ── AI assistant (server-side triage, local engine as fallback) ──
// Recent turns for GPT context: user texts + the assistant's own rendered
// answers, oldest first, capped by the server schema (6 entries).
export async function assessViaServer(message, lang, history = []) {
  const data = await apiOrThrow('/assistant', {
    method: 'POST',
    body: { message, lang, history },
    timeout: 20000,
  })
  return {
    reply: data.reply,
    severity: data.severity,
    summary: data.summary,
    advice: data.advice,
    seek: data.seek,
    emergency: data.emergency,
    source: data.source,
  }
}

// ── Nearby care (server-side Overpass proxy) ─────────────────────
export async function nearbyViaServer(lat, lon) {
  const data = await apiOrThrow(`/nearby?lat=${lat}&lon=${lon}`, { timeout: 25000 })
  return data.places
}
