/**
 * Sovereign HospitalOS Kiosk Multi-Lingual Localization Catalog
 * Covers 6 Official Languages: Bengali (bn), Tamil (ta), Telugu (te), Marathi (mr), Hindi (hi), English (en)
 * Zero Cloud Egress · Pure Client-Side Static Linguistic Resource
 */

export type SupportedKioskLanguage = 'hi' | 'en' | 'bn' | 'mr' | 'ta' | 'te';

export interface KioskStepLabels {
  step1: { title: string; short: string };
  step2: { title: string; short: string };
  step3: { title: string; short: string };
  step4: { title: string; short: string };
  step5: { title: string; short: string };
  step6: { title: string; short: string };
}

export interface KioskTranslations {
  bcp47: string;
  nativeName: string;
  englishName: string;
  listenBtn: string;
  speakingBtn: string;
  listenTitle: string;
  
  // Header & Navigation
  hospitalSubtitle: string;
  opdKioskBadge: string;
  sosBtn: string;
  backBtn: string;
  nextBtn: string;
  finishBtn: string;
  audioGuidanceBtn: string;
  stepLabels: KioskStepLabels;
  unfinishedDraftTitle: string;
  continueCheckinBtn: string;
  dismissBtn: string;

  // Step 2: Patient ID
  step2Title: string;
  step2Subtitle: string;
  fullNameLabel: string;
  fullNamePlaceholder: string;
  ageLabel: string;
  genderLabel: string;
  maleOption: string;
  femaleOption: string;
  otherOption: string;
  maternalGuardTitle: string;
  maternalGuardSub: string;
  pregnantLabel: string;
  lactatingLabel: string;
  yesBtn: string;
  noBtn: string;
  step2AudioPrompt: string;

  // Step 3: Voice & Body Intake
  step3Title: string;
  step3Subtitle: string;
  speakSymptomsLabel: string;
  languageSelectLabel: string;
  recordingActive: string;
  tapToSpeak: string;
  savedBadge: string;
  privateModeBadge: string;
  touchOrganGuidance: string;
  speakSymptomsGuidance: string;

  // Step 4: Socrates Pain Details
  step4Title: string;
  step4Subtitle: string;
  painIntensityLabel: string;
  painCharacterLabel: string;
  characters: {
    dull: string;
    sharp: string;
    crushing: string;
    burning: string;
    throbbing: string;
    stiffness: string;
  };
  step4AudioPrompt: string;

  // Step 5: Pariksha Health & Digestion
  step5Title: string;
  step5Subtitle: string;
  rationaleTitle: string;
  step5AudioPrompt: string;

  // Step 6: Documents
  step6Title: string;
  step6Subtitle: string;
  liveCameraBtn: string;
  uploadFileBtn: string;
  byodQrBtn: string;
  scanAnotherBtn: string;
  step6AudioPrompt: string;
}

