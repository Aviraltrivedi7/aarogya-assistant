// AarogyaGPT rule-based symptom triage engine.
// Matches English + Hindi (Devanagari) + Hinglish (transliterated) keywords.
// Returns a structured assessment: severity, advice, red flags. Never a diagnosis.

export const SEVERITY = { EMERGENCY: 'emergency', HIGH: 'high', MODERATE: 'moderate', LOW: 'low' }

// Red flags first — if any match, they override everything else.
const RED_FLAGS = [
  {
    id: 'cardiac',
    keywords: ['chest pain', 'seena dard', 'सीने दर्द', 'सीने में दर्द', 'chest pressure', 'heart attack', 'jaw pain', 'left arm pain', ' dil se', 'heart pain', 'seena dukh'],
    advice: { en: 'Chest pain can mean a heart problem. Call 112 / 108 right now — do not drive yourself. Sit upright, stay calm, unlock the door for responders.', hi: 'सीने का दर्द दिल की समस्या हो सकता है। अभी 112 / 108 पर कॉल करें — खुद ड्राइव न करें। सीधे बैठें, शांत रहें, दरवाज़ा खोलकर रखें।' },
  },
  {
    id: 'breathing',
    keywords: ['breath', 'saans', 'saath let', 'saans nahi', 'साँस', 'सांस', 'can\u2019t breathe', 'cant breathe', 'hard to breathe', 'difficulty breathing', 'choking', 'gala'],
    advice: { en: 'Breathing difficulty needs urgent assessment. Call 112 / 108 now. Sit upright, loosen tight clothing, use an inhaler if prescribed.', hi: 'साँस की दिक्कत में तुरंत जाँच ज़रूरी है। अभी 112 / 108 पर कॉल करें। सीधे बैठें, तंग कपड़े ढीले करें, डॉक्टरी इहेलर हो तो लें।' },
  },
  {
    id: 'stroke',
    keywords: ['stroke', 'face droop', 'slurred', 'slurring', 'bol nahi', 'एक तरफ', 'laadh', 'paralysis', 'lakwa', 'अकाल', 'अकड़न', 'achanak kamzor', 'sudden weakness'],
    advice: { en: 'These can be stroke signs — note the exact time they started. Call 112 / 108 immediately. Do not give food, water or medicines by mouth.', hi: 'ये स्ट्रोक के लक्षण हो सकते हैं — शुरू होने का समय याद रखें। तुरंत 112 / 108 पर कॉल करें। मुँह से खाना-पानी या दवा न दें।' },
  },
  {
    id: 'bleeding',
    keywords: ['bleeding', 'khoon beh', 'खून', 'रक्तस्राव', 'bahut khoon', 'uncontrolled bleeding', 'blood loss', 'kaata'],
    advice: { en: 'Press the site firmly with a clean cloth and keep pressing. Elevate the limb if possible. Call 112 / 108 if bleeding does not stop.', hi: 'साफ़ कपड़े से जगह को कसकर दबाएँ और दबाते रहें। संभव हो तो अंग ऊपर उठाएँ। रक्तस्राव न रुके तो 112 / 108 पर कॉल करें।' },
  },
  {
    id: 'unconscious',
    keywords: ['unconscious', 'behosh', 'बेहोश', 'fainted', 'collapsed', 'hosh nahi', 'seizure', 'fit aana', 'मिर्गी', 'jhatke'],
    advice: { en: 'Turn them on their side (recovery position), check breathing, and call 112 / 108 immediately. Do not put anything in the mouth.', hi: 'उन्हें करवट पर लिटाएँ (रिकवरी पोज़िशन), साँस जाँचें, और तुरंत 112 / 108 पर कॉल करें। मुँह में कुछ न डालें।' },
  },
  {
    id: 'anaphylaxis',
    keywords: ['anaphylaxis', 'swelling of face', 'swollen throat', 'allergic reaction', 'allergy severe', 'face swelling', 'hont soojh', 'आँख/चेहरा सूज'],
    advice: { en: 'A severe allergic reaction can close the airway. Call 112 / 108 now. An antihistamine helps mild cases only — do not rely on it for breathing issues.', hi: 'गंभीर एलर्जी साँस की नली बंद कर सकती है। अभी 112 / 108 कॉल करें। एंटीहिस्टामाइन हल्के मामले में ही मदद करता है — साँस की दिक्कत पर भरोसा न करें।' },
  },
  {
    id: 'poison',
    keywords: ['poison', 'zeher', 'ज़हर', 'जहर', 'overdose', 'ate too many pills', 'golliyan kha', 'cleaning liquid', 'acid piya'],
    advice: { en: 'Possible poisoning — call 112 / 108 right now. Do NOT make the person vomit. Keep the container/substance label with you.', hi: 'ज़हर का संदेह — अभी 112 / 108 पर कॉल करें। वमन न कराएँ। डिब्बा/लेबल अपने पास रखें।' },
  },
  {
    id: 'selfharm',
    keywords: ['kill myself', 'end my life', 'suicide', 'khudkhushi', 'आत्महत्या', 'marna chahta', 'nahi jeena', 'self harm', 'hurt myself'],
    advice: { en: 'You are not alone, and this moment can pass. Please call Tele-MANAS 14416 (free, 24×7, all Indian languages) right now, or 112. Stay with someone you trust.', hi: 'आप अकेले नहीं हैं, यह पल बीत सकता है। कृपया अभी टेली-MANAS 14416 (मुफ़्त, 24×7, सभी भाषाएँ) या 112 पर कॉल करें। किसी भरोसेमंद व्यक्ति के साथ रहें।' },
  },
]

