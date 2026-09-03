'use client'

import { motion } from 'framer-motion'

import {
  Activity, AlertTriangle, ArrowRight, ArrowUpRight, Bell, CalendarDays,
  CheckCircle2, Clock3, Dumbbell, FileText, Flame, GlassWater, Leaf, Moon, Pill,
  Plus, Search, ShieldCheck, Sparkles, Stethoscope, Sun, Tag, Undo2,
} from 'lucide-react'

import { severityMeta } from '@/lib/triage'
import { planForToday, checkStreak } from '@/lib/health'

// Mirrors RemindersSection's type chips so the plan timeline speaks the
// same visual language as the reminders section.
const TYPE_ICONS = {
  medication: Pill,
  appointment: Stethoscope,
  exercise: Dumbbell,
  water: GlassWater,
  sleep: Moon,
  followup: Undo2,
  other: Tag,
}

// Node without full-ICU silently falls back to English for hi-IN dates,
// which causes hydration mismatches with the browser. Try the Hindi locale
// and fall back to en-IN when it doesn't actually localize.
function localeOf(lang) {
  if (typeof Intl === 'undefined' || !Intl.DateTimeFormat.supportedLocalesOf('hi-IN').length) return 'en-IN'
  return lang === 'hi' ? 'hi-IN' : 'en-IN'
}

function formatDate(iso, lang) {
  const d = new Date(iso)
  const loc = localeOf(lang)
  return d.toLocaleDateString(loc, { day: 'numeric', month: 'short' }) +
    ', ' + d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' })
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}
const riseIn = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}

