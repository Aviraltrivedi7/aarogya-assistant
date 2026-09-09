// Phase 14 OFFLINE PWA proof — runs against a PRODUCTION build (next start),
// where the service worker registers. Chrome's offline emulation only works
// with a real service worker controlling the page.
//
// NOTE: this script is run manually after `npm run build` + `next start`;
// it is NOT part of the dev-mode axe-scan suite (dev never registers the SW).
const { chromium } = require(process.cwd() + '/node_modules/playwright')
const URL = process.env.PWA_URL || 'http://127.0.0.1:3399'

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  // 1. Online first — SW installs, shell caches.
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
  const swReady = await page.waitForFunction(
    () => navigator.serviceWorker?.controller !== null,
    { timeout: 20000 }
  ).then(() => true).catch(() => false)
  console.log('SW controlling page:', swReady)

  // 2. Enter the app (guest) while online, so profile/history local state exists.
  await page.waitForFunction(() => !!document.querySelector('[data-testid="auth-guest"]'), { timeout: 30000 }).catch(() => {})
  const guest = await page.getByTestId('auth-guest').isVisible().catch(() => false)
  if (guest) await page.getByTestId('auth-guest').click()
  await page.waitForFunction(() => !!document.querySelector('[data-testid="main-content"]'), { timeout: 30000 })
  console.log('app entered online')

  // 3. GO OFFLINE — then reload. The SW must serve the shell from cache.
  await ctx.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
  const shellOk = await page.waitForFunction(
    () => !!document.querySelector('[data-testid="main-content"]') || !!document.querySelector('[data-testid="auth-guest"]'),
    { timeout: 20000 }
  ).then(() => true).catch(() => false)
  console.log('OFFLINE RELOAD served app shell:', shellOk)

  // 4. Offline triage — server unreachable, local intent-aware engine answers.
  const inApp = await page.getByTestId('main-content').isVisible().catch(() => false)
  if (!inApp && await page.getByTestId('auth-guest').isVisible().catch(() => false)) {
    await page.getByTestId('auth-guest').click()
    await page.waitForFunction(() => !!document.querySelector('[data-testid="main-content"]'), { timeout: 15000 }).catch(() => {})
  }
  await page.getByTestId('nav-assistant').click()
  await page.getByTestId('chat-input').fill('bukhar hai')
  await page.getByTestId('chat-send').click()
  const replied = await page.waitForFunction(
    () => !!document.querySelector('[data-testid="chat-last-result"]') || document.body.textContent.includes('Fever'),
    { timeout: 20000 }
  ).then(() => true).catch(() => false)
  const chatText = await page.getByTestId('chat-messages').textContent().catch(() => '')
  console.log('OFFLINE triage replied:', replied && /Fever|बुखार/i.test(chatText))
  console.log('offline mode honestly flagged:', /Offline|ऑफ़लाइन/i.test(await page.getByTestId('chat-last-result').textContent().catch(() => '')))

  // 5. Offline screenshot — the money shot.
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'screenshots/p14-1-offline-triage.png' })

  // 6. Offline nav to reminders (pure local data) works.
  await page.getByTestId('nav-reminders').click()
  await page.waitForTimeout(900)
  console.log('offline reminders section renders:', (await page.getByTestId('section-reminders').isVisible().catch(() => false)))

  // 7. Back online — API recovers, sync chip returns to cloud.
  await ctx.setOffline(false)
  await page.waitForTimeout(2500)
  console.log('CONSOLE ERRORS (offline+online):', errors.length, errors.slice(0, 3))

  await browser.close()
  process.exit(0)
})().catch((e) => { console.error('OFFLINE E2E FAIL:', e.message); process.exit(1) })