// Symptom rules, ordered by specificity — first strong match wins severity.
const SYMPTOMS = [
  {
    id: 'fever',
    keywords: ['fever', 'bukhar', 'बुखार', 'temperature', 'tap', 'tez bukhar', 'feverish', 'aav'],
    severity: SEVERITY.MODERATE,
    summary: { en: 'Fever', hi: 'बुखार' },
    advice: {
      en: 'Rest, drink fluids regularly, eat light. Paracetamol as per pack label can ease aches. Change soaked clothes.',
      hi: 'आराम करें, समय-समय पर तरल पदार्थ लें, हल्का भोजन करें। पैक के अनुसार पैरासिटामोल ले सकते हैं। गीले कपड़े बदलें।',
    },
    seek: {
      en: 'above 39.4\u00B0C / 103\u00B0F for adults, lasts over 3 days, or comes with stiff neck, rash, confusion or breathlessness.',
      hi: 'वयस्कों में 39.4\u00B0C / 103\u00B0F से ऊपर, 3 दिन से ज़्यादा रहे, या गर्दन अकड़न, दाने, भ्रम या साँस की दिक्कत साथ हो।',
    },
  },
  {
    id: 'headache',
    keywords: ['headache', 'sir dard', 'सिर दर्द', 'सिरदर्द', 'head pain', 'sar dukh', 'migraine', 'aadha sir'],
    severity: SEVERITY.LOW,
    summary: { en: 'Headache', hi: 'सिरदर्द' },
    advice: {
      en: 'Rest in a dim, quiet room. Hydrate — dehydration is a common trigger. A warm compress on the neck or a short nap often helps.',
      hi: 'कम रोशनी वाले शांत कमरे में आराम करें। पानी पिएँ — निर्जलीकरण आम कारण है। गर्म सेंक या छोटी झपकी अक्सर मदद करती है।',
    },
    seek: {
      en: 'it is the worst headache of your life, starts suddenly like a thunderclap, or follows a head injury.',
      hi: 'यह जीवन का सबसे तेज़ दर्द हो, अचानक बिजली की तरह शुरू हो, या सिर पर चोट के बाद हो।',
    },
  },
  {
    id: 'stomach',
    keywords: ['stomach', 'pet dard', 'पेट दर्द', 'पेटदर्द', 'abdominal', 'pet me dard', 'acidity', 'gas', 'acidity', 'heartburn', 'pet kharab', 'loose motion', 'diarrhoea', 'diarrhea', 'dast', 'दस्त', 'vomiting', 'ulti', 'उल्टी', 'kayi'],
    severity: SEVERITY.MODERATE,
    summary: { en: 'Stomach issue', hi: 'पेट की समस्या' },
    advice: {
      en: 'Eat small, bland meals (khichdi, curd-rice, banana). Sip ORS after loose motions. Avoid milk, fried and spicy food today.',
      hi: 'छोटे-छोटे हल्के भोजन (खिचड़ी, दही-चावल, केला) लें। दस्त के बाद ORS घूंट-घूंट पिएँ। आज दूध, तला और मसालेदार खाना न लें।',
    },
    seek: {
      en: 'pain is severe or localised to the right-lower belly, there is blood in stool/vomit, or you cannot keep any fluids down.',
      hi: 'दर्द बहुत तेज़ हो या पेट के दाहिने निचले हिस्से में हो, मल/उल्टी में खून आए, या पानी भी न रुक रहा हो।',
    },
  },
  {
    id: 'cough',
    keywords: ['cough', 'khansi', 'खाँसी', 'खांसी', 'cold', 'zukam', 'जुकाम', 'sardi', 'सर्दी', 'sore throat', 'gala dard', 'गले दर्द', 'runny nose', 'chink'],
    severity: SEVERITY.LOW,
    summary: { en: 'Cough & cold', hi: 'खाँसी-ज़ुकाम' },
    advice: {
      en: 'Warm fluids, steam inhalation, and rest do most of the work. Honey (not for infants under 1) soothes the throat. Most viral coughs settle in 7-10 days.',
      hi: 'गर्म पेय, भाप और आराम ही असली इलाज हैं। शहद (1 साल से छोटे बच्चे को नहीं) गले को आराम देता है। वायरल खाँसी 7-10 दिन में ठीक होती है।',
    },
    seek: {
      en: 'cough lasts beyond 2 weeks, you cough blood, or there is high fever with breathlessness.',
      hi: 'खाँसी 2 हफ़्ते से ज़्यादा रहे, खून आए, या तेज़ बुखार के साथ साँस फूले।',
    },
  },
  {
    id: 'bodypain',
    keywords: ['body ache', 'body pain', 'sharir dard', 'शरीर दर्द', 'muscle pain', 'mashe', 'joint pain', 'ghutno', 'jodo dard', 'जोड़ों दर्द', 'kamar dard', 'back pain', 'कमर दर्द'],
    severity: SEVERITY.LOW,
    summary: { en: 'Body / joint pain', hi: 'बदन / जोड़ों का दर्द' },
    advice: {
      en: 'Gentle movement usually beats total rest. Warm compress on stiff joints. Check posture and sleep position.',
      hi: 'हल्की चहल-कदमी पूरे आराम से बेहतर है। अकड़े जोड़ों पर गर्म सेंक। बैठने की मुद्रा और नींद की स्थिति जाँचें।',
    },
    seek: {
      en: 'pain follows an injury, or comes with fever and swelling of one joint.',
      hi: 'दर्द चोट के बाद हो, या बुखार और एक जोड़ की सूजन के साथ हो।',
    },
  },
  {
    id: 'skin',
    keywords: ['rash', 'dane', 'दाने', 'khujli', 'khujli', 'itching', 'खुजली', 'skin', 'chakatte', 'चकत्ते', 'pimples', 'daane'],
    severity: SEVERITY.LOW,
    summary: { en: 'Skin irritation', hi: 'त्वचा की समस्या' },
    advice: {
      en: 'Keep the area clean and dry. Avoid scratching and new cosmetics. Cool compress can calm itching; a pharmacist can suggest an anti-itch cream.',
      hi: 'जगह को साफ़ और सूखा रखें। खुजलाना और नए प्रसाधन टालें। ठंडी सेंक से राहत मिलती है; फार्मासिस्ट एंटी-इच क्रीम बता सकते हैं।',
    },
    seek: {
      en: 'the rash spreads rapidly, blisters, oozes, or comes with fever or facial swelling.',
      hi: 'दाने तेज़ी से फैलें, फफोले पड़ें, पस निकले, या बुखार/चेहरे की सूजन साथ हो।',
    },
  },
  {
    id: 'dizziness',
    keywords: ['dizzy', 'chakkar', 'चक्कर', 'dizziness', 'vertigo', 'sir ghum', 'lightheaded', 'kamzori', 'weakness', 'kamzor', 'कमज़ोर'],
    severity: SEVERITY.MODERATE,
    summary: { en: 'Dizziness / weakness', hi: 'चक्कर / कमज़ोरी' },
    advice: {
      en: 'Sit or lie down immediately to avoid falls. Check water and food intake — both are common causes. Rise slowly from bed.',
      hi: 'गिरने से बचने के लिए तुरंत बैठें या लेटें। पानी और खाना जाँचें — दोनों आम कारण हैं। बिस्तर से धीरे-धीरे उठें।',
    },
    seek: {
      en: 'episodes repeat, or come with chest pain, palpitations, slurred speech or fainting.',
      hi: 'चक्कर बार-बार आएँ, या सीने दर्द, धड़कन तेज़, लड़खड़ाती बोली या बेहोशी साथ हो।',
    },
  },
  {
    id: 'anxiety',
    keywords: ['anxiety', 'anxious', 'ghabrahat', 'घबराहट', 'panic', 'tension', 'bechaini', 'बेचैनी', 'stress', 'dar', 'nervous'],
    severity: SEVERITY.LOW,
    summary: { en: 'Anxiety / stress', hi: 'चिंता / तनाव' },
    advice: {
      en: 'Try slow breathing: in for 4, hold for 4, out for 6 — a few rounds. Ground yourself: name 5 things you can see. A short walk helps burn the adrenaline.',
      hi: 'धीमी साँस आज़माएँ: 4 गिनकर अंदर, 4 रोकें, 6 में बाहर — कुछ बार। खुद को जमाएँ: दिखने वाली 5 चीज़ें गिनें। छोटी सैर एड्रेनालिन जलाने में मदद करती है।',
    },
    seek: {
      en: 'this lasts weeks, disrupts sleep/work, or you have thoughts of harming yourself (then call Tele-MANAS 14416 now).',
      hi: 'यह हफ़्तों रहे, नींद/काम में बाधा डाले, या आत्म-हानि के विचार आएँ (तब अभी टेली-MANAS 14416 कॉल करें)।',
    },
  },
  {
    id: 'urinary',
    keywords: ['burning urine', 'peshab', 'पेशाब', 'urine pain', 'urination', 'peeshab jalan', 'jalan'],
    severity: SEVERITY.MODERATE,
    summary: { en: 'Urinary discomfort', hi: 'पेशाब में जलन' },
    advice: {
      en: 'Drink extra water through the day. Avoid caffeine and alcohol. These infections often need a short antibiotic course — a doctor can confirm with a urine test.',
      hi: 'दिन भर ज़्यादा पानी पिएँ। कैफीन और शराब टालें। ऐसे संक्रमण में अक्सर छोटा एंटीबायोटिक कोर्स चाहिए — यूरिन टेस्ट से डॉक्टर पुष्टि करेंगे।',
    },
    seek: {
      en: 'you also have fever, back/side pain, blood in urine, or you are pregnant.',
      hi: 'साथ में बुखार, पीठ/कमर दर्द, पेशाब में खून हो, या आप गर्भवती हों।',
    },
  },
  {
    id: 'sleep',
    keywords: ['insomnia', 'neend', 'नींद', 'sleep problem', 'can\u2019t sleep', 'cant sleep', 'neend nahi', 'so nahi'],
    severity: SEVERITY.LOW,
    summary: { en: 'Trouble sleeping', hi: 'नींद की समस्या' },
    advice: {
      en: 'Fix wake-up time first — the body follows it best. No screens 30 min before bed; keep the room cool and dark. Avoid tea/coffee after 4 PM.',
      hi: 'सबसे पहले उठने का समय तय करें — शरीर उसी का पालन करता है। सोने से 30 मिनट पहले स्क्रीन बंद; कमरा ठंडा और अंधेरा रखें। शाम 4 बजे के बाद चाय/कॉफी नहीं।',
    },
    seek: {
      en: 'snoring with daytime sleepiness, or sleeplessness lasts beyond a few weeks.',
      hi: 'खर्राटे के साथ दिन में नींद आती हो, या कुछ हफ़्तों से ज़्यादा नींद न आती हो।',
    },
  },
  {
    id: 'eye',
    keywords: ['eye', 'aankh', 'आँख', 'आंख', 'vision', 'blurred', 'dhundhla', 'धुंधला', 'red eye', 'aankh laal'],
    severity: SEVERITY.MODERATE,
    summary: { en: 'Eye discomfort', hi: 'आँखों की समस्या' },
    advice: {
      en: 'Rest the eyes from screens (20-20-20 rule: every 20 min, look 20 feet away for 20 sec). Do not rub. Blink often; lubricating drops are fine.',
      hi: 'स्क्रीन से आँखों को आराम दें (20-20-20 नियम: हर 20 मिनट पर 20 सेकंड दूर देखें)। मलें नहीं। ज़्यादा पलकें झपकें; लुब्रिकेटिंग ड्रॉप्स ठीक हैं।',
    },
    seek: {
      en: 'there is sudden vision loss, injury, flashes of light, or severe pain with nausea.',
      hi: 'अचानक दृष्टि जाना, चोट, रोशनी की चमक दिखना, या तेज़ दर्द के साथ जी मिचलाना हो।',
    },
  },
  {
    id: 'child',
    keywords: ['my child', 'baccha', 'बच्चा', 'baby', 'shishu', 'infant', 'bete ko', 'beti ko'],
    severity: SEVERITY.MODERATE,
    summary: { en: 'Child\u2019s health', hi: 'बच्चे का स्वास्थ्य' },
    advice: {
      en: 'Children change quickly — watch feeding, urine output and activity level. Keep fluids up; ORS for loose motions.',
      hi: 'बच्चों की हालत जल्दी बदलती है — खाना, पेशाब और चुस्ती पर नज़र रखें। तरल पदार्थ देते रहें; दस्त पर ORS।',
    },
    seek: {
      en: 'the child is under 3 months with any fever, refuses feeds, becomes unusually quiet or drowsy, or breathes fast.',
      hi: '3 महीने से छोटे बच्चे को कोई भी बुखार हो, दूध न पीए, असामान्य रूप से शांत/सुस्त हो, या तेज़ साँस ले।',
    },
  },
  {
    id: 'womenshealth',
    keywords: ['period', 'periods', 'mahwari', 'माहवारी', 'menstrual', 'period pain', 'masik dharm', 'pcod', 'pcos', 'pregnan'],
    severity: SEVERITY.MODERATE,
    summary: { en: 'Menstrual / women\u2019s health', hi: 'मासिक धर्म / महिला स्वास्थ्य' },
    advice: {
      en: 'A hot-water bag on the lower belly and light movement ease cramps for most. Iron-rich food helps over the month.',
      hi: 'पेट के निचले हिस्से पर गर्म पानी की थैली और हल्की चहल-कदमी अक्सर दर्द घटाती है। महीने भर आयरन युक्त भोजन मदद करता है।',
    },
    seek: {
      en: 'pain stops normal activity, bleeding is very heavy or between periods, or you suspect pregnancy complications.',
      hi: 'दर्द रोज़ के काम रोक दे, रक्तस्राव बहुत ज़्यादा या बीच में हो, या गर्भावस्था में समस्या का संदेह हो।',
    },
  },
  {
    id: 'diabetes',
    keywords: ['diabetes', 'shugar', 'sugar', 'madhumeh', 'मधुमेह', 'sugar level', 'high sugar', 'low sugar'],
    severity: SEVERITY.MODERATE,
    summary: { en: 'Blood sugar concern', hi: 'ब्लड शुगर की चिंता' },
    advice: {
      en: 'Log readings before meals and sleep. Timed meals and a 15-minute walk after food flatten spikes. Keep a sugar source handy for lows.',
      hi: 'भोजन और सोने से पहले की रीडिंग लिखें। समय पर खाना और भोजन के बाद 15 मिनट की सैर चीज़ियों को घटाती है। कम शुगर के लिए मुँह में ग्लूकोज़ रखें।',
    },
    seek: {
      en: 'readings stay far outside your usual range, or thirst/urination suddenly spikes.',
      hi: 'रीडिंग अपनी आदत से बहुत अलग रहे, या प्यास/पेशाब अचानक बहुत बढ़े।',
    },
  },
  {
    id: 'ear',
    keywords: ['ear pain', 'kaan', 'कान', 'ear ache', 'kaan dard', 'कान दर्द', 'kaan me dard', 'ear blocked', 'kaan band', 'ear discharge', 'kaan se', 'ear infection'],
    severity: SEVERITY.MODERATE,
    summary: { en: 'Ear pain / blockage', hi: 'कान दर्द / बंद कान' },
    advice: {
      en: 'A warm compress against the ear eases most post-cold ear pain. Sleep with the sore ear up. No cotton buds — they push wax in and can scratch the canal.',
      hi: 'ज़ुकाम के बाद के कान दर्द में गुनगुनी सेंक राहत देती है। दर्द वाला कान ऊपर रखकर सोएँ। कॉटन बड नहीं — मैल अंदर धकेलते और नली खरोंच सकते हैं।',
    },
    seek: {
      en: 'pain worsens after 2 days, discharge leaks, hearing drops, or the ear is red and hot with fever.',
      hi: '2 दिन बाद दर्द बढ़े, कान से पानी/मैल आए, सुनाई कम हो, या कान लाल-गर्म हो और बुखार भी हो।',
    },
  },
  {
    id: 'tooth',
    keywords: ['tooth', 'toothache', 'daant', 'दाँत', 'दांत', 'daant dard', 'दाँत दर्द', 'teeth pain', 'gum', 'masude', 'मसूड़', 'cavity', 'masuda', 'jaw pain chewing'],
    severity: SEVERITY.MODERATE,
    summary: { en: 'Tooth / gum pain', hi: 'दाँत / मसूड़े का दर्द' },
    advice: {
      en: 'Rinse with warm salt water after eating. A cold pack on the cheek (outside) helps swelling. Chew on the other side. Clove oil near the tooth can briefly numb it.',
      hi: 'खाने के बाद गुनगुने नमक-पानी से कुल्ला। सूजन पर गाल के बाहर ठंडी सिकाई। दूसरी तरफ़ से चबाएँ। दाँत के पास लौंग का तेल थोड़ी देर के लिए सुन्न करता है।',
    },
    seek: {
      en: 'face swells, mouth opening or swallowing gets hard, or fever joins — same day. Otherwise see a dentist within 1-2 days; toothache does not heal itself.',
      hi: 'चेहरे पर सूजन, मुँह खोलने/निगलने में दिक्कत, या बुखार — उसी दिन। वरना 1-2 दिन में डेंटिस्ट; दाँत दर्द खुद ठीक नहीं होता।',
    },
  },
  {
    id: 'constipation',
    keywords: ['constipation', 'kabz', 'कब्ज़', 'कब्ज', 'kabji', 'pet saaf nahi', 'शौच', 'hard stool', 'motion nahi', 'constip'],
    severity: SEVERITY.LOW,
    summary: { en: 'Constipation', hi: 'कब्ज़' },
    advice: {
      en: 'Water is the first medicine — 2-3 litres spread through the day. Papaya, orange or apple in the morning, whole-wheat over maida, a 15-minute walk, and a fixed toilet time after breakfast.',
      hi: 'पानी पहली दवा है — दिन भर 2-3 लीटर। सुबह पपीता, संतरा या सेब, मैदे की जगह गेहूँ, 15 मिनट सैर, और नाश्ते के बाद तय शौच-समय।',
    },
    seek: {
      en: 'blood appears, weight is falling without trying, it is new and unexplained, or it alternates with diarrhoea.',
      hi: 'खून आए, बिना कोशिश के वज़न गिरे, नई और बिना कारण की हो, या दस्त से बदल-बदल कर आए।',
    },
  },
  {
    id: 'asthma',
    keywords: ['asthma', 'saans phool', 'साँस फूल', 'wheez', 'seeti', 'सीटी', 'inhaler', 'इहेलर', 'asthma attack', 'dama', 'dam', 'saans ki nali'],
    severity: SEVERITY.MODERATE,
    summary: { en: 'Asthma / breathing trouble', hi: 'अस्थमा / साँस की तकलीफ़' },
    advice: {
      en: 'Use your reliever inhaler exactly as prescribed and sit upright, leaning slightly forward. Stay away from dust, smoke and strong smells. If the inhaler is not helping, that is not the moment to wait.',
      hi: 'डॉक्टर के कहे अनुसार राहत वाला इहेलर लें और सीधे बैठें, हल्का आगे झुककर। धूल, धुएँ और तेज़ गंध से दूर रहें। इहेलर से आराम न मिले तो इंतज़ार का वक़्त नहीं है।',
    },
    seek: {
      en: 'the reliever does not open breathing within 10-15 minutes, full sentences are hard, lips/nails turn blue, or the inhaler is needed again within 3-4 hours — urgent.',
      hi: 'इहेलर 10-15 मिनट में साँस न खोले, पूरे वाक्य बोलना मुश्किल हो, होंठ/नाखून नीले पड़ें, या 3-4 घंटे में फिर इहेलर चाहिए — तत्काल।',
    },
  },
]

