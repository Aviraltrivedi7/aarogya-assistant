'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { CloudOff, Copy, Mic, MicOff, PhoneCall, Send, ShieldCheck, Sparkles, Square, Volume2, VolumeX } from 'lucide-react'

import { LogoMark } from '@/components/LogoMark'

import { assessWithIntent, severityMeta } from '@/lib/triage'
import * as sync from '@/lib/sync'

const L = (lang) => (lang === 'hi' ? 'hi' : 'en')

// Compose a bot message's text in the ACTIVE language, at render time —
// this is what makes a language switch re-render old replies.
//
// Result shapes (all supported, old flat arrays still render):
//   rules (server + offline): reply/advice/seek = {en: [...], hi: [...]}
//   gpt: reply = flat array answered in msgLang, alt = rules fallback in the
//        other language, so switching shows a safe translation there.
function composeReply(result, lang, msgLang) {
  if (!result) return ''
  const l = L(lang)
  const flat = Array.isArray(result.reply)
  const pick = (obj) => (Array.isArray(obj) ? obj : obj?.[l])

  if (flat) {
    // GPT answered in msgLang; on a switch show the rules translation.
    if (l !== msgLang && result.alt?.reply?.length) return result.alt.reply.join('\n\n')
    return result.reply.join('\n\n')
  }
  const arr = pick(result.reply)
  if (arr?.length) return arr.join('\n\n')
  if (result.alt?.reply?.length) return result.alt.reply.join('\n\n')

  // Offline/local fallback result — compose from the structured fields.
  const parts = []
  if (result.emergency) {
    const advice = pick(result.advice)
    if (advice?.length) parts.push(advice[0])
  } else {
    const summary = result.summary?.[l] || result.summary?.en
    if (summary) parts.push(summary)
    const advice = pick(result.advice)
    if (advice?.length) parts.push(advice.join(' '))
    const seek = pick(result.seek)
    if (seek?.length) parts.push(seek.join(' '))
  }
  return parts.join('\n\n')
}

function stampOf(iso, lang) {
  const loc = (typeof Intl !== 'undefined' && Intl.DateTimeFormat.supportedLocalesOf('hi-IN').length)
    ? (lang === 'hi' ? 'hi-IN' : 'en-IN')
    : 'en-IN'
  return new Date(iso).toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' })
}

// Follow-up chips shown under the latest bot reply — picked by urgency so the
// next question matches the situation (an emergency never gets a "wait it
// out" chip; a mild cold never gets "is medicine needed").
function followUpsFor(result) {
  if (!result) return []
  const sev = result.severity
  if (sev === 'emergency' || sev === 'high') return ['whenDoctor', 'medicine', 'homeCare']
  if (sev === 'moderate') return ['homeCare', 'whenDoctor', 'medicine']
  return ['homeCare', 'howLong', 'prevent']
}

// Chip labels are short i18n strings; the question they send gets the
// assessment's topic inlined so the triage engine has context.
function followUpLabel(hi, key) {
  const labels = {
    homeCare: hi ? 'घर पर क्या करूँ?' : 'What can I do at home?',
    whenDoctor: hi ? 'डॉक्टर के पास कब?' : 'When should I see a doctor?',
    medicine: hi ? 'दवा ज़रूरी है?' : 'Is any medicine needed?',
    howLong: hi ? 'कितने दिन ठीक होगा?' : 'How long until it gets better?',
    prevent: hi ? 'अगली बार कैसे बचूँ?' : 'How can I prevent it?',
  }
  return labels[key]
}

function followUpText(hi, key, topic) {
  const t = topic || 'this'
  const texts = {
    homeCare: hi ? `मैं ${t} में घर पर क्या कर सकता हूँ?` : `What can I do at home for ${t}?`,
    whenDoctor: hi ? `${t} के लिए डॉक्टर के पास कब जाना चाहिए?` : `When should I see a doctor for ${t}?`,
    medicine: hi ? `${t} के लिए कोई दवा ज़रूरी है क्या?` : `Is any medicine needed for ${t}?`,
    howLong: hi ? `${t} में कितने दिन ठीक होऊँगा?` : `How long until ${t} gets better?`,
    prevent: hi ? `अगली बार ${t} से कैसे बचूँ?` : `How can I prevent ${t} next time?`,
  }
  return texts[key]
}

