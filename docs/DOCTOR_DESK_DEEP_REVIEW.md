# Doctor / Vaidya Desk — Deep Review and Target Design (v2)

*2026-10-09. v1 was a code reading plus research. v2 adds **measurement**: the safety engine was
probed through the real API on the dev backend, a 43-case benchmark was run, drug-name coverage was
counted, and the clinical content (interaction rules, formulary, Schedule E(1) logic, patient-language
instructions) was audited. It also adds research on legal validity, national programmes, Ayurveda
case records and decision-support design. The benchmark is in `docs/evidence/` so it can be re-run.
No application code was changed.*

> **Status 2026-10-10: implemented.** Phases 0–4 and D1–D18 are built and verified. See §12 for what
> was done, the measured results, and what still needs people or agreements outside the code.

---

## 0. Bottom line

1. **The safety engine is the real problem, not the screen.** On 34 well-established dangers it
   raised an alert for **7 (21%)**. On 9 common, accepted combinations it raised a wrong *critical*
   alert on **5**. It misses warfarin + ibuprofen, penicillin allergy + amoxicillin, valproate in
   pregnancy, aspirin in a 6-year-old, a 3× paracetamol overdose in a toddler and banned combination
   drugs. It interrupts the doctor for aspirin + ginger juice. The desk says "Interaction check on"
   above all of this.
2. **Root causes are fixable and specific** (§1.3): the engine can't recognise most drug names (it
   knows 10 of 30 everyday OPD generics and 9 of the desk's own 14), there is no allergy, duplicate,
   dose, banned-combination, paediatric or elderly logic, the severities are not calibrated, and
   some rules contradict each other.
3. **The order of work matters.** If name recognition is fixed *before* the severities are
   recalibrated, dormant "critical" rules (e.g. digoxin + metoprolol, a routine combination in atrial
   fibrillation) wake up, and alert fatigue gets worse. Fix recognition, rules and severity together,
   behind a benchmark gate.
4. **The screen problems from v1 still stand** (D1–D13), and v2 adds five more (D14–D18): one-click
   warfarin and digoxin as the first quick picks, a Schedule E(1) check that flags every "Rasayana"
   but misses mercury-containing "Ras" medicines, patient-language instructions that drop "empty
   stomach", and diet advice that contradicts the interaction engine.
5. **The national angle is the advantage nobody else has:** India-specific prescribing rules
   (generic in capitals, banned FDCs, AWaRe, H1, TB notification), national protocols as one-click
   order sets (IHCI hypertension, ICMR treatment workflows, Ayurvedic STGs), and an honest,
   *measured* safety engine. That last one is the claim judges will test, so it must be true.

---

## 1. Measured: the safety engine

### 1.1 Probes through the real API

Dev backend on :8001, signed in as the demo doctor, `POST /api/contraindications/evaluate` (the same
evaluation `/prescribe` uses). Test patient: demo "Rekha Devi", 31, **pregnant**, **penicillin
allergy (rash)**, on levothyroxine.

