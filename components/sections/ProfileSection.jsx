'use client'

import { useState } from 'react'
import { Brain, Check, Download, Pencil, PhoneCall, ShieldCheck, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import * as sync from '@/lib/sync'
import { getSession, clearSession } from '@/lib/auth-client'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const GENDERS = ['male', 'female', 'other']

export function ProfileSection({ t, lang, profile, onSaved, session, onHistoryCleared, onAccountDeleted }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(profile)
  const [memory, setMemory] = useState(!!profile.memoryEnabled)

  const startEdit = () => { setDraft(profile); setEditing(true) }
  const cancel = () => setEditing(false)

  const save = () => {
    const next = sync.saveProfile({
      name: draft.name.trim(),
      age: draft.age,
      gender: draft.gender,
      bloodGroup: draft.bloodGroup,
      height: draft.height,
      weight: draft.weight,
      conditions: draft.conditions,
      allergies: draft.allergies,
      medications: draft.medications,
      emergencyContact: draft.emergencyContact,
      memberSince: profile.memberSince,
      memoryEnabled: memory,
    })
    onSaved(next)
    setEditing(false)
    toast.success(t('profileSaved'))
  }

  const toggleMemory = (on) => {
    setMemory(on)
    const next = sync.saveProfile({ memoryEnabled: on })
    onSaved(next)
    toast(on ? t('memoryOn') : t('memoryOff'))
  }

  // ── Privacy actions ─────────────────────────────────────────────
  const exportData = () => {
    const data = sync.exportLocalData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aarogyagpt-data-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('privacyExported'))
  }

  const clearHistory = () => {
    if (!window.confirm(t('privacyClearConfirm'))) return
    sync.clearHistory()
    onHistoryCleared()
    toast.success(t('privacyCleared'))
  }

  const deleteAccount = async () => {
    const s = getSession()
    if (!s) return
    if (!window.confirm(t('privacyDeleteAccountConfirm'))) return
    try {
      const res = await sync.api('/auth/account', { method: 'DELETE', headers: { Authorization: `Bearer ${s.token}` } })
      if (!res.ok) throw new Error('status-' + res.status)
    } catch {
      // Server unreachable — still wipe this device; the account deletion
      // can be retried when back online. Tell the user honestly.
      toast.error(lang === 'hi' ? 'सर्वर से जुड़ नहीं पाए — डिवाइस का डेटा मिटा दिया, खाता अभी सर्वर पर है।' : 'Could not reach the server — device data wiped, but the account still exists there.')
    }
    sync.eraseAllLocal()
    clearSession()
    onAccountDeleted()
    toast.success(t('privacyDeletedAccount'))
  }

  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }))

  return (
    <div data-testid="section-profile" className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t('profileTitle')}</h1>
        <p className="mt-2 text-sm text-stone-600">{t('profileIntro')}</p>
      </div>

      {!editing ? (
        <div className="rounded-3xl border border-stone-200/80 bg-[#faf6ec] p-6 shadow-[0_7px_24px_-18px_rgba(15,23,42,.4)]">
          {/* Identity header */}
          <div className="flex flex-col items-center gap-4 border-b border-stone-100 pb-6 text-center sm:flex-row sm:text-left">
            <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#f4e9d2] text-2xl font-extrabold text-[#8a6215]">
              {profile.name?.trim() ? profile.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join('') : t('initialsFallback')}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-extrabold text-stone-900">{profile.name?.trim() || (lang === 'hi' ? 'अतिथि' : 'Guest')}</p>
              <p className="mt-1 text-xs text-stone-600">
                {t('memberSince')} {profile.memberSince}
                {profile.age ? ` · ${profile.age} ${t('years')}` : ''}
              </p>
            </div>
            <button onClick={startEdit} data-testid="profile-edit" className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-stone-200 px-4 text-xs font-bold text-stone-700 hover:border-[#b8974f] hover:bg-[#f4e9d2]">
              <Pencil size={14} aria-hidden="true" />
              {t('editProfile')}
            </button>
          </div>

          {/* Details */}
          <dl className="grid gap-4 pt-6 sm:grid-cols-2">
            <Detail label={t('profileBlood')} value={profile.bloodGroup || t('bloodUnknown')} />
            <Detail label={t('profileGender')} value={profile.gender ? t(`profileGenderOptions.${profile.gender}`) : '—'} />
            <Detail label={t('profileAge')} value={profile.age ? `${profile.age} ${t('years')}` : '—'} />
            <Detail label={t('profileHeight')} value={profile.height ? `${profile.height} cm` : '—'} />
            <Detail label={t('profileWeight')} value={profile.weight ? `${profile.weight} kg` : '—'} />
            <Detail label={t('profileEmergencyContact')} value={profile.emergencyContact || '—'} />
            <Detail label={t('profileConditions')} value={profile.conditions || '—'} wide />
            <Detail label={t('profileAllergies')} value={profile.allergies || '—'} wide />
            <Detail label={t('profileMedications')} value={profile.medications || '—'} wide />
          </dl>

          {profile.emergencyContact && (
            <a
              href={`tel:${(profile.emergencyContact.match(/\+?\d[\d\s-]{7,15}/) || ['112'])[0].replace(/[\s-]/g, '')}`}
              className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 hover:bg-red-100"
              data-testid="profile-call-emergency"
            >
              <PhoneCall size={16} aria-hidden="true" />
              {lang === 'hi' ? 'आपातकालीन संपर्क को कॉल करें' : 'Call emergency contact'}
            </a>
          )}

          <p className="mt-6 flex items-start gap-2 rounded-2xl bg-[#f4efdf] p-4 text-[11px] leading-5 text-stone-600">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#8a6215]" aria-hidden="true" />
            {t('profileIntro')}
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-stone-200/80 bg-[#faf6ec] p-6 shadow-[0_7px_24px_-18px_rgba(15,23,42,.4)]">
          <div className="grid gap-4">
            <Field id="pr-name" label={t('profileName')}>
              <input id="pr-name" data-testid="profile-name" value={draft.name} onChange={set('name')} placeholder={t('profileNamePlaceholder')} maxLength={60} className="h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none placeholder:text-stone-600 focus:border-[#b8974f]" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="pr-age" label={t('profileAge')}>
                <input id="pr-age" data-testid="profile-age" type="number" min="0" max="120" value={draft.age} onChange={set('age')} className="h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#b8974f]" />
              </Field>
              <Field id="pr-blood" label={t('profileBlood')}>
                <select id="pr-blood" data-testid="profile-blood" value={draft.bloodGroup} onChange={set('bloodGroup')} className="h-11 w-full rounded-xl border border-stone-200 bg-[#faf6ec] px-3 text-sm outline-none focus:border-[#b8974f]">
                  <option value="">{t('bloodUnknown')}</option>
                  {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="pr-gender" label={t('profileGender')}>
                <select id="pr-gender" data-testid="profile-gender" value={draft.gender} onChange={set('gender')} className="h-11 w-full rounded-xl border border-stone-200 bg-[#faf6ec] px-3 text-sm outline-none focus:border-[#b8974f]">
                  <option value="">—</option>
                  {GENDERS.map((g) => <option key={g} value={g}>{t(`profileGenderOptions.${g}`)}</option>)}
                </select>
              </Field>
              <Field id="pr-height" label={t('profileHeight')}>
                <input id="pr-height" data-testid="profile-height" type="number" min="0" max="300" value={draft.height} onChange={set('height')} className="h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#b8974f]" />
              </Field>
              <Field id="pr-weight" label={t('profileWeight')}>
                <input id="pr-weight" data-testid="profile-weight" type="number" min="0" max="400" step="0.1" value={draft.weight} onChange={set('weight')} className="h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none focus:border-[#b8974f]" />
              </Field>
            </div>
            <Field id="pr-conditions" label={t('profileConditions')}>
              <input id="pr-conditions" data-testid="profile-conditions" value={draft.conditions} onChange={set('conditions')} placeholder={t('profileConditionsPlaceholder')} maxLength={200} className="h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none placeholder:text-stone-600 focus:border-[#b8974f]" />
            </Field>
            <Field id="pr-allergies" label={t('profileAllergies')}>
              <input id="pr-allergies" data-testid="profile-allergies" value={draft.allergies} onChange={set('allergies')} placeholder={t('profileAllergiesPlaceholder')} maxLength={200} className="h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none placeholder:text-stone-600 focus:border-[#b8974f]" />
            </Field>
            <Field id="pr-medications" label={t('profileMedications')}>
              <input id="pr-medications" data-testid="profile-medications" value={draft.medications} onChange={set('medications')} placeholder={t('profileMedicationsPlaceholder')} maxLength={200} className="h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none placeholder:text-stone-600 focus:border-[#b8974f]" />
            </Field>
            <Field id="pr-emergency" label={t('profileEmergencyContact')}>
              <input id="pr-emergency" data-testid="profile-emergency-contact" value={draft.emergencyContact} onChange={set('emergencyContact')} placeholder={t('profileEmergencyContactPlaceholder')} maxLength={120} className="h-11 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none placeholder:text-stone-600 focus:border-[#b8974f]" />
            </Field>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={save} data-testid="profile-save" className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-[#0f241a] bg-[#eda33c] px-5 text-sm font-extrabold text-[#26251c] shadow-[4px_4px_0_0_#0f241a] hover:bg-[#f2c063]">
              <Check size={16} aria-hidden="true" />
              {t('saveProfile')}
            </button>
            <button onClick={cancel} data-testid="profile-cancel" className="flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 px-5 text-sm font-bold text-stone-700 hover:bg-stone-50">
              <X size={16} aria-hidden="true" />
              {t('cancelEdit')}
            </button>
          </div>
        </div>
      )}

      {/* ── Health memory (consent-gated AI context) ── */}
      <section
        aria-labelledby="memory-h"
        className="mt-6 rounded-3xl border border-stone-200/80 bg-[#faf6ec] p-6 shadow-[0_7px_24px_-18px_rgba(15,23,42,.4)]"
        data-testid="memory-card"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f4efdf] text-[#8a6215]">
              <Brain size={19} aria-hidden="true" />
            </span>
            <div>
              <h2 id="memory-h" className="text-sm font-extrabold text-stone-900">{t('memoryTitle')}</h2>
              <p className="mt-1 max-w-md text-[12px] leading-5 text-stone-600">{t('memoryIntro')}</p>
            </div>
          </div>
          <button
            role="switch"
            aria-checked={memory}
            aria-label={t('memoryToggle')}
            data-testid="memory-toggle"
            onClick={() => toggleMemory(!memory)}
            className={`relative h-7 w-12 shrink-0 rounded-full border-2 transition ${memory ? 'border-[#b8974f] bg-[#eda33c]' : 'border-stone-300 bg-stone-100'}`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-all ${memory ? 'left-[22px]' : 'left-0.5'}`}
            />
          </button>
        </div>
        <p className="mt-4 rounded-2xl bg-[#f4efdf] p-3 text-[11px] leading-5 text-stone-600" data-testid="memory-status">
          {memory ? t('memoryOn') : t('memoryOff')} · {t('memoryHint')}
        </p>
      </section>

      {/* ── Privacy controls ── */}
      <section
        aria-labelledby="privacy-h"
        className="mt-6 rounded-3xl border border-stone-200/80 bg-[#faf6ec] p-6 shadow-[0_7px_24px_-18px_rgba(15,23,42,.4)]"
        data-testid="privacy-card"
      >
        <h2 id="privacy-h" className="text-sm font-extrabold text-stone-900">{t('privacyTitle')}</h2>
        <p className="mt-1 text-[12px] text-stone-600">{t('privacyIntro')}</p>

        {!session?.email && (
          <p className="mt-4 rounded-2xl border border-[#b8974f]/50 bg-[#f4efdf] p-3 text-[11px] leading-5 text-stone-600" data-testid="privacy-guest-note">
            {t('privacyGuestNote')}
          </p>
        )}

        <ul className="mt-4 space-y-3">
          <li className="flex flex-col gap-2 rounded-2xl border border-stone-200/80 bg-[#fffdf7] p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-stone-900">{t('privacyExport')}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-stone-600">{t('privacyExportHint')}</p>
            </div>
            <button onClick={exportData} data-testid="privacy-export" className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-stone-200 bg-[#faf6ec] px-4 text-xs font-bold text-stone-700 hover:border-[#b8974f]">
              <Download size={14} aria-hidden="true" />
              {t('privacyExport')}
            </button>
          </li>
          <li className="flex flex-col gap-2 rounded-2xl border border-stone-200/80 bg-[#fffdf7] p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-stone-900">{t('privacyClear')}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-stone-600">{t('privacyClearHint')}</p>
            </div>
            <button onClick={clearHistory} data-testid="privacy-clear-history" className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-bold text-red-700 hover:bg-red-100">
              <Trash2 size={14} aria-hidden="true" />
              {t('privacyClear')}
            </button>
          </li>
          {session?.email && (
            <li className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50/60 p-4 sm:flex-row sm:items-center" data-testid="privacy-account-row">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-red-700">{t('privacyDeleteAccount')}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-red-600/90">{t('privacyDeleteAccountHint')}</p>
              </div>
              <button onClick={deleteAccount} data-testid="privacy-delete-account" className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-bold text-white hover:bg-red-700">
                <Trash2 size={14} aria-hidden="true" />
                {t('privacyDeleteAccount')}
              </button>
            </li>
          )}
        </ul>
      </section>
    </div>
  )
}

function Field({ id, label, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-stone-800">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function Detail({ label, value, wide }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-stone-600">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-stone-900">{value}</dd>
    </div>
  )
}
