'use client'

import { useEffect, useState } from 'react'
import { Bell, BellRing, CalendarPlus, CheckCircle2, Circle, Clock3, Dumbbell, GlassWater, Moon, Pencil, Pill, Plus, Stethoscope, Tag, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'

import * as sync from '@/lib/sync'

const WHEN_OPTIONS = [['today', null], ['tomorrow', null], ['daily', null]]

// One-tap templates: everyday care that shouldn't need typing. Labels
// render from i18n so the chips and the saved reminder both follow the
// language toggle. Water spaced twice through the day, medicine with the
// night dose, walk in the evening, sleep wind-down.
const QUICK_TEMPLATES = [
  { key: 'water', time: '11:00', when: 'daily', type: 'water' },
  { key: 'walk', time: '18:30', when: 'daily', type: 'exercise' },
  { key: 'medicine', time: '21:00', when: 'daily', type: 'medication' },
  { key: 'sleep', time: '22:30', when: 'daily', type: 'sleep' },
]

const TYPES = [
  ['medication', Pill],
  ['appointment', Stethoscope],
  ['exercise', Dumbbell],
  ['water', GlassWater],
  ['sleep', Moon],
  ['followup', Undo2],
  ['other', Tag],
]

export function RemindersSection({ t, lang, reminders, onChange }) {
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('08:00')
  const [when, setWhen] = useState('today')
  const [type, setType] = useState('medication')
  // Edit mode: the form doubles as the editor for the reminder being edited.
  const [editing, setEditing] = useState(null)

  const whenLabel = (key) => (key === 'today' ? t('today') : key === 'tomorrow' ? t('tomorrow') : lang === 'hi' ? 'रोज़' : 'Daily')

  const resetForm = () => {
    setTitle('')
    setTime('08:00')
    setWhen('today')
    setType('medication')
    setEditing(null)
  }

  const submit = () => {
    const trimmed = title.trim()
    if (!trimmed || !/^\d{2}:\d{2}$/.test(time)) {
      toast.error(lang === 'hi' ? 'कृपया नाम और सही समय भरें' : 'Please add a name and a valid time')
      return
    }
    if (editing) {
      onChange(sync.updateReminder(editing, { title: trimmed, time, when, type }))
      toast.success(lang === 'hi' ? 'रिमाइंडर अपडेट हो गया' : 'Reminder updated')
      resetForm()
      return
    }
    sync.addReminder({ title: trimmed, time, when, type })
    onChange(sync.getRemindersFromLocal())
    setTitle('')
    toast.success(lang === 'hi' ? 'रिमाइंडर जोड़ा गया' : 'Reminder added')
  }

  const startEdit = (r) => {
    setEditing(r.id)
    setTitle(r.title)
    setTime(r.time)
    setWhen(r.when || 'today')
    setType(r.type || 'other')
  }

  const snooze = (r) => {
    const [h, m] = r.time.split(':').map(Number)
    let total = h * 60 + m + 10
    let nextWhen = r.when
    if (total >= 24 * 60) { total -= 24 * 60; if (r.when === 'today') nextWhen = 'tomorrow' }
    const hh = String(Math.floor(total / 60)).padStart(2, '0')
    const mm = String(total % 60).padStart(2, '0')
    onChange(sync.updateReminder(r.id, { time: `${hh}:${mm}`, when: nextWhen }))
    toast.success(t('reminderSnoozed'))
  }

  // Toggles flow through the sync layer's doneOn-day logic (undo clears
  // the marker server-side too) and re-render from the returned list.
  const toggle = (id) => onChange(sync.toggleReminder(id))
  const remove = (id) => {
    if (editing === id) resetForm()
    onChange(sync.deleteReminder(id))
    toast(lang === 'hi' ? 'रिमाइंडर हटाया गया' : 'Reminder deleted')
  }

  // ── Browser notifications (permission is asked on an explicit click) ──
  const [notifyState, setNotifyState] = useState('default')

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifyState(Notification.permission)
    }
  }, [])

  const askNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    try {
      const perm = await Notification.requestPermission()
      setNotifyState(perm)
      toast(perm === 'granted' ? t('reminderNotifyOn') : perm === 'denied' ? t('reminderNotifyDenied') : t('reminderNotifyAsk'))
    } catch {
      setNotifyState(Notification.permission)
    }
  }

  const pending = reminders.filter((r) => !r.done)
  const done = reminders.filter((r) => r.done)
  const typeLabel = (key) => t(`reminderKinds.${key || 'other'}`)

  return (
    <div data-testid="section-reminders" className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t('remindersTitle')}</h1>
        <p className="mt-2 text-sm text-stone-600">{t('remindersIntro')}</p>
      </div>

      {/* Quick add — one-tap everyday templates (no typing). Each fills
          and saves in a single click, then toasts so the pattern is
          obvious for the next one. */}
      <div className="mb-4" data-testid="rem-quick">
        <p className="mb-2 text-xs font-bold text-stone-800">
          {t('quickAdd')}
          <span className="ml-2 font-medium text-stone-600">{t('quickAddSub')}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {QUICK_TEMPLATES.map(({ key, title, time, type, when }) => (
            <button
              key={key}
              onClick={() => {
                sync.addReminder({ title: t(`quickTemplates.${key}`), time, when, type })
                onChange(sync.getRemindersFromLocal())
                toast.success(`${t(`quickTemplates.${key}`)} · ${time}`)
              }}
              data-testid={`rem-quick-${key}`}
              className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-[#fffdf7] px-3.5 py-2 text-xs font-bold text-stone-800 shadow-sm transition hover:-translate-y-0.5 hover:border-[#b8974f] hover:text-[#8a6215]"
            >
              <Plus size={13} aria-hidden="true" />
              {t(`quickTemplates.${key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Add / edit form */}
      <div className="mb-6 rounded-3xl border border-stone-200/80 bg-[#faf6ec] p-5 shadow-[0_7px_24px_-18px_rgba(15,23,42,.4)]" data-testid="rem-form">
        <label htmlFor="rem-title" className="block text-xs font-bold text-stone-800">{t('reminderTitleLabel')}</label>
        <input
          id="rem-title"
          data-testid="rem-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('reminderTitlePlaceholder')}
          maxLength={80}
          className="mt-2 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none placeholder:text-stone-600 focus:border-[#b8974f]"
        />
        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <span id="rem-type-label" className="block text-xs font-bold text-stone-800">{t('reminderKind')}</span>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="rem-type-label">
              {TYPES.map(([key, Icon]) => (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  data-testid={`rem-type-${key}`}
                  aria-pressed={type === key}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${type === key ? 'border-[#b8974f] bg-[#f4efdf] text-[#8a6215]' : 'border-stone-200 bg-[#faf6ec] text-stone-700 hover:border-[#b8974f]'}`}
                >
                  <Icon size={13} aria-hidden="true" />
                  {typeLabel(key)}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:w-44">
            <span id="rem-when-label" className="block text-xs font-bold text-stone-800">{t('reminderWhen')}</span>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="rem-when-label">
              {WHEN_OPTIONS.map(([key]) => (
                <button
                  key={key}
                  onClick={() => setWhen(key)}
                  data-testid={`rem-when-${key}`}
                  aria-pressed={when === key}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${when === key ? 'border-[#b8974f] bg-[#f4efdf] text-[#8a6215]' : 'border-stone-200 bg-[#faf6ec] text-stone-700 hover:border-[#b8974f]'}`}
                >
                  {whenLabel(key)}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:w-36">
            <label htmlFor="rem-time" className="block text-xs font-bold text-stone-800">{t('reminderTime')}</label>
            <input
              id="rem-time"
              data-testid="rem-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#b8974f]"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={submit} data-testid={editing ? 'rem-save-edit' : 'rem-add'} className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-[#0f241a] bg-[#eda33c] px-5 text-sm font-extrabold text-[#26251c] shadow-[4px_4px_0_0_#0f241a] transition hover:bg-[#f2c063]">
            <CalendarPlus size={16} aria-hidden="true" />
            {editing ? t('reminderSaveEdit') : t('reminderAddBtn')}
          </button>
          {editing && (
            <button onClick={resetForm} data-testid="rem-cancel-edit" className="flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 px-4 text-sm font-bold text-stone-700 hover:bg-stone-50">
              {t('reminderCancel')}
            </button>
          )}
          <button
            onClick={askNotifications}
            data-testid="rem-notify"
            aria-label={t('reminderNotify')}
            className={`ml-auto flex min-h-11 items-center gap-2 rounded-xl border px-4 text-xs font-bold transition ${notifyState === 'granted' ? 'border-[#b8974f]/50 bg-[#f4efdf] text-[#8a6215]' : 'border-stone-200 bg-[#fffdf7] text-stone-700 hover:border-[#b8974f]'}`}
          >
            {notifyState === 'granted' ? <BellRing size={15} aria-hidden="true" /> : <Bell size={15} aria-hidden="true" />}
            {t('reminderNotify')}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {reminders.length === 0 && (
        <div className="rounded-3xl border border-dashed border-stone-300 bg-[#faf6ec] p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
            <Bell size={26} aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm text-stone-600">{t('remindersEmpty')}</p>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <section aria-labelledby="rem-upcoming-h">
          <h2 id="rem-upcoming-h" className="mb-3 text-sm font-extrabold text-stone-900">
            {t('upcoming')} <span className="ml-1 rounded-full bg-stone-200 px-2 py-0.5 text-[11px] text-stone-700">{pending.length}</span>
          </h2>
          <ul className="space-y-2.5">
            {pending.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-[#faf6ec] p-4 shadow-[0_7px_24px_-18px_rgba(15,23,42,.4)]" data-testid="rem-item">
                <button onClick={() => toggle(r.id)} data-testid={`rem-toggle-${r.id}`} aria-label={`${t('reminderDone')} — ${r.title}`} className="shrink-0 text-stone-400 transition hover:text-[#8a6215]">
                  <Circle size={22} aria-hidden="true" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-stone-900">{r.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] font-semibold text-stone-600">
                    <span className="rounded-full bg-[#f4efdf] px-2 py-0.5 text-[10px] font-bold text-[#8a6215]" data-testid={`rem-kind-${r.id}`}>{typeLabel(r.type)}</span>
                    <Clock3 size={12} aria-hidden="true" />
                    {whenLabel(r.when)} · {r.time}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => snooze(r)} data-testid={`rem-snooze-${r.id}`} aria-label={`${t('reminderSnooze')} — ${r.title}`} className="rounded-xl p-2 text-stone-600 transition hover:bg-[#f4efdf] hover:text-[#8a6215]">
                    <Clock3 size={16} aria-hidden="true" />
                  </button>
                  <button onClick={() => startEdit(r)} data-testid={`rem-edit-${r.id}`} aria-label={`${t('reminderEdit')} — ${r.title}`} className="rounded-xl p-2 text-stone-600 transition hover:bg-stone-100 hover:text-stone-900">
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button onClick={() => remove(r.id)} data-testid={`rem-delete-${r.id}`} aria-label={`${t('reminderDelete')} — ${r.title}`} className="rounded-xl p-2 text-stone-600 transition hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Done */}
      {done.length > 0 && (
        <section aria-labelledby="rem-done-h" className="mt-6">
          <h2 id="rem-done-h" className="mb-3 text-sm font-extrabold text-stone-900">
            {t('done')} <span className="ml-1 rounded-full bg-[#f4e9d2] px-2 py-0.5 text-[11px] text-[#8a6215]">{done.length}</span>
          </h2>
          <ul className="space-y-2.5">
            {done.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-stone-50 p-4" data-testid="rem-item-done">
                <button onClick={() => toggle(r.id)} data-testid={`rem-undone-${r.id}`} aria-label={`${t('reminderUndone')} — ${r.title}`} className="shrink-0 text-[#8a6215]">
                  <CheckCircle2 size={22} aria-hidden="true" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-600 line-through">{r.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-stone-600">
                    <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-600">{typeLabel(r.type)}</span>
                    {whenLabel(r.when)} · {r.time}
                  </p>
                </div>
                <button onClick={() => remove(r.id)} data-testid={`rem-del-done-${r.id}`} aria-label={`${t('reminderDelete')} — ${r.title}`} className="shrink-0 rounded-xl p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600">
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
