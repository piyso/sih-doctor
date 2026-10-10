# How HospitalOS writes a patient summary without a language model

For the jury, hospital leadership and the team. Written 10 October 2026.

Every number here was either measured on 10 October 2026 on the development laptop (Apple M4) or is
taken from the project's dated test records, and each says which. Section 12 gives the commands to
reproduce them. Section 13 lists the claims from the earlier version of this document that were wrong.

---

## 1. The answer in one minute

> We use two small speech models: one to hear and one to read aloud. Neither can compose anything.
> Understanding is done by a clinical dictionary that matches words by sound, plus written grammar rules
> for things like "no fever" and "for three days". The summary is those findings placed into fixed
> clinical sentence frames. No language model reads, decides or writes anything in the patient's path.
> So the summary cannot contain a word that is not in the record or in our templates, it is the same
> every time, and every line can be traced to the patient's own words. The price is that the system only
> understands phrasings we have taught it, which is why we measure it on test sets and publish the misses.

Say "no language model". Do not say "no AI" or "no model": the speech parts are neural models, and the
rules engine is itself a kind of AI (section 5).

---

## 2. What models exist in the system

"No LLM" is a claim about one kind of model. This is the full list, as the running demo server reports it.

| Job | What does it | Kind | On the demo server today | Can it invent text? |
|---|---|---|---|---|
| Speech to text, Hindi | IndicConformer (sherpa-onnx) | Neural, CTC | Installed, on the hospital machine | No. It writes only sounds it heard; it can mishear |
| Speech to text, English | Parakeet-TDT (sherpa-onnx) | Neural, transducer | Installed, on the hospital machine | No, same as above |
| Read aloud | VITS voices (sherpa-onnx) | Neural | Installed, Hindi and English | It only speaks text we give it |
| Understanding the words | `clinicalText.ts`, `clinicalLexicon.ts`, `clinicalParser.service.ts` | Dictionary and rules | Always on | No |
| Triage, red flags, drug checks | Rules engines | Rules | Always on | No |
| History summary | `clinicalHistory.service.ts`, `summaryRealiser.ts` | Templates | Always on | No (tested, section 7) |
| Reading scanned papers | Tesseract | Neural character reader | In the kiosk browser | No. It can misread a character |
| Language model | llama.cpp slot in `edge-ai` | Generative | **Not installed, and switched off by policy** | Yes, which is why it is off |
| Whisper speech fallback | faster-whisper slot in `edge-ai` | Generative decoder | **Not installed, and refused by policy** | Yes, it can write sentences for noise |
| Translation of printed instructions | IndicTrans2 slot (or the government Bhashini service, if the hospital configures it) | Neural translation | Not installed, not configured | It writes a translation; staff-only and reviewed |

Three things a careful jury member may find, and the honest answer to each:

1. **"Your code has a language-model slot."** Yes. `edge-ai/app/config.py` can load one. The server will
   not use it: the setting `LLM_ASSIST` is `off` unless the hospital sets it to `clinician`, and even
   then it can only draft a clinician's visit note for editing. There is no setting and no code path
   that lets it read what a patient says, decide triage or write the history summary. Test battery 30
   starts the server against a machine that *does* have a language model and Whisper and checks that
   neither is ever called (section 7).
2. **"Speech recognition is a neural network."** Yes. It turns sound into words and nothing else.
3. **"Does patient audio leave the hospital?"** For Hindi and English, no: the recogniser runs on the
   hospital machine. For the other nine kiosk languages there is no on-premise recogniser yet, so the
   kiosk falls back to the browser's own speech recognition, which sends audio to the browser vendor.
   A hospital that forbids this builds the kiosk with `VITE_ALLOW_CLOUD_SPEECH=false`; those languages
   then use tap and type only. **This flag is not set on the demo build today.** Do not tell a jury that
   audio never leaves the building unless it is.

---

## 3. How one sentence becomes a summary line

This is the unedited output of `npm run explain` on 10 October 2026.

