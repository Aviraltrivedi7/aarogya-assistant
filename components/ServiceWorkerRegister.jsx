'use client'

import { useEffect } from 'react'

// Registers the offline shell service worker — PRODUCTION ONLY.
// In dev, next's HMR writes churn through the same /_next/* paths the
// worker caches, and a stale precache turns every code change into a
// "why is this not updating" debugging session (known trap).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])
  return null
}
