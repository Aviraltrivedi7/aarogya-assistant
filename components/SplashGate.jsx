'use client'

// Splash + auth gate. First visit: animated splash → signup/login.
// Returning visitors with a saved session skip both and land on the app.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Eye, EyeOff, Languages, Loader2, Lock, LogIn, Mail, UserRound,
} from 'lucide-react'

import { authenticate } from '@/lib/auth-client'
import { LogoMark } from '@/components/LogoMark'

export function SplashGate({ lang, onToggleLang, onDone, onSplashDone, t }) {
  const [stage, setStage] = useState('splash') // splash → auth
  const [mode, setMode] = useState('login') // login | signup
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Splash plays ~2.2s, then rolls into the auth screen. If the parent
  // provided onSplashDone it may instead unmount this gate entirely
  // (returning visitor with a saved session goes straight to the app).
  useEffect(() => {
    if (stage !== 'splash') return
    const timer = setTimeout(() => {
      setStage('auth')
      if (onSplashDone) onSplashDone()
    }, 2200)
    return () => clearTimeout(timer)
  }, [onSplashDone, stage])

  const submit = useCallback(async (e) => {
    e.preventDefault()
    if (busy) return
    setError('')
    if (!email.trim() || !password) {
      setError(lang === 'hi' ? 'ईमेल और पासवर्ड भरें' : 'Enter your email and password')
      return
    }
    if (mode === 'signup' && password.length < 6) {
      setError(lang === 'hi' ? 'पासवर्ड कम से कम 6 अक्षर का हो' : 'Password must be at least 6 characters')
      return
    }
    setBusy(true)
    try {
      await authenticate({ mode, name: name.trim(), email: email.trim(), password })
      onDone({
        name: mode === 'signup' ? (name.trim() || email.split('@')[0]) : email.split('@')[0],
        email: email.trim(),
      })
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }, [busy, email, lang, mode, name, onDone, password])

  const pwType = showPw ? 'text' : 'password'

  const inputCls = 'h-12 w-full rounded-xl border-2 border-stone-200 bg-[#fffdf7] pl-11 pr-4 text-[15px] font-medium text-stone-900 placeholder:text-stone-400 focus:border-[#b8974f] focus:outline-none focus:ring-2 focus:ring-[#b8974f]/25'
  const labelCls = 'mb-1.5 block text-[12px] font-bold uppercase tracking-[0.14em] text-stone-600'

  const splash = useMemo(() => (
    <motion.main
      key="splash"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[#f5f0e3] px-8 text-center"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.55, ease: 'easeInOut' } }}
    >
      {/* warm paper layers: marigold tint from the top-left, antique gold from the bottom */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_620px_at_18%_-8%,rgba(237,163,60,0.16),transparent_60%),radial-gradient(900px_560px_at_85%_108%,rgba(184,151,79,0.12),transparent_58%)]" aria-hidden="true" />
      {/* ink dot texture, same paper the app uses */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{ backgroundImage: 'radial-gradient(rgba(38,37,28,0.05) 1px, transparent 1.2px)', backgroundSize: '22px 22px' }}
        aria-hidden="true"
      />
      {/* thin antique-gold frame — a journal cover, not a screen */}
      <div className="pointer-events-none absolute inset-4 rounded-[28px] border border-[#b8974f]/45 sm:inset-7" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-[22px] rounded-[24px] border border-[#b8974f]/25 sm:inset-[30px]" aria-hidden="true" />

      {/* logo tile — the deep forest green lives HERE, on paper */}
      <motion.div
        initial={{ scale: 0.55, opacity: 0, rotate: -6 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 18 }}
        className="relative"
        data-testid="splash-logo"
      >
        <LogoMark size={96} />
        <motion.span
          className="absolute -right-2.5 -top-2.5 flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#0f241a] bg-[#f2c063] text-[#8a6215]"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.55, type: 'spring', stiffness: 380, damping: 15 }}
          aria-hidden="true"
        >
          <Languages size={15} strokeWidth={2.4} />
        </motion.span>
        {/* slow heartbeat under the tile — logo ek dil ki tarah dhadakta hai */}
        <motion.span
          className="absolute -bottom-3 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[#eda33c]"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.35, 1], opacity: [0, 0.9, 0] }}
          transition={{ delay: 0.9, duration: 1.1, repeat: Infinity, repeatDelay: 0.9, ease: 'easeOut' }}
          aria-hidden="true"
        />
      </motion.div>

      <motion.h1
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.5, ease: 'easeOut' }}
        className="font-display mt-9 text-[42px] font-extrabold tracking-tight text-stone-900"
      >
        Aarogya<span className="text-[#b8974f]">GPT</span>
      </motion.h1>
      <motion.p
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.5, ease: 'easeOut' }}
        className="mt-2 text-[15px] font-medium text-stone-600"
      >
        {t('auth.splashTagline')}
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className="mt-1 text-[12px] font-bold uppercase tracking-[0.28em] text-[#8a6215]"
      >
        {t('auth.splashLangs')}
      </motion.p>

      {/* progress ink on paper */}
      <motion.div
        className="mt-12 h-1.5 w-44 overflow-hidden rounded-full bg-[#e4dcc8] shadow-[inset_0_1px_2px_rgba(15,36,26,0.12)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        aria-hidden="true"
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#eda33c] to-[#b8974f]"
          initial={{ x: '-100%' }}
          animate={{ x: '0%' }}
          transition={{ delay: 0.7, duration: 1.35, ease: [0.65, 0, 0.35, 1] }}
        />
      </motion.div>
    </motion.main>
  ), [t])

  const auth = useMemo(() => (
    <motion.main
      key="auth"
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* ivory dot paper */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: 'radial-gradient(rgba(38,37,28,0.055) 1px, transparent 1.2px)', backgroundSize: '22px 22px' }}
        aria-hidden="true"
      />
      {/* language toggle */}
      <button
        onClick={onToggleLang}
        data-testid="auth-lang"
        aria-label={t('languageSwitch')}
        className="absolute right-5 top-5 z-10 flex h-10 items-center gap-2 rounded-xl border-2 border-stone-200 bg-[#fffdf7] px-3.5 text-xs font-bold text-stone-700 shadow-sm transition hover:border-[#b8974f]"
      >
        <Languages size={15} className="text-[#8a6215]" aria-hidden="true" />
        <span aria-hidden="true">{lang === 'en' ? 'EN' : 'HI'}</span>
      </button>

      <div className="relative z-10 w-full max-w-[440px]">
        {/* brand strip */}
        <div className="mb-7 flex items-center justify-center gap-3">
          <LogoMark size={48} />
          <h1 className="font-display text-[24px] font-extrabold tracking-tight text-stone-900">
            Aarogya<span className="text-[#8a6215]">GPT</span>
          </h1>
        </div>

        <div className="rounded-[26px] border-2 border-[#0f241a] bg-[#fffdf7] p-7 shadow-[8px_8px_0_0_#0f241a] sm:p-9">
          <div
            className="mb-6 grid grid-cols-2 gap-1.5 rounded-xl bg-[#efe9d8] p-1.5"
            role="tablist"
            aria-label={t('auth.tabLogin')}
          >
            {(['login', 'signup'] || []).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => { setMode(m); setError('') }}
                data-testid={`auth-tab-${m}`}
                className={`relative h-11 rounded-lg text-[13.5px] font-bold transition ${mode === m ? 'text-[#f5f0e3]' : 'text-stone-600 hover:text-stone-900'}`}
              >
                {mode === m && (
                  <motion.span
                    layoutId="auth-tab-pill"
                    className="absolute inset-0 rounded-lg bg-[#0f241a] shadow-md shadow-black/20"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-10">{t(m === 'login' ? 'auth.tabLogin' : 'auth.tabSignup')}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: mode === 'login' ? -14 : 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === 'login' ? 14 : -14 }}
              transition={{ duration: 0.22 }}
            >
              <h2 className="font-display text-[26px] font-extrabold tracking-tight text-stone-900">
                {t(mode === 'login' ? 'auth.loginTitle' : 'auth.signupTitle')}
              </h2>
              <p className="mt-1 text-[13.5px] font-medium text-stone-600">
                {t(mode === 'login' ? 'auth.loginSub' : 'auth.signupSub')}
              </p>

              <form onSubmit={submit} className="mt-6 space-y-4" data-testid={`form-${mode}`} noValidate>
                <AnimatePresence initial={false}>
                  {mode === 'signup' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <label htmlFor="auth-name" className={labelCls}>{t('auth.name')}</label>
                      <div className="relative">
                        <UserRound size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true" />
                        <input
                          id="auth-name"
                          type="text"
                          autoComplete="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={t('auth.namePh')}
                          maxLength={60}
                          className={inputCls}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label htmlFor="auth-email" className={labelCls}>{t('auth.email')}</label>
                  <div className="relative">
                    <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true" />
                    <input
                      id="auth-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('auth.emailPh')}
                      className={inputCls}
                      data-testid="auth-email"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="auth-password" className={labelCls}>{t('auth.password')}</label>
                  <div className="relative">
                    <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true" />
                    <input
                      id="auth-password"
                      type={pwType}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('auth.passwordPh')}
                      className={`${inputCls} pr-12`}
                      data-testid="auth-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
                    >
                      {showPw ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="rounded-lg border-2 border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] font-semibold text-red-700"
                      role="alert"
                      data-testid="auth-error"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={busy}
                  data-testid="auth-submit"
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#0f241a] bg-[#eda33c] text-[15px] font-extrabold text-[#26251c] shadow-[4px_4px_0_0_#0f241a] transition hover:bg-[#f2c063] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_0_#0f241a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy
                    ? <><Loader2 size={17} className="animate-spin" aria-hidden="true" />{t('auth.working')}</>
                    : <><LogIn size={17} aria-hidden="true" />{t(mode === 'login' ? 'auth.loginBtn' : 'auth.signupBtn')}</>}
                </button>
              </form>

              <div className="my-5 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-stone-200" />
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">{lang === 'hi' ? 'या' : 'or'}</span>
                <span className="h-px flex-1 bg-stone-200" />
              </div>

              <button
                onClick={() => onDone(null)}
                data-testid="auth-guest"
                className="flex h-11 w-full items-center justify-center rounded-xl border-2 border-stone-300 bg-transparent text-[13.5px] font-bold text-stone-700 transition hover:border-[#b8974f] hover:text-[#8a6215]"
              >
                {t('auth.guest')}
              </button>
              <p className="mt-2.5 text-center text-[12px] font-medium text-stone-500">{t('auth.guestSub')}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="mt-6 text-center text-[13px] font-semibold text-stone-600">
          {mode === 'login' ? t('auth.needAccount') : t('auth.haveAccount')}{' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
            data-testid="auth-switch"
            className="font-bold text-[#8a6215] underline decoration-[#b8974f] decoration-2 underline-offset-[3px] transition hover:text-[#0f241a]"
          >
            {mode === 'login' ? t('auth.tabSignup') : t('auth.tabLogin')}
          </button>
        </p>
      </div>
    </motion.main>
  ), [busy, email, error, inputCls, lang, mode, name, onToggleLang, password, pwType, showPw, submit, t])

  return (
    <AnimatePresence mode="wait">
      {stage === 'splash' ? splash : auth}
    </AnimatePresence>
  )
}
