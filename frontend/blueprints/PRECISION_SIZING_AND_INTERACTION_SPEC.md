# PRECISION SIZING, ERGONOMIC GEOMETRY & INTERACTION SPECIFICATION (VOL. III)
## The Complete Mathematical & Ergonomic Blueprint for Every Single Page, Panel & Component
**Smart India Hackathon 2026 | Problem Statement ID:** `26047`  
**All India Institute of Ayurveda (AIIA) • Ministry of Ayush & MoHFW, Government of India**  
**Document Type:** Exhaustive Component-by-Component Spatial Architecture, Sizing & Touch Ergonomics Specification  
**Governing Principles:** Zero Useless Clutter • Strict 8-Point Harmonic System • Multi-Tier Form Factor Fluidity (Phone 390px, Kiosk 10.1"-15.6", 4K PC Desktop)

---

## 1. Mathematical Spatial Foundations: The 8-Point Harmonic Scale

Every dimension, margin, padding, height, and touch boundary across all 26 frontend components is strictly governed by the **8-Point Harmonic Scale** with a **4-Point Micro-Alignment Subgrid**. Arbitrary, uncalibrated pixel values (`17px`, `23px`, `39px`) are banned.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   THE 8-POINT HARMONIC SCALE TABLE                                     │
├───────────────┬───────────────┬──────────────────────┬─────────────────────────────────────────────────┤
│ TOKEN         │ VALUE (px)    │ REM EQUIVALENT       │ CLINICAL / ARCHITECTURAL USE CASE               │
├───────────────┼───────────────┼──────────────────────┼─────────────────────────────────────────────────┤
│ --space-2     │ 2px           │ 0.125rem             │ Hairline border offsets, indicator bar dots     │
│ --space-4     │ 4px           │ 0.250rem             │ Micro gap between icon and counter tag          │
│ --space-8     │ 8px           │ 0.500rem             │ Internal pill button padding, compact chip gap │
│ --space-12    │ 12px          │ 0.750rem             │ Standard card internal vertical padding         │
│ --space-16    │ 16px          │ 1.000rem             │ Base content padding on phone viewports         │
│ --space-24    │ 24px          │ 1.500rem             │ Section gap, desktop card padding               │
│ --space-32    │ 32px          │ 2.000rem             │ Kiosk stage gutter, column gaps on desktop      │
│ --space-48    │ 48px          │ 3.000rem             │ Primary touch target height, stage margins      │
│ --space-56    │ 56px          │ 3.500rem             │ Topbar height, standing kiosk primary button    │
│ --space-64    │ 64px          │ 4.000rem             │ Dynamic Island dock height, queue row height    │
│ --space-80    │ 80px          │ 5.000rem             │ Bottom scroll clearance for persistent dock     │
│ --space-96    │ 96px          │ 6.000rem             │ Maximum hero callout margin on 4K displays      │
└───────────────┴───────────────┴──────────────────────┴─────────────────────────────────────────────────┘
```

---

## 2. Dynamic Fluid Sizing Formulas (CSS `clamp()`)

Typography and container boundaries scale fluidly between **Mobile Phone ($390\text{px}$)** and **4K Desktop ($1920\text{px}-3840\text{px}$)** without breakpoint snapping:

$$\text{clamp}\left(V_{\min},\; V_{\min} + (V_{\max} - V_{\min}) \cdot \frac{\text{vw} - 390\text{px}}{1530\text{px}},\; V_{\max}\right)$$

```css
:root {
  /* Fluid Typographic Scale */
  --font-hero: clamp(1.75rem, 1.25rem + 2.1vw, 2.75rem);       /* 28px -> 44px */
  --font-title-1: clamp(1.375rem, 1.15rem + 1.2vw, 2.00rem);   /* 22px -> 32px */
  --font-title-2: clamp(1.125rem, 1.00rem + 0.6vw, 1.50rem);   /* 18px -> 24px */
  --font-title-3: clamp(1.000rem, 0.95rem + 0.3vw, 1.25rem);   /* 16px -> 20px */
  --font-body: clamp(0.875rem, 0.85rem + 0.1vw, 1.00rem);      /* 14px -> 16px */
  --font-caption: clamp(0.75rem, 0.72rem + 0.1vw, 0.8125rem);  /* 12px -> 13px */
  --font-mono-data: clamp(0.8125rem, 0.78rem + 0.2vw, 0.9375rem); /* 13px -> 15px */

  /* Structural Viewport Limits */
  --stage-max-kiosk: 1040px;
  --stage-max-doctor: 1680px;
  --topbar-max-width: 1400px;
  --dock-max-width: 640px;
}
```

---

## 3. Master Form Factor Sizing Matrix

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   THREE-TIER FORM FACTOR SIZING MATRIX                                 │
├───────────────────────────────┬──────────────────────────┬─────────────────────────┬───────────────────┤
│ COMPONENT PROPERTY            │ TIER A: MOBILE PHONE     │ TIER B: TOUCH KIOSK     │ TIER C: PC 4K DESK│
│                               │ (390px - 430px Viewport) │ (10.1"-15.6" / 768-1199)│ (1200px - 3840px) │
├───────────────────────────────┼──────────────────────────┼─────────────────────────┼───────────────────┤
│ Topbar Height / Style         │ 48px (Inline Compact)    │ 56px (Floating Glass)   │ 56px (Floating)   │
│ Topbar Horizontal Margin      │ 12px                     │ 24px                    │ Auto (Max 1400px) │
│ Navigation Tab Height         │ 36px (Icon + Badge)      │ 40px (Pill segment)     │ 40px (Full label) │
├───────────────────────────────┼──────────────────────────┼─────────────────────────┼───────────────────┤
│ Kiosk Container Width         │ 100% (Edge-to-edge)      │ 92% (Max 920px)         │ Max 1040px (Cent) │
│ Kiosk Stage Internal Padding  │ 16px                     │ 24px                    │ 32px              │
│ Progress Breadcrumb Height    │ 12px (Micro segmented)   │ 16px (Segmented bar)    │ 16px (Full label) │
├───────────────────────────────┼──────────────────────────┼─────────────────────────┼───────────────────┤
│ Mannequin Width x Height      │ 160px x 340px (Stacked)  │ 220px x 460px (Side)    │ 240px x 480px     │
│ Speech Studio Width x Height  │ 100% x 260px (Stacked)   │ 1fr x 460px (Side)      │ 1fr x 480px       │
│ Audio Waveform Canvas Height  │ 48px                     │ 64px                    │ 72px              │
│ Karaoke Lyrics Font Size      │ 18px (Active line)       │ 22px (Active line)      │ 24px (Active line)│
├───────────────────────────────┼──────────────────────────┼─────────────────────────┼───────────────────┤
│ Touch Minimum Hit Area        │ 48px x 48px (Apple HIG)  │ 60px x 60px (Standing)  │ 36px x 36px (Desk)│
│ Dynamic Island Dock Height    │ 56px                     │ 64px                    │ 60px              │
│ Dynamic Island Bottom Offset  │ 12px + env(safe-area)    │ 24px                    │ 20px              │
│ Dynamic Island Max Width      │ calc(100vw - 24px)       │ 560px                   │ 600px             │
├───────────────────────────────┼──────────────────────────┼─────────────────────────┼───────────────────┤
│ Doctor Desk Layout Columns    │ 1 Column (Bottom Tabs)   │ 2 Columns (Queue Drawer)│ 3 Columns (Cockpit│
│ Left Rail (Queue) Width       │ 100% (Tab 1)             │ 280px (Collapsible)     │ 300px Fixed       │
│ Center Stage (Scribe/Vitals)  │ 100% (Tab 2)             │ 1fr                     │ 1fr Flexible      │
│ Right Rail (Dual Prescriber)  │ 100% (Tab 3)             │ 360px                   │ 380px Fixed       │
│ Doctor Bottom Dock Height     │ 52px                     │ 56px                    │ 56px              │
├───────────────────────────────┼──────────────────────────┼─────────────────────────┼───────────────────┤
│ Vitals Porcelain Tiles Grid   │ 2 x 2 (Height 72px)      │ 4 x 1 (Height 80px)     │ 4 x 1 (Height 84px│
│ Vitals Value Font Size        │ 20px (JetBrains Mono)    │ 22px (JetBrains Mono)   │ 24px (JetBrains)  │
├───────────────────────────────┼──────────────────────────┼─────────────────────────┼───────────────────┤
│ Apple Wallet Pass Width       │ 100% (Max 360px)         │ 420px                   │ 460px             │
│ Wallet Pass QR Code Size      │ 140px x 140px            │ 160px x 160px           │ 180px x 180px     │
└───────────────────────────────┴──────────────────────────┴─────────────────────────┴───────────────────┘
```

