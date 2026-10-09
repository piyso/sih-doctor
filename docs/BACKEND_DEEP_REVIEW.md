# Backend deep review for SIH 26047 (national-level readiness)

Date: 2026-10-09. Scope: `backend/` and `backend/src/services/core/`, with the problem statement
(SIH26047, AIIA / Ministry of Ayush) and the SIH rubric as the yardstick. Nothing was changed; every
finding below was verified by reading the code and by running probes against the services and the
live dev server.

Verified state at the time of review:

| Check | Result |
| --- | --- |
| `tsc --noEmit` | clean |
| `npm test` (23 batteries, scratch DB) | all pass in 22 s |
| Extraction gold set | 163/163 |
| e2e (Playwright) | 13 tests |
| Edge AI live | ASR only (TTS, translate, LLM, OCR all `available:false`) |

---

## 1. Verdict in one paragraph

The parts of the backend that are honest are very good for a hackathon and better than most deployed
Indian hospital software: the security layer, the DPDP flows, the queue/token/alert operations, the
deterministic Hindi/English extraction with its measured gold set, the lab decimal-restoration engine,
and the phytochemical decompounding idea in the interaction engine. The parts the pitch leans on
hardest (the "cognitive kernel": PAC gate, Bayes factor, Hopfield, counterfactuals, Groth16 ZKP,
offline seal, proximity) are demo theatre that a national jury with one ML person, one cryptographer
or one NHA/ABDM person will take apart in under two minutes of Q&A. On top of that there is one real
patient-safety gap in the live flow, and the problem statement's named deliverable (a complete,
structured clinical history) is only partially modelled. Winning nationally means inverting the
pitch: lead with what is measured and real, make the theatre either real or gone, and build the
history model the PS actually asks for.

---

## 2. What is genuinely strong (keep, and pitch harder)

- **Security engineering** (`backend/src/security/*`): scrypt PINs with per-user salt and
  constant-time compare, 256-bit session tokens stored only as SHA-256, lockout after 5 failures,
  idle timeout, one-time 60 s tickets for SSE/WebSocket, kiosk device enrolment, Ed25519 signature
  over canonical JSON for every finalized record with a public verify endpoint, hash-chained audit
  log with a verify walk, AES-256-GCM field encryption plus HMAC blind index for phone numbers,
  encrypted online backups with rotation, demo data hard-off in production, no stack traces to the
  browser. This is real and defensible.
- **DPDP implementation** (`privacy.service.ts`): purpose-level consent with version, emergency
  exception for SOS, withdrawal, right-to-access export, erasure of identifiers with pseudonym while
  keeping clinical content for the legal retention window, scheduled retention, grievance officer
  config. Judges from MeitY/NHA will recognise this as correct.
- **Operations core**: per-department daily token counters in a transaction, queue position
  without leaking other patients, SSE board with a public/staff split so names never reach the
  waiting-room TV, SOS raise/ack/resolve with dedupe, no-show, pharmacy dispense, analytics computed
  from real rows, syndromic surveillance with a documented Poisson-style threshold, follow-up SMS
  with consent gating, ESC/POS raster printing, ASHA offline sync with per-record versions and
  conflict replies.
- **Extraction pipeline** (`clinicalText.ts`, `clinicalParser.service.ts`, `clinicalLexicon.ts`):
  deterministic, clause-scoped negation in Hindi and English, Hindi number words to digits for
  vitals, measured on a frozen gold set and on real audio through on-prem ASR. Fast (6k to 7k
  transcripts per second). No LLM in the patient path. This is the right call and it is measured.
- **Lab plausibility** (`physiologicalPlausibility.service.ts`): dropped-decimal restoration plus
  stoichiometric cross-checks (BUN/creatinine, De Ritis, bilirubin fractions, protein fractions,
  anion gap) with human-review flags. Clever, honest, demoable.
- **Interaction engine idea** (`clinicalOntology.engine.ts`): brand to molecule to WHO ATC class,
  AFI formulation to bioactive constituents, mechanism rules on top. The decompounding of classical
  polyherbals into phytochemical classes is the most novel defensible thing in the repo.

---

## 3. What will lose at national level

### 3.1 The cognitive kernel is theatre (verified by probe)

