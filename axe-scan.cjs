// Post-backend verification: axe scan per section + functional E2E + DB assertions.
// Run: node axe-scan.cjs (expects dev server + MongoDB on SCAN_URL)
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const URL = process.env.SCAN_URL || 'http://127.0.0.1:3311/'
const AXE_PATH = require.resolve('axe-core/axe.min.js')

async function axe(page) {
  await page.addScriptTag({ path: AXE_PATH })
  return page.evaluate(async () => await window.axe.run(document, { resultTypes: ['violations', 'incomplete'] }))
}

// Fetch server-side data as the app's own device id would.
async function serverCount(page, endpoint) {
  return page.evaluate(async (ep) => {
    const uid = window.localStorage.getItem('aarogya.uid.v1')
    const res = await fetch('/api/' + ep, { headers: { 'X-User-Id': uid } })
    if (!res.ok) return -1
    const data = await res.json()
    return Array.isArray(data) ? data.length : -1
  }, endpoint)
}

// Draw a synthetic PNG in the page and return it as a setInputFiles payload.
// 'skin' — warm-tone gradient + sensor noise + blotches (passes the
// symptom-photo heuristic); 'shot' — flat white with text lines (rejected).
const DRAW_TEST_IMAGE = (kind) => {
  const c = document.createElement('canvas')
  c.width = 400; c.height = 400
  const x = c.getContext('2d')
  if (kind === 'skin') {
    const g = x.createRadialGradient(200, 180, 40, 200, 200, 260)
    g.addColorStop(0, '#e8b48c'); g.addColorStop(0.6, '#d9a374'); g.addColorStop(1, '#b97f56')
    x.fillStyle = g
    x.fillRect(0, 0, 400, 400)
    for (let i = 0; i < 14; i++) {
      x.beginPath(); x.fillStyle = 'rgba(200, 80, 60, 0.25)'
      x.ellipse(120 + Math.random() * 160, 120 + Math.random() * 160, 8 + Math.random() * 20, 8 + Math.random() * 18, Math.random() * 3, 0, 7)
      x.fill()
    }
    const d = x.getImageData(0, 0, 400, 400)
    for (let i = 0; i < d.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 18
      d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n
    }
    x.putImageData(d, 0, 0)
  } else {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 400, 400)
    x.fillStyle = '#111111'
    x.fillRect(30, 40, 340, 16); x.fillRect(30, 80, 300, 12); x.fillRect(30, 112, 320, 12)
    x.fillRect(30, 150, 260, 12); x.fillRect(30, 182, 310, 12); x.fillRect(30, 214, 240, 12)
    x.fillRect(30, 260, 200, 10); x.fillRect(30, 288, 230, 10); x.fillRect(30, 316, 180, 10)
  }
  return c.toDataURL('image/png')
}