| Probe | Result |
|---|---|
| Amoxicillin, called the way the desk calls it (no `sessionId`) | 0 alerts, "context: none" |
| Amoxicillin **with** `sessionId` (allergic patient) | **0 alerts.** There is no allergy check at all. |
| Amoxicillin-clavulanate (the desk's own formulary item) for her | 0 alerts |
| Warfarin with `sessionId` (pregnant) | ✓ critical: pregnancy × warfarin (works) |
| Warfarin alone, desk-style (no `sessionId`) | 0 alerts, so the desk never shows the pregnancy alert live |
| Vaidya finalizes Yogaraja Guggulu while the patient takes warfarin | HTTP 422 with the message "re-submit with acknowledgeAlerts: true". The desk can't send that, which confirms D1. |

### 1.2 Benchmark (43 cases, Appendix A)

| Category | Caught |
|---|---|
| Drug–drug, common Indian OPD majors (14) | **2** (tramadol + sertraline, lithium + ibuprofen) |
| Duplicate therapy (2) | 0 |
| Allergy (1) | 0 |
| Pregnancy (5) | 2 (enalapril, atorvastatin). Missed: doxycycline, valproate, misoprostol |
| Kidney function (3) | 1 (metformin at eGFR 20). Missed: nitrofurantoin, diclofenac |
| Children (3) | 0 (aspirin at 6 y, codeine at 8 y, paracetamol 650 mg TDS at 13 kg) |
| Older adults (1) | 0 (glibenclamide at 78) |
| Banned FDCs (2) | 0 |
| Herb–drug (2) | 2 (but each fires twice, from duplicate rules) |
| Schedule E(1) (1) | 0 (Sutshekhar Ras) |
| **Total sensitivity** | **7 / 34 (21%)** |
| Benign cases without a wrong critical | **4 / 9.** Wrong criticals: aspirin + ginger juice; metformin + Nisha Amalaki (the registry also lists this pair as SAFE); fluoxetine + Jatamansi; ciprofloxacin + Praval Pishti; telmisartan + 3 days of ibuprofen. Sitopaladi with its own classical anupana (honey + ghee) raises an incompatibility, and the desk paints every alert red. |

*These are expected-behaviour cases written from standard pharmacology references (labels, BNF-style
interaction severity, Beers criteria, WHO/national guidance). A clinical pharmacologist should
review the list before it becomes a gate; the direction of the result does not depend on any single
case.*

### 1.3 Why: four root causes

1. **Drug-name recognition.** `ClinicalOntologyEngine.resolveAllopathicConcept` returns nothing for
   most real names. Measured: **10 / 30** everyday OPD generics resolve (not paracetamol,
   amlodipine, azithromycin, cefixime, doxycycline, cotrimoxazole, metoprolol, atenolol, salbutamol,
   prednisolone…), and **9 / 14** of the desk's own formulary. The existing rules for
   sildenafil + nitrate, methotrexate + cotrimoxazole and digoxin + β-blocker **can never fire**,
   because isosorbide, cotrimoxazole and metoprolol don't resolve. (A code comment claims the stem
   rules "resolve 100% of open-world unseen drugs"; they don't.)
2. **Missing rule families.** Only 7 drug–drug rules exist (warfarin + NSAID is absent). There are
   no rules for allergy, duplicate class, dose range, child, older adult, banned FDCs or
   pharmacokinetic interactions (azoles, macrolides, rifampicin).
3. **Severity not calibrated.** "Critical" (which interrupts and blocks signing) is used for
   theoretical or timing-only issues: ciprofloxacin + calcium is a spacing instruction; aspirin +
   ginger is dietary and minor; ACE/ARB + NSAID is a monitoring issue unless a diuretic makes it the
   "triple whammy". In the registry, 20 of 36 rules are critical, against 7 warnings.
4. **Content errors and contradictions.**
   - INT-002 (critical) and INT-032 (SAFE) cover the same pair, metformin + Nisha Amalaki.
   - INT-007 (warning) and INT-026 (critical) cover ciprofloxacin + Praval Pishti.
   - INT-012 and INT-021 are duplicates.
   - INT-028 treats **Jatamansi** (*Nardostachys jatamansi*) as St John's wort (*Hypericum*). They
     are different plants.
   - INT-009 fires on any honey + ghee, but the classical incompatibility is *equal quantities*, and
     the formulary's own Sitopaladi anupana is honey + ghee.

**Consequence for the order of work:** fixing cause 1 alone would wake up mis-calibrated criticals
(e.g. digoxin + metoprolol, a common atrial-fibrillation combination, is coded critical). Causes
1–4 must be fixed together, gated by the benchmark.

### 1.4 What "good" looks like (gate for release)

- MUST set: **≥ 95% raise at least a warning; 100% of allergy, banned-FDC and absolute
  pregnancy cases are critical.**
- BENIGN set: **0 wrong criticals.**
- Coverage: **≥ 95% of NLEM 2022 generics resolve** to an ingredient and class (measured by a script
  over the formulary import).
- Every rule cites a source and has one severity. Duplicates and contradictions fail CI.

---

## 2. Verified defects in the desk

D1–D13 are from v1 and still open. D14–D18 are new in v2.

| # | Defect | Where |
|---|---|---|
| D1 | The server answers 422 until critical alerts are acknowledged, but the desk can't acknowledge. "Try again" loops, and **"Print without saving" prints an unsigned prescription containing the contraindicated item.** | `api.ts:565`, `OfficialAiiaRxModal.tsx:120-206` |
| D2 | The override reason is typed, then discarded. | `DualPharmacologyPrescriber.tsx:629` |
| D3 | The live check runs only when both lists have items, and never sends `sessionId` (proved in §1.1). | `DualPharmacologyPrescriber.tsx:354`, `api.ts:854` |
| D4 | No allergy check (proved in §1.1). | `truthEngine.service.ts:78` |
| D5 | The modal tests `CRITICAL_LETHAL`; the server sends `CRITICAL_CONTRAINDICATION`, so critical alerts render amber. | `ConflictAlertModal.tsx:20` |
| D6 | The browser substitutes its own hardcoded alerts when the server finds none. | `api.ts:854-930` |
| D7 | Hardcoded "1-click" substitutions, chosen by drug rather than by pair, with invented codes. | `DualPharmacologyPrescriber.tsx:33-170` |
| D8 | The scribe transcript carries over between patients. | `DoctorDeskContainer.tsx:30,441` |
| D9 | The kiosk's suggested diagnosis is signed as the doctor's diagnosis. | `OfficialAiiaRxModal.tsx:131` |
| D10 | Vitals lack respiratory rate, AVPU, O2, weight and blood sugar, so NEWS2 is always incomplete and there is no child dosing basis. | `PreIntakePanel.tsx:44` |
| D11 | Drafts are memory-only; nothing marks a patient as taken; no "seen today"; pharmacy `REFERRED_BACK` never returns to the doctor. | `DoctorDeskContainer.tsx:51` |
| D12 | Notes are invisible; tests can't be ordered. | — |
| D13 | Medicines the patient merely mentions become new orders via auto-extract. | `DoctorDeskContainer.tsx:244` |
| **D14** | **The quick-pick buttons are the first 5 formulary rows: Warfarin, Digoxin, Metformin, Atorvastatin, Paracetamol.** Warfarin is one click at 5 mg × 30 days, and digoxin at 0.25 mg. These are high-alert drugs whose dose depends on INR, age and kidney function. On the Ayurveda side the quick picks are the three herbs the interaction demo uses. Quick picks should be the doctor's most-used items, not demo triggers. | `DualPharmacologyPrescriber.tsx:445,487` |
| **D15** | **The Schedule E(1) check is a name regex** (`/rasa\|bhasma\|sindura…/`), used on the desk badge *and* the pharmacy's `containsScheduleE1`. Tested: it flags *Ashwagandha / Shilajit / Amalaki / Chyawanprash Rasayana* (not E(1)) and misses *Arogyavardhini Vati* (contains Parada), *Sutshekhar Ras*, *Tribhuvan Kirti Ras* and *Sameerpannag Ras*. Separately, the formulary marks Chandraprabha Vati as E(1) for "Shilajit & Loha bhasma", neither of which is on the E(1) list as far as I can tell (verify against the Schedule). E(1) must come from each formulation's **ingredient list** (AFI), not its name. | `DualPharmacologyPrescriber.tsx:498`, `doctor.routes.ts:341`, `clinicalFormulary.ts` |
| **D16** | **Patient-language instructions drop timing qualifiers.** "OD (Empty Stomach)" (levothyroxine, pantoprazole) prints as "once a day", losing *empty stomach*, which decides whether levothyroxine works. "Post lunch" and "morning & bedtime" are also lost. When the anupana is honey + ghee, only honey is printed. | `rxInstructions.ts:75-97` |
| **D17** | **False reassurance.** The pad says "Interaction check on" while the engine can't recognise a third of the medicines and has no allergy check. The UI must say what *wasn't* checked ("Amlodipine: not in safety database"). | `DualPharmacologyPrescriber.tsx:533` |
| **D18** | **Diet advice contradicts the engine.** Rasnasaptaka Kwatha (the hardcoded warfarin "safe alternative") carries pathya "Garlic rasam", and Arjuna Kwatha carries "Garlic in diet". The registry marks garlic + anticoagulant/antiplatelet as critical. | `clinicalFormulary.ts` (ayush-10, ayush-18) |

---

## 3. Design principles

| # | Principle | Evidence / reason |
|---|---|---|
| P1 | **Safe = fast.** The quickest path (order set, favourite, repeat last Rx, generic search) is also the safest. | OPD consults are 2–7 min after 60–100 min waits (Patna, Pune, Kolkata studies; CAG district-hospital audit). |
| P2 | **Few, tiered, patient-aware alerts.** | Pooled DDI override rate ~80% across 44 studies; in a tiered system, 100% of top-tier alerts were accepted vs 34% without tiering (Paterno 2009). Phansalkar panels: 15 pairs to always interrupt, 33 classes never to interrupt. |
| P3 | **The doctor owns every clinical claim.** Machine output is visibly a suggestion until accepted. | Ambient-scribe RCTs report occasional clinically significant inaccuracies. |
| P4 | **One engine, measured.** The live check = the signing gate = the benchmarked engine. | §1. |
| P5 | **Every on-screen claim is true.** Show what was and wasn't checked. | D17; NHA judges probe claims. |
| P6 | **Five Rights of decision support** (Osheroff): right information, person, format, channel, time. | E.g. herb–drug advice goes to the vaidya at the moment of adding the herb (right person and time), as an inline row badge (right format). The ADR report goes to PvPI / Ayush Suraksha (right channel). |
| P7 | **Indian conventions first.** `1-0-1` dosing notation, generic in capitals, salt always visible, Hindi/regional patient copy. | §5.4, §6. |

---

## 4. Rebuilding the safety engine (Phase 0)

1. **A drug dictionary before rules.** Import NLEM 2022 (384 medicines) and the hospital store list
   into a `drug_concepts` table: generic (INN), ingredients (FDCs split into components), ATC class,
   strength/forms, AWaRe group, Schedule H/H1/X, NLEM flag, pregnancy and lactation category,
   renal-dose thresholds, paediatric mg/kg range, Beers flag. Brands map to ingredients. Unknown
   names are *reported* as "not in safety database". Ayurvedic formulations get an **ingredient
   list** (from the AFI), which drives E(1), pregnancy and herb–drug matching.
2. **Rule families on top of the dictionary:**
   - allergy, including class cross-reactivity: penicillins; cephalosporins with a caution tier;
     sulfonamides.
   - duplicate class.
   - drug–drug: a curated Indian OPD set plus a licensed or open source (DDInter 2.0, if its terms
     allow).
   - drug–disease: NSAID in CKD/ulcer, non-selective β-blocker in asthma.
   - pregnancy and lactation; kidney function by eGFR band.
   - children: mg/kg dose and age contraindications. Weight is required under 12 (Pediatric
     Pharmacy Association position).
   - older adults: a Beers subset.
   - banned FDCs: CDSCO notifications 2016/2018 (328), 2019 (80), 2023 (14), Aug 2024 (156).
   - herb–drug and viruddha (kept, recalibrated).
   - statutory: E(1) by ingredient, H1, X.
3. **One severity scale with a clear meaning:**
   - *Stop*: needs a typed reason, which is stored in the signed record.
   - *Warn*: inline, no block.
   - *Info*: in the summary only.
   Every rule has one severity, one citation and one suggested action. CI rejects duplicates and
   contradictions.
4. **Benchmark gate** (`npm run eval:safety`): Appendix A grown to ~150 cases with a pharmacologist,
   frozen like `eval:matcher`, with the targets in §1.4.
5. **Override analytics:** per-rule override rate and reasons. Rules overridden >90% of the time are
   reviewed for demotion (the documented fix for alert fatigue).
6. **Honest UI:** "✓ Checked: age, eGFR, pregnancy, allergy (penicillin), 4 of 5 medicines ·
   ⚠ Not checked: 'Calcirol sachet' (not in database), weight".

---

## 5. Target desk, area by area

### 5.1 Layout

- A **sticky safety banner**: name/age/sex/weight, token, **allergies in red**, pregnancy/lactation,
  eGFR with source and date, NEWS2 (with missing parameters named), anticoagulant/insulin/
  antiepileptic on board.
- **Three zones:** queue (collapsible rail at 1366 px), **brief** (30-second read: reason for visit
  in the patient's words, red flags, *what changed since last visit*, last prescription and whether
  it was dispensed), **pad** in clinical order: Diagnosis → Tests → Medicines → Advice/follow-up →
  Sign.
- Scribe as a toolbar button; SOAP as a tab of the pad.

### 5.2 Queue

Calling a patient claims them (`IN_CONSULTATION` + `claimed_by`). Columns: token, wait, priority,
reason, visit type (new / follow-up / refill / **pharmacy referred back**), language. A **"seen
today"** list for reprint and amend. Scan & Share tokens feed the queue (registration waits reported
down from 30–40 to 5–10 min).