Each line below was reproduced with `scratchpad/probe.ts` and curl against the dev server.

| Claim in code / README | What actually happens | Evidence |
| --- | --- | --- |
| "PAC conformal gate, 99% coverage guarantee" | Threshold is `0.38 × (1 + (0.05 − α) × 2.5)` clamped to [0.30, 0.55]. No calibration set, no held-out nonconformity scores, so the "guarantee" string is cosmetic. The TS copy in `pacConformalGate.service.ts` uses a *different* formula (`0.38 × α/0.05`) from the kernel. | probe [4]: α=0.001 gives threshold 0.4266 and the string "99.9% PAC Coverage Bound" |
| "Savage-Dickey Bayes factor BF10" | BF is literally `alpha / beta`. One reinforcing observation gives BF 2.89 and `isStatisticallySignificant: true` at a threshold of 2 (README says 3). Not a density ratio. | probe [3] |
| Bayesian evidence from "clinical_trial" and "pharmacovigilance" | `BayesianTruthEngineService.evaluatePair` fabricates 2 to 3 synthetic observations labelled `clinical_trial`, `pharmacovigilance`, `operator_attested` whenever the registry matches, and 2 "safe" observations when nothing matches. The `bayesian_observations` table is empty. | probe [3] second line |
| "Continuous modern Hopfield network" | Softmax nearest-neighbour over 5 hand-written 10-dimensional vectors. All-zero input "recalls" ACS at 0.2; fever alone recalls "Pediatric Respiratory Infection" at 0.996. The intake caller guards with ≥2 active features, which is the only reason it does not misfire in the product. | probe [6] |
| "Pearl Level-3 counterfactual substitution" | `therapeuticEfficacyPreserved` is hardcoded true; an unknown substitute defaults to risk 0.02 so anything "reduces risk". "Chocolate Cake" is recommended as a substitute for Yograj Guggulu with a 3.0% risk reduction. Hypergraph polypharmacy returns hardcoded Bayes factors 248.9 / 164.2 / 1.2. | probe [5] |
| "Groth16 zk-SNARK per encounter, soundness" | Every badge verifies the same `proof.json` shipped in the repo; nothing binds the proof to the record hash. Two different records get `VERIFIED_VALID`. `encounters.zkp_proof_json` is always NULL. | probe [7] |
| `/api/security/verify-offline-seal` "BSA §63 admissible" | Ignores `sealSignature` entirely; returns `isValid:true` for garbage. | curl with `"sealSignature":"GARBAGE"` → `isValid:true` |
| `/api/security/verify-proximity` geofence + Wi-Fi RSSI | Empty body returns "INSIDE_HOSPITAL_RADIUS" because lat/lng default to the hospital and RSSI defaults to −52 dBm. | curl `{}` → `withinPerimeter:true` |
| Gate nonce HMAC | Secret is a hardcoded string in source (`GATE_SECRET`). `hashVerification: '0x3c9f28a7…'` is a constant. | `security.routes.ts` |
| "100% compliant ABDM FHIR R4" | Bundle fabricates `ABHA-<sessionId>` or `12-3456-7890-1234` when no ABHA exists, hardcodes practitioner `HPR-AYUSH-10492` for every doctor (staff have a real `registrationNo` that is never used), hardcodes facility `IN-DL-AIIA-001`. Only Condition and MedicationRequest are emitted; the NRCES OPConsultRecord profile expects Chief Complaints, Allergies, Medical History, Investigation Advice, Follow-Up, Procedure, Document Reference sections. Codes use ICD-10 while the PS world is NAMASTE + ICD-11 TM2. It will not pass the NRCES / HAPI validator. | probe [8] |
| Sovereign, auditable kernel | `sovereign-kernel.cjs` is a single minified line with no TypeScript source anywhere in the repo; the `.ts` files in `core/` are type-only wrappers. For a pitch built on "auditable" and "sovereign", shipping unreadable code is a red flag. | `wc -l` = 1 |
| 23-battery scorecard | `runner.ts` hardcodes `r20: true` and `r22: true`; battery 9 prints "51/50 Invariants"; many batteries are self-authored synthetic cases scored as "Sens 100% MCC 1.000" with names like "Grand Apex" and "Ultimate Hardest". The credible numbers are the extraction gold set, the matcher eval and the measured ASR CER/WER. | `tests/runner.ts` lines 118 to 120 |