export function HomeSection({ t, lang, profile, history, reminders, go, openEmergency, onToggleReminder }) {
  const today = new Date().toLocaleDateString(localeOf(lang), { weekday: 'long', day: 'numeric', month: 'long' })
  const name = profile.name?.trim() || (lang === 'hi' ? 'अतिथि' : 'Guest')
  const recentChecks = history.slice(0, 3)
  const remindersDone = reminders.filter((r) => r.done).length
  const daysWithUs = Math.max(1, Math.ceil((Date.now() - new Date(`${profile.memberSince || new Date().getFullYear()}-01-01`).getTime()) / 86400000))
  const tipPool = t('tipPool')
  const dailyTip = tipPool[Math.floor(Date.now() / 86400000) % tipPool.length]
  // Today's plan: due-today reminders as a live timeline — overdue first,
  // pending by time, done struck through at the bottom.
  const plan = planForToday(reminders)
  const planDoneCount = plan.filter((r) => r.done).length
  const planPending = plan.length - planDoneCount
  // Greeting follows the clock (all three render "Namaste" — the brand
  // word — but each key exists so a locale can vary them later).
  const hour = new Date().getHours()
  const greetingKey = hour < 12 ? 'greetingMorning' : hour < 17 ? 'greetingAfternoon' : 'greetingEvening'
  // Streak: consecutive days with a check-in (yesterday-friendly).
  const streak = checkStreak(history)

  // Hero CTA already opens the symptom check, so the quick-action grid
  // starts from image analysis — no duplicate destination.
  const actions = [
    { title: t('actions.imageTitle'), copy: t('actions.imageDesc'), Icon: Activity, tone: 'bg-[#f4e9d2] text-[#8a6215]', target: 'images', testId: 'action-image' },
    { title: t('actions.nearbyTitle'), copy: t('actions.nearbyDesc'), Icon: Search, tone: 'bg-[#e7e0d4] text-[#5f5544]', target: 'nearby', testId: 'action-nearby' },
    { title: t('actions.emergencyTitle'), copy: t('actions.emergencyDesc'), Icon: AlertTriangle, tone: 'bg-[#f6dede] text-[#8f3232]', target: 'emergency', testId: 'action-emergency' },
  ]

  const stats = [
    { value: history.length, label: t('statChecks'), Icon: FileText, tone: 'text-[#8a6215] bg-[#f4e9d2]' },
    { value: remindersDone, label: t('statRemindersDone'), Icon: CheckCircle2, tone: 'text-[#8a6215] bg-[#f4e9d2]' },
    { value: daysWithUs, label: t('statDays'), Icon: Sun, tone: 'text-[#8a6215] bg-[#f4e9d2]' },
  ]

  return (
    <div className="space-y-6" data-testid="section-home">
      {/* Greeting — quiet, like a journal heading */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <motion.div variants={riseIn}>
          <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-stone-600">
            <Leaf size={14} className="text-[#8a6215]" aria-hidden="true" />
            <time suppressHydrationWarning>{today}</time>
          </p>
          <h1 className="font-display text-3xl font-bold text-stone-900 md:text-[42px]" suppressHydrationWarning>
            {t(greetingKey)}, {name}
          </h1>
          <p className="mt-2 text-[15px] text-stone-600">{t('greetingSub')}</p>
        </motion.div>
        <div className="flex flex-col items-start gap-2.5 sm:items-end">
          <motion.div variants={riseIn} className="flex w-fit items-center gap-2 rounded-full border border-[#b8974f]/50 bg-[#f4efdf] px-4 py-2 text-xs font-bold text-[#8a6215]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#eda33c]" aria-hidden="true" />
            {t('allSystems')}
          </motion.div>
          {/* Streak — consecutive check-in days. 0 is a fresh-start day,
              never a scolding. */}
          <motion.div
            variants={riseIn}
            data-testid="home-streak"
            title={t('streakSub')}
            className="flex w-fit items-center gap-2.5 rounded-2xl border border-stone-200 bg-[#fffdf7] px-4 py-2.5 shadow-sm"
          >
            <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${streak > 0 ? 'bg-[#f4e9d2] text-[#8a6215]' : 'bg-stone-100 text-stone-500'}`} aria-hidden="true">
              {streak > 0 ? <Flame size={16} /> : <Sparkles size={16} />}
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold text-stone-900">
                {streak} {t(streak === 1 ? 'streakDay' : 'streakDays')}
                <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-[#8a6215]">{t('streakTitle')}</span>
              </span>
              <span className="block text-[10px] text-stone-600">{streak > 0 ? t('streakKeep') : t('streakStart')}</span>
            </span>
          </motion.div>
        </div>
      </motion.div>

      {/* Wellness snapshot — ink numbers on paper */}
      <motion.section
        variants={stagger}
        initial="hidden"
        animate="show"
        aria-labelledby="wellness-h"
        className="grid grid-cols-3 gap-3"
        data-testid="wellness-stats"
      >
        {stats.map(({ value, label, Icon, tone }) => (
          <motion.div
            key={label}
            variants={riseIn}
            className="flex items-center gap-3 rounded-2xl border border-stone-200/90 bg-[#faf6ec] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${tone}`}>
              <Icon size={19} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="font-display block text-xl font-bold leading-none text-stone-900">{value}</span>
              <span className="mt-1 block truncate text-[11px] font-semibold text-stone-600">{label}</span>
            </span>
          </motion.div>
        ))}
      </motion.section>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Hero — a paper panel on the journal: ink text, gold badge,
              marigold CTA. Solid ink border + layered Leaf silhouette
              instead of glassy gradients. */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="relative overflow-hidden rounded-[26px] border-2 border-[#0f241a] bg-[#fffdf7] p-7 text-stone-900 shadow-[6px_6px_0_0_#0f241a] md:p-9"
          >
            <Leaf className="pointer-events-none absolute -bottom-10 -right-6 rotate-[-14deg] text-[#b8974f]/20" size={220} strokeWidth={1.1} aria-hidden="true" />
            <div className="relative z-10 max-w-[590px]">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#b8974f]/60 bg-[#f4e9d2] px-3 py-1.5 text-[12px] font-bold text-[#8a6215]">
                {t('heroBadge')}
              </p>
              <h2 className="font-display text-[28px] font-bold leading-[1.15] text-stone-900 md:text-[36px]">{t('heroTitle')}</h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-stone-600">{t('heroBody')}</p>
              <button
                onClick={() => go('assistant')}
                data-testid="hero-cta"
                className="mt-7 flex min-h-11 items-center gap-2 rounded-xl border-2 border-[#0f241a] bg-[#eda33c] px-5 text-sm font-extrabold text-[#26251c] shadow-[4px_4px_0_0_#0f241a] transition hover:-translate-y-0.5 hover:bg-[#f2c063]"
              >
                {t('heroCta')}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </div>
            <div className="relative z-10 mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-stone-200 pt-4 text-[11px] font-semibold text-stone-600">
              <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-[#8a6215]" aria-hidden="true" />{t('heroPrivate')}</span>
              <span className="flex items-center gap-1.5" aria-hidden="true">{t('heroBilingual')}</span>
              <span className="flex items-center gap-1.5" aria-hidden="true">{t('heroAlways')}</span>
            </div>
          </motion.div>

          {/* Action cards */}
          <motion.div variants={stagger} initial="hidden" animate="show">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight">{t('nextSteps')}</h2>
                <p className="mt-1 text-sm text-stone-600">{t('nextStepsSub')}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {actions.map(({ title, copy, Icon, tone, target, testId }) => (
                <motion.button
                  key={title}
                  variants={riseIn}
                  whileHover={{ y: -4 }}
                  onClick={() => (target === 'emergency' ? openEmergency() : go(target))}
                  data-testid={testId}
                  className="group flex min-h-[136px] items-start gap-4 rounded-2xl border border-stone-200/90 bg-[#faf6ec] p-5 text-left shadow-sm transition hover:border-[#b8974f] hover:shadow-md"
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${tone}`}>
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{title}</span>
                    <span className="mt-1 block text-xs leading-5 text-stone-600">{copy}</span>
                    <span className="mt-4 inline-flex items-center text-[11px] font-bold text-[#8a6215] opacity-0 transition group-hover:opacity-100">
                      {t('actions.explore')}
                      <ArrowUpRight className="ml-1" size={13} aria-hidden="true" />
                    </span>
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Tip of the day — a paper note pinned to the journal */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-4 rounded-2xl border border-[#e0cfa4] bg-[#f8efdb] p-5"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#e0cfa4] bg-[#faf6ec] text-[#8a6215]">
              <Sun size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#8a6215]">{t('tipLabel')}</p>
              <p className="mt-1 text-sm font-bold" data-testid="home-tip-title">{dailyTip.title}</p>
              <p className="mt-1 text-xs leading-5 text-stone-600" data-testid="home-tip-body">{dailyTip.body}</p>
            </div>
          </motion.div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Recent checks */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border border-stone-200/90 bg-[#faf6ec] p-5 shadow-sm"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold tracking-tight">{t('recentChecks')}</h2>
                <p className="mt-1 text-xs text-stone-600">{t('recentChecksSub')}</p>
              </div>
            </div>
            {recentChecks.length === 0 ? (
              <p className="rounded-xl bg-[#f1ebdc] p-3 text-xs leading-5 text-stone-600">{t('historyEmpty')}</p>
            ) : (
              <ul className="space-y-4">
                {recentChecks.map((c, i) => {
                  const meta = severityMeta[c.severity] || severityMeta.low
                  return (
                    <motion.li
                      key={c.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.2 + i * 0.08 }}
                      className="flex items-center gap-3"
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{c.summary || c.text}</p>
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-stone-600">
                          <Clock3 size={12} aria-hidden="true" />
                          {formatDate(c.createdAt, lang)}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.bg} ${meta.text}`}>{t(`severity.${c.severity}`)}</span>
                    </motion.li>
                  )
                })}
              </ul>
            )}
            <button onClick={() => go('history')} data-testid="home-view-history" className="mt-5 w-full rounded-xl border border-stone-200 py-2.5 text-xs font-bold text-[#8a6215] hover:bg-[#f4efdf]">
              {t('viewHistory')}
            </button>
          </motion.div>

          {/* Today's plan — live timeline of today's reminders */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border border-stone-200/90 bg-[#faf6ec] p-5 shadow-sm"
            data-testid="home-plan"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold tracking-tight">{t('planTitle')}</h2>
                <p className="mt-1 text-xs text-stone-600">{t('planSub')}</p>
              </div>
              <div className="flex items-center gap-2">
                {plan.length > 0 && (
                  <span className="rounded-full bg-[#f4efdf] px-2.5 py-1 text-[11px] font-bold text-[#8a6215]" data-testid="plan-progress">
                    {planDoneCount}/{plan.length} {t('planDoneCount')}
                  </span>
                )}
                <CalendarDays size={19} className="text-stone-600" aria-hidden="true" />
              </div>
            </div>
            {plan.length === 0 ? (
              <div className="rounded-xl bg-[#f1ebdc] p-4">
                <p className="text-xs leading-5 text-stone-600">{t('planEmpty')}</p>
                <button onClick={() => go('reminders')} data-testid="plan-add-first" className="mt-3 flex min-h-9 items-center gap-1.5 rounded-xl bg-[#0f241a] px-3.5 text-[11px] font-bold text-[#f5f0e3] hover:bg-[#26251c]">
                  <Plus size={13} aria-hidden="true" />
                  {t('planAddFirst')}
                </button>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {plan.slice(0, 6).map((r, i) => {
                  const Icon = TYPE_ICONS[r.type] || Bell
                  return (
                    <motion.li
                      key={r.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.28 + i * 0.07 }}
                      className={`flex items-center gap-3 rounded-xl p-3 ${r.done ? 'bg-[#f1ebdc]' : r._overdue ? 'border border-amber-200 bg-amber-50' : 'bg-[#f4efdf]'}`}
                      data-testid={`plan-item-${i}`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${r.done ? 'bg-[#faf6ec] text-stone-600' : r._overdue ? 'bg-[#faf6ec] text-amber-800' : 'bg-[#faf6ec] text-[#8a6215]'}`}>
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-xs font-bold ${r.done ? 'text-stone-600 line-through' : 'text-stone-800'}`}>{r.title}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-stone-600">
                          {r.time || '—'}
                          {r._overdue && <span className="font-bold text-amber-800" data-testid="plan-overdue-chip">· {t('planOverdue')}</span>}
                        </p>
                      </div>
                      {onToggleReminder && (
                        <button
                          onClick={() => onToggleReminder(r.id)}
                          aria-label={r.done ? t('planMarkUndone') : t('planMarkDone')}
                          data-testid={`plan-toggle-${i}`}
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition ${r.done
                            ? 'border-stone-200 bg-[#faf6ec] text-stone-400 hover:text-[#8a6215]'
                            : 'border-[#b8974f]/50 bg-[#faf6ec] text-[#8a6215] hover:bg-[#f4efdf]'}`}
                        >
                          {r.done ? <Undo2 size={13} aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}
                        </button>
                      )}
                    </motion.li>
                  )
                })}
              </ul>
            )}
            <div className="mt-4 flex items-center justify-between">
              <button onClick={() => go('reminders')} data-testid="home-manage-reminders" className="text-xs font-bold text-[#8a6215]">
                {t('manageReminders')}
                <ArrowUpRight className="ml-1 inline" size={13} aria-hidden="true" />
              </button>
              {plan.length > 0 && (
                <button onClick={() => go('reminders')} data-testid="plan-add-more" className="flex items-center gap-1 text-xs font-bold text-[#8a6215] hover:underline">
                  <Plus size={13} aria-hidden="true" />
                  {t('planAddMore')}
                </button>
              )}
            </div>
          </motion.div>

          {/* Disclaimer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="rounded-2xl border border-[#b8974f]/50 bg-[#f4efdf] p-5"
          >
            <div className="flex gap-3">
              <ShieldCheck size={19} className="shrink-0 text-[#8a6215]" aria-hidden="true" />
              <p className="text-xs leading-5 text-stone-700">
                <strong className="text-stone-900">{t('noteTitle')}:</strong> {t('noteBody')}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