### 5.3 Diagnosis (the doctor's, dual-coded)

Search NAMASTE + ICD-11 MMS + **ICD-11 TM2** (529 categories, on the WHO portal since Feb 2025) via
the existing `/api/abdm/namaste/search`. The kiosk suggestion is a chip to accept, never the
default. A vaidya records both an Ayurvedic and a biomedical diagnosis, the Ministry's stated purpose
for TM2. Store provisional/final and `source`.

### 5.4 Prescribing

- **Generic first, printed in CAPITALS, salt always shown.** That is the operative 2002 MCI rule
  1.5; the stricter NMC 2023 rule is on hold. It also defeats India's specific LASA problem:
  identical brand names on different salts.
- **`1-0-1` notation as the primary frequency input.** It is how Indian prescriptions are written
  (morning-noon-night). It maps one-to-one onto sun/noon/moon pictograms and unambiguous regional
  text, plus a food relation (before/after/empty stomach) and duration. The quantity is calculated
  (e.g. 1-0-1 × 5 days = 10 tablets) for the pharmacy.
- **Order sets from national protocols** (the P1 engine):
  - *Hypertension:* the **IHCI protocol** (amlodipine 5 → 10 mg / + telmisartan 40 → 80 mg /
    + chlorthalidone; telmisartan first-line in CKD). In Punjab and Maharashtra, 70–81% of
    patients *who returned for follow-up* were controlled. That is observational, and dropout was
    large. One click picks the patient's next step, and the desk shows "step 2 of 5".
  - *Allopathy:* **ICMR Standard Treatment Workflows** (125 workflows across 23 specialties,
    2019/2022, plus 32 more in 2024) as the source for fever, AGE, UTI, URTI, diabetes,
    hypothyroidism.
  - *Ayurveda:* the **Ministry of Ayush Ayurvedic Standard Treatment Guidelines (2017)**. They are
    reusable free of charge for non-profit use, which makes them the natural source for vaidya order
    sets (formulation, dose, anupana, kala, pathya).