Why this matters more than it looks: the rubric gives 25% to novelty and 10% to Q&A, but the Q&A is
where novelty is *verified*. One "show me the calibration set" or "change one byte of the record and
re-verify the proof" converts the novelty score into a credibility penalty for the whole project,
including the parts that are real.

### 3.2 A real patient-safety gap in the live flow

The ontology engine has pregnancy, renal and paediatric rules (`ONT-PREG-WARFARIN`,
`ONT-PREG-METHOTREXATE`, `ONT-PREG-RAAS`, `ONT-PREG-STATIN`, `ONT-RENAL-METFORMIN`,
`ONT-RENAL-CALX`, `ONT-GARBHINI-ABORT`, plus `checkVulnerableDemographics`). They only fire when a
`patientContext` is passed. No route passes one:

- `doctor.routes.ts:522` calls `evaluatePrescriptions(allo, ayush)` with no context, even though
  the session's patient row has `is_pregnant`, `gestational_weeks`, `is_lactating`, `age`, `weight_kg`.
- `contraindications.routes.ts:18` same.
- The frontend payloads (`api.ts` lines 423 and 586) send neither `isPregnant` nor age.

Result, reproduced: Warfarin for a pregnant patient produces **zero** alerts at the doctor desk.
Kalonji Churna in pregnancy produces zero alerts. Metformin with eGFR 20 produces zero alerts.

Second matcher problem: the registry matcher in `truthEngine.service.ts` uses substring `includes`
on raw names. "stopped warfarin last year" matches warfarin; `Nystatin` + Trikatu fires the
statin–piperine rule `INT-010` even though the ontology has a nystatin guard, because the registry
layer runs first and does not go through `resolveAllopathicConcept`.

### 3.3 The PS's named deliverable is thin in the data model

SIH26047 Module C asks for a physician-ready history in standard format: Chief complaint → HPI →
Past medical/surgical → Drug & allergy → Family → Personal → ROS → Prior investigations summary,
plus Dashavidha Pariksha and Ahara-Vihara for Ayush. What the backend stores today:

- `sessions.history_json` = `{ conditions: string[], allergies: string, currentMedicines: string }`.
- HPI exists only as per-symptom SOCRATES fields in `symptoms_json`.
- No past surgical history, no family history, no personal/social history (tobacco, alcohol, diet,
  sleep, bowel, appetite, activity, which for Ayurveda is Ahara-Vihara), no review of systems, no
  allergy reaction/severity, no obstetric history for women, no dated document timeline.
- No record of what was *asked* versus *answered* versus *skipped*, so "how do you know the history
  is complete?" has no answer.
- The SOAP builder writes "Assessment: To be completed by the clinician."

Module A asks for an adaptive interview driven by a clinical history ontology. Today the branching
lives in frontend step components (`Step4Socrates.tsx` and friends); the backend has no interview
state, no question ontology, and no notion of red-flag probes per complaint.

### 3.4 Terminology depth

The jury for this PS is AIIA. They know NAMASTE. The repo has:

| Dataset | Rows in repo | Real-world size |
| --- | --- | --- |
| NAMASTE entries | 20 | ~4,500 Ayurveda morbidity codes |
| Classical formulations | 8 | AFI Part I–III: several hundred |
| Interaction rules | 36 | n/a (curated is fine, but cite each) |
| Pharmacopoeia FTS rows | ~45 | NLEM 2022 alone: ~384 molecules |

`AyushEngineService.resolveDiagnosis` is an `includes` chain: "pitta" → Amlapitta, "back" →
Gridhrasi, "chest" → Hridroga, "skin" → Kushtha, and any fever falls back to Vataja Jwara. This is
the first thing an Ayush examiner will try.

### 3.5 Engineering-credibility items (rubric: technical feasibility 25%)

