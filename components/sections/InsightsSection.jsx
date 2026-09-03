'use client'

import { motion } from 'framer-motion'
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardList, HeartPulse, Sparkles, TrendingUp } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { bmiValue, bmiBand, weeklyDigest } from '@/lib/health'

// Severity → numeric scale for the trend chart.
const SEVERITY_SCORE = { low: 1, moderate: 2, high: 3, emergency: 4 }
const SCORE_TO_KEY = { 1: 'low', 2: 'moderate', 3: 'high', 4: 'emergency' }
const MIX_COLORS = ['#1d6b48', '#4d8a68', '#f59e0b', '#eda33c', '#ef4444']

function localeOf(lang) {
  if (typeof Intl === 'undefined' || !Intl.DateTimeFormat.supportedLocalesOf('hi-IN').length) return 'en-IN'
  return lang === 'hi' ? 'hi-IN' : 'en-IN'
}

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const riseIn = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }

export function InsightsSection({ t, lang, history, reminders, profile, go }) {
  const loc = localeOf(lang)

  // ── Trend: worst severity per day over the last 14 days ──
  const now = new Date()
  const days = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push(dayKey(d))
  }
  const byDay = new Map()
  for (const c of history) {
    const k = dayKey(new Date(c.createdAt))
    const s = SEVERITY_SCORE[c.severity] ?? 1
    byDay.set(k, Math.max(byDay.get(k) || 0, s))
  }
  const trend = days.map((k) => ({
    label: new Date(`${k}T00:00:00`).toLocaleDateString(loc, { day: 'numeric', month: 'short' }),
    severity: byDay.get(k) ?? null,
  }))

  // ── Symptom mix: first summary token, top 5 ──
  const counts = new Map()
  for (const c of history) {
    const name = String(c.summary || '').split(' + ')[0].trim() || (lang === 'hi' ? 'अन्य' : 'Other')
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  const mix = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }))

  // ── Reminder completion ──
  const totalRem = reminders.length
  const doneRem = reminders.filter((r) => r.done).length
  const completion = totalRem > 0 ? Math.round((doneRem / totalRem) * 100) : null

  // ── Health score (0-100): recent severity (40) + reminder follow-through (30) + profile completeness (30)
  const weekAgo = now.getTime() - 7 * 86400000
  const recent = history.filter((c) => new Date(c.createdAt).getTime() >= weekAgo)
  const worst = recent.reduce((m, c) => Math.max(m, SEVERITY_SCORE[c.severity] || 1), 0)
  const checkPts = recent.length === 0 ? 40 : ({ 1: 35, 2: 25, 3: 15, 4: 5 }[worst] ?? 25)
  const remPts = totalRem === 0 ? 30 : Math.round(30 * (doneRem / totalRem))
  // Five 6-point checks keep the completeness weight at 30 total.
  const profilePts =
    (profile.name?.trim() ? 6 : 0) +
    (profile.bloodGroup ? 6 : 0) +
    (profile.conditions?.trim() || profile.allergies?.trim() || profile.age ? 6 : 0) +
    ((profile.height && profile.weight) ? 6 : 0) +
    (profile.emergencyContact?.trim() ? 6 : 0)
  const score = Math.max(0, Math.min(100, checkPts + remPts + profilePts))
  const scoreLabel = score >= 80 ? t('scoreExcellent') : score >= 60 ? t('scoreGood') : score >= 40 ? t('scoreFair') : t('scorePoor')
  const scoreTone = score >= 80
    ? { text: 'text-[#8a6215]', ring: '#b8974f', bg: 'bg-[#f4e9d2]', chip: 'bg-[#f4e9d2] text-[#8a6215]' }
    : score >= 60
      ? { text: 'text-[#8a6215]', ring: '#eda33c', bg: 'bg-[#f4e9d2]', chip: 'bg-[#f4e9d2] text-[#8a6215]' }
      : score >= 40
        ? { text: 'text-amber-800', ring: '#f59e0b', bg: 'bg-amber-50', chip: 'bg-amber-50 text-amber-800' }
        : { text: 'text-red-700', ring: '#ef4444', bg: 'bg-red-50', chip: 'bg-red-50 text-red-700' }

  const hasData = history.length > 0 || totalRem > 0
  const C = 2 * Math.PI * 54

  // ── BMI from profile vitals (Asian-Indian thresholds) ──
  const bmi = bmiValue(profile.height, profile.weight)
  const band = bmiBand(bmi, lang)
  const bmiBody = band
    ? { under: t('bmiUnderBody'), normal: t('bmiNormalBody'), over: t('bmiOverBody'), obese: t('bmiObeseBody') }[band.key]
    : null

  // ── Weekly digest ──
  const digest = weeklyDigest(history, reminders)

  // Screen-reader summary of the charts (charts get role="img" + aria-label too).
  const trendSummary = `${t('severityTrend')}: ${[...byDay.entries()].map(([k, v]) => `${k} — ${t(`severity.${SCORE_TO_KEY[v]}`)}`).join('; ') || t('insightsEmpty')}`
  const mixSummary = `${t('symptomMix')}: ${mix.map((m) => `${m.name} × ${m.value}`).join('; ') || t('insightsEmpty')}`

  if (!hasData) {
    return (
      <div data-testid="insights-empty" className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">{t('insightsTitle')}</h1>
        <p className="mt-2 text-sm text-stone-600">{t('insightsIntro')}</p>
        <div className="mt-8 rounded-3xl border border-dashed border-stone-300 bg-[#faf6ec] p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
            <TrendingUp size={26} aria-hidden="true" />
          </div>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-stone-600">{t('insightsEmpty')}</p>
          <button onClick={() => go('assistant')} data-testid="insights-start" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-[#0f241a] bg-[#eda33c] px-5 text-sm font-extrabold text-[#26251c] shadow-[4px_4px_0_0_#0f241a] hover:bg-[#f2c063]">
            {t('historyStart')}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="section-insights" className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">{t('insightsTitle')}</h1>
        <p className="mt-2 text-sm text-stone-600">{t('insightsIntro')}</p>
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* Health score */}
        <motion.section variants={riseIn} aria-labelledby="score-h" className="flex flex-col items-center rounded-3xl border border-stone-200/80 bg-[#faf6ec] p-6 text-center shadow-[0_7px_24px_-18px_rgba(15,23,42,.4)]">
          <h2 id="score-h" className="font-display text-sm font-extrabold text-stone-900">{t('healthScore')}</h2>
          <div className="relative my-4" data-testid="insights-score">
            <svg viewBox="0 0 128 128" className="h-40 w-40" role="img" aria-label={`${t('healthScore')}: ${score}/100 — ${scoreLabel}`}>
              <circle cx="64" cy="64" r="54" fill="none" stroke="#e4dcc8" strokeWidth="10" />
              <motion.circle
                cx="64" cy="64" r="54" fill="none"
                stroke={scoreTone.ring} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={C}
                initial={{ strokeDashoffset: C }}
                animate={{ strokeDashoffset: C * (1 - score / 100) }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                transform="rotate(-90 64 64)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-4xl font-extrabold text-stone-900">{score}</span>
              <span className="text-[11px] font-semibold text-stone-600">{t('outOf')}</span>
            </div>
          </div>
          <span className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${scoreTone.chip}`}>{scoreLabel}</span>
          <div className="mt-5 flex w-full items-center justify-between border-t border-stone-100 pt-4 text-left">
            <div>
              <p className="font-display text-lg font-extrabold text-stone-900">{recent.length}</p>
              <p className="text-[11px] font-semibold text-stone-600">{t('checksThisWeek')}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-lg font-extrabold text-stone-900">{completion === null ? '—' : `${completion}%`}</p>
              <p className="text-[11px] font-semibold text-stone-600">{t('reminderCompletion')}</p>
            </div>
          </div>
          <p className="sr-only">{trendSummary}. {mixSummary}</p>
        </motion.section>

        {/* Trend chart */}
        <motion.section variants={riseIn} aria-labelledby="trend-h" className="rounded-3xl border border-stone-200/80 bg-[#faf6ec] p-6 shadow-[0_7px_24px_-18px_rgba(15,23,42,.4)]">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#f4e9d2] text-[#8a6215]">
              <TrendingUp size={17} aria-hidden="true" />
            </span>
            <div>
              <h2 id="trend-h" className="font-display text-sm font-extrabold text-stone-900">{t('severityTrend')}</h2>
              <p className="text-[11px] text-stone-600">{t('severityTrendSub')}</p>
            </div>
          </div>
          <div data-testid="insights-trend" role="img" aria-label={trendSummary} className="mt-3">
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="sevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1d6b48" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#1d6b48" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4dcc8" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#57544a' }} tickLine={false} axisLine={{ stroke: '#c9bfa4' }} interval="preserveStartEnd" />
                <YAxis
                  domain={[0, 4]}
                  ticks={[1, 2, 3, 4]}
                  tickFormatter={(v) => (SCORE_TO_KEY[v] ? t(`severity.${SCORE_TO_KEY[v]}`) : '')}
                  tick={{ fontSize: 11, fill: '#57544a' }}
                  tickLine={false}
                  axisLine={false}
                  width={78}
                />
                <Tooltip formatter={(v) => (v == null ? '—' : t(`severity.${SCORE_TO_KEY[v]}`))} />
                <Area type="monotone" dataKey="severity" stroke="#1d6b48" strokeWidth={2.5} fill="url(#sevGrad)" connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        {/* Symptom mix + reminder completion */}
        <motion.section variants={riseIn} aria-labelledby="mix-h" className="rounded-3xl border border-stone-200/80 bg-[#faf6ec] p-6 shadow-[0_7px_24px_-18px_rgba(15,23,42,.4)]">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-amber-50 text-[#8a6215]">
              <ClipboardList size={17} aria-hidden="true" />
            </span>
            <div>
              <h2 id="mix-h" className="font-display text-sm font-extrabold text-stone-900">{t('symptomMix')}</h2>
              <p className="text-[11px] text-stone-600">{t('symptomMixSub')}</p>
            </div>
          </div>
          <div data-testid="insights-mix" role="img" aria-label={mixSummary} className="mt-2">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                {/* aria-hidden on the chart: the wrapper's aria-label is the accessible name (sectors are decorative paths) */}
                <Pie data={mix} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={3} strokeWidth={2} stroke="#ffffff" aria-hidden="true">
                  {mix.map((entry, i) => (
                    <Cell key={entry.name} fill={MIX_COLORS[i % MIX_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value}`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1.5">
            {mix.map((m, i) => (
              <li key={m.name} className="flex items-center gap-2 text-xs font-semibold text-stone-700">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: MIX_COLORS[i % MIX_COLORS.length] }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <span className="shrink-0 text-stone-600">×{m.value}</span>
              </li>
            ))}
          </ul>
        </motion.section>

        {/* Reminder completion bar */}
        <motion.section variants={riseIn} aria-labelledby="remc-h" className="rounded-3xl border border-stone-200/80 bg-[#faf6ec] p-6 shadow-[0_7px_24px_-18px_rgba(15,23,42,.4)]">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#f4e9d2] text-[#8a6215]">
              <CheckCircle2 size={17} aria-hidden="true" />
            </span>
            <div>
              <h2 id="remc-h" className="font-display text-sm font-extrabold text-stone-900">{t('reminderCompletion')}</h2>
              <p className="text-[11px] text-stone-600">{doneRem}/{totalRem} {t('done').toLowerCase()}</p>
            </div>
          </div>
          {completion === null ? (
            <p className="rounded-xl bg-stone-50 p-3 text-xs leading-5 text-stone-600" data-testid="insights-rem-empty">{t('noRemindersYet')}</p>
          ) : (
            <div data-testid="insights-completion">
              <p className="font-display text-4xl font-extrabold text-stone-900">{completion}%</p>
              <div
                className="mt-3 h-3 w-full overflow-hidden rounded-full bg-stone-100"
                role="progressbar"
                aria-valuenow={completion}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('reminderCompletion')}
              >
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#eda33c] to-[#b8974f]"
                  initial={{ width: 0 }}
                  animate={{ width: `${completion}%` }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-[#f4efdf] p-3 text-[11px] leading-5 text-stone-600">
                <Sparkles size={13} className="mt-0.5 shrink-0 text-[#8a6215]" aria-hidden="true" />
                {t('insightsIntro')}
              </p>
            </div>
          )}
        </motion.section>
        {/* BMI — Asian-Indian thresholds, from profile vitals */}
        <motion.section variants={riseIn} aria-labelledby="bmi-h" className="rounded-3xl border border-stone-200/80 bg-[#faf6ec] p-6 shadow-[0_7px_24px_-18px_rgba(15,23,42,.4)] lg:col-span-2" data-testid="insights-bmi-card">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-red-50 text-red-600">
              <HeartPulse size={17} aria-hidden="true" />
            </span>
            <div>
              <h2 id="bmi-h" className="font-display text-sm font-extrabold text-stone-900">{t('bmiTitle')}</h2>
              <p className="text-[11px] text-stone-600">{t('bmiSub')}</p>
            </div>
          </div>
          {bmi === null || !band ? (
            <div className="flex flex-col items-start gap-3 rounded-xl bg-[#f1ebdc] p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="insights-bmi-empty">
              <p className="text-xs leading-5 text-stone-600">{t('bmiMissing')}</p>
              <button onClick={() => go('profile')} data-testid="insights-bmi-set-profile" className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border border-stone-200 bg-[#faf6ec] px-3.5 text-[11px] font-bold text-stone-700 hover:border-[#b8974f]">
                {t('bmiSetProfile')}
                <ArrowRight size={13} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex shrink-0 items-center gap-4">
                <p className="font-display text-5xl font-extrabold text-stone-900" data-testid="insights-bmi-value">{bmi.toFixed(1)}</p>
                <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${band.bg} ${band.color}`} data-testid="insights-bmi-chip">{band.chip}</span>
              </div>
              <p className="flex-1 text-xs leading-5 text-stone-700">{bmiBody}</p>
            </div>
          )}
          <p className="mt-4 border-t border-stone-100 pt-3 text-[10px] leading-4 text-stone-600">{t('bmiScaleNote')}</p>
        </motion.section>

        {/* Weekly digest — the last 7 days at a glance */}
        <motion.section variants={riseIn} aria-labelledby="digest-h" className="rounded-3xl border border-stone-200/80 bg-[#faf6ec] p-6 shadow-[0_7px_24px_-18px_rgba(15,23,42,.4)] lg:col-span-2" data-testid="insights-digest">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#f4e9d2] text-[#8a6215]">
              <CalendarDays size={17} aria-hidden="true" />
            </span>
            <div>
              <h2 id="digest-h" className="font-display text-sm font-extrabold text-stone-900">{t('digestTitle')}</h2>
              <p className="text-[11px] text-stone-600">{t('digestSub')}</p>
            </div>
          </div>
          {digest.checks === 0 && digest.remindersDone === 0 ? (
            <p className="rounded-xl bg-[#f1ebdc] p-4 text-xs leading-5 text-stone-600" data-testid="insights-digest-quiet">{t('digestQuietWeek')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-[#f4efdf] p-3.5">
                <p className="font-display text-2xl font-extrabold text-stone-900" data-testid="digest-checks">{digest.checks}</p>
                <p className="mt-0.5 text-[11px] font-semibold leading-4 text-stone-600">{t('digestChecks')}</p>
              </div>
              <div className="rounded-xl bg-[#f4efdf] p-3.5">
                <p className="font-display text-2xl font-extrabold text-stone-900" data-testid="digest-reminders">{digest.remindersDone}</p>
                <p className="mt-0.5 text-[11px] font-semibold leading-4 text-stone-600">{t('digestReminders')}</p>
              </div>
              <div className="rounded-xl bg-[#f1ebdc] p-3.5">
                <p className="mt-1 text-sm font-bold text-stone-900" data-testid="digest-worst">
                  {digest.worst ? t(`severity.${digest.worst}`) : t('digestTopNone')}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold leading-4 text-stone-600">{t('digestWorst')}</p>
              </div>
              <div className="rounded-xl bg-[#f1ebdc] p-3.5">
                <p className="truncate text-sm font-bold text-stone-900" data-testid="digest-top">{digest.topSymptom ? digest.topSymptom.label : t('digestTopNone')}</p>
                <p className="mt-0.5 text-[11px] font-semibold leading-4 text-stone-600">{t('digestTop')}</p>
              </div>
            </div>
          )}
        </motion.section>
      </motion.div>
    </div>
  )
}