```
INPUT      मुझे तीन दिन से पेट में दर्द है बुखार नहीं है बीपी एक सौ पचास बटा पचानवे है

1. NUMBERS — number words become digits (a fixed table of Hindi and English number words)
           मुझे 3 दिन से पेट में दर्द है बुखार नहीं है बीपी 150 बटा 95 है

2. LOOK UP — each word is reduced to a sound key and looked up in the clinical dictionary
           "पेट"  →  key "pet"  →  body area: stomach
           "दर्द"  →  key "drd"  →  finding: pain
           "बुखार"  →  key "bukr"  →  finding: fever   [DENIED by "नहीं"]
           "बीपी"  →  key "bipi"  →  visit reason: chronic

3. CONTEXT — written rules read the words around each match
           duration: 3 days   vitals: bp 150/95   past history: —
           emergency rules: none fired

4. RECORD  — the findings in named slots
           DENIED   Fever
           PRESENT  Abdominal Pain   (site=Abdomen, since=3 days)

5. SUMMARY — the slots dropped into fixed sentence frames   [method: deterministic-template]
           Chief complaint: Abdominal Pain at Abdomen since 3 days
                            पेट में दर्द, 3 दिन से
             ↳ Abdominal Pain  ←  the patient's words: "मुझे तीन दिन से पेट में दर्द है"
           History of present illness: Abdominal Pain at Abdomen since 3 days. Denies: Fever.
                                       पेट में दर्द, 3 दिन से। नकारा: बुखार।
             ↳ Denies: Fever  ←  the patient's words: "बुखार नहीं है"
             ↳ Abdominal Pain  ←  the patient's words: "मुझे तीन दिन से पेट में दर्द है"
           Vitals: BP 150/95 (patient-reported, unverified).
                   बीपी 150/95 (मरीज़ द्वारा बताया, असत्यापित)।

Took 0.66 ms on this machine. No model was called: steps 1–5 are table lookups and written rules.
```

What each step is, in plain terms:

| Step | What it is | Why it works |
|---|---|---|
| 0. Hear | The speech model writes the words | The only neural step. Everything after it is ordinary code |
| 1. Numbers | A table of number words | The Hindi recogniser writes "एक सौ पचास", and a blood pressure needs 150 |
| 2. Look up | A sound key, then a dictionary | "पेट", "pet" and "pait" all become the key `pet`. "बुखार", "bukhar" and a misheard "बुखाल" all reach *fever*. One dictionary serves Hindi, Hinglish and English |
| 3. Context | Written grammar rules | Hindi puts the denial after the word ("बुखार नहीं है"), English before ("no fever"). "दर्द कम नहीं हो रहा" is *not* a denial, the pain persists. Each such case is a rule with a test |
| 4. Record | A form with named slots | Complaint, site, since when, spreads to, worse with, better with, severity. Nothing free-form |
| 5. Summary | Fixed sentence frames | "‹complaint› at ‹site› since ‹duration›". The frame is written once by us; the slots come from the record |

### The "robotic arm" question

There is no agent deciding what to fetch. The arm is ordinary program code: functions that run in a
fixed order and pass a plain record from one to the next. If a language model is an assistant you ask
in plain language, this engine is a shell script:

| Shell tool | The engine's equivalent |
|---|---|
| `grep` (find) | Find known words in the sentence |
| `sed` (rewrite) | Number words to digits, spelling to sound key |
| A lookup table | Sound key to clinical concept |
| `printf` (fill a format) | Slots into a sentence frame |

The code runs in two places: in the browser on the kiosk, and in the Node.js server. The dictionary is a
set of hash maps keyed by the sound key.

---

## 4. Why the Hindi summary is real Hindi

The Hindi text is not translated by a model. It uses the same frames with Hindi wording looked up in
two fixed tables (`backend/src/services/summaryRealiser.ts`):

- **The kiosk's own labels.** A complaint the patient tapped is summarised in exactly the Hindi words
  the patient saw on the kiosk (147 complaints and 31 body areas, copied by
  `scripts/sync-kiosk-labels.ts`; a test fails if the copy goes stale).
- **A table for what the speech parser can emit**: 106 complaint names, 55 body areas, plus durations,
  pain character, where it spreads, and what makes it worse or better.

A term with no entry is left exactly as recorded and reported in `untranslatedHi`. It is never guessed.
Medicine names and allergy agents are deliberately never translated, because the prescriber must see
what was written.