- Schema evolves through try/catch `ALTER TABLE` scattered across nine files; no migrations table.
- Business logic lives in routes (`prescribe` is 140 lines of SQL plus logic); no encounter service.
- No HTTP-level tests; all 23 batteries are in-process unit runs. No OpenAPI contract.
- Merkle chain: nodes ordered by `created_at` (ties break verification), hashed with
  `JSON.stringify` rather than `canonicalJson`, written outside the prescribe transaction, and any
  kiosk can append arbitrary nodes through `/api/security/zkp/generate-proof`.
- `documents.routes.ts` lets any kiosk write documents against any `patientId` and auto-creates
  "Pre-Intake Patient" rows with gender `UNKNOWN`, bypassing the consent model.
- `eraseIdentifiers` deletes drafts by the pseudonymised name after the rename, so it deletes
  nothing. Harmless (drafts no longer store names) but wrong.
- `lever/` is an abstraction over nothing: `leverSource` flips between
  `CORE_DISTRIBUTED_LIVE` and `SOVEREIGN_AIRGAP_FASTPATH` based on whether the server can reach
  itself.
- Rate limiting is per IP only; ten kiosks behind one NAT share a bucket.
- Edge AI: TTS, translate and OCR are off. The PS explicitly asks for audio prompts and document OCR.
- README banners about patents and "All Rights Reserved" on a government PS submission invite
  questions about SIH IP terms; keep the claims technical.

---

## 4. The plan, ordered by (jury impact × effort)

### Tier 0: honesty pass (1 day, do first)

1. Make every verification endpoint real or remove it.
   - Offline seal: the record is already Ed25519-signed. Make `verify-offline-seal` verify that
     signature over the printed payload with the hospital public key. Real, offline, 10 lines.
   - ZKP: either bind it or drop it. Binding means a circuit whose public input is the record hash
     and a per-encounter `groth16.fullProve` with the existing `wasm`/`zkey`; if that is more than a
     day, remove the ZKP routes and keep signature + hash chain, which is already a sound
     "digital signature under IT Act §3 / BSA §63" story.
   - Proximity: require lat/lng and RSSI; reject when absent. Move `GATE_SECRET` to the key dir.
2. Replace the PAC gate's formula with a real split-conformal quantile computed from a calibration
   set (the 91 gold transcripts plus the matcher eval are enough to start; report n). Then the
   coverage statement is true and you can show the data.
3. Fix the Bayes factor: closed-form Savage-Dickey for a Beta prior/posterior at θ = 0.5 is one
   line; or drop the term and call it a weighted evidence score. Remove fabricated observations;
   use the registry's cited evidence score as the prior and only real rows as observations.
4. Rename "Hopfield" to "prototype syndrome matcher" unless prototypes are learned from data.
   Remove hardcoded hypergraph Bayes factors; return the saturation index only.
5. Un-minify the kernel into real TypeScript in `core/`, delete the duplicate TS gate formula and
   the `lever/` layer.
6. Runner: no hardcoded `true` results; rename batteries to what they test; keep "Sens/Spec/MCC"
   only for the gold sets that were not authored by the same person who wrote the rules.
7. FHIR: never fabricate identifiers. Omit `Patient.identifier` when there is no ABHA; use the
   staff `registrationNo` and council as the Practitioner identifier; make facility id config.

### Tier 1: patient safety and PS fidelity (2 to 3 days)

1. **Patient context everywhere.** `prescribe` and `/contraindications/evaluate` load the patient
   row (age, gender, pregnancy, lactation, weight) and the latest creatinine/eGFR from document lab
   markers, then call `evaluatePrescriptions(allo, ayush, ctx)` and `checkVulnerableDemographics`.
   Frontend sends `sessionId` so the server resolves context itself. Add batteries: pregnant +
   warfarin must alert; child + bhasma must alert; eGFR 20 + metformin must alert.
2. **Matcher hygiene.** Route every name through `resolveAllopathicConcept` / `resolveAyushConcept`
   first and match registry rules on canonical molecule and ATC class; use the whole-word and
   negation helpers from `clinicalText.ts` on free-text names.
