'use client'

import { useMemo, useState } from 'react'
import { BookOpen, ChevronDown, Search, Sparkles, Star } from 'lucide-react'

// Profile keyword → article id. Purely educational: matches a known
// condition the user wrote in their own profile to general reading.
const TOPIC_MATCHERS = [
  [/diabet|sugar|मधुमेह|शुगर/i, ['diabetes']],
  [/bp|blood pressure|hypertension|रक्तचाप|बीपी/i, ['bp']],
  [/thyroid|थायरॉइड/i, []],
  [/asthma|साँस|सांस/i, []],
  [/anx|stress|depress|मानसिक|तनाव/i, ['mental']],
  [/insomnia|नींद/i, ['sleep']],
  [/obese|weight|वज़न|वजन/i, ['nutrition', 'exercise']],
]

export function EducationSection({ t, lang, profile }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(null)

  const articles = t('articles')

  // Safe personalisation: only if the user filled conditions in their
  // profile, surface matching articles first. Never fabricates a match.
  const suggestedIds = useMemo(() => {
    const cond = profile?.conditions?.trim()
    if (!cond) return []
    const ids = new Set()
    for (const [re, list] of TOPIC_MATCHERS) {
      if (re.test(cond)) list.forEach((id) => ids.add(id))
    }
    return [...ids].filter((id) => articles.some((a) => a.id === id))
  }, [profile?.conditions, articles]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return articles
    return articles.filter((a) => (a.title + ' ' + a.body).toLowerCase().includes(q))
  }, [query, articles, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  const suggested = suggestedIds.map((id) => articles.find((a) => a.id === id)).filter(Boolean)

  return (
    <div data-testid="section-education" className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t('educationTitle')}</h1>
        <p className="mt-2 text-sm text-stone-600">{t('educationIntro')}</p>
      </div>

      {/* Picked for you — profile-driven, appears only when a condition matches */}
      {suggested.length > 0 && (
        <section aria-labelledby="edu-for-you-h" className="mb-6" data-testid="edu-for-you">
          <div className="flex items-center gap-2">
            <Star size={15} className="text-[#8a6215]" aria-hidden="true" />
            <h2 id="edu-for-you-h" className="text-sm font-extrabold text-stone-900">{t('educationForYou')}</h2>
          </div>
          <p className="mt-1 text-[11px] text-stone-600">{t('educationForYouHint')}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {suggested.map((a) => (
              <li key={`sug-${a.id}`}>
                <button
                  onClick={() => { setQuery(''); setOpen(a.id) }}
                  data-testid={`edu-suggest-${a.id}`}
                  className="flex items-center gap-2 rounded-full border border-[#b8974f]/60 bg-[#f4e9d2] px-3.5 py-2 text-xs font-bold text-[#5c4310] transition hover:border-[#b8974f]"
                >
                  <Sparkles size={13} aria-hidden="true" />
                  {a.title.length > 42 ? a.title.slice(0, 40) + '…' : a.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" aria-hidden="true" />
        <label htmlFor="edu-search" className="sr-only">{t('searchPlaceholder')}</label>
        <input
          id="edu-search"
          data-testid="edu-search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(null) }}
          placeholder={t('searchPlaceholder')}
          className="h-12 w-full rounded-2xl border border-stone-200 bg-[#faf6ec] pl-11 pr-4 text-sm shadow-sm outline-none placeholder:text-stone-600 focus:border-[#b8974f]"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-[#faf6ec] p-8 text-center text-sm text-stone-600" data-testid="edu-no-results">{t('noResults')}</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((a) => {
            const expanded = open === a.id
            return (
              <li key={a.id} className="overflow-hidden rounded-2xl border border-stone-200/80 bg-[#faf6ec] shadow-[0_7px_24px_-18px_rgba(15,23,42,.4)]">
                <button
                  onClick={() => setOpen(expanded ? null : a.id)}
                  data-testid={`edu-card-${a.id}`}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-4 p-4 text-left"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#f4efdf] text-[#8a6215]">
                    <BookOpen size={20} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-stone-900">{a.title}</span>
                    <span className="mt-1 block text-[11px] font-semibold text-stone-600">
                      {a.minutes} {t('minRead')} · {t('featureBadge')}
                    </span>
                  </span>
                  <ChevronDown size={17} className={`shrink-0 text-stone-600 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {expanded && (
                  <div className="border-t border-stone-100 px-5 pb-5 pt-4" data-testid={`edu-body-${a.id}`}>
                    <p className="text-[13px] leading-6 text-stone-700">{a.body}</p>
                    <p className="mt-4 flex items-start gap-2 rounded-xl bg-[#f4efdf] p-3 text-[11px] leading-5 text-stone-600">
                      <Sparkles size={13} className="mt-0.5 shrink-0 text-[#8a6215]" aria-hidden="true" />
                      {t('noteBody')}
                    </p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
