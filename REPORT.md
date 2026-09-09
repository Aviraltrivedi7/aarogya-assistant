# 🩺 AarogyaGPT — Deep Analysis + Improvement Report

> **Date:** 2 Sept 2026 · **Tool:** axe-core 4.10.2 + manual code audit + Playwright verification + live API tests
> **Project:** AarogyaGPT — "Your AI Health Companion" (Next.js 15, React 18, Tailwind, MongoDB backend)
> **Update (Phase 2):** Full backend implemented — MongoDB persistence, 13 API endpoints, offline-first sync layer

---

## 1. TL;DR — Ek Nazar Me

| Area | Score (before) | Verdict |
|---|---|---|
| 🎨 UI / Design | 8/10 | Premium dashboard, kamaal ka design 👌 |
| ♿ Accessibility (axe) | **4/10** | 2 critical issues har page par — icon buttons bina naam, contrast fail |
| 🔒 Security | **5/10** | Frame-ancestors `*`, CORS `*`, koi security headers nahi |
| 🧠 Functionality | **3/10** | Sirf dikhaawa — chat fake hai, 7 nav items me se 5 kuch nahi karte, language toggle sirf label badalta hai |
| 🏗️ Architecture | 4/10 | 2,900+ chars ki single-line JSX, sab kuch ek file me, koi modularity nahi |
| 🌐 i18n | 2/10 | EN/HI toggle button hai par kahin bhi Hindi text nahi hai |
| 💾 Data Persistence | 0/10 | Sab hardcoded — "Rahul Kumar", reminders, history sab fake |

**Bottom line:** Design ekdum premium hai, lekin app ke andar koi asli kaam nahi ho raha. Isko "tagda" banane ke liye accessibility + security + real functionality — teeno fix karne honge. Neeche har issue ka detail aur fix plan hai.

---

## 2. Project Overview — Ye Kya Hai

AarogyaGPT ek **health assistant web app** hai (India-focused: "Namaste", emergency number 112, Hindi+English claim). Ye **frontend-only** tha jab mile:

```
aarogya-assistant-main/
├── app/
│   ├── page.js              ← Poora app ek hi file (~48 lines, har line 400-900 chars ki)
│   ├── layout.js            ← Basic metadata
│   ├── globals.css          ← Tailwind + leftover CRA styles
│   └── api/[[...path]]/     ← Sirf MongoDB "status check" template endpoints
├── components/ui/           ← 44 shadcn/ui components — INSTALL HAI PAR USE NAHI hote
├── hooks/, lib/             ← Basic utilities
├── tests/                   ← Sirf empty __init__.py (Python?!)
└── test_result.md           ← Platform testing history
```

**Dependencies:** Next 15.5, React 18.3, MongoDB driver, react-query, zod, 40+ Radix UI packages — sab installed, **lekin app sirf lucide-react icons use karta hai.**

---

## 3. ♿ Axe-Core Accessibility Audit (Scan Results)

Playwright + axe-core se 4 states scan kiye — desktop dashboard, chat open, emergency modal, aur mobile (390×844). [Full JSON: `axe-report.json`]

### ❌ Violation #1: `button-name` — **CRITICAL**
*"Buttons must have discernible text"*

| State | Affected buttons |
|---|---|
| Desktop dashboard | 2 |
| Chat open | 6 |
| Emergency modal | 7 |
| Mobile | 4 |

**Problem:** Bell button 🔔, mobile menu/close buttons, chat ke mic 🎤/attach 📎/send buttons, "View all" arrow buttons — sab me sirf icon hai, koi accessible name nahi. **Screen reader user ke liye ye invisible buttons hain.** Exact axe output:

```
[critical] button-name: 7 nodes
   e.g. .relative.flex.h-10.w-10... (bell button — sirf <Bell/> icon)
   e.g. .text-slate-400:nth-child(1) (chat attach button)
```

### ❌ Violation #2: `color-contrast` — **SERIOUS** (10-15 nodes per scan)
*"Elements must meet minimum color contrast ratio thresholds"* (WCAG 2.1 AA: 4.5:1)

| Element | Class | Problem |
|---|---|---|
| "YOUR WORKSPACE" label | `text-blue-200/50` | Navy sidebar par ~1.8:1 ratio — bahut dim |
| "Personal health space" breadcrumb | `text-slate-400` | White par ~2.9:1 |
| "Member since 2026" | `text-slate-400 text-[10px]` | ~2.9:1 + 10px font |
| Hero badge "Tuesday, 20 August 2026" | `bg-[#e5f6fc]` + `text-[#1478a8]` | ~3.4:1 |
| Date/timestamps in history cards | `text-[10px] text-slate-400` | ~2.9:1 |
| Avatar initials "RK" | `bg-[#d7f1fa]` | ~3.3:1 |

### ⚠️ Incomplete (manual check needed): hero gradient text
`text-cyan-100`, `text-cyan-50/85` gradient par — axe verify nahi kar paya, par white-on-cyan-50/85 borderline hai.

### ✅ Jo Achha Hai: 30-35 checks pass hue per state (lang attribute, heading order, list structure, meta viewport, etc.)

---

## 4. 🔒 Security Audit

### next.config.js me issues:

| Issue | Risk | Detail |
|---|---|---|
| `X-Frame-Options: ALLOWALL` | 🟡 Medium | Invalid value (valid: `DENY`/`SAMEORIGIN`) — browsers ignore it. Platform iframe ke liye chahiye, isliye CSP se manage karna hoga |
| CSP = sirf `frame-ancestors *` | 🟡 Medium | Real CSP nahi — script-src/img-src rules missing, XSS protection zero |
| CORS: `*` default | 🟡 Medium | Har origin se API accessible + credentials allowed combo risky |
| **Missing headers** | 🔴 High | `X-Content-Type-Options` (MIME sniffing), `Referrer-Policy`, `Permissions-Policy`, `X-DNS-Prefetch-Control` — kuch bhi nahi hai |

### app/api/route.js me issues:
- `MONGO_URL` missing ho to **har route 500** deta hai (connect top par hota hai)
- Body validation sirf `client_name` check — type validation nahi, injection-prone structure
- No input size limits, no rate limiting
- CORS headers `handleCORS` me bhi duplicate logic

### Environment:
- **Koi `.env.example` nahi** — naya dev setup karne wala samajh nahi payega `MONGO_URL`/`DB_NAME` kya hai
- `test_credentials.md` memory/ ignored hai ✓ (theek hai)

---

## 5. 🧠 Functional Gaps — "Asli Problem"

Ye app ek **movie set** hai — bahut se shandaar (beautiful facade), andar khaali. Har nav item ka reality check:

| Feature (sidebar) | Kya hona chahiye | Kya karta hai |
|---|---|---|
| 🏠 Home | Dashboard | ✅ Kaam karta hai (par hardcoded data) |
| 💬 AI Assistant | Symptom chat | ⚠️ **FAKE** — 3 hardcoded messages, koi logic nahi. "bukhar" likho ya "cancer" — same reply |
| 📄 Health History | Saved checks | ❌ Kuch nahi — sirf `active` state change, content same rehta hai |
| 🖼️ Image Analysis | Skin/visual analysis | ❌ Kuch nahi |
| 🔍 Nearby Care | Hospital finder | ❌ Kuch nahi |
| ❓ Health Education | Articles/tips | ❌ Kuch nahi |
| 🔔 Reminders (badge "3") | Medicine/water reminders | ❌ Kuch nahi — badge bhi hardcoded "3" |
| 👤 Profile | User details | ❌ Kuch nahi — "Profile" nav me hai hi nahi, button "Rahul Kumar" hardcoded |