3. **Clinical history model (Module C).** New `history` object on the session: chief complaint;
   HPI (existing SOCRATES); past medical (condition, since, control); past surgical; drug history
   (name, dose, adherence) and allergies (agent, reaction, severity); family; personal/social
   (tobacco, alcohol, diet, sleep, bowel, appetite, activity = Ahara-Vihara); ROS with explicit
   "asked and denied"; obstetric for women; immunisation for children; dated investigation
   timeline from documents. Backend builds the physician summary deterministically in the PS's
   section order, in English and Hindi, and stores a completeness record (asked / answered /
   skipped). Emit it in FHIR as AllergyIntolerance, FamilyMemberHistory, Observation (vitals and
   social history), Condition (PMH), MedicationStatement (ongoing), Procedure (PSH),
   DocumentReference (scans), matching the NRCES OPConsultRecord sections. Run the HAPI validator
   with the NDHM IG in CI and show the green output on stage.
4. **Interview engine on the backend (Module A).** A deterministic state machine driven by a
   question-ontology JSON: chief complaint → SOCRATES branch → complaint-specific red-flag probes
   (chest pain: dyspnoea, sweating, radiation; headache: worst-ever, neck stiffness, vision; fever:
   rash, neck stiffness, convulsions; pregnancy: bleeding, reduced movements) → PMH → drugs and
   allergy → family → personal → ROS → Dashavidha Pariksha when the care stream is Ayurveda.
   `POST /api/kiosk/interview/next` returns the next question in the patient's language with touch
   options and accepts a spoken or tapped answer; the server keeps the asked/answered log. No LLM,
   consistent with the team's own evidence-based decision. The kiosk steps become renderers.
5. **Terminology at real scale.** Import the NAMASTE Ayurveda morbidity export and ICD-11 TM2 into
   SQLite FTS5 with Devanagari and romanised synonyms; `resolveDiagnosis` returns ranked candidates
   with scores for the doctor to confirm. Import the AFI formulation index and the NLEM molecule
   list the same way.

### Tier 2: engineering credibility (1 to 2 days)

- Migrations table with versioned migration files; one `schema.ts`.
- `EncounterService` that owns prescribe/amend/dispense; routes become thin.
- Zod schemas for every request body, generated `openapi.json`, served at `/api/docs`.
- Supertest integration tests for the critical paths: intake without consent is 400, SOS raises
  and dedupes, prescribe twice is 409, pharmacist dispense, admin erase then export, audit chain
  verifies, kiosk cannot read sessions.
- Merkle: order by rowid, hash with `canonicalJson`, include the Ed25519 signature in the node,
  write inside the prescribe transaction, staff-only append.
- Kiosk document upload bound to the kiosk's current draft/session and its consent; no auto
  patients.
- Rate limit per kiosk device id as well as IP.
- CI: tsc, batteries, e2e, FHIR validation, Python tests for edge-ai.
- Capacity statement with numbers for the pitch: a 10,000 OPD/day hospital is well under one
  write per second; SQLite WAL on one box is the right design and you can say why.

### Tier 3: honest demo features that score with this jury

- On-prem TTS (Piper or VITS Hindi through the sherpa-onnx stack already in `edge-ai/`) so the
  kiosk speaks every question. The PS asks for audio prompts; today TTS is off.
- OCR: printed text through the existing native Tesseract path; handwritten explicitly routed to
  human review with the plausibility engine as the safety net. Demo the decimal restoration live.
- ABDM sandbox: real ABHA verify with sandbox credentials, and a push of the validated bundle
  through the consent flow, with a recorded video fallback. The code already says "not connected";
  connecting is bounded work.
- Offline-first kiosk queue with replay when the backend returns (the ASHA sync already has the
  pattern).
- A k6 script running during the demo: 10 kiosks checking in every 30 s plus doctor polling, with
  p95 latency on screen.

---

## 5. Pitch reframing

Lead with what is measured: Hindi ASR character error rate in noise, 163/163 extraction gold,
98% on real audio, thousands of transcripts per second on a ₹30k box, signed and hash-chained
records, DPDP flows an auditor can click through, decimal restoration on real lab reports,
herb–drug decompounding with citations, and after Tier 1 the only kiosk in the room that produces a
complete structured history with a completeness score and a validator-green ABDM bundle. Retire the
words patent, Groth16, Hopfield and PAC from the pitch unless they are real by then.

## 6. Not reviewed in depth

