// Shared health computations for Home / Insights — pure functions, no React,
// no storage: everything takes its data in and returns plain values.

// ── BMI (WHO + Indian consensus cutoffs) ─────────────────────────
// South Asians hit metabolic risk at lower BMI than the WHO general chart,
// so both scales are shown: WHO 18.5/25/30 and the Asian-Indian consensus
// 18.5/23/27.5. Never a diagnosis — the copy says so.
export function bmiValue(heightCm, weightKg) {
  const h = Number(heightCm)
  const w = Number(weightKg)
  if (!h || !w || h <= 0 || w <= 0 || h < 60 || h > 250 || w < 10 || w > 400) return null
  // Unrounded on purpose — bands compare against exact thresholds (a 22.98
  // must stay "normal", not round up into the Asian overweight band).
  return w / ((h / 100) ** 2)
}

export function bmiBand(bmi, lang) {
  if (bmi === null || !Number.isFinite(bmi)) return null
  const hi = lang === 'hi'
  // Asian-Indian consensus thresholds (WHO 2004 expert consultation).
  if (bmi < 18.5) return { key: 'under', hi, color: 'text-amber-800', bg: 'bg-amber-50', chip: hi ? 'कम वज़न' : 'Underweight' }
  if (bmi < 23) return { key: 'normal', hi, color: 'text-emerald-700', bg: 'bg-emerald-50', chip: hi ? 'सामान्य' : 'Normal' }
  if (bmi < 27.5) return { key: 'over', hi, color: 'text-amber-800', bg: 'bg-amber-50', chip: hi ? 'अधिक वज़न' : 'Overweight' }
  return { key: 'obese', hi, color: 'text-red-700', bg: 'bg-red-50', chip: hi ? 'मोटापा' : 'Obese' }
}

// ── Today's plan (Home timeline) ────────────────────────────────
// A reminder is "due today" when its `when` is daily, or the weekday it
// names matches today. `today`/`tomorrow` are date-bound: a reminder set
// as "today" only shows that calendar day; "tomorrow" becomes due the
// next one (so on Thursday it never appears, on Friday it does).
// `when` values in use: daily / weekdays / weekends / today / tomorrow /
// once / exact weekday names.
export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

// Day-truncation gives date-bound "today"/"tomorrow" the same matching as
// a chosen moment of that day (midnight-anchored date math).
function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function dueToday(reminder, now = new Date()) {
  const when = reminder.when || 'daily'
  const dow = now.getDay() // 0 = Sunday
  if (when === 'daily') return true
  if (when === 'weekdays') return dow >= 1 && dow <= 5
  if (when === 'weekends') return dow === 0 || dow === 6
  // Date-bound options anchor to the reminder's own creation day: "today"
  // means the calendar day it was made, "tomorrow" exactly one day after.
  if (when === 'today' || when === 'tomorrow') {
    const base = new Date(reminder.createdAt || now)
    const target = new Date(base.getTime() + (when === 'today' ? 0 : 86400000))
    return dayKey(target) === dayKey(now)
  }
  if (when === 'once') return true // one-time items stay on the day they were set for
  // Exact weekday names (en from the form, hi tolerated)
  const days = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
  const idx = days[when.toLowerCase()]
  return idx === undefined ? true : idx === dow
}

// minutes-since-midnight of an "HH:MM" time string (NaN-safe).
function minutesOf(time) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(time || ''))
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

// Sorted plan: overdue first (most overdue on top), then upcoming by time,
// done items last (kept visible with a strike — progress feels real).
export function planForToday(reminders, now = new Date()) {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const list = (reminders || []).filter((r) => dueToday(r, now))
  const withMeta = list.map((r) => {
    const min = minutesOf(r.time)
    return { ...r, _min: min, _overdue: !r.done && min !== null && min < nowMin, _sortDone: r.done ? 1 : 0 }
  })
  withMeta.sort((a, b) => {
    if (a._sortDone !== b._sortDone) return a._sortDone - b._sortDone // pending first
    if (a._min !== null && b._min !== null && a._min !== b._min) return a._min - b._min
    if (a._min === null) return 1
    if (b._min === null) return -1
    return 0
  })
  return withMeta
}

// ── Weekly digest (Insights) ─────────────────────────────────────
// All-time-relevant numbers for the last 7 days. severityRank for
// worst-symptom picks the worst severity seen, ties broken by recency.
const SEV_RANK = { emergency: 4, high: 3, moderate: 2, low: 1 }

export function weeklyDigest(history, reminders, now = new Date()) {
  const since = now.getTime() - 7 * 86400000
  const week = (history || []).filter((h) => new Date(h.createdAt || 0).getTime() >= since)
  const counts = { low: 0, moderate: 0, high: 0, emergency: 0 }
  let worst = null
  let topSymptom = null
  const symptomSeen = new Map()
  for (const h of week) {
    const sev = counts[h.severity] !== undefined ? h.severity : 'low'
    counts[sev]++
    if (!worst || (SEV_RANK[h.severity] || 0) > (SEV_RANK[worst] || 0)) worst = h.severity
    // Top symptom = most frequent summary text (summaries are the engine's
    // own concise labels — "Fever", "Headache + Fever"…)
    const label = String(h.summary || '').trim()
    if (label) {
      const c = (symptomSeen.get(label) || 0) + 1
      symptomSeen.set(label, c)
      if (!topSymptom || c > topSymptom.count) topSymptom = { label, count: c }
    }
  }
  // Reminders completed in the last 7 days: done items whose creation or
  // completion happened in the window (done timestamps aren't tracked
  // separately; createdAt + done is the honest available signal).
  const remindersDone = (reminders || []).filter((r) => r.done && new Date(r.createdAt || 0).getTime() >= since).length
  return {
    checks: week.length,
    counts,
    worst,
    topSymptom,
    remindersDone,
  }
}

// ── Activity streak (Home) ───────────────────────────────────────
// Consecutive days (ending today or yesterday) with at least one saved
// check. "Yesterday-friendly": today's streak already counts even before
// the day's first check, so a morning visit doesn't show "0 days" to a
// user who checked in daily. Never a guilt tool — 0 is a fresh-start day.
export function checkStreak(history, now = new Date()) {
  const days = new Set()
  for (const h of history || []) {
    const t = new Date(h.createdAt || 0)
    if (Number.isNaN(t.getTime())) continue
    days.add(dayKey(t))
  }
  if (days.size === 0) return 0
  let streak = 0
  const cursor = new Date(now)
  // If nothing was saved today, start counting from yesterday — the chain
  // from yesterday still deserves its full length.
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  while (days.has(dayKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}