// ── Intent-aware follow-up answers ────────────────────────────────
// The follow-up chips ("What can I do at home?", "Is medicine needed?"…)
// used to re-run plain symptom triage, giving the same general reply. Now
// each chip gets content for its INTENT, specialised per symptom — the
// engine's medical knowledge, in the user's own question's clothing.
//
// Escalation duration phrases must match `escalationFor` triggers so
// "3 din se bukhar" turns on the escalation note and the howLong answer
// stays consistent with it.

const INTENT_KEYS = ['homeCare', 'medicine', 'howLong', 'whenDoctor', 'prevent']

const containsAny = (text, words) => words.some((w) => contains(text, w))

// Home-care answers per symptom id — what the chip's "what can I do at
// home" question actually returns.
const HOME_CARE = {
  fever: {
    en: 'For fever: rest, light food (khichdi, curd-rice), and fluids every hour — water, ORS, coconut water, soup. A lukewarm (not ice) sponge bath helps when the temp is high. Change sweat-soaked clothes.',
    hi: 'बुखार में: आराम, हल्का खाना (खिचड़ी, दही-चावल), और हर घंटे तरल — पानी, ORS, नारियल पानी, सूप। ताप ज़्यादा हो तो गुनगुने (बर्फ़ नहीं) पानी से पोंछें। पसीने से गीले कपड़े बदलें।',
  },
  headache: {
    en: 'For headache: a dim quiet room, water first (dehydration is the most common cause), a warm compress on the neck, and a short nap. Note screen time — long phone stretches trigger many headaches.',
    hi: 'सिर दर्द में: कम रोशनी का शांत कमरा, सबसे पहले पानी (निर्जलीकरण सबसे आम कारण है), गर्दन पर गर्म सेंक, और छोटी झपकी। स्क्रीन समय घटाएँ — लंबे फ़ोन-स्क्रॉल से कई सिर दर्द शुरू होते हैं।',
  },
  stomach: {
    en: 'For stomach trouble: small bland meals — khichdi, curd-rice, banana, toast. Sip ORS after every loose motion. Skip milk, fried, spicy food and tea/coffee today.',
    hi: 'पेट की समस्या में: छोटे हल्के भोजन — खिचड़ी, दही-चावल, केला, टोस्ट। हर दस्त के बाद ORS घूंट-घूंट। आज दूध, तला, मसालेदार और चाय/कॉफी नहीं।',
  },
  cough: {
    en: 'For cough & cold: warm fluids through the day, steam inhalation twice a day, honey at night (not under 1 year), salt-water gargles for throat pain. Rest beats medicine for a viral cough.',
    hi: 'खाँसी-ज़ुकाम में: दिन भर गर्म पेय, दिन में दो बार भाप, रात में शहद (1 साल से छोटे को नहीं), गले के दर्द पर नमक-पानी के गरारे। वायरल खाँसी में आराम ही सबसे बड़ी दवा है।',
  },
  bodypain: {
    en: 'For body/joint pain: gentle movement usually beats complete rest — 10 minutes of slow walking, then a warm compress on the stiff part. Check your pillow and sitting posture; both quietly cause everyday aches.',
    hi: 'बदन/जोड़ों के दर्द में: पूरा आराम नहीं, हल्की चहल-कदमी बेहतर है — 10 मिनट धीमी सैर, फिर अकड़े हिस्से पर गर्म सेंक। तकिया और बैठने की मुद्रा जाँचें; रोज़ के दर्द की जड़ अक्सर वहीं होती है।',
  },
  skin: {
    en: 'For skin issues: keep the area clean and dry, wear loose cotton, do not scratch (cut nails short). A cool compress calms itching. No new cosmetics or home remedies on irritated skin.',
    hi: 'त्वचा की समस्या में: जगह साफ़-सूखी रखें, ढीले सूती कपड़े पहनें, खुजलाएँ नहीं (नाखून छोटे करें)। ठंडी सेंक से खुजली शांत होती है। रुष्ट त्वचा पर नए प्रसाधन या घरेलू नुस्खे नहीं।',
  },
  dizziness: {
    en: 'For dizziness: sit or lie down right away, sip water with a pinch of salt and sugar, and eat something light — skipped meals are a very common cause. Rise from bed slowly, in two stages.',
    hi: 'चक्कर आने पर: तुरंत बैठ या लेट जाएँ, चुटकी नमक-चीनी वाला पानी घूंट-घूंट पिएँ, और कुछ हल्का खाएँ — खाना छोड़ना बहुत आम कारण है। बिस्तर से दो चरण में धीरे-धीरे उठें।',
  },
  anxiety: {
    en: 'For anxiety: slow breathing — in 4, hold 4, out 6, five rounds. Then ground yourself: 5 things you can see, 4 you can touch, 3 you can hear. A 10-minute walk burns the adrenaline; avoid extra chai/coffee today.',
    hi: 'चिंता में: धीमी साँस — 4 गिनकर अंदर, 4 रोकें, 6 में बाहर, पाँच बार। फिर खुद को जमाएँ: 5 दिखती चीज़ें, 4 छूती चीज़ें, 3 सुनाई देने वाली आवाज़ें। 10 मिनट की सैर एड्रेनालिन जलाती है; आज ज़्यादा चाय/कॉफी नहीं।',
  },
  urinary: {
    en: 'For urine burning: drink a full glass of water every hour you are awake — the goal is clear urine. Skip tea, coffee and alcohol. Do not hold urine; heat on the lower belly eases the ache.',
    hi: 'पेशाब में जलन: जागते हर घंटे एक पूरा गिलास पानी पिएँ — लक्ष्य साफ़ पेशाब है। चाय, कॉफी, शराब नहीं। पेशाब रोकें नहीं; पेट के निचले हिस्से पर गर्म सेंक से दर्द घटता है।',
  },
  sleep: {
    en: 'For sleep: fix the WAKE-UP time first, same every day. No screens 30 minutes before bed, no tea/coffee after 4 PM, keep the room cool and dark. If awake >20 min, get up, do something boring, return sleepy.',
    hi: 'नींद के लिए: सबसे पहले उठने का समय तय करें, रोज़ एक ही। सोने से 30 मिनट पहले स्क्रीन बंद, शाम 4 बजे के बाद चाय/कॉफी नहीं, कमरा ठंडा-अंधेरा रखें। 20 मिनट से ज़्यादा जागें तो उठ जाएँ, कुछ उबाऊ करें, नींद आए तो लौटें।',
  },
  eye: {
    en: 'For eye strain: the 20-20-20 rule — every 20 minutes, look 20 feet away for 20 seconds. Blink fully, keep screens slightly below eye level, and use lubricating drops if they feel dry. No rubbing.',
    hi: 'आँखों के आराम के लिए: 20-20-20 नियम — हर 20 मिनट पर 20 सेकंड 20 फ़ीट दूर देखें। पूरी पलक झपकें, स्क्रीन आँख से थोड़ी नीचे रखें, सूखन लगे तो लुब्रिकेटिंग ड्रॉप्स लें। मलना नहीं।',
  },
  child: {
    en: 'For a child: watch three things — feeds taken, urine output (6+ wet nappies a day) and activity. Keep fluids going, ORS for loose motions. A quiet, unusually still child needs a doctor sooner, not later.',
    hi: 'बच्चे के लिए: तीन चीज़ें देखें — दूध/खाना कितना लिया, पेशाब (दिन में 6+ गीले नैपी) और चुस्ती। तरल देते रहें, दस्त पर ORS। असामान्य रूप से शांत/सुस्त बच्चे को डॉक्टर जल्दी दिखाएँ, देर से नहीं।',
  },
  womenshealth: {
    en: 'For period pain: a hot-water bag on the lower belly, warm fluids, and light stretching work for most. Iron-rich food through the month (greens, dates, chana) helps heavier cycles.',
    hi: 'माहवारी दर्द में: पेट के निचले हिस्से पर गर्म पानी की थैली, गर्म पेय, और हल्की स्ट्रेचिंग अक्सर काफ़ी है। पूरे महीने आयरन वाला भोजन (हरी सब्ज़ियाँ, खजूर, चना) भारी चक्र में मदद करता है।',
  },
  diabetes: {
    en: 'For sugar: 15-minute walk after each meal, same meal times daily, and one reading before bed + one before breakfast. Keep glucose powder/biscuits at hand for shaky, sweaty low-sugar moments.',
    hi: 'शुगर में: हर भोजन के बाद 15 मिनट की सैर, रोज़ एक ही समय पर खाना, और सोने से पहले + सुबह नाश्ते से पहले एक रीडिंग। काँपन/पसीने जैसे कम-शुगर वाले लक्षणों के लिए ग्लूकोज़ पाउडर/बिस्कुट पास रखें।',
  },
  ear: {
    en: 'For ear pain: warm (not hot) compress against the ear, sleep with the sore ear up, and no cotton-bud poking — it pushes wax deeper. Chewing/gum movement can ease pressure.',
    hi: 'कान दर्द में: गुनगुने (गर्म नहीं) सेंक से कान के पास सहारा, दर्द वाला कान ऊपर रखकर सोएँ, कॉटन-बड न घुसाएँ — मैल और अंदर जाता है। चबाने/मसूड़े चबाने से दबाव कम होता है।',
  },
  tooth: {
    warm: true,
    en: 'For toothache: rinse with warm salt water after eating, cold (not warm) pack on the cheek from outside for swelling, avoid that side while chewing. Clove oil near the tooth can numb it briefly.',
    hi: 'दाँत दर्द में: खाने के बाद गुनगुने नमक-पानी से कुल्ला, सूजन हो तो गाल पर बाहर से ठंडी (गर्म नहीं) सिकाई, चबाते समय उस तरफ़ न चबाएँ। लौंग का तेल दाँत के पास रखने से दर्द थोड़ी देर कम होता है।',
  },
  constipation: {
    en: 'For constipation: 2-3 litres of water through the day, a papaya/orange/apple in the morning, whole-wheat roti over maida, and a 15-minute walk. Set a fixed toilet time after breakfast — the bowel loves routine.',
    hi: 'कब्ज़ में: दिन भर 2-3 लीटर पानी, सुबह पपीता/संतरा/सेब, मैदे की जगह गेहूँ की रोटी, 15 मिनट की सैर। नाश्ते के बाद एक तय शौच-समय रखें — आँत दिनचर्या पसंद करती है।',
  },
  asthma: {
    en: 'For asthma: keep the reliever inhaler where you can reach it in 5 seconds, avoid known triggers (dust, smoke, strong smells), and sit upright leaning slightly forward during mild tightness — never lie flat.',
    hi: 'अस्थमा में: राहत देने वाला इहेलर 5 सेकंड में हाथ लगने वाली जगह रखें, जाने-माने ट्रिगर (धूल, धुएँ, तेज़ गंध) से बचें, और हल्की जकड़न में सीधे बैठें, हल्का आगे झुककर — कभी चित न लेटें।',
  },
}