export const KIOSK_LOCALIZATION: Record<SupportedKioskLanguage, KioskTranslations> = {
  // ==========================================
  // BENGALI (বাংলা)
  // ==========================================
  bn: {
    bcp47: 'bn-IN',
    nativeName: 'বাংলা',
    englishName: 'Bengali',
    listenBtn: 'শুনুন',
    speakingBtn: 'বলছি...',
    listenTitle: 'শুনুন (Tap to Listen)',

    hospitalSubtitle: 'সর্বভারতীয় আয়ুর্বেদ সংস্থান (AIIA)',
    opdKioskBadge: 'OPD কিয়স্ক',
    sosBtn: 'জরুরি SOS',
    backBtn: 'পেছনে',
    nextBtn: 'পরবর্তী',
    finishBtn: 'সম্পন্ন করুন',
    audioGuidanceBtn: 'নির্দেশ শুনুন / Audio Guidance',
    stepLabels: {
      step1: { title: 'ভাষা (Language)', short: 'ভাষা' },
      step2: { title: 'রোগী পরিচয় (Patient ID)', short: 'পরিচয়' },
      step3: { title: 'উপসর্গ ও অঙ্গ (Symptoms)', short: 'উপসর্গ' },
      step4: { title: 'ব্যথার বিবরণ (Pain Details)', short: 'বিবরণ' },
      step5: { title: 'হজম ও স্বাস্থ্য (Health & Digestion)', short: 'হজম' },
      step6: { title: 'প্রেসক্রিপশন ও রিপোর্ট (Documents)', short: 'নথি' }
    },
    unfinishedDraftTitle: 'অসমাপ্ত নিবন্ধন পাওয়া গেছে',
    continueCheckinBtn: 'নিবন্ধন চালিয়ে যান',
    dismissBtn: 'বাতিল করুন',

    step2Title: 'রোগী পরিচয় যাচাই (Patient Verification)',
    step2Subtitle: 'ABHA আইডি, আধার নম্বর বা রোগীর নাম ও বয়স লিখুন',
    fullNameLabel: 'রোগীর পুরো নাম / Full Legal Name *',
    fullNamePlaceholder: 'উদাঃ শান্তা দেবী / Shanta Devi',
    ageLabel: 'বয়স / Age *',
    genderLabel: 'লিঙ্গ / Gender *',
    maleOption: 'পুরুষ / Male',
    femaleOption: 'মহিলা / Female',
    otherOption: 'অন্যান্য / Other',
    maternalGuardTitle: 'মাতৃত্ব ও গর্ভ সুরক্ষা (Maternal-Fetal Pharmacology Guard)',
    maternalGuardSub: 'গর্ভকালীন ক্ষতিকর ঔষধ থেকে সুরক্ষা নিশ্চিত করে',
    pregnantLabel: 'আপনি কি গর্ভবতী? / Pregnant?',
    lactatingLabel: 'আপনি কি শিশুকে বুকের দুধ খাওয়াচ্ছেন? / Lactating?',
    yesBtn: 'হ্যাঁ (Yes)',
    noBtn: 'না (No)',
    step2AudioPrompt: 'অনুগ্রহ করে আপনার আভা আইডি, আধার নম্বর বা নাম এবং বয়স লিখুন। আপনি গর্ভবতী বা স্তন্যদানকারী হলে মাতৃত্ব সুরক্ষা বিকল্পটি অবশ্যই নির্বাচন করুন।',

    step3Title: 'উপসর্গ ও শারীরিক অবস্থান (Symptoms & Body Region)',
    step3Subtitle: '3D মডেলে ব্যথার স্থান স্পর্শ করুন অথবা মাইক্রোফোনে বলুন',
    speakSymptomsLabel: 'মুখে বলুন (Speak Symptoms)',
    languageSelectLabel: 'ভাষা (Language):',
    recordingActive: 'শুনছি... আপনার কষ্ট বলুন',
    tapToSpeak: 'মাইক্রোফোন চেপে বলুন',
    savedBadge: 'সংরক্ষিত (Saved)',
    privateModeBadge: 'গোপনীয়তা মোড সক্রিয় (Private Mode)',
    touchOrganGuidance: 'অনুগ্রহ করে 3D শরীরে ব্যথার অঙ্গটি স্পর্শ করুন, তারপর পরবর্তী বোতামে চাপুন।',
    speakSymptomsGuidance: 'অনুগ্রহ করে মাইক্রোফোন বোতামটি চেপে আপনার সমস্যা বলুন অথবা নিচের তালিকা থেকে নির্বাচন করুন।',

    step4Title: 'ব্যথা ও উপসর্গের বিবরণ (Pain Details)',
    step4Subtitle: 'ব্যথার ধরন, তীব্রতা এবং বিস্তৃতি নির্বাচন করুন',
    painIntensityLabel: 'ব্যথার মাত্রা (Wong-Baker Pain Scale)',
    painCharacterLabel: 'ব্যথার প্রকৃতি (Pain Character)',
    characters: {
      dull: 'মৃদু ব্যথা (Dull Aching / Bheda)',
      sharp: 'তীব্র সূঁচ ফোঁটার মতো (Sharp Needle-like / Toda)',
      crushing: 'ভারী চাপ বা পিষ্ট করার মতো (Crushing Heaviness)',
      burning: 'জ্বলন্ত অনুভূতি (Burning Sensation / Daha)',
      throbbing: 'দপদপ করা ব্যথা (Throbbing / Pulsatile)',
      stiffness: 'আড়ষ্টতা বা টান লাগা (Stiffness / Stambha)'
    },
    step4AudioPrompt: 'অনুগ্রহ করে আপনার ব্যথার স্থান, বিস্তৃতি এবং তীব্রতা নির্বাচন করুন।',

    step5Title: 'হজম ও স্বাস্থ্য পরীক্ষা (Health & Digestion)',
    step5Subtitle: 'আপনার ক্ষুধা, হজম শক্তি ও শারীরিক প্রকৃতি নির্বাচন করুন',
    rationaleTitle: 'লক্ষণ ও হজমের সম্পর্ক (Clinical Rationale)',
    step5AudioPrompt: 'অনুগ্রহ করে আপনার হজম শক্তি, শারীরিক প্রকৃতি এবং শক্তির স্তর নির্বাচন করুন, তারপর পরবর্তী বোতাম চাপুন।',

    step6Title: 'পূর্বের প্রেসক্রিপশন ও রিপোর্ট স্ক্যান (Documents)',
    step6Subtitle: 'পূর্বের প্রেসক্রিপশন বা ল্যাব রিপোর্ট স্ক্যান বা আপলোড করুন',
    liveCameraBtn: 'লাইভ ক্যামেরা (Live Camera)',
    uploadFileBtn: 'নথি আপলোড (Upload Documents)',
    byodQrBtn: 'স্মার্টফোন স্ক্যান (BYOD QR)',
    scanAnotherBtn: '+ আরেকটি নথি যোগ করুন',
    step6AudioPrompt: 'অনুগ্রহ করে আপনার পূর্বের প্রেসক্রিপশন বা ল্যাব স্লিপ স্ক্যান বা আপলোড করুন।'
  },

  // ==========================================
  // ENGLISH (Indian English)
  // ==========================================
  en: {
    bcp47: 'en-IN',
    nativeName: 'English',
    englishName: 'English',
    listenBtn: 'Listen',
    speakingBtn: 'Playing...',
    listenTitle: 'Tap to Listen (English)',

    hospitalSubtitle: 'All India Institute of Ayurveda (AIIA)',
    opdKioskBadge: 'OPD Kiosk',
    sosBtn: 'Emergency SOS',
    backBtn: 'Back',
    nextBtn: 'Next',
    finishBtn: 'Complete Check-In',
    audioGuidanceBtn: 'Audio Guidance',
    stepLabels: {
      step1: { title: 'Language', short: 'Lang' },
      step2: { title: 'Patient Verification', short: 'ID' },
      step3: { title: 'Symptoms & Anatomy', short: 'Symptoms' },
      step4: { title: 'Pain Details', short: 'Pain' },
      step5: { title: 'Health & Digestion', short: 'Digestion' },
      step6: { title: 'Prior Prescriptions', short: 'Docs' }
    },
    unfinishedDraftTitle: 'Unfinished Registration Found',
    continueCheckinBtn: 'Continue Check-In',
    dismissBtn: 'Dismiss',

    step2Title: 'Patient Verification (ABHA / Aadhaar)',
    step2Subtitle: 'Enter ABHA ID, Aadhaar number, or legal patient details below',
    fullNameLabel: 'Full Legal Name *',
    fullNamePlaceholder: 'e.g. Smt. Shanti Devi',
    ageLabel: 'Age *',
    genderLabel: 'Gender *',
    maleOption: 'Male',
    femaleOption: 'Female',
    otherOption: 'Other',
    maternalGuardTitle: 'Maternal-Fetal Pharmacology Guard',
    maternalGuardSub: 'Restricts classical emmenagogues & teratogenic compounds',
    pregnantLabel: 'Are you pregnant? (Garbhini)',
    lactatingLabel: 'Are you lactating / breastfeeding?',
    yesBtn: 'Yes',
    noBtn: 'No',
    step2AudioPrompt: 'Please enter your ABHA ID, Aadhaar number, or name and age. If pregnant or lactating, please select the maternal safety option.',

    step3Title: 'Symptoms & Anatomical Localization',
    step3Subtitle: 'Touch the affected organ on the 3D model or speak via microphone',
    speakSymptomsLabel: 'Speak Symptoms (Vernacular Speech)',
    languageSelectLabel: 'Language:',
    recordingActive: 'Listening... Please speak your symptoms',
    tapToSpeak: 'Tap microphone to speak',
    savedBadge: 'Saved',
    privateModeBadge: 'Privacy Shield Active',
    touchOrganGuidance: 'Please touch the affected organ on the 3D body model, then tap next to continue.',
    speakSymptomsGuidance: 'Please tap the microphone button to speak your symptoms or select choices below.',

    step4Title: 'Pain & Symptom Details (SOCRATES)',
    step4Subtitle: 'Select pain intensity, radiation, and sensation character',
    painIntensityLabel: 'Pain Severity Score (Wong-Baker Scale)',
    painCharacterLabel: 'Pain Sensation Character',
    characters: {
      dull: 'Dull Aching (Bheda)',
      sharp: 'Sharp Needle-like (Toda)',
      crushing: 'Crushing Heaviness',
      burning: 'Burning Sensation (Daha)',
      throbbing: 'Throbbing / Pulsatile',
      stiffness: 'Stiffness (Stambha)'
    },
    step4AudioPrompt: 'Please select your pain location, radiation, and severity score.',

    step5Title: 'Health & Digestion Assessment (Pariksha)',
    step5Subtitle: 'Select your digestive fire (Agni), constitution, and vitality',
    rationaleTitle: 'Clinical Assessment Rationale',
    step5AudioPrompt: 'Please check your digestion, body constitution and energy level, then tap next.',

    step6Title: 'Prior Prescriptions & Lab Slips (Edge OCR)',
    step6Subtitle: 'Scan or upload previous doctor slips to audit drug-herb interactions',
    liveCameraBtn: 'Live Camera Frame',
    uploadFileBtn: 'Upload Documents',
    byodQrBtn: 'Scan from Smartphone (BYOD)',
    scanAnotherBtn: '+ Scan Another Slip',
    step6AudioPrompt: 'Please align your prescription within the frame or upload documents.'
  },

  // ==========================================
  // HINDI (हिन्दी)
  // ==========================================
  hi: {
    bcp47: 'hi-IN',
    nativeName: 'हिन्दी',
    englishName: 'Hindi',
    listenBtn: 'सुनें',
    speakingBtn: 'बोल रहे हैं...',
    listenTitle: 'बोलकर सुनें (Tap to Listen)',

    hospitalSubtitle: 'अखिल भारतीय आयुर्वेद संस्थान (AIIA)',
    opdKioskBadge: 'ओपीडी कियोस्क',
    sosBtn: 'आपातकालीन SOS',
    backBtn: 'पीछे जाएं',
    nextBtn: 'आगे बढ़ें',
    finishBtn: 'पंजीकरण पूर्ण करें',
    audioGuidanceBtn: 'निर्देश सुनें / Audio Guidance',
    stepLabels: {
      step1: { title: 'भाषा (Language)', short: 'भाषा' },
      step2: { title: 'मरीज़ पहचान (Patient ID)', short: 'पहचान' },
      step3: { title: 'तकलीफ़ व अंग (Symptoms)', short: 'लक्षण' },
      step4: { title: 'दर्द का विवरण (Pain Details)', short: 'विवरण' },
      step5: { title: 'पाचन व स्वास्थ्य (Health & Digestion)', short: 'पाचन' },
      step6: { title: 'पर्चे व दस्तावेज़ (Documents)', short: 'दस्तावेज़' }
    },
    unfinishedDraftTitle: 'पिछला पंजीकरण मिला (Unfinished Registration Found)',
    continueCheckinBtn: 'पंजीकरण जारी रखें',
    dismissBtn: 'रद्द करें',

    step2Title: 'रोगी पहचान (Patient Verification)',
    step2Subtitle: 'आभा आईडी, आधार नंबर या मरीज़ का नाम व उम्र दर्ज करें',
    fullNameLabel: 'रोगी का पूरा नाम / Full Legal Name *',
    fullNamePlaceholder: 'उदा. श्रीमती शांति देवी',
    ageLabel: 'आयु / Age *',
    genderLabel: 'लिंग / Gender *',
    maleOption: 'पुरुष / Male',
    femaleOption: 'महिला / Female',
    otherOption: 'अन्य / Other',
    maternalGuardTitle: 'मातृत्व एवं गर्भ सुरक्षा / Maternal-Fetal Pharmacology Guard',
    maternalGuardSub: 'गर्भ के लिए हानिकारक औषधियों पर रोक लगाता है',
    pregnantLabel: 'क्या आप गर्भवती हैं? / Pregnant?',
    lactatingLabel: 'क्या आप स्तनपान करा रही हैं? / Lactating?',
    yesBtn: 'हाँ (Yes)',
    noBtn: 'नहीं (No)',
    step2AudioPrompt: 'कृपया अपना आभा आईडी, आधार नंबर या नाम और उम्र दर्ज करें। यदि आप गर्भवती हैं या स्तनपान करा रही हैं, तो मातृत्व सुरक्षा विकल्प अवश्य चुनें।',

    step3Title: 'तकलीफ़ व शारीरिक स्थान (Symptoms & Anatomy)',
    step3Subtitle: '3D मॉडल पर अपनी तकलीफ़ का अंग चुनें या माइक दबाकर बोलें',
    speakSymptomsLabel: 'बोलकर बताएं (Speak Symptoms)',
    languageSelectLabel: 'भाषा (Language):',
    recordingActive: 'सुन रहे हैं... कृपया अपनी परेशानी बताएं',
    tapToSpeak: 'माइक दबाकर बोलें',
    savedBadge: 'सत्यापित (Saved)',
    privateModeBadge: 'गोपनीय दृष्टि कवच सक्रिय (Private Mode)',
    touchOrganGuidance: 'कृपया 3D शरीर मॉडल पर अपनी तकलीफ़ का अंग छूकर बताएं, फिर आगे बढ़ें बटन दबाएं।',
    speakSymptomsGuidance: 'कृपया माइक दबाकर अपनी तकलीफ़ बोलें या नीचे दिए गए लक्षणों को चुनें।',

    step4Title: 'दर्द व लक्षण विवरण (Pain Details)',
    step4Subtitle: 'दर्द की तीव्रता, प्रकार और फैलाव का चयन करें',
    painIntensityLabel: 'दर्द की तीव्रता (Wong-Baker Pain Scale)',
    painCharacterLabel: 'दर्द की प्रकृति (Pain Character)',
    characters: {
      dull: 'मीठा-मीठा धीमा दर्द (Dull Aching / Bheda)',
      sharp: 'तीखा चुभने वाला (Sharp Needle-like / Toda)',
      crushing: 'भारी दबाव / कुचलने जैसा (Crushing / Heavy Pressure)',
      burning: 'तेज़ जलन (Burning Sensation / Daha)',
      throbbing: 'धड़कने वाला दर्द (Throbbing / Pulsatile)',
      stiffness: 'जकड़न / अकड़न (Stiffness / Stambha)'
    },
    step4AudioPrompt: 'कृपया अपने दर्द का स्थान, फैलाव, और तीव्रता चुनें।',

    step5Title: 'पाचन व स्वास्थ्य (Digestion & Health)',
    step5Subtitle: 'अपनी भूख, पाचन व सामान्य ऊर्जा का चयन करें',
    rationaleTitle: 'लक्षण व पाचन का संबंध (Clinical Rationale)',
    step5AudioPrompt: 'कृपया अपनी पाचन शक्ति, शारीरिक प्रकृति और ऊर्जा स्तर चुनें, फिर आगे बढ़ें।',

    step6Title: 'पर्चे व दस्तावेज़ स्कैनर (Documents)',
    step6Subtitle: 'पुराने पर्चे या लैब रिपोर्ट कैमरे से स्कैन करें या फ़ाइल अपलोड करें',
    liveCameraBtn: 'लाइव कैमरा प्रारंभ करें (Live Camera)',
    uploadFileBtn: 'फ़ाइल अपलोड करें (Upload Documents)',
    byodQrBtn: 'स्मार्टफोन से स्कैन (BYOD QR)',
    scanAnotherBtn: '+ दूसरा पर्चा स्कैन करें',
    step6AudioPrompt: 'कृपया अपने पिछले पर्चे या लैब रिपोर्ट को स्कैन करें या अपलोड करें।'
  },

  // ==========================================
  // MARATHI (मराठी)
  // ==========================================
  mr: {
    bcp47: 'mr-IN',
    nativeName: 'मराठी',
    englishName: 'Marathi',
    listenBtn: 'ऐका',
    speakingBtn: 'बोलत आहे...',
    listenTitle: 'ऐका (Tap to Listen)',

    hospitalSubtitle: 'अखिल भारतीय आयुर्वेद संस्था (AIIA)',
    opdKioskBadge: 'OPD किओस्क',
    sosBtn: 'तातडीचे SOS',
    backBtn: 'मागे जा',
    nextBtn: 'पुढे जा',
    finishBtn: 'नोंदणी पूर्ण करा',
    audioGuidanceBtn: 'सूचना ऐका / Audio Guidance',
    stepLabels: {
      step1: { title: 'भाषा (Language)', short: 'भाषा' },
      step2: { title: 'रुग्ण ओळख (Patient ID)', short: 'ओळख' },
      step3: { title: 'त्रास व अवयव (Symptoms)', short: 'लक्षणे' },
      step4: { title: 'वेदना तपशील (Pain Details)', short: 'तपशील' },
      step5: { title: 'पचन व आरोग्य (Health & Digestion)', short: 'पचन' },
      step6: { title: 'कागदपत्रे (Documents)', short: 'कागदपत्रे' }
    },
    unfinishedDraftTitle: 'अपूर्ण नोंदणी आढळली',
    continueCheckinBtn: 'नोंदणी सुरू ठेवा',
    dismissBtn: 'रद्द करा',

    step2Title: 'रुग्ण ओळख पडताळणी (Patient Verification)',
    step2Subtitle: 'ABHA आयडी, आधार क्रमांक किंवा रुग्णाचे नाव व वय प्रविष्ट करा',
    fullNameLabel: 'रुग्णाचे पूर्ण नाव / Full Legal Name *',
    fullNamePlaceholder: 'उदा. श्रीमती शांती देवी',
    ageLabel: 'वय / Age *',
    genderLabel: 'लिंग / Gender *',
    maleOption: 'पुरुष / Male',
    femaleOption: 'स्त्री / Female',
    otherOption: 'इतर / Other',
    maternalGuardTitle: 'मातृत्व व गर्भ सुरक्षा (Maternal-Fetal Pharmacology Guard)',
    maternalGuardSub: 'गर्भासाठी हानिकारक औषधांपासून संरक्षण',
    pregnantLabel: 'आपण गरोदर आहात का? / Pregnant?',
    lactatingLabel: 'आपण स्तनपान करत आहात का? / Lactating?',
    yesBtn: 'होय (Yes)',
    noBtn: 'नाही (No)',
    step2AudioPrompt: 'कृपया आपला आभा आयडी, आधार क्रमांक किंवा नाव आणि वय प्रविष्ट करा. गरोदर असल्यास मातृत्व सुरक्षा पर्याय नक्की निवडा.',

    step3Title: 'लक्षणे व अवयव निवड (Symptoms & Anatomy)',
    step3Subtitle: '3D शरीरावर दुखणारा भाग निवडा किंवा माइकवर बोला',
    speakSymptomsLabel: 'बोलून सांगा (Speak Symptoms)',
    languageSelectLabel: 'भाषा (Language):',
    recordingActive: 'ऐकत आहोत... कृपया आपला त्रास सांगा',
    tapToSpeak: 'माइक दाबून बोला',
    savedBadge: 'जतन केले (Saved)',
    privateModeBadge: 'गोपनीयता कवच सक्रिय (Private Mode)',
    touchOrganGuidance: 'कृपया 3D शरीरावर तुमचा दुखणारा भाग निवडा आणि नंतर पुढे जा बटण दाबा.',
    speakSymptomsGuidance: 'कृपया माइक दाबून आपला त्रास बोला किंवा खालील लक्षणे निवडा.',

    step4Title: 'वेदना तपशील (Pain Details)',
    step4Subtitle: 'वेदनेची तीव्रता आणि स्वरूप निवडा',
    painIntensityLabel: 'वेदनेची तीव्रता (Wong-Baker Scale)',
    painCharacterLabel: 'वेदनेचे स्वरूप (Pain Character)',
    characters: {
      dull: 'मंद मंद वेदना (Dull Aching / Bheda)',
      sharp: 'सुई टोचल्यासारखी वेदना (Sharp Needle-like / Toda)',
      crushing: 'जड दाब किंवा चिरडल्यासारखे (Crushing Heaviness)',
      burning: 'तीव्र जळजळ (Burning Sensation / Daha)',
      throbbing: 'धडधडणारी वेदना (Throbbing / Pulsatile)',
      stiffness: 'अकडणे / ताठरता (Stiffness / Stambha)'
    },
    step4AudioPrompt: 'कृपया तुमच्या वेदनेचे ठिकाण, प्रकार आणि तीव्रता निवडा.',

    step5Title: 'पचन व प्रकृती तपासणी (Digestion & Health)',
    step5Subtitle: 'आपली भूक, पचन आणि प्रकृती निवडा',
    rationaleTitle: 'लक्षणे व पचनाचा संबंध (Clinical Rationale)',
    step5AudioPrompt: 'कृपया आपली पचनशक्ती, शारीरिक प्रकृती आणि ऊर्जा पातळी निवडा, नंतर पुढे जा.',

    step6Title: 'जुनी प्रिस्क्रिप्शन व चाचण्या (Documents)',
    step6Subtitle: 'जुनी प्रिस्क्रिप्शन कॅमेऱ्याने स्कॅन करा किंवा अपलोड करा',
    liveCameraBtn: 'लाइव्ह कॅमेरा (Live Camera)',
    uploadFileBtn: 'फाइल अपलोड करा (Upload Documents)',
    byodQrBtn: 'स्मार्टफोनवरून स्कॅन (BYOD QR)',
    scanAnotherBtn: '+ आणखी एक कागदपत्र जोडा',
    step6AudioPrompt: 'कृपया तुमची जुनी प्रिस्क्रिप्शन किंवा लॅब रिपोर्ट स्कॅन करा किंवा अपलोड करा.'
  },

  // ==========================================
  // TAMIL (தமிழ்)
  // ==========================================
  ta: {
    bcp47: 'ta-IN',
    nativeName: 'தமிழ்',
    englishName: 'Tamil',
    listenBtn: 'கேளுங்கள்',
    speakingBtn: 'பேசுகிறது...',
    listenTitle: 'கேளுங்கள் (Tap to Listen)',

    hospitalSubtitle: 'அனைத்திந்திய ஆயுர்வேத நிறுவனம் (AIIA)',
    opdKioskBadge: 'OPD கியோஸ்க்',
    sosBtn: 'அவசர SOS',
    backBtn: 'பின்னே',
    nextBtn: 'அடுத்து',
    finishBtn: 'பதிவை முடிக்கவும்',
    audioGuidanceBtn: 'வழிகாட்டுதல் கேளுங்கள் / Audio Guidance',
    stepLabels: {
      step1: { title: 'மொழி (Language)', short: 'மொழி' },
      step2: { title: 'நோயாளி அடையாளம் (Patient ID)', short: 'அடையாளம்' },
      step3: { title: 'அறிகுறி & உடல் (Symptoms)', short: 'அறிகுறி' },
      step4: { title: 'வலி விவரம் (Pain Details)', short: 'விவரம்' },
      step5: { title: 'செரிமானம் & நலம் (Health & Digestion)', short: 'செரிமானம்' },
      step6: { title: 'மருத்துவ ஆவணங்கள் (Documents)', short: 'ஆவணங்கள்' }
    },
    unfinishedDraftTitle: 'முடிக்கப்படாத பதிவு கண்டறியப்பட்டது',
    continueCheckinBtn: 'பதிவைத் தொடரவும்',
    dismissBtn: 'ரத்துசெய்',

    step2Title: 'நோயாளி சரிபார்ப்பு (Patient Verification)',
    step2Subtitle: 'ABHA ஐடி, ஆதார் எண் அல்லது பெயர் மற்றும் வயதை உள்ளிடவும்',
    fullNameLabel: 'முழு சட்டபூர்வ பெயர் / Full Legal Name *',
    fullNamePlaceholder: 'எ.கா. திருமதி சாந்தி தேவி',
    ageLabel: 'வயது / Age *',
    genderLabel: 'பாலினம் / Gender *',
    maleOption: 'ஆண் / Male',
    femaleOption: 'பெண் / Female',
    otherOption: 'மற்றவை / Other',
    maternalGuardTitle: 'தாய்மை & கரு பாதுகாப்பு (Maternal-Fetal Pharmacology Guard)',
    maternalGuardSub: 'கருவுக்கு ஆபத்தான மருந்துகளிலிருந்து பாதுகாப்பு',
    pregnantLabel: 'நீங்கள் கர்ப்பமாக உள்ளீர்களா? / Pregnant?',
    lactatingLabel: 'தாய்ப்பால் ஊட்டுகிறீர்களா? / Lactating?',
    yesBtn: 'ஆம் (Yes)',
    noBtn: 'இல்லை (No)',
    step2AudioPrompt: 'தயவுசெய்து உங்கள் ஆபா ஐடி, ஆதார் எண் அல்லது பெயர் மற்றும் வயதை உள்ளிடவும். கர்ப்பமாக இருந்தால் தாய்மை பாதுகாப்பு விருப்பத்தை தேர்ந்தெடுக்கவும்.',

    step3Title: 'அறிகுறிகள் & உடல் பகுதி (Symptoms & Anatomy)',
    step3Subtitle: '3D மாதிரியில் வலி உள்ள பகுதியைத் தொடவும் அல்லது பேசவும்',
    speakSymptomsLabel: 'பேசி விவரிக்கவும் (Speak Symptoms)',
    languageSelectLabel: 'மொழி (Language):',
    recordingActive: 'கேட்கிறது... உங்கள் தொந்தரவை கூறவும்',
    tapToSpeak: 'மைக்கை அழுத்தி பேசவும்',
    savedBadge: 'சேமிக்கப்பட்டது (Saved)',
    privateModeBadge: 'தனிநபர் பாதுகாப்பு செயலில் (Private Mode)',
    touchOrganGuidance: 'தயவுசெய்து 3D மாதிரியில் வலி உள்ள பகுதியைத் தொட்டு தேர்ந்தெடுக்கவும், பின்னர் அடுத்து பொத்தானை அழுத்தவும்.',
    speakSymptomsGuidance: 'தயவுசெய்து மைக்ரோஃபோன் பொத்தானை அழுத்தி உங்கள் அறிகுறிகளைப் பேசவும் அல்லது கீழே உள்ளவற்றில் தேர்ந்தெடுக்கவும்.',

    step4Title: 'வலி விவரம் (Pain Details)',
    step4Subtitle: 'வலியின் தீவிரம் மற்றும் தன்மையைத் தேர்ந்தெடுக்கவும்',
    painIntensityLabel: 'வலியின் அளவு (Wong-Baker Scale)',
    painCharacterLabel: 'வலியின் தன்மை (Pain Character)',
    characters: {
      dull: 'மிதமான வலி (Dull Aching / Bheda)',
      sharp: 'ஊசி குத்துவது போன்ற வலி (Sharp Needle-like / Toda)',
      crushing: 'அழுத்தும் கனமான வலி (Crushing Heaviness)',
      burning: 'எரிச்சல் உணர்வு (Burning Sensation / Daha)',
      throbbing: 'துடிக்கும் வலி (Throbbing / Pulsatile)',
      stiffness: 'விறைப்பு / பிடிப்பு (Stiffness / Stambha)'
    },
    step4AudioPrompt: 'தயவுசெய்து உங்கள் வலியின் இடம், பரவல் மற்றும் தீவிரத்தை தேர்ந்தெடுக்கவும்.',

    step5Title: 'செரிமானம் & உடல் ஆரோக்கியம் (Digestion & Health)',
    step5Subtitle: 'உங்கள் பசி, செரிமான சக்தி மற்றும் உடல் நிலையை தேர்ந்தெடுக்கவும்',
    rationaleTitle: 'அறிகுறிகளும் செரிமானமும் (Clinical Rationale)',
    step5AudioPrompt: 'தயவுசெய்து உங்கள் செரிமான சக்தி, உடல் தன்மை மற்றும் ஆற்றல் அளவை தேர்வு செய்து அடுத்து அழுத்தவும்.',

    step6Title: 'பழைய மருந்துச்சீட்டு & பரிசோதனை (Documents)',
    step6Subtitle: 'பழைய மருந்துச்சீட்டு அல்லது ஆய்வக அறிக்கையை ஸ்கேன் செய்யவும்',
    liveCameraBtn: 'நேரடி கேமரா (Live Camera)',
    uploadFileBtn: 'கோப்புகளைப் பதிவேற்றவும் (Upload Documents)',
    byodQrBtn: 'ஸ்மார்ட்போன் ஸ்கேன் (BYOD QR)',
    scanAnotherBtn: '+ மற்றொரு ஆவணத்தைச் சேர்க்கவும்',
    step6AudioPrompt: 'தயவுசெய்து உங்கள் முந்தைய மருந்துச்சீட்டு அல்லது ஆய்வக அறிக்கையை ஸ்கேன் செய்யவும்.'
  },

  // ==========================================
  // TELUGU (తెలుగు)
  // ==========================================
  te: {
    bcp47: 'te-IN',
    nativeName: 'తెలుగు',
    englishName: 'Telugu',
    listenBtn: 'వినండి',
    speakingBtn: 'మాట్లాడుతోంది...',
    listenTitle: 'వినండి (Tap to Listen)',

    hospitalSubtitle: 'అఖిల భారత ఆయుర్వేద సంస్థ (AIIA)',
    opdKioskBadge: 'OPD కియోస్క్',
    sosBtn: 'అత్యవసర SOS',
    backBtn: 'వెనుకకు',
    nextBtn: 'ముందుకు',
    finishBtn: 'నమోదు పూర్తి చేయండి',
    audioGuidanceBtn: 'సూచనలు వినండి / Audio Guidance',
    stepLabels: {
      step1: { title: 'భాష (Language)', short: 'భాష' },
      step2: { title: 'రోగి గుర్తింపు (Patient ID)', short: 'గుర్తింపు' },
      step3: { title: 'లక్షణాలు & అవయవం (Symptoms)', short: 'లక్షణాలు' },
      step4: { title: 'నొప్పి వివరాలు (Pain Details)', short: 'వివరాలు' },
      step5: { title: 'జీర్ణక్రియ & ఆరోగ్యం (Health & Digestion)', short: 'జీర్ణక్రియ' },
      step6: { title: 'వైద్య పత్రాలు (Documents)', short: 'పత్రాలు' }
    },
    unfinishedDraftTitle: 'అసంపూర్ణ నమోదు కనుగొనబడింది',
    continueCheckinBtn: 'నమోదును కొనసాగించండి',
    dismissBtn: 'రద్దు చేయండి',

    step2Title: 'రోగి గుర్తింపు ధృవీకరణ (Patient Verification)',
    step2Subtitle: 'ABHA ఐడీ, ఆధార్ సంఖ్య లేదా పేరు మరియు వయస్సు నమోదు చేయండి',
    fullNameLabel: 'పూర్తి చట్టపరమైన పేరు / Full Legal Name *',
    fullNamePlaceholder: 'ఉదా. శ్రీమతి శాంతి దేవి',
    ageLabel: 'వయస్సు / Age *',
    genderLabel: 'లింగం / Gender *',
    maleOption: 'పురుషుడు / Male',
    femaleOption: 'మహిళ / Female',
    otherOption: 'ఇతర / Other',
    maternalGuardTitle: 'మాతృత్వ & గర్భ రక్షణ (Maternal-Fetal Pharmacology Guard)',
    maternalGuardSub: 'గర్భానికి హానికరమైన మందులను నిరోధిస్తుంది',
    pregnantLabel: 'మీరు గర్భవతా? / Pregnant?',
    lactatingLabel: 'మీరు పాలిస్తున్నారా? / Lactating?',
    yesBtn: 'అవును (Yes)',
    noBtn: 'కాదు (No)',
    step2AudioPrompt: 'దయచేసి మీ ఆభా ఐడీ, ఆధార్ సంఖ్య లేదా పేరు మరియు వయస్సు నమోదు చేయండి. గర్భిణీ అయితే మాతృత్వ రక్షణ ఎంపికను తప్పక ఎంచుకోండి.',

    step3Title: 'లక్షణాలు & శరీర స్థానం (Symptoms & Anatomy)',
    step3Subtitle: '3D నమూనాపై నొప్పి ఉన్న భాగాన్ని తాకండి లేదా మైక్ ద్వారా చెప్పండి',
    speakSymptomsLabel: 'మాట్లాడి చెప్పండి (Speak Symptoms)',
    languageSelectLabel: 'భాష (Language):',
    recordingActive: 'వింటున్నాము... మీ సమస్యను చెప్పండి',
    tapToSpeak: 'మైక్ నొక్కి మాట్లాడండి',
    savedBadge: 'సేవ్ చేయబడింది (Saved)',
    privateModeBadge: 'గోప్యతా కవచం సక్రియం (Private Mode)',
    touchOrganGuidance: 'దయచేసి 3D శరీర నమూనాలో మీ నొప్పి ఉన్న భాగాన్ని తాకి ఎంచుకోండి, తర్వాత ముందుకు వెళ్లండి.',
    speakSymptomsGuidance: 'దయచేసి మైక్రోఫోన్ బటన్ నొక్కి మీ లక్షణాలను చెప్పండి లేదా క్రింది వాటి నుండి ఎంచుకోండి.',

    step4Title: 'నొప్పి వివరాలు (Pain Details)',
    step4Subtitle: 'నొప్పి తీవ్రత మరియు స్వభావాన్ని ఎంచుకోండి',
    painIntensityLabel: 'నొప్పి తీవ్రత (Wong-Baker Scale)',
    painCharacterLabel: 'నొప్పి స్వభావం (Pain Character)',
    characters: {
      dull: 'నెమ్మదిగా ఉండే నొప్పి (Dull Aching / Bheda)',
      sharp: 'సూది గుచ్చినట్లు ఉండే నొప్పి (Sharp Needle-like / Toda)',
      crushing: 'బరువైన ఒత్తిడి నొప్పి (Crushing Heaviness)',
      burning: 'మంటగా ఉండే నొప్పి (Burning Sensation / Daha)',
      throbbing: 'దడదడలాడే నొప్పి (Throbbing / Pulsatile)',
      stiffness: 'పట్టేసినట్లు ఉండటం (Stiffness / Stambha)'
    },
    step4AudioPrompt: 'దయచేసి మీ నొప్పి ఉన్న ప్రదేశం, వ్యాప్తి మరియు తీవ్రతను ఎంచుకోండి.',

    step5Title: 'జీర్ణక్రియ & ఆరోగ్య పరీక్ష (Digestion & Health)',
    step5Subtitle: 'మీ ఆకలి, జీర్ణశక్తి మరియు శరీర తత్వాన్ని ఎంచుకోండి',
    rationaleTitle: 'లక్షణాలు మరియు జీర్ణక్రియ సంబంధం (Clinical Rationale)',
    step5AudioPrompt: 'దయచేసి మీ జీర్ణశక్తి, శరీర స్వభావం మరియు శక్తి స్థాయిని ఎంచుకుని, ముందుకు వెళ్లండి.',

    step6Title: 'పాత ప్రిస్క్రిప్షన్ & నివేదికలు (Documents)',
    step6Subtitle: 'పాత ప్రిస్క్రిప్షన్ లేదా ల్యాబ్ స్లిప్పులను స్కాన్ చేయండి లేదా అప్‌లోడ్ చేయండి',
    liveCameraBtn: 'లైవ్ కెమెరా (Live Camera)',
    uploadFileBtn: 'ఫైళ్లను అప్‌లోడ్ చేయండి (Upload Documents)',
    byodQrBtn: 'స్మార్ట్‌ఫోన్ స్కాన్ (BYOD QR)',
    scanAnotherBtn: '+ మరొక పత్రాన్ని జోడించండి',
    step6AudioPrompt: 'దయచేసి మీ మునుపటి ప్రిస్క్రిప్షన్ లేదా ల్యాబ్ స్లిప్పును స్కాన్ చేయండి లేదా అప్‌లోడ్ చేయండి.'
  }
};