Until 10 October 2026 the Hindi summary had Hindi headings over English content
("मुख्य शिकायत: Abdominal Pain at Abdomen since 3 days"). It also had one unsafe difference from the
English: an allergy question that was *asked but not answered* read as "कोई एलर्जी नहीं" (no allergies) in
Hindi while the English said "asked, not answered. Confirm before prescribing". Both are fixed, and
both are now tests.

The Hindi summary and the per-line sources are returned by the server (`textHi`, `sources`) and shown
by `npm run explain`. The doctor desk screen still shows the English sections only.

---

## 5. Is this artificial intelligence?

Yes. It is rule-based, or symbolic, AI: the older branch of the field that includes expert systems. The
intelligence is clinical and linguistic knowledge that people wrote down as a dictionary and as rules,
and then measured.

| | Rules and templates (ours) | A language model |
|---|---|---|
| Can it state something the patient never said? | No (tested on 94,201 words, section 7) | Yes |
| Same input, same output? | Yes (tested) | Not in general |
| Can each line be traced to its source? | Yes, to the patient's own words | Not reliably |
| Works with the network cut? | Yes (tested) | Only if run on-premise on larger hardware |
| Understands a phrasing it was never taught? | **No, it misses it** | Often yes |
| Can it paraphrase or write flowing prose? | **No** | Yes |

We did not benchmark a language model, so this document makes no claim about how fast, costly or
accurate one would be. Our reasons are the first four rows.

If a jury member says "that is structured form-filling, not summarising", agree. It is extractive and
structured on purpose. A doctor in a two-minute consultation needs the complaint, its duration and the
pertinent negatives in the same place every time, more than prose.

---

## 6. What was measured

Measured on 10 October 2026, Apple M4 laptop, Node.js 20.

| What | Value | How |
|---|---|---|
| Clinical dictionary for speech | 1,076 word forms for 110 concepts (29 body areas, 47 findings, 18 qualifiers, 12 emergency signs, 4 visit reasons) | Counted from `clinicalLexicon.ts` |
| Medicine dictionary | 300 medicines with 804 other names; 108 Ayurvedic formulations, 79 ingredients | Counted from `services/safety/` |
| NAMASTE terminology bundled | **20 sample entries with placeholder codes.** The official export loads with `npm run import:namaste` | Counted from `ayush_ontology.json` |
| Sentence to structured record | 0.23 to 0.38 ms, about 2,600 to 4,400 a second | 2,000 runs here; batteries 1 and 6 of `npm test` gave 3,876 and 4,371 a second |
| Dictionary lookup of a whole sentence | 0.065 ms | 2,000 unique sentences |
| One word to its sound key | 0.004 ms | 20,000 words |
| Filling the summary templates | 0.006 ms | 5,000 runs |
| Memory the rules and dictionary add to the server | about 12 MB | Process memory before and after loading |
| Memory of the speech service (Hindi + English recognisers, read-aloud voice) | about 3.5 GB | macOS `footprint` on the running service |
| Speech models on disk | 819 MB recognition, 157 MB voices | `du` |
| Backend test suite | 31 of 31 batteries pass, about 40 seconds | `npm test` |

Not measured: any hardware other than this laptop. The kiosk bill of materials names a Raspberry Pi 5;
nothing has been run on one. The dictionary would fit easily. The speech models are the open question.

---

## 7. The proof you can run in front of the jury

`npm run test:no-llm` (battery 30, 37 checks, about 2 seconds).