- **Favourites** learned from the doctor's own signed prescriptions; **repeat last Rx** for
  follow-up and refill visits.
- **Antibiotics:** AWaRe tag; indication required for every antibiotic (MoHFW 2024 request); a
  reason for Watch or Reserve; H1 flag passed to the pharmacy register.
- **Quick picks** = the doctor's top items. Never high-alert drugs at fixed default doses (D14).
  Warfarin and insulin open a dose field with no default.

### 5.5 Ayurveda depth (what makes the vaidya desk credible)

- **Clinician-recorded Ashtavidha Pariksha** (Nadi, Mutra, Mala, Jihva, Shabda, Sparsha, Drik,
  Akriti) and **Dashavidha** fields, separate from the kiosk's *patient-reported* Prakriti/Agni.
  Today the desk shows only the four kiosk fields. Then **samprapti ghataka** (dosha, dushya,
  srotas, srotodushti). This mirrors institutional case sheets (e.g. ITRA Jamnagar) and the CARE-
  based case-report formats the AIIA journal asks for.
- **Prescription row:** formulation + **classical reference** + dose + **anupana** + **aushadha
  sevana kala** (time of intake) + duration. That is exactly what the AIIA journal requires when
  reporting treatment.
- E(1) caution label by ingredient (D15); pregnancy flags by ingredient.
- Pathya/apathya checked against the interaction engine (D18).

### 5.6 Documentation and scribe

The best 2025 randomized evidence (UCLA, 238 doctors, ~72k visits): one scribe cut note time by
9.5%; the other had no significant effect; clinically significant inaccuracies were "occasional".
So: **doctor-only push-to-talk dictation by default** (this project's own speech measurements also
favour a close-talk microphone and push-to-talk). Ambient mode only with per-patient consent. If
ambient, real diarization (sherpa-onnx + pyannote segmentation-3.0, MIT) instead of the keyword
guess. The transcript is tied to the session (D8). Dictated orders become rows marked "from
dictation — confirm"; medicines the patient mentions go to *current medicines* (D13).

### 5.7 What the patient takes home

`1-0-1` pictograms plus regional text: an Indian RCT (Braich 2011) showed better adherence with
pictograms; they work best with spoken counselling, and only dose/frequency/route icons test
reliably. Timing qualifiers kept (D16). Follow-up as a date. "Come back at once if…" per diagnosis.
QR signature check. Large print for older patients. **Bhashini** (MeitY) is a candidate for advice
translation (the Ministry of Ayush has an MoU with it). Its API terms and quotas weren't confirmed;
keep the reviewed phrase tables for dose instructions either way.

---

## 6. Legal and regulatory checklist (India)