---

## 4. Deep Component-by-Component Specifications (All 22 Views & Panels)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              MASTER COMPONENT SIZING & ELIMINATION INDEX                               │
├────┬─────────────────────────────┬─────────────────────────────────────────────────────────────────────┤
│ 01 │ Floating Apex Topbar        │ Header.tsx • Unified authority, pill switcher, single telemetry     │
│ 02 │ Kiosk Funnel Container      │ KioskContainer.tsx • Apple segmented progress, Dynamic Island Dock  │
│ 03 │ Step 1: Language Gateway    │ Step1Language.tsx • 6-card Spotify grid, 32px Indic, live greeting  │
│ 04 │ Step 2: Identity Auth       │ Step2AbhaAuth.tsx • Apple Pay card, Verhoeff D5 dihedral SVG ring   │
│ 05 │ Step 3: Voice & Body Intake │ Step3VoiceBodyIntake.tsx • Holographic Vector Mannequin + Karaoke   │
│ 06 │ Step 4: Pain & SOCRATES     │ Step4Socrates.tsx • Control Center pill slider, Wong-Baker FACES    │
│ 07 │ Step 5: Ayush Pariksha      │ Step5Pariksha.tsx • Minimalist doshic dials, Agni matrix            │
│ 08 │ Step 6: Optical Scanner     │ Step6DocumentScanner.tsx • Cyan laser sweep, client-side OCR        │
│ 09 │ Step 7: OPD Boarding Pass   │ Step7TokenSummary.tsx • Apple Wallet pass, scannable ABHA QR        │
│ 10 │ Doctor Desk Cockpit         │ DoctorDeskContainer.tsx • 3-column panoramic layout, bottom dock    │
│ 11 │ Patient Queue Tracklist     │ PatientQueueList.tsx • Spotify tracklist rows, wait timers, beacons │
│ 12 │ Clinical Pre-Intake Panel   │ PreIntakePanel.tsx • Apple Health vitals tiles, doshic radar        │
│ 13 │ Ambient Speech Scribe       │ AmbientScribePanel.tsx • 60fps canvas waveform, karaoke captioning  │
│ 14 │ Dual-Pharmacology Prescriber│ DualPharmacologyPrescriber.tsx • Allopathic + Ayush, Bayesian clash │
│ 15 │ Emergency Alert Modal       │ ConflictAlertModal.tsx • Lethal contraindication override modal     │
│ 16 │ Statutory AIIA Rx Sheet     │ OfficialAiiaRxModal.tsx • Institutional national case-sheet         │
│ 17 │ ABDM FHIR R4 Bundle Export  │ AbdmFhirExportModal.tsx • NRCeS valid JSON bundle viewer            │
│ 18 │ OPD Triage Spatial Heatmap  │ TriageHeatmap.tsx • Bay occupancy map, crowd surge predictor        │
│ 19 │ Architecture Defense Matrix │ ArchitectureDefenseMatrix.tsx • Master 12-battery benchmark scorecard│
│ 20 │ Audio Visualizer Canvas     │ AudioVisualizer.tsx • 60fps organic canvas sine wave generator      │
│ 21 │ Emergency Red Flag Banner   │ EmergencyBanner.tsx • Preattentive crimson beacon (< 50ms detection)│
│ 22 │ Sovereign Telemetry Drawer  │ LeverModal.tsx • Zero-egress live diagnostics across all 3 Levers   │
└────┴─────────────────────────────┴─────────────────────────────────────────────────────────────────────┘
```

---

### Layer 1: Global Navigation & Foundation

#### Component 1: `Header.tsx` (Floating Apex Topbar)
- **Visual Parts:**
  1. *Brand Cluster (Left):* Official AIIA Gold Crest (`32px x 32px`) + Title `"AIIA MEDIKIOSK"` (`15px`, bold 800, white `#ffffff`) + Subtitle `"Ministry of Ayush & MoHFW • Air-Gapped OPD"` (`11px`, `#8e8e93`).
  2. *Navigation Track (Center):* Translucent frosted glass track (`height: 40px`, padding `3px`, border-radius `9999px`). 4 segmented buttons: `Patient MediKiosk`, `Doctor OPD Desk`, `Triage Heatmap`, `Defense Matrix`. Sliding active pill in pure obsidian glass (`rgba(255,255,255,0.12)`).
  3. *Sovereign Telemetry (Right):* Single whisper-quiet capsule (`height: 32px`, padding `0 12px`): `"● Air-Gapped · 3 Levers Live"` with an emerald indicator dot. Clicking it opens `LeverModal`.
