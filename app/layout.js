import './globals.css'
// Ek Type (Indian foundry) fonts — Baloo 2 for display/headings gives the brand
// a warm, human personality; Mukta renders both Latin and Devanagari beautifully.
import '@fontsource/baloo-2/400.css'
import '@fontsource/baloo-2/500.css'
import '@fontsource/baloo-2/600.css'
import '@fontsource/baloo-2/700.css'
import '@fontsource/baloo-2/800.css'
import '@fontsource/mukta/400.css'
import '@fontsource/mukta/500.css'
import '@fontsource/mukta/600.css'
import '@fontsource/mukta/700.css'

export const metadata = {
  title: {
    default: 'AarogyaGPT — Your AI Health Companion',
    template: '%s · AarogyaGPT',
  },
  description: 'AI-powered health guidance in English and Hindi. Symptom checks, nearby care, reminders and health education — private by design.',
  keywords: ['health assistant', 'symptom checker', 'AarogyaGPT', 'AI health', 'Hindi health app', 'India emergency numbers'],
  applicationName: 'AarogyaGPT',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'AarogyaGPT', statusBarStyle: 'black-translucent' },
  openGraph: {
    title: 'AarogyaGPT — Your AI Health Companion',
    description: 'AI-powered health guidance in English and Hindi. Private by design.',
    type: 'website',
    locale: 'en_IN',
    siteName: 'AarogyaGPT',
  },
  robots: { index: true, follow: true },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f5f0e3',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