| Requirement | Status in desk | Action |
|---|---|---|
| Generic names, legible, preferably in capitals (MCI 2002 reg. 1.5; NMC 2023 Rule 8 on hold; HC Aug 2025 on legibility) | Brand-style names allowed; mixed case | Generic-first, capitals on print |
| Prescriber name, qualification, registration no. on Rx | Present (free text) | Add **HPR ID** (ABDM Healthcare Professionals Registry) and the facility's HFR ID |
| **Legal e-signature.** Under the IT Act a legally recognised e-signature is a licensed-CA DSC or Aadhaar **eSign**. Telemedicine Practice Guidelines (2020) allow e-prescriptions. | Ed25519 seal (integrity proof, not a recognised e-signature) | Keep Ed25519 as the tamper seal; **add eSign/DSC** for the legal signature; say this precisely to judges. *Get legal confirmation; sources are secondary.* |
| Schedule X / NDPS drugs can't be prescribed via teleconsultation | No class awareness | Flag X/NDPS; block in teleconsult mode |
| Schedule H1 register at the pharmacy | Not passed | H1 flag + quantity to pharmacy |
| Banned FDCs (Sec. 26A notifications) | Not checked (benchmark) | Hard stop |
| **TB notification is mandatory** (2012 gazette; Nikshay; penal provisions since 2018, now under BNS) | None | When TB is diagnosed or anti-TB drugs are prescribed, prompt a Nikshay notification with pre-filled data |
| IDSP/IHIP syndromic reporting | `getSyndromicSignals` exists in analytics | Export the S-form weekly counts from coded diagnoses |
| ADR reporting (PvPI form v1.4; **Ayush Suraksha** portal for ASU drugs, launched 30 May 2025) | None | "Report suspected reaction" pre-fills the right form |
| **DPDP Act + Rules 2025** (notified Nov 2025; most duties from ~May 2027; children's data needs guardian consent with a health-care exemption) | Consent exists for ABDM linking and SMS | Per-patient consent for ambient recording; purpose-limited retention of transcripts; plan for the 2027 duties |

---

## 7. National programmes the desk should plug into

| Programme | Hook in the desk |
|---|---|
| **ABDM** | PrescriptionRecord (NRCES, PCI-aligned) alongside OPConsultRecord; HPR/HFR identifiers; care-context linking (exists); Scan & Share queue. DHIS incentive (₹20 per extra transaction) was extended to 30 Jun 2025; no later extension found. |
| **IHCI / NP-NCD** | Hypertension and diabetes protocol order sets; "step" tracking; BP-controlled flag per visit (the IHCI indicator) |
| **NTEP / Nikshay** | Mandatory TB notification prompt |
| **IDSP / IHIP** | Syndromic counts from coded diagnoses |
| **PvPI / Ayush Suraksha** | ADR reporting from the prescription row |
| **ICMR STWs; Ayurvedic STGs** | Order-set content |
| **AMR (AWaRe, Red Line campaign)** | Antibiotic indication, AWaRe mix on the doctor's quality panel |
| **Bhashini** | Advice translation (verify terms) |

---

## 8. How success is measured (product metrics)

The database already stores `consult_started_at` and `completed_at`.

| Metric | Target |
|---|---|
| Safety benchmark sensitivity / false criticals | ≥ 95% / 0 |
| Drug-name coverage of NLEM | ≥ 95% |
| Screen time per patient (open → signed) | ≤ 45 s routine follow-up, ≤ 90 s new patient |
| Interruptive alerts per 100 prescriptions; override rate per rule | Falling; no rule > 90% overridden without review |
| WHO/INRUD indicators: medicines per encounter (WHO 1.6–1.8), % generic (100%), % antibiotic (20–26.8%), % injection, % NLEM; AWaRe Access share (≥ 60%) | Shown per doctor and per hospital. Indian OPD audits: 2.3–4.9 medicines, 1–66% generic. |
| Repeat-Rx and order-set use | Rising (proxy for speed) |
| Prescriptions dispensed as written (pharmacy loop) | Rising |

---

## 9. Remove before judges see it

- `namasteCode` on medicines (invented `AYU-*` codes; NAMASTE codes diagnoses).
- "AIIA Safe Alternative" labels and hardcoded swaps.
- The browser's offline alert substitution and placeholder `bayesFactorBF10` / "hypergraph" values in
  `api.ts`.
- Scribe "Doctor (Desk) / Patient (Far-Field)" keyword labels and "whisper detected".
- The "resolve 100% of open-world drugs" comment in the ontology.
- "Interaction check on" without coverage (D17).
- Demo-trigger quick picks (D14).

---

## 10. Roadmap and acceptance gates

**Phase 0: truth in safety (first; nothing else is safe without it)**
Drug dictionary + NLEM import; allergy, duplicate, dose, child, older-adult and banned-FDC rule
families; severity recalibration and de-duplication; ingredient-based E(1); `eval:safety` gate.
*Gate:* §1.4 targets on the expanded benchmark; the existing backend suite and e2e still pass.

**Phase 1: desk safety flow**
D1–D8, D13, D17, D18. Live check with `sessionId` for any list; tiered rendering; acknowledgement
with reasons stored in the signed record; no "print without saving" while a Stop is open; scribe
per session.
*Gate:* e2e: allergic patient + amoxicillin → red row → sign requires a reason → reason appears in
the signed record and on the pharmacy view.

**Phase 2: clinical record**
D9–D12. Dual-coded diagnosis; tests; notes tab; full vitals; patient timeline endpoint; "what
changed"; Ashtavidha/Dashavidha capture.

**Phase 3: speed**
`1-0-1` entry with quantity; IHCI/STW/Ayurvedic STG order sets; favourites; repeat-Rx; claim-on-call;
persisted drafts; seen-today; pharmacy referred-back loop; shortcuts; sound off by default. D14, D16.
*Gate:* median screen time per routine follow-up ≤ 45 s in a scripted run.

**Phase 4: national integration**
PrescriptionRecord + HPR/HFR; eSign; Nikshay prompt; IHIP export; PvPI / Ayush Suraksha; AWaRe +
INRUD dashboard; pictogram print; Bhashini (if terms allow).

---

## 11. A 3-minute demo that proves it (after Phase 0–1)

1. **Rekha Devi, 31, 28 weeks pregnant, penicillin allergy, on levothyroxine**, with a sore throat.
   The banner shows all of it before any click.
2. The doctor types `/amox` → **Stop**: "Allergy: penicillin (rash). Amoxicillin is a penicillin."
   Picks azithromycin; the **AWaRe: Watch** tag asks for an indication.
3. Adds `Aceclofenac 50 mg + Paracetamol 125 mg` → **Stop**: "Banned FDC — S.O. 3285(E)–3440(E), Aug 2024".
   (Written without strengths it is a **Warn**, "confirm the strength": only the 50/125 mg combination is banned.)
4. The vaidya adds a formulation containing Pippali → **Warn**: pregnancy caution by ingredient,
   with the AFI reference.
5. The line under the pad reads "✓ Checked against pregnancy 28 wk, allergy, 3 of 3 medicines".
6. Sign (eSign) → prescription in Hindi with `1-0-1` pictograms and "खाली पेट" (empty stomach) kept
   for levothyroxine. The pharmacy verifies the seal. `npm run eval:safety` shows the benchmark
   score on screen.

Every claim in that script is checkable in code, the signed record and the benchmark.

---

## 12. Implementation log (2026-10-09 → 10)

### 12.1 Measured results

| Check | Before | After |
|---|---|---|
| Original 43-case HTTP benchmark (Appendix A, written before the rebuild) — dangers caught | 7/34 | **34/34** |
| Same — common combinations without a wrong critical alert | 4/9 | **9/9** |
| In-repo benchmark `npm run eval:safety` (152 cases: 116 must-catch, 36 benign) | — | **152/152**, 0 false STOP |
| Doctor-desk HTTP battery (`tests/desk_http.test.ts`) | — | **41/41** |
| Backend suite (`npm test`, 28 batteries) | 25 batteries | **28/28** (run 2026-10-10 01:50) |
| End-to-end (`e2e`, Playwright) | 13 | **15/15** (2 new desk tests) |

Results files: `docs/evidence/doctor_desk_safety_bench_2026-10-09.json` (before), `…_after.json`,
`…_2026-10-10.json` (re-run after the last changes). The 152-case set was written alongside the engine,
so it shows that rules behave as intended; the 43-case set predates the rebuild and is the fairer test.
Neither replaces review by a clinical pharmacologist / the hospital Drugs & Therapeutics Committee
(every alert response says so).

### 12.2 What was built

**Phase 0 — safety engine** (`backend/src/services/safety/`)
- Drug dictionary of ~300 generics and common Indian brands with ATC, class, AWaRe, schedule (H/H1/X/NDPS), NLEM,
  pregnancy / lactation / renal / paediatric / older-adult data, maximum daily dose; fixed-dose combinations
  resolved to their ingredients; rabies vaccine, rabies immunoglobulin and Td for post-exposure prophylaxis.
- Ayurvedic formulary of 108 formulations with constituents; Schedule E(1) by ingredient (not by the word "Ras"
  or "Rasayana"); herb flags (antiplatelet, guggulsterone, glycyrrhizin, piperine, alcohol, calcium, …).
- Rule families: allergy with cross-reactivity; duplicate ingredient / class; ~45 drug–drug pairs; list-level stacks
  (triple whammy, bleeding stack counted by distinct agent, sedative and serotonergic load); herb–drug (one alert
  per herb and drug, naming every formulation that carries the herb); pregnancy, lactation, renal, paediatric
  (mg/kg), Beers 2023; drug–disease; dose ceilings; banned FDCs (Aug 2024 and Jun 2023 notifications,
  strength-aware); Schedule E(1), H1, NDPS, teleconsultation limits; AWaRe with mandatory indication.
- Three tiers: **Stop** (needs a typed reason, sealed into the record, shown to the pharmacist), **Warn** (inline),
  **Info** (summary). Medicines the patient only reports taking are capped at Warn. Every alert carries its
  lines, family, evidence level and source.
- Severity recalibration of the older layers (e.g. digoxin + metoprolol, VKA + guggulu, RAAS + NSAID are Warn).

**Phase 1 — desk safety flow**: live check of the whole list with the patient's context (age, pregnancy,
lactation, eGFR, weight, allergies, conditions, reported medicines); "Checked against …" and "Not on file …" line;
lines not in the database are marked "not checked" and never shown as safe; offline shows "Not checked" instead of
fake results; sign dialog collects reasons per Stop group and antibiotic indications inline; the server re-checks
and refuses to sign (422) until every Stop has a reason; pharmacy view shows each reason next to its alert.

