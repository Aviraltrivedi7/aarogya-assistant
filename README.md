# 🩺 AarogyaGPT — Your AI Health Companion

AI-powered health guidance in **English and Hindi**. Symptom triage chat, health history, guided image analysis, nearby care search, reminders, bilingual health education — with a **real MongoDB backend** and an offline-first sync layer that keeps everything working even when the database is unreachable.

**Design:** Indian wellness identity — Ek Type fonts (Baloo 2 + Mukta), a clean ivory-paper + ink + marigold/gold palette with paper texture (forest green lives only in the logo mark and chart strokes). English and Hindi were designed together, not one translated into the other.

> ⚠️ **Medical disclaimer:** General guidance only, **not a diagnosis**. Always consult a qualified healthcare professional. In an emergency call **112** (India).

---

## Quick start

```bash
npm install

# 1. Start a local MongoDB (dev only — downloads a mongod binary on first run)
npm run dev:db

# 2. In another terminal, start the app pointed at it
MONGO_URL=mongodb://127.0.0.1:27017 DB_NAME=aarogya npm run dev
```

Open http://localhost:3000. The sidebar footer shows **"Cloud synced"** (gold) when the backend DB is reachable, or **"Saved on this device"** (amber) when the app is running on localStorage alone — both modes are fully functional.

Production (any MongoDB):

```bash
cp .env.example .env   # set MONGO_URL, DB_NAME, CORS_ORIGINS
npm run build && npm start
```

## Features

| Feature | What it does |
|---|---|
| 🎬 **Splash + Accounts** | Animated splash → login/signup (email + password, scrypt-hashed, HMAC tokens) → app. Your anonymous device data is claimed into the account on first login. "Continue as guest" keeps the no-account mode fully functional |
| 🗣️ **AI Assistant** | GPT-backed answers when `OPENAI_API_KEY` is set (JSON-mode triage: summary, severity, self-care, when-to-see-a-doctor — EN/HI/Hinglish), with the deterministic rule engine as the safety floor and offline fallback: red-flag emergencies can never be downgraded by the model, and if OpenAI fails the rule engine answers instantly. Voice input (speak your symptom, EN/HI) and read-aloud replies (auto-speak toggle + per-message button). After each answer, severity-aware follow-up chips suggest the next question in your language. Follow-ups keep conversation context (recent turns go with your question), and any reply can be copied or shared in one tap |
| 📄 **Health History** | Every check saved to MongoDB + device; search, severity filter, delete/clear, severity badges, printable report |
| 🖼️ **Image Analysis** | Symptom-photo gate: images are verified first (GPT vision when the API key is live, local skin-tone heuristic as fallback) — only close-up photos of skin/body get guidance; anything else gets a "share a symptom photo" notification. Photos never leave the device for storage (a 512px copy goes only for verification) |
| 🔍 **Nearby Care** | Real hospital/clinic/pharmacy search via server-side OpenStreetMap (Overpass) proxy with 3 mirror fallbacks + India emergency directory (112, 108, 104, 1091, 1098, 14416, 1930) |
| 📚 **Health Education** | 10 bilingual articles with search, plus a "Picked for you" strip suggested safely from the conditions in your profile (nothing fabricated — no match, no strip) |
| 📈 **Insights** | Health Score ring (0-100), 14-day severity trend chart, symptom-mix donut, reminder completion, weekly digest (last 7 days at a glance) and BMI with Asian-Indian thresholds (WHO consensus — risk rises earlier than the global chart) — computed from your own data (recharts, lazy-loaded) |
| 🖨️ **Printable Report** | One-tap doctor-ready health report from History (profile + all checks + disclaimer), opens print dialog |
| 🔔 **Reminders** | Full CRUD + 7 types (medicine/appointment/exercise/water/sleep/follow-up/custom), +10-min snooze, inline edit, browser-notification alerts (permission asked on click), cloud + device persistence. Home shows them as **Today’s Plan** — a live timeline with one-tap done, overdue highlighting and a progress counter |
| 👤 **Profile** | Complete health profile — name, age, gender, blood group, height, weight, conditions, allergies, medicines, emergency contact (one-tap call — and it also appears as a call button inside the emergency modal next to 112) — synced to the cloud |
| 🧠 **Health Memory** | Consent-gated AI personalisation: turn it on and the assistant sends your profile context (age, conditions, allergies, medicines) with your question for tailored guidance. Off by default — nothing is shared until you switch it on, and turning it off stops use instantly |
| 🔐 **Privacy Controls** | Export all your data as a JSON download, delete health history, delete account (wipes the login + every health record under it). Guest mode keeps everything device-only |
| 📱 **PWA — works offline** | Service worker caches the app shell: install it, turn the internet off, and the app still boots — triage answers from the on-device engine, reminders render, sync resumes when back online. Manifest with PNG icons (any + maskable) — installable on Android/desktop |
| 🌱 **Tip of the Day** | A new practical wellness tip every day from a 12-tip bilingual pool (hydration, sleep, salt sense, morning sunlight, 20-20-20 eyes…) — date-seeded, same tip all day, fresh one tomorrow, in both languages |
| 🌐 **Full EN/HI i18n** | Every string translated, preference persisted — and switching re-renders the assistant conversation too: chat replies, results, follow-up chips and emergency cards flip live into the newly selected language |