// Topic for the follow-up question — the assessment's own summary in the
// active language ("Fever", "बुखार + सिर दर्द"), falling back to the user's
// words when nothing was matched.
function topicOf(result, userText, lang) {
  const hi = lang === 'hi'
  const s = hi ? result?.summary?.hi : result?.summary?.en
  if (s && s !== 'Needs more detail' && s !== 'थोड़ी और जानकारी चाहिए' && s !== 'Possible emergency') {
    return s.toLowerCase()
  }
  return (typeof userText === 'string' ? userText.trim().slice(0, 40) : '') || (hi ? 'इस' : 'this')
}

export function AssistantSection({ t, lang, onNewCheck, openEmergency }) {
  const [messages, setMessages] = useState([
    { id: 'm0', role: 'bot', text: t('chatGreeting'), at: null },
  ])
  const [text, setText] = useState('')
  const [lastResult, setLastResult] = useState(null)
  const [thinking, setThinking] = useState(false)
  // Voice: SpeechRecognition isn't in React state — keep the instance in a ref
  // and mirror only its UI-facing states (listening / last error).
  const [listening, setListening] = useState(false)
  const [voiceError, setVoiceError] = useState(null)
  // speakOn = user's read-aloud preference for new replies; speaking = is a
  // synthesis actually playing right now (per-message button also sets it).
  const [speakOn, setSpeakOn] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const lastTopicRef = useRef('')
  const recogRef = useRef(null)
  const listRef = useRef(null)
  const inputRef = useRef(null)

  const sr = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null
  const voiceSupported = !!sr

  // Greeting follows language switches.
  useEffect(() => {
    setMessages((prev) => prev.map((m) => (m.id === 'm0' ? { ...m, text: t('chatGreeting') } : m)))
  }, [lang]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  // Stop any live recognition/synthesis when the section unmounts or the
  // language flips mid-listen (a recognizer can't swap its lang in place).
  useEffect(() => () => {
    try { recogRef.current?.stop() } catch {}
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
  }, [])

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  // Read a bot reply aloud in the active language. Chrome needs the rate
  // nudge for Devanagari voices or it races through the text.
  const speak = (body) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(body)
    u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
    u.rate = 0.97
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(u)
  }

  const send = async (raw) => {
    const value = (raw ?? text).trim()
    if (!value || thinking) return
    // Recent turns for GPT context (this session only) — the user's own
    // messages and the assistant's rendered answers, oldest first. Skips
    // the greeting; the server caps the array anyway.
    const priorTurns = []
    for (const m of messages) {
      if (m.id === 'm0') continue
      if (m.role === 'user') priorTurns.push({ role: 'user', content: String(m.text).slice(0, 500) })
      else if (m.role === 'bot' && m.result) priorTurns.push({ role: 'assistant', content: composeReply(m.result, lang, m.resultLang).slice(0, 500) })
    }
    setText('')
    setVoiceError(null)
    lastTopicRef.current = value
    setMessages((prev) => [...prev, { id: `u${Date.now()}`, role: 'user', text: value, at: new Date().toISOString() }])
    setThinking(true)

    // Server-side triage first; local engine (intent-aware) as offline
    // fallback — chips keep their specific answers even with no backend.
    let result = null
    try {
      result = await sync.assessViaServer(value, lang, priorTurns.slice(-6))
    } catch {
      result = assessWithIntent(value)
    }

    // History entry is written through the sync layer → server + device.
    const item = sync.addHistoryCheck({
      text: value,
      summary: result.summary[lang === 'hi' ? 'hi' : 'en'],
      severity: result.severity,
      lang,
    })
    onNewCheck(item)

    const replyText = composeReply(result, lang, lang)
    setMessages((prev) => [...prev, { id: `b${Date.now()}`, role: 'bot', result, resultLang: lang, at: new Date().toISOString() }])
    setLastResult(result)
    setThinking(false)
    if (speakOn) speak(replyText)
    inputRef.current?.focus()
  }

  const startListening = () => {
    if (!voiceSupported || listening) return
    setVoiceError(null)
    const recog = new sr()
    recogRef.current = recog
    recog.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
    recog.interimResults = true
    recog.continuous = false

    // Transcript lives in the closure, not state — onend can send it without
    // reading stale state or side-effecting inside a setState updater.
    let transcript = ''
    recog.onresult = (e) => {
      let finalText = ''
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript
        else interim += e.results[i][0].transcript
      }
      transcript = (finalText || interim).trim()
      setText(finalText || interim)
    }
    recog.onend = () => {
      setListening(false)
      // Auto-send only when the transcript is substantial — a stray "the"
      // shouldn't fire a triage run on its own.
      if (transcript.length >= 3) send(transcript)
    }
    recog.onerror = (e) => {
      setListening(false)
      setVoiceError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? t('micDenied') : t('micUnsupported'))
    }
    try {
      recog.start()
      setListening(true)
    } catch {
      setVoiceError(t('micUnsupported'))
    }
  }

  const stopListening = () => {
    try { recogRef.current?.stop() } catch {}
    setListening(false)
  }

  // Copy a reply to the clipboard; where clipboard is blocked (plain http,
  // old browsers) fall back to the share sheet — India's chat-first sharing.
  const [copiedId, setCopiedId] = useState(null)
  const copyReply = async (m, body) => {
    try {
      await navigator.clipboard.writeText(body)
      setCopiedId(m.id)
      setTimeout(() => setCopiedId((cur) => (cur === m.id ? null : cur)), 1600)
    } catch {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try { await navigator.share({ title: t('shareTitle'), text: body }) } catch {}
      }
    }
  }

  const quick = [
    ['fever', t('quickReplies.fever')],
    ['headache', t('quickReplies.headache')],
    ['stomach', t('quickReplies.stomach')],
    ['cough', t('quickReplies.cough')],
  ]

  const quickTexts = {
    fever: lang === 'hi' ? 'मुझे बुखार है' : 'I have a fever',
    headache: lang === 'hi' ? 'सिर दर्द है' : 'I have a headache',
    stomach: lang === 'hi' ? 'पेट दर्द है' : 'I have stomach pain',
    cough: lang === 'hi' ? 'खाँसी और ज़ुकाम है' : 'I have a cough and cold',
  }

  return (
    <div data-testid="section-assistant" className="mx-auto max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mb-6"
      >
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <LogoMark size={44} className="mb-2 sm:mb-1" />
            <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">{t('assistantTitle')}</h1>
            <p className="text-sm text-stone-600">{t('assistantSub')}</p>
          </div>
          <button
            onClick={() => { if (speakOn) stopSpeaking(); setSpeakOn(!speakOn) }}
            data-testid="speak-toggle"
            aria-pressed={speakOn}
            className={`flex shrink-0 items-center gap-2 self-center rounded-full border px-3 py-1.5 text-[11px] font-bold transition sm:self-auto ${speakOn
              ? 'border-[#b8974f] bg-[#f4efdf] text-[#8a6215]'
              : 'border-stone-200 bg-[#faf6ec] text-stone-600 hover:border-[#b8974f]'}`}
          >
            {speaking ? <Volume2 size={14} className="animate-pulse" aria-hidden="true" /> : speakOn ? <Volume2 size={14} aria-hidden="true" /> : <VolumeX size={14} aria-hidden="true" />}
            {speakOn ? t('speakOn') : t('speakOff')}
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden rounded-3xl border border-stone-200 bg-[#faf6ec] shadow-[0_24px_60px_-30px_rgba(15,23,42,.35)]"
      >
        {/* Messages */}
        <div
          ref={listRef}
          data-testid="chat-messages"
          aria-live="polite"
          aria-label={t('assistantTitle')}
          className="h-[420px] space-y-3 overflow-y-auto bg-stone-50 p-4 text-sm md:h-[480px]"
        >
          {messages.map((m) => {
            const body = m.role === 'bot' && m.result ? composeReply(m.result, lang, m.resultLang) : m.text
            const stamp = m.at ? stampOf(m.at, lang) : null
            return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              {m.role === 'bot' && m.result?.emergency ? (
                <div className="w-full rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-xs font-bold leading-5 text-red-800">{body}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href="tel:112" data-testid="chat-call-112" className="flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-bold text-white hover:bg-red-700">
                      <PhoneCall size={15} aria-hidden="true" />
                      {t('triage.callNow')}
                    </a>
                    <button onClick={openEmergency} data-testid="chat-emergency-dir" className="flex min-h-10 items-center rounded-xl border border-red-200 bg-[#faf6ec] px-4 text-xs font-bold text-red-700 hover:bg-red-100">
                      {t('emergencyDirTitle')}
                    </button>
                  </div>
                  {stamp && <p className="mt-2 text-right text-[11px] font-semibold text-red-700">{stamp}</p>}
                </div>
              ) : (
                <div className="max-w-[85%]">
                  <div className={`whitespace-pre-line rounded-2xl p-3 leading-6 ${m.role === 'user'
                    ? 'rounded-tr-sm border-2 border-[#0f241a] bg-[#26251c] text-[#f5f0e3] shadow-md'
                    : 'rounded-tl-sm border border-stone-200 bg-[#faf6ec] text-stone-700 shadow-sm'}`}
                  >
                    {m.role === 'bot' && m.result?.source === 'gpt' && (
                      <span className="mb-1.5 flex w-fit items-center gap-1 rounded-md bg-[#f4efdf] px-1.5 py-0.5 text-[10px] font-bold text-[#8a6215]" data-testid="gpt-badge">
                        <Sparkles size={11} aria-hidden="true" />
                        {lang === 'hi' ? 'AI उत्तर' : 'AI answer'}
                      </span>
                    )}
                    {body}
                  </div>
                  <div className={`mt-1 flex items-center gap-1.5 text-[10px] text-stone-600 ${m.role === 'user' ? 'justify-end' : ''}`}>
                    {m.role === 'bot' && (
                      <>
                        <button
                          onClick={() => copyReply(m, body)}
                          data-testid="msg-copy"
                          aria-label={copiedId === m.id ? t('copied') : t('copyReply')}
                          title={t('copyReply')}
                          className="rounded p-0.5 transition hover:text-[#8a6215]"
                        >
                          {copiedId === m.id
                            ? <span className="font-bold text-[#8a6215]">{t('copied')}</span>
                            : <Copy size={12} aria-hidden="true" />}
                        </button>
                        <button
                          onClick={() => speak(body)}
                          data-testid="msg-speak"
                          aria-label={t('readAloud')}
                          title={t('readAloud')}
                          className="rounded p-0.5 transition hover:text-[#8a6215]"
                        >
                          <Volume2 size={12} aria-hidden="true" />
                        </button>
                      </>
                    )}
                    {stamp && <span aria-label={lang === 'hi' ? 'समय' : 'time'}>{stamp}</span>}
                  </div>
                </div>
              )}
            </motion.div>
            )
          })}
          {thinking && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-stone-200 bg-[#faf6ec] px-4 py-3 shadow-sm">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400" style={{ animationDelay: `${i * 0.15}s` }} aria-hidden="true" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick replies */}
        {messages.length <= 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.35 }}
            className="border-t border-stone-100 bg-[#faf6ec] px-4 pt-3"
          >
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-stone-600">{t('quickRepliesLabel')}</p>
            <div className="flex flex-wrap gap-2">
              {quick.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => send(quickTexts[key])}
                  data-testid={`quick-${key}`}
                  className="rounded-full border border-stone-200 bg-[#faf6ec] px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:-translate-y-0.5 hover:border-[#b8974f] hover:bg-[#f4efdf]"
                >
                  {label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Follow-up chips — suggested next questions for the last assessment */}
        {lastResult && !thinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.35 }}
            className="border-t border-stone-100 bg-[#faf6ec] px-4 pt-3"
            data-testid="follow-ups"
          >
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-stone-600">{t('followUpsLabel')}</p>
            <div className="flex flex-wrap gap-2">
              {followUpsFor(lastResult).map((key) => (
                <button
                  key={key}
                  onClick={() => send(followUpText(lang === 'hi', key, topicOf(lastResult, lastTopicRef.current, lang)))}
                  data-testid={`followup-${key}`}
                  className="rounded-full border border-[#b8974f]/50 bg-[#f4efdf] px-3 py-1.5 text-xs font-semibold text-[#8a6215] transition hover:-translate-y-0.5 hover:border-[#b8974f] hover:bg-[#f4efdf]"
                >
                  {followUpLabel(lang === 'hi', key)}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Input */}
        <div className="border-t border-stone-100 bg-[#faf6ec] p-3">
          <div className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 transition focus-within:border-[#b8974f] focus-within:shadow-[0_0_0_3px_rgba(107,204,234,0.15)]">
            <label htmlFor="chat-input" className="sr-only">{t('chatPlaceholder')}</label>
            <input
              id="chat-input"
              ref={inputRef}
              data-testid="chat-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={listening ? t('micListening') : t('chatPlaceholder')}
              maxLength={500}
              className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-600"
            />
            {voiceSupported && (
              <motion.button
                onClick={listening ? stopListening : startListening}
                data-testid="chat-mic"
                aria-label={listening ? t('micStop') : t('micLabel')}
                aria-pressed={listening}
                whileTap={{ scale: 0.9 }}
                className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${listening
                  ? 'border-red-300 bg-red-50 text-red-600'
                  : 'border-stone-200 bg-[#faf6ec] text-stone-600 hover:border-[#b8974f] hover:text-[#8a6215]'}`}
              >
                {listening && <span className="absolute inline-flex h-full w-full animate-ping rounded-lg bg-red-200 opacity-60" aria-hidden="true" />}
                {listening ? <MicOff size={14} aria-hidden="true" /> : <Mic size={14} aria-hidden="true" />}
              </motion.button>
            )}
            <motion.button
              onClick={() => send()}
              data-testid="chat-send"
              aria-label={t('send')}
              disabled={!text.trim() || thinking}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.92 }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0f241a] text-[#f5f0e3] transition hover:bg-[#26251c] disabled:opacity-40"
            >
              <Send size={14} aria-hidden="true" />
            </motion.button>
          </div>
          {(listening || voiceError) && (
            <p className={`mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold ${voiceError ? 'text-red-700' : 'text-[#8a6215]'}`} data-testid="voice-note">
              {voiceError ? (
                voiceError
              ) : (
                <>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#b8974f]" aria-hidden="true" />
                  {t('micListening')}
                </>
              )}
            </p>
          )}
          <p className="mt-2 text-center text-[11px] text-stone-600">{t('chatDisclaimer')}</p>
        </div>
      </motion.div>

      {/* Last assessment summary */}
      {lastResult && !lastResult.emergency && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 rounded-2xl border border-stone-200 bg-[#faf6ec] p-5 shadow-[0_7px_24px_-18px_rgba(15,23,42,.4)]"
          data-testid="chat-last-result"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-sm font-extrabold text-stone-900">{lastResult.summary[lang === 'hi' ? 'hi' : 'en']}</h2>
            <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${severityMeta[lastResult.severity].bg} ${severityMeta[lastResult.severity].text}`}>
              {t(`severity.${lastResult.severity}`)}
            </span>
          </div>
          <div className="mt-4 space-y-3 text-xs leading-5 text-stone-600">
            <p className="flex items-start gap-2"><Sparkles size={14} className="mt-0.5 shrink-0 text-[#8a6215]" aria-hidden="true" />{t('triage.notDiagnosis')}</p>
            {(() => {
              const l = L(lang)
              const seekArr = Array.isArray(lastResult.seek) ? lastResult.seek : lastResult.seek?.[l]
              return seekArr?.length > 0 ? (
                <p className="flex items-start gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#b8974f]" aria-hidden="true" /><span>{t('triage.whenToSeek')} — {seekArr.join(' ')}</span></p>
              ) : null
            })()}
            {sync.getMode() === 'local' && (
              <p className="flex items-start gap-2"><CloudOff size={14} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" /><span>{lang === 'hi' ? 'ऑफ़लाइन — जवाब डिवाइस पर बना।' : 'Offline — this reply was built on your device.'}</span></p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}