- **Dimensions:** Height `56px` fixed (PC/Kiosk), `48px` (Mobile). Floating with `top: 12px; margin: 0 auto; max-width: 1400px;`.
- **Useless Eliminations:** Stripped the 3 noisy badges (`"SOVEREIGN WAL KERNEL"`, `"DPDP AIR-GAP"`, `"3 LEVERS ACTIVE"`). Stripped Wi-Fi/Cloud icons.

#### Component 2: `AudioVisualizer.tsx` (60fps Organic Canvas Audio Waveform)
- **Visual Parts:** HTML5 canvas rendering multi-harmonic organic sine waves with an emerald-to-cyan gradient (`linear-gradient(90deg, #10b981 0%, #06b6d4 100%)`). Amplitude smoothly scales with microphone volume.
- **Dimensions:** Height `72px` (PC), `64px` (Kiosk), `48px` (Mobile). Width `100%`.
- **Useless Eliminations:** Chunky bar-graph equalizers that look like 1990s stereo equipment.

#### Component 3: `EmergencyBanner.tsx` (Preattentive Clinical Emergency Alert)
- **Visual Parts:** High-contrast crimson glass banner (`background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.25)`). Contains pulsing crimson beacon dot (`8px`) + text: `"⚠️ EMERGENCY RED FLAG: Acute Substernal Angina Detected ➔ Routing to Resuscitation Bay 1"`.
- **Dimensions:** Height `44px`, padding `0 16px`, border-radius `10px`, margin `0 auto 16px auto`.
- **Useless Eliminations:** Jarring full-screen popups that lock the browser or induce panic in waiting room halls.