## Backend API

All endpoints live under `/api` (single catch-all route with zod validation + rate limiting). Anonymous device identity travels in the `X-User-Id` header — privacy-first, no accounts.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Service + DB status (no auth) |
| POST | `/api/auth/signup` | Create account (scrypt-hashed password) |
| POST | `/api/auth/login` | Log in → bearer token (HMAC, 30 days) |
| POST | `/api/auth/claim` | Move anonymous device data into the account |
| DELETE | `/api/auth/account` | Delete account + all its health data (bearer auth) |
| POST | `/api/assistant` | Server-side symptom triage |
| GET/POST | `/api/checks` | List / save health checks |
| DELETE | `/api/checks` · `/api/checks/:id` | Clear all / delete one |
| GET/POST | `/api/reminders` | List / upsert reminders |
| PATCH/DELETE | `/api/reminders/:id` | Partial edit (title/time/when/type/done — snooze + edit) / delete |
| GET/PUT | `/api/profile` | Read / upsert profile |
| GET | `/api/nearby?lat=&lon=` | Overpass proxy (hospitals/clinics/pharmacies ≤3 km) |
| POST/GET | `/api/status` | Platform template (kept for compatibility) |

## Architecture

```
app/
├── page.js                    Shell: nav, header, sync-mode chip, emergency modal
├── api/[[...path]]/route.js   Backend router (zod, rate limit, 503-on-db-down)
└── layout.js · globals.css · icon.svg
components/sections/           9 feature sections (Home, Assistant, History, Insights,
                               Images, Nearby, Education, Reminders, Profile)
lib/
├── sync.js                    Offline-first sync: server-first, localStorage mirror,
│                              merge-by-id on load, back-sync of offline items
├── server/db.js               Lazy Mongo connection + indexes + graceful degrade
├── triage.js                  Triage engine (shared client/server)
├── i18n.js                    EN/HI dictionary + makeT()
└── storage.js                 Pure localStorage layer
scripts/dev-mongo.cjs          In-memory MongoDB for local development
```

**Sync behaviour:** reads try the API first; writes mirror to localStorage immediately and push to the server in the background. On load, server and device data are merged by id and offline-created items are back-synced. If the DB is unreachable the API answers `503 {dbDown:true}` and the client switches to device-only mode — no feature ever breaks.

## Verification

- **axe-core 4.10.2**: 0 accessibility violations across 19 audited states (splash, login, signup, WCAG AA contrast, labelled controls, focus trap modal, accessible charts, reduced-motion support)
- **Playwright E2E**: 138 functional + backend flows green (incl. photo-gate accept/reject, splash/auth flows, signup → app, session restore, account data partition, insights charts, print report, MongoDB persistence, history search/filter, reminder snooze/edit/notifications, profile vitals, memory consent flag in DB, privacy export/clear, account deletion end-to-end, voice controls, follow-up chips topic-send, date-seeded tip, personal emergency-contact call, Today's Plan one-tap done + DB sync, BMI Asian band, weekly digest, conversation-history request shape, intent-aware follow-up answers, duration escalation, activity streak, reminder quick templates, daily reminder rollover, ICE emergency card popup), 0 console errors
- `npm run build` passes; security headers verified live (CSP, nosniff, Referrer-Policy, Permissions-Policy)

See [REPORT.md](./REPORT.md) for the full before/after analysis.