| Group | What it proves | Result on 10 Oct 2026 |
|---|---|---|
| A. Nothing to call | No language-model package among the 55 dependencies. No language-model service address in 212 source files. The summary code imports no network or model client | 5 of 5 |
| B. Policy | The server is started against a stand-in machine that advertises a language model and Whisper. Kiosk extraction: model not called. Clinician note: built by template, model not called. A language only Whisper could serve: refused before any audio is sent. With the clinician draft switched on, the kiosk path still never reaches the model, and the prescription plan still never comes from it. The template visit note never lists a complaint the patient denied as present | 17 of 17 |
| C. Deterministic and offline | 40 sentences × 25 runs give identical output. 446 sentences are understood and summarised with the network cut off, with zero network attempts | 2 of 2 |
| D. Grounding | 94,201 words in 446 English and Hindi summaries: every word comes from the patient's record or from the fixed templates. Unknown terms pass through unchanged and are listed, never replaced | 2 of 2 |
| E. Hindi | Every complaint name and body area the parser or the kiosk can produce has a Hindi entry. A Hindi complaint is summarised with no English word. "Asked, not answered" never reads as "none" | 7 of 7 |
| F. Sources | 535 quoted sources are each, letter for letter, part of what the patient said. 97.3% of spoken findings carry a quote; the rest are stated without one rather than guessed | 4 of 4 |

"Cannot invent" is about the summary step. The hearing step can still mishear, and the rules can still
miss. Section 8 has those numbers.

---

## 8. How accurate is it? The honest numbers

These come from the project's dated test records (9 and 10 October 2026). They were not re-run today.
The test sets and commands are in section 12.

**Text to record** (the rules alone, given correct text):

| Test set | Written before it was run? | First-run score |
|---|---|---|
| Blind, 115 sentences | Yes | 88.5% |
| Held-out, 81 sentences | Yes | 92.2% |
| Final, 60 sentences | Yes | 88.3% |
| Contrast pairs, 34 cases | Yes | 79 of 85 checks, 92.9% |

After the misses were fixed these sets score about 100%, but they are then no longer unseen. Quote the
first-run numbers.

**Speech to record** (held-out sentences spoken by synthetic voices, through the real recogniser and the
production pipeline):

| Condition | All checks correct |
|---|---|
| Quiet | 94.2% |
| Light noise, 20 dB | 90.8% |
| OPD crowd noise, 10 dB | 82.1% |
| Crowd noise, 5 dB | 63.6% |
| Echoing hall | 60.7% |

The voices are synthetic. No recording of a real patient in a real OPD has been tested yet.

Since correct text scores near 100%, almost all of this loss is the hearing step. The fix is acoustic:
a close-talk, push-to-talk microphone. Denoising was tried and made every condition worse.

Other measured facts: Hindi recogniser character error 2.5% in quiet and 40% in a reverberant hall.
English word error 3.6% in quiet and 33% in the hall. Non-speech sound (fan, hum) decoded as words in
32 of 40 clips before a gate was added, 0 of 40 after.

Every finding from speech is shown to the patient to confirm on screen. Emergency rules are tuned to
over-alert rather than miss: a nurse can dismiss a false alarm, and nobody can recover a missed one.

---

## 9. Medicine names that sound alike

The earlier version of this document claimed "near-100% precision" from four mathematical filters.
That was not true. What the system does:

1. **Dictation vocabulary.** When a doctor dictates, the English recogniser is biased toward 1,062
   medicine names. On held-out dictation this raised correct medicine names from 32% to 64.5% in quiet,
   with no false insertions in 105 medicine-free clips. Two in three is not near-perfect.
2. **The doctor sees and confirms.** A dictated or typed name is resolved against the medicine
   dictionary by whole name. A name that cannot be resolved is reported, never guessed.
3. **Look-alike warnings.** Known look-alike and sound-alike pairs (the US FDA and ISMP "tall man"
   lists) are shown with mixed-case spelling at the pharmacy counter, as a picking aid. It is a fixed list:
   a name that is not on it is not thereby safe from confusion.
4. **Safety engine.** The resolved prescription is checked for interactions, doses, pregnancy, kidney
   function and banned combinations: 153 of 153 benchmark cases, no false STOP.

Two corrections to the old text. The "Hopfield network" is a soft nearest-match over five hand-written
symptom patterns that *suggests a syndrome* to the clinician. It does not process medicine names. The
edit-distance matcher is used on text read from scanned prescriptions, not on accents.

---

## 10. The doctor's scribe

The earlier document said an ambient scribe "runs continuously in the background". It does not, by design
(`docs/SCRIBE_DESIGN.md`):

- **Dictation is the default.** Push to talk, the doctor's voice only.
- **Room recording needs the patient's consent for this visit**, recorded and enforced by the server.
  Withdrawing consent takes one tap and deletes the room text.