**Phase 2 — clinical record**: diagnosis picker (ICD-10 / SNOMED CT; placeholder NAMASTE codes are marked
unverified and not printed as codes; codes re-derived from the ontology at signing); investigations with LOINC
where certain; full vitals (RR, AVPU, O₂, weight, sugar, height) and NEWS2 with missing parameters named; patient
timeline and "since last visit"; Ashtavidha / Dashavidha / Samprapti capture; sticky safety banner.

**Phase 3 — speed**: `1-0-1` entry with food timing, days and computed quantity; order sets (IHCI hypertension 6
steps, ICMR-style allopathy sets, NRCP animal bite category II/III, 7 Ayurvedic STG sets), favourites, repeat last
prescription, save as my set; claim on call; drafts saved on the server; Waiting / Seen today; pharmacy
"referred back" loop with a note; keyboard (`/`, Ctrl/⌘+Enter, `[` `]`); sounds off by default except emergencies;
Enter in the medicine search waits for results instead of adding unchecked text.

**Phase 4 — national integration**: NRCES OPConsultRecord + PrescriptionRecord (Composition 440545006);
practitioner HPR ID and facility HFR ID when configured; draft ABDM preview (status "preliminary", nothing sent);
Nikshay prompt for TB and IHIP prompt for animal bites, each with a reference field; PvPI / Ayush Suraksha
ADR report; WHO/INRUD + AWaRe prescribing-quality panel; IHIP weekly counts; print with generic name in capitals,
pictograms, quantity, allergies, diagnosis, tests, follow-up date and patient-language instructions; Bhashini as
translation fallback when credentials are set.

**Corrections found while verifying** (2026-10-10): 9 wrong SNOMED CT codes in the Ayush ontology (one pointed to
"Student", three did not exist) — all codes now checked against tx.fhir.org; ICD-10 `N05` → `N05.9`; "CCIM" →
"NCISM" (CCIM was replaced in 2021); allergy status read from the interview's own section status; a patient record
that fails to load hides the pad (with Retry) instead of letting the doctor prescribe without context; re-opened
demo visits no longer inherit earlier signed encounters (nothing deleted).

### 12.3 What still needs people or agreements (not code)

| Item | Why it is not done in code | What is ready |
|---|---|---|
| Legal e-signature (Aadhaar eSign / DSC) | Needs an agreement with a licensed eSign Service Provider | `ESignService` seam; the print says the Ed25519 seal is tamper-evident, not a legal signature |
| Bhashini translation | Needs registered API credentials | Client and fallback wired (`BHASHINI_*` env) |
| Official NAMASTE / ICD-11 TM2 codes | Needs the official export | Placeholder codes are marked unverified; another session is building `scripts/import-namaste.ts` |
| Nikshay / IHIP submission | No public API | Prompt, reference number and weekly counts |
| Clinical sign-off | Needs a clinical pharmacologist / DTC | All rules are in readable tables with sources; every response says "requires DTC review" |
| HFR facility ID, staff HPR IDs | Issued by NHA to the real facility and staff | `HFR_FACILITY_ID` env; HPR ID field on each staff account (validated) |

### 12.4 Known limits

- The dictionary covers common OPD medicines, not the whole Indian market; anything else is shown as "not in the
  safety database" and is not checked.
- Herb–drug evidence is mostly case reports and pharmacology; each alert states its evidence level.
- Dose checks need a written strength; "1 tab" of an unknown strength is not checked.
- Placeholder NAMASTE aCodes still appear inside the FHIR bundle as a coding (the record also carries ICD-10 and
  SNOMED CT); they will be replaced by the official import.

---

## Appendix A: Safety benchmark, 2026-10-09 run

Script: `docs/evidence/doctor_desk_safety_bench.mjs`. Raw results:
`docs/evidence/doctor_desk_safety_bench_2026-10-09.json`. Read-only; needs the dev backend and the
session id of a penicillin-allergic patient.

