// Phase 14 unit tests — daily-reset rollover, doneOn day-key logic,
// storage toggle paths, ICE i18n parity.
// Run: node scripts/unit-phase14.mjs
import { readFileSync, cpSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const libDir = join(here, '..', 'lib')
const tmp = mkdtempSync(join(tmpdir(), 'p14-'))

// Same CJS-package trick as phase 13: copy to .mjs so plain node imports them.
cpSync(join(libDir, 'health.js'), join(tmp, 'health.mjs'))
cpSync(join(libDir, 'storage.js'), join(tmp, 'storage.mjs'))
cpSync(join(libDir, 'i18n.js'), join(tmp, 'i18n.mjs'))
const { todayKey, isDoneToday, rolloverDaily, planForToday } = await import('file://' + join(tmp, 'health.mjs').replace(/\\/g, '/'))
const storage = await import('file://' + join(tmp, 'storage.mjs').replace(/\\/g, '/'))

let pass = 0
const fails = []
const ok = (name, cond, info = '') => {
  if (cond) pass++
  else fails.push(`${name}${info ? ` — ${info}` : ''}`)
}

// ── 1. todayKey ──────────────────────────────────────────────────
ok('todayKey formats YYYY-MM-DD', todayKey(new Date('2026-09-04T10:30:00')) === '2026-9-4'.replace('2026-9-4', '2026-09-04'), todayKey(new Date('2026-09-04T10:30:00')))
ok('todayKey single-digit padding', todayKey(new Date(2026, 0, 5)) === '2026-01-05')

// ── 2. rolloverDaily ─────────────────────────────────────────────
const NOW = new Date('2026-09-04T09:00:00')
const yKey = todayKey(new Date('2026-09-03T09:00:00'))
const tKey = todayKey(NOW)
const dailyYesterday = { id: 'a', when: 'daily', done: true, doneOn: yKey, title: 'Meds', time: '08:00' }
const dailyToday = { id: 'b', when: 'daily', done: true, doneOn: tKey, title: 'Walk', time: '07:00' }
const onceDone = { id: 'c', when: 'once', done: true, title: 'X', time: '09:00' }
const dailyNoMarker = { id: 'd', when: 'daily', done: true, title: 'Legacy', time: '10:00' } // pre-phase14 row
const rolled = rolloverDaily([dailyYesterday, dailyToday, onceDone, dailyNoMarker], NOW)
const byId = Object.fromEntries(rolled.map((r) => [r.id, r]))
ok('yesterday-done daily rolls back to pending', byId.a.done === false, `done=${byId.a.done}`)
ok('today-done daily stays done', byId.b.done === true)
ok('once/one-shot keeps boolean (no surprise reset)', byId.c.done === true)
ok('legacy no-marker daily keeps boolean (honest)', byId.d.done === true)
ok('weekdays/weekends roll like daily', (() => {
  const w = rolloverDaily([{ id: 'w', when: 'weekdays', done: true, doneOn: yKey }], NOW)
  return w[0].done === false
})())
ok('rollover does not mutate input', dailyYesterday.done === true)

// ── 3. isDoneToday ───────────────────────────────────────────────
ok('isDoneToday true for today marker', isDoneToday({ done: true, doneOn: tKey }, NOW) === true)
ok('isDoneToday false for yesterday marker', isDoneToday({ done: true, doneOn: yKey }, NOW) === false)

// ── 4. plan reflects rollover (integration-ish) ──────────────────
const plan = planForToday(rolled, new Date('2026-09-04T10:00:00'))
const planIds = plan.map((r) => r.id)
ok('rolled-back daily appears pending in plan', planIds.includes('a'))
const stillDone = plan.find((r) => r.id === 'b')
ok('today-done daily sits in done group', stillDone?._sortDone === 1)

// ── 5. storage.toggleReminder day-marker paths (localStorage shim) ─
globalThis.window = { localStorage: (() => {
  let mem = {}
  return {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v) },
    removeItem: (k) => { delete mem[k] },
  }
})() }
const reloaded = await import('file://' + join(tmp, 'storage.mjs').replace(/\\/g, '/'))
// seed two reminders: fresh daily pending + yesterday-done daily
const seed = [
  { id: 'rem_seed1', title: 'Fresh', time: '08:00', when: 'daily', type: 'medication', done: false, createdAt: '2026-09-04T01:00:00.000Z' },
  { id: 'rem_seed2', title: 'Old', time: '09:00', when: 'daily', type: 'water', done: true, doneOn: yKey, createdAt: '2026-09-03T01:00:00.000Z' },
]
globalThis.window.localStorage.setItem('aarogya.reminders.v1', JSON.stringify(seed))
const toggled1 = reloaded.toggleReminder('rem_seed1', NOW)
const t1 = toggled1.find((r) => r.id === 'rem_seed1')
ok('toggle ON writes doneOn=today', t1.done === true && t1.doneOn === tKey, JSON.stringify({ done: t1.done, doneOn: t1.doneOn }))
const toggled2 = reloaded.toggleReminder('rem_seed1', NOW)
const t2 = toggled2.find((r) => r.id === 'rem_seed1')
ok('toggle OFF clears doneOn', t2.done === false && t2.doneOn === undefined, JSON.stringify({ done: t2.done, doneOn: t2.doneOn }))
const toggled3 = reloaded.toggleReminder('rem_seed2', NOW)
const t3 = toggled3.find((r) => r.id === 'rem_seed2')
ok('tap on yesterday-done daily marks TODAY done (not undo)', t3.done === true && t3.doneOn === tKey, JSON.stringify({ done: t3.done, doneOn: t3.doneOn }))

// ── 6. i18n ICE key parity EN/HI ─────────────────────────────────
const { LANGUAGES, makeT } = await import('file://' + join(tmp, 'i18n.mjs').replace(/\\/g, '/'))
const keys = ['iceTitle', 'iceSub', 'iceOpen', 'iceCardTitle', 'iceName', 'iceAge', 'iceBlood', 'iceConditions', 'iceAllergies', 'iceMeds', 'iceContact', 'iceNone', 'iceCall', 'iceNote']
for (const code of LANGUAGES.map((l) => l.code)) {
  const t = makeT(code)
  const missing = keys.filter((k) => !t(k) || t(k) === k)
  ok(`ICE keys exist in ${code}`, missing.length === 0, missing.join(','))
}

// cleanup + report
rmSync(tmp, { recursive: true, force: true })
console.log(`\nunit-phase14: ${pass} passed, ${fails.length} failed`)
if (fails.length) {
  fails.forEach((f) => console.log('  ❌ ' + f))
  process.exit(1)
}
console.log('  all green ✅')