**Aur bhi gaps:**
- 🌐 **Language toggle = dikhawa.** `EN` → `HI` click karo, bas button ka text badalta hai. App me **ek bhi Hindi string nahi hai** — jabki hero bolta hai "Tell us in English or Hindi!"
- 💾 **Zero persistence** — chat history, reminders, profile kuch save nahi hota (na localStorage, na DB usage)
- 🚨 Emergency modal: sahi hai par sirf 112. India ke liye **108 (ambulance), 104 (health), 1091 (women), 1098 (child), Tele-MANAS 14416 (mental health)** — ye sab missing hain
- 📱 Mobile: sidebar close button mobile-only hai par `button-name` fail (axe)
- 🎨 "View all", mic, paperclip buttons — **sab dead** (koi onClick nahi)

---

## 6. 🏗️ Code Quality Issues

| # | Issue | Kahan | Severity |
|---|---|---|---|
| 1 | 48 lines me poora app, lines 30-47 me **800-2900 characters ki single-line JSX** — unreadable, unmaintainable | `app/page.js:30-47` | 🔴 |
| 2 | Demo data top-level const me hardcoded (`Rahul Kumar`, fake checks) | `app/page.js:11-18` | 🔴 |
| 3 | Nav me "Profile" listed nahi par `go('Profile')` call hota hai — active state 'Profile' ban jaata hai, koi UI nahi | `app/page.js:33` | 🟡 |
| 4 | Emergency card click logic `tone.includes('red')` par depend — fragile string check | `app/page.js:40` | 🟡 |
| 5 | `layout.js` me minimal metadata — OpenGraph/viewport/themeColor/icons missing | `app/layout.js` | 🟡 |
| 6 | `globals.css` me leftover CRA styles (`.App-logo`, `App-logo-spin`) — dead code | `app/globals.css:49-86` | 🟢 |
| 7 | `package.json` name "nextjs-mongo-template" — project ka naam hi template hai | `package.json:2` | 🟢 |
| 8 | Dev script me `NODE_OPTIONS='--max-old-space-size=512'` — **Windows par kaam nahi karta** (POSIX syntax) | `package.json:6` | 🟡 |
| 9 | 44 shadcn components + react-query + zod installed par **0 use** — dead weight | `components/ui/` | 🟢 |
| 10 | Testing agent ne kaha tha "data-testid attributes add karo" (test_result.md) — **add nahi kiye** | sab kuch | 🟡 |
| 11 | No error boundaries, no loading states, no empty states | `app/page.js` | 🟡 |
| 12 | `tests/` folder Python `__init__.py` — JS project me anjaan cheez | `tests/` | 🟢 |

---

## 7. 🚀 Improvement Plan — "Tagda" Banane Ka Blueprint

### Phase 1: Foundation
- ✅ `app/page.js` ko modular components me todo (`components/sections/`)
- ✅ `lib/i18n.js` — **poori EN/HI dictionary**, har string translated
- ✅ `lib/triage.js` — rule-based symptom triage engine: keyword matching (English + **Hinglish** — "sir dard", "bukhar", "pet dard", "chakkar", "khoon") + red-flag detection (chest pain, breathing, stroke FAST, bleeding, poisoning, suicidal thoughts) + severity levels
- ✅ `lib/storage.js` — localStorage layer: history, reminders, profile (SSR-safe)

### Phase 2: Real Functionality (7 sections, sab kaam karenge)
- 💬 **AI Assistant**: real triage chat — quick replies, severity assessment, follow-up questions, red-flag pe emergency prompt, history me save
- 📄 **Health History**: saved checks (localStorage), delete, risk badges, empty state
- 🖼️ **Image Analysis**: guided visual-symptom flow with upload preview + structured questions + disclaimer (ko misleading AI claim nahi)
- 🔍 **Nearby Care**: **real geo-location + OpenStreetMap Overpass API** — no API key needed, hospitals/clinics/pharmacies sach me dhoondhega + India emergency directory
- ❓ **Health Education**: searchable article library EN/HI (hydration, fever, nutrition, mental health, first aid)
- 🔔 **Reminders**: add/edit/delete/complete, localStorage, live badge count
- 👤 **Profile**: editable (name, age, blood group, conditions, allergies), header me naam show hoga

### Phase 3: Accessibility (axe violations → 0)
- Har icon button ko `aria-label` / visible text
- Contrast palette fix: `blue-200/50` → `blue-200/80`, `slate-400` → `slate-500/600`, text size bumps 10px → 11-12px
- Focus-visible rings, `prefers-reduced-motion` support, skip-to-content link
- Modal: focus trap + Escape + `role="dialog"` + backdrop click close

### Phase 4: Security + Polish
- Security headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera=self, geolocation=self — Nearby Care ke liye), CSP with platform-safe frame-ancestors
- API: zod validation, Mongo connect sirf jab chahiye, `/api/health` (no DB dependency), input caps
- `layout.js`: full metadata + OpenGraph + viewport + themeColor + **SVG favicon**
- `package.json`: naam "aarogya-gpt", Windows-compatible dev script
- `data-testid` attributes — testing agent ki demand poori
- `globals.css` cleanup + focus states

### Phase 5: Verification
- `npm run build` pass
- axe rescan — **0 violations target**
- Playwright E2E: har section, chat flow, reminders CRUD, language toggle
- Screenshots before/after

---

## 8. ✅ Final Results (After Implementation)

> Ye section implementation ke baad update hui hai.

### Axe Rescan — 11 states, sab par

| Scan | Before | After |
|---|---|---|
| Desktop dashboard | 2 violations (critical + serious) | ✅ **0 violations** |
| Chat / AI Assistant | 2 violations | ✅ **0 violations** |
| Emergency modal | 2 violations | ✅ **0 violations** |
| Mobile (390×844) | 2 violations | ✅ **0 violations** |
| Health History *(naya)* | — | ✅ **0 violations** |
| Image Analysis *(naya)* | — | 1 → ✅ **0** (file input ka aria-label fix) |
| Nearby Care *(naya)* | — | ✅ **0 violations** |
| Education *(naya)* | — | ✅ **0 violations** |
| Reminders *(naya)* | — | 1 → ✅ **0** (toast contrast fix) |
| Profile *(naya)* | — | 1 → ✅ **0** (toast contrast fix) |
| **Hindi mode** *(naya)* | — | ✅ **0 violations** |

**Total: 13 violations → 0 violations.** Har icon button ab accessible naam ke saath hai, saari text contrast WCAG AA (4.5:1+) pass karti hai, focus-visible ring add hui, `prefers-reduced-motion` support hai, aur emergency modal me focus trap + Escape + backdrop close hai.

### Functional E2E (Playwright) — 18/18 pass

| Flow | Result |
|---|---|
| Fever triage reply (EN) | ✅ |
| **Hinglish red-flag:** "seena dard ho raha hai" → emergency card + Call 112 | ✅ |
| History: checks save ho rahe + delete kaam karta hai | ✅ |
| Image Analysis: bina photo analyze disabled | ✅ |
| Nearby: India emergency directory — 7 numbers | ✅ |
| Education: search filter + aria-expanded accordion | ✅ |
| Reminders: add → badge, toggle done, delete | ✅ |
| Profile: edit → save → header me naam live update | ✅ |
| **Hindi toggle:** nav "होम", section "प्रोफ़ाइल", greeting "नमस्ते" | ✅ |
| Emergency modal: open, 7-number directory, Escape close | ✅ |
| Mobile sidebar open/close | ✅ |

**Console errors: 0** · **`npm run build`: pass** (43.5 kB page, 146 kB first load)

