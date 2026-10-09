# Honest consultation scribe — research, design and verification

*2026-10-10. Applies to the doctor / vaidya desk (`frontend/src/components/doctor/AmbientScribePanel.tsx`) and the
scribe endpoints under `/api/doctor/encounter/:id/…`.*

**The rule in one line:** dictation first; room recording only after the patient's consent for this visit is on
record; no speaker guessing; nothing reaches the record unless the clinician puts it there; audio is never kept.

---

## 1. What the evidence says

| Question | Finding | Source |
|---|---|---|
| Do ambient scribes save time? | Modestly and not always. In a 238-clinician randomised trial, one product cut time-in-note by 9.5% (about 41 s per note) and the other by a non-significant 1.7%. Burnout scores improved with both. Clinically significant inaccuracies were reported "occasionally". | Lukac & Mafi, NEJM AI 2025 ([UCLA summary](https://www.uclahealth.org/news/release/ucla-study-finds-ai-scribes-may-reduce-documentation-time)); [UW Health trials](https://uwclinicaltrials.org/2025/12/12/studies-find-ai-technology-for-clinical-documentation-aids-efficiency-and-reduces-burnout/) |
| How often are notes wrong? | Often enough to require review of every note. In a real-world pilot, 18% of reviewed notes had omissions, 11.5% hallucinations, 9.3% unwanted inclusions, and 5.3% errors rated as serious or imminent risk. A simulated audit of five platforms found a 26% mean note error rate. A census of three deployed scribes found a verified failure in about one note in three, with failures clustered in **allergy and medication** information. | [Taylor et al., JMIR Med Inform 2026](https://medinform.jmir.org/2026/1/e86474); [Anderson et al. 2025](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12605248/); [arXiv 2608.31017](https://arxiv.org/abs/2608.31017) |
| Why is India harder? | OPD visits average about 2 minutes, and government OPD doctors see more than 200 patients a day. Rooms are noisy, speech is code-mixed, and family members often answer for the patient. Speaker-attribution errors "convert a complaint into a finding, or vice versa". No measured Indian error rates are published yet. | [Jaiswal et al., arXiv 2609.17355](https://arxiv.org/html/2609.17355v1) |
| Is speaker separation reliable? | No common benchmark exists. Reported word-level diarization error in primary care ranges up to about 14%. Scribes propagate errors that start in patient speech more often than errors in clinician speech. | [Rabotin et al., JMIR Med Inform 2026](https://medinform.jmir.org/2026/1/e88734) and the primary-care ASR comparison it cites ([PMC10148344](https://pmc.ncbi.nlm.nih.gov/articles/PMC10148344)) |
| Do speech models invent text? | Whisper invented whole phrases in about 1% of clips, and 38% of those inventions were harmful. It happens more with long pauses and aphasic speech, and the model can treat silence as words. | [Koenecke et al., FAccT 2024](https://arxiv.org/abs/2402.08021v2) |
| What do regulators ask? | NHS England: tell the patient at the start of every session, respect objections, have the clinician review and validate before anything enters the record, mark outputs as scribe-assisted, and delete recordings and transcripts once the note is signed. MHRA (July 2026): transcription and summarising for clinician review is not a medical device; automated actions without review are. Australia: informed consent, documented; on withdrawal "stop the recording and delete any data and outputs". | [NHS England guidance](https://www.england.nhs.uk/long-read/guidance-on-the-use-of-ai-enabled-ambient-scribing-products-in-health-and-care-settings/); [NHS IG guidance](https://transform.england.nhs.uk/information-governance/guidance/using-ai-enabled-ambient-scribing-products-in-health-and-care-settings); [MHRA](https://www.gov.uk/government/news/mhra-clarifies-regulatory-status-of-ambient-voice-technologies-used-in-the-nhs); [ACSQHC scenario](https://www.safetyandquality.gov.au/sites/default/files/2025-09/ai-safety-scenario-ambient-scribe.pdf); [Avant](https://avant.org.au/resources/ai-scribes-and-patient-consent) |
| What does Indian law require? | **DPDP Act 2023 and Rules 2025.** Consent must be free, specific, informed, unconditional and unambiguous, by a clear affirmative act. Notice comes first and is available in English or an Eighth-Schedule language. Withdrawing must be as easy as consenting, and erasure follows withdrawal. Routine OPD care is not one of the s.7 "legitimate uses" (those cover emergencies, epidemics and disasters). For children, the health-services exemption covers only processing "necessary for the protection of her health"; recording is a convenience, so a parent or guardian answers. Most of these obligations are enforceable from about 13 May 2027 (a shortening was proposed but not confirmed). We build to them now. **ICMR AI ethics guidelines (2023):** patients may refuse AI technology. | [PIB](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf); [Khaitan & Co](https://www.khaitanco.com/sites/default/files/2025-11/ERGO%20-%20Digital%20Personal%20%20Data%20Protection%20Rules%20-%2015%20November%202025.pdf); [s.7](https://www.dpdpa.com/dpdpa2023/chapter-2/section7.html); [s.8](https://dpdpa.com/dpdpa2023/chapter-2/section8.html); [Fourth Schedule](https://www.dpdpa.com/schedule/schedule4.html); [ICMR](https://www.icmr.gov.in/icmrobject/custom_data/pdf/Ethical-guidelines/Ethical_Guidelines_AI_Healthcare_2023.pdf) |
| What do patients want? | Most are comfortable, but consent practice needs work. Studies recommend consent separate from other IT consents, with the option to agree for some visits and not others. Some patients withhold information when recorded. | [AMA J Ethics 2025](https://journalofethics.ama-assn.org/article/how-should-we-think-about-ambient-listening-and-transcription-technologies-influences-ehr/2025-11) and the JAMA Netw Open study it discusses |

Several sources were read through summaries rather than full text; the table cites what they report. None of them
replaces local review by the hospital's ethics committee and its data-protection officer.

---

## 2. Design decisions and why

| Decision | Why |
|---|---|
| **Dictation is the default.** Hold to talk, or tap to start and stop. Your voice only, 60 s per clip, your language remembered. | A close-talk push-to-talk clip is the most accurate input in a noisy OPD (`edge-ai/eval`: denoising made accuracy worse; acoustics fixed it). It records nobody else, so it needs no consent, and it suits a 2-minute visit. |
| **Room recording only with consent on record for this visit.** The notice is read in the patient's language. Who agreed is recorded (patient, or parent/guardian with name and relationship). The clinician confirms that others in the room were told. The notice version and language are stored. | DPDP s.5–6 and s.9, NHS transparency, Australian documentation practice. The notice wording is versioned (`recordingNotice.ts` ↔ `RECORDING_NOTICE_VERSION`). |
| **The server enforces consent.** `/scribe/transcribe?mode=room` returns 403 `RECORDING_CONSENT_REQUIRED` unless the latest consent event for this visit is "given". | A screen-only gate can be bypassed. A consent from before a re-opened visit does not count. |
| **No cloud fallback for room audio.** | The notice promises that "the sound is turned into text on this hospital's own computer". Dictation may use the browser's cloud recogniser only if the hospital allows it, and the line is labelled "browser (cloud)". |
| **Pause captures nothing; Stop transcribes the last clip; withdrawal is one tap.** Withdrawal stops recording, discards in-flight results, deletes room lines and room-derived text from the unsigned notes (including a SOAP draft made from them), and records the event. | DPDP s.6 and s.8(7); the Australian guidance's "stop and delete". After signing, the signed record stays, as medical-record law requires; the notice says so. |
| **Visible state.** A red "Recording the room · mm:ss" bar reading "speakers are not identified · audio is not kept". Auto-stop at 15 min; auto-pause after 1 min in the background. | Everyone in the room can see what is happening, and a forgotten recorder stops. |
| **No speaker guessing.** Lines are labelled by capture channel: "Dictation (you)" or "Room (speaker not identified)". The clinician may mark who said a room line, labelled "marked by you". | Misattribution turns complaints into findings. Indian visits are triadic. No diarization model is used. |
| **Questions are not findings.** In room lines, a finding inside a question becomes "Asked about …", and the reply after "हाँ/नहीं/yes/no" is read again. Other findings are "Mentioned: …", spoken vitals are "said, not measured", and medicines are "Medicine: …", never "Rx". | A clinician's question charted as a patient's symptom is a documented failure. |
| **Uncertain words are marked.** The server re-decodes Hindi at 0.9× and 1.1×; words the re-decodes don't reproduce are dotted for checking. Spelling variants (nukta, chandrabindu/anusvara) don't count. | Live test: the misheard "खलासी" (for खांसी, cough) was flagged. Absence of a mark means "not checked", never "certain". |
| **Noise is held back, not shown and not lost.** Silent clips are never sent. Clips with fewer than 2 letters, or 1–4 words that every re-decode disagrees on, are counted as "unclear", with **Show anyway**. | Measured on our server: a tone came back as "हम पी पी पी" and mains hum as "म" (Hindi model). |
| **Nothing reaches the record by itself.** The clinician adds lines to the notes (per line or all); each carries its source ("Dictated 10:42", "Room recording 10:43 — speaker not identified"). Medicines found are only offered for confirmation, and every line is editable. | Clinician review and accountability (NHS, AHPRA). Keeps the tool on the "clinician reviews" side of the MHRA line. |
| **The record says how it was written, from the server's own log.** `scribe_usage` stores mode and seconds only, never audio or text. The signed record carries `documentationAids`. The printout tells the patient when a consented recording helped and that it was not kept (Hindi too). | NHS guidance: mark scribe-assisted output. The browser can't overclaim or underclaim. |
| **Audio is never stored.** | Verified in code: the backend passes audio through in memory; edge-ai's sherpa path is in-memory and the Whisper fallback deletes its temp file; SOAP drafting doesn't store the transcript. |

Also enforced on the server in this round:
- An AWaRe antibiotic can't be signed without an indication: 422 `INDICATION_REQUIRED`. Before this, only the screen enforced it.
- The sign dialog follows the live safety check, and Sign waits while a check is running. A fast "Review & sign" could previously open the dialog on a stale result.

---

## 3. Verification (2026-10-10)

| Check | Result |
|---|---|
| Live speech server, English dictation | "Patient has fever for 3 days with dry cough, no chest pain, start paracetamol 650 mg 3 times a day." (exact) |
| Live Hindi room clip, after consent | Transcribed; misheard "खलासी" flagged as uncertain; "Asked about: Fever" for the question, "Mentioned: Fever" for the reply |
| Room clip without consent / after withdrawal | 403 `RECORDING_CONSENT_REQUIRED` |
| `documentationAids` on a signed visit | dictation 1 clip / 8 s; room 1 clip / 4 s with consent event, notice version and language; `audioKept: false` |
| Desk API battery (`backend/tests/desk_http.test.ts`) | 56/56, including 14 scribe/consent checks and the antibiotic-indication check |
| Scribe logic (`frontend: npm run test:scribe`) | 17/17: questions vs findings, no speaker claims, uncertainty, noise hold-back |
| End-to-end (`e2e`) | 16/16, including the consent flow in the real UI (agree locked until others told, one-tap withdrawal, child needs a guardian) |
| Backend suite (`npm test`) | 28/28 batteries |
| Browser walkthrough | Consent sheet in Hindi, decline path, agree path, recording bar with timer, pause, withdrawal. A synthetic tone stood in for the microphone, so no real person was recorded. |

---

## 4. Limits and open items

- **No real Indian OPD audio has been tested.** Accuracy figures come from synthetic voices (`edge-ai/eval`) and two
  live clips. A consented pilot with clinician review of every note is the next step, measuring what the literature
  says to measure: omissions, misattribution, medication and allergy errors.
- **Question detection is a heuristic** (punctuation, Hindi interrogatives, English auxiliaries, reply words). It
  errs towards "Asked/Mentioned" rather than asserting a finding.
- **The written notice exists in Hindi and English only.** For other languages the clinician explains it, and the
  record says "explained". A professional translation into the hospital's languages is needed.
- **Drug names in dictation:** since 2026-10-10, dictation clips use edge-ai's `profile=dictation` (1,062 medicine
  names, boost 2.5). On edge-ai's held-out set of 30 prescriptions (written before measuring), medicine names went
  from 32% to 65% correct on clean audio and from 16% to 61% in OPD babble at 10 dB. No medicine name was inserted
  into any of 105 medicine-free sentences. Live through the desk: "Start amoxicillin 500 mg 3 times a day, and
  telmisartan 40 mg once daily" came back exact. Room clips keep the default list so the engine doesn't "hear" drugs
  in conversation. Names and doses still need checking: accuracy is far from 100% in noise.
- **Server-side noise gate (live since 2026-10-10):** tone, mains hum and white noise come back as empty text with
  `speech: false` and a reason, in Hindi and English, through the desk endpoint. On edge-ai's 1,395-clip benchmark the
  gate emptied 7 real clips, all unusable garble. The desk's own hold-back stays as a second line of defence.
- **Consent across visits** is deliberately not remembered. Each visit asks again, as the evidence recommends
  (patients may agree for some visits and not others).
- **Before go-live:** a DPDP impact assessment, a clinical safety case, ethics-committee review, and staff training,
  including when not to record (sensitive conversations, distressed patients, crowded rooms where others can't be told).