export const getKioskTranslations = (langCode?: string): KioskTranslations => {
  const code = (langCode || 'hi').toLowerCase().substring(0, 2) as SupportedKioskLanguage;
  return KIOSK_LOCALIZATION[code] || KIOSK_LOCALIZATION['en'];
};

export interface ParikshaOption {
  title: string;
  sub: string;
}

export interface ParikshaLocalization {
  agniSectionTitle: string;
  agniBadge: string;
  autoCalibratedBadge: string;
  agniOptions: Record<'SAMAGNI' | 'VISHAMAGNI' | 'TIKSHNAGNI' | 'MANDAGNI', ParikshaOption>;
  prakritiSectionTitle: string;
  prakritiOptions: Array<{ id: string; title: string; sub: string }>;
  vitalitySectionTitle: string;
  vitalityOptions: Array<{ key: 'Pravara' | 'Madhyama' | 'Avara'; title: string; sub: string }>;
  backBtn: string;
  nextBtn: string;
}

export const PARIKSHA_LOCALES: Record<SupportedKioskLanguage, ParikshaLocalization> = {
  hi: {
    agniSectionTitle: '1. आपकी भूख व पाचन कैसा रहता है? (Digestion & Appetite)',
    agniBadge: 'अग्नि परीक्षा',
    autoCalibratedBadge: 'लक्षणों के आधार पर चयनित',
    agniOptions: {
      SAMAGNI: {
        title: 'संतुलित पाचन (Normal / Healthy)',
        sub: 'समय पर भूख लगती है, भोजन आसानी से पचता है, गैस या जलन नहीं होती।'
      },
      VISHAMAGNI: {
        title: 'गैस व अनियमित (Gas & Irregular)',
        sub: 'कभी तेज भूख तो कभी बिल्कुल नहीं, पेट में गैस, भारीपन व फूलापन।'
      },
      TIKSHNAGNI: {
        title: 'जलन व एसिडिटी (Burning & Acidity)',
        sub: 'तेज भूख, सीने व पेट में जलन, खट्टी डकार या भोजन के बाद दाह।'
      },
      MANDAGNI: {
        title: 'भारीपन व सुस्ती (Heavy & Sluggish)',
        sub: 'धीमा पाचन, भोजन के बाद अत्यधिक भारीपन, आलस्य व अपच।'
      }
    },
    prakritiSectionTitle: '2. आपकी शारीरिक प्रकृति (Body Constitution)',
    prakritiOptions: [
      { id: 'Vataja', title: 'हल्का शरीर (Vata)', sub: 'ठंड लगना, सक्रिय, दुबला शरीर' },
      { id: 'Pittaja', title: 'गर्म शरीर (Pitta)', sub: 'गर्मी लगना, तेज भूख, मध्यम देह' },
      { id: 'Kaphaja', title: 'मजबूत शरीर (Kapha)', sub: 'भारी शरीर, शांत, स्थिर' },
      { id: 'Vata-Pitta', title: 'संतुलित (Balanced)', sub: 'दोषों का मिला-जुला प्रभाव' }
    ],
    vitalitySectionTitle: '3. ऊर्जा स्तर व सहनशक्ति (Energy Level)',
    vitalityOptions: [
      { key: 'Pravara', title: 'उत्तम ऊर्जा (High)', sub: 'दिनभर अच्छी स्फूर्ति व ताज़गी।' },
      { key: 'Madhyama', title: 'सामान्य ऊर्जा (Normal)', sub: 'सामान्य ऊर्जा व दैनिक काम।' },
      { key: 'Avara', title: 'कमजोरी (Low)', sub: 'जल्दी थकान व कमजोरी महसूस होना।' }
    ],
    backBtn: 'पिछला: लक्षण (Back to Symptoms)',
    nextBtn: 'आगे बढ़ें: दस्तावेज़ स्कैन'
  },
  en: {
    agniSectionTitle: '1. Digestion & Appetite (Agni Assessment)',
    agniBadge: 'Agni Assessment',
    autoCalibratedBadge: 'Auto-calibrated from Symptoms',
    agniOptions: {
      SAMAGNI: {
        title: 'Balanced Digestion (Samagni)',
        sub: 'Regular appetite, food digests comfortably, no bloating or heartburn.'
      },
      VISHAMAGNI: {
        title: 'Irregular & Bloating (Vishamagni)',
        sub: 'Fluctuating appetite, frequent gas, abdominal bloating and distension.'
      },
      TIKSHNAGNI: {
        title: 'Intense & Acidic (Tikshnagni)',
        sub: 'Sharp ravenous appetite, intense heartburn, acid reflux and burning sensation.'
      },
      MANDAGNI: {
        title: 'Sluggish & Heavy (Mandagni)',
        sub: 'Weak slow digestion, lethargy after eating, persistent fullness and indigestion.'
      }
    },
    prakritiSectionTitle: '2. Biological Constitution (Prakriti)',
    prakritiOptions: [
      { id: 'Vataja', title: 'Light Frame (Vata)', sub: 'Cold sensitivity, active, lean' },
      { id: 'Pittaja', title: 'Warm Frame (Pitta)', sub: 'Heat sensitive, sharp hunger, medium frame' },
      { id: 'Kaphaja', title: 'Sturdy Frame (Kapha)', sub: 'Solid build, calm, steady' },
      { id: 'Vata-Pitta', title: 'Balanced (Mixed)', sub: 'Mixed dosha constitution' }
    ],
    vitalitySectionTitle: '3. Vitality & Stamina (Sara Assessment)',
    vitalityOptions: [
      { key: 'Pravara', title: 'High Vitality (Pravara)', sub: 'Energetic throughout the day, resilient.' },
      { key: 'Madhyama', title: 'Moderate Vitality (Madhyama)', sub: 'Adequate stamina for daily activities.' },
      { key: 'Avara', title: 'Low Vitality (Avara)', sub: 'Fatigues quickly, low stamina.' }
    ],
    backBtn: 'Back: Symptoms',
    nextBtn: 'Proceed: Scan Documents'
  },
  mr: {
    agniSectionTitle: '1. तुमची भूक आणि पचन कसे आहे? (Digestion & Appetite)',
    agniBadge: 'अग्नि परीक्षा',
    autoCalibratedBadge: 'लक्षणांनुसार निवडलेले',
    agniOptions: {
      SAMAGNI: {
        title: 'संतुलित पचन (Samagni)',
        sub: 'वेळेवर भूक लागते, अन्न सहज पचते, गॅस किंवा जळजळ होत नाही.'
      },
      VISHAMAGNI: {
        title: 'गॅस आणि अनियमित (Vishamagni)',
        sub: 'कधी खूप भूक तर कधी अजिबात नाही, पोट फुगणे आणि गॅस होणे.'
      },
      TIKSHNAGNI: {
        title: 'जळजळ आणि ॲसिडिटी (Tikshnagni)',
        sub: 'तीव्र भूक, छातीत आणि पोटात जळजळ, आंबट ढेकर किंवा दाह.'
      },
      MANDAGNI: {
        title: 'जडपणा आणि मंद पचन (Mandagni)',
        sub: 'मंद पचन, जेवणानंतर खूप जडपणा, आळस आणि अपचन.'
      }
    },
    prakritiSectionTitle: '2. तुमची शारीरिक प्रकृती (Body Constitution)',
    prakritiOptions: [
      { id: 'Vataja', title: 'हलके शरीर (Vata)', sub: 'थंडी वाजणे, चपळ, सडपातळ शरीर' },
      { id: 'Pittaja', title: 'उष्ण प्रकृती (Pitta)', sub: 'उष्णता सहन न होणे, मध्यम देह' },
      { id: 'Kaphaja', title: 'बळकट शरीर (Kapha)', sub: 'जड शरीर, शांत, स्थिर स्वभाव' },
      { id: 'Vata-Pitta', title: 'मिश्र / संतुलित (Mixed)', sub: 'दोषांचे मिश्र स्वरूप' }
    ],
    vitalitySectionTitle: '3. ऊर्जा पातळी आणि सहनशक्ती (Energy Level)',
    vitalityOptions: [
      { key: 'Pravara', title: 'उत्कृष्ट ऊर्जा (High)', sub: 'दिवसभर उत्साह आणि ताजेतवानेपणा.' },
      { key: 'Madhyama', title: 'मध्यम ऊर्जा (Normal)', sub: 'दैनंदिन कामासाठी पुरेशी ऊर्जा.' },
      { key: 'Avara', title: 'कमी ऊर्जा / थकवा (Low)', sub: 'लवकर थकवा आणि अशक्तपणा जाणवणे.' }
    ],
    backBtn: 'मागे: लक्षणे (Back to Symptoms)',
    nextBtn: 'पुढे जा: कागदपत्रे स्कॅन करा'
  },
  bn: {
    agniSectionTitle: '1. আপনার ক্ষুধা ও হজম কেমন থাকে? (Digestion & Appetite)',
    agniBadge: 'অগ্নি পরীক্ষা',
    autoCalibratedBadge: 'লক্ষণ অনুযায়ী নির্বাচিত',
    agniOptions: {
      SAMAGNI: {
        title: 'স্বাভাবিক হজম (Samagni)',
        sub: 'সময়ে খিদে পায়, খাবার সহজে হজম হয়, গ্যাস বা জ্বালাপোড়া হয় না।'
      },
      VISHAMAGNI: {
        title: 'অনিয়মিত ও গ্যাস (Vishamagni)',
        sub: 'কখনও তীব্র খিদে কখনও একেবারেই নেই, পেট ফাঁপা এবং গ্যাস।'
      },
      TIKSHNAGNI: {
        title: 'জ্বালা ও অম্লতা (Tikshnagni)',
        sub: 'তীব্র খিদে, বুক ও পেটে জ্বালা, টক ঢেকুর বা খাওয়ার পর জ্বালাপোড়া।'
      },
      MANDAGNI: {
        title: 'ভারী ভাব ও ধীর হজম (Mandagni)',
        sub: 'ধীর হজম, খাওয়ার পর অতিরিক্ত ভারী লাগা, আলস্য ও বদহজম।'
      }
    },
    prakritiSectionTitle: '2. আপনার শারীরিক প্রকৃতি (Body Constitution)',
    prakritiOptions: [
      { id: 'Vataja', title: 'হালকা শরীর (Vata)', sub: 'ঠান্ডা লাগা, সক্রিয়, রোগা শরীর' },
      { id: 'Pittaja', title: 'উষ্ণ প্রকৃতি (Pitta)', sub: 'গরম সহ্য না হওয়া, তীব্র খিদে, মাঝারি দেহ' },
      { id: 'Kaphaja', title: 'শক্তিশালী শরীর (Kapha)', sub: 'ভারী শরীর, শান্ত, স্থির' },
      { id: 'Vata-Pitta', title: 'মিশ্র / সমন্বিত (Mixed)', sub: 'মিশ্র প্রভাব' }
    ],
    vitalitySectionTitle: '3. শক্তির মাত্রা ও সহনশীলতা (Energy Level)',
    vitalityOptions: [
      { key: 'Pravara', title: 'উচ্চ শক্তি (High)', sub: 'সারাদিন প্রচুর শক্তি ও সতেজতা।' },
      { key: 'Madhyama', title: 'স্বাভাবিক শক্তি (Normal)', sub: 'দৈনন্দিন কাজের জন্য স্বাভাবিক শক্তি।' },
      { key: 'Avara', title: 'দুর্বলতা (Low)', sub: 'সহজেই ক্লান্তি ও দুর্বলতা অনুভব করা।' }
    ],
    backBtn: 'পূর্ববর্তী: লক্ষণ (Back to Symptoms)',
    nextBtn: 'এগিয়ে যান: নথি স্ক্যান'
  },
  ta: {
    agniSectionTitle: '1. உங்கள் பசி மற்றும் செரிமானம் எப்படி உள்ளது? (Digestion & Appetite)',
    agniBadge: 'அக்னி பரிசோதனை',
    autoCalibratedBadge: 'அறிகுறிகளின் அடிப்படையில் தேர்வு',
    agniOptions: {
      SAMAGNI: {
        title: 'சமச்சீர் செரிமானம் (Samagni)',
        sub: 'சரியான நேரத்தில் பசி எடுக்கும், உணவு எளிதில் செரிக்கும், வாயு அல்லது நெஞ்செரிச்சல் இல்லை.'
      },
      VISHAMAGNI: {
        title: 'வாயு மற்றும் சீரற்ற பசி (Vishamagni)',
        sub: 'சில நேரங்களில் அதிக பசி, சில நேரங்களில் பசியின்மை, வயிறு உப்பசம்.'
      },
      TIKSHNAGNI: {
        title: 'நெஞ்செரிச்சல் மற்றும் அமிலத்தன்மை (Tikshnagni)',
        sub: 'அதிக பசி, நெஞ்சு மற்றும் வயிற்றில் எரிச்சல், புளித்த ஏப்பம்.'
      },
      MANDAGNI: {
        title: 'மந்தமான செரிமானம் (Mandagni)',
        sub: 'மந்தமான செரிமானம், சாப்பிட்ட பின் சோர்வு, அஜீரணம்.'
      }
    },
    prakritiSectionTitle: '2. உங்கள் உடலமைப்பு (Body Constitution)',
    prakritiOptions: [
      { id: 'Vataja', title: 'மெலிந்த உடல் (Vata)', sub: 'குளிர் தாங்காமை, சுறுசுறுப்பு, மெலிந்த உடல்' },
      { id: 'Pittaja', title: 'வெப்ப உடல் (Pitta)', sub: 'வெப்பம் தாங்காமை, அதிக பசி, நடுத்தர உடல்' },
      { id: 'Kaphaja', title: 'உறுதியான உடல் (Kapha)', sub: 'பருமனான உடல், அமைதி, உறுதி' },
      { id: 'Vata-Pitta', title: 'சமச்சீர் (Mixed)', sub: 'கலப்பு உடலமைப்பு' }
    ],
    vitalitySectionTitle: '3. ஆற்றல் நிலை மற்றும் சகிப்புத்தன்மை (Energy Level)',
    vitalityOptions: [
      { key: 'Pravara', title: 'அதிக ஆற்றல் (High)', sub: 'நாள் முழுவதும் சுறுசுறுப்பு மற்றும் புத்துணர்ச்சி.' },
      { key: 'Madhyama', title: 'சாதாரண ஆற்றல் (Normal)', sub: 'தினசரி வேலைக்கு போதுமான ஆற்றல்.' },
      { key: 'Avara', title: 'குறைந்த ஆற்றல் (Low)', sub: 'விரைவில் சோர்வு மற்றும் பலவீனம் ஏற்படுதல்.' }
    ],
    backBtn: 'பின்செல்: அறிகுறிகள் (Back to Symptoms)',
    nextBtn: 'தொடரவும்: ஆவண ஸ்கேன்'
  },
  te: {
    agniSectionTitle: '1. మీ ఆకలి మరియు జీర్ణక్రియ ఎలా ఉంది? (Digestion & Appetite)',
    agniBadge: 'అగ్ని పరీక్ష',
    autoCalibratedBadge: 'లక్షణాల ఆధారంగా ఎంపిక చేయబడింది',
    agniOptions: {
      SAMAGNI: {
        title: 'సమతుల్య జీర్ణక్రియ (Samagni)',
        sub: 'సమయానికి ఆకలి వేస్తుంది, ఆహారం సులభంగా జీర్ణమవుతుంది, గ్యాస్ లేదా మంట ఉండదు.'
      },
      VISHAMAGNI: {
        title: 'గ్యాస్ మరియు క్రమరహితం (Vishamagni)',
        sub: 'ఒక్కోసారి తీవ్రమైన ఆకలి, ఒక్కోసారి అసలు ఉండదు, కడుపుబ్బరం.'
      },
      TIKSHNAGNI: {
        title: 'మంట మరియు అసిడిటీ (Tikshnagni)',
        sub: 'తీవ్రమైన ఆకలి, ఛాతీ మరియు కడుపులో మంట, పుల్లని తేన్పులు.'
      },
      MANDAGNI: {
        title: 'బరువుగా ఉండటం మరియు మందకొడి జీర్ణం (Mandagni)',
        sub: 'నెమ్మదిగా జీర్ణం కావడం, భోజనం తర్వాత బద్ధకం మరియు అజీర్ణం.'
      }
    },
    prakritiSectionTitle: '2. మీ శరీర స్వభావం (Body Constitution)',
    prakritiOptions: [
      { id: 'Vataja', title: 'తేలికైన శరీరం (Vata)', sub: 'చలి భరించలేకపోవడం, చురుకుదనం, సన్నని శరీరం' },
      { id: 'Pittaja', title: 'వేడి శరీరం (Pitta)', sub: 'వేడి భరించలేకపోవడం, ఎక్కువ ఆకలి, మధ్యస్థ శరీరం' },
      { id: 'Kaphaja', title: 'ధృడమైన శరీరం (Kapha)', sub: 'భారీ శరీరం, ప్రశాంతత, నిలకడ' },
      { id: 'Vata-Pitta', title: 'సమతుల్యం (Mixed)', sub: 'దోషాల మిశ్రమ ప్రభావం' }
    ],
    vitalitySectionTitle: '3. శక్తి స్థాయి మరియు సహనశక్తి (Energy Level)',
    vitalityOptions: [
      { key: 'Pravara', title: 'అధిక శక్తి (High)', sub: 'రోజంతా మంచి ఉత్సాహం మరియు చురుకుదనం.' },
      { key: 'Madhyama', title: 'సాధారణ శక్తి (Normal)', sub: 'రోజువారీ పనులకు తగినంత శక్తి.' },
      { key: 'Avara', title: 'నీరసం / తక్కువ శక్తి (Low)', sub: 'త్వరగా అలసిపోవడం మరియు నీరసం కలగడం.' }
    ],
    backBtn: 'వెనుకకు: లక్షణాలు (Back to Symptoms)',
    nextBtn: 'ముందుకు సాగండి: పత్రాల స్కానింగ్'
  }
};

export const getParikshaLocalization = (langCode?: string): ParikshaLocalization => {
  const code = (langCode || 'hi').toLowerCase().substring(0, 2) as SupportedKioskLanguage;
  return PARIKSHA_LOCALES[code] || PARIKSHA_LOCALES['en'] || PARIKSHA_LOCALES['hi'];
};