const GENERIC = {
  homeCare: {
    en: 'Rest, steady fluids, and light food are the honest basics for most everyday troubles. Watch whether things improve over the next 1-2 days — that trend matters more than any single hour.',
    hi: 'आराम, लगातार तरल, और हल्का भोजन — रोज़ की अधिकांश परेशानियों के लिए यही सच्चा आधार है। अगले 1-2 दिन में सुधार दिखता है या नहीं, यही देखना ज़रूरी है।',
  },
  medicine: {
    en: 'For most everyday symptoms, no prescription medicine is needed — rest and time do the work. A pharmacist can suggest simple over-the-counter relief, but bring this to a doctor before starting anything stronger or long-term.',
    hi: 'रोज़ के ज़्यादातर लक्षणों में किसी प्रिस्क्रिप्शन दवा की ज़रूरत नहीं होती — आराम और समय काम करते हैं। फार्मासिस्ट साधारण OTC राहत बता सकते हैं, पर कुछ तेज़ या लंबे समय की दवा शुरू करने से पहले डॉक्टर से पूछें।',
  },
  howLong: {
    en: 'Most everyday symptoms ease within a few days with rest. Track the trend: improving daily is a good sign; staying the same for 3+ days, or worsening, means it is time for a doctor.',
    hi: 'रोज़ के ज़्यादातर लक्षण आराम से कुछ दिनों में ठीक होते हैं। रुझान देखें: रोज़ सुधार अच्छा संकेत है; 3+ दिन तक वैसा ही रहना या बिगड़ना डॉक्टर के पास जाने का समय है।',
  },
  whenDoctor: {
    en: 'See a doctor if symptoms are severe, last longer than 3 days, keep coming back, or come with fever, breathlessness, or new problems elsewhere. Trust a "something is wrong" feeling — it is often right.',
    hi: 'डॉक्टर से मिलें अगर लक्षण तेज़ हों, 3 दिन से ज़्यादा रहें, बार-बार लौटें, या साथ में बुखार, साँस की दिक्कत या नई परेशानी हो। "कुछ गड़बड़ है" की भावना पर भरोसा करें — अक्सर सही होती है।',
  },
  prevent: {
    en: 'Everyday prevention is boringly effective: sleep on time, water through the day, 30 minutes of movement, and clean hands before eating. Small daily choices beat any emergency cure.',
    hi: 'रोज़ की बचाव-देखभाल उबाऊ लेकिन असरदार है: समय पर नींद, दिन भर पानी, 30 मिनट हरकत, खाने से पहले साफ़ हाथ। रोज़ के छोटे फ़ैसले किसी भी आपातकालीन इलाज से बेहतर हैं।',
  },
}