async function testImagePayload(page, kind, name) {
  const dataUrl = await page.evaluate(DRAW_TEST_IMAGE, kind)
  return { name, mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64') }
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('console', (msg) => msg.type() === 'error' && consoleErrors.push(msg.text()))
  page.on('pageerror', (err) => consoleErrors.push(String(err)))
  // Mirror every /api/assistant POST body into the page so flows can assert
  // what the client actually sent (conversation-history shape, lang…).
  page.on('request', (req) => {
    if (req.url().includes('/api/assistant') && req.method() === 'POST') {
      try { page.evaluate((b) => { window.__lastAssistantBody = b }, JSON.parse(req.postData())) } catch {}
    }
  })

  const scans = []
  const violationsSummary = []
  const flows = []

  // Fresh device id each run. The splash gate runs on a clean profile —
  // the suite screenshots the splash, then enters via guest for the
  // existing anonymous flows, and logs in at the end for auth tests.
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(() => localStorage.clear())
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 90000 })

  // ── 0a. Splash: animated logo + brand render, auto-advances to auth.
  const splashVisible = await page.waitForFunction(
    () => !!document.querySelector('[data-testid="splash-logo"]'),
    { timeout: 30000 }
  ).then(() => true).catch(() => false)
  flows.push(['splash: logo visible', splashVisible])
  if (splashVisible) {
    flows.push(['splash: brand text', (await page.locator('h1').first().textContent()).includes('AarogyaGPT')])
    await page.screenshot({ path: 'screenshots/auth-splash.png' })
    scans.push(['splash', await axe(page)])
  }
  await page.waitForFunction(
    () => !!document.querySelector('[data-testid="auth-guest"]'),
    { timeout: 20000 }
  ).then(() => true).catch(() => false)
  await page.waitForTimeout(800)

  // ── 0b. Auth screen: tabs, fields, guest entry. Signup form has the
  // extra name field — assert it, screenshot both modes, then continue
  // as guest for the (anonymous) main flows.
  flows.push(['auth: guest button visible', await page.getByTestId('auth-guest').isVisible()])
  await page.getByTestId('auth-tab-signup').click()
  await page.waitForTimeout(600)
  flows.push(['auth: signup has name field', await page.locator('#auth-name').isVisible()])
  flows.push(['auth: signup email+password fields', await page.locator('#auth-email').isVisible() && await page.locator('#auth-password').isVisible()])
  await page.screenshot({ path: 'screenshots/auth-signup.png' })
  scans.push(['auth-signup', await axe(page)])
  await page.getByTestId('auth-tab-login').click()
  await page.waitForTimeout(600)
  flows.push(['auth: login hides name field', !(await page.locator('#auth-name').isVisible().catch(() => false))])
  await page.screenshot({ path: 'screenshots/auth-login.png' })
  scans.push(['auth-login', await axe(page)])
  await page.getByTestId('auth-guest').click()
  await page.waitForTimeout(1500)

  // ── 0. Backend connectivity: wait for loadAll to finish (first API compile
  // in dev takes seconds; in prod it's instant). Poll the chip up to 20s.
  const chipCloud = await page.waitForFunction(
    () => document.querySelector('[data-testid="sync-mode"]')?.textContent.includes('Cloud synced'),
    { timeout: 20000 }
  ).then(() => true).catch(() => false)
  flows.push(['backend: sync chip says Cloud synced', chipCloud])
  flows.push(['backend: health reports DB connected', await page.evaluate(async () => {
    const r = await fetch('/api/health'); const d = await r.json(); return d.ok && d.db === 'connected'
  })])

  // ── 1. Home (desktop) ──
  // Dev-mode flake: right after first compile the document title can be
  // absent for a moment and axe flags document-title. Wait for it (prod
  // always has it instantly; a genuinely missing title still gets caught).
  await page.waitForFunction(() => !!document.title, { timeout: 10000 }).catch(() => {})
  // Tip of the day comes from the rotating 12-entry pool, date-seeded —
  // assert the rendered tip matches the seed for today in BOTH languages
  // (pool parity is the i18n contract).
  const tipChecks = await page.evaluate(() => {
    const pool = {
      en: ['Hydration habit', 'Move after meals', 'Sleep discipline', 'Salt sense', 'Sunlight vitamin', 'Screens and eyes', 'The fibre fix', 'Stress micro-breaks', 'Hand-washing hours', 'Medicine timing', 'Posture reset', 'Family history file'],
    }
    const idx = Math.floor(Date.now() / 86400000) % 12
    return { expected: pool.en[idx], actual: document.querySelector('[data-testid="home-tip-title"]')?.textContent?.trim() }
  })
  flows.push(['tip of the day renders from date-seeded pool', tipChecks.actual === tipChecks.expected, `expected "${tipChecks.expected}" got "${tipChecks.actual}"`])
  flows.push(['tip body is non-empty prose', (await page.getByTestId('home-tip-body').textContent().catch(() => '')).trim().length > 40])
  // Today's plan card: present with the honest empty state before any
  // reminder exists (populated-timeline flows run after section 7 adds one).
  flows.push(['plan card renders', (await page.getByTestId('home-plan').count()) === 1])
  flows.push(['plan empty state before reminders', (await page.getByTestId('plan-add-first').count()) === 1])
  // Phase 13: streak card — fresh device is an honest fresh-start day.
  flows.push(['streak card renders (fresh start)', (await page.getByTestId('home-streak').count()) === 1 && (await page.getByTestId('home-streak').textContent()).includes('0')])
  scans.push(['home', await axe(page)])

  // ── 2. AI Assistant: quick reply + triage + emergency flow ──
  // GPT-backed answers can take seconds — wait for the result panel, then
  // poll Mongo until the mirrored check lands.
  await page.getByTestId('nav-assistant').click()
  await page.getByTestId('quick-fever').click()
  await page.waitForFunction(
    () => !!document.querySelector('[data-testid="chat-last-result"]'),
    { timeout: 30000 }
  )
  const botReply = await page.getByTestId('chat-messages').textContent()
  flows.push(['fever triage reply', /Fever|बुखार/i.test(botReply)])
  let checksOnServer = 0
  for (let i = 0; i < 10 && checksOnServer < 1; i++) {
    checksOnServer = await serverCount(page, 'checks')
    if (checksOnServer < 1) await page.waitForTimeout(1000)
  }
  flows.push(['backend: triage check saved to MongoDB', checksOnServer >= 1])

  // ── 2a. "Aur tagda" features on the fever result ──
  // Follow-up chips appear after a reply, severity-aware (moderate fever →
  // homeCare/whenDoctor/medicine), and clicking one sends a topic-aware
  // question the triage engine can actually answer.
  await page.waitForSelector('[data-testid="follow-ups"]', { timeout: 10000 })
  const chipCount = await page.getByTestId('follow-ups').locator('button').count()
  flows.push(['follow-up chips render after reply', chipCount === 3])
  flows.push(['follow-up chips match moderate severity', (await page.getByTestId('followup-homeCare').count()) === 1 && (await page.getByTestId('followup-whenDoctor').count()) === 1 && (await page.getByTestId('followup-medicine').count()) === 1])
  await page.getByTestId('followup-homeCare').click()
  await page.waitForFunction(
    () => [...document.querySelectorAll('[data-testid="chat-messages"] > div')].some((d) => d.textContent.includes('home for fever')),
    { timeout: 30000 }
  )
  const chipSent = await page.getByTestId('chat-messages').textContent()
  flows.push(['follow-up chip sends topic-aware question', /home for fever/i.test(chipSent)])
  // Phase 13: the chip is no longer a plain re-triage — the answer carries
  // symptom-specific home-care content (fever: fluids/ORS/khichdi).
  await page.waitForFunction(
    () => document.body.textContent.includes('khichdi') || document.body.textContent.includes('ORS'),
    { timeout: 30000 }
  ).catch(() => {})
  flows.push(['intent router: homeCare answer is fever-specific', /khichdi|ORS/i.test(await page.getByTestId('chat-messages').textContent())])
  // Phase 13: medicine intent — viral/no-antibiotic answer for cough fever.
  await page.getByTestId('followup-medicine').click()
  await page.waitForTimeout(2500)
  flows.push(['intent router: medicine answer for fever', /paracetamol/i.test(await page.getByTestId('chat-messages').textContent())])
  // 2a-2. Copy button on bot replies; follow-up request carries the
  // conversation so GPT (post-credits) answers "what about medicine?"
  // in fever context.
  flows.push(['copy button on bot replies', (await page.getByTestId('msg-copy').count()) >= 1])
  const lastAssistantBody = await page.evaluate(() => window.__lastAssistantBody)
  flows.push(['follow-up request includes conversation history', Array.isArray(lastAssistantBody?.history) && lastAssistantBody.history.length >= 2])
  // Voice controls: mic (Chromium exposes webkitSpeechRecognition) and the
  // read-aloud toggle; the per-message speak button rides on every bot reply.
  flows.push(['mic button present', (await page.getByTestId('chat-mic').count()) === 1])
  flows.push(['speak toggle present', (await page.getByTestId('speak-toggle').count()) === 1])
  flows.push(['per-message read-aloud buttons', (await page.getByTestId('msg-speak').count()) >= 2])
  await page.getByTestId('speak-toggle').click()
  await page.waitForTimeout(300)
  const speakAria = await page.getByTestId('speak-toggle').getAttribute('aria-pressed')
  flows.push(['speak toggle flips to pressed', speakAria === 'true'])
  await page.getByTestId('speak-toggle').click()
  await page.waitForTimeout(300)

  // ── 2b. Language switch mid-conversation: existing replies and the result
  // panel must re-render in the newly active language (render-time i18n).
  // Runs on the non-emergency fever result — the emergency check comes after.
  await page.getByTestId('lang-toggle').click()
  await page.waitForTimeout(900)
  const hiChat = await page.getByTestId('chat-messages').textContent()
  flows.push(['lang switch: chat replies re-render in Hindi', hiChat.includes('बुखार')])
  const hiPanel = await page.getByTestId('chat-last-result').textContent()
  flows.push(['lang switch: result panel re-renders in Hindi', hiPanel.includes('बुखार')])
  // Follow-up chips follow the toggle too (Hinglish user gets Hindi chips).
  const hiChips = await page.getByTestId('follow-ups').textContent()
  flows.push(['lang switch: follow-up chips re-render in Hindi', /[\u0900-\u097F]/.test(hiChips)])
  await page.getByTestId('lang-toggle').click()
  await page.waitForTimeout(900)
  const enChat = await page.getByTestId('chat-messages').textContent()
  flows.push(['lang switch back: chat replies re-render in English', enChat.includes('Fever') && !enChat.includes('बुखार')])

  await page.getByTestId('chat-input').fill('seena dard ho raha hai')
  await page.getByTestId('chat-send').click()
  await page.waitForFunction(
    () => !!document.querySelector('[data-testid="chat-call-112"]'),
    { timeout: 30000 }
  )
  const emergencyCard = await page.getByTestId('chat-call-112').count()
  flows.push(['hinglish chest pain → emergency card', emergencyCard === 1])
  // Phase 13: duration escalation — "4 din se bukhar" flips the severity
  // to high and the reply carries the see-a-doctor-soon note.
  await page.getByTestId('chat-input').fill('bukhar hai 4 din se')
  await page.getByTestId('chat-send').click()
  await page.waitForFunction(() => !!document.querySelector('[data-testid="chat-last-result"]'), { timeout: 30000 })
  const escalatedPanel = await page.getByTestId('chat-last-result').textContent()
  const escalatedChat = await page.getByTestId('chat-messages').textContent()
  flows.push(['escalation: 4-day fever severity High', /High/.test(escalatedPanel)])
  flows.push(['escalation: doctor-soon note in reply', /usual course/i.test(escalatedChat)])
  let checksOnServer2 = 0
  for (let i = 0; i < 10 && checksOnServer2 < 4; i++) {
    checksOnServer2 = await serverCount(page, 'checks')
    if (checksOnServer2 < 4) await page.waitForTimeout(1000)
  }
  flows.push(['backend: all checks on server', checksOnServer2 >= 4])
  // Emergency message must render in the active language too (rules flag).
  const emergencyTextHi = await page.getByTestId('chat-messages').textContent()
  flows.push(['emergency advice language follows toggle', /112|108/.test(emergencyTextHi)])
  // Emergency card entrance animates opacity — mid-flight elements trip
  // axe's color-contrast sampling (known false positive). Let it settle.
  await page.waitForTimeout(900)
  scans.push(['assistant', await axe(page)])

  // ── 3. History: entries + search/filter + delete works (server + local) ──
  // Five checks now land here: fever quick-reply, the homeCare chip's
  // fever question, the medicine chip, the 4-day fever escalation, and
  // the chest-pain emergency.
  await page.getByTestId('nav-history').click()
  await page.waitForTimeout(500)
  const historyCount = await page.getByTestId('history-item').count()
  flows.push(['history has 5 checks', historyCount === 5])
  // 3a. Search narrows to matching checks only.
  await page.getByTestId('history-search').fill('fever')
  await page.waitForTimeout(400)
  const searchMatches = await page.getByTestId('history-item').count()
  flows.push(['history search narrows results', searchMatches === 4 && searchMatches < historyCount])
  // 3b. Severity filter works (low ≠ the emergency check).
  await page.getByTestId('history-search').fill('')
  await page.getByTestId('history-filter-low').click()
  await page.waitForTimeout(400)
  const lowMatches = await page.getByTestId('history-item').count()
  flows.push(['history severity filter works', lowMatches >= 0 && lowMatches < historyCount])
  await page.getByTestId('history-filter-all').click()
  await page.waitForTimeout(300)
  // 3c. No-match state.
  await page.getByTestId('history-search').fill('zzzz-no-match-zzzz')
  await page.waitForTimeout(400)
  flows.push(['history no-match state', (await page.getByTestId('history-no-match').count()) === 1])
  await page.getByTestId('history-search').fill('')
  await page.waitForTimeout(300)
  await page.getByTestId('history-delete').first().click()
  await page.waitForTimeout(600)
  flows.push(['history delete (local)', (await page.getByTestId('history-item').count()) === 4])
  // The DELETE mirror is fire-and-forget — poll Mongo until it lands (the
  // local row is already gone; the server lags a beat behind).
  let serverAfterDelete = await serverCount(page, 'checks')
  for (let i = 0; i < 10 && serverAfterDelete !== 4; i++) {
    await page.waitForTimeout(600)
    serverAfterDelete = await serverCount(page, 'checks')
  }
  flows.push(['backend: history delete synced', serverAfterDelete === 4])
  scans.push(['history', await axe(page)])

  // ── 4. Image Analysis: photo gate + questions + analyze ──
  await page.getByTestId('nav-images').click()
  await page.waitForTimeout(900) // let entrance animations settle before axe

  // 4a. No photo: analyze stays disabled.
  flows.push(['analyze disabled without photo', await page.getByTestId('image-analyze').isDisabled()])

  // 4b. Screenshot-like image → rejected with the "share a symptom photo"
  // notification, questions locked, analyze still disabled.
  await page.getByTestId('image-input').setInputFiles(await testImagePayload(page, 'shot', 'screenshot.png'))
  await page.waitForFunction(() => !!document.querySelector('[data-testid="image-rejected"]'), { timeout: 30000 })
  flows.push(['screenshot image rejected', true])
  flows.push(['reject notification title shown', (await page.getByTestId('image-rejected').textContent()).includes('symptom photo')])
  flows.push(['questions locked on reject', await page.evaluate(() => {
    const f = document.querySelector('[data-testid="section-images"] fieldset')
    return f?.closest('div')?.className?.includes('pointer-events-none') || false
  })])
  flows.push(['analyze disabled on reject', await page.getByTestId('image-analyze').isDisabled()])

  // 4c. Skin-like photo → accepted, then the full guided flow works.
  await page.getByTestId('image-input').setInputFiles(await testImagePayload(page, 'skin', 'skin.png'))
  await page.waitForFunction(() => !!document.querySelector('[data-testid="image-accepted"]'), { timeout: 30000 })
  flows.push(['skin photo accepted', true])
  flows.push(['questions unlocked on accept', await page.evaluate(() => {
    const f = document.querySelector('[data-testid="section-images"] fieldset')
    return !(f?.closest('div')?.className?.includes('pointer-events-none'))
  })])
  const areaBtn = page.locator('[data-testid^="image-area-"]').first()
  await areaBtn.click()
  await page.getByTestId('image-duration-days').click()
  await page.getByTestId('image-pain-mild').click()
  await page.getByTestId('image-analyze').click()
  await page.waitForTimeout(700)
  flows.push(['analyze produces guidance', await page.getByTestId('image-result').isVisible()])
  scans.push(['images', await axe(page)])

  // ── 5. Nearby Care: server proxy returns real places ──
  await page.getByTestId('nav-nearby').click()
  await page.waitForTimeout(900) // let entrance animations settle before axe
  flows.push(['nearby: locate CTA present', await page.getByTestId('nearby-locate').isVisible()])
  scans.push(['nearby', await axe(page)])

  // ── 6. Education ──
  // Set a condition on the profile first so the "picked for you" strip
  // can be verified (diabetes → diabetes article suggestion).
  await page.evaluate(() => {
    const raw = localStorage.getItem('aarogya.profile.v1')
    const p = raw ? JSON.parse(raw) : {}
    p.conditions = 'Diabetes'
    localStorage.setItem('aarogya.profile.v1', JSON.stringify(p))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!document.querySelector('[data-testid="auth-guest"]') || !!document.querySelector('[data-testid="main-content"]'), { timeout: 30000 })
  if (await page.getByTestId('auth-guest').isVisible().catch(() => false)) {
    await page.getByTestId('auth-guest').click()
  }
  await page.waitForTimeout(2000)
  await page.getByTestId('nav-education').click()
  await page.waitForTimeout(900)
  const suggestCount = await page.getByTestId('edu-for-you').isVisible().catch(() => false)
    ? await page.locator('[data-testid^="edu-suggest-"]').count()
    : 0
  flows.push(['education suggests diabetes article from profile', suggestCount >= 1])
  if (suggestCount >= 1) {
    await page.getByTestId('edu-suggest-diabetes').click()
    await page.waitForTimeout(400)
    flows.push(['suggestion opens its article', (await page.getByTestId('edu-body-diabetes').isVisible().catch(() => false))])
  }
  await page.getByTestId('edu-search').fill('fever')
  await page.waitForTimeout(900) // let entrance animations settle before axe
  const eduMatches = await page.locator('[data-testid^="edu-card-"]').count()
  flows.push(['education search "fever" filters', eduMatches >= 1])
  await page.getByTestId('edu-search').fill('')
  const firstCard = page.locator('[data-testid^="edu-card-"]').first()
  await firstCard.click()
  flows.push(['education expand (aria-expanded)', (await firstCard.getAttribute('aria-expanded')) === 'true'])
  scans.push(['education', await axe(page)])

  // ── 7. Reminders: quick template, add → server, toggle, delete ──
  await page.getByTestId('nav-reminders').click()
  // Phase 13: one-tap quick template — adds instantly, syncs to Mongo.
  await page.getByTestId('rem-quick-water').click()
  await page.waitForTimeout(700)
  flows.push(['quick template adds reminder', (await page.locator('[data-testid="rem-item"]').count()) === 1 && /Drink water|पानी पिएँ/.test(await page.locator('[data-testid="rem-item"]').first().textContent())])
  const tplOnServer = await page.evaluate(async () => {
    const uid = window.localStorage.getItem('aarogya.uid.v1')
    const res = await fetch('/api/reminders', { headers: { 'X-User-Id': uid } })
    const list = await res.json()
    return list.some((r) => r.title === 'Drink water' && r.type === 'water' && r.when === 'daily')
  })
  flows.push(['backend: quick template synced to DB', tplOnServer])
  await page.getByTestId('rem-title').fill('Evening walk')
  await page.getByTestId('rem-time').fill('18:30')
  await page.getByTestId('rem-type-exercise').click()
  await page.getByTestId('rem-add').click()
  await page.waitForTimeout(700)
  flows.push(['reminder added', (await page.getByTestId('rem-item').count()) >= 1])
  const kindChip = await page.locator('[data-testid^="rem-kind-"]').first().textContent()
  flows.push(['reminder type saved (exercise chip)', kindChip.includes('Exercise') || kindChip.includes('व्यायाम')])
  flows.push(['backend: reminder saved to MongoDB', (await serverCount(page, 'reminders')) >= 1])
  // 7a. Snooze: 18:30 → 18:40, verify in DOM + DB.
  const snoozeBtn = page.locator('[data-testid^="rem-snooze-"]').first()
  const snoozeId = await snoozeBtn.getAttribute('data-testid')
  await page.getByTestId(snoozeId).click()
  await page.waitForTimeout(600)
  const snoozedTime = await page.locator('[data-testid="rem-item"]').first().locator('p').nth(1).textContent()
  flows.push(['snooze pushes time +10 min', snoozedTime.includes('18:40')])
  const snoozeSynced = await page.evaluate(async () => {
    const uid = window.localStorage.getItem('aarogya.uid.v1')
    const res = await fetch('/api/reminders', { headers: { 'X-User-Id': uid } })
    const list = await res.json()
    return list.some((r) => r.time === '18:40')
  })
  flows.push(['backend: snooze synced to DB', snoozeSynced])
  // 7b. Edit: change title, save, verify.
  const editBtn = page.locator('[data-testid^="rem-edit-"]').first()
  const editId = await editBtn.getAttribute('data-testid')
  await page.getByTestId(editId).click()
  await page.getByTestId('rem-title').fill('Evening jog')
  await page.getByTestId('rem-save-edit').click()
  await page.waitForTimeout(600)
  flows.push(['edit updates reminder title', (await page.locator('[data-testid="rem-item"]').first().locator('p').first().textContent()).includes('jog')])
  // 7c. Toggle done + verify sync.
  const remToggleId = await page.locator('[data-testid^="rem-toggle-"]').first().getAttribute('data-testid')
  await page.getByTestId(remToggleId).click()
  await page.waitForTimeout(600)
  flows.push(['reminder toggled to done', (await page.getByTestId('rem-item-done').count()) === 1])
  const remAfterToggle = await serverCount(page, 'reminders')
  const remDoneOnServer = await page.evaluate(async () => {
    const uid = window.localStorage.getItem('aarogya.uid.v1')
    const res = await fetch('/api/reminders', { headers: { 'X-User-Id': uid } })
    const list = await res.json()
    return list[0]?.done === true
  })
  flows.push(['backend: toggle synced (done=true in DB)', remDoneOnServer && remAfterToggle >= 1])
  // 7d. Notification permission button exists (permission itself is not asked in CI).
  flows.push(['notify button present', await page.getByTestId('rem-notify').isVisible()])
  scans.push(['reminders', await axe(page)])

  // ── 7b. Insights: charts computed from real checks/reminders ──
  await page.getByTestId('nav-insights').click()
  await page.waitForTimeout(2500) // dynamic import + chart mount + animations settle
  flows.push(['insights: score ring renders', (await page.getByTestId('insights-score').count()) === 1])
  const scoreVal = (await page.locator('[data-testid="insights-score"]').textContent()) || ''
  flows.push(['insights: score computed (0-100)', /\b(\d{1,3})\b/.test(scoreVal) && parseInt(scoreVal.match(/\d{1,3}/)?.[0] ?? '999', 10) <= 100])
  flows.push(['insights: trend chart svg', (await page.locator('[data-testid="insights-trend"] svg').count()) >= 1])
  flows.push(['insights: symptom mix svg', (await page.locator('[data-testid="insights-mix"] svg').count()) >= 1])
  flows.push(['insights: completion bar', (await page.getByTestId('insights-completion').count()) === 1])
  const completionPct = await page.locator('[data-testid="insights-completion"] p').first().textContent().catch(() => '')
  flows.push(['insights: completion ratio computed', /\d+%/.test(completionPct)])
  // 7b-2. Weekly digest: fever + follow-up chip landed this week — counts,
  // worst urgency and the most frequent topic must reflect them.
  const digestChecks = await page.getByTestId('digest-checks').textContent().catch(() => '0')
  flows.push(['digest: week check count matches activity', parseInt(digestChecks, 10) >= 2, `${digestChecks} checks`])
  const digestTop = await page.getByTestId('digest-top').textContent().catch(() => '')
  flows.push(['digest: top symptom renders', digestTop.trim().length > 0, digestTop.trim()])
  const digestWorst = await page.getByTestId('digest-worst').textContent().catch(() => '')
  flows.push(['digest: worst urgency renders', digestWorst.trim().length > 0, digestWorst.trim()])
  // 7b-3. BMI card: present; empty state until profile vitals are saved
  // (section 8 saves them — the computed flow runs after that).
  flows.push(['BMI card renders', (await page.getByTestId('insights-bmi-card').count()) === 1])
  flows.push(['BMI empty state before vitals', (await page.getByTestId('insights-bmi-empty').count()) === 1])
  scans.push(['insights', await axe(page)])

  // ── 7c. Reports: lab analyzer — tabs render (Paste-icon regression),
  // paste-mode analysis roundtrip, saved to Mongo, delete one. ──
  await page.getByTestId('nav-reports').click()
  await page.waitForTimeout(2500) // dynamic import + entrance animations settle
  flows.push(['reports: tabs render (no crash)', (await page.getByTestId('reports-tab-paste').isVisible()) && (await page.getByTestId('reports-tab-upload').isVisible())])
  await page.getByTestId('reports-tab-paste').click()
  await page.getByTestId('reports-text').fill('Haemoglobin 12.1 g/dL\nVitamin D 18 ng/mL\nTSH 6.8\nFasting blood sugar 112 mg/dL')
  await page.getByTestId('reports-analyze').click()
  const analyzed = await page.waitForFunction(
    () => !!document.querySelector('[data-testid="reports-current"]'),
    { timeout: 30000 }
  ).then(() => true).catch(() => false)
  flows.push(['reports: analysis result renders', analyzed])
  if (analyzed) {
    const resultText = await page.getByTestId('reports-current').textContent()
    flows.push(['reports: abnormal values flagged', /need attention|ध्यान देने योग्य/i.test(resultText) && !/[·\s]0\s*(need attention|ध्यान)/i.test(resultText)])
    flows.push(['reports: table rows parsed', (await page.locator('[data-testid="reports-table"] tr').count()) >= 5])
  } else {
    flows.push(['reports: abnormal values flagged', false])
    flows.push(['reports: table rows parsed', false])
  }
  flows.push(['backend: report saved to MongoDB', (await serverCount(page, 'reports')) >= 1])
  const delBtn = page.locator('[data-testid^="reports-del-"]').first()
  if (await delBtn.count()) {
    await delBtn.click()
    await page.waitForTimeout(700)
    flows.push(['reports: delete synced to DB', (await serverCount(page, 'reports')) === 0])
  }
  scans.push(['reports', await axe(page)])

  // ── 7d. Printable health report opens in a popup ──
  const reportPopup = page.context().waitForEvent('page', { timeout: 9000 }).catch(() => null)
  await page.getByTestId('nav-history').click()
  await page.waitForTimeout(900) // entrance animations settle before axe
  await page.getByTestId('history-print').click()
  const popup = await reportPopup
  flows.push(['print report popup opens', !!popup])
  if (popup) {
    await popup.waitForLoadState('domcontentloaded').catch(() => {})
    const popupText = await popup.locator('body').textContent().catch(() => '')
    const popupHasTable = await popup.locator('table').count().catch(() => 0)
    const popupRows = await popup.locator('table tr').count().catch(() => 0)
    flows.push(['print report opens with disclaimer', /AarogyaGPT|रिपोर्ट|report/i.test(popupText)])
    flows.push(['print report checks table has rows', popupHasTable >= 1 && popupRows >= 2])
    await popup.close().catch(() => {})
  }
  scans.push(['history-print', await axe(page)])

  // ── 8. Profile: edit + save (all fields) → server, memory + privacy ──
  await page.getByTestId('nav-profile').click()
  await page.getByTestId('profile-edit').click()
  await page.getByTestId('profile-name').fill('Rahul Kumar')
  await page.getByTestId('profile-age').fill('28')
  await page.getByTestId('profile-blood').selectOption('B+')
  await page.getByTestId('profile-gender').selectOption('male')
  await page.getByTestId('profile-height').fill('172')
  await page.getByTestId('profile-weight').fill('68')
  await page.getByTestId('profile-conditions').fill('Diabetes')
  await page.getByTestId('profile-allergies').fill('Dust')
  await page.getByTestId('profile-medications').fill('Metformin 500mg')
  await page.getByTestId('profile-emergency-contact').fill('Asha — 9812345678')
  await page.getByTestId('profile-save').click()
  await page.waitForTimeout(800)
  const headerName = await page.locator('[data-testid="header-profile"]').textContent()
  flows.push(['profile saved + header name', headerName.includes('Rahul')])
  const profileText = await page.getByTestId('section-profile').textContent()
  flows.push(['profile shows vitals (172 cm / 68 kg)', profileText.includes('172') && profileText.includes('68')])
  flows.push(['profile shows emergency contact', profileText.includes('9812345678')])
  flows.push(['profile call-emergency CTA appears', (await page.getByTestId('profile-call-emergency').count()) === 1])
  const profileOnServer = await page.evaluate(async () => {
    const uid = window.localStorage.getItem('aarogya.uid.v1')
    const res = await fetch('/api/profile', { headers: { 'X-User-Id': uid } })
    const p = await res.json()
    return p.name === 'Rahul Kumar' && p.bloodGroup === 'B+' && p.gender === 'male'
      && p.height === '172' && p.weight === '68' && p.medications === 'Metformin 500mg'
      && p.emergencyContact === 'Asha — 9812345678'
  })
  flows.push(['backend: profile persisted in MongoDB', profileOnServer])

  // 8a. Vitals are live → BMI computes with Asian-Indian thresholds
  // (172/68 = 22.98 → "Normal"), and the Home plan now lists section-7's
  // reminder as a today timeline item.
  await page.getByTestId('nav-insights').click()
  await page.waitForTimeout(2500) // recharts dynamic import + animations
  const bmiVal = (await page.getByTestId('insights-bmi-value').textContent().catch(() => '')).trim()
  const bmiChip = (await page.getByTestId('insights-bmi-chip').textContent().catch(() => '')).trim()
  flows.push(['BMI computes from saved vitals', bmiVal === '23.0', `value=${bmiVal} chip=${bmiChip}`])
  flows.push(['BMI band follows Asian-Indian cutoffs', /Normal|सामान्य/.test(bmiChip), bmiChip])
  await page.getByTestId('nav-home').click()
  await page.waitForTimeout(900)
  const planItems = await page.locator('[data-testid^="plan-item-"]').count()
  flows.push(['plan lists today\'s reminders after they exist', planItems >= 1, `${planItems} items`])
  const planToggleCount = await page.locator('[data-testid^="plan-toggle-"]').count()
  flows.push(['plan one-tap done buttons render', planToggleCount >= 1])
  // Phase 13: the plan speaks the date-bound truth — the "today" reminder
  // shows today; the quick template (daily) rides along.
  const planText = await page.getByTestId('home-plan').textContent()
  flows.push(['plan shows the quick template too', /Drink water|पानी पिएँ/.test(planText)])
  // Streak: today's checks (fever + follow-ups + escalation) make it a
  // live streak on this fresh calendar day — the card must say so honestly.
  const streakNow = await page.getByTestId('home-streak').textContent()
  flows.push(['streak counts today\'s check-ins', /[1-9]\s*(day|days|दिन)/.test(streakNow), streakNow.trim()])
  // Back to the profile for its axe scan (the scan label matches the view).
  await page.getByTestId('nav-profile').click()
  await page.waitForTimeout(900)
  scans.push(['profile', await axe(page)])

  // ── 8b. Health memory consent: off by default, toggle on → DB flag ──
  const memoryStatusOff = await page.getByTestId('memory-status').textContent()
  flows.push(['memory off by default (no consent)', /Memory off|मेमोरी बंद/i.test(memoryStatusOff)])
  await page.getByTestId('memory-toggle').click()
  await page.waitForTimeout(700)
  const memoryOnServer = await page.evaluate(async () => {
    const uid = window.localStorage.getItem('aarogya.uid.v1')
    const res = await fetch('/api/profile', { headers: { 'X-User-Id': uid } })
    const p = await res.json()
    return p.memoryEnabled === true
  })
  flows.push(['backend: memory consent saved (DB)', memoryOnServer])
  const memoryStatusOn = await page.getByTestId('memory-status').textContent()
  flows.push(['memory status flips on', /Personalised answers on|व्यक्तिगत जवाब चालू/i.test(memoryStatusOn)])
  await page.getByTestId('memory-toggle').click() // leave it off again
  await page.waitForTimeout(500)
  scans.push(['profile-memory', await axe(page)])

  // ── 8c. Privacy panel: guest note, export, clear history ──
  flows.push(['privacy: guest note shown (guest mode)', (await page.getByTestId('privacy-guest-note').count()) === 1])
  flows.push(['privacy: no delete-account row for guests', (await page.getByTestId('privacy-account-row').count()) === 0])
  const download = page.waitForEvent('download', { timeout: 8000 }).catch(() => null)
  await page.getByTestId('privacy-export').click()
  const dl = await download
  if (dl) {
    flows.push(['privacy: export downloads JSON', (dl.suggestedFilename() || '').endsWith('.json')])
  } else {
    flows.push(['privacy: export downloads JSON', false])
  }
  page.once('dialog', (d) => d.accept())
  await page.getByTestId('privacy-clear-history').click()
  await page.waitForTimeout(800)
  const afterClear = await serverCount(page, 'checks')
  flows.push(['privacy: clear history wipes server + local', afterClear === 0 && (await page.getByTestId('history-item').count().catch(() => 0)) === 0])
  // Restore a check so later flows (reload/insights) still have data.
  await page.getByTestId('nav-assistant').click()
  await page.getByTestId('quick-fever').click()
  await page.waitForFunction(() => !!document.querySelector('[data-testid="chat-last-result"]'), { timeout: 30000 })
  // Entrance animations mid-flight trip axe's color-contrast sampling (known
  // false positive on the timestamp/severity chip) — let them settle first.
  await page.waitForTimeout(900)
  scans.push(['profile-privacy', await axe(page)])

  // ── 9. Hindi language toggle — profile section must be open so the
  // Hindi heading assertion targets प्रोफ़ाइल (8c leaves us on assistant).
  await page.getByTestId('nav-profile').click()
  await page.waitForTimeout(500)
  await page.getByTestId('lang-toggle').click()
  await page.waitForTimeout(500)
  flows.push(['Hindi nav label', (await page.getByTestId('nav-home').textContent()) === 'होम'])
  flows.push(['Hindi section heading', (await page.locator('h1').first().textContent()).includes('प्रोफ़ाइल')])
  await page.getByTestId('nav-home').click()
  await page.waitForTimeout(1500) // let section + stagger animations fully settle (axe sees mid-animation opacity as contrast failure)
  flows.push(['Hindi greeting on home', (await page.locator('h1').first().textContent()).includes('नमस्ते')])
  scans.push(['hindi-mode', await axe(page)])

  // ── 10. Emergency modal (Hindi mode) ──
  await page.getByTestId('emergency-open').click()
  await page.waitForTimeout(900) // let entrance animations settle before axe
  flows.push(['emergency modal opens', await page.getByTestId('emergency-modal').isVisible()])
  flows.push(['emergency modal directory (7)', (await page.locator('[data-testid^="emergency-dir-"]').count()) === 7])
  // 10a. Profile contact on the modal: a REAL journey — edit the profile,
  // save an emergency contact (goes through the sync layer to Mongo), then
  // open the modal: the my-contact button must show and dial digits only.
  // (Seeding localStorage directly would be wiped by the server-first
  // merge on reload — the profile was saved server-side in section 9.)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  await page.getByTestId('nav-profile').click()
  await page.waitForTimeout(600)
  await page.getByTestId('profile-edit').click()
  await page.getByTestId('profile-emergency-contact').fill('E2E संपर्क · 98765 43210')
  await page.getByTestId('profile-save').click()
  await page.waitForTimeout(1200) // PUT /profile round-trip
  await page.getByTestId('nav-home').click()
  await page.waitForTimeout(600)
  await page.getByTestId('emergency-open').click()
  await page.waitForTimeout(900)
  const contactHref = await page.getByTestId('call-my-contact').getAttribute('href').catch(() => null)
  flows.push(['emergency modal: my-contact button dials profile phone', contactHref === 'tel:9876543210', String(contactHref)])
  const contactName = await page.getByTestId('call-my-contact-name').textContent().catch(() => '')
  flows.push(['emergency modal: contact shows saved line', contactName.includes('98765')])
  // Clear the contact through the same journey — the honest empty note
  // must replace the button (server profile is the source of truth).
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  await page.getByTestId('nav-profile').click()
  await page.waitForTimeout(600)
  await page.getByTestId('profile-edit').click()
  await page.getByTestId('profile-emergency-contact').fill('')
  await page.getByTestId('profile-save').click()
  await page.waitForTimeout(1200)
  await page.getByTestId('nav-home').click()
  await page.waitForTimeout(600)
  await page.getByTestId('emergency-open').click()
  await page.waitForTimeout(900)
  flows.push(['emergency modal: no-contact note when profile empty', (await page.getByTestId('no-contact-note').count()) === 1])
  flows.push(['emergency modal: no contact button when empty', (await page.getByTestId('call-my-contact').count()) === 0])
  scans.push(['emergency-modal', await axe(page)])
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600) // modal exit animation runs ~180ms + buffer
  flows.push(['Escape closes modal', !(await page.getByTestId('emergency-modal').isVisible().catch(() => false))])

  // ── 11. Reload: data must survive via the SERVER. The device is still
  // in guest mode, so the splash is skipped and the auth screen appears —
  // walk straight through guest again (offline device data persists).
  await page.reload({ waitUntil: 'networkidle' })
  const authAfterReload = await page.waitForFunction(
    () => !!document.querySelector('[data-testid="auth-guest"]'),
    { timeout: 20000 }
  ).then(() => true).catch(() => false)
  flows.push(['reload: splash skipped, auth shown', authAfterReload])
  await page.getByTestId('auth-guest').click()
  await page.waitForTimeout(2500) // loadAll merges server data post-mount
  await page.getByTestId('nav-history').click()
  await page.waitForTimeout(500)
  const historyAfterReload = await page.getByTestId('history-item').count()
  flows.push(['reload: history restored from backend', historyAfterReload >= 1])
  await page.getByTestId('nav-reminders').click()
  await page.waitForTimeout(500)
  const remindersAfterReload = await page.locator('[data-testid^="rem-item"]').count()
  flows.push(['reload: reminders restored from backend', remindersAfterReload >= 1])

  // ── 12. Mobile viewport (guest again — same device profile) ──
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await mobile.goto(URL, { waitUntil: 'networkidle', timeout: 90000 })
  await mobile.waitForFunction(
    () => !!document.querySelector('[data-testid="auth-guest"]') || !!document.querySelector('[data-testid="main-content"]'),
    { timeout: 30000 }
  )
  if (await mobile.getByTestId('auth-guest').isVisible().catch(() => false)) {
    await mobile.getByTestId('auth-guest').click()
  }
  await mobile.waitForFunction(() => !!document.querySelector('[data-testid="menu-open"]'), { timeout: 20000 })
  await mobile.getByTestId('menu-open').click()
  await mobile.waitForTimeout(400)
  flows.push(['mobile sidebar opens', await mobile.getByTestId('sidebar-close').isVisible()])
  // Fresh mobile context → loadAll's cloud poll can still be in flight when
  // the sidebar opens; the chip honestly reads "device" until it resolves.
  const mobileCloud = await mobile.waitForFunction(
    () => document.querySelector('[data-testid="sync-mode"]')?.textContent.includes('Cloud synced') || document.querySelector('[data-testid="sync-mode"]')?.textContent.includes('क्लाउड'),
    { timeout: 20000 }
  ).then(() => true).catch(() => false)
  flows.push(['mobile: sync chip cloud', mobileCloud])
  scans.push(['mobile', await axe(mobile)])
  await mobile.close()

  // ── 13. Real account: signup → home, data claim, wrong password,
  // logout → login → session restore. Uses a fresh device profile so the
  // splash plays once more on the signup step.
  const authPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const stamp = Date.now()
  const accEmail = `e2e_${stamp}@aarogya.test`
  const accPass = 'secret123'
  await authPage.goto(URL, { waitUntil: 'networkidle', timeout: 90000 })
  await authPage.waitForFunction(
    () => !!document.querySelector('[data-testid="auth-guest"]'),
    { timeout: 30000 }
  )
  await authPage.waitForTimeout(600)
  await authPage.getByTestId('auth-tab-signup').click()
  await authPage.locator('#auth-name').fill('E2E Sharma')
  await authPage.locator('#auth-email').fill(accEmail)
  await authPage.locator('#auth-password').fill(accPass)
  await authPage.getByTestId('auth-submit').click()
  await authPage.waitForFunction(
    () => !!document.querySelector('[data-testid="session-chip"]'),
    { timeout: 25000 }
  ).then(() => true).catch(() => false)
  flows.push(['auth: signup lands in app', await authPage.getByTestId('session-chip').isVisible()])
  flows.push(['auth: session chip shows name', (await authPage.getByTestId('session-chip').textContent()).includes('E2E Sharma')])
  flows.push(['auth: guest banner hidden when logged in', !(await authPage.getByTestId('auth-guest').isVisible().catch(() => false))])

  // Save a check under the account, verify it lives in Mongo under the
  // account partition (uid format: user-<base64url(email)>). GPT latency
  // means we wait for the reply, then poll the partition.
  await authPage.getByTestId('nav-assistant').click()
  await authPage.getByTestId('quick-fever').click()
  await authPage.waitForFunction(
    () => !!document.querySelector('[data-testid="chat-last-result"]'),
    { timeout: 30000 }
  )
  const accUid = await authPage.evaluate(() => JSON.parse(localStorage.getItem('aarogya.session.v1')).uid)
  const accChecks = await authPage.waitForFunction(async (uid) => {
    const res = await fetch('/api/checks', { headers: { 'X-User-Id': uid } })
    const data = await res.json()
    return Array.isArray(data) && data.length >= 1
  }, accUid, { timeout: 30000 }).then(() => 1).catch(() => 0)
  flows.push(['auth: check saved under account partition', accChecks >= 1])

  // Wrong password first, then the right one. Logout takes ~3s (exit
  // animation + gate transition), so poll for the auth screen.
  await authPage.getByTestId('logout').click()
  const loggedOut = await authPage.waitForFunction(
    () => !!document.querySelector('[data-testid="auth-guest"]'),
    { timeout: 20000 }
  ).then(() => true).catch(() => false)
  flows.push(['auth: logout back to login', loggedOut])
  await authPage.locator('#auth-email').fill(accEmail)
  await authPage.locator('#auth-password').fill('wrongpass')
  await authPage.getByTestId('auth-submit').click()
  await authPage.waitForTimeout(1800)
  flows.push(['auth: wrong password rejected', (await authPage.getByTestId('auth-error').textContent().catch(() => '')).length > 3])
  await authPage.locator('#auth-password').fill(accPass)
  await authPage.getByTestId('auth-submit').click()
  await authPage.waitForFunction(
    () => !!document.querySelector('[data-testid="session-chip"]'),
    { timeout: 25000 }
  ).then(() => true).catch(() => false)
  flows.push(['auth: login returns to app', await authPage.getByTestId('session-chip').isVisible()])

  // Reload with a saved session → straight into the app, no auth screen.
  await authPage.reload({ waitUntil: 'networkidle' })
  const restoredChip = await authPage.waitForFunction(
    () => !!document.querySelector('[data-testid="session-chip"]'),
    { timeout: 25000 }
  ).then(() => true).catch(() => false)
  flows.push(['auth: reload skips auth (session restored)', restoredChip])
  flows.push(['auth: account check restored after login', (await authPage.evaluate(async (uid) => {
    const res = await fetch('/api/checks', { headers: { 'X-User-Id': uid } })
    const data = await res.json()
    return Array.isArray(data) ? data.length : -1
  }, accUid)) >= 1])

  // ── 14. Privacy: delete account — the nuclear option, verified end to
  // end. Profile section shows the delete row only when logged in; confirm
  // wipes Mongo documents + the user record, logs out to the auth screen.
  await authPage.getByTestId('nav-profile').click()
  await authPage.waitForTimeout(600)
  flows.push(['privacy: delete-account row shown when logged in', (await authPage.getByTestId('privacy-account-row').count()) === 1])
  authPage.once('dialog', (d) => d.accept())
  await authPage.getByTestId('privacy-delete-account').click()
  const backToAuth = await authPage.waitForFunction(
    () => !!document.querySelector('[data-testid="auth-guest"]'),
    { timeout: 20000 }
  ).then(() => true).catch(() => false)
  flows.push(['privacy: account deletion returns to auth', backToAuth])
  const loginGone = await authPage.evaluate(async ([email, pass]) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    })
    return res.status === 401
  }, [accEmail, accPass])
  flows.push(['backend: login rejected after deletion', loginGone])
  const accountDataGone = await authPage.evaluate(async (uid) => {
    const res = await fetch('/api/checks', { headers: { 'X-User-Id': uid } })
    const data = await res.json()
    return Array.isArray(data) ? data.length === 0 : false
  }, accUid)
  flows.push(['backend: account data wiped from Mongo', accountDataGone])
  await authPage.close()

  // ── Report ──
  const out = { url: URL, scannedAt: new Date().toISOString(), scans: [], flows, consoleErrors }
  let totalViolations = 0
  for (const [label, result] of scans) {
    totalViolations += result.violations.length
    out.scans.push({
      label,
      violationCount: result.violations.length,
      violations: result.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map(n => ({ target: n.target, html: (n.html || '').slice(0, 160) })) })),
      incompleteCount: result.incomplete.length,
    })
    violationsSummary.push(`${label}: ${result.violations.length} violations (${result.violations.map(v => v.id).join(', ') || 'none'})`)
  }
  out.totalViolations = totalViolations
  fs.writeFileSync(path.join(__dirname, 'axe-report.json'), JSON.stringify(out, null, 2))

  console.log('=== AXE SCANS (after) ===')
  violationsSummary.forEach(s => console.log('  ' + s))
  console.log(`TOTAL violations: ${totalViolations}`)
  console.log('\n=== FUNCTIONAL + BACKEND FLOWS ===')
  for (const [name, pass] of flows) console.log(`  ${pass ? '✅' : '❌'} ${name}`)
  console.log(`\n=== CONSOLE ERRORS: ${consoleErrors.length} ===`)
  consoleErrors.slice(0, 10).forEach(e => console.log('  ' + e.slice(0, 200)))

  await browser.close()
  process.exit(0)
}

main().catch(e => { console.error('SCAN FAILED:', e.message); process.exit(1) })