#### Component 4: `LeverModal.tsx` (Zero-Egress Sovereign Diagnostics Drawer)
- **Visual Parts:** Sliding frosted glass drawer (`width: 480px` on desktop, `100vw` on mobile) displaying real-time diagnostics across:
  - *Lever 1 (PiyAPI Engine):* SQLite WAL checkpoint state, causal DAG node count, Beta-Binomial update latency ($< 1.2\text{ms}$).
  - *Lever 2 (Audio Fabric):* Silero VAD speech activity, bilingual ASR confidence score ($0.982$).
  - *Lever 3 (zk-SNARK Engine):* BN128 curve Groth16 cryptographic state seal verifier.
- **Useless Eliminations:** Cluttering the doctor's primary workspace with deep engineering telemetry. The drawer is hidden until requested.

#### Component 5: `PatentBadge.tsx` (DPDP Act 2023 Statutory Seal)
- **Visual Parts:** Subtle hairline pill badge (`height: 28px`, padding `0 10px`, font-size `11px mono`) displaying the BN128 curve emblem and Verhoeff $D_5$ cryptographic seal.
- **Useless Eliminations:** Loud "PATENT PENDING" neon graphics.

---

### Layer 2: Patient MediKiosk Components (Steps 1 to 7)

#### Component 6: `KioskContainer.tsx` (Funnel Orchestrator & Dynamic Dock)
- **Visual Parts:**
  1. *Progress Tracker (Top):* 7-segment Apple progress bar (`height: 4px`, gap `6px`, border-radius `9999px`). Active stage blooms with emerald glow.
  2. *Central Stage (Middle):* Max width `1040px`, centered. Stage transitions use smooth opacity (`300ms`) and `translateY(12px) ➔ translateY(0)`.
  3. *Dynamic Island Action Dock (Bottom):* Floating rounded dock (`height: 64px`, max-width `580px`, margin `0 auto 24px auto`) housing `[ ‹ Back ]`, step counter (`"चरण 3 / 7"`), and `[ Continue › ]`.
- **Useless Eliminations:** Numbered circle steppers, 120px tall bottom footer panels.

