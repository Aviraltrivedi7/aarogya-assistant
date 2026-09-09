'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Activity, AlertTriangle, ArrowUpRight, Bell, ChevronDown, CircleHelp,
  FileText, FlaskConical, Home, Languages, LogOut, Menu, MessageCircle, PhoneCall,
  Search, ShieldCheck, TrendingUp, UserRound, X, Zap,
} from 'lucide-react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'

import { LANGUAGES, makeT } from '@/lib/i18n'
import { DEFAULT_PROFILE } from '@/lib/storage'
import * as store from '@/lib/storage'
import * as sync from '@/lib/sync'
import { getSession, clearSession as clearAuthSession } from '@/lib/auth-client'
import { SplashGate } from '@/components/SplashGate'
import { LogoMark } from '@/components/LogoMark'
import { HomeSection } from '@/components/sections/HomeSection'
import { AssistantSection } from '@/components/sections/AssistantSection'
import { HistorySection } from '@/components/sections/HistorySection'
import { ImageSection } from '@/components/sections/ImageSection'
import { NearbySection } from '@/components/sections/NearbySection'
import { EducationSection } from '@/components/sections/EducationSection'
import { RemindersSection } from '@/components/sections/RemindersSection'
import { ProfileSection } from '@/components/sections/ProfileSection'

// recharts + pdf.js are heavy — load the Insights and Reports sections
// only when they're opened.
const InsightsSection = dynamic(() => import('@/components/sections/InsightsSection').then((m) => m.InsightsSection))
const ReportsSection = dynamic(() => import('@/components/sections/ReportsSection').then((m) => m.ReportsSection))

const NAV = [
  ['home', Home],
  ['assistant', MessageCircle],
  ['history', FileText],
  ['images', Activity],
  ['reports', FlaskConical],
  ['nearby', Search],
  ['education', CircleHelp],
  ['reminders', Bell],
  ['insights', TrendingUp],
]

