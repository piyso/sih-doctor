/**
 * The notice read to the patient before room recording, in plain words. Every sentence is a promise the
 * software keeps (see AmbientScribePanel and the /scribe/transcribe endpoint):
 *  - only for today's notes            → the transcript is used only on this visit's desk and is cleared on patient change
 *  - turned into text in this hospital → room clips go only to the hospital's speech server; no cloud fallback
 *  - sound not kept                     → audio is passed through in memory; nothing writes it to disk
 *  - doctor checks; only that is kept   → nothing enters the notes or prescription without the clinician inserting it
 *  - stop/pause any time; text deleted  → "Pause" captures nothing; withdrawal deletes room text from the unsigned draft
 *  - others in the room are recorded    → the clinician confirms they were told before consent can be recorded
 *
 * Version must match RECORDING_NOTICE_VERSION in backend doctorDesk.service.ts. A change of wording is a new version.
 * Other languages: the clinician explains the notice in the patient's language and records that it was explained.
 */
export const NOTICE_VERSION = 'room-recording-notice-v1 (2026-10-10)';

export type NoticeLang = 'hi' | 'en';

export const RECORDING_NOTICE: Record<NoticeLang, { intro: string; points: string[]; question: string }> = {
  en: {
    intro: 'We would like to record today’s conversation so the doctor can write your notes quickly and correctly.',
    points: [
      'It is only for writing today’s notes, nothing else.',
      'The sound is turned into text on this hospital’s own computer. The sound is not kept and is not sent outside the hospital.',
      'The doctor reads and corrects the text. Only what the doctor checks goes into your record.',
      'You can say no. Saying no does not change your care in any way.',
      'You can ask us to stop or pause at any time. If you stop, the text made from the recording is deleted (unless the doctor has already signed today’s notes).',
      'Other people in the room will be recorded too.'
    ],
    question: 'Do you agree to the recording?'
  },
  hi: {
    intro: 'हम आपकी आज की बातचीत रिकॉर्ड करना चाहते हैं, ताकि डॉक्टर आपके नोट्स जल्दी और सही लिख सकें।',
    points: [
      'रिकॉर्डिंग सिर्फ़ आज के नोट्स लिखने के लिए है, किसी और काम के लिए नहीं।',
      'आवाज़ इसी अस्पताल के कंप्यूटर पर लिखे हुए शब्दों में बदली जाती है। आवाज़ रखी नहीं जाती और अस्पताल से बाहर नहीं भेजी जाती।',
      'डॉक्टर लिखी हुई बातें ख़ुद पढ़कर ठीक करेंगे। आपके रिकॉर्ड में वही जाएगा जो डॉक्टर जाँचेंगे।',
      'आप मना कर सकते हैं। मना करने से आपके इलाज पर कोई असर नहीं पड़ेगा।',
      'आप कभी भी रोकने या कुछ देर रुकने को कह सकते हैं। रोकने पर रिकॉर्डिंग से लिखा गया हिस्सा मिटा दिया जाएगा (अगर डॉक्टर ने आज के नोट्स पर पहले से हस्ताक्षर नहीं किए हैं)।',
      'कमरे में मौजूद दूसरे लोगों की आवाज़ भी रिकॉर्ड होगी।'
    ],
    question: 'क्या आप रिकॉर्डिंग के लिए सहमत हैं?'
  }
};