### Security verification (live server)

```
✓ Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'
  https://overpass-api.de ws:; frame-ancestors *; object-src 'none'; base-uri 'self'
✓ X-Content-Type-Options: nosniff
✓ Referrer-Policy: strict-origin-when-cross-origin
✓ Permissions-Policy: camera=(), microphone=(), payment=(), usb=(), geolocation=(self)
```

API bhi verify hua: `GET /api/health` → `{"ok":true}` (bina DB), invalid POST → 400 (zod validation), unknown route → 404, rate limit 60 req/min. Aur ek maza ki baat — **CSP ne axe scan ke CDN fetch ko bhi block kiya, yaani security sach me kaam kar rahi hai.** 😄

### Naye Features (before: 0, after: sab real)

- **7 working sections + Profile + Emergency** — pehle 5 nav items dummy the, ab sab kaam karte hain
- **Triage engine**: 60+ symptom rules (14 symptom groups × 8 red-flag rules), English + **Hinglish** ("sir dard", "bukhar", "pet dard", "chakkar") + Devanagari keywords
- **Poori EN/HI i18n** — ~100+ strings, dono languages me, language choice persist hota hai
- **localStorage persistence** — history, reminders, profile, language (SSR-safe)
- **Real nearby-hospital search** — geolocation + OpenStreetMap Overpass API (no API key), 3km radius, hospitals/clinics/pharmacies filters
- **India emergency directory** — 112, 108, 104, 1091, 1098, Tele-MANAS 14416, cyber crime 1930
- **Searchable Health Education** — 6 articles EN/HI me
- **Guided Image Analysis** — client-side only photo preview (koi upload nahi), structured questions, red-flag guidance
- **data-testid attributes sab jagah** — testing agent ki demand poori (test_result.md me likha tha)
- **Naya SVG favicon**, OpenGraph metadata, themeColor `#082e50`
- **`npm run dev` ab Windows pe bhi chalta hai** (POSIX `NODE_OPTIONS=` syntax hata)

### Naya Architecture

```
app/
├── page.js                  ← Shell: nav, header, emergency modal (readable ~330 lines)
├── layout.js                ← Full metadata + viewport + themeColor
├── globals.css              ← focus-visible, reduced-motion, CRA junk removed
├── icon.svg                 ← Favicon
└── api/[[...path]]/route.js ← zod validation, /api/health, rate limit, lazy Mongo
lib/
├── i18n.js                  ← EN/HI dictionary + makeT()
├── triage.js                ← Symptom rules, red flags, assess()
└── storage.js               ← SSR-safe localStorage layer
components/sections/
├── HomeSection.jsx          ← Real history + real reminders se dashboard
├── AssistantSection.jsx     ← Chat UI + triage engine integration
├── HistorySection.jsx       ← Saved checks, delete, clear
├── ImageSection.jsx         ← Guided visual-symptom flow
├── NearbySection.jsx        ← Overpass search + emergency directory
├── EducationSection.jsx     ← Searchable articles
├── RemindersSection.jsx     ← Full CRUD
└── ProfileSection.jsx       ← Editable profile
```

### Verification Log

1. `npm run build` — ✅ pass (82s, 0 errors)
2. axe-core 4.10.2 via Playwright — ✅ **0 violations, 11 states**
3. Playwright E2E — ✅ **18/18 flows**
4. Console/page errors — ✅ **0**
5. Security headers — ✅ live verified (curl)
6. API endpoints — ✅ health/400/404 verified
7. SEO/metadata — ✅ title, description, OG, themeColor live verified

*Evidence files: `axe-report.json` (raw scan data), `before-dashboard.png` / `after-dashboard-en.png` / `after-assistant.png` / `after-dashboard-hi.png` / `after-reminders.png`, `axe-scan.cjs` (dev tool — `node axe-scan.cjs` se dobara chala sakte ho).*

## 9. 🚀 Phase 2 — Backend Implementation (Latest)

> User demand: "sab kuch implement kr iska backend and sab kuch har ek chij mai proper working"
> **Result: poora MongoDB backend + offline-first sync — har feature ab server pe save hota hai, DB down ho to bhi app nahi rukti.**

### Backend Architecture

```
app/api/[[...path]]/route.js   ← 13 endpoints (zod validation + 120 req/min rate limit)
lib/server/db.js               ← Lazy Mongo connection + auto-indexes + graceful degrade
lib/sync.js                    ← Offline-first sync: server-first, localStorage mirror,
                                 merge-by-id on load, back-sync of offline items
scripts/dev-mongo.cjs          ← `npm run dev:db` — in-memory MongoDB for local dev
```

### API Endpoints (sab live-tested with curl)

| Method | Route | Result |
|---|---|---|
| GET | `/api/health` | ✅ `{ok:true, db:"connected"}` |
| POST | `/api/assistant` | ✅ Server-side triage — fever → advice; "seena dard" → emergency + Call 112 |
| GET/POST | `/api/checks` | ✅ 201 + list; POST me single ya array (offline back-sync) |
| DELETE | `/api/checks` · `/:id` | ✅ Clear-all + single delete |
| GET/POST | `/api/reminders` | ✅ Upsert by id |
| PATCH/DELETE | `/api/reminders/:id` | ✅ Toggle done + delete |
| GET/PUT | `/api/profile` | ✅ Upsert profile |
| GET | `/api/nearby?lat=&lon=` | ✅ Overpass proxy, 3 mirrors, real Delhi data verify hua |
| Auth | — | ✅ Missing X-User-Id → 401; bad severity → 400 (zod); sab kuch rate-limited |

### Backend Development Bugs Jo Pakde Gaye Aur Fix Kiye (asli engineering 🔧)

1. **Next 15 status bug**: `json(data, {status: 201})` → `init["status"] must be in range 200-599` — data DB me save ho raha tha par response 500 de raha tha. 4 call sites fix kiye.
2. **Overpass 406 mystery**: Node fetch default headers pe overpass-api.de 406 (Not Accept) deta hai — curl chalega, Node nahi. Bisect karke pakda: **User-Agent jo URL brackets `( ) ( )` contain karta hai wo block hota hai.** `User-Agent: AarogyaGPT/0.2` → 200. Comment me document kiya.
3. **Hydration mismatch**: `useState(store.getProfile())` SSR vs client first render me alag data deta tha (localStorage) → React hydration error. `DEFAULT_PROFILE` constant se fix + date badge par `suppressHydrationWarning` (Node ICU vs browser locale formatting).
4. **Mongo crash-resilience**: DB down → `withDb` connection reset karta hai, agli request pe reconnect. Live verify: Mongo band → app chalti rahi → Mongo on → `db: connected` wapas.

### Data Flow (offline-first sync)

```
READ:  server try → merge by id (server-first) → localStorage update → back-sync offline items
WRITE: localStorage turant (UI snappy) + background server push
FAIL:  503 {dbDown:true} → client 'local' mode me switch → feature kabhi nahi rukta
UI:    sidebar chip — 🟢 "Cloud synced" / 🟡 "Saved on this device" (EN/HI dono me)
```

### Backend E2E Verification (29/29 flows, sab ✅)

**Backend-specific:**
- Sync chip "Cloud synced" jab DB up · `/api/health` → `db: connected`
- Triage check **MongoDB me save** hua (server se count verify)
- Hinglish "seena dard" → emergency card (server-side triage se)
- History delete → **DB se synced** (server count 1 kam)
- Reminder add → **DB me**; toggle → **DB me done=true** (server se verify)
- Profile save → **DB me name + blood group** (server se verify)
- **Page reload → data MongoDB se restore** (history + reminders wapas)
- **DB kill test**: Mongo band → chip "Saved on this device", chat local engine se, reminders localStorage me — 0 page errors. App kabhi nahi tooti.