const MEDICINE = {
  fever: {
    en: 'Paracetamol as per the pack label is the standard for fever and aches — with food, never more than 4 doses in 24 hours. Avoid combining multiple paracetamol brands (many cold combos contain it too).',
    hi: 'बुखार और दर्द में पैक लेबल के अनुसार पैरासिटामोल मानक है — भोजन के साथ, 24 घंटे में 4 डोज़ से ज़्यादा नहीं। कई पैरासिटामोल ब्रांड/कॉम्बो एक साथ न लें (ज़्यादातर कोल्ड कॉम्बो में पहले से होता है)।',
  },
  headache: {
    en: 'A single paracetamol is fine for an occasional headache, but painkillers more than 2-3 days a week CAUSE rebound headaches. Water and rest first; medicine second.',
    hi: 'कभी-कभी होने वाले सिर दर्द में एक पैरासिटामोल ठीक है, पर हफ़्ते में 2-3 दिन से ज़्यादा पेनकिलर REBOUND सिर दर्द का कारण बनती है। पहले पानी और आराम; दवा बाद में।',
  },
  stomach: {
    en: 'ORS is the real medicine for loose motions — replace what is lost, sip by sip. Avoid anti-diarrhoea tablets unless a doctor advises (they can hold infection inside). Do NOT take antibiotics on your own.',
    hi: 'दस्त में असली दवा ORS है — जो गया है उसे घूंट-घूंट भरें। डॉक्टर के कहे बिना दस्त रोकने की गोली न लें (संक्रमण अंदर रोक सकती है)। खुद से एंटीबायोटिक बिल्कुल नहीं।',
  },
  cough: {
    en: 'Most coughs are viral and need no antibiotics — ever. Honey at night and warm fluids do more than most cough syrups. See a doctor if it crosses 2 weeks, or blood/whistling breath appears.',
    hi: 'ज़्यादातर खाँसी वायरल होती है और एंटीबायोटिक की ज़रूरत नहीं — कभी नहीं। रात का शहद और गर्म पेय ज़्यादातर कफ़ सिरप से ज़्यादा काम करते हैं। 2 हफ़्ते पार हों या खून/सीटी जैसी साँस आए तो डॉक्टर दिखाएँ।',
  },
  asthma: {
    en: 'Use ONLY your prescribed inhaler — the reliever for tightness, exactly as prescribed. Never borrow someone else\u2019s dose or double up on your own. If you need the reliever more than twice a week, tell your doctor.',
    hi: 'सिर्फ़ अपनी निर्धारित इहेलर का उपयोग करें — जकड़न में राहत वाली, बिल्कुल डॉक्टर के कहे अनुसार। किसी और की दवा या खुद डोज़ दोगुनी न लें। हफ़्ते में दो बार से ज़्यादा राहत वाली चाहिए तो डॉक्टर को बताएँ।',
  },
  urinary: {
    en: 'Burning urine often needs a short antibiotic COURSE — only a doctor can confirm with a urine test and pick the right one. Start extra water today; that alone eases a lot. Self-started antibiotics cause resistance.',
    hi: 'पेशाब की जलन में अक्सर छोटा एंटीबायोटिक कोर्स चाहिए — यूरिन टेस्ट से सिर्फ़ डॉक्टर ही पुष्टि कर सकते हैं। आज से ज़्यादा पानी शुरू करें; अकेले इसी से काफ़ी राहत मिलती है। खुद शुरू की एंटीबायोटिक रेज़िस्टेंस बनाती है।',
  },
  womenshealth: {
    en: 'For cramps, heat and light movement first. Meftal-Spas/ibuprofen-type tablets are common but take any painkiller with food, and not for more than 3 days without a doctor. Heavy cycles need iron and a check-up, not just tablets.',
    hi: 'दर्द में पहले गर्माहट और हल्की चहल-कदमी। Meftal-Spas/ibuprofen वाली गोलियाँ आम हैं पर किसी भी पेनकिलर को भोजन के साथ लें और डॉक्टर के बिना 3 दिन से ज़्यादा नहीं। भारी रक्तस्राव को आयरन और जाँच चाहिए, सिर्फ़ गोली नहीं।',
  },
  child: {
    en: 'Never give a child an adult\u2019s medicine or a half dose of yours. Weight-based children\u2019s paracetamol (as per a doctor/pharmacist) is the only safe fever medicine at home. No aspirin for children with fever, ever.',
    hi: 'बच्चे को कभी बड़ों की दवा या आधी डोज़ न दें। वज़न के अनुसार बच्चों का पैरासिटामोल (डॉक्टर/फार्मासिस्ट से) ही घर पर सुरक्षित है। बुखार में बच्चों को एस्पिरिन कभी नहीं।',
  },
  tooth: {
    en: 'A painkiller tonight is reasonable (with food), but no antibiotic will fix this — a dentist has to treat the tooth itself. An antibiotic "to tide it over" often just delays the visit and the pain comes back.',
    hi: 'आज रात दर्द की गोली ठीक है (खाने के साथ), पर एंटीबायोटिक इसे ठीक नहीं करेगा — दाँत का इलाज डेंटिस्ट को ही करना है। "काटने" के लिए ली एंटीबायोटिक सिर्फ़ मुलाक़ात टलती है और दर्द लौट आता है।',
  },
  constipation: {
    en: 'Try fibre and water first. Isabgol (psyllium) with a full glass of water at night is a gentle, safe option. Laxative tablets should not become a habit — the gut starts depending on them.',
    hi: 'पहले फाइबर और पानी आज़माएँ। रात में एक पूरे गिलास पानी के साथ इसबगोल नरम और सुरक्षित विकल्प है। लैक्सेटिव गोलियाँ आदत न बनें — आँत उन पर निर्भर होने लगती है।',
  },
}

