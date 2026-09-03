// Phase 13 unit tests — triage intent router + duration escalation +
// new symptom rules + health.js plan dates & streak.
// Run: node scripts/unit-phase13.mjs  (exits 1 on any failure)
import { readFileSync, writeFileSync, unlinkSync, cpSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const libDir = join(here, '..', 'lib')
const tmp = mkdtempSync(join(tmpdir(), 'p13-'))

// lib files use ESM export syntax but the package is CJS-default — copy to
// .mjs so plain node can import them.
cpSync(join(libDir, 'triage.js'), join(tmp, 'triage.mjs'))
cpSync(join(libDir, 'health.js'), join(tmp, 'health.mjs'))
const { assess, assessWithIntent, buildAssessment, severityMeta } = await import('file://' + join(tmp, 'triage.mjs').replace(/\\/g, '/'))
const { dueToday, planForToday, checkStreak } = await import('file://' + join(tmp, 'health.mjs').replace(/\\/g, '/'))

let pass = 0
const fails = []
const ok = (name, cond, info = '') => {
  if (cond) pass++
  else fails.push(`${name}${info ? ` — ${info}` : ''}`)
}

// ── 1. Intent router ────────────────────────────────────────────
const homeCare = assessWithIntent('What can I do at home for fever?')
ok('homeCare intent detected', homeCare.intent === 'homeCare', `got ${homeCare.intent}`)
ok('homeCare fever gets fever-specific advice', /paracetamol|rest, light food/i.test(homeCare.advice.en[0]), homeCare.advice.en[0].slice(0, 60))
ok('homeCare fever Hindi mirror', homeCare.advice.hi[0].includes('ORS') || homeCare.advice.hi[0].includes('खिचड़ी'), homeCare.advice.hi[0].slice(0, 40))

const medCough = assessWithIntent('kya khansi ke liye dava leni chahiye') // is medicine needed for cough
ok('Hinglish medicine intent detected', medCough.intent === 'medicine', `got ${medCough.intent}`)
ok('medicine cough = viral, no antibiotics', /no antibiotics|antibiotics/i.test(medCough.advice.en[0]))

const howLongFever = assessWithIntent('How long until fever gets better?')
ok('howLong intent detected', howLongFever.intent === 'howLong', `got ${howLongFever.intent}`)
ok('howLong fever mentions 3-5 days', /3-5 days/i.test(howLongFever.advice.en[0]))

const whenDoc = assessWithIntent('When should I see a doctor for tooth pain?')
ok('whenDoctor intent detected', whenDoc.intent === 'whenDoctor', `got ${whenDoc.intent}`)
ok('whenDoctor tooth gets tooth urgency (face swelling)', /swelling|same-day/i.test(whenDoc.advice.en[0]))
ok('whenDoctor upgrades severity to high', whenDoc.severity === 'high', `severity=${whenDoc.severity}`)

const prevAsthma = assessWithIntent('How can I prevent asthma next time?')
ok('prevent intent detected', prevAsthma.intent === 'prevent', `got ${prevAsthma.intent}`)
ok('prevent asthma = trigger diary', /trigger/i.test(prevAsthma.advice.en[0]))

// Generic fallback — symptom not in the table (womenshealth homeCare)
const generic = assessWithIntent('What can I do at home for period pain?')
ok('homeCare womenshealth has its own row', /hot-water bag|warm/i.test(generic.advice.en[0]), generic.advice.en[0].slice(0, 50))

// No intent → plain triage unchanged
const plain = assessWithIntent('I have a fever')
ok('no intent words → plain triage', plain.intent === undefined && plain.advice.en.length >= 1 && /Rest/i.test(plain.advice.en[0]))

// Emergency still wins over any intent phrasing
const esc = assessWithIntent('what can I do at home for chest pain')
ok('emergency overrides intent routing', esc.emergency === true && esc.intent === undefined)

// ── 2. Duration escalation ──────────────────────────────────────
const fourDayFever = assess('bukhar hai 4 din se')
ok('4-day fever escalates to high', fourDayFever.severity === 'high', `severity=${fourDayFever.severity}`)
ok('escalation carries doctor note', /past the usual course/i.test(fourDayFever.advice.en.join(' ')))
ok('escalation summary marks duration', /4 days/.test(fourDayFever.summary.en), fourDayFever.summary.en)
const fourDayFeverHi = assess('4 दिन से बुखार है')
ok('digit+Devanagari duration escalates', fourDayFeverHi.severity === 'high' && /4 दिन/.test(fourDayFeverHi.summary.hi))
const shortFever = assess('bukhar hai kal se') // "since yesterday" — no day count
ok('no day count → no escalation', shortFever.severity === 'moderate', `severity=${shortFever.severity}`)
const twoDayFever = assess('2 din se bukhar')
ok('2-day fever stays moderate', twoDayFever.severity === 'moderate')
const cough2w = assess('khansi hai 15 din se')
ok('15-day cough escalates to high', cough2w.severity === 'high')
ok('cough escalation keeps cough advice', /viral|steam|warm/i.test(cough2w.advice.en.join(' ')))
const weekHeadache = assess('sir dard ek hafte se')
ok('1-week headache escalates', weekHeadache.severity === 'high')

// ── 3. New symptom rules ────────────────────────────────────────
const ear = assess('kaan me dard ho raha hai')
ok('ear pain rule matches Hinglish', /Ear/i.test(ear.summary.en), ear.summary.en)
const tooth = assess('दाँत में दर्द है')
ok('tooth pain rule matches Devanagari', /Tooth/i.test(tooth.summary.en), tooth.summary.en)
const kabz = assess('pet saaf nahi ho raha, kabz hai')
ok('constipation rule matches', /Constipation/i.test(kabz.summary.en), kabz.summary.en)
const asthma = assess('wheezing ho rahi hai aur seeti jaisi awaaz, dam ki bimari')
ok('asthma rule matches Hinglish', /Asthma/i.test(asthma.summary.en), asthma.summary.en)

// ── 4. severityMeta low tone is green-free ───────────────────────
ok('low severity tone has no emerald class', !JSON.stringify(severityMeta.low).includes('emerald'))

// ── 5. health.js plan dates ─────────────────────────────────────
const thu = new Date('2026-09-03T14:00:00') // Thursday
const fri = new Date('2026-09-04T10:00:00') // Friday
const todayThu = { id: 'a', title: 'A', time: '09:00', when: 'today', done: false, createdAt: '2026-09-03T08:00:00Z' }
const tom = { id: 'b', title: 'B', time: '09:00', when: 'tomorrow', done: false, createdAt: '2026-09-03T08:00:00Z' }
ok("today item is due on its day", dueToday(todayThu, thu) === true)
ok("today item is NOT due the next day", dueToday(todayThu, fri) === false)
ok("tomorrow item not due on Thursday", dueToday(tom, thu) === false)
const fri2 = new Date('2026-09-04T09:30:00')
ok("tomorrow item (set Thu) is due on Friday", dueToday(tom, fri2) === true)
const planThu = planForToday([todayThu, tom], new Date('2026-09-03T15:00:00'))
ok("Thursday plan = only today item", planThu.length === 1 && planThu[0].id === 'a', JSON.stringify(planThu.map((r) => r.id)))
const planFri = planForToday([todayThu, tom], new Date('2026-09-04T09:30:00'))
ok("Friday plan = only tomorrow item (now today)", planFri.length === 1 && planFri[0].id === 'b')

// ── 6. checkStreak ──────────────────────────────────────────────
const NOW = new Date('2026-09-03T12:00:00')
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString()
const hist3 = [0, 1, 2].map((n) => ({ id: `c${n}`, severity: 'low', createdAt: daysAgo(n) }))
ok('streak counts 3 consecutive days', checkStreak(hist3, NOW) === 3, `got ${checkStreak(hist3, NOW)}`)
const gap = [{ id: 'g0', severity: 'low', createdAt: daysAgo(1) }, { id: 'g1', severity: 'low', createdAt: daysAgo(3) }]
ok('gap yesterday→3-days-ago caps streak at 1', checkStreak(gap, NOW) === 1, `got ${checkStreak(gap, NOW)}`)
ok('empty history = streak 0', checkStreak([], NOW) === 0)
const todayOnly = [{ id: 't0', severity: 'low', createdAt: daysAgo(0) }]
ok('check today only = streak 1', checkStreak(todayOnly, NOW) === 1)

// ── 7. buildAssessment rides the intent router ───────────────────
const built = buildAssessment('What can I do at home for fever?')
ok('buildAssessment uses intent content', /rest, light food/i.test(built.replyParts.en.join(' ')), built.replyParts.en.join(' ').slice(0, 80))

// cleanup + report
rmSync(tmp, { recursive: true, force: true })
console.log(`\nunit-phase13: ${pass} passed, ${fails.length} failed`)
if (fails.length) {
  fails.forEach((f) => console.log('  ❌ ' + f))
  process.exit(1)
}
console.log('  all green ✅')