**Overall: 0 axe violations (11 states) · 0 console errors · `npm run build` pass · real Delhi hospitals/pharmacies Overpass se aa rahe hain (names + phone numbers ke saath).**

## 10. ✨ Phase 3 — Premium Design Upgrade (Final)

> User demand: "isko aur tagda bana, har ek cheez premium honi chahiye"
> **Result: luxury typography, buttery motion design, wellness stats — bina koi functionality tode.**

### Kya Premium Banaya

| Upgrade | Detail |
|---|---|
| 🔤 **Luxury typography** | **Plus Jakarta Sans** (display/headings) + **Inter** (body) via `@fontsource` — self-hosted, zero external requests, build-safe offline |
| 🎬 **Motion design** | framer-motion poore app me — section transitions (AnimatePresence), sidebar **spring-animated active pill** (layoutId), staggered card entrances, emergency modal scale/fade entrance |
| 🏠 **Wellness Snapshot** | Naya stats strip: Checks done · Reminders completed · Days with us — live data se |
| 💬 **Premium chat** | Message entrance animations, **timestamps** har message par, animated send button (hover/tap micro-interactions), focus glow on input |
| ✨ **Micro-interactions** | Logo glow pulse, hero floating glow circles, card hover lifts, premium shimmer keyframes |
| ♿ **A11y-first motion** | `MotionConfig reducedMotion="user"` — jo users animation band rakhte hain unke liye sab animations auto-disable. CSS `prefers-reduced-motion` override bhi |

### Engineering Notes (Phase 3)

- **Fonts self-hosted** (@fontsource) — Google Fonts CDN dependency nahi, platform builds offline bhi chalenge
- **Hydration-safe Hindi dates**: Node full-ICU ke bina `hi-IN` locale silently English me fall back karta tha → browser se mismatch. `Intl.DateTimeFormat.supportedLocalesOf('hi-IN')` check karke safe locale resolution + `suppressHydrationWarning` — ab hydration errors zero
- **Axe + animations ka lesson**: mid-animation opacity (0→1) axe ko contrast failure dikhati hai — audits ko settled-state pe chalana chahiye. App me bug nahi tha, test timing thi (fixed with settle waits)

### Final Verification (Phase 3)

| Check | Result |
|---|---|
| `npm run build` | ✅ pass (186 kB first load) |
| axe-core — 11 states | ✅ **0 violations** (EN + HI + mobile + modal sab) |
| Playwright E2E | ✅ **29/29 flows** (backend MongoDB assertions ke saath) |
| Console errors | ✅ **0** |

**Screenshots:** `premium-dashboard-en.png` · `premium-assistant.png` · `premium-dashboard-hi.png` · `premium-emergency-hi.png`

---

*Raport ka analysis section (1-7) implementation se pehle likha gaya; section 8 phase-1 verification ke baad; section 9 backend implementation ke baad; section 10 premium upgrade ke baad. Axe raw data: `axe-report.json`. Dev instructions: `README.md`.*

## 11. 📈 Phase 4 — Insights, Analytics & PWA (Latest)

> User demand: "aur tagda bna bhai isko"
> **Result: full analytics dashboard + printable health reports + PWA — app ab "health companion" se "health journal" ban gaya.**

### Naya Kya Mila

| Feature | Detail |
|---|---|
| 📊 **Insights section** | Naya nav item (TrendingUp icon). 4 live widgets — sab real data se compute hote hain: |
| ⭕ **Health Score ring** | 0-100 composite score — recent severity (40pts) + reminder completion (30pts) + profile completeness (30pts). Animated SVG ring (`strokeDashoffset` spring) + grade label (Excellent/Good/Fair/Poor) |
| 📉 **Severity trend** | 14-day AreaChart (recharts) — per-day worst severity 1-4, gaps honestly null (`connectNulls={false}` — jis din check nahi hua wo khali dikhta hai, jhooth nahi) |
| 🍩 **Symptom mix donut** | Top-5 symptom categories ka PieChart + legend with counts |
| ✅ **Reminder completion** | Done-ratio progressbar (animated fill) with `role="progressbar"` + `aria-valuenow` |
| 🖨️ **Printable health report** | History me "Print health report" button — popup with styled, doctor-ready HTML: header, profile strip (name/age/blood/conditions/allergies), poora checks table (date/symptom/severity), disclaimer footer, auto-`window.print()` |
| 📱 **PWA manifest** | `app/manifest.js` — standalone display, brand theme colors, SVG icon. `manifest.webmanifest` route build output me generated ✅ |

### Engineering Notes (Phase 4)

- **recharts lazy-loaded** — `next/dynamic` se InsightsSection alag chunk me (charts sirf insights kholne par download hote hain). Page first-load JS sirf ~3 kB badha (186 → 189 kB)
- **A11y charts**: chart SVG ko `aria-hidden` karke wrapper ko `role="img"` + human-readable `aria-label` (EN/HI trend summary) + sr-only text summary — screen readers ko chart ka matlab samajh aata hai, axe bhi khush (0 violations)
- **Print report XSS-safe**: popup HTML me har user value `escapeHtml()` se escape hoti hai
- **Hybrid scoring**: score fast path pe rule-based hai (koi bhi jaldi dekh sakta hai "75/100 — Fair"), empty-data states properly handled (no data → motivational empty state + "Start a check" CTA)

### Verification (Phase 4) — 2026-09-02

| Check | Result |
|---|---|
| `npm run build` | ✅ pass — 189 kB first load, `manifest.webmanifest` route generated |
| axe-core — 13 states | ✅ **0 violations** (insights + history-print scans added) |
| Playwright E2E | ✅ **39/39 flows** — naye: score ring render, score 0-100, trend/mix SVG, completion %, print popup opens, report table rows, manifest 200 |
| Console errors | ✅ **0** |

**Screenshots:** `screenshots/insights-en.png` · `screenshots/insights-hi.png` · `screenshots/print-report.png` · `screenshots/insights-score-ring.png` · `screenshots/history-print-button.png`

## 12. De-AI Redesign — Indian Wellness Identity (2026-09-02)

**Problem:** Design "AI se bana" lag raha tha — navy sidebar, blue glow gradients, glow circles, Plus Jakarta Sans + Inter (AI-template fonts), SaaS copy ("Wellness Snapshot"), emoji-heavy labels. Ye sab generic AI-template tells hain.

**Direction:** Indian wellness identity — jaise ek real Indian health app / clinic brand dikhaye. Fonts Ek Type ke (Indian foundry), colors ayurvedic clinic vibes, copy insaan ki zubaan me.

### What Changed

| Area | Before (AI-template) | After (Indian wellness) |
|---|---|---|
| **Fonts** | Plus Jakarta Sans + Inter | **Baloo 2** (display) + **Mukta** (body) — Ek Type Indian foundry, Devanagari + Latin saath designed. Hindi headings ab genuinely Indian typography me dikhti hain, machine-translated nahi |
| **Palette** | Navy `#082e50` sidebar + sky blues + violet accents | **Deep forest green** `#142d20` sidebar, `#1d6b48` primary, **marigold** `#eda33c`/`#f2c063` accents, **ivory paper** `#faf6ec`/`#f5f0e3` bg, antique gold `#b8974f` borders, ink `#0f241a` |
| **Texture** | Flat + glassy gradients | Ivory paper pe subtle **dot-grid texture** (22px radial-gradient) — print/paper feel, SaaS gloss nahi |
| **Shadows** | Soft glassy shadows | **Hard offset shadows** (`shadow-[6px_6px_0_0_#0f241a]`) — poster-style depth |
| **Glow** | Logo glow-pulse, hero floating glow circle | Dono removed — grounded, flat icon tiles |
| **Copy** | "Wellness Snapshot", SaaS jargon | **"Your health journal"** / "आपका स्वास्थ्य पत्रिका" — journal metaphor, insaan ki zubaan |
| **Emoji** | Emoji har card/table me | Emoji removed from UI labels — icons only |
| **Charts** | Default recharts blues/violets | Forest-green + marigold chart palette |
| **PWA** | Navy theme | `theme_color: '#142d20'`, `background_color: '#f5f0e3'` |
| **Icon** | Blue SVG | Forest-green tile, marigold pulse, genda-phool heart |