export default function App() {
  const [section, setSection] = useState('home')
  const [lang, setLang] = useState('en')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [history, setHistory] = useState([])
  const [reminders, setReminders] = useState([])
  const [syncMode, setSyncMode] = useState('local')
  // 'checking' → splash/auth/app — decided after mount so SSR stays safe.
  const [gate, setGate] = useState('checking')
  const [session, setSession] = useState(null)
  const mainRef = useRef(null)

  const t = makeT(lang)

  // Boot: decide splash vs auth vs app, then hydrate data. The splash gate
  // runs once per device — returning visitors go straight in.
  useEffect(() => {
    setLang(store.getLang())
    const existing = getSession()
    if (existing) {
      setSession({ email: existing.email, name: existing.name })
      setGate(localStorage.getItem('aarogya.splashed') === '1' ? 'app' : 'splash')
    } else {
      setGate(localStorage.getItem('aarogya.splashed') === '1' ? 'auth' : 'splash')
    }
  }, [])

  // Entering the app from the auth screen (login, signup or guest) —
  // data loads under the now-active identity via the effect below.
  const enterApp = useCallback((account) => {
    try { window.localStorage.setItem('aarogya.splashed', '1') } catch {}
    if (account) setSession({ email: account.email || '', name: account.name || '' })
    setGate('app')
  }, [])

  // Splash → next screen. A saved session skips auth; everyone else lands
  // on the auth card. Also marks the splash as seen for future visits.
  const onSplashDone = useCallback(() => {
    try { window.localStorage.setItem('aarogya.splashed', '1') } catch {}
    setGate(getSession() ? 'app' : 'auth')
  }, [])

  const logout = useCallback(() => {
    clearAuthSession()
    setSession(null)
    try { window.localStorage.setItem('aarogya.splashed', '1') } catch {}
    setGate('auth')
    toast(lang === 'hi' ? 'लॉग आउट हो गया' : 'Logged out', { icon: '👋' })
  }, [lang])

  // Once inside the app (login, signup, guest or restored session), wire
  // the sync mode and hydrate data under the active identity.
  useEffect(() => {
    if (gate !== 'app') return
    try { window.localStorage.setItem('aarogya.splashed', '1') } catch {}
    const unsubscribe = sync.subscribeToMode(setSyncMode)
    sync.loadAll().then(({ history: h, reminders: r, profile: p }) => {
      setHistory(h)
      setReminders(r)
      setProfile(p)
    })
    return () => unsubscribe()
  }, [gate])

  const go = useCallback((next) => {
    setSection(next)
    setMobileOpen(false)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
    requestAnimationFrame(() => mainRef.current?.focus())
  }, [])

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === 'en' ? 'hi' : 'en'
      store.setLang(next)
      return next
    })
  }, [])

  const onNewCheck = useCallback((item) => setHistory((prev) => [item, ...prev]), [])
  const onRemindersChange = useCallback((list) => setReminders(list), [])
  // One-tap done/undo from the Home plan — the sync layer owns the
  // doneOn-day marker + server mirror and returns the fresh list, so the
  // plan, the bell and the reminders section all update on the same truth
  // (a yesterday-done daily tapped today must mark TODAY done, not undo).
  const onToggleReminder = useCallback((id) => {
    setReminders(sync.toggleReminder(id))
  }, [])
  const onProfileSaved = useCallback((p) => setProfile(p), [])
  const onHistoryCleared = useCallback(() => setHistory([]), [])
  const onAccountDeleted = useCallback(() => {
    setSession(null)
    setProfile(DEFAULT_PROFILE)
    setHistory([])
    setReminders([])
    setGate('auth')
  }, [])

  // ── Reminder alerts ─────────────────────────────────────────────
  // Fires a browser notification for any pending reminder whose time
  // just passed (checked once a minute; notification permission is
  // requested only from the Reminders section's own button). Works
  // while a tab is open — the notification-ready architecture for a
  // future service worker.
  useEffect(() => {
    if (gate !== 'app') return
    const fired = new Set()
    const tick = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      for (const r of reminders) {
        if (r.done || r.time !== hhmm || fired.has(`${r.id}:${hhmm}`)) continue
        fired.add(`${r.id}:${hhmm}`)
        try { new Notification('AarogyaGPT', { body: r.title, tag: r.id }) } catch {}
      }
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [gate, reminders])

  const pendingReminders = reminders.filter((r) => !r.done).length

  const closeEmergency = useCallback(() => setEmergencyOpen(false), [])

  // ── Splash / auth gate ──
  if (gate !== 'app') {
    if (gate === 'checking') return null
    return (
      <MotionConfig reducedMotion="user">
        <div className="min-h-screen bg-[#f5f0e3] text-stone-900">
          <SplashGate lang={lang} onToggleLang={toggleLang} onDone={enterApp} onSplashDone={onSplashDone} t={t} />
        </div>
      </MotionConfig>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen text-stone-900">
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-xl bg-[#0f241a] px-4 py-2 text-sm font-bold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {lang === 'hi' ? 'मुख्य सामग्री पर जाएँ' : 'Skip to main content'}
      </a>
      <div className="flex min-h-screen">
        {/* ── Sidebar ── */}
        <aside
          aria-label={lang === 'hi' ? 'मुख्य नेविगेशन' : 'Main navigation'}
          className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 flex w-[282px] flex-col border-r border-stone-200/70 bg-[#fffdf7] px-5 py-6 text-[#26251c] shadow-2xl shadow-stone-900/25 transition-transform lg:sticky lg:top-0 lg:bottom-auto lg:h-screen lg:translate-x-0`}
        >
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <LogoMark size={44} data-testid="brand-logo" />
              <div>
                <p className="font-display text-[17px] font-extrabold tracking-tight">
                  Aarogya<span className="text-[#8a6215]">GPT</span>
                </p>
                <p className="text-[11px] text-stone-600">{t('brand.tagline')}</p>
              </div>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              data-testid="sidebar-close"
              aria-label={t('close')}
                className="rounded-xl p-2 text-stone-500 hover:bg-stone-100 lg:hidden"
            >
              <X size={19} aria-hidden="true" />
            </button>
          </div>

          {/* The nav list is the only part that yields when the viewport is
              short — brand header and the privacy card stay pinned, the
              warm global scrollbar keeps it on-theme. */}
          <nav className="mt-10 min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-600">{t('workspace')}</p>
            <ul className="space-y-1">
              {NAV.map(([key, Icon]) => {
                const active = section === key
                return (
                <li key={key}>
                  <button
                    onClick={() => go(key)}
                    data-testid={`nav-${key}`}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition ${active ? 'text-[#26251c]' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'}`}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-active-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className="absolute inset-0 rounded-xl border-2 border-[#b8974f] bg-[#fffdf7] shadow-[3px_3px_0_0_#0f241a]"
                        aria-hidden="true"
                      />
                    )}
                    <span className="relative z-10 flex min-h-11 w-full items-center gap-3">
                      <Icon size={18} aria-hidden="true" />
                      {t(`nav.${key}`)}
                      {key === 'reminders' && pendingReminders > 0 && (
                        <span className={`ml-auto rounded-md px-2 py-0.5 text-[11px] font-bold ${active ? 'bg-[#eda33c] text-[#26251c]' : 'bg-[#f4e9d2] text-[#8a6215]'}`}>
                          {pendingReminders}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
                )
              })}
            </ul>

            <div className="mt-8 border-t border-stone-200/90 pt-6">
              <button
                onClick={() => go('profile')}
                data-testid="nav-profile"
                aria-current={section === 'profile' ? 'page' : undefined}
                className={`relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition ${section === 'profile' ? 'text-[#26251c]' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'}`}
              >
                {section === 'profile' && (
                  <motion.span layoutId="nav-active-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-xl border-2 border-[#b8974f] bg-[#fffdf7] shadow-[3px_3px_0_0_#0f241a]" aria-hidden="true" />
                )}
                <UserRound size={18} aria-hidden="true" />
                {t('profile')}
              </button>
              <button
                onClick={() => setEmergencyOpen(true)}
                data-testid="emergency-open"
                className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-3 text-[13px] font-bold text-red-700 transition hover:bg-red-100"
              >
                <AlertTriangle size={18} aria-hidden="true" />
                {t('emergencyHelp')}
                <ArrowUpRight className="ml-auto" size={17} aria-hidden="true" />
              </button>
              {session?.email && (
                <button
                  onClick={logout}
                  data-testid="sidebar-logout"
                  className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-[13px] font-semibold text-stone-600 transition hover:bg-stone-100 hover:text-red-700 lg:hidden"
                >
                  <LogOut size={18} aria-hidden="true" />
                  <span className="truncate">{t('auth.logout')} · {session.name || session.email}</span>
                </button>
              )}
            </div>
          </nav>

          <div className="mt-4 shrink-0 rounded-2xl border border-stone-200/90 bg-[#faf6ec] p-4">
            <div className="flex items-start gap-2">
              <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#8a6215]" aria-hidden="true" />
              <p className="text-[11px] leading-5 text-stone-600">
                <strong className="text-stone-900">{t('privacyNote')}</strong>
                <br />
                {t('privacyNote2')}
              </p>
            </div>
            <div className={`mt-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${syncMode === 'cloud' ? 'bg-[#f4e9d2] text-[#8a6215]' : 'bg-amber-100 text-amber-800'}`} data-testid="sync-mode" role="status">
              <span className={`h-2 w-2 rounded-full ${syncMode === 'cloud' ? 'bg-[#eda33c]' : 'bg-amber-500'}`} aria-hidden="true" />
              {syncMode === 'cloud' ? t('sync.synced') : t('sync.local')}
            </div>
          </div>
        </aside>

        {/* ── Main column ── */}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-stone-200/80 bg-[#faf6ec]/90 px-5 backdrop-blur-xl md:px-10">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                data-testid="menu-open"
                aria-label={lang === 'hi' ? 'मेनू खोलें' : 'Open menu'}
                className="rounded-xl p-2 text-stone-600 hover:bg-stone-100 lg:hidden"
              >
                <Menu size={22} aria-hidden="true" />
              </button>
              <div className="hidden items-center gap-2 text-xs font-bold text-stone-600 md:flex">
                <span className="h-2 w-2 rounded-full bg-[#eda33c]" aria-hidden="true" />
                {t('personalSpace')}
                <span className="text-stone-300" aria-hidden="true">/</span>
                {section === 'home' ? (lang === 'hi' ? 'अवलोकन' : 'Overview') : t(section === 'profile' ? 'profile' : `nav.${section}`)}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleLang}
                data-testid="lang-toggle"
                aria-label={`${t('languageSwitch')} — ${lang === 'en' ? 'English' : 'हिन्दी'}`}
                className="flex h-10 items-center gap-2 rounded-xl border border-stone-200 bg-[#faf6ec] px-3 text-xs font-bold text-stone-700 shadow-sm hover:border-[#b8974f]"
              >
                <Languages size={16} className="text-[#8a6215]" aria-hidden="true" />
                <span aria-hidden="true">{lang === 'en' ? 'EN' : 'HI'}</span>
                <ChevronDown size={13} aria-hidden="true" />
              </button>
              <button
                onClick={() => go('reminders')}
                data-testid="bell"
                aria-label={`${t('manageReminders')}${pendingReminders > 0 ? ` (${pendingReminders})` : ''}`}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-[#faf6ec] text-stone-600 shadow-sm hover:border-[#b8974f]"
              >
                <Bell size={18} aria-hidden="true" />
                {pendingReminders > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />}
              </button>
              <div className="hidden h-8 w-px bg-stone-200 sm:block" aria-hidden="true" />
              {session?.email ? (
                <div
                  className="hidden items-center gap-2.5 rounded-xl border border-[#b8974f]/60 bg-[#f4efdf] px-3 py-1.5 md:flex"
                  data-testid="session-chip"
                  title={`${t('auth.loggedInAs')} ${session.email}`}
                >
                  <button
                    onClick={() => go('profile')}
                    aria-label={t('profile')}
                    className="flex items-center gap-2.5"
                    data-testid="header-profile"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0f241a] text-[11px] font-extrabold text-[#f5f0e3]">
                      {initials(session.name || session.email, t('initialsFallback'))}
                    </span>
                    <span className="max-w-[160px] truncate text-xs font-bold text-stone-900">
                      {session.name || session.email}
                    </span>
                  </button>
                  <button
                    onClick={logout}
                    data-testid="logout"
                    aria-label={t('auth.logout')}
                    className="flex h-7 items-center gap-1.5 rounded-lg border-2 border-stone-200 bg-[#fffdf7] px-2.5 text-[11px] font-bold text-stone-600 transition hover:border-red-200 hover:text-red-700"
                  >
                    <LogOut size={13} aria-hidden="true" />
                    {t('auth.logout')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => go('profile')}
                  data-testid="header-profile"
                  aria-label={t('profile')}
                  className="flex items-center gap-2 rounded-xl p-1 hover:bg-stone-100"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f4e9d2] text-xs font-extrabold text-[#8a6215] ring-4 ring-[#efe9d8]">
                    {initials(profile.name, t('initialsFallback'))}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-xs font-bold text-stone-700">{profile.name?.trim() || (lang === 'hi' ? 'अतिथि' : 'Guest')}</span>
                    <span className="mt-0.5 block text-[11px] text-stone-600">
                      {t('memberSince')} {profile.memberSince}
                    </span>
                  </span>
                </button>
              )}
            </div>
          </header>

          <main
            id="main-content"
            ref={mainRef}
            tabIndex={-1}
            data-testid="main-content"
            className="mx-auto max-w-[1480px] px-5 py-7 outline-none md:px-10 md:py-9"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={section}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
            {section === 'home' && (
              <HomeSection t={t} lang={lang} profile={profile} history={history} reminders={reminders} go={go} openEmergency={() => setEmergencyOpen(true)} onToggleReminder={onToggleReminder} />
            )}
            {section === 'assistant' && <AssistantSection t={t} lang={lang} onNewCheck={onNewCheck} openEmergency={() => setEmergencyOpen(true)} />}
            {section === 'history' && <HistorySection t={t} lang={lang} history={history} setHistory={setHistory} go={go} profile={profile} />}
            {section === 'images' && <ImageSection t={t} lang={lang} />}
            {section === 'reports' && <ReportsSection t={t} lang={lang} />}
            {section === 'nearby' && <NearbySection t={t} lang={lang} />}
            {section === 'education' && <EducationSection t={t} lang={lang} profile={profile} />}
            {section === 'reminders' && <RemindersSection t={t} lang={lang} reminders={reminders} onChange={onRemindersChange} />}
            {section === 'insights' && <InsightsSection t={t} lang={lang} history={history} reminders={reminders} profile={profile} go={go} />}
            {section === 'profile' && (
              <ProfileSection
                t={t}
                lang={lang}
                profile={profile}
                onSaved={onProfileSaved}
                session={session}
                onHistoryCleared={onHistoryCleared}
                onAccountDeleted={onAccountDeleted}
              />
            )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      <AnimatePresence>
        {emergencyOpen && (
          <EmergencyModal key="emergency" t={t} lang={lang} profile={profile} onClose={closeEmergency} onFindHospital={() => { closeEmergency(); go('nearby') }} />
        )}
      </AnimatePresence>
      <Toaster
        position="top-center"
        toastOptions={{
          // Dark navy toast with light text keeps contrast well above WCAG AA.
          style: { background: '#26251c', color: '#f5f0e3', fontWeight: 600 },
        }}
      />
    </div>
    </MotionConfig>
  )
}

function initials(name, fallback) {
  const trimmed = (name || '').trim()
  if (!trimmed) return fallback
  return trimmed.split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

function EmergencyModal({ t, lang, onClose, onFindHospital, profile }) {
  const dialogRef = useRef(null)
  const dirWas = useRef(null)

  useEffect(() => {
    dirWas.current = document.activeElement
    dialogRef.current?.focus()
    return () => dirWas.current?.focus?.()
  }, [])

  // Emergency contact from the profile — anything with a 8+ digit number
  // counts; the whole saved line (name · number) shows on the button.
  const rawContact = typeof profile?.emergencyContact === 'string' ? profile.emergencyContact.trim() : ''
  const phoneMatch = rawContact.match(/\+?\d[\d\s-]{7,15}/)
  const phone = phoneMatch ? phoneMatch[0].replace(/[\s-]/g, '') : ''

  const onKeyDown = (e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Tab') {
      const focusables = dialogRef.current.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="emergency-title"
        data-testid="emergency-modal"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl outline-none md:p-8"
      >
        <div className="flex justify-end">
          <button onClick={onClose} data-testid="emergency-close" aria-label={t('close')} className="rounded-lg p-2 text-stone-600 hover:bg-stone-100">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
          <AlertTriangle size={28} aria-hidden="true" />
        </div>
        <h2 id="emergency-title" className="mt-5 text-center text-2xl font-bold text-stone-900">{t('emergencyTitle')}</h2>
        <p className="mt-2 text-center text-sm leading-6 text-stone-600">{t('emergencyBody')}</p>

        <div className="mt-6 space-y-3">
          <a
            href="tel:112"
            data-testid="call-112"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-bold text-white hover:bg-red-700"
          >
            <PhoneCall size={18} aria-hidden="true" />
            {t('callEmergency')}
          </a>
          <button
            onClick={onFindHospital}
            data-testid="emergency-find-hospital"
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-stone-200 text-sm font-bold text-stone-700 hover:bg-[#f2ecdd]"
          >
            <Search size={18} aria-hidden="true" />
            {t('findHospital')}
          </button>
          {phone && (
            <a
              href={`tel:${phone}`}
              data-testid="call-my-contact"
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-sm font-bold text-red-800 hover:bg-red-100"
            >
              <PhoneCall size={18} aria-hidden="true" />
              <span className="truncate">
                {t('callMyContact')}
                <span className="ml-1 font-semibold" data-testid="call-my-contact-name">{rawContact}</span>
              </span>
            </a>
          )}
        </div>

        {!phone && (
          <p className="mt-3 text-center text-[11px] leading-4 text-stone-600" data-testid="no-contact-note">{t('noContactSet')}</p>
        )}

        <div className="mt-6 rounded-xl bg-red-50 p-4 text-xs leading-5 text-red-800">
          <strong>{t('emergencySigns')}</strong> {t('emergencySignsList')}
        </div>

        <h3 className="mt-6 text-sm font-bold text-stone-900">{t('emergencyDirTitle')}</h3>
        <p className="mb-3 mt-1 text-[11px] text-stone-600">{t('emergencyDirSub')}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {t('emergencyDir').map((entry, i) => (
            <li key={entry.label}>
              <a
                href={`tel:${entry.label.split('·')[1]?.trim() || '112'}`}
                data-testid={`emergency-dir-${i}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-[#faf6ec] px-3 py-2.5 text-xs font-bold text-stone-800 hover:border-red-200 hover:bg-red-50"
              >
                <span>
                  {entry.label}
                  <span className="mt-0.5 block text-[11px] font-medium text-stone-600">{entry.hint}</span>
                </span>
                <PhoneCall size={15} className="shrink-0 text-red-600" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  )
}
