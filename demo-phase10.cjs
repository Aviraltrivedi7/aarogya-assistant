// Phase 10 demo capture — real-journey screenshots of the new features:
// full profile (vitals + emergency contact), health memory consent,
// privacy controls, reminders (types/snooze/edit), history search/filter,
// education personalization. Saves to screenshots/phase10-*.png
const { chromium } = require('playwright')
const path = require('path')
const URL = 'http://127.0.0.1:3311'

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.evaluate(() => localStorage.clear())
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 90000 })

  // Wait past splash → auth, enter as guest.
  await page.waitForFunction(() => !!document.querySelector('[data-testid="auth-guest"]'), { timeout: 30000 })
  await page.waitForTimeout(600)
  await page.getByTestId('auth-guest').click()
  await page.waitForTimeout(2000)

  // 1. Profile: fill the full form with the new fields.
  await page.getByTestId('nav-profile').click()
  await page.waitForTimeout(500)
  await page.getByTestId('profile-edit').click()
  await page.getByTestId('profile-name').fill('Aviral Trivedi')
  await page.getByTestId('profile-age').fill('22')
  await page.getByTestId('profile-blood').selectOption('O+')
  await page.getByTestId('profile-gender').selectOption('male')
  await page.getByTestId('profile-height').fill('175')
  await page.getByTestId('profile-weight').fill('70')
  await page.getByTestId('profile-conditions').fill('Diabetes')
  await page.getByTestId('profile-allergies').fill('Dust')
  await page.getByTestId('profile-medications').fill('Metformin 500mg morning')
  await page.getByTestId('profile-emergency-contact').fill('Home — 98XXXXXX21')
  await page.screenshot({ path: 'screenshots/phase10-profile-edit.png' })
  await page.getByTestId('profile-save').click()
  await page.waitForTimeout(700)

  // 2. Memory consent card — turn it ON (the key new control).
  await page.getByTestId('memory-toggle').click()
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'screenshots/phase10-profile-memory.png' })

  // 3. Privacy panel (export / clear / guest note).
  await page.screenshot({ path: 'screenshots/phase10-profile-privacy.png', fullPage: false })

  // 4. Reminders: typed reminder + snooze + edit states.
  await page.getByTestId('nav-reminders').click()
  await page.waitForTimeout(700)
  await page.getByTestId('rem-type-water').click()
  await page.getByTestId('rem-title').fill('Drink water — 8 glasses')
  await page.getByTestId('rem-time').fill('09:00')
  await page.getByTestId('rem-when-daily').click()
  await page.screenshot({ path: 'screenshots/phase10-reminders-types.png' })
  await page.getByTestId('rem-add').click()
  await page.waitForTimeout(600)
  await page.getByTestId('rem-type-medication').click()
  await page.getByTestId('rem-title').fill('Vitamin D tablet')
  await page.getByTestId('rem-time').fill('20:00')
  await page.getByTestId('rem-add').click()
  await page.waitForTimeout(600)
  const snoozeId = await page.locator('[data-testid^="rem-snooze-"]').first().getAttribute('data-testid')
  await page.getByTestId(snoozeId).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'screenshots/phase10-reminders-list.png' })

  // 5. History: assistant checks first so search has data.
  await page.getByTestId('nav-assistant').click()
  await page.getByTestId('quick-fever').click()
  await page.waitForFunction(() => !!document.querySelector('[data-testid="chat-last-result"]'), { timeout: 30000 })
  await page.waitForTimeout(600)
  await page.getByTestId('nav-history').click()
  await page.waitForTimeout(600)
  await page.getByTestId('history-search').fill('fever')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'screenshots/phase10-history-search.png' })

  // 6. Education: "picked for you" from the Diabetes profile.
  await page.getByTestId('nav-education').click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'screenshots/phase10-education-personal.png' })
  if (await page.getByTestId('edu-suggest-diabetes').isVisible().catch(() => false)) {
    await page.getByTestId('edu-suggest-diabetes').click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'screenshots/phase10-education-article.png' })
  }

  // 7. Hindi mode profile (memory card in Hindi).
  await page.getByTestId('nav-profile').click()
  await page.getByTestId('lang-toggle').click()
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'screenshots/phase10-profile-hindi.png' })

  await browser.close()
  console.log('Phase-10 demo screenshots saved.')
}

main().catch((e) => { console.error('DEMO FAILED:', e.message); process.exit(1) })
