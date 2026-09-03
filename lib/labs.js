// Lab-report knowledge base + parser — shared client/server.
// Extracts common Indian lab test values from raw report text (PDF text
// or pasted), compares them against standard adult reference ranges and
// returns a simple structured interpretation. Informational only —
// never a diagnosis; ranges vary by lab, age, sex and method.

// Standard adult reference ranges (SI-ish units used by Indian labs).
export const LAB_TESTS = [
  // ── CBC ──
  { key: 'hb', match: ['haemoglobin', 'hemoglobin', 'hb'], label: { en: 'Haemoglobin', hi: 'हीमोग्लोबिन' }, unit: 'g/dL', range: [13, 17], sex: 'male', low: { en: 'Below range — can indicate anaemia. Iron-rich foods help; a doctor can confirm with ferritin.', hi: 'रेंज से कम — खून की कमी (एनीमिया) हो सकती है। आयरन युक्त भोजन मदद करता है; डॉक्टर फेरिटिन जाँच से पुष्टि कर सकते हैं।' }, high: { en: 'Above the usual range — sometimes just dehydration; worth discussing with a doctor.', hi: 'सामान्य रेंज से ऊपर — कभी-कभी पानी की कमी से भी होता है; डॉक्टर से बात करें।' } },
  { key: 'hb_f', match: ['haemoglobin', 'hemoglobin', 'hb'], label: { en: 'Haemoglobin', hi: 'हीमोग्लोबिन' }, unit: 'g/dL', range: [12, 15], sex: 'female', low: { en: 'Below range — can indicate anaemia. Iron-rich foods help; a doctor can confirm with ferritin.', hi: 'रेंज से कम — खून की कमी (एनीमिया) हो सकती है। आयरन युक्त भोजन मदद करता है; डॉक्टर फेरिटिन जाँच से पुष्टि कर सकते हैं।' }, high: { en: 'Above the usual range — sometimes just dehydration; worth discussing with a doctor.', hi: 'सामान्य रेंज से ऊपर — कभी-कभी पानी की कमी से भी होता है; डॉक्टर से बात करें।' } },
  { key: 'wbc', match: ['total leukocyte', 'tlc', 'wbc', 'white blood cell', 'leucocyte count', 'leukocyte count'], label: { en: 'White blood cells (TLC)', hi: 'श्वेत रक्त कणिकाएँ (TLC)' }, unit: '/µL', range: [4000, 11000], scale: 1, low: { en: 'Lower than usual — seen after some viral infections.', hi: 'सामान्य से कम — कुछ वायरल संक्रमण के बाद देखा जाता है।' }, high: { en: 'Raised — often a sign of infection or inflammation.', hi: 'बढ़ा हुआ — अक्सर संक्रमण या सूजन का संकेत।' } },
  { key: 'platelets', match: ['platelets', 'platelet', 'thrombocyte'], label: { en: 'Platelets', hi: 'प्लेटलेट्स' }, unit: 'lakh/µL', range: [1.5, 4.5], scale: 100000, low: { en: 'Below range — dengue and other fevers can drop platelets; a doctor should review promptly.', hi: 'रेंज से कम — डेंगू जैसे बुखार में प्लेटलेट गिरते हैं; डॉक्टर से जल्दी जाँच कराएँ।' }, high: { en: 'Above the usual range — usually mild and reverts on its own.', hi: 'सामान्य से ऊपर — आमतौर पर हल्का होता है और अपने आप ठीक हो जाता है।' } },

  // ── Lipid profile ──
  { key: 'cholesterol', match: ['total cholesterol', 'cholesterol total', 'serum cholesterol'], label: { en: 'Total cholesterol', hi: 'कुल कोलेस्ट्रॉल' }, unit: 'mg/dL', range: [0, 200], highOnly: true, high: { en: 'Above the desirable limit — diet changes and exercise help; a doctor can check LDL/HDL ratio.', hi: 'वांछनीय सीमा से ऊपर — आहार और व्यायाम से सुधार होता है; डॉक्टर LDL/HDL अनुपात देख सकते हैं।' } },
  { key: 'ldl', match: ['ldl cholesterol', 'ldl-c', 'ldl'], label: { en: 'LDL cholesterol', hi: 'LDL कोलेस्ट्रॉल' }, unit: 'mg/dL', range: [0, 100], highOnly: true, high: { en: 'Above the optimal range — the "bad" cholesterol; diet, exercise and a doctor review help.', hi: 'बेहतरीन रेंज से ऊपर — "खराब" कोलेस्ट्रॉल; आहार, व्यायाम और डॉक्टर की सलाह लें।' } },
  { key: 'hdl', match: ['hdl cholesterol', 'hdl-c', 'hdl'], label: { en: 'HDL cholesterol', hi: 'HDL कोलेस्ट्रॉल' }, unit: 'mg/dL', range: [40, 100], lowOnly: true, low: { en: 'Below the healthy level — the "good" cholesterol is low; regular exercise raises it.', hi: 'स्वस्थ स्तर से कम — "अच्छा" कोलेस्ट्रॉल कम है; नियमित व्यायाम से बढ़ता है।' } },
  { key: 'triglycerides', match: ['triglycerides', 'triglyceride', 'tg level', 'serum triglyceride'], label: { en: 'Triglycerides', hi: 'ट्राइग्लिसराइड्स' }, unit: 'mg/dL', range: [0, 150], highOnly: true, high: { en: 'Above the normal limit — sugar, alcohol and refined carbs raise it.', hi: 'सामान्य सीमा से ऊपर — चीनी, शराब और रिफाइंड कार्ब्स बढ़ाते हैं।' } },

  // ── Liver (LFT) ──
  { key: 'sgpt', match: ['sgpt', 'alt'], label: { en: 'SGPT (ALT)', hi: 'SGPT (ALT)' }, unit: 'U/L', range: [7, 56], highOnly: true, high: { en: 'Above the normal range — liver stress; alcohol and fatty diet are common reasons.', hi: 'सामान्य रेंज से ऊपर — लिवर पर दबाव; शराब और चिकनाई युक्त आहार आम कारण हैं।' } },
  { key: 'sgot', match: ['sgot', 'ast'], label: { en: 'SGOT (AST)', hi: 'SGOT (AST)' }, unit: 'U/L', range: [10, 40], highOnly: true, high: { en: 'Above the normal range — liver or muscle stress; a doctor can differentiate.', hi: 'सामान्य रेंज से ऊपर — लिवर या मांसपेशी पर दबाव; डॉक्टर अंतर बता सकते हैं।' } },
  { key: 'bilirubin', match: ['total bilirubin', 'bilirubin total', 'serum bilirubin'], label: { en: 'Bilirubin (total)', hi: 'बिलिरुबिन (कुल)' }, unit: 'mg/dL', range: [0.1, 1.2], highOnly: true, high: { en: 'Above the normal range — can cause yellowing of eyes; needs a doctor review.', hi: 'सामान्य रेंज से ऊपर — आँखों का पीलापन हो सकता है; डॉक्टर से जाँच कराएँ।' } },

  // ── Kidney (KFT) ──
  { key: 'creatinine', match: ['serum creatinine', 'creatinine'], label: { en: 'Creatinine', hi: 'क्रिएटिनिन' }, unit: 'mg/dL', range: [0.6, 1.3], low: { en: 'Below the usual range — usually harmless.', hi: 'सामान्य रेंज से कम — आमतौर पर बेकार नहीं।' }, high: { en: 'Above the normal range — the kidneys are working harder; a doctor should review.', hi: 'सामान्य रेंज से ऊपर — गुर्दे ज़्यादा मेहनत कर रहे हैं; डॉक्टर से जाँच कराएँ।' } },
  { key: 'urea', match: ['blood urea', 'urea'], label: { en: 'Blood urea', hi: 'रक्त यूरिया' }, unit: 'mg/dL', range: [15, 45], highOnly: true, high: { en: 'Above the normal range — hydration and a kidney check matter.', hi: 'सामान्य रेंज से ऊपर — पानी पीना और गुर्दे की जाँच ज़रूरी है।' } },
  { key: 'uric_acid', match: ['uric acid'], label: { en: 'Uric acid', hi: 'यूरिक एसिड' }, unit: 'mg/dL', range: [3.5, 7.2], highOnly: true, high: { en: 'Above range — high purine foods and dehydration push it up; joint pain + high uric acid needs a doctor.', hi: 'रेंज से ऊपर — प्यूरीन युक्त भोजन और पानी की कमी बढ़ाती है; जोड़ों का दर्द + उच्च यूरिक एसिड पर डॉक्टर देखें।' } },

  // ── Thyroid ──
  { key: 'tsh', match: ['tsh'], label: { en: 'TSH', hi: 'TSH' }, unit: 'µIU/mL', range: [0.4, 4.5], low: { en: 'Below range — can point to an overactive thyroid; a doctor confirms with T3/T4.', hi: 'रेंज से कम — थायरॉइड ज़्यादा सक्रिय हो सकता है; डॉक्टर T3/T4 से पुष्टि करें।' }, high: { en: 'Above range — can point to an underactive thyroid (fatigue, weight gain); a doctor confirms with T3/T4.', hi: 'रेंज से ऊपर — थायरॉइड कम सक्रिय हो सकता है (थकान, वजन बढ़ना); डॉक्टर T3/T4 से पुष्टि करें।' } },

  // ── Vitamins ──
  { key: 'vitamin_d', match: ['vitamin d', '25-oh vitamin d', '25 oh vitamin d', '25-hydroxyvitamin d'], label: { en: 'Vitamin D', hi: 'विटामिन डी' }, unit: 'ng/mL', range: [30, 100], lowOnly: true, low: { en: 'Deficient — very common in India. Sunlight 15-20 min/day + vitamin-D rich foods; a doctor can advise supplementation.', hi: 'कमी — भारत में बहुत आम है। रोज़ 15-20 मिनट धूप + विटामिन-डी युक्त भोजन; डॉक्टर सप्लीमेंट की सलाह दे सकते हैं।' } },
  { key: 'vitamin_b12', match: ['vitamin b12', 'b12', 'cobalamin'], label: { en: 'Vitamin B12', hi: 'विटामिन बी12' }, unit: 'pg/mL', range: [200, 900], lowOnly: true, low: { en: 'Deficient — common in vegetarians. Dairy, fortified foods; a doctor can advise supplementation.', hi: 'कमी — शाकाहारियों में आम है। डेयरी, फोर्टिफाइड भोजन; डॉक्टर सप्लीमेंट सुझा सकते हैं।' } },

  // ── Sugar ──
  { key: 'fasting_glucose', match: ['fasting blood sugar', 'fasting glucose', 'fbs', 'glucose fasting'], label: { en: 'Fasting blood sugar', hi: 'उपवास रक्त शर्करा (FBS)' }, unit: 'mg/dL', range: [70, 100], low: { en: 'Below the usual fasting range — can cause dizziness; eat something and discuss with a doctor.', hi: 'उपवास रेंज से कम — चक्कर आ सकते हैं; कुछ खाएँ और डॉक्टर से बात करें।' }, high: { en: 'Above the normal range — a diabetes sign; HbA1c and a doctor review are the right next step.', hi: 'सामान्य रेंज से ऊपर — डायबिटीज़ का संकेत; HbA1c और डॉक्टर की जाँच सही अगला कदम है।' } },
  { key: 'hba1c', match: ['hba1c', 'glycated haemoglobin', 'glycosylated hemoglobin'], label: { en: 'HbA1c', hi: 'HbA1c' }, unit: '%', range: [4, 5.7], highOnly: true, high: { en: 'Above the normal range — 3-month average sugar is high; a doctor can confirm prediabetes/diabetes.', hi: 'सामान्य रेंज से ऊपर — 3 महीने का औसत शर्करा बढ़ा है; डॉक्टर प्री-डायबिटीज़/डायबिटीज़ की पुष्टि कर सकते हैं।' } },
]

