'use client'

// Medical report analyzer — uploads a lab report PDF (parsed locally via
// pdf.js, so the file itself never leaves the device) or takes pasted
// text, extracts common test values server-side and explains them simply.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle, Check, ClipboardPaste, FileText, FlaskConical, Loader2,
  Trash2, Upload, X,
} from 'lucide-react'

import * as sync from '@/lib/sync'

async function pdfToText(file) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  let text = ''
  for (let i = 1; i <= Math.min(pdf.numPages, 8); i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((it) => it.str).join('\n') + '\n'
  }
  return text
}

const statusTone = {
  normal: 'border-[#b8974f]/50 bg-[#f4efdf] text-[#8a6215]',
  low: 'border-amber-200 bg-[#f4e9d2] text-[#8a6215]',
  high: 'border-red-200 bg-red-50 text-red-700',
}

export function ReportsSection({ t, lang }) {
  const [mode, setMode] = useState('upload') // upload | paste
  const [pasteText, setPasteText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [current, setCurrent] = useState(null) // latest parsed report
  const [saved, setSaved] = useState([])
  const [openSaved, setOpenSaved] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    sync.api('/reports').then((r) => (r.ok ? r.json() : [])).then(setSaved).catch(() => {})
  }, [])

  const runAnalysis = async (text) => {
    if (!text.trim()) return
    setBusy(true)
    setError('')
    try {
      const res = await sync.api('/reports', { method: 'POST', body: { text, lang } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(res.status === 422 ? t('reportsNoTests') : data.error || t('reportsSaveError'))
      } else {
        setCurrent(data.saved)
        setSaved((prev) => [data.saved, ...prev])
      }
    } catch {
      setError(t('reportsSaveError'))
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return
    if (file.size > 15 * 1024 * 1024) return
    setBusy(true)
    setError('')
    try {
      const text = await pdfToText(file)
      await runAnalysis(text)
    } catch {
      setError(t('reportsParseError'))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const deleteReport = async (id) => {
    try {
      await sync.api('/reports/' + encodeURIComponent(id), { method: 'DELETE' })
      setSaved((prev) => prev.filter((r) => r.id !== id))
      if (current?.id === id) setCurrent(null)
    } catch {}
  }

  const l = lang === 'hi' ? 'hi' : 'en'
  const statusLabel = (s) => t(`reportsStatus${s === 'normal' ? 'Normal' : s === 'low' ? 'Low' : 'High'}`)
  const fmtValue = (r) => `${r.value}${r.unit ? ' ' + r.unit : ''}`
  const fmtRef = (r) => (r.refLo === 0 ? `< ${r.refHi}` : r.refHi >= 1000 ? `${r.refLo / 100000}–${r.refHi / 100000} ${t('reportsStatusLow') ? '' : ''}`.trim() + ' lakh' : `${r.refLo}–${r.refHi} ${r.unit}`)

  const ResultTable = ({ report, testid }) => (
    <div className="overflow-hidden rounded-2xl border border-stone-200" data-testid={testid}>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="bg-[#efe9d8]">
            <th className="px-3 py-2.5 font-bold text-stone-800">{t('reportsTableTest')}</th>
            <th className="px-3 py-2.5 font-bold text-stone-800">{t('reportsTableValue')}</th>
            <th className="hidden px-3 py-2.5 font-bold text-stone-800 sm:table-cell">{t('reportsTableRef')}</th>
            <th className="px-3 py-2.5 font-bold text-stone-800">{t('reportsTableStatus')}</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((r) => (
            <tr key={r.key} className="border-t border-stone-200/80 bg-[#fffdf7]">
              <td className="px-3 py-2.5 font-semibold text-stone-900">
                {r.label[l]}
                {r.note && <span className="mt-1 block text-[11px] font-normal leading-4 text-stone-600">{r.note[l]}</span>}
              </td>
              <td className="px-3 py-2.5 font-bold text-stone-900">{fmtValue(r)}</td>
              <td className="hidden px-3 py-2.5 text-stone-600 sm:table-cell">{r.refLo}–{r.refHi} {r.unit}</td>
              <td className="px-3 py-2.5">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusTone[r.status]}`}>{statusLabel(r.status)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div data-testid="section-reports" className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight md:text-3xl">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-[#0f241a] bg-[#eda33c] text-[#0f241a] shadow-[3px_3px_0_0_#0f241a]">
            <FlaskConical size={20} aria-hidden="true" />
          </span>
          {t('reportsTitle')}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">{t('reportsIntro')}</p>
      </div>

      {/* Mode tabs */}
      <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-xl bg-[#efe9d8] p-1.5" role="tablist">
        {[['upload', t('reportsUploadLabel'), Upload], ['paste', t('reportsPasteLabel'), ClipboardPaste]].map(([key, label, Icon]) => (
          <button
            key={key}
            role="tab"
            aria-selected={mode === key}
            data-testid={`reports-tab-${key}`}
            onClick={() => { setMode(key); setError('') }}
            className={`relative flex h-11 items-center justify-center gap-2 rounded-lg text-[13px] font-bold transition ${mode === key ? 'text-[#f5f0e3]' : 'text-stone-600 hover:text-stone-900'}`}
          >
            {mode === key && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 rounded-lg bg-[#0f241a] shadow-md shadow-black/20" aria-hidden="true" />
            )}
            <span className="relative z-10 flex items-center gap-2"><Icon size={15} aria-hidden="true" />{label}</span>
          </button>
        ))}
      </div>

      {/* No mode="wait" here — nested wait-mode AnimatePresence inside the
          page-level wait-mode wrapper deadlocks the section switch on
          framer-motion 11 (the outer exit never completes after an inner
          wait-mode swap). Cross-fade instead; visually identical. */}
      <AnimatePresence initial={false}>
        <motion.div key={mode} initial={{ opacity: 0, x: mode === 'upload' ? -14 : 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
          {mode === 'upload' ? (
            <div
              className="relative rounded-3xl border-2 border-dashed border-stone-300 bg-[#faf6ec] p-8 transition hover:border-[#b8974f]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const dt = e.dataTransfer; if (dt.files?.[0]) { const fake = { target: { files: dt.files } }; onFile(fake) } }}
            >
              <input ref={fileRef} type="file" accept="application/pdf" onChange={onFile} aria-label={t('reportsUploadLabel')} data-testid="reports-pdf-input" className="sr-only" />
              <button
                onClick={() => fileRef.current?.click()}
                data-testid="reports-pick"
                className="mx-auto flex h-40 w-full max-w-xs flex-col items-center justify-center gap-3 rounded-2xl text-center"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[#0f241a] bg-[#eda33c] text-[#0f241a] shadow-[4px_4px_0_0_#0f241a]">
                  {busy ? <Loader2 size={26} className="animate-spin" aria-hidden="true" /> : <FileText size={26} aria-hidden="true" />}
                </span>
                <span className="text-sm font-bold text-stone-800">{busy ? t('reportsAnalyzing') : t('reportsUploadLabel')}</span>
                <span className="text-[11px] text-stone-600">PDF · CBC · LFT · KFT · Lipid · Thyroid · Vitamins</span>
              </button>
            </div>
          ) : (
            <div className="rounded-3xl border border-stone-200 bg-[#faf6ec] p-5">
              <label htmlFor="reports-text" className="mb-1.5 block text-[12px] font-bold uppercase tracking-[0.14em] text-stone-600">{t('reportsPasteLabel')}</label>
              <textarea
                id="reports-text"
                data-testid="reports-text"
                rows={7}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={t('reportsPastePh')}
                className="w-full rounded-xl border-2 border-stone-200 bg-[#fffdf7] p-3.5 text-[13px] font-medium leading-5 text-stone-900 placeholder:text-stone-400 focus:border-[#b8974f] focus:outline-none focus:ring-2 focus:ring-[#b8974f]/25"
              />
              <button
                onClick={() => runAnalysis(pasteText)}
                disabled={busy || pasteText.trim().length < 10}
                data-testid="reports-analyze"
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#0f241a] bg-[#eda33c] px-5 text-sm font-extrabold text-[#26251c] shadow-[4px_4px_0_0_#0f241a] transition hover:bg-[#f2c063] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <FlaskConical size={16} aria-hidden="true" />}
                {busy ? t('reportsAnalyzing') : t('reportsAnalyze')}
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50 p-4"
            role="alert"
            data-testid="reports-error"
          >
            <p className="flex items-start gap-2 text-xs font-semibold text-red-700">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Latest result */}
      {current && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-3xl border border-stone-200/90 bg-[#faf6ec] p-5" data-testid="reports-current">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold">{t('reportsSummary')}</h2>
              <p className="mt-0.5 text-xs text-stone-600">
                {current.found} {t('reportsFound')} · <strong className="text-[#8f3232]">{current.abnormal} {t('reportsAbnormal')}</strong>
              </p>
            </div>
            {current.abnormal === 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-[#b8974f]/50 bg-[#f4efdf] px-3 py-1 text-[11px] font-bold text-[#8a6215]">
                <Check size={13} aria-hidden="true" />{t('reportsAllNormal')}
              </span>
            )}
          </div>
          <ResultTable report={current} testid="reports-table" />
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-[#f4efdf] p-3.5 text-[11px] leading-5 text-stone-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#8a6215]" aria-hidden="true" />
            <p><strong>{t('reportsFollowUp')}:</strong> {t('reportsFollowUpBody')}</p>
          </div>
          <p className="mt-2 flex items-start gap-2 text-[11px] leading-5 text-stone-600">
            <X size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            {t('reportsDisclaimer')}
          </p>
        </motion.div>
      )}

      {/* Saved reports */}
      <div className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-stone-900">
          <FileText size={15} className="text-[#8a6215]" aria-hidden="true" />
          {t('reportsSaved')}
        </h2>
        {saved.length === 0 ? (
          <p className="rounded-2xl border border-stone-200 bg-[#faf6ec] p-5 text-xs leading-5 text-stone-600" data-testid="reports-empty">{t('reportsEmpty')}</p>
        ) : (
          <ul className="space-y-2.5">
            {saved.map((r) => (
              <li key={r.id} className="rounded-2xl border border-stone-200/90 bg-[#faf6ec] p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setOpenSaved(openSaved === r.id ? null : r.id)}
                    data-testid={`reports-open-${r.id}`}
                    aria-expanded={openSaved === r.id}
                  >
                    <p className="truncate text-sm font-bold text-stone-900">
                      {r.found} {t('reportsFound')} · {r.abnormal} {t('reportsAbnormal')}
                    </p>
                    <p className="mt-0.5 text-[11px] text-stone-600">{new Date(r.createdAt).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
                  </button>
                  <button
                    onClick={() => deleteReport(r.id)}
                    data-testid={`reports-del-${r.id}`}
                    aria-label={t('reportsDelete')}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 text-stone-500 transition hover:border-red-200 hover:text-red-600"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
                <AnimatePresence>
                  {openSaved === r.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                      <div className="mt-4"><ResultTable report={r} /></div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
