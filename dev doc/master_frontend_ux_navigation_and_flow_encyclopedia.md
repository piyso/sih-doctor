# Master Frontend UX, Navigation, and Flow Encyclopedia
## The Definitive Blueprint for Sovereign Clinical Consoles: Patients, Doctors, Pharmacists, ASHA Workers & Government Leadership

> **System**: AIIA Sovereign MediKiosk & Ambient OPD Scribe (Problem Statement ID: 26047)  
> **Target Form Factors**: 32" Lobby MediKiosk, BYOD Citizen Mobile Web, 27" Doctor Desktop Cockpit, High-Speed Dispensary Terminal, 10" Ruggedized Field Tablet, Multi-Screen Executive NOC.  
> **Governing Standards**: W3C WCAG 2.1 AAA, IEC 62366-1 (Medical Usability), ABDM FHIR R4, DPDP Act 2023, BNS 2023 Section 106(1), BSA 2023 Section 63.

---

## 1. Executive Architectural Philosophy: Five Dedicated Consoles

A fatal flaw in legacy healthcare software is the **"Unified Monolith Trap"**—forcing doctors, patients, pharmacists, and administrators to look at variations of the same cluttered web form.

In our production-grade architecture, each stakeholder operates inside a **completely dedicated, mathematically modeled, ergonomically isolated console**:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       THE FIVE SOVEREIGN CLINICAL CONSOLES                                             │
├───────────────────┬───────────────────────────────┬────────────────────────────────────────────────────────────────────┤
│ Console Domain    │ Primary Form Factor & Hardware│ Specialized Cognitive & Behavioral Design Mandate                  │
├───────────────────┼───────────────────────────────┼────────────────────────────────────────────────────────────────────┤
│ 1. Patient Kiosk  │ 32" Capacitive Touchscreen    │ 0-text literacy intake; 0.92x soothing voice; 1-tap Modesty Mode;  │
│    & BYOD PWA     │ & Citizen Smartphone (PWA)    │ 3D body mannequin; Wong-Baker pain faces; thermal paper token      │
├───────────────────┼───────────────────────────────┼────────────────────────────────────────────────────────────────────┤
│ 2. Doctor Cockpit │ 24"–27" Dual-Monitor Desktop  │ 4s Gestalt visual HUD; ambient bilingual voice scribe (0 typing);  │
│    (OPD Desk 2.0) │ or Laptop Chamber Station     │ dual-prescriber (ATC + AFI); 3-tier non-modal alerts; BNS defense  │
├───────────────────┼───────────────────────────────┼────────────────────────────────────────────────────────────────────┤
│ 3. Pharmacy Desk  │ POS Terminal with Optical Bar-│ 2D Aztec barcode scan gate; Look-Alike Sound-Alike (LASA) lock;    │
│    (Dispensary)   │ code Reader & Label Printer   │ regional peel-and-stick dosage labels with Anupana (500 Rx/shift) │
├───────────────────┼───────────────────────────────┼────────────────────────────────────────────────────────────────────┤
│ 4. ASHA Outreach  │ 10" Ruggedized Android Tablet │ Sunlight-readable high-contrast UI; offline IndexedDB; maternal    │
│    (Field Mode)   │ (sub-₹7,000 budget hardware)  │ RCH risk stratification; 1.8s Merkle DAG batch sync at PHC Wi-Fi   │
├───────────────────┼───────────────────────────────┼────────────────────────────────────────────────────────────────────┤
│ 5. Gov Command    │ Multi-Display Video Wall      │ Live crowd density heatmaps; doctor pacing; IDSP syndromic outbreak│
│    Center (NOC)   │ (Ministry of Ayush / MS Office│ early-warning detection; PvPI adverse drug reaction anomaly alert  │
└───────────────────┴───────────────────────────────┴────────────────────────────────────────────────────────────────────┘
```

---

## 2. The Patient Experience: Citizen MediKiosk 2.0 & BYOD Mobile Companion

### 2.1 The Sensory & Behavioral Challenges of Indian Hospital Lobbies
1. **Intimidation & Technophobia**: A 68-year-old farmer who has never touched a smartphone fears that pressing a button will "break the government computer" or summon police.
2. **The Palm-Resting & Dwell Problem**: Elderly patients naturally rest their wrist or palm on the glass while pointing with an index finger, or press down firmly for 2 seconds. Legacy click-handlers misinterpret this as a drag or ignore it.
3. **Modesty & Stigma**: Young rural women cannot announce menstrual, pelvic, or reproductive complaints in a public lobby crowded with male bystanders.
4. **Time Poverty**: Migrant daily-wage laborers lose ₹500 if trapped in unmoving queues past 10 AM.

### 2.2 MediKiosk 2.0 Screen-by-Screen Flow & Ergonomic Invariants

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       PATIENT MEDIKIOSK 2.0: 7-STAGE FORMAL FLOW                                       │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                        │
│  [STAGE 1: Universal Language & Accessibility Selection]                                                               │
│     • Screen displays large visual state cards (Hindi, Bengali, Tamil, Telugu, Marathi, Punjabi, Gujarati, etc.)      │
│     • Ambient voice welcomes at 0.92x cadence: "नमस्ते बाबा! अपनी भाषा चुनने के लिए स्क्रीन पर हाथ लगाएं..."                  │
│     • Divyangjan Accessibility Bar: 1-tap High-Contrast Yellow/Black, Screen Reader narration, Screen Zoom (1.4x),     │
│       and Wheelchair Height Toggle (compresses touch zone to lower 750–850mm band).                                    │
│                                           │                                                                            │
│                                           ▼                                                                            │
│  [STAGE 2: Sovereign Identity & Privacy Modesty Shield]                                                                │
│     • Optical ABHA QR / Aadhaar scan / Biometric fingerprint / Mobile OTP intake.                                      │
│     • 1-Tap "निजी मोड / Private Modesty Mode": Disables microphone immediately; dims screen background to narrow-angle  │
│       porcelain gray; switches to quiet touch tiles for reproductive, urinary, or mental health symptoms.              │
│     • Maternal-Fetal Pharmacology Guard: When "Female" is selected, prompts: "Are you pregnant?"                       │
│       Selecting "Yes (14w)" activates the compiler-level embryotoxic interlock, locking classical emmenagogues         │
│       (Raja Pravartini, Kasisadi) and modern teratogens (ACE-i, Statins) from being prescribed.                        │
│                                           │                                                                            │
│                                           ▼                                                                            │
│  [STAGE 3: 3D Anatomical Body Map & Vernacular Voice]                                                                  │
│     • High-contrast 3D human body mannequin (Front & Back rotation toggle).                                            │
│     • Patient touches knees, chest, abdomen, spine, or head. The touched zone pulses turquoise; the kiosk speaks:       │
│       "दाहिना और बायां घुटना चुना गया है (Bilateral knees selected)."                                                  │
│     • Directional noise-isolated beamforming microphone captures voice: "सीने में भारी दर्द हो रहा है..."                │
│                                           │                                                                            │
│                                           ▼                                                                            │
│  [STAGE 4: SOCRATES & Autonomous Biometric Concordance]                                                                │
│     • Wong-Baker FACES Pain Scale: 6 hand-drawn emotional cartoon faces (smiling=0 to sobbing=10). Zero text reliance.  │
│     • Autonomous Biometric Concordance Engine: Cross-references subjective pain against objective IoT bedside vitals   │
│       (BP, pulse, SpO2, temp):                                                                                         │
│       * Detects "SILENT ISCHEMIC DRIFT" in diabetics (mild gas complaint + BP 160/100, pulse 112) -> ESI-1 Red Alert.  │
│       * Detects "QUEUE GAMING" (claimed pain 10/10 + completely calm autonomic vitals BP 118/76, pulse 72).             │
│                                           │                                                                            │
│                                           ▼                                                                            │
│  [STAGE 5: Charaka Dashavidha Pariksha (Ayurvedic Intake)]                                                             │
│     • Interactive Tridosha sliders (Vata-Pitta-Kapha) and Agni flame selector (Samagni, Tikshnagni, Mandagni).        │
│                                           │                                                                            │
│                                           ▼                                                                            │
│  [STAGE 6: Crumpled Document Intelligence & SI Unit Normalization]                                                     │
│     • Camera/flatbed scanner for faded past doctor slips and crumpled lab reports.                                     │
│     • Client-side Wasm OCR: Converts SI units (Blood Sugar 8.0 mmol/L -> 144.1 mg/dL; Creatinine 106 µmol/L ->        │
│       eGFR 31.8 mL/min in elderly sarcopenia); flags multi-page orphan records (Page 2 scanned without Page 1 header). │
│                                           │                                                                            │
│                                           ▼                                                                            │
│  [STAGE 7: Physical Thermal Ticket Dispensing & BYOD Mobile Companion Pairing]                                         │
│     • Heavy-duty industrial cutter dispenses high-contrast ticket: Token KY-104, Room 08, Estimated Wait: 14 mins.    │
│     • Spoken reassurance: "बाबा, पर्ची ले लीजिए और कमरा नंबर 8 के बाहर बैठिए। आपका नंबर 14 मिनट में आएगा।"               │
│     • Caregiver scans Aztec QR code on ticket -> launches BYOD Mobile Companion to wait in hospital garden/canteen.     │
│                                                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 The BYOD Mobile Companion (Zero-Install PWA)
* **Zero App Download**: Operates in Safari/Chrome via instant QR launch (<600 KB gzip).
* **4-Ring Proximity & Anti-Hoarding Defense**: Validates physical hospital presence via:
  1. Optical TOTP nonce rotated every 60 seconds on the ticket.
  2. Hospital Wi-Fi AP BSSID/RSSI ($\ge -65\text{ dBm}$).
  3. GPS polygon geofence (hospital campus boundary).
  4. Bluetooth Low Energy (BLE) waiting-hall micro-beacons.
* **Geofenced Waiting Freedom**: Displays live queue pacing (*"Token KY-98 with Doctor • 5 patients ahead • Wait: 11 mins"*). The caregiver can take their elderly parent to the hospital canteen or garden.
* **Sub-10-Minute Callout Vibration**: When the queue advances to 2 tokens before the patient, the phone delivers a distinct vibration and audio chime: *"कृपया कमरा नंबर 08 के बाहर पहुंचे। आपका नंबर आने वाला है।"*

---

## 3. The Doctor Experience: Clinical Cockpit 2.0 (OPD Desk)

### 3.1 The Cognitive Reality of the 90-Second Consultation
* A junior resident or consultant evaluates 120–180 patients in a 4-hour morning shift (**~90 to 102 seconds per patient**).
* Operating at this velocity forces the physician into **Kahneman System 1 (rapid heuristic pattern matching)**.
* When forced to type, click multiple tabs, or dismiss 40 trivial warnings, the physician experiences cognitive overload, breaks eye contact with the patient, and dismisses all alerts blindly.

### 3.2 Clinical Cockpit 2.0 Architecture: Ergonomic 3-Column Studio

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       DOCTOR CLINICAL COCKPIT 2.0: 3-COLUMN GRID                                       │
├───────────────────────────┬────────────────────────────────────────────┬───────────────────────────────────────────────┤
│ COLUMN 1: TRIAGE QUEUE    │ COLUMN 2: 4s GESTALT VISUAL HUD            │ COLUMN 3: CLINICAL STUDIO & PRESCRIBER        │
├───────────────────────────┼────────────────────────────────────────────┼───────────────────────────────────────────────┤
│ • Queue List (500 pts)    │ • Patient Header: Name, Age, Gender, ABHA  │ • Ambient Bilingual Voice Scribe:             │
│   sorted by ESI severity: │                                            │   - Noise-isolated real-time microphone stream│
│   - RED STAT (Emergency)  │ • High-Contrast Porcelain Vitals Grid:     │   - Live speech transcription in Hinglish     │
│   - AMBER (High Priority) │   - BP: 160/100 | Pulse: 112 bpm           │   - Auto-extracts SOCRATES into SOAP notes    │
│   - GREEN (Routine)       │   - SpO2: 93% | Temp: 98.6°F               │                                               │
│                           │                                            │ • Dual-Pharmacology Prescriber (ATC + AFI):   │
│ • Physiological Tags:     │ • 4-Second Gestalt Visual Telemetry HUD:   │   - Fast search by brand, molecule, or herb   │
│   - [🤰 14w Pregnant]     │   - NEWS2 Score Pill: 7 (CRITICAL RISK)    │   - Quick presets (Geriatric CKD, Pregnancy)  │
│   - [👴 Geriatric (74)]   │   - Tridosha Balance Polygon Bar           │   - Dosage, route, frequency, duration        │
│   - [👶 Pediatric (8)]    │   - Tri-Coded Diagnostic Anchor (NAMASTE,  │   - Classical Anupana (warm water, milk, etc.)│
│                           │     ICD-11, SNOMED CT)                     │                                               │
│ • Real-time search by     │   - Judea Pearl Level-2 DAG Override Alert │ • 3-Tier Non-Modal Alert Engine:              │
│   name or ABHA ID         │                                            │   - Level 1: Modal Screen Lock for lethal     │
│                           │ • Maternal Guard Card (if pregnant):       │     cascades (Warfarin + Guggulu) with        │
│ • Keyboard navigation:    │   - Gestational age & locked abortifacients│     1-click safe substitution button          │
│   Up/Down arrows to switch│                                            │   - Level 2: Ambient Ribbon (AUC surge)       │
│   between queued patients │ • Normalized Lab Biomarkers (from OCR):    │   - Level 3: Subtle Green Pathya/Apathya pill │
│                           │   - Blood Sugar: 144 mg/dL (from 8 mmol/L) │                                               │
│                           │   - eGFR: 31.8 mL/min (Sarcopenic CKD 3b)  │ • Persistent Action Dock:                     │
│                           │   - Orphan Page Warning (if missing p. 1)  │   - "Spacebar" triggers 1-click Rx Finalize   │
│                           │                                            │   - Prints official GoI/AIIA prescription     │
│                           │ • SOCRATES Anamnesis Summary Card          │   - Embeds BSA 2023 Sec 63 digital affidavit  │
└───────────────────────────┴────────────────────────────────────────────┴───────────────────────────────────────────────┘
```

### 3.3 Key Doctor Workflow Innovations
1. **The 4-Second Gestalt Visual Ingestion**: The doctor’s peripheral vision absorbs risk (NEWS2 score pill), constitutional balance (Tridosha bar), and preliminary diagnosis before the patient sits down.
2. **Zero-Typing Ambient Scribe**: The doctor speaks naturally to the patient (*"Babuji, kab se dard hai? Saans phoolti hai?"*). The local Wasm engine structures the conversation into SOAP notes in real time.
3. **1-Click Safe Substitution**: If Warfarin + Guggulu is triggered, a single click on *"Apply Safe Substitute"* swaps *Yogaraja Guggulu* for *Rasnasaptaka Kwatha* (AFI safe formulation with zero CYP2C9 inhibition).
4. **Medicolegal Protection (BNS 106 & BSA 63)**: Pressing `Spacebar` generates the prescription along with a cryptographically signed **BSA Section 63 Electronic Evidence Certificate** proving clinical protocol compliance.

---

## 4. The Pharmacist Experience: Hospital Dispensary Desk

### 4.1 High-Velocity Dispensing Bottlenecks
* The hospital pharmacist stands behind a small iron grille window, dispensing 500–700 prescriptions every morning.
* Major hazards include **illegible handwriting**, **Look-Alike Sound-Alike (LASA) dispensing errors**, and patients who do not understand English dosage terms (OD, BD, TDS).

### 4.2 Dispensary Desk Features
1. **Barcode Scan Gate**: Pharmacist scans the Aztec QR code on the patient's ticket; the full prescription renders instantly on screen.
2. **LASA Drug Interlock**: The system flashes visual warnings for high-risk pairs:
   * *"VERIFY: METFORMIN 500mg (Antidiabetic) — DO NOT CONFUSE WITH METOPROLOL (Beta-blocker)"*
   * *"VERIFY: KANCHNAR GUGGULU (Thyroid/Lymph) — DO NOT CONFUSE WITH KAISHORE GUGGULU (Gout)"*
3. **Peel-and-Stick Regional Label Generator**: Automatically prints an adhesive label in the patient’s native language with clear icons for morning/evening doses and specific *Anupana* instructions (*"Take with warm water after food"*).
4. **Schedule E(1) Digital Affidavit Check**: Verifies doctor identity and dosage bounds before dispensing toxicological ASU formulations (*Kaner*, *Vatsanabha*, *Kupilu*).

---

## 5. The ASHA / ANM Experience: Field Outreach Console

### 5.1 Remote Village Operating Realities
* ASHA workers walk 8–10 km across rural hamlets carrying budget Android tablets ($<₹7,000$, 2GB RAM) in extreme heat, mud, and zero cellular reception.
* They register pregnant women, screen for malnutrition, and track traditional home remedy consumption.

### 5.2 Field Console Features
1. **Sunlight-Readable High-Contrast Mode**: Black-on-white / yellow-on-black interface readable in direct outdoor midday glare.
2. **Single-Thumb Navigation**: All primary interactive buttons are $\ge 56\text{px}$ positioned on the screen's right edge for one-handed operation.
3. **Maternal RCH Risk Stratification**: Automatically detects High-Risk Pregnancies (severe gestational anemia $Hb < 7\text{ g/dL}$, gestational hypertension $BP \ge 140/90$) and books direct specialist referral tokens at the CHC.
4. **1.8-Second Merkle DAG Batch Sync**: When the ASHA connects to the PHC Wi-Fi on Friday, all 150 offline records synchronize in 1.8 seconds using Conflict-Free Replicated Data Types (CRDTs).

---

## 6. The Government & Leadership Experience: Epidemiological NOC

### 6.1 Macro-Surveillance Responsibilities
Hospital Medical Superintendents, State Health Missions, and the Ministry of Ayush require real-time telemetry to manage hospital overcrowding, prevent doctor-patient violence, and detect disease outbreaks early.

### 6.2 Command Center Features
1. **Real-Time OPD Crowd Density Heatmap**: Visualizes all hospital chambers with live queue counts, bottleneck detection, and crowd surge warnings.
2. **Doctor Burnout & Pacing Telemetry**: Flags consultations that are dangerously hurried ($<45\text{ seconds}$) or severely lagging ($>15\text{ minutes}$).
3. **IDSP Syndromic Outbreak Early Warning**: Maps localized geographic symptom clusters (e.g. 15 cases of retro-orbital pain + fever in a 5km radius) to detect Dengue or Malaria outbreaks **7 to 10 days before blood culture reports arrive**.
4. **PvPI Toxic ASU Batch Intercept**: Spatial Bayesian anomaly detection flags commercial herbal batches associated with unexpected acute liver or kidney injury, triggering automated product recall alerts within 12 hours.

---

## 7. Unified Navigation & State Isolation Architecture

```
                          ┌────────────────────────────────────────┐
                          │       SOVEREIGN APPLICATION SHELL      │
                          │   (Unified Header & Global Context)    │
                          └───────────────────┬────────────────────┘
                                              │
         ┌──────────────────┬─────────────────┼─────────────────┬──────────────────┐
         │                  │                 │                 │                  │
         ▼                  ▼                 ▼                 ▼                  ▼
┌─────────────────┐ ┌────────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────┐
│ PATIENT KIOSK   │ │ DOCTOR COCKPIT │ │ PHARMACY DESK│ │ ASHA OUTREACH│ │ GOV COMMAND    │
│ Route: /kiosk   │ │ Route: /doctor │ │ Route: /rx   │ │ Route: /asha │ │ Route: /admin  │
│ Hotkey: [1]     │ │ Hotkey: [2]    │ │ Hotkey: [3]  │ │ Hotkey: [4]  │ │ Hotkey: [5]    │
└─────────────────┘ └────────────────┘ └──────────────┘ └──────────────┘ └────────────────┘
```

### State Isolation Invariants
1. **Patient Data Sandbox**: Kiosk state runs in an isolated sandbox. Under the **DPDP Act 2023**, if idle for **45 seconds**, a 15-second visual countdown triggers, after which all patient data is permanently wiped from browser memory and the kiosk resets to Step 1.
2. **Doctor Session Continuity**: The Doctor cockpit retains its clinical workspace, queue selections, and ambient scribe history without interference from kiosk resets.
3. **Persistent Role Switcher**: A top-level sovereign launcher dock displays live Emergency counts, air-gap status, and instant role buttons (or keyboard shortcuts `1` to `5`) allowing seamless switching during demonstrations.

---

## 8. Summary of Implementation Plan

We will restructure `frontend/src/` into this modular architecture:
- `modules/kiosk`: Patient MediKiosk 2.0 (7-step flow, 3D body mannequin, modesty mode, OCR scanner, thermal ticket)
- `modules/byod`: Citizen Mobile Companion PWA (4-ring proximity defense, real-time queue tracker)
- `modules/doctor`: Doctor Clinical Cockpit 2.0 (4s Gestalt HUD, ambient scribe, dual-prescriber, 3-tier alerts)
- `modules/pharmacy`: Hospital Dispensary Console (barcode gate, LASA check, peel-and-stick labels)
- `modules/asha`: Frontline ASHA / ANM Field Console (offline PWA, RCH maternal tracking, CRDT sync)
- `modules/admin`: Government Command Center & Epidemiological NOC (crowd heatmaps, IDSP early warning, PvPI alerts)
- `core/`: Design tokens, Web Audio synthesized haptics, DPDP security guards
- `shared/`: Porcelain cards, vitals tiles, Gestalt HUD, tiered alert modals
