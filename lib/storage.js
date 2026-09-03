// AarogyaGPT storage — SSR-safe localStorage persistence.
// Health history, reminders and profile stay on this device only.

const KEYS = {
  history: 'aarogya.history.v1',
  reminders: 'aarogya.reminders.v1',
  profile: 'aarogya.profile.v1',
  lang: 'aarogya.lang.v1',
}

const hasLS = () => typeof window !== 'undefined' && !!window.localStorage

function read(key, fallback) {
  if (!hasLS()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

function write(key, value) {
  if (!hasLS()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked — degrade silently, app still works in-memory.
  }
}

// ── Health history ──────────────────────────────────────────────
export function getHistory() {
  return read(KEYS.history, [])
}

export function addHistoryCheck(entry) {
  const item = {
    id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text: entry.text || '',
    summary: entry.summary || '',
    severity: entry.severity || 'low',
    lang: entry.lang || 'en',
    createdAt: new Date().toISOString(),
  }
  const list = [item, ...getHistory()].slice(0, 50)
  write(KEYS.history, list)
  return item
}

export function deleteHistoryCheck(id) {
  write(KEYS.history, getHistory().filter(x => x.id !== id))
}

export function clearHistory() {
  write(KEYS.history, [])
}

// ── Reminders ───────────────────────────────────────────────────
export function getReminders() {
  return read(KEYS.reminders, [])
}

export function addReminder({ title, time, when = 'daily', type = 'other' }) {
  const item = {
    id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim(),
    time,
    when,
    type,
    done: false,
    createdAt: new Date().toISOString(),
  }
  write(KEYS.reminders, [item, ...getReminders()].slice(0, 100))
  return item
}

export function updateReminder(id, patch) {
  const list = getReminders().map(r => (r.id === id ? { ...r, ...patch } : r))
  write(KEYS.reminders, list)
  return list
}

export function toggleReminder(id) {
  const list = getReminders().map(r => (r.id === id ? { ...r, done: !r.done } : r))
  write(KEYS.reminders, list)
  return list
}

export function deleteReminder(id) {
  const list = getReminders().filter(r => r.id !== id)
  write(KEYS.reminders, list)
  return list
}

// ── Profile ─────────────────────────────────────────────────────
// Fixed default so SSR and the client's first render agree (hydration-safe);
// real values load from localStorage/server after mount.
export const DEFAULT_PROFILE = {
  name: '',
  age: '',
  gender: '',
  bloodGroup: '',
  height: '',
  weight: '',
  conditions: '',
  allergies: '',
  medications: '',
  emergencyContact: '',
  memberSince: new Date().getFullYear().toString(),
  memoryEnabled: false,
}

const defaultProfile = DEFAULT_PROFILE

export function getProfile() {
  return { ...defaultProfile, ...read(KEYS.profile, {}) }
}

export function saveProfile(patch) {
  const next = { ...getProfile(), ...patch }
  write(KEYS.profile, next)
  return next
}

// ── Language preference ─────────────────────────────────────────
export function getLang() {
  return read(KEYS.lang, 'en')
}

export function setLang(lang) {
  write(KEYS.lang, lang)
}