- No speaker is guessed. Uncertain words are marked. Audio is never stored.
- The visit note is built by the fixed template. Nothing is saved until the doctor edits and signs.

---

## 11. Questions a jury may ask

**"If there is no model, where does the summary's wording come from?"**
From sentence frames we wrote, in `clinicalHistory.service.ts`. Run `npm run explain` on any sentence.

**"Show me it cannot hallucinate."**
Battery 30, group D: every one of 94,201 words in 446 summaries is found in the record or the templates.
What it *can* do is miss something or mishear it. Section 8 gives those rates.

**"What happens with a phrase you never taught it?"**
It is missed, not guessed. The patient sees what was understood and corrects it by tap. Each miss we
find becomes a test sentence.

**"Is this scalable to other languages?"**
The kiosk screens are in eleven languages. Speech understanding is measured for Hindi and English only.
A new language needs a recogniser and dictionary entries, and its own test set.

**"Why is your system better than using a language model?"**
We do not claim it is better at language. We claim that for a clinical record, never inventing,
always repeatable and always traceable matter more than fluency, and we can prove those three.

**"Is the dictionary complete?"**
No. 1,076 word forms and 110 concepts cover common OPD complaints. It grows from real phrases.

**"Do you have all NAMASTE codes?"**
No. Twenty sample entries with placeholder codes are bundled. The import script is ready for the
official export, which we have not yet been given.

---

## 12. Reproduce it

From `26047/backend`:

```bash
npm run explain -- "मुझे तीन दिन से पेट में दर्द है बुखार नहीं है"
```

```bash
npm run test:no-llm
```

```bash
npm test
```

```bash
npm run test:extraction -- --set blind
```

`--set` also takes `holdout`, `final`, `contrast` and `socrates`. From `26047/frontend`,
`npm run eval:matcher` scores the on-device matcher. The spoken benchmark is
`edge-ai/eval/extraction_audio.py` with `backend/tests/extraction_audio_score.ts`.

Settings that decide what may run:

| Setting | Where | Default | Meaning |
|---|---|---|---|
| `LLM_ASSIST` | backend | `off` | `clinician` allows a model draft of the clinician's visit note only |
| `GENERATIVE_ASR` | backend | `off` | `allow` permits the Whisper fallback |
| `LLM_GGUF`, `ASR_MODEL` | edge-ai | unset | Whether a language model or Whisper is installed at all |
| `VITE_ALLOW_CLOUD_SPEECH` | frontend build | allowed | `false` stops the browser's cloud speech recognition |

---

## 13. Corrections to the earlier version of this document

| Earlier claim | What is true |
|---|---|
| "No model", "no AI" | No *language* model. Speech recognition and read-aloud are neural models |
| Knowledge is stored in "radix tries" | There is no trie in the code. The dictionary is hash maps keyed by sound |
| "50,000+ medical terms" | 1,076 speech word forms; 300 medicines with 804 other names; 108 formulations |
| "All 1,941 NAMASTE codes, mapped bijectively" | 20 sample entries with placeholder codes. We could not confirm the figure 1,941 from an official source |
| "Lookup in 0.033 ms", "60,000× faster than an LLM" | A full sentence takes 0.23 to 0.38 ms. No language model was benchmarked |
| "Runs in 25 MB on a ₹13,400 Raspberry Pi 5" | The rules add about 12 MB; the speech service uses about 3.5 GB. Never run on a Raspberry Pi |
| "0.00% hallucination", "near-100% precision" | The summary cannot invent (tested). Hearing and rules can miss: 88 to 92% first-run on text, about 94% in quiet falling to about 61% in an echoing hall on speech |
| "Four deterministic filters" for sound-alike medicines | Section 9. Dictated medicine names are right about two times in three and the doctor confirms |
| "Hopfield memory recovers mumbled drug names in 0.05 ms" | It suggests a syndrome from five hand-written patterns. It does not touch medicine names |
| "Ambient scribe runs continuously" | Dictation by default; room recording only with consent |
| "100% air-gapped" | Understanding and summary need no network (tested). Nine kiosk languages use the browser's cloud speech unless the build disables it |
