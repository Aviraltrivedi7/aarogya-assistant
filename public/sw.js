// AarogyaGPT service worker — offline-first shell.
//
// Strategy:
//   - Navigation (HTML): network-first. When offline, serve the cached
//     shell — the app is a client-side app, so the cached page boots and
//     every feature falls back to localStorage + the built-in triage
//     engine. No "no internet" brick.
//   - Static assets (_next/*, fonts, icons): cache-first (immutable
//     hashes — safe to keep).
//   - /api/*: network-first with a 1-entry cache only for GETs; writes
//     (POST/PATCH/DELETE) NEVER read from cache — they must hit the
//     server or fail honestly into device-only mode.
//
// Version bump = clients get a fresh shell on next load (old caches drop).
const VERSION = 'aarogyagpt-v1'
const SHELL = 'aarogyagpt-shell-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/icon.svg'])).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

const isStatic = (url) =>
  url.pathname.startsWith('/_next/') ||
  url.pathname.startsWith('/icon') ||
  url.pathname.startsWith('/manifest') ||
  /\.(woff2?|png|svg|css|js)$/.test(url.pathname)

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return // never intercept writes
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // API: network-first, honest failure. A cached GET response is better
  // than nothing when offline, but stale data must not outlive one entry.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(VERSION).then((c) => c.put(request, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.open(VERSION).then((c) => c.match(request)).then((hit) => hit || new Response(JSON.stringify({ error: 'offline', dbDown: true }), { status: 503, headers: { 'Content-Type': 'application/json' } })))
    )
    return
  }

  // Navigations: network-first, cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL).then((c) => c.put('/', copy)).catch(() => {})
          return res
        })
        .catch(() => caches.open(SHELL).then((c) => c.match('/')).then((hit) => hit || Response.error()))
    )
    return
  }

  // Static assets: cache-first.
  if (isStatic(url)) {
    event.respondWith(
      caches.open(SHELL).then((cache) =>
        cache.match(request).then((hit) => hit || fetch(request).then((res) => {
          const copy = res.clone()
          cache.put(request, copy).catch(() => {})
          return res
        }))
      )
    )
  }
})
