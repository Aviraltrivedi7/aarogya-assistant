// PWA manifest — makes AarogyaGPT installable on phones/desktops.
export default function manifest() {
  return {
    name: 'AarogyaGPT — Your AI Health Companion',
    short_name: 'AarogyaGPT',
    description: 'AI-powered health guidance in English and Hindi. Symptom checks, nearby care, reminders, insights — private by design.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f0e3',
    theme_color: '#f5f0e3',
    categories: ['health', 'medical', 'productivity'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