### Engineering Notes

- ~25 hex values + class families (slate→stone, sky→emerald/forest, violet→amber, bg-white→ivory) bulk-swapped across 10 files via Python script
- Regex swap ne **15 invalid `text-text-[#...]` classes** banaye the (double prefix) + 1 broken shadow class — sab caught & fixed before delivery
- **2 WCAG AA contrast violations** naye palette pe mile (stone-500 ivory cards pe fail) — 20 instances `text-stone-500` → `text-stone-600`, re-verified 0
- Hindi typography: `[lang="hi"]` headings pe `line-height: 1.25` — Devanagari ascenders/descenders clip nahi hote
- Warm scrollbar, warm selection color, warm focus ring (`#1d6b48`) — detail tak consistent

### Verification (De-AI Redesign) — 2026-09-02

| Check | Result |
|---|---|
| `npm run build` | ✅ pass — 189 kB first load (unchanged) |
| axe-core — 13 states | ✅ **0 violations** (2 contrast violations fixed pre-delivery) |
| Playwright E2E | ✅ **39/39 flows** |
| Console errors | ✅ **0** |
| Old design markers | ✅ 0 — no navy/sky/violet/glow remnants in codebase |

**Screenshots:** `screenshots/newdesign-home.png` · `newdesign-assistant.png` · `newdesign-history.png` · `newdesign-insights.png` · `newdesign-nearby.png` · `newdesign-hindi.png`

### Addendum — White Sidebar (2026-09-02, user request)

User feedback: sidebar white chahiye. Deep forest green sidebar → **warm white** (`#fffdf7`) + ink text (`#26251c`):

| Element | Change |
|---|---|
| Sidebar bg | `#142d20` → `#fffdf7` (warm white, ivory palette se blend) + `border-r` stone hairline |
| Text | White/emerald-100 tones → ink `#26251c` / stone-600 |
| Active pill | Ivory-on-green → **deep forest green pill `#142d20` with white text** (contrast 13:1) — active ab bhi brand green me pop karta hai |
| Brand "GPT" | Marigold `#f2c063` → deep gold `#8a6215` (white pe AA pass) |
| Reminders badge | Active: marigold chip `#eda33c` on green pill; inactive: `#f4e9d2`/`#8a6215` |
| Emergency btn | `red-500/20 red-100` → `red-50 red-700` + red border |
| Privacy card | Glassy white/6% → ivory card `#faf6ec` + stone border; ShieldCheck forest green |
| Sync chip | Translucent → solid `emerald-100/amber-100` chips |
| Mobile drawer | Same white + stone-900 shadow |

**Verification (white sidebar):** axe 13 states → **0 violations** · E2E **39/39 flows** · console errors **0**. Screenshots: `newdesign-sidebar-white-home.png` · `newdesign-sidebar-white-hindi.png`

## 13. Splash Screen + Login/Signup (Accounts) — 2026-09-02

**User request:** "splash screen bna tagdi si, uske badd login and signup page aaye, then home page open ho"

### Flow Ab Kya Hai

```
Pehli visit:   Splash (2.2s animated) → Login/Signup screen → App
Wapas aana:    (session saved) → Seedha app me — koi splash/auth nahi
Logout:        Header chip → Login screen (data account me safe rehta hai)
Guest mode:    "Continue as guest" — pura app anonymous device id pe chalta rahega
```

### Kya Bana

| Piece | Detail |
|---|---|
| 🎬 **Splash screen** | Deep forest green full-screen, marigold logo tile spring-scale entrance + language badge pop, "AarogyaGPT" Baloo 2 me, tagline + "English · हिन्दी" strip, marigold progress bar (1.35s fill). Dot texture warm gold. Reduced-motion respect |
| 🔐 **Auth screen** | Login/Signup sliding-tab card (spring pill, layoutId) — ivory paper bg, ink-border + hard offset shadow, marigold submit button. Signup me extra name field animate hota hai (height spring). Password show/hide eye. Server errors red card (role="alert") |
| 🛡️ **Real backend auth** | `POST /api/auth/signup` · `/login` · `/claim`. Passwords **scrypt** hash (node:crypto, timing-safe compare, random salt). Tokens **HMAC-SHA256 signed** (`payload.sig`, 30-day expiry, tamper-proof, koi extra dep nahi). Users Mongo collection (unique email index) |
| 📦 **Anonymous data claim** | Login/signup pe device ka anonymous data (checks/reminders/profile) **account me move** ho jata hai — pehle app try kiya, baad me signup kiya to kuch nahi bigadta |
| 🧭 **Identity switch** | Logged-in users ka data partition = `user-<base64url(email)>` (API ka X-User-Id validation pass karta hai); logout pe wapas anonymous device id. Sync layer session-aware |
| 👤 **Session chip + logout** | Header me green chip (name + Log out button). Guest ko chip nahi dikhta |
| 🔁 **A11y-first** | Auth screens `<main>` landmark + `<h1>` brand, labelled inputs, error role="alert", tablist/aria-selected — axe 0 violations auth states pe bhi |

### Bugs Caught & Fixed (pre-delivery)

1. **Splash stuck**: `onSplashDone` parent ko gate switch kar raha tha lekin SplashGate ka internal stage 'splash' pe atka tha — fix: hamesha `setStage('auth')` + parent optional unmount
2. **Account uid 401s**: `user:email@...` format API ke `^[A-Za-z0-9_-]{8,64}$` regex pe fail — fix: `user-<base64url(email)>` encoding (deterministic, valid)
3. **Session chip invisible**: SplashGate `onDone` me sirf `name` ja raha tha, `email` nahi — chip `session?.email` pe render hota hai
4. **7 axe violations auth screens pe** (landmark-one-main, page-has-heading-one, region) — `<main>` + `<h1>` structure se 0

### Verification — 2026-09-02

| Check | Result |
|---|---|
| `npm run build` | ✅ pass — 194 kB first load (+5 kB auth ke liye) |
| axe-core — **16 states** (splash, auth-signup, auth-login naye) | ✅ **0 violations** |
| Playwright E2E — **54 flows** (15 naye auth flows) | ✅ **54/54** — signup lands app, check saved under account partition, logout → login screen, wrong pw rejected, login → app, reload skips auth (session restore), account data restored |
| Console errors | ✅ **0** |
| curl auth API | ✅ signup 201 + token, login 200, wrong pw 401, duplicate email 409, claim bearer-protected |

**Screenshots:** `screenshots/auth-splash.png` · `auth-signup.png` · `auth-login.png`

## 14. Repeat-Cleanup + Brand Logo — 2026-09-02

**User request:** "bhut si chize repeat ho rhi hai... fix kro, aur tagda sa logo bna kr lga do"

### Repeats Jo Fix Hue