const HOW_LONG = {
  fever: {
    en: 'Viral fever usually runs 3-5 days and peaks on day 2-3. The fever itself is not the enemy — the TREND is: if the highest reading each day starts dropping, you are on the way out.',
    hi: 'वायरल बुखार आम तौर पर 3-5 दिन चलता है और दूसरे-तीसरे दिन चरम पर होता है। बुखार अपने आप में दुश्मन नहीं है — रुझान है: हर दिन की सबसे ऊँची रीडिंग गिरने लगे तो रास्ता निकल रहा है।',
  },
  headache: {
    en: 'A tension headache eases in hours with water, food and rest. Migraines last 4-72 hours. Headaches that are new, daily, or waking you from sleep are a different story — doctor.',
    hi: 'तनाव वाला सिर दर्द पानी, भोजन और आराम से घंटों में शांत होता है। माइग्रेन 4-72 घंटे रहती है। नए, रोज़ के या नींद में जगाने वाले सिर दर्द की कहानी अलग है — डॉक्टर।',
  },
  cough: {
    en: 'A viral cough can linger 2-3 weeks even after the cold clears. Chest x-ray/antibiotics are not needed before 2 weeks unless the red flags above appear.',
    hi: 'वायरल खाँसी ज़ुकाम ठीक होने के बाद भी 2-3 हफ़्ते खिंच सकती है। ऊपर के रेड फ़्लैग न आएँ तो 2 हफ़्ते से पहले X-ray/एंटीबायोटिक ज़रूरी नहीं।',
  },
  stomach: {
    en: 'Most food-related stomach trouble settles in 1-3 days. The clock that matters: no fluids kept down for 12+ hours, or blood in stool/vomit — that is doctor-now, not wait-it-out.',
    hi: 'खाने से जुड़ी पेट की परेशानी 1-3 दिन में शांत होती है। जो घड़ी मायने रखती है: 12+ घंटे पानी भी न रुक रहा हो, या मल/उल्टी में खून — यह डॉक्टर-अभी-अभी है, इंतज़ार नहीं।',
  },
  bodypain: {
    en: 'Post-viral body ache can sit around for a few days and then fades on its own. Pain that is one-sided, with swelling, or not eased by rest needs checking.',
    hi: 'वायरल के बाद का बदन दर्द कुछ दिन रह सकता है, फिर अपने आप घटता है। एक तरफ़ का, सूजन वाला या आराम से कम न होने वाला दर्द जाँच माँगता है।',
  },
  dizziness: {
    en: 'A one-off dizzy spell settles in minutes with water and rest. Spells that keep repeating, or come with any neuro sign, need a doctor sooner rather than later.',
    hi: 'एक बार का चक्कर पानी और आराम से मिनटों में शांत होता है। बार-बार लौटने वाले चक्कर, या किसी न्यूरो संकेत के साथ, डॉक्टर को जल्दी दिखाएँ।',
  },
  urinary: {
    en: 'Simple urine burning eases in 1-2 days with high water intake. If fever or back pain joins it, it may have climbed to the kidneys — that does not wait.',
    hi: 'साधारण जलन ज़्यादा पानी से 1-2 दिन में घटती है। बुखार या कमर दर्द जुड़े तो संक्रमण गुर्दे तक चढ़ सकता है — वह इंतज़ार नहीं करता।',
  },
  sleep: {
    en: 'One rough night resets with a fixed wake-up time the next morning. Sleeplessness stretching past 2-3 weeks deserves a proper check — there is usually a treatable reason.',
    hi: 'एक बुरी रात अगली सुबह तय उठने-समय से वापस बैठ जाती है। 2-3 हफ़्ते से लंबी बेचैनी अच्छी जाँच की हक़दार है — आम तौर पर इलाज योग्य कारण होता है।',
  },
  ear: {
    en: 'Simple ear pain after a cold often clears in 2-3 days as the pressure settles. Pain that is worsening, or with discharge/hearing loss, needs a check — antibiotics only help true infection.',
    hi: 'ज़ुकाम के बाद का साधारण कान दर्द दबाव के शांत होने पर अक्सर 2-3 दिन में ठीक होता है। बढ़ता दर्द, या स्राव/सुनाई कम होना, जाँच माँगता है — एंटीबायोटिक सिर्फ़ सच्चे संक्रमण में काम करते हैं।',
  },
  tooth: {
    en: 'Toothache does not heal itself — the nerve is talking. Pain that "goes away" often means the nerve died, and an abscess follows later. A dentist within a day or two, not a week.',
    hi: 'दाँत दर्द खुद ठीक नहीं होता — नस बोल रही है। "चला गया" दर्द अक्सर नस के मरने का संकेत है, और बाद में फोड़ा बनता है। एक-दो दिन में डेंटिस्ट, हफ़्ते में नहीं।',
  },
  constipation: {
    en: 'With water + fibre + movement, most constipation improves in 2-3 days. Going 3+ days without a motion repeatedly is a pattern a doctor should look at.',
    hi: 'पानी + फाइबर + हरकत से ज़्यादातर कब्ज़ 2-3 दिन में सुधरती है। बार-बार 3+ दिन तक शौच न होना एक पैटर्न है जो डॉक्टर को देखना चाहिए।',
  },
  skin: {
    en: 'Contact-type rashes fade in a few days once the trigger is gone. A rash that spreads hourly, blisters, or comes with fever/lip swelling is not "wait and see" — urgent.',
    hi: 'संपर्क वाले दाने कारण हटते ही कुछ दिनों में धुंधले पड़ते हैं। जो दाने घंटे-घंटे फैलें, फफोले बनें, या बुखार/होंठ सूजन के साथ आएँ — वे "देखें-सुधरे" वाले नहीं हैं — अति आवश्यक।',
  },
}

const WHEN_DOCTOR = {
  fever: {
    en: 'For fever, see a doctor if: it crosses 39.4°C/103°F, lasts beyond 3 days, or comes with stiff neck, rash, confusion, breathlessness, or burning urination. Infants under 3 months with ANY fever go same-day.',
    hi: 'बुखार में डॉक्टर से मिलें अगर: 39.4°C/103°F पार करे, 3 दिन से ज़्यादा रहे, या साथ में गर्दन अकड़न, दाने, भ्रम, साँस की दिक्कत या पेशाब जलन हो। 3 महीने से छोटे बच्चे को कोई भी बुखार हो तो उसी दिन जाएँ।',
  },
  child: {
    en: 'For a child, go sooner, not later, if: under 3 months with any fever, refusing feeds, very few wet nappies, unusually quiet or drowsy, or breathing fast. Children change FAST.',
    hi: 'बच्चे के लिए देर से नहीं, जल्दी जाएँ अगर: 3 महीने से छोटा हो और बुखार हो, दूध न पी रहा हो, गीले नैपी बहुत कम हों, असामान्य शांत/सुस्त हो, या तेज़ साँस ले। बच्चों की हालत तेज़ी से बदलती है।',
  },
  asthma: {
    en: 'For asthma, seek help NOW if: the reliever is not opening the breath within 10-15 minutes, speaking full sentences is hard, lips/nails look blue, or the reliever is needed again within 3-4 hours. Between attacks: ask about a preventer plan.',
    hi: 'अस्थमा में अभी मदद लें अगर: इहेलर 10-15 मिनट में साँस न खोले, पूरे वाक्य बोलना मुश्किल हो, होंठ/नाखून नीले लगें, या 3-4 घंटे में फिर इहेलर चाहिए। दौरों के बीच: रोकथाम योजना के बारे में पूछें।',
  },
  dizziness: {
    en: 'For dizziness, a doctor visit is due if spells repeat over days, or come with chest pain, palpitations, slurred speech, double vision, weakness on one side, or fainting. Sudden, first-time vertigo with vomiting: same-day.',
    hi: 'चक्कर के लिए डॉक्टर जाएँ अगर कुछ दिनों तक बार-बार आएँ, या साथ में सीने दर्द, तेज़ धड़कन, लड़खड़ाती बोली, दोहरी दृष्टि, एक तरफ़ कमज़ोरी या बेहोशी हो। अचानक पहली बार आया चक्कर जिसमें उल्टियाँ हों: उसी दिन।',
  },
  urinary: {
    en: 'For urine burning, a doctor is due within a day if: fever or back/side pain joins, blood is visible, you are pregnant, or it has not eased in 2 days despite high water. Diabetic? Do not wait even that long.',
    hi: 'पेशाब जलन में एक दिन के भीतर डॉक्टर अगर: बुखार या कमर/किनारे दर्द जुड़े, खून दिखे, आप गर्भवती हों, या ज़्यादा पानी के बाद भी 2 दिन में राहत न हो। मधुमेह है? उतना भी न रुकें।',
  },
  tooth: {
    en: 'Face swelling, trouble opening the mouth or swallowing, or fever with tooth pain — same-day, these can spread quickly. Otherwise a dentist within 1-2 days.',
    hi: 'चेहरे पर सूजन, मुँह खोलने या निगलने में दिक्कत, या दाँत दर्द के साथ बुखार — उसी दिन जाएँ, ये तेज़ी से फैल सकते हैं। वरना 1-2 दिन में डेंटिस्ट।',
  },
  eye: {
    en: 'For eyes, urgent same-day care for: sudden vision loss or flashes/curtain, chemical in the eye (rinse 15 min first), injury, or severe pain with nausea and light sensitivity. Redness + discharge: within a day.',
    hi: 'आँखों के लिए उसी दिन तत्काल देखभाल: अचानक दृष्टि जाना या चमक/पर्दा, आँख में केमिकल (पहले 15 मिनट धोएँ), चोट, या तेज़ दर्द के साथ मतली और रोशनी चुभना। लालपन + स्राव: एक दिन में।',
  },
  constipation: {
    ven: true,
    en: 'See a doctor for constipation when: it is new and unexplained, blood is present, weight is falling, or it alternates with diarrhoea. Sudden constipation with vomiting and belly pain: urgent.',
    hi: 'कब्ज़ के लिए डॉक्टर अगर: नई और बिना कारण की हो, खून आए, वज़न गिर रहा हो, या दस्त से बदल-बदल कर आए। अचानक कब्ज़ जिसमें उल्टी और पेट दर्द हो: तत्काल।',
  },
}