#### Component 7: `Step1Language.tsx` (Multilingual Sovereign Gateway)
- **Visual Parts:**
  - 6-card Spotify-grade tactile grid: हिन्दी, English, मराठी, বাংলা, தமிழ், తెలుగు.
  - Native scripts in **`32px` bold** (`line-height: 1.5` to prevent matra clipping). Transliteration in `14px`.
  - Hover/tap acoustic greeting (`"नमस्ते! कृपया अपनी भाषा चुनें"`) with canvas mini-waveform.
- **Dimensions:** Card min-height `140px`, padding `20px`, border-radius `16px`.
- **Useless Eliminations:** National flags, dense explanatory paragraphs, 14px dropdown menus.

#### Component 8: `Step2AbhaAuth.tsx` (Sovereign Identity Verification)
- **Visual Parts:**
  - Apple Pay-style credential card (`460px x 260px`, border-radius `20px`) with national emblem watermark.
  - Input field for 14-digit ABHA or 12-digit Aadhaar with auto-formatting (`91-2481-9920-1124`).
  - Verhoeff $D_5$ Dihedral Ring: Circular SVG (`48px x 48px`) that spins and locks into an emerald checkmark in $< 1\text{ms}$ upon entering the 12th digit.
  - Discreet Jury Presets: `[ Ramesh Kumar • Acute Angina ]` | `[ Sunita Devi • Sandhivata ]`.
  - Fast Anonymous Walk-In link for trauma cases.
- **Useless Eliminations:** 15 manual demographic form fields, SMS OTP countdown timers.

#### Component 9: `Step3VoiceBodyIntake.tsx` (Voice & Anatomical Mannequin Intake)
- **Visual Parts:**
  - Split Dual-Pane: Left = Holographic Precision Vector Mannequin; Right = Speech Studio.
  - Holographic Mannequin: Symmetrical vector silhouette (`viewBox="0 0 240 500"`, height `460px`). Front/Back 180° 3D flip toggle pill. 5 calibrated hit targets:
    - *Head & Neck (Shira):* Center `(120, 48)`, radius `36px`.
    - *Chest (Precordium / Hridaya):* Center `(120, 128)`, radius `38px`.
    - *Epigastrium (Kukshi):* Center `(120, 182)`, radius `34px`.
    - *Pelvis / Lower Back (Kati):* Center `(120, 236)`, radius `34px`.
    - *Knees & Joints (Janu / Sandhi):* Centers `(88, 348)` & `(152, 348)`, radius `40px`.
  - Speech Studio: 60fps canvas audio waveform + Apple Music Live Karaoke Lyrics stream (active spoken phrase blooms in pure white `#ffffff` with text-shadow glow; preceding lines dim to `32%`) + auto-extracted clinical entity pill tags.
- **Useless Eliminations:** 30MB 3D WebGL meshes that crash Raspberry Pi browsers, 2D cartoon clipart stick figures, manual typing textareas.

#### Component 10: `Step4Socrates.tsx` (SOCRATES Pain Precision Matrix)
- **Visual Parts:**
  - iOS Control Center Tactile Pain Slider: Thick rounded pill track (`height: 52px`, border-radius `9999px`) filling with emerald (1-3) ➔ amber (4-6) ➔ crimson (7-10). Value in giant `36px` bold JetBrains Mono.
  - Animated Wong-Baker FACES dial: Morphs from relaxed smiling green (0) to neutral amber (5) to crying red tears (10).
  - SOCRATES Structured Pill Toggles: Site, Onset (Sudden/Gradual), Character (Crushing/Burning/Stabbing), Radiation (Left Arm/Neck/Back/None).
  - Emergency Red Flag Trigger: Pain $\ge 8$ + Left Arm radiation automatically triggers preattentive crimson banner.
- **Useless Eliminations:** Thin 2px wire sliders with tiny 10px dots that arthritic fingers miss.

#### Component 11: `Step5Pariksha.tsx` (Ayurvedic Dashavidha Pariksha)
- **Visual Parts:**
  - Prakriti & Vikriti Dials: Vata, Pitta, Kapha, and Dwandwaja balance chips.
  - Agni Functional Matrix: 4 tactile cards pairing Sanskrit terms with functional medicine (Samagni = Optimal Metabolism, Vishamagni = Irregular Vata, Tikshnagni = Hyperactive Pitta, Mandagni = Sluggish Kapha).
  - Sara & Satva Resilience Toggles: High (Pravara), Medium (Madhyama), Low (Avara).