// "Haemoglobin 12.1" / "Hb: 12.1 g/dL" / "Vitamin D - 18 ng/mL" — pull the
// first numeric token after the test name (skipping label/colon dashes),
// with optional unit and thousands handling (4.5 lakh vs 450000 platelets).
// Keywords must match as standalone words — a bare substring match would let
// e.g. the "ast" keyword hit "fASTing" and map a sugar value to SGOT.
function findValue(line, keywords) {
  const lower = line.toLowerCase()
  for (const k of keywords) {
    const m = new RegExp(`(^|[^a-z])(${k})([^a-z]|$)`).exec(lower)
    if (!m) continue
    const after = lower.slice(m.index + m[1].length + k.length)
    const num = after.match(/(-?\d+(?:\.\d+)?)\s*(%|g\/dl|mg\/dl|u\/l|µiu\/ml|uiu\/ml|ng\/ml|pg\/ml|\/µl|\/ul)?/)
    if (!num) return null
    const v = parseFloat(num[1])
    // "0.45" with no unit could be lakh form — keep as parsed.
    return Number.isFinite(v) ? v : null
  }
  return null
}

// Parse raw report text → structured rows + counts. Safe to call with any
// messy text; unknown lines are simply ignored.
export function parseLabText(text) {
  if (!text || typeof text !== 'string') return { rows: [], found: 0, abnormal: 0 }
  const lines = text.split(/[\n\r]+/)
  const seen = new Set()
  const rows = []

  for (const line of lines) {
    if (line.trim().length < 3) continue
    for (const test of LAB_TESTS) {
      if (seen.has(test.key)) continue
      const value = findValue(line, test.match)
      if (value === null) continue
      seen.add(test.key)
      let display = value
      if (test.scale && value < test.scale && value * test.scale >= test.range[0]) {
        display = value * test.scale // "2.4 lakh" → 240000
      }
      const [lo, hi] = test.range
      let status
      if (display < lo) status = 'low'
      else if (display > hi) status = 'high'
      else status = 'normal'
      if (status === 'low' && test.highOnly) status = 'normal'
      if (status === 'high' && test.lowOnly) status = 'normal'
      rows.push({
        key: test.key,
        label: test.label,
        value: display,
        unit: test.unit,
        refLo: lo,
        refHi: hi,
        status,
        note: status === 'low' ? test.low : status === 'high' ? test.high : null,
      })
      break
    }
  }

  return {
    rows,
    found: rows.length,
    abnormal: rows.filter((r) => r.status !== 'normal').length,
  }
}