| Repeat | Fix |
|---|---|
| Sidebar "Your health journal" = header breadcrumb (same string 2 jagah) | Sidebar section-label ab **"Explore" / "देखें"** — journal naam sirf breadcrumb me |
| Hero chip "Private" = sidebar privacy card (same screen pe privacy 2 baar) | Hero chip ab **"Works offline" / "ऑफ़लाइन भी चलता है"** — real, distinct feature |
| Home "Check symptoms" card = hero CTA (dono assistant kholte the) | Symptoms card removed; action grid ab **3 unique cards** (Images/Nearby/Emergency), 3-col layout |
| Recent-checks card me 2 "view history" buttons (icon + text) | Corner icon-button removed — single clear CTA |
| Nearby me emergency directory (7 numbers) = EmergencyModal ka exact duplicate | Nearby strip removed — modal (sidebar red button se 1 click) hi canonical source |

### Tagda Logo — Ek Mark, Har Jagah

Custom **LogoMark**: deep-forest rounded tile (ink border) + **marigold heart** + **ivory heartbeat line** — 16px favicon se 96px splash tak readable:

- `components/LogoMark.jsx` — reusable SVG component (splash 96, sidebar 44, auth 48, assistant 56)
- `app/icon.svg` — same paths (favicon + PWA install icon)
- Print report header — same mark inline (pehle plain "A" text tha)
- Aur sabse tagda: **splash logo ab 96px, spring-scale entrance + language badge** — brand tile ka full impact

### Verification — 2026-09-02

| Check | Result |
|---|---|
| `npm run build` | ✅ 194 kB first load |
| axe-core — 16 states | ✅ **0 violations** |
| Playwright E2E | ✅ **54/54 flows** (nearby flow updated — locate CTA) |
| Console errors | ✅ **0** |

**Screenshots:** `screenshots/newlogo-splash.png` · `newlogo-home.png`

## 15. Symptom-Photo Gate — 2026-09-02

**User request:** "koi bhi image dalu sab pe bimari likh deta hai — body ki image aaye tabhi likhe; aur photo dale to notification aaye ki symptoms ki photo dalo"

### Kya Badla

| Pehle | Ab |
|---|---|
| Koi bhi image (screenshot/meme/document) → guidance | Photo **verify** hota hai pehle |
| — | Body/skin close-up ho → **green "Photo accepted"** banner + questions unlock |
| — | Aur koi photo → **red notification**: "This doesn't look like a symptom photo / यह लक्षणों की फोटो नहीं लग रही" + clear close-up skin photo dene ko bole |
| — | Rejected photo: grayscale preview, questions **locked**, Analyze **disabled** — galti se "bimari" kabhi nahi likhega |
| — | "Choose a symptom photo" retry button — turant dusri photo utha sakte ho |

### Verification — 2 Layers

1. **GPT vision (primary, credits aane pe active):** `/api/verify-photo` → model dekhta hai image camera-photo hai ya nahi + skin/body close-up hai ya nahi. JSON verdict. 512px resize, 12s timeout.
2. **Local heuristic (fallback — abhi active):** `lib/imagecheck.js` — YCbCr **skin-tone pixel ratio** + sensor-noise + edges + flatness. GPT down/credits-blocked → heuristic chalta hai; user kabhi block nahi hota.

### Verification Suite — 62/62 Flows

Naye flows: screenshot-like image **rejected** + notification title + questions locked + analyze disabled; skin-like photo **accepted** + questions unlocked + **analyze → guidance** produce. axe 16 states 0 violations, 0 console errors, build pass.

## 16. Full-Stack Completion — Profile, Memory, Privacy, Smart Reminders, Personalised Education — 2026-09-03

The remaining gaps from the full product spec were closed. Every feature is opt-in and consent-first; nothing leaves the device or account without an explicit user action.

### What was added

**Complete health profile** — 5 new fields on top of the existing set: gender, height (cm), weight (kg), current medicines, emergency contact (name + phone). The emergency contact renders as a one-tap `tel:` call button on the profile. All fields persist locally and in MongoDB via `PUT /api/profile`.

**Health memory (consent-gated AI context)** — a `memoryEnabled` switch on the profile (default **off**). Only when the user turns it on does `POST /api/assistant` load their profile server-side and append age/sex/conditions/allergies/medicines to the GPT prompt. The context is read from the DB partition the request's `X-User-Id` maps to — the client never gets to decide what the AI "knows". Consent copy states plainly that the details are sent to the AI service when on.

**Smart reminders** — 7 types (medicine, appointment, exercise, water, sleep, follow-up, custom) with icon chips on the add form and list rows; snooze (+10 min, wraps past midnight); inline edit (title/time/when/type) via the same form; browser-notification architecture: an in-section permission button and a 30-second scheduler that fires `Notification` for due pending reminders while a tab is open. Snooze and edit sync to MongoDB through a partial `PATCH /api/reminders/:id`.

**Privacy controls** — "Your data, your rules" card in Profile: export all data as a JSON download (profile + checks + reminders), delete health history (confirm → server + local wipe), and delete account (logged-in only — `DELETE /api/auth/account` with bearer auth removes the user record and every document under the account partition, then the client clears local data and returns to the login screen). Guests see a guest-mode note instead of the account row.

**Personalised health education** — the profile's "ongoing conditions" text is matched (EN + Devanagari keywords) against topic tags; matching articles surface in a "Picked for you" strip. No match → no strip (nothing is fabricated). Four new bilingual articles: diabetes, sleep, exercise, everyday hygiene.

**History search + filter** — free-text search across summary/notes plus severity filter chips (all/low/moderate/high/emergency) with a no-match state.

### Fixes found during verification

- **Claim bug (pre-existing, critical):** `/api/auth/claim` moved anonymous data into the raw-email partition, but the client partitions account data under `user-<base64url(email)>` — pre-signup data was being orphaned instead of claimed. Claim now targets the correct partition id.
- **Contrast fix (pre-existing):** the moderate-severity chip (`text-amber-700` on `bg-amber-50`, 3.16:1) failed WCAG AA. Now `text-amber-800` (5.3:1). The new `profile-privacy` axe state caught it — the first time that chip was scanned.
- GPT prompt now names the right specialist type when obvious (physician / dermatologist / ENT) in the seek field.

### Verification

- Production build: 207 kB first load.
- Full suite: **84/84 functional + backend flows**, **18 axe states / 0 violations**, **0 console errors**.
- API roundtrips verified with curl: profile new fields PUT/GET, partial reminder PATCH, account deletion (bearer + 401 guards, login rejected afterwards, data wiped).
- New E2E flows cover: history search/filter/no-match, reminder type chip + snooze (DOM + DB) + edit + notify button, profile vitals + emergency CTA + all new fields in DB, memory off-by-default → consent → DB flag → status flip, privacy guest note / export download / history wipe, education diabetes suggestion + article open, account deletion end-to-end.

### Remaining (external, not code)

OpenAI credits/key rotation — activates the GPT answer enrichment (with memory context) and the vision photo-gate primary; both fall back safely today. Production deployment config (real MongoDB URL, `AUTH_SECRET`, `CORS_ORIGINS`).

## 17. Hardening + "Aur Tagda" UX Round — 2026-09-03

Three passes landed back-to-back: two stability/language fixes and a feature round that makes the assistant feel like a companion rather than a form.

### Phase 10.1 — crash + deadlock + parser fixes (user-reported)