const PREVENT = {
  fever: {
    en: 'Fevers travel on hands and droplets — wash hands before eating, keep distance from actively sick people, and don\u2019t share towels. Dengue breeds in clean stagnant water: empty buckets and coolers weekly.',
    hi: 'बुखार हाथ और बूंदों से फैलता है — खाने से पहले हाथ धोएँ, बीमार लोगों से दूरी रखें, तौलिये साझा न करें। डेंगू साफ़ ठहरे पानी में पलता है: हफ़्ते में एक बार बाल्टी-कूलर खाली करें।',
  },
  cough: {
    en: 'Cover coughs with your elbow, wash hands often, keep rooms aired. For most people a yearly flu shot is the single best prevention available.',
    hi: 'खाँसी कोहनी से ढकें, हाथ बार-बार धोएँ, कमरे हवादार रखें। ज़्यादातर लोगों के लिए सालाना फ़्लू वैक्सीन सबसे अच्छी उपलब्ध रोकथाम है।',
  },
  stomach: {
    en: 'Most stomach trouble enters on food and fingers — eat freshly cooked food, wash hands before eating, drink clean/boiled water in the hot months, and avoid cut-fruit sold uncovered.',
    hi: 'पेट की मुसीबत ज़्यादातर खाने और उँगलियों से अंदर आती है — ताज़ा बना खाना खाएँ, खाने से पहले हाथ धोएँ, गर्म महीनों में साफ़/उबला पानी पिएँ, और खुला बेचा कटा फल न लें।',
  },
  headache: {
    en: 'Track your triggers — skipped meals, poor sleep, strong sun, long screen scrolls. Most recurring headaches have 2-3 fixable habits behind them.',
    hi: 'अपने ट्रिगर पहचानें — छूटा भोजन, खराब नींद, तेज़ धूप, लंबी स्क्रीन-स्क्रॉल। बार-बार लौटने वाले सिर दर्द के पीछे ज़्यादातर 2-3 ठीक करने योग्य आदतें होती हैं।',
  },
  diabetes: {
    en: 'Walk 15 minutes after each meal, keep meal times fixed, and get HbA1c + eye + foot checks every year. Small spikes after eating are normal; the AVERAGE is what the damage follows.',
    hi: 'हर भोजन के बाद 15 मिनट सैर, भोजन का समय तय, और साल में एक बार HbA1c + आँख + पैर की जाँच। खाने के बाद का छोटा उछाल सामान्य है; नुक़सान औसत का पीछा करता है।',
  },
  skin: {
    en: 'Keep skin dry and airy, shower after sweating, wear loose cotton in our heat, and never share towels/combs. New cosmetics: test on a small patch first.',
    hi: 'त्वचा सूखी और हवादार रखें, पसीने के बाद नहाएँ, गर्मी में ढीले सूती कपड़े पहनें, तौलिया/कंघी साझा न करें। नया प्रसाधन: पहले छोटे पैच पर आज़माएँ।',
  },
  constipation: {
    en: 'A fixed toilet time after breakfast, 2-3 litres of water, whole grains over maida, a daily walk or yoga, papaya/apple/orange through the week. Routine is the whole trick.',
    hi: 'नाश्ते के बाद तय शौच-समय, 2-3 लीटर पानी, मैदे की जगह साबुत अनाज, रोज़ की सैर या योग, हफ़्ते भर पपीता/सेब/संतरा। आदत ही पूरा तरीका है।',
  },
  ear: {
    en: 'Never clean inside the canal with buds — ears clean themselves. Dry ears after swimming/bathing, treat colds early (the tube blocks first), avoid very loud earphone hours.',
    hi: 'कान के अंदर बड से सफ़ाई कभी नहीं — कान खुद साफ़ रखते हैं। तैराकी/नहाने के बाद कान सुखाएँ, ज़ुकाम का जल्दी इलाज करें (नली पहले बंद होती है), बहुत तेज़ इयरफ़ोन से बचें।',
  },
  tooth: {
    en: 'Brush twice daily with fluoride toothpaste (2 minutes), clean between teeth daily, rinse with water after chai/coffee or sweets, and a dentist once a year catches small holes early.',
    hi: 'फ़्लोराइड टूथपेस्ट से दिन में दो बार ब्रश (2 मिनट), रोज़ दाँतों के बीच सफ़ाई, चाय/कॉफी या मिठाई के बाद पानी का कुल्ला, और साल में एक बार डेंटिस्ट छोटे छेद जल्दी पकड़ लेते हैं।',
  },
  asthma: {
    en: 'Know your triggers (dust, smoke, pollen, cold air, strong smells) and keep a trigger diary. Cover nose in dust, avoid smoke completely, take the preventer exactly as prescribed, and keep the inhaler technique checked yearly.',
    hi: 'अपने ट्रिगर जानें (धूल, धुआँ, पराग, ठंडी हवा, तेज़ गंध) और ट्रिगर-डायरी रखें। धूल में नाक ढकें, धुएँ से पूरी तरह बचें, रोकथाम वाली दवा बिल्कुल निर्धारित रूप से लें, और साल में एक बार इहेलर तकनीक जाँचवाएँ।',
  },
}

// Escalation: explicit duration phrases turn an everyday report into a
// "this has gone on too long" one. Number words are the common Hinglish
// style ("teen din se"); digits covered too. Extracts days when present.
function daysMentioned(text) {
  const t = ' ' + String(text).toLowerCase() + ' '
  const words = { one: 1, ek: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, chaar: 4, four: 4, panch: 5, paanch: 5, five: 5, six: 6, chah: 6, saat: 7, seven: 7, aath: 8, eight: 8, nine: 9, nau: 9, das: 10, ten: 10, pandrah: 15, pandra: 15, fifteen: 15, bees: 20, twenty: 20 }
  let days = null
  const patterns = [
    // \b sits on an ASCII word boundary, which never matches next to
    // Devanagari — use (?!-)\S* lookarounds-free alternation: match the
    // number then a short run of letters/Devanagari up to the unit word.
    /(\d+)\s*[a-z]*\s*(?:din|dino|day|days|दिन)/,
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty)\s+(?:din|dino|day|days|दिन)/,
    /\b(ek|do|teen|char|chaar|panch|paanch|chah|saat|aath|nau|das|pandra|pandrah|bees)\s+(?:din|dino|dinho|दिन)/,
    /\bhafte|हफ़्ते|हफ्ते|week\b/,
    /\bmaheene|महीने|month\b/,
  ]
  const num = (m) => (m[1] && /\d/.test(m[1]) ? parseInt(m[1], 10) : words[m[1]] ?? null)
  for (const re of patterns) {
    const m = t.match(re)
    if (m) { days = num(m); break }
  }
  if (days === null) {
    if (/\bhafte|हफ़्ते|हफ्ते|weeks?\b/.test(t)) days = 14
    if (/\bmaheene|महीने|months?\b/.test(t)) days = 30
  }
  return days
}

