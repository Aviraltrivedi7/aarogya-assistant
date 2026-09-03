'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, Clock3, FileText, Printer, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { severityMeta, SEVERITY } from '@/lib/triage'
import * as sync from '@/lib/sync'

function localeOf(lang) {
  if (typeof Intl === 'undefined' || !Intl.DateTimeFormat.supportedLocalesOf('hi-IN').length) return 'en-IN'
  return lang === 'hi' ? 'hi-IN' : 'en-IN'
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
}

export function HistorySection({ t, lang, history, setHistory, go, profile }) {
  const loc = localeOf(lang)
  const [query, setQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return history.filter((c) => {
      if (severityFilter !== 'all' && c.severity !== severityFilter) return false
      if (!q) return true
      return ((c.summary || '') + ' ' + (c.text || '')).toLowerCase().includes(q)
    })
  }, [history, query, severityFilter])

  const remove = (id) => {
    setHistory(sync.deleteHistoryCheck(id))
  }

  const clearAll = () => {
    if (window.confirm(t('confirmClear'))) {
      sync.clearHistory()
      setHistory([])
    }
  }

  const printReport = () => {
    const w = window.open('', '_blank', 'width=820,height=920')
    if (!w) {
      toast.error(lang === 'hi' ? 'पॉपअप रोका गया — प्रिंट के लिए पॉपअप की अनुमति दें।' : 'Popup blocked — allow popups to print.')
      return
    }
    const profileBits = [
      profile?.name?.trim() && `${t('profileName')}: ${profile.name}`,
      profile?.age && `${t('profileAge')}: ${profile.age}`,
      profile?.bloodGroup && `${t('profileBlood')}: ${profile.bloodGroup}`,
      profile?.conditions?.trim() && `${t('profileConditions')}: ${profile.conditions}`,
      profile?.allergies?.trim() && `${t('profileAllergies')}: ${profile.allergies}`,
    ].filter(Boolean).join(' · ')

    const rows = history
      .map((c) => `<tr>
          <td>${escapeHtml(new Date(c.createdAt).toLocaleString(loc))}</td>
          <td>${escapeHtml(c.text)}</td>
          <td>${escapeHtml(c.summary)}</td>
          <td>${escapeHtml(t(`severity.${c.severity}`))}</td>
        </tr>`)
      .join('')

    const table = history.length
      ? `<table><thead><tr><th>${escapeHtml(lang === 'hi' ? 'तारीख' : 'Date')}</th><th>${escapeHtml(lang === 'hi' ? 'आपने क्या बताया' : 'What you said')}</th><th>${escapeHtml(lang === 'hi' ? 'मूल्यांकन' : 'Assessment')}</th><th>${escapeHtml(lang === 'hi' ? 'तात्कालिकता' : 'Urgency')}</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<p class="meta">${escapeHtml(lang === 'hi' ? 'अभी कोई जाँच दर्ज नहीं।' : 'No checks recorded yet.')}</p>`

    w.document.write(`<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(t('exportReport'))}</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #26251c; margin: 34px; }
  header { display: flex; align-items: center; gap: 12px; border-bottom: 3px solid #0f241a; padding-bottom: 14px; }
  .logo { width: 42px; height: 42px; display: block; }
  h1 { font-size: 19px; margin: 0; }
  .sub { color: #6e6a5c; font-size: 12px; margin-top: 3px; }
  h2 { font-size: 14px; margin: 24px 0 8px; color: #0f241a; }
  .meta { color: #57544a; font-size: 12.5px; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
  th { text-align: left; background: #f1ebdc; padding: 7px 9px; border: 1px solid #c9bfa4; }
  td { padding: 7px 9px; border: 1px solid #c9bfa4; vertical-align: top; }
  .footer { margin-top: 26px; padding: 11px 13px; background: #f1ebdc; border-radius: 8px; font-size: 11px; color: #57544a; }
  @media print { body { margin: 12mm; } }
</style>
</head>
<body>
<header>
  <svg class="logo" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="AarogyaGPT">
      <rect x="2" y="2" width="60" height="60" rx="17" fill="#142d20" stroke="#0f241a" stroke-width="3.4"/>
      <path d="M32 50.5 C 24.5 44.5, 13 36.5, 13 26 C 13 17.5, 19.5 12, 26.5 12.3 C 29.8 12.45, 31.5 14.5, 32 17.5 C 32.5 14.5, 34.2 12.45, 37.5 12.3 C 44.5 12, 51 17.5, 51 26 C 51 36.5, 39.5 44.5, 32 50.5 Z" fill="#eda33c"/>
      <path d="M16 31 H24.5 L28.5 22.5 L34 39.5 L37.5 31 H48" stroke="#f5f0e3" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  <div>
    <h1>${escapeHtml(t('exportReport'))}</h1>
    <div class="sub">${escapeHtml(lang === 'hi' ? 'बनाई गई' : 'Generated')}: ${escapeHtml(new Date().toLocaleString(loc))}</div>
  </div>
</header>
<h2>${escapeHtml(t('profile'))}</h2>
<p class="meta">${escapeHtml(profileBits || '—')}</p>
<h2>${escapeHtml(t('historyTitle'))}</h2>
${table}
<div class="footer">${escapeHtml(t('noteBody'))}</div>
<script>window.print()</script>
</body>
</html>`)
    w.document.close()
    w.focus()
  }

  return (
    <div data-testid="section-history" className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">{t('historyTitle')}</h1>
          <p className="mt-2 text-sm text-stone-600">{t('historyIntro')}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            onClick={printReport}
            data-testid="history-print"
            className="flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 px-3 text-xs font-bold text-stone-700 hover:border-[#b8974f] hover:bg-[#f4e9d2]"
          >
            <Printer size={14} aria-hidden="true" />
            {t('exportReport')}
          </button>
          {history.length > 0 && (
            <button onClick={clearAll} data-testid="history-clear" className="flex min-h-10 items-center rounded-xl border border-stone-200 px-3 text-xs font-bold text-stone-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700">
              {t('clearAll')}
            </button>
          )}
        </div>
      </div>

      {/* Search + severity filter — only meaningful with records */}
      {history.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center" data-testid="history-tools">
          <div className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" aria-hidden="true" />
            <label htmlFor="history-search" className="sr-only">{t('historySearchLabel')}</label>
            <input
              id="history-search"
              data-testid="history-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('historySearchPlaceholder')}
              className="h-11 w-full rounded-2xl border border-stone-200 bg-[#faf6ec] pl-10 pr-4 text-sm outline-none placeholder:text-stone-600 focus:border-[#b8974f]"
            />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('triage.severityLabel')}>
            {['all', SEVERITY.LOW, SEVERITY.MODERATE, SEVERITY.HIGH, SEVERITY.EMERGENCY].map((sev) => {
              const meta = sev === 'all' ? null : severityMeta[sev]
              const active = severityFilter === sev
              return (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  data-testid={`history-filter-${sev}`}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${active ? 'border-[#b8974f] bg-[#f4efdf] text-[#8a6215]' : 'border-stone-200 bg-[#faf6ec] text-stone-700 hover:border-[#b8974f]'}`}
                >
                  {sev === 'all' ? t('historyFilterAll') : t(`severity.${sev}`)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {history.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-300 bg-[#faf6ec] p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
            <FileText size={26} aria-hidden="true" />
          </div>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-stone-600">{t('historyEmpty')}</p>
          <button onClick={() => go('assistant')} data-testid="history-start" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-[#0f241a] bg-[#eda33c] px-5 text-sm font-extrabold text-[#26251c] shadow-[4px_4px_0_0_#0f241a] hover:bg-[#f2c063]">
            {t('historyStart')}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-stone-300 bg-[#faf6ec] p-8 text-center text-sm text-stone-600" data-testid="history-no-match">
          {t('historyNoMatch')}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((c) => {
            const meta = severityMeta[c.severity] || severityMeta.low
            const d = new Date(c.createdAt)
            const loc = (typeof Intl !== 'undefined' && Intl.DateTimeFormat.supportedLocalesOf('hi-IN').length) ? (lang === 'hi' ? 'hi-IN' : 'en-IN') : 'en-IN'
            const dateStr = d.toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' })
            const timeStr = d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' })
            return (
              <li key={c.id} className="flex items-center gap-4 rounded-2xl border border-stone-200/80 bg-[#faf6ec] p-4 shadow-[0_7px_24px_-18px_rgba(15,23,42,.4)]" data-testid="history-item">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-stone-900">{c.summary || c.text}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${meta.bg} ${meta.text}`}>{t(`severity.${c.severity}`)}</span>
                  </div>
                  {c.text && c.summary && <p className="mt-1 truncate text-xs text-stone-600">&ldquo;{c.text}&rdquo;</p>}
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-stone-600">
                    <Clock3 size={12} aria-hidden="true" />
                    {dateStr}, {timeStr}
                  </p>
                </div>
                <button
                  onClick={() => remove(c.id)}
                  data-testid="history-delete"
                  aria-label={t('deleteCheck')}
                  className="shrink-0 rounded-xl p-2 text-stone-600 transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={17} aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