- **Useless Eliminations:** Dense Sanskrit shloka paragraphs, 40-question pulse diagnosis checklists.

#### Component 12: `Step6DocumentScanner.tsx` (Optical Document Scanner)
- **Visual Parts:**
  - High-tech optical viewfinder (`height: 280px`, border-radius `16px`) with cyan corner brackets and animated vertical cyan laser sweep line (`height: 2px`, `box-shadow: 0 0 16px #06b6d4`).
  - Client-side Tesseract OCR progress ring ($< 2.5\text{s}$ parse time).
  - Structured Lab Results Output Card: Auto-parsed abnormal values flagged with high-contrast badges (e.g. *eGFR: 24 mL/min - Severe Renal Impairment* in red, *HbA1c: 8.2%* in amber).
- **Useless Eliminations:** Forcing manual typing of past prescriptions, clunky full-page PDF readers.

#### Component 13: `Step7TokenSummary.tsx` (Apple Wallet OPD Boarding Pass)
- **Visual Parts:**
  - Apple Wallet PKPass Geometry (`width: 420px`, border-radius `20px`) with semicircular side cutouts and perforated tear line (`border-top: 2px dashed rgba(255,255,255,0.15)`).
  - Token Number: Giant `44px` bold JetBrains Mono (`KAYA-042`).
  - Metadata Grid: Allocated Department (`Kayachikitsa OPD 104 • Room 12`), Attending Physician, Wait Time (`08 mins`), Triage Priority Badge.
  - High-Contrast Optical QR Code: High-contrast white background container (`160px x 160px`) for instant acquisition by handheld hospital barcode scanners.
  - Actions: `[ 🖨️ Print Slip (Thermal / A4) ]` + `[ Proceed to Doctor Desk › ]`.
- **Useless Eliminations:** Generic web checkmarks, confusing hospital administrative fine print.

---

### Layer 3: Doctor OPD Desk Panoramic Cockpit

#### Component 14: `DoctorDeskContainer.tsx` (3-Column Pro Clinical Cockpit)
- **Visual Parts:** Full-bleed 100vw panoramic layout:
  - Left Rail (`300px` fixed): `PatientQueueList.tsx`
  - Center Stage (`1fr` flexible): Upper = `PreIntakePanel.tsx`, Lower = `AmbientScribePanel.tsx`
  - Right Rail (`380px` fixed): `DualPharmacologyPrescriber.tsx`
  - Bottom Action Dock (`56px` fixed): Persistent active patient banner, triage status, `[Export ABDM FHIR R4]`, and `[FINALIZE & PRINT OFFICIAL AIIA RX]`.
- **Useless Eliminations:** Multi-tab navigation that forces doctors to switch tabs during a 90-second consult.

#### Component 15: `PatientQueueList.tsx` (Spotify-Style Tracklist Queue)
- **Visual Parts:**
  - Triage Urgency Filter Chips: `[ All ]` | `[ Red (1) ]` | `[ Amber (2) ]` | `[ Green (4) ]`.
  - Tracklist Rows: Height `56px`, hover highlight `rgba(255,255,255,0.06)`. Monospace wait timer (`02:14`), Patient Name, ABHA ID, Triage status dot, emergency pulse beacon.
- **Useless Eliminations:** Bulky table headers and administrative insurance columns.

#### Component 16: `PreIntakePanel.tsx` (Apple Health Vitals Porcelain Tiles)
- **Visual Parts:**
  - 4 Vitals Porcelain Tiles (`grid-template-columns: repeat(4, 1fr)`, height `84px`):
    - *Blood Pressure:* `160/100 mmHg` (Tabular mono, crimson alert)
    - *Heart Rate:* `112 bpm` (Amber tachycardia)
    - *SpO2 Oxygen:* `93%` (Amber hypoxemia)
    - *Temperature:* `98.6°F` (Normal emerald)
  - Chief Complaint Card: Patient's pre-intake statement + anatomical locus summary.
- **Useless Eliminations:** Multi-page health record history dropdowns that distract from the acute consult.