- **ReportsSection crash** — lucide-react exports `ClipboardPaste`, not `Paste`; the paste-tab icon was undefined and crashed the section. Project-wide lucide import audit run; all other named imports valid.
- **Section-switch deadlock (silent, worst bug of the round)** — after opening Reports and clicking any tab, every section switch froze with zero console errors: framer-motion 11.18 doesn't fire the exit-completion callback when a `layoutId` element unmounts with the exiting subtree (the reports tab pill). Removed `layoutId` from the pill (plain fade); the sidebar pill is unaffected because it never unmounts.
- **Labs parser correctness** — substring keyword matching mapped "Fasting blood sugar 112" to SGOT via `ast` inside "f**ast**ting". Rewritten with word-boundary regex + plural keywords; regression-tested against colon/tab/comma formats and lakh-scale values.

### Phase 10.2 — render-time bilingual replies

Replies used to bake the active language at send-time, so toggling left old messages stuck. The engine now stores **bilingual data** (`advice/seek = {en, hi}`) and the UI picks per-message at render — the whole conversation re-renders on toggle. GPT (single-language) replies ship an `alt` rules translation for the other language. Timestamps store ISO and format at render in the active locale.

### Phase 11 — "aur tagda": voice, smart follow-ups, rotating tips, personal emergency contact

**Voice input** — mic button in the chat input row (Web Speech API). Recognition runs in the active language (`hi-IN`/`en-IN`); interim transcript fills the input live; a substantial final transcript auto-sends. Unsupported browsers hide the button; permission-denied shows an honest inline note. `micDenied`/`micUnsupported` copy in both languages.

**Read-aloud** — "Read answers aloud" toggle in the assistant header (`aria-pressed`): new replies auto-speak in the active language via `speechSynthesis` (rate 0.97 for Devanagari). Every bot bubble also carries a per-message speaker button. Turning the toggle off cancels live speech; unmount stops both recognition and synthesis.

**Smart follow-up chips** — after every non-emergency reply the assistant suggests the next question, picked by urgency: low → home-care / how-long / prevention; moderate → home-care / doctor / medicine; high → doctor / medicine / home-care; emergencies get no chips (the 112 card takes over). A chip sends a **complete, topic-aware question** ("What can I do at home for fever?") composed from the assessment's own summary in the active language — so the triage engine (and GPT, once credits are on) answers in context instead of dead-ending. Chips re-render in Hindi with the language toggle.

**Rotating tip of the day** — the home journal's pinned note now draws from a 12-tip bilingual pool, date-seeded (same tip all day, a new one each day): hydration, post-meal walks, sleep discipline, salt sense, morning sunlight, 20-20-20 eyes, fibre, stress breaths, hand-washing, medicine timing, posture, family history. EN/HI pool parity is asserted in E2E against the seed.

**Personal emergency contact in the emergency modal** — the profile's emergency contact now appears as a call button under 112 in the emergency modal, showing the saved line ("Sunita Devi · 98765 43210") and dialing digits-only (`tel:9876543210`). No contact saved → an honest empty note pointing to the profile. Flows through the sync layer (server profile is the source of truth) — the E2E exercises the real UI journey: edit profile → save → open modal.

### Verification

- Full suite: **109/109 functional + backend flows**, **19 axe states / 0 violations**, **0 console errors** (14 new permanent flows: tip seed + body, chips render/severity/topic-send, mic present, speak toggle + pressed flip, per-message speak buttons, chips Hindi-flip, contact tel: + saved line + empty state + absence).
- Production build green (212 kB first load); dev restarted post-build per the build-vs-dev hazard rule.
- Root cause isolated for a test-side trap: seeding localStorage while the server holds a saved profile loses to the server-first merge on reload — by design. The emergency-contact flows now use the profile UI journey.
- One axe false-positive documented and fixed in-suite: mid-animation color-contrast sampling on the chat timestamp/severity chip needed the ~900 ms settle wait.
- Live screenshots: `screenshots/tagda-1…6` (home tip, assistant voice controls, follow-up chips, chip answer, Hindi chips, emergency contact).

**Voice notes (honest limits):** SpeechRecognition is Chromium/Edge/Safari — Firefox hides the mic button. Headless E2E verifies presence, error paths and auto-send wiring; real-mic transcription is for the user's browser. speechSynthesis voice quality depends on installed OS voices (Windows with a Hindi voice reads Devanagari; otherwise the default voice is used).

## 18. Daily-Companion Round — Today's Plan, BMI, Weekly Digest, Conversation Context — 2026-09-03

The app answered when asked; this round makes it pro-active. Four features turn the journal into a daily companion, plus one deep fix for GPT answer quality.

### What was added

**Today's Plan (Home)** — the "upcoming reminders" strip became a live timeline of today's routine: per-type icons (the same 7 lucide icons as the Reminders section), one-tap done/undo that PATCHes MongoDB instantly (E2E verifies the DB flag flips), overdue rows highlighted amber with an "overdue" chip, completed rows struck through at the bottom with an "x/y done" progress counter. No reminders yet → an honest empty state with an "Add your first reminder" CTA. Follows the EN/HI toggle live ("आज का प्लान").

**BMI with Asian-Indian thresholds (Insights)** — a full-width card computing BMI from the profile's height/weight using the WHO Asian-Indian consensus cutoffs (underweight < 18.5, normal < 23, overweight < 27.5, obese ≥ 27.5) — South Asians hit metabolic risk earlier than the global chart, and the copy says so plainly ("guidance only, not a diagnosis"). Band-specific honest guidance per category, and a "add height & weight in profile" empty state with a one-tap profile link. A unit test caught a boundary bug before it shipped: 172 cm / 68 kg is BMI 22.98 — rounding to 23.0 first would have mislabelled it "Overweight"; bands now compare the raw value.

**Weekly digest (Insights)** — the last 7 days at a glance: checks logged, reminders completed, highest urgency seen, and the most frequent topic (from the triage engine's own summary labels). A quiet week gets an honest quiet-week note instead of zeros.

**Conversation context for GPT** — follow-up questions ("is any medicine needed?") only make sense with what came before. The assistant now sends the recent turns (user texts + its own rendered answers) with each request; the zod schema accepts them, and the OpenAI prompt receives them as proper chat messages. The rules engine stays deterministic and context-free — it's the safety floor, not a chatbot. Verified end-to-end at the request level (the follow-up chip's POST carries ≥2 role/content turns); GPT-side behaviour activates the moment credits are added.

**Copy button on replies** — every bot reply has a copy button (clipboard, with a "Copied" confirmation); where the clipboard is blocked (plain http, old browsers) it falls back to the native share sheet. Emergency cards keep 112 as the only action.

### Verification