Frontend components, `edge-ai/app/engines.py` internals, the OCR services, the phonetic
normaliser internals, and the content of the larger test batteries. Nothing in the repo was modified.
Probe script: `scratchpad/probe.ts` (session scratchpad, not in the repo).

---

## 7. Implementation log (2026-10-09, same day)

Everything in Tiers 0 to 2 above was implemented after this review, plus the ABDM HIP layer. Verified by
`cd backend && npm test` (25 batteries, all passing on a throw-away database) and the Playwright suite.

**Honesty pass**
- `services/core/` is plain TypeScript; the minified kernel and the `lever/` layer are gone.
- Bayes factor is a real Savage–Dickey ratio (flat reference prior, H0 θ = 0.5), significance at BF10 ≥ 3; the pair
  evaluator uses the registry evidence as a Beta prior with 10 pseudo-observations and only *stored* observations
  (`bayesian_observations`), never synthetic ones.
- Suggestion gate is split conformal: `scripts/calibrate-conformal.ts` builds `src/data/conformal_calibration.json`
  from `edge-ai/eval/syndrome_calibration.json` (42 usable labelled transcripts, α = 0.1, q̂ = 0.0865); the gate
  abstains without a calibration set.
- Counterfactual substitution is graph-grounded (shared indication, no recorded harm path); unknown substitutes
  return `NO_DATA`. Polypharmacy screen carries no invented Bayes factors.
- Offline seal verifies the Ed25519 signature; ZKP verifier requires a caller-supplied proof; proximity needs
  measured values; gate secret derived from the field-encryption key; diagnostics endpoint reports live state.
- Runner has no hardcoded passes; the test that asserted fabricated constants was deleted.

**Patient safety and PS fidelity**
- `patientContext.service.ts`: pregnancy, age, lactation, weight, known conditions and eGFR (CKD-EPI 2021 from the
  latest creatinine on file) feed every interaction check; `/doctor/prescribe` blocks critical contraindications
  (HTTP 422) until the prescriber acknowledges them, and the signed record lists which checks ran.
- Matcher hygiene: brand → molecule canonicalisation, whole-word matching, negated mentions ignored,
  constituent-level paediatric gate.
- `triage.service.ts`: NEWS2 (RCP 2017) on kiosk and clinician vitals, raise-only, flagged unverified when
  self-reported.
- `clinicalHistory.service.ts`: structured history (PMH, PSH, drugs, allergies, family, personal, ROS, obstetric,
  Ayush) with asked / answered / skipped completeness and a deterministic English + Hindi summary in the PS order.
- `interview.service.ts` + `shared/interview_ontology.json`: 75-question adaptive interview with complaint-family
  branches, red-flag probes, gating by patient attributes and care stream, encrypted server-side state,
  `/api/kiosk/interview/*` endpoints.
- `terminology.service.ts`: FTS5 ranked search seeded from the ontology; `npm run import:namaste` loads the official
  NAMASTE / ICD-11 TM2 export; `GET /api/abdm/namaste/search`.

**ABDM (NHA)**
- `fhirGenerator.service.ts` rewritten to the NRCES OPConsultRecord profile with 11 coded sections and no invented
  identifiers; `validateBundle` performs structural checks.
- `abdmHip.service.ts` + `/api/abdm/hip/*`: care contexts per finalized visit, consent artefact intake, encrypted
  health-information push (ECDH Curve25519 + HKDF-SHA256 + AES-256-GCM), HIU simulation for demos. See
  `docs/ABDM_INTEGRATION.md`.

**Engineering**
- `src/app.ts` application factory, `tests/http_api.test.ts` drives the real server (39 checks), `db/migrations.ts`
  versioned schema, OCR routes no longer create placeholder patients, erase bug fixed, interview states expire with
  the draft retention window, `scripts/load/k6-opd.js` load profile.
- Frontend: doctor panel shows the structured summary, NEWS2 and safety context; diagnostics modal shows live values.

**Still open**
- Kiosk UI for the interview endpoints (the backend state machine is live; the kiosk steps still use the fixed wizard).
- ABDM sandbox credentials and the Fidelius interop check; HAPI validator run with the NDHM IG package.
- On-premise TTS and OCR models in `edge-ai/` (service reports them as unavailable until models are installed).
- Real NAMASTE export import (seed holds 20 entries).