#### Component 17: `AmbientScribePanel.tsx` (Ambient Speech Studio)
- **Visual Parts:**
  - 60fps canvas audio waveform visualizer (`height: 56px`).
  - Audio Input Toggle Pill: `[ 🎙️ Real Mic (Browser Speech) | 🤖 Simulated Stream ]`.
  - Bilingual Streaming Transcription with Apple Music Live Lyrics effect: Active spoken phrase blooms in pure illuminated white (`#ffffff`), past phrases dim to `32%`.
  - Auto-extracted clinical entity pill tags (`[लक्षण: सीने में दर्द]`, `[तीव्रता: 8/10]`).
- **Useless Eliminations:** Clunky manual typing textareas that force the doctor to look away from the patient.

#### Component 18: `DualPharmacologyPrescriber.tsx` (Dual Prescriber & Bayesian Conflict Interception)
- **Visual Parts:**
  - Allopathic Table (NLEM 2022): Drug name, dosage, route, frequency, duration.
  - Classical Ayush Table (NAMASTE / ICD-11 TM-2): Formulation name, dosage form, dose, Anupana (adjuvant), Aushadha Sevana Kala (timing).
  - **Inline Bayesian Conflict Interception Alert Box:**
    High-contrast crimson card flashing directly inline:
    `CRITICAL LETHAL INTERACTION: Warfarin + Yogaraja Guggulu. Mechanism: CYP2C9 metabolic inhibition & additive anticoagulation. Bayes Factor BF10 = 168.4. Recommended Action: Substitute with Rasnasaptaka Kwatha.`
- **Useless Eliminations:** Buried drug-interaction warnings that require clicking a secondary "Check Interactions" button.

#### Component 19: `ConflictAlertModal.tsx` (Emergency Contraindication Override Modal)
- **Visual Parts:** High-contrast crimson alert dialog displaying detailed pharmacological CYP450 metabolic pathway breakdown, hemodynamic consequences, and mandatory clinical justification text input before allowing an override.
- **Useless Eliminations:** Easy "Dismiss" buttons that lead to alarm fatigue and malpractice.

#### Component 20: `OfficialAiiaRxModal.tsx` (Statutory AIIA Hospital Case-Sheet)
- **Visual Parts:**
  - Authentic Government of India Emblem, Ministry of Ayush, and AIIA crest.
  - Scannable 14-digit Verhoeff ABHA QR code and NAMASTE Tri-Coding.
  - Groth16 zk-SNARK BN128 curve cryptographic state hash seal.
  - Strict `@media print` rules ensuring stark institutional black-and-white printing on standard A4 paper or 58mm thermal rolls.
- **Useless Eliminations:** Colorful web gradients on printouts that drain printer ink.

#### Component 21: `AbdmFhirExportModal.tsx` (ABDM FHIR R4 Bundle Export)
- **Visual Parts:** Clean JSON syntax tree and FHIR R4 document bundle viewer with copy and download actions, accompanied by an NRCeS statutory compliance badge.
- **Useless Eliminations:** Non-standard proprietary export formats.

---

### Layer 4: Statutory Hospital Surveillance & Benchmark Layer

#### Component 22: `TriageHeatmap.tsx` (Hospital Spatial Bay Surveillance)
- **Visual Parts:** Spatial Bay Occupancy Map (Resuscitation Bay 1, Acute Bay 2, Routine Hall) + Crowd Surge Velocity Counters (Patients/Hour, Median Wait Time) + Real-time Severity Density Chart.
- **Useless Eliminations:** Static, non-updating decorative charts.

#### Component 23: `ArchitectureDefenseMatrix.tsx` (Empirical Defense Matrix)
- **Visual Parts:** Master 12-Battery Benchmark Jury Scorecard (140,000 test cases, 1.96s runtime, 100% invariants satisfied) + Air-Gap Zero Cloud Egress Proofs + BN128 curve Groth16 zk-SNARK verifier.
- **Useless Eliminations:** Unverified marketing claims and buzzwords.

---

## 5. Summary & Verification

This Volume III specification leaves **zero ambiguities**:
- Every single screen, component, modal, and panel has its exact visual parts and dimensions specified.
- Every useless, AI-generated, and cluttered element has been identified and permanently eliminated.
- Sizing across Phone (390px), Touch Kiosk (10.1"-15.6"), and 4K Desktop is mathematically fixed.

We are ready to begin code execution on **Phase 1: Foundations & Design Tokens**.
