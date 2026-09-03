#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

## user_problem_statement: "Build AarogyaGPT UI and frontend only"
## backend:
##   - task: "Backend integrations"
##     implemented: false
##     working: "NA"
##     file: "N/A"
##     stuck_count: 0
##     priority: "low"
##     needs_retesting: false
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Explicitly excluded by user; no backend work performed."
## frontend:
##   - task: "Premium AarogyaGPT dashboard UI"
##     implemented: true
##     working: "NA"
##     file: "/app/app/page.js"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Built responsive dashboard, navigation, language toggle, local chat panel, reminders, history, disclaimers, and emergency modal."
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 1
##   run_ui: true
## test_plan:
##   current_focus:
##     - "Responsive dashboard rendering"
##     - "Local chat interaction and emergency flow"
##     - "Language toggle and mobile navigation"
##   stuck_tasks: []
##   test_all: false
##   test_priority: "high_first"
## agent_communication:
##     -agent: "main"
##     -message: "Frontend-only implementation is ready for browser verification; no APIs or backend should be tested."

## UI Testing Run 2026-08-21
- Frontend task: Premium AarogyaGPT dashboard UI — working: true; desktop rendering, major dashboard cards, disclaimer, EN/HI toggle, Start a health check assistant, chat follow-up messages, emergency sidebar modal, Emergency info modal, and tel:112 all passed via Playwright. No desktop console/runtime errors observed.
- Mobile sidebar opens passed. Mobile close interaction was not conclusively asserted due selector ambiguity in the test (screenshot showed sidebar closed); no functional app failure confirmed.
- Backend/API intentionally not tested per request.

## agent_communication
- agent: testing
- message: Playwright verification passed all core desktop and emergency/chat flows with no console errors. Mobile sidebar opened; close assertion was inconclusive because the test locator matched ambiguously/state visibility after closing, while screenshot showed the dashboard with sidebar closed. Please consider adding data-testid attributes for robust future testing.

## UI Enhancement Run 2026-08-21
- Added a more polished global visual finish: Inter-style system typography, soft off-white canvas, selection color, touch-tap polish, active press feedback, and refined scrollbars in `/app/app/globals.css`.
- needs_retesting: true

## UI Regression Run 2026-08-21 (post globals.css styling enhancement)
- Frontend task: Premium AarogyaGPT dashboard UI — working: true; Playwright verified desktop and mobile rendering.
- Confirmed: dashboard cards and AarogyaGPT disclaimer visible; EN/HI toggle; Start a health check opens AI Assistant; chat send adds follow-up messages; emergency modal opens with exactly one visible tel:112 link; mobile sidebar opens and closes; no console/runtime errors or page error elements observed.
- Backend/API intentionally not tested per request.

## agent_communication
- agent: testing
- message: Post-styling regression passed all requested frontend flows on desktop (1920x1080) and mobile (390x844). No confirmed failures; main agent can summarize and finish.

## UI Premium Rewrite Run 2026-08-21
- Reworked `/app/app/page.js` into a more premium dashboard composition with stronger hero hierarchy, richer status chips, refined card shadows, better spacing, and improved responsive navigation.
- needs_retesting: true

## UI Health Command Center Rebuild Run 2026-08-21
- Rebuilt `/app/app/page.js` with a deeper navy navigation rail, upgraded care hero, health command-center hierarchy, richer action cards, and preserved local chat/emergency interactions.
- needs_retesting: true


## UI Regression Run 2026-08-21 (latest premium rewrite)
- Frontend task: Premium AarogyaGPT dashboard UI — working: true; confirmed desktop and mobile rendering, hero/major cards, medical disclaimer, EN/HI toggle, Start a health check and Check symptoms assistant entry, chat follow-up bubbles, Emergency help and Emergency info modal flows, exactly one visible tel:112 link, and no console/runtime/page errors.
- Mobile sidebar open and visual close behavior passed by screenshot/viewport state. Initial close assertion was inconclusive because Workspace remains mounted in DOM while the sidebar transitions offscreen; no confirmed functional failure.
- Backend/API intentionally not tested per request.

## agent_communication
- agent: testing
- message: Latest premium rewrite regression passed all requested frontend flows at desktop (1920x1080) and mobile (390x844). No confirmed failures; mobile close visually returned to dashboard, though DOM visibility assertion is unsuitable for the transformed offscreen sidebar.


## UI Regression Run 2026-08-21 (latest health-command-center rebuild)
- Frontend task: Premium AarogyaGPT dashboard UI — working: true; confirmed desktop rendering (navy sidebar, hero, action cards, health history, reminders, disclaimer), EN/HI toggle, Start a health check and Check symptoms assistant entry, text chat follow-up bubbles, Emergency help and Emergency info modal, exactly one visible tel:112 link, and mobile sidebar open/close.
- No confirmed console/runtime/page errors in successful desktop/mobile runs. One intermediate automation timeout was caused by the test attempting to click the underlying Emergency info card while the modal overlay was still open; not an app failure.
- Backend/API intentionally not tested per request.

## agent_communication
- agent: testing
- message: Latest rebuild regression passed requested frontend flows on desktop and mobile. No confirmed failures; intermediate test error was selector flow against an open modal overlay, not product behavior. Main agent can summarize and finish.