| Result | Kind | Case | Alerts returned |
|---|---|---|---|
| FAIL | MUST | Warfarin + ibuprofen | none |
| FAIL | MUST | Warfarin + diclofenac | none |
| FAIL | MUST | Warfarin + metronidazole | none |
| FAIL | MUST | Warfarin + fluconazole | none |
| FAIL | MUST | Simvastatin + clarithromycin | none |
| FAIL | MUST | Sildenafil + isosorbide mononitrate | none (rule exists; nitrate not recognised) |
| FAIL | MUST | Tizanidine + ciprofloxacin | none |
| FAIL | MUST | Methotrexate + cotrimoxazole | none (rule exists; cotrimoxazole not recognised) |
| PASS | MUST | Tramadol + sertraline | critical |
| FAIL | MUST | Spironolactone + enalapril | none |
| PASS | MUST | Lithium + ibuprofen | critical |
| FAIL | MUST | Azathioprine + allopurinol | none |
| FAIL | MUST | Theophylline + ciprofloxacin | none |
| FAIL | MUST | Rifampicin + oral contraceptive | none |
| FAIL | MUST | Ibuprofen + diclofenac (duplicate) | none |
| FAIL | MUST | Pantoprazole + omeprazole (duplicate) | none |
| FAIL | MUST | Penicillin allergy + amoxicillin | none |
| PASS | MUST | Pregnancy + enalapril | critical |
| PASS | MUST | Pregnancy + atorvastatin | critical |
| FAIL | MUST | Pregnancy + doxycycline | none |
| FAIL | MUST | Pregnancy + sodium valproate | none |
| FAIL | MUST | Pregnancy + misoprostol | none |
| PASS | MUST | eGFR 20 + metformin | critical |
| FAIL | MUST | eGFR 20 + nitrofurantoin | none |
| FAIL | MUST | eGFR 25 + diclofenac | none |
| FAIL | MUST | Age 6 + aspirin | none |
| FAIL | MUST | Age 8 + codeine | none |
| FAIL | MUST | 13 kg child + paracetamol 650 mg TDS (~150 mg/kg/day) | none |
| FAIL | MUST | Age 78 + glibenclamide | none |
| FAIL | MUST | Banned FDC aceclofenac + paracetamol | none |
| FAIL | MUST | Banned FDC cetirizine + paracetamol + phenylephrine | none |
| PASS | MUST | Digoxin + Yashtimadhu | critical ×2 (duplicate rules) |
| PASS | MUST | Metronidazole + Draksharishta | critical ×2 |
| FAIL | MUST | Sutshekhar Ras → Schedule E(1) | none |
| FAIL | BENIGN | Aspirin + ginger juice | critical |
| FAIL | BENIGN | Metformin + Nisha Amalaki | critical (registry also says SAFE) |
| PASS* | BENIGN | Sitopaladi + honey + ghee (classical anupana) | incompatibility (*not critical, but shown red on the desk*) |
| FAIL | BENIGN | Fluoxetine + Jatamansi | critical (Jatamansi ≠ St John's wort) |
| FAIL | BENIGN | Ciprofloxacin + Praval Pishti | critical + warning (spacing issue) |
| PASS | BENIGN | Telmisartan + amlodipine | none |
| PASS | BENIGN | Metoprolol + digoxin | none (only because metoprolol isn't recognised; the dormant rule is critical) |
| FAIL | BENIGN | Telmisartan + ibuprofen (3 days) | critical |
| PASS | BENIGN | Ashwagandha Rasayana not E(1) (backend) | none (the *frontend/pharmacy regex* does flag it, D15) |

Drug-name coverage (same date): desk formulary **9/14** resolve; common OPD generics **10/30**.

---

## Appendix B: Sources

**Indian OPD workload**
- [Patna IGIMS clinics](https://www.ijcmph.com/index.php/ijcmph/article/view/5276)
- [Kolkata OPD](https://www.ijcmph.com/index.php/ijcmph/article/view/11281)
- [Pune OPD](https://www.jcdr.net/articles/PDF/18384/63538_CE[Ra1]_F(SS)_QC(KK_OM)_PF1(AG_OM)_PFA(AG_KM)_PN(KM).pdf)
- [CAG Jharkhand district hospital audit](https://cag.gov.in/uploads/download_audit_report/2018/Final%20JHK-District%20Hospital%202018-19_English-06231b6744648c7.93661481.pdf)

**Decision support and alert fatigue**
- [Overridden alerts review, JMIR 2020](https://medinform.jmir.org/2020/7/e15653/)
- [DDI override meta-analysis (preprint)](https://preprints.jmir.org/preprint/88578)
- [Phansalkar high-priority DDIs](https://pmc.ncbi.nlm.nih.gov/articles/PMC3422823)
- [Non-interruptive DDI list](https://psnet.ahrq.gov/issue/drug-drug-interactions-should-be-non-interruptive-order-reduce-alert-fatigue-electronic)
- [Five Rights of CDS (table)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8608279/table/T2)
- [Five Rights, HM12 session](https://www.the-hospitalist.org/?p=5388)
- ["4000 Clicks" ED study](https://ajemjournal.com/article/S0735-67571300405-1/fulltext)
- [KLM for drug order entry](https://repo.uum.edu.my/id/eprint/13510/)

**Prescribing rules and law**
- [NMC 2023 rules on hold](https://www.tribuneindia.com/news/nation/nmc-puts-generic-drugs-order-on-hold-538003)
- [NMC legibility directive](https://news.careers360.com/nmc-medical-colleges-directive-sub-committee-dtc-monitor-prescription-legible-handwriting-generic-drugs-right-to-health/amp)
- [Telemedicine guidelines analysis (SCC Online)](https://www.scconline.com/blog/post/2020/05/22/season-of-virtuals-corona-provides-impetus-to-telemedicine-guidelines-in-india-legal-challenges-going-forward)
- [E-signature vs digital signature in India (eMudhra)](https://emudhra.com/en/blog/e-signature-vs.-digital-signature-in-india-emudhra)
- [Drugs and Cosmetics Rules (consolidated)](https://www.thc.nic.in/Tripura%20State%20Lagislation%20Rules/Drugs%20and%20Cosmetics%20Rules,%201945.pdf)
- [Rule 65 draft CCTV amendment](https://medicaldialogues.in/amp/news/industry/pharma/cctv-at-pharmacies-health-ministry-proposes-surveillance-of-prescription-drug-sales-3-month-recording-mandate-179527)
- [Banned FDCs, Rajya Sabha reply](https://rsdebate.nic.in/bitstream/123456789/759034/1/PQ_267_11032025_U1406_p432_p433.pdf)
- [156 FDCs banned (Tribune)](https://www.tribuneindia.com/news/india/citing-risks-govt-bans-156-fixed-dose-combo-drugs)
- [Goa banned drug list](https://www.goa.gov.in/wp-content/uploads/2024/09/BANNED-DRUGS.pdf)
- [DPDP Rules 2025 (EY)](https://www.ey.com/content/dam/ey-unified-site/ey-com/en-in/pdf/2025/11/ey-india-dpdp-act-2023-and-rules-2025-pov.pdf)
- [DPDP Rules 2025 (SCC Online)](https://www.scconline.com/blog/?p=371058)

**Antibiotics and TB**
- [MoHFW antibiotic indication request](https://thesouthfirst.com/news/union-health-ministry-asks-doctors-pharmacists-to-indicate-reason-for-prescribing-antibiotics)
- [AWaRe justification study](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11778136/)
- [Schedule H1 enforcement](https://pmc.ncbi.nlm.nih.gov/articles/PMC8092171)
- [Nikshay notification study](https://pmc.ncbi.nlm.nih.gov/articles/PMC8729296)
- [TB non-notification penalties](https://medicaldialogues.in/attention-doctors-chemists-notify-tb-or-go-to-jail)
- [IHIP in Tripura](https://health.tripura.gov.in/integrated-disease-surveillance-programme-idsp)

**Protocols**
- [IHCI Punjab/Maharashtra results](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10959138/)
- [Punjab IHCI protocol sheet](https://resolvetosavelives.org/wp-content/uploads/2023/09/punjab-a1-hypertension-protocol.pdf)
- [ICMR STWs](https://www.icmr.gov.in/standard-treatment-workflows-stws)
- [ICMR STW Volume IV](https://biovoicenews.com/icmr-releases-its-volume-iv-of-standard-treatment-workflows-with-32-new-stws-covering-5-specialities/)
- [Ayurvedic Standard Treatment Guidelines (PDF)](https://agritech.tnau.ac.in/horticulture/pdf/Downloads_17012023_Ayurvedic%20Standard%20Treatment%20Guildelines.pdf)

**Prescribing indicators**
- [WHO/INRUD optimal values](https://bmchealthservres.biomedcentral.com/articles/10.1186/s12913-016-1932-2/tables/1)
- [Assam audit](https://research.umkc.edu/segal/publications/assessment-who-core-drug-use-indicators-government-teaching-hospital-assam-evidence)
- [Maharashtra audit](https://www.bioinformation.net/018/97320630018888.pdf)
- [JCDR 2024 audit](https://doaj.org/article/52d5ee305f684d238ff49ed017454a63)

**AYUSH**
- [ICD-11 TM2 launch](https://www.drishtiias.com/daily-updates/daily-news-analysis/icd-11-tm-module-2-launch-global-integration-of-ayush-medicine/print_manually)
- [TM2/NAMASTE, Rajya Sabha reply](https://rsdebate.nic.in/bitstream/123456789/759086/1/PQ_267_18032025_S189_p86_p87.pdf)
- [NAMASTE portal](https://en.vikaspedia.in/health/ayush/ayurveda-1/national-ayush-morbidity-codes-and-standards-portal)
- [Ayush Suraksha](https://en.vikaspedia.in/viewcontent/health/ayush/ayush-suraksha?lgn=en)
- [Ayush–Bhashini MoU](https://www.digitalhealthnews.com/ministry-of-ayush-partners-with-digital-india-bhashini-for-ai-powered-multilingual-ayush-services)
- [ITRA Bala Rugna case sheet](https://itra.ac.in/wp-content/uploads/2025/08/KB-UG-J1-Bala-Rugna-4-4-24.pdf)
- [NCISM record book](https://ncismindia.org/NCISM_II%20BAMS_AyUG-SA2%20record%20book.pdf)
- [AIIA AyuCaRe author instructions](https://aiia.gov.in/wp-content/uploads/2019/11/AyuCaRe-Updated-Author-Instructions.pdf)

**Pharmacovigilance**
- [PvPI FAQ](https://ipc.gov.in/~ajeet/ipc/mandates/pvpi/pvpi-updates/8-category-en/429-pvpi-frequently-asked-questions.html)
- [PvPI ADR form](https://website.aiimsraipur.edu.in/Downloads/ADR%20Reporting%20form%20for%20Health%20Professionals.pdf)
- [PvPI QR code directive](https://www.outlookindia.com/amp/story/healthcare-spotlight/dcgi-asks-states-to-mandate-display-of-pvpi-qr-code-at-all-pharmacies)

**ABDM**
- [NRCES PrescriptionRecord](https://nrces.in/ndhm/fhir/r4/6.0.0/StructureDefinition-PrescriptionRecord.html)
- [NRCES Practitioner](https://nrces.in/ndhm/fhir/r4/6.0.0/StructureDefinition-Practitioner-definitions.html)
- [Scan & Share (MoHFW)](https://mohfw.gov.in/press-info/7908)
- [DHIS financial incentive policy](https://abdm.gov.in:8081/uploads/Financial_Incentive_Policy_DHIS_e96a62fd28.pdf)

**Scribes and speech**
- [UCLA scribe RCT](https://www.uclahealth.org/news/release/ucla-study-finds-ai-scribes-may-reduce-documentation-time)
- [UW Health trials](https://uwclinicaltrials.org/2025/12/12/studies-find-ai-technology-for-clinical-documentation-aids-efficiency-and-reduces-burnout/)
- [sherpa-onnx diarization demo](https://huggingface.co/spaces/k2-fsa/speaker-diarization/blob/main/model.py)
- [Bhashini (UNICEF)](https://www.unicef.org/digitalimpact/bhashini-ai-making-languages-more-accessible-digital-technology)

**Patients, dosing and look-alike names**
- [Pictogram trials](https://academic.oup.com/view-large/324642374)
- [Dehradun pictogram pilot](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3122047/)
- [Paediatric dosing CDS](https://hub.tmu.edu.tw/en/publications/the-effect-of-a-computerized-pediatric-dosing-decision-support-sy/)
- [PPA weight position](https://jppt.kglmeridian.com/view/journals/jppt/28/4/article-p380.xml)
- [ISMP tall-man report](https://www.ismp-canada.org/download/TALLman/TALLmanLettering-ProjectReport.pdf)
- [LASA in India](https://thesouthfirst.com/news/interview-risks-of-look-alike-sound-alike-medicines-in-india-how-to-prevent-medication-errors)

**Interaction data**
- [DDInter 2.0](https://academic.oup.com/nar/article/53/D1/D1356/7740584)