- Full suite: **122/122 functional + backend flows**, **19 axe states / 0 violations**, **0 console errors** (13 new permanent flows).
- Two new genuine contrast violations caught by the suite and fixed before build: the plan card's struck-through done text was stone-400 on ivory (2.1:1) → stone-600 (6.4:1).
- Unit tests for the new `lib/health.js` (BMI bands, due-today logic, weekly digest) run in Node — pure functions, no React.
- Production build green (215 kB first load); dev restarted post-build per the hazard rule.
- Screenshots: `screenshots/p12-1…5` (today's plan, assistant context chips, BMI card, weekly digest, Hindi plan).

## 19. Clean-UI Pass — Green Backgrounds Removed App-Wide — 2026-09-03

After the splash went paper-ivory, the user asked for the same treatment everywhere: no green backgrounds, clean UI. The brand now reads ivory paper + ink + marigold/gold; forest green survives only inside the logo mark and chart data-viz strokes.

### What changed

- **One primary-button language app-wide**: every solid-green action (hero CTA, profile save, add reminder, analyze photo, history/insights start) is now the marigold-ink style the login screen always used — marigold fill, ink text, ink border, hard offset shadow.
- **Sidebar active pill**: deep-green pill → a cream card with antique-gold border and the ink hard-shadow (active item in ink text); auth/reports tab pills → brand-neutral ink.
- **Hero panel**: the last big green block became a paper card — ivory fill, ink headline, gold badge, marigold CTA, gold-tinted leaf watermark.
- **Chat**: user bubbles are deep ink with cream text (the paper twin of the bot bubble); send button ink; GPT badge, follow-up chips and quick-reply hovers all gold/cream.
- **Every light-green wash replaced**: selected filter/type chips, memory status, accepted-photo banner, digest tiles, stat tiles, session chip, avatars, sync chip, score tones and the completion bar all moved to the cream family with gold borders and deep-gold text; green text accents (icons, links, focus rings) became deep gold.
- **Beyond the screen**: the printable report's green table header/footer went cream/ink, and the PWA theme color (mobile status-bar tint) flipped from forest green to ivory.

### Verification

- Grep audits: zero green tokens left in UI code (logo tile + chart strokes are the intentional survivors).
- A computed-style scan across five sections: no element has a green-hued background (g > r+12 && g > b+12 test) — Home, Assistant, Insights, Reminders, Profile all clean; 0 console errors.
- Full suite re-run after hardening two timing races the pass exposed (history-delete DB-sync now polls; mobile sync-chip waits for loadAll): **122/122 flows, 19 axe states, 0 violations, 0 console errors**. One axe false-positive (mid-animation opacity sampling on the new 4.76:1 gold chips) fixed with the standard settle wait.
- Contrast math: deep gold on cream 4.54–4.76:1 (AA), ink bubble text 13:1+.
- Production build green; dev restarted; screenshots `clean-1…5`.

## 20. Phase 13 — The Assistant Gets a Brain — 2026-09-03

User: "bhai isko aur tagda bna bhai har akk chij aur tagdi kr". The previous rounds made the app *look* and *behave* like a companion; this round made it *think* like one. The biggest weakness left: follow-up chips re-ran generic triage — asking "is medicine needed for fever?" returned the same fever paragraph as the first question.

### What changed

**Intent-aware follow-ups (`lib/triage.js` → `assessWithIntent()`)** — chip questions first pass through the safety rules (red flags still override everything), then the intent is detected (homeCare / medicine / howLong / whenDoctor / prevent, with Hinglish + Devanagari phrasings: dava, दवा, kitne din, kaise bachu) and the answer comes from per-symptom knowledge tables: fever home-care = fluids/ORS/khichdi/lukewarm sponge; cough medicine = "viral — no antibiotics, ever"; tooth when-doctor = face swelling is same-day. The whenDoctor intent upgrades severity to high — the question itself signals a visit is being considered. Generic fallbacks keep every combination honest.

**Duration escalation** — "bukhar hai 4 din se" / "15 din se khansi" / "4 दिन से बुखार" now escalate to severity HIGH with a dedicated see-a-doctor-soon note, per-symptom limits (fever 3d, cough 14d, urinary/tooth 2d, generic 7d). Numbers parse as digits, English words, Hinglish words (teen/char/bees) and weeks/months.

**Four new symptom rules** — ear pain (kaan/कान), tooth/gum pain (दाँत, cavity), constipation (kabz/शौच), asthma (wheezing/सीटी/inhaler). One territorial boundary learned: "saans" phrases stay with the breathing RED FLAG (emergency override) — the asthma rule matches on wheeze/dama words instead.

**Activity streak (Home)** — `checkStreak()` pure function: consecutive days with a check-in, yesterday-friendly, 0 rendered as a fresh-start day (Sparkles), never a guilt tool.

**Date-aware Today's Plan** — 'today'/'tomorrow' reminders bind to calendar day (createdAt-anchored) instead of showing forever.

**Quick templates (Reminders)** — four one-tap chips (water 11:00, walk 18:30, medicine 21:00, sleep 22:30), daily, typed, i18n-following.

**Clean-UI continuity** — the low-severity chip was the last green-tinted semantic token (emerald); now amber like its siblings.

### Verification

- **40/40 unit tests** (`scripts/unit-phase13.mjs`): intent routing across all five intents, Hinglish spellings, severity upgrades, emergency-over-intent, escalation boundaries with controls, new rules, plan-date correctness across days, streak chains/gaps.
- Suite: **131/131 flows, 19 axe states, 0 violations, 0 console errors** — nine new flows, two updated count assertions.
- Three genuine catches during unit testing: missing `dava` spelling; `\b` never matches beside Devanagari (ASCII boundary — pattern rewritten); a test phrase colliding with the breathing red flag (the emergency verdict was *correct*).
- Production build green (231 kB first load); dev restarted on 3311. Screenshots `p13-1…5`.

### 20.1 Sticky Sidebar + Header — 2026-09-03

User: "left side wala sidebar fix kr right side vale ke sath move na ho" — the desktop sidebar scrolled away with the content. Fix: `lg:sticky lg:top-0 lg:h-screen` on the aside (flex child, no layout jump), the nav list gets its own `overflow-y-auto` for short viewports (brand header + privacy card stay pinned), and the header is now `sticky top-0` over its existing backdrop blur. Mobile drawer untouched (still `fixed`). Also caught the last green token from the de-greening pass: `:focus-visible` outline → gold. Verified with bounding-box assertions (sidebar rect identical after a 1200px scroll), a DOM-truth mobile drawer check (the first assertion used `isVisible()`, which stays true under transforms — the real signal is the bounding box), the full 131/131 suite with 0 violations / 0 console errors, a green production build, and screenshots `sticky-1-scrolled.png` / `sticky-2-mobile-drawer.png`.

## 21. Phase 14 — Truth, Offline & the ICE Card — 2026-09-09

User: "bhai to isko aur tagda kr". Three real gaps closed:

**Daily reminder reset** — the biggest honesty bug left: a daily reminder marked done stayed done forever (missing from tomorrow's plan, notifications never re-fire). Introduces `doneOn` (local date key): `rolloverDaily()` in lib/health.js runs on loadAll, returning stale-day completions to pending; the storage toggle writes today's key on done, clears it on undo, and a tap on a yesterday-done row marks TODAY done (not an accidental undo); the sync layer PATCHes `doneOn: null` on undo so no server row ever carries a stale marker; zod schemas validate the date shape. Server rows stay untouched — each device rolls over in its own timezone morning. Legacy boolean-only rows behave exactly as before.

**Offline PWA** — `public/sw.js`: navigations network-first with cached-shell fallback, static assets cache-first, `/api/*` network-first with writes never served from cache; offline API misses return `503 {dbDown:true}` — the exact signal the app's existing local-mode fallback understands. Registration is production-only (dev HMR vs precache is a stale-cache trap). PNG icons (192/512 + maskable) generated from the SVG logo make the manifest Android-installable.

**ICE emergency card** — one-tap print popup from the profile: wallet-size card with ink header, blood group and ALLERGIES as the loudest lines (what a responder scans first), conditions/meds/emergency contact, a `tel:` call row, auto-print, all values escaped, bilingual.

### Verification

- `scripts/unit-phase14.mjs` — **17/17** (rollover paths, toggle day-key paths with a localStorage shim, plan integration, i18n parity).
- Suite: **138/138 flows, 19 axe states, 0 violations, 0 console errors** (7 new: DB day-marker sync, yesterday-done reloads pending, undo leaves no stale marker, ICE popup ×4).
- **Offline E2E against the production build with a real service worker**: SW controls the page, an offline reload serves the app shell, offline triage answers "bukhar hai" with the local engine + an honest "Offline" flag, reminders render; the only console entries are the expected `ERR_INTERNET_DISCONNECTED` resource notes.
- Build green; dev restarted on 3311. Screenshots `p14-1…4`.