## Deep Analysis + Full Upgrade Run 2026-09-02 (axe-core audit + tagda rebuild)
- main agent: Ran axe-core 4.10.2 accessibility audit via Playwright on original build — found critical button-name violations (2-7 icon buttons without accessible names per state) and serious color-contrast violations (10-15 nodes per state: text-blue-200/50, text-slate-400, 10px muted text). Full audit captured in REPORT.md.
- main agent: Rewrote app into modular architecture — app/page.js shell + 8 section components (components/sections/*), 3 new libs (lib/i18n.js full EN/HI dictionary, lib/triage.js rule-based symptom engine with EN+Hinglish+Devanagari keywords and 8 red-flag rules, lib/storage.js SSR-safe localStorage layer).
- main agent: All 7 nav sections + Profile now functional: real triage chat with quick replies and emergency card on red flags, health history with delete/clear, guided image analysis (client-only photo), nearby care via OpenStreetMap Overpass API (no key) + India emergency directory (112/108/104/1091/1098/14416/1930), searchable bilingual education articles, reminders CRUD, editable profile. data-testid attributes added throughout per earlier testing agent request.
- main agent: Security hardening — full CSP, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy in next.config.js; API route rewritten with zod validation, /api/health (no DB dependency), 60 req/min rate limit, lazy Mongo connect, no internal error leakage. Added .env.example. Fixed Windows-incompatible dev script.
- verification: npm run build pass (0 errors). Axe rescan across 11 states: **0 violations total** (was 13). Playwright E2E: 18/18 flows pass, 0 console errors. Security headers verified live via curl; API health/400/404 verified. SEO metadata (title, description, OG, themeColor) verified live.
- needs_retesting: false — all flows verified green by automated Playwright + axe run; see REPORT.md section 8 for evidence and axe-report.json for raw data.

## agent_communication
- agent: main
- message: Upgrade complete and verified. Axe violations 13→0, all 18 functional flows green, build passes, security headers live. REPORT.md contains the full before/after analysis and verification log.

## Backend Implementation Run 2026-09-02 (Phase 2)
- main agent: Implemented full MongoDB backend — lib/server/db.js (lazy connection, auto-indexes on health_checks/reminders/profiles, connection reset on DB down), rewritten app/api/[[...path]]/route.js with 13 endpoints: GET /api/health (db status), POST /api/assistant (server-side triage via shared lib/triage.js), checks CRUD (+array POST for offline back-sync), reminders CRUD (PATCH toggle), profile GET/PUT upsert, GET /api/nearby (Overpass proxy with 3 mirrors + User-Agent fix), platform /api/status kept. All inputs zod-validated; 120 req/min rate limit; anonymous X-User-Id device identity (401 if missing).
- main agent: Added lib/sync.js offline-first layer — server-first reads with merge-by-id, localStorage mirror writes, back-sync of offline items, cloud/local mode indicator chip in sidebar (EN/HI). Fixed hydration bug: profile state now starts from DEFAULT_PROFILE constant (not localStorage) + suppressHydrationWarning on date badge. Fixed Next 15 status-init bug in json() helper (406-equivalent "status must be in range" 500s on all POSTs). Fixed Overpass 406 by bisect: UA with brackets blocked; 'AarogyaGPT/0.2' works. scripts/dev-mongo.cjs + npm run dev:db for local in-memory MongoDB. CSP connect-src tightened to 'self' (Overpass now server-side only).
- verification: With in-memory MongoDB running: /api/health → db connected; curl suite — assistant triage (EN + Hinglish red flag → emergency), checks/reminders/profile CRUD all 200/201, 401 without X-User-Id, 400 on bad severity, nearby proxy returned real Delhi pharmacies/hospitals with phones. Playwright E2E with DB: 29/29 flows pass including server-side assertions (check saved to Mongo, toggle synced done=true, profile persisted, reload restores from backend). axe: 0 violations across 11 states. Console errors: 0. npm run build: pass.
- verification (resilience): Killed MongoDB mid-run — app stayed fully functional: sync chip switched to "Saved on this device", chat answered via local triage fallback, reminders saved to localStorage, 0 page errors. Restarted Mongo → /api/health back to db connected.
- needs_retesting: false — backend verified green end-to-end with live DB; see REPORT.md section 9 for the backend verification log.

## Premium Design Upgrade Run 2026-09-02 (Phase 3)
- main agent: Premium upgrade — Plus Jakarta Sans (display) + Inter (body) via @fontsource self-hosted fonts; framer-motion throughout (MotionConfig reducedMotion="user", AnimatePresence section transitions, spring-animated sidebar active pill via layoutId, staggered card entrances, emergency modal scale/fade); new Wellness Snapshot stats strip on Home (checks done / reminders completed / days with us); chat message entrance animations + timestamps + animated send button; logo glow pulse + hero floating glow.
- main agent fixes: hydration-safe Hindi date formatting (Intl.supportedLocalesOf check — Node without full-ICU silently renders hi-IN dates in English); contrast fix on emergency-card timestamp (red-500 → red-700 + 11px); axe-vs-animation timing lesson documented (mid-animation opacity reads as contrast failure — tests now wait for settled state).
- verification: npm run build pass (186 kB first load). Full E2E with MongoDB: 29/29 flows green including all backend assertions (Mongo saves, toggle sync, profile persistence, reload-from-server, sync chip Cloud synced). axe-core across 11 states (EN, HI, mobile, emergency modal): 0 violations. Console errors: 0.
- needs_retesting: false — see REPORT.md section 10.

## Insights + Print Report + PWA Run 2026-09-02 (Phase 4)
- main agent: New Insights section (recharts lazy-loaded via next/dynamic — page bundle sirf ~3kB badha): animated 0-100 Health Score ring (severity 40 + reminders 30 + profile completeness 30), 14-day severity trend AreaChart (honest nulls — connectNulls={false}), symptom-mix donut top-5, reminder completion progressbar. History me printable health report — popup with profile strip + full checks table + disclaimer, XSS-safe (escapeHtml). PWA manifest (app/manifest.js) + appleWebApp metadata.
- main agent fixes: chart SVG aria-hidden + wrapper role="img" + aria-label (recharts sector paths axe ko svg-img-alt violation dete the → 0); HistorySection ko profile prop pass (print report me naam/age/blood aati hai); E2E me insights flows + print popup assertions + history-print scan (ab 13 axe states, 39 flows).
- verification: npm run build pass (189 kB first load, manifest.webmanifest route generated). Full E2E with MongoDB: 39/39 flows green incl. score ring, trend/mix SVG charts, completion %, print popup with table rows, reload-from-server. axe-core 13 states (insights + history-print added): 0 violations. Console errors: 0. Screenshots: insights-en/hi, print-report, score ring, history print button.
- needs_retesting: false — see REPORT.md section 11.

## De-AI Redesign Run 2026-09-02 (Phase 5)
- main agent: Design "AI se bana" lag raha tha. Full re-skin to Indian wellness identity — fonts swapped to Ek Type foundry (Baloo 2 display + Mukta body; Devanagari+Latin co-designed, Hindi headings ab real Indian typography me), palette swapped navy/sky/violet → deep forest green #142d20 sidebar + #1d6b48 primary + marigold #eda33c/#f2c063 accents + ivory paper #faf6ec/#f5f0e3 with 22px dot-grid texture + antique gold borders + ink #0f241a hard offset shadows (shadow-[6px_6px_0_0_#0f241a]). Logo glow pulse + hero floating glow REMOVED. Copy: "Wellness Snapshot" → "Your health journal"/"आपका स्वास्थ्य पत्रिका". Emoji removed from UI labels. Charts → forest/marigold palette. PWA theme #142d20/#f5f0e3. icon.svg forest tile + marigold pulse. Warm scrollbar/selection/focus-ring. [lang="hi"] headline line-height 1.25 (Devanagari ascender safety).
- main agent fixes: bulk hex/class swap (Python, ~25 hexes + slate→stone/sky→emerald/violet→amber/bg-white→ivory across 10 files) ne 15 invalid text-text-[#...] classes + 1 broken shadow class banaye — sab caught & fixed pre-delivery. Naye palette pe 2 WCAG AA color-contrast violations aaye (stone-500 ivory bg pe fail — insights legend + profile dt labels) — 20 instances stone-500→stone-600, re-scan 0 violations.
- verification: npm run build pass (189 kB first load, unchanged). Full E2E with MongoDB: 39/39 flows green. axe-core 13 states: 0 violations. Console errors: 0. Old-design marker grep (navy/sky/violet/float-glow/slate-N): 0 hits. 6 naye design screenshots captured (home/assistant/history/insights/nearby/hindi) — Delhi geolocation, real triage reply, real OSM hospitals.
- needs_retesting: false — see REPORT.md section 12.

## White Sidebar Run 2026-09-02 (Phase 5.1)
- main agent: User request "sidebar white kro" — sidebar deep forest green #142d20 → warm white #fffdf7 + ink text, border-r stone hairline. Active nav pill invert: deep green #142d20 pill + white text (13:1). Brand GPT marigold → deep gold #8a6215 (AA on white). Reminders badge active → marigold chip on green pill. Emergency → red-50/red-700 + border. Privacy card → ivory #faf6ec solid + forest ShieldCheck. Sync chips → solid emerald-100/amber-100.
- verification: Full suite on live dev server: axe 13 states 0 violations, 39/39 E2E flows green, 0 console errors. Served HTML grep confirms bg-[#fffdf7] live. Screenshots: newdesign-sidebar-white-home.png, newdesign-sidebar-white-hindi.png.
- needs_retesting: false — see REPORT.md section 12 addendum.

## Splash + Login/Signup Run 2026-09-02 (Phase 6)
- main agent: Full auth flow — animated splash (forest green + marigold logo spring entrance + progress bar, 2.2s) → login/signup card (sliding tabs, name field animate, password eye, error alerts) → app. Returning sessions skip straight in; "Continue as guest" preserves old anonymous mode. Backend: /api/auth/signup|login|claim — scrypt password hashing (node:crypto, timingSafeEqual), HMAC-SHA256 tokens (30d), users collection w/ unique email index, anonymous device data auto-claims into account on login. Identity partition = user-<base64url(email)>; session chip + logout in header. i18n EN/HI full auth strings.
- main agent fixes: (1) splash stuck — internal stage vs parent gate race, now setStage('auth') always + parent unmounts on session; (2) account uid 401 — user:email format failed API X-User-Id regex, now base64url encoding; (3) onDone email missing → session chip not rendering; (4) 7 axe violations on auth screens (landmark/heading-one/region) → motion.main + h1 brand.
- verification: npm run build pass (194 kB first load). Full E2E: 54/54 flows green incl. 15 new auth flows (splash logo, auth tabs/fields, signup → app + session chip name, account-partition check save in Mongo, logout → login screen, wrong pw rejected, login → app, reload session restore, account data restored). axe: 16 states (splash, auth-signup, auth-login added) — 0 violations. Console errors: 0. curl: signup 201+token, login 200, wrong 401, dup 409, claim needs bearer. Screenshots: auth-splash, auth-signup, auth-login.
- needs_retesting: false — see REPORT.md section 13.

## Webpack Runtime Error Fix Run 2026-09-02 (Phase 6.1)
- issue: Browser me "Runtime TypeError: __webpack_modules__[moduleId] is not a function" + "Next.js 15.5.18 (outdated)" overlay. Cause: dev server ke saath bade structural changes (SplashGate, auth-client, naye imports) ke baad .next chunk cache stale ho gaya tha — browser purane chunk ids maang raha tha, server naye serve kar raha tha. Code me koi bug NAHI tha — production build pehle hi pass tha (194 kB, 0 errors).
- fix: Dev server kill (PID 10204) → .next cache delete → fresh restart (MONGO_URL/DB_NAME env ke saath, port 3311). Hot-reload ke saath badi file changes aaye to ye ek known Next 15 dev-mode pattern hai; prod build is se prabhavit nahi hota.
- verification: Fresh browser walkthrough — splash render, auth screen, real signup → app, saare 8 sections (lazy chunks) render, reload session restore — sab pass, 0 console/page errors. Full suite dobara: axe 16 states 0 violations, 54/54 flows, 0 console errors. /api/health db connected.
- needs_retesting: false — server fresh cache pe chal raha hai, http://127.0.0.1:3311 live.

## Repeat-Cleanup + Brand Logo Run 2026-09-02 (Phase 7)
- main agent: Repeats fixed — sidebar label "Your health journal" (header breadcrumb ke equal) → "Explore"/"देखें"; hero chip "Private" (sidebar privacy card ke equal) → "Works offline"; Home ka "Check symptoms" card (hero CTA ke duplicate destination) removed → 3 unique action cards 3-col grid me; recent-checks card ka duplicate corner icon-button removed; Nearby ka emergency directory strip (EmergencyModal ka exact 7-number duplicate) removed.
- main agent: Tagda brand logo — custom LogoMark (deep-forest tile, ink border, marigold heart, ivory heartbeat; favicon se 96px splash tak readable). components/LogoMark.jsx (splash 96/sidebar 44/auth 48/assistant 56), app/icon.svg same paths (favicon+PWA), print report header me inline SVG (pehle "A" text tha). Unused imports cleaned (HeartPulse page.js, Stethoscope HomeSection).
- main agent fixes: dev server + npm build ek saath → .next overwrite → static 404 + MIME text/plain (known hazard; build dev ke saath kabhi nahi). Fix: kill → rm .next → fresh dev restart. E2E splash assertions robust banaye (waitForFunction instead of fixed 700ms).
- verification: build pass (194 kB). Full suite: axe 16 states 0 violations, 54/54 flows (nearby flow ab locate-CTA assert karta hai, dir-strip gone), 0 console errors. icon.svg /icon.svg 200 serve. Screenshots: newlogo-splash, newlogo-home.
- needs_retesting: false — see REPORT.md section 14.

## Header Duplicate Identity Fix 2026-09-02 (Phase 7.1)
- issue: Logged-in header me do identity blocks the — session chip ("Aviral trivedi · Log out") + profile button ("A / Guest / Member since 2026"). Guest-mode profile button logged-in state me bhi render hota tha.
- fix: Header ab state-aware — logged-in: SIRF session chip (initials tile + naam jo Profile section kholta hai + Log out button); guest: SIRF profile button (Guest / Member since). Bonus: mobile sidebar me logged-in ke liye "Log out · <name>" row add (chip desktop-only thi, mobile pe logout ka rasta hi nahi tha).
- verification: Playwright — guest header me profile button + no chip; logged-in header me chip ("AT Aviral Trivedi Log out"), no "Guest"/"Member since" duplicate; chip-name click → Profile section (nav-profile aria-current=page); mobile sidebar logout row visible. Full suite: 54/54, axe 16 states 0 violations, 0 console errors. Build pass. (Dev-server-after-build hazard phir trigger hua — kill + rm .next + fresh restart se clean; memory me rule save kiya.)
- needs_retesting: false

## GPT Assistant Integration Run 2026-09-02 (Phase 8)
- main agent: OpenAI integration — key sirf .env me (gitignored, browser tak kabhi nahi jata; hardcode nahi). lib/server/openai.js: gptTriage() — chat completions JSON mode (gpt-4o-mini default, OPENAI_MODEL override), 12s timeout (client 20s budget ke andar), 600 max tokens, strict health system prompt (no diagnosis/prescription, doctor-referral always, 112 emergency, warm family-doctor tone, EN/HI reply language, severity enum + "prefer higher when in doubt").
- route /assistant: RULES-FIRST SAFETY — deterministic engine pehle chalta hai; rule emergency bole to GPT override NAHI kar sakta (red flag kabhi downgrade nahi hota). GPT sirf non-emergency pe enrichment karta hai; GPT severity rule se neeche jae to rules ki severity floor rehti hai. Source field ('gpt'|'rules') client tak — bot bubble pe "AI answer" badge (Sparkles icon) jab GPT se aaya.
- fallback design: GPT fail (network/timeout/quota/parse) → turant rules answer, 200 OK — user ko kabhi error nahi.
- verification: curl HI Hinglish query → 200 + rules fallback (429 roundtrip); curl "seena dard" → emergency:true source:rules (red-flag override confirmed). Full suite: 54/54 flows, axe 16 states 0 violations, 0 console errors. E2E timing deterministic (chat-last-result + Mongo polling — GPT latency-proof).
- BLOCKER (user action): key pe OpenAI credits khatam — "429 insufficient_quota: You have no credits remaining". Integration ready hai; platform.openai.com billing me credits add karte hi GPT answers apne aap on, koi code change nahi. Integration isliye live-prove nahi ho paya (sirf fallback path verified).
- SECURITY NOTE: user ne key chat me paste ki thi — ab public exposure maan ke rotate karna chahiye (platform.openai.com API keys). .env gitignored hai par leak hone wali key trust nahi.
- needs_retesting: GPT path needs one live re-test after credits are added (curl + one E2E run).

## Symptom-Photo Gate Run 2026-09-02 (Phase 9)
- issue: Image Analysis koi bhi image accept karke uspe "bimari" guidance de deta tha — screenshot/meme/document sab chal jata tha. User: body/skin ki photo par hi guidance aaye; anya photo par "symptoms ki photo dalo" notification.
- main agent: Photo gate — 2-layer verification: (1) GPT vision (gptVerifySymptomPhoto — server-side, JSON verdict {is_symptom_photo}, low detail 512px resize, 12s timeout; sirf true jab CAMERA photo ho AUR skin/body close-up ho — screenshots/docs/memes/cartoons/landscapes false), (2) local heuristic fallback (lib/imagecheck.js — YCbCr skin-tone ratio + sensor noise + edges + flatness; GPT unavailable/unchecked ho to). Flow: photo pick → 512px JPEG dataURL → /api/verify-photo → verdict; rejected → red notification ("This doesn't look like a symptom photo" / "यह लक्षणों की फोटो नहीं लग रही") + grayscale preview + questions locked (pointer-events-none) + analyze disabled + retry CTA; accepted → green "Photo accepted" banner. Re-upload se recovery hota hai. EN/HI strings. Photo decode fail bhi reject.
- verification: Synthetic E2E — skin-tone gradient+noise+blotches image → ACCEPTED; flat white + black text-lines "screenshot" → REJECTED w/ notification, questions locked, analyze disabled; re-upload skin → accepted + unlocked + guidance result. Full suite: 62/62 flows (8 naye image-gate flows), axe 16 states 0 violations, 0 console errors. Build pass. Dev server fresh restart (build-then-dev hazard rule follow kiya).
- note: GPT vision path abhi credits-blocked hai (429) — endpoint {unchecked:true} deta hai, heuristic chalta hai. Credits aane pe vision automatically primary ho jayega; heuristic sirf fallback rahega.
- needs_retesting: false — fallback path fully verified; vision path needs one live test post-credits.

## Full-Stack Completion Run 2026-09-03 (Phase 10 — GPT-spec ke remaining gaps)
- context: User ne GPT ki 24-point upgrade list phir paste ki. Gap analysis ne 9 phases ke baad bhi 7 genuine gaps diye: (1) Profile me sirf name/age/blood/conditions/allergies the — gender/height/weight/medications/emergency-contact missing; (2) /assistant ko profile context ka pata hi nahi tha (GPT prompt me user ki umar/BP/medicines kuch nahi jata tha); (3) Reminders me types/snooze/edit/notifications nahi the; (4) AI Memory ka koi consent/control nahi; (5) Privacy me export/delete-account nahi; (6) Education personalization missing; (7) History me search/filter nahi. Baaki 17 points (auth, triage, image gate, report analyzer, nearby, bilingual, a11y, dynamic dates, DB, API, UX states, PWA...) pehle hi phases me complete + verified the.
- main agent (sab implement kiya):
  - Profile: 5 naye fields (gender select, height, weight, medications, emergency contact) — storage.js DEFAULT_PROFILE, zod profileSchema, ProfileSection view+edit (sm:grid-cols-3 vitals row), emergency-contact tel: CTA (phone number regex extract). Insights completeness ab 5×6=30pt (name/blood/conditions-group/vitals/emergency-contact).
  - AI Memory (consent-first): profile.memoryEnabled flag (default OFF). /assistant ab server-side profile padhta hai — SIRF memoryEnabled=true hone par hi age/gender/conditions/allergies/medications GPT prompt me jate hain (context client se trust nahi hota — server DB se apne partition ka padhta hai). Consent copy explicit: "When on, these details are sent with your question to the AI service". Profile me Health Memory card (Brain icon, role=switch toggle, status line). OFF = instantly sab context band.
  - Reminders: 7 types (Medicine/Appointment/Exercise/Water/Sleep/Follow-up/Custom — lucide icons, chips with aria-pressed), snooze +10min (midnight wrap aane par today→tomorrow), inline edit (form edit-mode + Save changes/Cancel), notification-ready architecture (Notification.permission button in-section + page.js 30s scheduler jo due pending reminders ke liye window.Notification fire karta hai; permission sirf explicit click se). API: reminderSchema + type enum; PATCH ab partial (title/time/when/type/done) — snooze/edit server tak sync.
  - Privacy: profile section me "Your data, your rules" card — Export my data (client-side JSON download: profile+checks+reminders), Delete health history (confirm + server DELETE /checks), Delete account (sirf logged-in; DELETE /api/auth/account bearer-auth — users doc + checks/reminders/profiles/health_reports sab wipe; client local bhi saaf + auth screen pe wapas). Guest note jab account nahi.
  - Education: profile conditions se safe personalization — "Picked for you" gold chips (diabetes→Diabetes article waghera; Devanagari keywords bhi). Koi fabrication nahi — match na ho to strip nahi dikhta. 4 naye articles dono bhashaon me: Diabetes, Sleep, Exercise, Hygiene (GPT-list ke missing topics).
  - History: search input (summary+text match) + severity filter chips (All/Low/Moderate/High/Emergency) + no-match state.
  - GPT prompt: seek field me specialist type suggest karne ka instruction (physician/dermatologist/ENT).
  - BUG FIX (pre-existing, critical): /api/auth/claim anon data ko RAW EMAIL partition me move karta tha jabki client user-<base64url(email)> partition use karta hai — pre-signup ka data account me claim hone ke bajaye orphan ho jata tha. Ab claim dataUid (user-<b64>) me hota hai.
  - A11Y FIX (pre-existing): severity moderate chip amber-700 on amber-50 = AA fail (3.16:1) — amber-800 kar diya (5.3:1). Insights scoreFair tone bhi. Suite ke naye scan-state ne pakda (profile-privacy), pehle kabhi scan nahi hua tha is state me.
- verification: build pass (207 kB first load). Full suite: 84/84 flows (22 naye: history search/filter/no-match, reminder type-chip/snooze/snooze-DB-sync/edit/notify-button, profile vitals/emergency-CTA/new-fields-DB, memory off-by-default/DB-consent/status-flip, privacy guest-note/no-account-row/export-download/clear-history-wipe, education diabetes-suggestion/article-opens, delete-account row/back-to-auth/login-401-after/data-wiped), axe 18 states 0 violations, 0 console errors. Curl: profile PUT/GET naye fields roundtrip, assistant context-path crash-free, account delete bearer+401 guards, reminder PATCH partial edit roundtrip.
- screenshots: phase10-* set (profile-edit, profile-memory ON, profile-privacy, reminders-types, reminders-list snoozed, history-search, education-personal, education-article, profile-hindi).
- needs_retesting: false. GPT context path aur vision gate dono OpenAI credits aane par live-test bache hain (code-complete; fallback verified).

## ReportsSection Crash + Section-Switch Deadlock Fix Run 2026-09-03 (Phase 10.1)
- issue (user report): Reports tab pe "Element type is invalid: expected a string... got: undefined — Check the render method of ReportsSection" runtime error. Investigation ne 3 bugs nikale, sab pre-existing (E2E me Reports ka flow tha hi nahi, isliye kabhi pakde nahi gaye):
- bug 1 (crash): lucide-react se `Paste` import — installed version me wo export EXIST nahi karta (naam `ClipboardPaste` hai) → paste tab ka Icon undefined → React crash. Fix: import + usage `ClipboardPaste`. Project-wide audit script chalaya — baaki sab 16 files ke lucide named imports valid.
- bug 2 (deadlock, sabse paisa vasool): Reports section khulkar ek bhi tab-switch karne ke baad section switch KABHI nahi hota tha — nav click state badal deta (aria-current update) lekin AnimatePresence (page-level, mode="wait") ka exit kabhi complete nahi hota → koi bhi section mount nahi hota, bina kisi console error ke. Root cause: framer-motion 11.18 — subtree ke andar `layoutId` (shared-layout) element (reports tab pill `layoutId="reports-tab-pill"`) jab exiting tree ke saath unmount hota hai (layoutId move ke baad), exit completion callback fire nahi hota. Sidebar ka `nav-active-pill` isliye safe hai kyunki wo kabhi unmount nahi hota. Fix: pill se layoutId hata ke simple fade-in pill (visual difference negligible). Bhai-behisaab matrix test (A: sirf kholo→switch PASS; B: tab-click→switch DEADLOCK; C: tab+wapas→switch DEADLOCK; D: analysis→switch DEADLOCK) se isolate hua — analysis ka haath tha hi nahi. Inner tabs ka `mode="wait"` bhi hata diya (nested wait = extra risk, cross-fade same lagta hai).
- bug 3 (medical correctness): labs.js findValue substring match karta tha — "Fasting blood sugar 112" line "SGOT (AST) 112 high" ban ke interpret ho rahi thi (kyunki 'ast' keyword "f**ast**ting" substring me match ho jata tha) — galat test ko value map hona health app me serious issue. Fix: word-boundary regex `(^|[^a-z])(keyword)([^a-z]|$)` + plural keywords add (platelets/triglycerides). Regression suite: fasting-sugar ab sahi test pe map hota hai, colon/tab/comma formats, lakh-scale platelets, HbA1c vs HB collision — sab pass; plain sentences pe koi false positive nahi.
- E2E coverage gap fix: Reports ke 6 naye permanent flows add kiye (tabs render no-crash regression guard, paste-mode analysis, abnormal flag, table rows, Mongo save, delete+DB-sync) + naya 'reports' axe state. Suite ab **91/91 flows, 19 states, 0 violations, 0 console errors**. Home scan me ek dev-mode flake bhi mila (document-title first-compile window me) — suite me title-wait add karke deterministic bana diya (prod me genuine missing title ab bhi pakda jayega).
- verification: build pass; full suite green; dev server build ke baad fresh restart (hazard rule follow).
- needs_retesting: false

## Language-Switch Re-Render Run 2026-09-03 (Phase 10.2 — user report: "hindi me switch kru to har ek cheez hindi me aani chiye")
- issue: AI Assistant ki replies language toggle follow nahi karti thi — reply send-time pe compose ho ke plain string message me bake ho jati thi (assess() advice/seek ko request-lang me hi return karta tha). Switch ke baad purane messages purani bhasha me atke rehte the.
- fix (render-time i18n, bake-time nahi):
  - lib/triage.js: assess() ab HAMESHA bilingual returns — advice/seek {en: [...], hi: [...]} objects; buildAssessment() replyParts {en, hi} dono languages me. Lang param assess() se hata diya (lang ab display concern hai, data concern nahi).
  - route.js /assistant: rules payload ab poora bilingual (reply/advice/seek dono langs). GPT path: flat reply request-lang me rehti hai + naya `alt` field dusri language ka rules fallback — switch par GPT message bhi safe translation dikhata hai (re-request nahi, honest fallback).
  - AssistantSection: messages me sirf bilingual result store hota hai; text RENDER pe composeReply() se active language me banta hai — switch karte hi poori conversation (greeting, replies, result panel, seek lines, GPT badge, emergency card) re-render hoti hai. Timestamps ab ISO store hoke render pe active-locale me format hote hain. Local offline assess() fallback bhi same bilingual shape — composeReply teeno shapes handle karta hai (rules object, GPT flat+alt, offline structured).
  - ImageSection: result advice bhi {en, hi} me store — switch par image-analysis result bhi re-render.
- E2E: 4 naye permanent flows — fever reply ke baad HI toggle → chat में बुखार + panel बुखार; EN wapas → Fever + Devanagari gone; emergency advice language-toggle follow. Suite: **95/95 flows, 19 axe states, 0 violations, 0 console errors**, build pass (207 kB). Unit: assess() bilingual shapes + buildAssessment en/hi replyParts verified in Node.
- live walkthrough (real browser): EN conversation → HI switch → same replies Devanagari में → HI में emergency advice → EN switch back → sab English. Screenshots: langswitch-1-english / langswitch-2-hindi / langswitch-3-hindi-emergency.png. 0 page errors.
- design principle captured: user-visible strings kabhi bake nahi karo — bilingual data + render-time pick (GPT jaisi single-lang sources ke liye alt fallback).
- needs_retesting: false

## "Aur Tagda" Run 2026-09-03 (Phase 11 — voice + smart follow-ups + rotating tips + personal emergency contact)
- context: User: "brio isko aur tagda ban aur bdiya kr isko". Chaar naye UX features, sab bilingual (EN/HI live toggle):
- features:
  - Voice input (Assistant): Web Speech API SpeechRecognition — input row me mic button (listening state me red pulse + stop icon), active language me sunta hai (hi-IN / en-IN), interim results live input me, final transcript par auto-send (≥3 chars; chhoti awaaz pe silently drop). Unsupported browser me button render hi nahi hota; permission-denied / not-allowed par honest inline error (micDenied copy). Koi native toast nahi — chat ke andar hi note.
  - Read-aloud (Assistant): speechSynthesis — header me "Read answers aloud" toggle (aria-pressed) ON hone par naye replies auto-speak hote hain active voice-lang (hi-IN/en-IN, rate 0.97); har bot bubble par per-message Volume2 button (readAloud). Toggle OFF par ongoing speech cancel. Unmount par speech + recognition cleanup.
  - Smart follow-up chips (Assistant): har non-emergency reply ke baad "You could ask next" chips — severity-aware set (low: home-care/how-long/prevention; moderate: home-care/doctor/medicine; high: whenDoctor/medicine/homeCare; emergency: chips nahi — 112 card pehle). Chip click = topic-aware POORA question send hota hai ("What can I do at home for fever?") — topic assessment ke apne summary se aata hai (render-time language ke hisab se EN/HI), user text fallback ke saath. Rules engine us question ko wapas fever context me answer karta hai; GPT (credits ke baad) specific answer karega. Toggle ke saath chips bhi Hindi flip hote hain.
  - Tip of the day rotation (Home): static "small habits" tip ki jagah 12-entry bilingual tipPool — date-seeded (Math.floor(Date.now()/86400000) % 12) — same tip pooray din, har naye din nayi (hydration, post-meal walk, sleep discipline, salt sense, sunlight vitamin, 20-20-20, fibre, stress breaths, hand-washing, medicine timing, posture, family history). EN/HI pool parity i18n contract — E2E me date-seed assert hota hai.
  - Personal emergency contact (EmergencyModal): profile ka emergency contact ab emergency modal me "Call my emergency contact" button banta hai — 112 ke neeche, saved line (name · number) ke saath, tel: digits-only (98765 43210 → tel:9876543210). Contact na ho to honest empty note ("add one in your profile..."). Server-first sync ke through hi aata hai (UI journey se save hua profile) — localStorage seed overwrite ho jata, isliye test bhi UI journey hai.
- design calls: mic/speak icons lucide (Mic/MicOff/Volume2/VolumeX/Square), voice UI forest-green identity me; koi emoji nahi; emergency modal ka contact button 112 ke red ke neeche distinct copy — "repeated info" AI-tell se bachne ke liye chips sirf lastResult panel me (ek hi canonical jagah).
- E2E: 14 naye permanent flows — date-seeded tip + tip-body, chips render/severity-match/topic-send, mic present, speak toggle present/pressed-flip, per-message speak buttons, chips Hindi-flip, my-contact tel: digits + saved line + empty-state note + no-button-when-empty. History flows 2→3 checks update (chip ab ek triage run hai). Profile-privacy scan me animation-settle wait (known axe false positive: mid-flight entrance pe color-contrast — timestamp/amber chip). Suite ab **109/109 flows, 19 axe states, 0 violations, 0 console errors**; build pass (212 kB first load). Emergency contact flows suite ke section-9 profile-save ke BAAD chalte hain — server-first merge ne localStorage-seed overwrite kar diya tha (root cause isolated; app behavior correct, test ko real user journey banaya).
- screenshots: tagda-1-home-tip / 2-assistant-voice / 3-followup-chips / 4-chip-answer / 5-hindi-chips / 6-emergency-contact.png
- voice limitations (honest): SpeechRecognition Chromium/Edge/Safari me hai, Firefox me nahi (button hide); headless E2E me real mic-transcribe test nahi hota — DOM/permission/error paths verified. speechSynthesis voice quality OS/browser pe depend karti hai (Windows me hi-IN voice available ho to Hindi padhta hai, warna default voice).
- needs_retesting: false — real-mic end-to-end user ke browser me try karna (self-try guide report me).

## "Aur Badhiya" Run 2026-09-03 (Phase 12 — daily-companion round: Today's Plan + BMI + weekly digest + conversation context + copy)
- context: User: "aur bdiay kro bhai isko and mujeh tagda chiye sab kuch". Pehchaan: app ab tak "reaction" app tha (sawal→jawab, reminder list) — is round ko PROACTIVE daily-companion banaya: subah kya karna hai, meri body kaisi hai, hafte ka haal kaisa raha, aur follow-up sawal context yaad rakhe.
- new lib/health.js (pure, unit-tested in Node):
  - bmiValue/bmiBand — WHO Asian-Indian consensus cutoffs (18.5/23/27.5 — 2004 expert consultation; global WHO chart se pehle risk) — unit-test ne ek boundary bug pakda: 172/68 = 22.98 ko round karke 23.0 "Overweight" bana raha tha; ab band RAW value pe decide hota hai (22.98 → Normal). Unit matrix: normal/over/obese/under/invalid sab pass.
  - planForToday — due-today logic (daily/weekdays/weekends/weekday-names/once; tomorrow kabhi nahi), sort: overdue pehle → pending by time → done last (strike ke saath visible), time parse "HH:MM" NaN-safe.
  - weeklyDigest — last-7-days checks, severity counts, worst severity, top symptom (most-frequent summary), reminders completed window me.
- features:
  - Today's Plan (Home, upcoming-reminders card ko REPLACE kiya — repeat-info AI-tell se bacha): full timeline with per-type icons (RemindersSection ke 7 types ke same lucide icons — visual language consistent), one-tap done/undo (page.js onToggleReminder → sync.toggleReminder → PATCH Mongo — E2E me DB sync verified), overdue rows amber + "overdue" chip, done rows strike + progress counter (x/y done), honest empty state with first-reminder CTA, +add shortcut. i18n live (Hindi me "आज का प्लान").
  - BMI card (Insights, lg:col-span-2): value 5xl + Asian-threshold band chip (Normal/सामान्य waghera) + band-specific honest guidance copy + scale note ("Asian-Indian thresholds... guidance only, not a diagnosis") + missing-vitals empty state with Open-profile CTA. E2E: 172/68 → 23.0 Normal.
  - Weekly digest (Insights, lg:col-span-2): 4 stat tiles — checks logged / reminders completed / highest urgency / most frequent topic; quiet-week honest copy. E2E: fever+chip se 2 checks, top = Fever.
  - Conversation context to GPT (credits ke baad activate): AssistantSection ab har send par priorTurns (user texts + assistant rendered answers, 500-char slices) bhejta hai; assistantSchema me optional history (max 6, role enum); gptTriage() history ko proper messages array me inject karta hai. Rules path context ignore karta hai — deterministic safety floor waisa hi. E2E: follow-up chip request me history len>=2 role/content shape verified (network-request mirror hook se).
  - Copy button on bot replies: navigator.clipboard + "Copied" feedback (1.6s), clipboard blocked → navigator.share fallback (India's chat-first sharing). Emergency cards pe nahi (unpe 112 hi primary action hai).
- contrast fix (naye axe violations, dono genuine): plan-card done-row stone-400 line-through 2.1-2.3:1 fail → stone-600 (6.4:1) + done icon bhi stone-600; RemindersSection done-row strike stone-600 (7.3:1) pehle se theek tha. Memory rule refresh: strike-through text bhi contrast threshold follow karta hai.
- E2E: 13 naye permanent flows — plan card/empty-state (section 1), copy button + history-context (section 2a-2), digest check-count/top-symptom/worst + BMI empty (7b), BMI computed 23.0 + Asian band + plan populated + one-tap buttons (8a, profile-save ke baad). Suite: **122/122 flows, 19 axe states, 0 violations, 0 console errors**; build pass (215 kB first load); dev fresh-restarted (hazard rule).
- screenshots: p12-1-today-plan / p12-2-assistant-context / p12-3-bmi / p12-4-digest / p12-5-hindi-plan.png
- needs_retesting: false — GPT-context path credits ke baad ek live curl se verify bacha hai (request-shape E2E se verified).

## Splash Redesign Run 2026-09-03 (user feedback: "splash ka background colour achha nahi lag raha, green mat laga")
- issue: Splash poore screen par deep forest-green (#142d20) tha — user ko pasand nahi aaya. App ka asli identity ivory paper + ink + marigold hai; dark green full-screen usse alag feel karta tha.
- fix (splash ab app jaisa warm paper hai):
  - Background: deep green → ivory (#f5f0e3), auth screen wale hi warm paper jaisa — seamless transition (splash → auth ab ek hi duniya mein hain).
  - Layers: halka marigold tint top-left se + antique-gold tint bottom se (radial, subtle); wahi 22px ink dot-grid texture; aur ek thin double gold frame (border-[#b8974f]/45 + /25) — journal-cover feel, koi glow/navy/blue-gradient AI-tell nahi.
  - Brand: deep forest green ab SIRF logo tile mein (LogoMark apna bg laata hai) — paper par pop karta hai. Neeche slow marigold heartbeat pulse (repeat) — "sehat ka dil" touch.
  - Text: wordmark ink (#stone-900) + "GPT" antique gold (#b8974f) mein (auth strip jaisa, pehle cream-on-green tha); tagline stone-600; langs caps #8a6215.
  - Progress: pehle ink-green track + marigold fill → ab inset-shadow cream track (#e4dcc8) + marigold→gold gradient fill.
  - testids untouched (splash-logo contract) — timing/timer unchanged (2.2s).
- verification: DOM-asserted bg rgb(245,240,227) (ivory, green gone); full suite re-run — **122/122 flows, 19 axe states (splash scan included) 0 violations, 0 console errors**; splash flows (logo visible, brand text, reload-skip) pass; mobile viewport bhi capture kiya.
- screenshots: splash-new-design.png (early), splash-new-mid.png (desktop, heartbeat+progress mid-play), splash-new-mobile.png.
- needs_retesting: false

## Clean-UI Green-Cleanup Run 2026-09-03 (user: "har jgh se green background htao, clean UI chiye")
- context: Splash redesign ke baad user ne clear kiya — green background SABHI jagah se hatana hai (sirf splash nahi). Brand identity ab: ivory paper + ink + marigold/gold; green sirf LogoMark tile (brand mark) aur chart data-viz strokes mein rehta hai — kisi UI chrome mein nahi.
- token map (jo bhi green tha uska neutral destination):
  - solid #1d6b48/#155741 primary buttons (hero CTA, profile-save, rem-add, image-analyze, history-start, insights-start) → auth-submit wala marigold ink-style (bg-[#eda33c] + ink text + border-2 ink + hard offset shadow) — poore app mein ab EK hi primary-button language.
  - #142d20 deep-green pills (sidebar active pill ×2, auth tab pill, reports tab pill) → sidebar pill = cream card + gold border + ink hard-shadow (bg-[#fffdf7] border-[#b8974f] shadow-[3px_3px_0_0_#0f241a], active text ink); tab pills = ink #0f241a (brand-neutral dark, green nahi).
  - Hero panel (Home) — sabse bada green block — → paper card: bg-[#fffdf7], ink headline, stone-600 body, gold badge (cream + gold border), marigold CTA (ink border + hard shadow), footer divider stone-200, Leaf watermark gold-tinted.
  - Chat user bubble → deep INK #26251c + cream text + ink border (paper-style twin of bot bubble); chat send button → ink; GPT badge, plan progress chip, quick-reply hovers, follow-up chips, selected filter/type chips (history/nearby/reminders/image), memory-status, accepted-photo banner, digest tiles, stat tiles, session chip, avatars → cream family (#f4efdf/#f4e9d2) + gold borders (#b8974f) + deep-gold text (#8a6215).
  - Memory toggle switch ON → marigold; reminders done-chip → cream+gold; insights score tones/chips/icon tiles → gold/cream (ring colors follow: good=#eda33c, excellent=#b8974f); completion bar gradient → marigold→gold; sync chip cloud → cream+gold (amber local unchanged); focus rings/borders green → gold; remaining green TEXT accents (lang icon, shields, checks, links) → #8a6215 deep gold.
  - Print report CSS (th bg, footer, header rule) → cream/ink; PWA manifest theme_color + layout themeColor #142d20 → #f5f0e3 (status-bar tint bhi clean).
- verification:
  - grep audits: zero green tokens (#1d6b48/#142d20/#2b5e40/#e9f0e4/#e3ecdd/#cfe0d2/emerald-*/#f2f6ef/#155741) UI mein — sirf LogoMark tile (intentional brand), chart strokes/MIX_COLORS (data-viz), print CSS updated.
  - computed-style scan (Playwright): har element ka backgroundColor green-hue test (g > r+12 && g > b+12) — Home/Assistant/Insights/Reminders/Profile sab par NONE. 0 console errors.
  - contrast: #8a6215 on #f4efdf = 4.76:1, on #f4e9d2 = 4.54:1 (AA pass); ink bubble #26251c + #f5f0e3 text = 13:1+.
  - suite: pehle run pe ek axe false-positive (assistant scan — emergency-card entrance mid-animation pe follow-up chips/label ka opacity sampling; naye gold chips 4.76 base hain to fade ke beech dip hota hai jo purane high-contrast green chips mein invisible tha) → settle wait add (known [[axe-core-animation-timing]] trap). Do flow races bhi pakde gaye jo pehle kabhi nahi phate the (timing-sensitive ho gaye the machine load se): history-delete DB-sync ab poll-loop (mirror fire-and-forget hai), mobile sync-chip ab waitForFunction (fresh context ka loadAll in-flight). Final: **122/122 flows, 19 axe states, 0 violations, 0 console errors**; build pass; dev restarted.
- screenshots: clean-1-home … clean-5-profile.png (Home hero paper card, assistant ink bubbles + gold chips, insights gold score, reminders cream chips, profile).
- needs_retesting: false

## Phase 13 Run 2026-09-03 (user: "har ek cheez aur tagdi kr")
- theme: assistant ka DIMAAG tagda — follow-up chips pehle generic triage re-run karte the; ab har chip ko apne sawaal ke mutabik CONTENT milta hai.
- features:
  - **Intent-aware follow-ups**: naya `assessWithIntent()` router — chip-question pehle safety rules se guzarta hai (emergency override intact), phir intent detect karke symptom-specific answer deta hai. 5 intents (homeCare/medicine/howLong/whenDoctor/prevent) × symptom tables: fever homeCare = "rest, khichdi, ORS, lukewarm sponge"; cough medicine = "viral — no antibiotics, ever"; tooth whenDoctor = "face swelling = same-day". Hinglish/Devanagari intent words bhi (dava/dawai, दवा, kitne din, kaise bachu). whenDoctor intent severity ko high kar deta hai — sawaal hi doctor-visit ka hai.
  - **Duration escalation**: "4 din se bukhar" / "15 din se khansi" / "4 दिन से बुखार" ab severity HIGH uthata hai + dedicated note ("past the usual course — see a doctor soon"). Per-symptom limits (fever 3d, cough 14d, urinary/tooth 2d, generic 7d); digit + English word + Hinglish word (teen/char/bees) + hafte/maheene + Devanagari sab parse.
  - **4 naye symptom rules**: ear (kaan/कान), tooth (दाँत/masude/cavity), constipation (kabz/शौच), asthma (wheezing/सीटी/इहेलर — 'saans' red-flag breathing ke territorial boundary mein rehta hai, neeche dekho).
  - **Green-tint sevLOW token hata** (user ki clean-UI continuity): severityMeta.low emerald→amber — history/insights mein "Low" chip ab warm cream tone mein.
  - **Home streak card**: `checkStreak()` pure fn — consecutive check-in days, yesterday-friendly (aaj ki pehli check se pehle bhi kal ki chain dikhti hai), 0 = fresh-start day (Sparkles, scolding nahi). Streak ≥1 = Flame + gold tile.
  - **Date-aware plan**: 'today'/'tomorrow' reminders ab calendar-date se bind hain (createdAt-anchored dayKey) — kal "today" wala plan mein nahi aayega, "tomorrow" wala us din aayega. Pehle dono har roz dikhte the.
  - **Quick templates** (Reminders): 4 one-tap chips — Drink water 11:00, Evening walk 18:30, Take medicine 21:00, Sleep on time 22:30 (sab daily, typed-with types, i18n-following, DB-sync E2E-verified).
  - **Time-aware greeting keys**: morning/afternoon/evening (teeno Namaste — locale variance ke liye keys ready).
- verification:
  - **40/40 unit tests** (scripts/unit-phase13.mjs): intent routing × 5, Hinglish intent words, severity upgrade, generic fallback, emergency-over-intent, escalation (4d/15d/1-week + no-escalation controls), naye rules, plan-date correctness (today/tomorrow across Thursday/Friday), streak (3-chain, gap, empty, today-only).
  - **Suite 131/131 flows, 19 axe states, 0 violations, 0 console errors** — 9 naye flows (streak fresh/today, intent fever-specific, medicine intent, escalation High + note, plan template, template DB sync) + 2 updated assertions (history 3→5 checks, search 2→4 — medicine-chip run ab triage hai).
  - 3 test-side catches unit round mein: (1) `dava` Hinglish spelling missing thi wordlist se; (2) `\b` Devanagari ke bagal mein kabhi match nahi karta (ASCII boundary) — digit-pattern rewrite; (3) 'saans phool' test phrase breathing RED FLAG se collide hoti hai (emergency correct hai!) — asthma rule assertion wheezing/seeti/dam pe shift.
  - build green (231 kB first load), dev restarted on 3311, 0 console errors.
- screenshots: p13-1-home-streak … p13-5-hindi.png.
- needs_retesting: false

## Sticky Sidebar + Header Fix 2026-09-03 (user: "left side wala sidebar fix kr right side vale ke sath move na ho")
- issue: desktop pe sidebar `lg:static` tha — right side ka content jitna scroll hota, sidebar bhi uske saath upar jata tha. User ko pinned sidebar chahiye tha.
- fix (app/page.js):
  - Sidebar: `lg:static` → `lg:sticky lg:top-0 lg:bottom-auto lg:h-screen` — apni jagah hamesha visible (flex child, width 282px pe hi, column ban jata hai).
  - Nav list: `flex-1` → `min-h-0 flex-1 overflow-y-auto overscroll-contain` — chhoti viewport pe nav ka apna scroll (vahi warm ivory scrollbar), brand header aur privacy card pinned rehte hain (flex-col + shrink-0).
  - Header: `sticky top-0 z-30` + existing backdrop-blur — lang toggle/bell hamesha haath ke paas.
  - Mobile drawer bina touch ke intact — fixed positioning waisi hi.
- bonus: `:focus-visible` outline green #1d6b48 → gold #b8974f (de-greening pass ka aakhri chhoota hua token).
- verification:
  - Bounding-box proof: 1200px scroll pe sidebar rect EXACT same (x/y unchanged, y=0), header y=0, privacy card viewport ke andar, nav click post-scroll kaam karta hai. 0 console errors.
  - Mobile: drawer open (aside x=0) + close (aside x=-282) DOM-verified — pehli debug assertion galat thi (`isVisible()` transform-off-screen pe bhi true; asli signal bounding box hai).
  - Full suite re-run: **131/131 flows, 19 axe states, 0 violations, 0 console errors**; build green; dev restarted.
- screenshots: sticky-1-scrolled.png (desktop, 1200px scrolled — sidebar pinned), sticky-2-mobile-drawer.png.
- needs_retesting: false