function escalationFor(matchIds, text) {
  const d = daysMentioned(text)
  if (d === null) return null
  const LIMITS = [
    [['fever'], 3],
    [['cough'], 14],
    [['headache'], 7],
    [['stomach'], 3],
    [['urinary'], 2],
    [['constipation'], 7],
    [['tooth'], 2],
    [['dizziness'], 7],
    [['ear'], 3],
    [['bodypain'], 7],
    [['skin'], 7],
  ]
  for (const [ids, limit] of LIMITS) {
    if (ids.some((id) => matchIds.includes(id)) && d >= limit) return { days: d, limit }
  }
  // Any other symptom dragged on 7+ days deserves an escalation nudge.
  const MODERATE_IDS = ['dizziness', 'child', 'womenshealth', 'diabetes', 'eye', 'urinary', 'stomach', 'fever', 'ear', 'tooth', 'asthma']
  if (d >= 7 && matchIds.some((id) => MODERATE_IDS.includes(id))) return { days: d, limit: 7 }
  return null
}

const ESCALATION_NOTE = {
  en: (d) => `You mentioned this has been going on for about ${d} day${d > 1 ? 's' : ''} — that is past the usual course for this. Please see a doctor soon rather than waiting longer; the "too long" point has arrived.`,
  hi: (d) => `आपने बताया कि यह करीब ${d} दिन से चल रहा है — इसके लिए यह आम अवधि से आगे बढ़ चुका है। आगे इंतज़ार करने की बजाय कृपया जल्द डॉक्टर से मिलें; "बहुत देर" वाला बिंदु आ चुका है।`,
}

// Intent words — kept above assessWithIntent so the module stays in TDZ-safe
// declaration order.
const INTENT_WORDS = {
  homeCare: ['home', 'ghar par', 'ghar me', 'ghar mein', 'घर पर', 'घर में', 'what can i do', 'kya karu', 'kya karoon', 'kaise theek', 'khud se', 'myself'],
  medicine: ['medicine', 'dawa', 'dava', 'dawai', 'दवा', 'दवाई', 'tablet', 'goli', 'goliyan', 'medication', 'antibiotic', 'painkiller', 'any med'],
  howLong: ['how long', 'kitne din', 'कितने दिन', 'how many days', 'kab tak', 'kab theek', 'when will it', 'get better', 'theek hoga', 'thik hoga', 'recover'],
  whenDoctor: ['doctor', 'hospital', 'daktar', 'डॉक्टर', 'अस्पताल', 'kab jana', 'kab jaun', 'when should i see', 'should i see', 'should i go', 'jana chahiye', 'jaana chahiye', 'visit'],
  prevent: ['prevent', 'avoid', 'bachne', 'बचने', 'बचाव', 'next time', 'agli baar', 'phir se', 'how can i not', 'prevention', 'kaise bache', 'kaise bachu', 'kaise bacchu'],
}

// Intent router: run the chip-question triage FIRST so emergencies and
// compound phrases still flow through the safety rules; if the result is
// a plain everyday symptom, swap in the intent-specific content and
// upgrade severity where the intent implies it (whenDoctor answers are
// meant for people who are actively considering a visit).
export function assessWithIntent(rawText) {
  const text = String(rawText || '')
  const base = assess(text)
  if (!base) return null

  // No intent words → an ordinary symptom report.
  const intent = INTENT_KEYS.find((k) => containsAny(text, INTENT_WORDS[k]))
  if (!intent || base.emergency) return base

  const matchIds = matchedSymptomIds(text)
  const primary = matchIds[0] || null
  const table = { homeCare: HOME_CARE, medicine: MEDICINE, howLong: HOW_LONG, whenDoctor: WHEN_DOCTOR, prevent: PREVENT }[intent]
  const line = (primary && table[primary]) || null
  const content = (line && !line.warm && !line.ven)
    ? { en: line.en, hi: line.hi }
    : (GENERIC[intent] || GENERIC.homeCare)

  return {
    ...base,
    intent,
    intentSymptom: primary,
    advice: { en: [content.en], hi: [content.hi] },
    seek: {
      en: [],
      hi: [],
    },
    severity: intent === 'whenDoctor' && base.severity !== 'emergency'
      ? 'high'
      : base.severity,
    summary: {
      en: primary ? `${base.summary.en} — follow-up` : base.summary.en,
      hi: primary ? `${base.summary.hi} — फ़ॉलो-अप` : base.summary.hi,
    },
  }
}

function matchedSymptomIds(text) {
  return SYMPTOMS.filter((s) => s.keywords.some((kw) => contains(text, kw))).map((s) => s.id)
}

const contains = (text, kw) => {
  const t = ' ' + text.toLowerCase().replace(/[.,!?;:]/g, ' ') + ' '
  return t.includes(kw.toLowerCase())
}

// Main entry: evaluate free text → structured assessment.
// Advice/seek are returned BILINGUAL ({en: [...], hi: [...]}) so the UI can
// render them in whichever language is active at display time — a language
// switch never leaves old replies stuck in the previous language.
export function assess(text) {
  if (!text || !text.trim()) return null

  // 1. Red flags — emergency, immediate override.
  for (const flag of RED_FLAGS) {
    if (flag.keywords.some(kw => contains(text, kw))) {
      return {
        severity: SEVERITY.EMERGENCY,
        flagId: flag.id,
        summary: { en: 'Possible emergency', hi: 'संभावित आपातकाल' },
        advice: { en: [flag.advice.en], hi: [flag.advice.hi] },
        seek: { en: [], hi: [] },
        emergency: true,
      }
    }
  }

  // 2. Collect symptom matches.
  const matches = SYMPTOMS.filter(s => s.keywords.some(kw => contains(text, kw)))

  if (matches.length === 0) {
    return {
      severity: SEVERITY.LOW,
      summary: { en: 'Needs more detail', hi: 'थोड़ी और जानकारी चाहिए' },
      advice: {
        en: ['I couldn\u2019t quite pick that up. Try a few more words — e.g. "headache", "fever since yesterday", "stomach pain after food".'],
        hi: ['मैं इसे ठीक से समझ नहीं पाया। थोड़े और शब्दों में बताइए — जैसे "सिर दर्द है", "बुखार है", "पेट दर्द है"।'],
      },
      seek: { en: [], hi: [] },
      emergency: false,
    }
  }

  // 3. Severity = worst matched symptom; advice = top matches merged.
  const order = [SEVERITY.EMERGENCY, SEVERITY.HIGH, SEVERITY.MODERATE, SEVERITY.LOW]
  matches.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))
  const top = matches.slice(0, 2)
  const severity = top[0].severity
  const dedupe = (arr) => [...new Set(arr)]

  // 3b. Duration escalation — an everyday symptom dragged past its usual
  // course flips to high and carries a dedicated "see a doctor soon" note.
  const esc = escalationFor(matches.map((m) => m.id), text)
  if (esc) {
    return {
      severity: SEVERITY.HIGH,
      summary: {
        en: `${top[0].summary.en} — ongoing (${esc.days} days)`,
        hi: `${top[0].summary.hi} — लंबा चल रहा (${esc.days} दिन)`,
      },
      advice: {
        en: [...top.map(s => s.advice.en), ESCALATION_NOTE.en(esc.days)],
        hi: [...top.map(s => s.advice.hi), ESCALATION_NOTE.hi(esc.days)],
      },
      seek: { en: [], hi: [] },
      emergency: false,
      escalated: true,
    }
  }

  return {
    severity,
    summary: {
      en: top.map(s => s.summary.en).join(' + '),
      hi: top.map(s => s.summary.hi).join(' + '),
    },
    advice: {
      en: top.map(s => s.advice.en),
      hi: top.map(s => s.advice.hi),
    },
    seek: {
      en: dedupe(top.flatMap(s => (s.seek ? [s.seek.en] : []))),
      hi: dedupe(top.flatMap(s => (s.seek.hi ? [s.seek.hi] : []))),
    },
    emergency: false,
  }
}

// Map severity → display config (badge + panel tone).
export const severityMeta = {
  [SEVERITY.EMERGENCY]: { color: 'red', ring: 'border-red-200', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  [SEVERITY.HIGH]: { color: 'red', ring: 'border-red-200', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  [SEVERITY.MODERATE]: { color: 'amber', ring: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-500' },
  [SEVERITY.LOW]: { color: 'amber', ring: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-500' },
}

// Shared reply builder used by the /api/assistant route (server). Returns
// replyParts in BOTH languages ({en: [...], hi: [...]}) — the route ships
// both to the client, which renders whichever matches the active language,
// so a language switch re-renders old replies correctly too.
export function buildAssessment(text) {
  const result = assessWithIntent(text)
  const parts = { en: [], hi: [] }

  if (result.emergency) {
    parts.en.push(result.advice.en[0])
    parts.hi.push(result.advice.hi[0])
  } else {
    parts.en.push(result.summary.en)
    parts.hi.push(result.summary.hi)
    if (result.advice.en.length) {
      parts.en.push(result.advice.en.join(' '))
      parts.hi.push(result.advice.hi.join(' '))
    }
    if (result.seek.en.length) {
      parts.en.push(result.seek.en.join(' '))
      parts.hi.push(result.seek.hi.join(' '))
    }
  }

  return { result, replyParts: parts }
}
