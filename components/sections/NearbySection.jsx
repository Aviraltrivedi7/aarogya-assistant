'use client'

import { useState } from 'react'
import { Building2, MapPin, Navigation, Pill, RefreshCw, Search, Stethoscope } from 'lucide-react'

import * as sync from '@/lib/sync'

// Server-side Overpass proxy does the heavy lifting (mirrors + timeouts).
// The KINDS map stays here for icons/labels/filtering in the UI.
const KINDS = {
  hospital: { tags: 'amenity=hospital', label: 'hospitals', Icon: Building2, tone: 'bg-red-50 text-red-600' },
  clinic: { tags: 'amenity=clinic', label: 'clinics', Icon: Stethoscope, tone: 'bg-[#f4e9d2] text-[#8a6215]' },
  pharmacy: { tags: 'amenity=pharmacy', label: 'pharmacies', Icon: Pill, tone: 'bg-[#f4e9d2] text-[#8a6215]' },
}

function metersAway(m) {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`
}

function distance(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function NearbySection({ t, lang }) {
  const [status, setStatus] = useState('idle') // idle | locating | error | done | none | loaderror
  const [places, setPlaces] = useState([])
  const [filter, setFilter] = useState('all')

  const locate = async () => {
    if (!navigator.geolocation) { setStatus('error'); return }
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords
        try {
          const raw = await sync.nearbyViaServer(lat, lon)
          const found = raw
            .map((p) => ({
              ...p,
              name: p.name || (p.kind === 'pharmacy' ? t('pharmacies') : p.kind === 'hospital' ? t('hospitals') : t('clinics')),
              dist: distance(lat, lon, p.lat, p.lon),
            }))
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 30)
          setPlaces(found)
          setStatus(found.length === 0 ? 'none' : 'done')
        } catch {
          setStatus('loaderror')
        }
      },
      () => setStatus('error'),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
    )
  }

  const shown = filter === 'all' ? places : places.filter((p) => p.kind === filter)
  const filters = ['all', 'hospital', 'clinic', 'pharmacy']

  return (
    <div data-testid="section-nearby" className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t('nearbyTitle')}</h1>
          <p className="mt-2 max-w-lg text-sm text-stone-600">{t('nearbyIntro')}</p>
        </div>
        <button
          onClick={locate}
          disabled={status === 'locating'}
          data-testid="nearby-locate"
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border-2 border-[#0f241a] bg-[#eda33c] px-5 text-sm font-extrabold text-[#26251c] shadow-[4px_4px_0_0_#0f241a] transition hover:bg-[#f2c063] disabled:opacity-60"
        >
          {status === 'locating' ? <RefreshCw size={16} className="animate-spin" aria-hidden="true" /> : <Navigation size={16} aria-hidden="true" />}
          {status === 'locating' ? t('nearbyLocating') : t('nearbyLocate')}
        </button>
      </div>

      <p className="mb-5 flex items-start gap-2 rounded-2xl border border-[#b8974f]/40 bg-[#f4efdf] p-4 text-xs leading-5 text-stone-600">
        <MapPin size={15} className="mt-0.5 shrink-0 text-[#8a6215]" aria-hidden="true" />
        {t('nearbyHint')}
      </p>

      {/* Filters */}
      {(status === 'done' || status === 'none') && places.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label={t('nearbyResults')}>
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              data-testid={`nearby-filter-${f}`}
              aria-pressed={filter === f}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${filter === f ? 'border-[#b8974f] bg-[#f4efdf] text-[#8a6215]' : 'border-stone-200 bg-[#faf6ec] text-stone-700 hover:border-[#b8974f]'}`}
            >
              {f !== 'all' && (() => { const { Icon } = KINDS[f]; return <Icon size={13} aria-hidden="true" /> })()}
              {t(f === 'all' ? 'all' : KINDS[f].label)}
            </button>
          ))}
        </div>
      )}

      {/* Statuses */}
      {status === 'idle' && <p className="rounded-2xl border border-dashed border-stone-300 bg-[#faf6ec] p-8 text-center text-sm text-stone-600">{t('nearbyEmpty')}</p>}
      {status === 'locating' && <p className="rounded-2xl border border-stone-200 bg-[#faf6ec] p-8 text-center text-sm text-stone-600">{t('nearbyLocating')}</p>}
      {status === 'error' && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center" role="alert">
          <p className="text-sm font-semibold text-red-700">{t('nearbyError')}</p>
          <button onClick={locate} data-testid="nearby-retry" className="mt-3 rounded-xl border border-red-200 bg-[#faf6ec] px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100">{t('retry')}</button>
        </div>
      )}
      {status === 'loaderror' && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center" role="alert">
          <p className="text-sm font-semibold text-red-700">{t('nearbyLoadError')}</p>
          <button onClick={locate} className="mt-3 rounded-xl border border-red-200 bg-[#faf6ec] px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100">{t('retry')}</button>
        </div>
      )}
      {status === 'none' && <p className="rounded-2xl border border-dashed border-stone-300 bg-[#faf6ec] p-8 text-center text-sm text-stone-600">{t('nearbyNone')}</p>}

      {/* Results */}
      {status === 'done' && shown.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="nearby-results">
          {shown.map((p) => {
            const kind = KINDS[p.kind] ? p.kind : 'clinic'
            const { Icon, tone } = KINDS[kind]
            return (
              <li key={p.id} className="flex items-start gap-3 rounded-2xl border border-stone-200/80 bg-[#faf6ec] p-4 shadow-[0_7px_24px_-18px_rgba(15,23,42,.4)]">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${tone}`}>
                  <Icon size={19} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-stone-900">{p.name}</p>
                  <p className="mt-1 text-[11px] font-semibold text-stone-600">
                    {t(KINDS[kind].label)} · {metersAway(p.dist)} {t('distanceAway')}
                  </p>
                  {p.phone && (
                    <a href={`tel:${p.phone.replace(/[^+\d]/g, '')}`} className="mt-1 inline-block text-[11px] font-bold text-[#8a6215] hover:underline">
                      {p.phone}
                    </a>
                  )}
                </div>
                <a
                  href={`https://www.google.com/maps?q=${p.lat},${p.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="nearby-maps"
                  aria-label={`${t('openInMaps')} — ${p.name}`}
                  className="shrink-0 rounded-xl border border-stone-200 p-2 text-stone-600 hover:border-[#b8974f] hover:bg-[#f4e9d2]"
                >
                  <MapPin size={16} aria-hidden="true" />
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
