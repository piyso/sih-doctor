# Sovereign MediKiosk & Ambient OPD Scribe: Master Deployment, Hardware Topologies, Hospital Radius Access & Government Command Blueprint

> **Statutory Alignment**: Ministry of Ayush & MoHFW, Government of India (Problem Statement ID: 26047)  
> **Standards Compliance**: ABDM FHIR R4 · DPDP Act 2023 · IEC 62366-1 (Medical Usability) · W3C WCAG 2.1 AAA · IEEE 802.11az (Indoor Positioning)

---

## 1. The Dual User Spectrum: Who Uses Us & Why

Our system is engineered around two distinct stakeholder tiers:
1. **The Citizens & Clinical Operators ("Users")**: Patients (rural, elderly, urban, illiterate, pregnant), Attending Physicians (Ayush Vaidyas, Allopathic CMOs, Specialists), and Frontline Health Staff (ASHA workers, ANMs, Triage Nurses).
2. **The Health Regulators & State Authorities ("Gov")**: Ministry of Ayush, MoHFW, State Health Missions, Hospital Medical Superintendents (MS), and the Pharmacovigilance Programme of India (PvPI / NPvCC).

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     THE TOTAL STAKEHOLDER MATRIX                                          │
├───────────────────────────────┬──────────────────────────────────┬────────────────────────────────────────┤
│ Stakeholder Class             │ Primary Device / Hardware Tier   │ Core Operational Objective             │
├───────────────────────────────┼──────────────────────────────────┼────────────────────────────────────────┤
│ Rural / Illiterate Patient    │ Physical High-Contrast Kiosk     │ Voice/Touch Intake + Printed Token     │
│ Urban / Smartphone Patient    │ BYOD Mobile Web (PWA via QR)     │ Waiting-hall Intake without Queuing    │
│ Expectant Mother              │ Kiosk / BYOD with Maternal Guard │ Teratogen & Emmenagogue Protection     │
│ Frontline ASHA / ANM Worker   │ Ruggedized Android Tablet (POS)  │ Village Outreach & Sub-Center Triage   │
│ Attending Ayush/Allopath MD   │ Dual-Screen Desktop Cockpit      │ Ambient Scribing + Conflict Intercept  │
│ Hospital Medical Super (MS)   │ Tablet / Web Command Console     │ Real-time Crowd Flow & Queue Telemetry │
│ Ministry of Ayush & PvPI      │ National Telemetry NOC Dashboard │ Epidemiological & Drug Safety Heatmaps │
└───────────────────────────────┴──────────────────────────────────┴────────────────────────────────────────┘
```

---

## 2. Device Form Factors & Hardware Topologies

### Tier 1: The Sovereign Heavy-Duty Physical MediKiosk (Hospital Lobby & OPD Entry)
* **Target Environment**: Public District Hospitals, AIIMS Outpatient Lobbies, Sub-Divisional Civil Hospitals, and Ayush Dispensaries handling 2,000–10,000 encounters/day.
* **Physical Specifications**:
  * **Screen**: 24-inch or 32-inch Full HD Industrial Projected Capacitive Touchscreen (IP54 dust/water-resistant, oleophobic antimicrobial coating, operable with damp hands or surgical gloves).
  * **Acoustics**: Dual-element noise-canceling beamforming microphone array (directional cardioid pickup pattern tuned to reject ambient hospital chatter >65 dB).
  * **Thermal Printer**: Heavy-duty 80mm industrial thermal receipt printer with auto-cutter (dispenses high-contrast OPD tokens with QR code, triage room number, and color-coded ESI priority badge).
  * **Integrated Biometric & Optical Bay**:
    * Optical 2D Barcode / QR Scanner (instant ABHA card scan, Aadhaar QR scan).
    * STQC-certified Optical Fingerprint Scanner (Aadhaar authentication fallback).
    * Integrated Optical Document Scanner (A4 flatbed/sheetfed slot with wide-angle camera for scanning past prescriptions and lab records).
  * **Bedside IoT Telemetry Docking Station**:
    * Digital Oscillometric Blood Pressure Cuff.
    * Dual-Wavelength Photoplethysmography Finger Clip (Pulse + SpO2).
    * Medical-grade Non-contact Infrared Forehead Thermometer.
  * **Compute Substrate**: Industrial Edge Box (Intel Core i5 / AMD Ryzen Embedded or Rockchip RK3588, 16GB RAM, NVMe SSD, UPS battery backup for 4 hours of brownout survival).

### Tier 2: The Zero-Install BYOD Mobile Web App (Patient Waiting Hall)
* **Target Environment**: Overflowing OPD waiting areas where all kiosks are occupied.
* **Architecture**:
  * **Zero App-Store Download**: Operates entirely as a Progressive Web App (PWA) running in Safari, Chrome, or Firefox.
  * **Instant Launch**: Patient points phone camera at dynamic poster/kiosk QR code; web app instantly opens over HTTPS/Local Intranet in under 500ms.
  * **Offline-First Cache**: Service Workers cache UI assets locally; patients can complete their SOCRATES symptom history even if cellular connectivity is spotty.
  * **Battery & Data Efficient**: Bundle size <600 KB gzip; uses system fonts and zero external tracking scripts.

### Tier 3: Ruggedized Field Tablet (ASHA, ANM, Mobile Ayush Vans)
* **Target Environment**: Rural Sub-Centers, Village Health Camps, Border/Tribal Outposts in Ladakh, Bastar, and Northeast India.
* **Architecture**:
  * 10-inch MIL-STD-810H ruggedized Android tablet.
  * Local embedded SQLite database with cryptographic Merkle DAG chains.
  * Bluetooth LE pairing with portable Bluetooth BP cuffs and pulse oximeters.
  * Asynchronous Store-and-Forward sync: Stores 1,000 records locally; synchronizes with the district hospital server via opportunistic cellular (4G/5G) or USB sneakernet.

### Tier 4: The Physician Desktop Cockpit (Doctor's Consultation Chamber)
* **Target Environment**: OPD consultation rooms across Kayachikitsa, Shalya, Panchakarma, Prasuti Tantra, and General Medicine.
* **Architecture**:
  * Dual-pane or widescreen desktop monitor (Chrome/Edge on Windows, Linux, or macOS).
  * **Left Pane**: Pre-intake briefing (Kiosk symptoms, pain score, vital signs, past medications, and flagged red flags).
  * **Center/Right Pane**: Ambient Acoustic Scribe recording doctor-patient dialogue in real-time, extracting Socrates parameters, and generating prescription tokens.
  * **HUD Alert Overlay**: Non-modal warning banners popping up in <5ms when an Ayush-Allopathic conflict, Schedule E(1) substance, or pregnancy contraindication is triggered.
  * **One-Click ABDM Export**: Generates cryptographically signed FHIR R4 JSON bundles sent directly to ABDM Health Information Exchange (HIE).

### Tier 5: Government Command Center & Epidemiological NOC
* **Target Environment**: Ministry of Ayush (Ayush Bhawan, New Delhi), State Health Mission war rooms, and Hospital Medical Superintendent Offices.
* **Architecture**:
  * Multi-display dashboard visualization built with SVG geospatial heatmaps and WebSockets.
  * Real-time metrics: OPD throughput, wait-time bottlenecks, emergency red-flag diversions, adverse drug interaction frequency, and seasonal infectious disease spikes.

---

## 3. Hospital Radius Access, Geofencing & Anti-Hoarding Security

A critical failure mode in public hospital systems (like AIIMS or Safdarjung online registration) is **remote queue hoarding, token scalping, and bot farming**: individuals or touts generate thousands of OPD tokens from distant cities, exhausting daily doctor quotas while patients physically waiting at the hospital cannot get tokens.

To permanently eradicate this, our architecture enforces a **4-Tiered Proximity & Radius Defense**:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   4-TIERED PROXIMITY & RADIUS DEFENSE                                     │
├───────────────────┬────────────────────────────────────┬──────────────────────────────────────────────────┤
│ Defense Layer     │ Technology Substrate               │ Verification Invariant Enforced                  │
├───────────────────┼────────────────────────────────────┼──────────────────────────────────────────────────┤
│ 1. Optical Nonce  │ Dynamic Rotating TOTP QR (60s TTL) │ User must physically view hospital screen/wall   │
│ 2. Subnet BSSID   │ Hospital Wi-Fi AP BSSID & RSSI     │ Signal strength ≥ -65 dBm (within waiting hall)  │
│ 3. GPS Geofence   │ WGS84 Geofence (100–300m polygon)  │ Device GPS coordinates inside hospital campus    │
│ 4. BLE Beacons    │ Bluetooth Low Energy Micro-zones   │ In-hospital chamber routing (Room 01 vs Room 14) │
└───────────────────┴────────────────────────────────────┴──────────────────────────────────────────────────┘
```

### Layer 1: The Rotating Optical Gate Nonce (Zero Network Leakage)
* The kiosk or large lobby wall display generates a cryptographically signed QR code that rotates every **60 seconds**.
* The payload contains:
  $$\text{Payload} = \text{HMAC-SHA256}(\text{KioskID} \parallel \text{Timestamp}_{60s}, \text{SecretKey})$$
* **Security Proof**: A tout 500 meters away cannot scan this code. Even if someone takes a photo and sends it over WhatsApp, the nonce expires in $\le 60$ seconds, making remote token reservation mathematically impossible.

### Layer 2: Hospital Wi-Fi BSSID & RSSI Subnet Binding
* When patients connect to the free Hospital Wi-Fi (`AIIA-Free-Health-WiFi`), the system inspects:
  1. The **BSSID** (MAC address of the access point).
  2. The **RSSI (Received Signal Strength Indicator)**:
     $$\text{RSSI} \ge -65 \text{ dBm} \implies \text{Inside OPD Hall (Authorized)}$$
     $$\text{RSSI} \le -75 \text{ dBm} \implies \text{Parking Lot / Distant Street (Blocked)}$$
* If RSSI indicates the user is across the street or outside campus, the BYOD token generation is gated with a notification: *"कृपया अस्पताल परिसर के प्रतीक्षा कक्ष में प्रवेश करें (Please enter the hospital OPD hall to activate your queue token)."*

### Layer 3: Campus GPS Geofence Polygon
* The hospital campus is defined as a polygonal geofence (e.g. AIIA Sarita Vihar campus: Latitude 28.5284, Longitude 77.2917 with a **250-meter radius**).
* The browser's HTML5 Geolocation API (`navigator.geolocation.getCurrentPosition`) verifies that the device coordinates reside strictly within the hospital boundary.
* Anti-spoofing heuristic: If GPS accuracy radius $>150\text{m}$ or if mock location flags are detected on Android, the system falls back to Layer 1 (Physical Optical Nonce scan).

### Layer 4: Bluetooth Low Energy (BLE) Micro-Location Beacons
* Inside the hospital, cheap ₹400 BLE beacons (Eddystone/iBeacon) are mounted outside individual department wings (Kayachikitsa, Panchakarma, Emergency).
* When a patient's smartphone enters the 5-meter proximity of Room 04, the BYOD web app automatically updates: *"You have arrived at Kayachikitsa Room 04. You are next in line."*

---

## 4. How Users Actually Use the System: Step-by-Step Journeys

### Journey A: The Elderly, Non-Literate Rural Villager
1. **Arrival**: 68-year-old Ramu enters the OPD hall. He cannot read English or complex Hindi script.
2. **Step 1 (Language)**: The kiosk screen displays large, colorful state cards. An audible prompt says: *"अपनी भाषा चुनें / Choose your language."* Ramu touches the prominent Hindi card.
3. **Audio Guidance Button**: On every step, a glowing blue button with a speaker icon ("निर्देश सुनें / Listen") is present. Tapping it speaks clear instructions aloud via browser-native Text-to-Speech (`sovereignSound.speakGuidance`).
4. **Step 2 (Identity)**: Ramu taps his physical ABHA card or enters his 12-digit Aadhaar. The Verhoeff $D_5$ algorithm validates the checksum instantly.
5. **Step 3 (Voice & Body)**: Ramu touches the front mannequin's knee and presses the big green microphone button. He speaks naturally: *"दोनों घुटनों में बहुत दर्द है, चलने में कट-कट आवाज आती है।"*
6. **Step 4 (Pain Scale)**: Ramu chooses the Wong-Baker visual face showing a grimacing expression (Score 6 - Hurts More).
7. **Step 5 (Ayush Pariksha)**: Selects simple visual cards for appetite, sleep, and bowel habits.
8. **Token Dispensing**: The thermal printer instantly cuts a paper token:
   * **Token #KY-104** (Kayachikitsa Wing, Room 08).
   * QR code containing his encrypted intake session.
   * Large bold text and colored icon so he knows exactly which hallway to follow.

### Journey B: The Expectant Mother
1. **Intake**: 26-year-old Sunita visits for severe morning sickness, indigestion, and lower back pain.
2. **Maternal Guard Activation**: In Step 2, selecting "महिला / Female" activates the **Maternal-Fetal Pharmacology Guard**. Sunita taps *"हाँ / Yes (Pregnant - 1st Trimester)"*.
3. **Real-Time Safety Lock**:
   * The Causal DAG and Clinical Ontology Engine immediately place a **permanent block** on:
     * Classical emmenagogues: *Raja Pravartini Vati*, *Kasisadi Vati*, *Kanya Lohadi Vati*.
     * Toxic mercurial rasashastra bhasmas: *Rasamanikya*, *Hingula*.
     * Allopathic teratogens: ACE inhibitors (Enalapril), ARBs (Telmisartan), Statins (Atorvastatin).
4. **Consultation**: When the doctor opens Sunita's pre-intake panel, a bright pink shield confirms: *"Active Maternal-Fetal Pharmacology Gate: Pregnancy Week 10. Emmenagogues & Teratogens Prohibited."*

### Journey C: The Tech-Savvy Urban Citizen (BYOD Mobile Queue)
1. **Arrival**: 34-year-old Priya walks into a crowded hospital lobby. Seeing a queue of 15 people at the kiosk, she looks at the wall poster.
2. **Scan & Open**: She points her iPhone camera at the dynamic optical QR code. The BYOD web portal opens instantly.
3. **Intake from Chair**: She sits comfortably in the waiting hall, fills her symptoms, uploads a photo of her previous thyroid lab report, and submits.
4. **Live Mobile Tracking**: Her phone displays a live progress ring: *"Queue Position: 4 ahead of you • Estimated Wait: 12 minutes"*.
5. **Consultation Call**: When the doctor is ready, her phone buzzes with haptic feedback and chimes: *"Please enter Room 12"*.

### Journey D: The Attending Physician (Ayush & Allopathic Integrative OPD)
1. **Pre-Consultation Briefing (0 seconds)**: As the patient sits down, the doctor's monitor already shows the complete case summary:
   * SOCRATES breakdown (Site, Character, Severity).
   * Verified Bedside Vitals (BP 160/100, Pulse 112, SpO2 93%).
   * Digitized previous lab report (HbA1c 8.4%, Creatinine 1.1 mg/dL).
2. **Ambient Scribe**: The doctor talks to the patient. The ambient scribe records and structures the clinical encounter in the background.
3. **Dual-Pharmacology Prescribing**:
   * Doctor prescribes *Atorvastatin 20mg* for dyslipidemia and considers *Trikatu Churna* (Piperine) for sluggish digestion.
   * **Instant Warning HUD**: The Truth Engine pops up:
     > ⚠️ **PHARMACOKINETIC BIOAVAILABILITY WARNING**: *Piperine inhibits CYP3A4 & P-gp, elevating Atorvastatin AUC by 240% $\to$ Risk of Rhabdomyolysis. Suggest lowering Atorvastatin to 10mg or substituting Trikatu with Shunthi monotherapy.*
4. **Statutory Sign-Off**: The doctor signs the digital prescription using their Aadhaar/Ayush National Registration Number. The prescription is locked into the Bitemporal Merkle DAG and pushed to ABDM.

---

## 5. What the Government Gets: Command Center Telemetry & Public Health Impact

For health secretaries, state directors, and hospital administrators, the frontend provides an executive intelligence command center:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               GOVERNMENT TELEMETRY & SURVEILLANCE ENGINE                                  │
├───────────────────────────────┬───────────────────────────────────────────────────────────────────────────┤
│ Telemetry Domain              │ Operational & Strategic Value Delivered                                   │
├───────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ Real-Time Outbreak Heatmap    │ Detects sudden clusters of high fever + dengue joint pain or gastroenteritis│
│                               │ within a 5km radius before official lab cultures are returned.            │
├───────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ Pharmacovigilance (NPvCC/PvPI)│ Aggregates ADR signals across 50,000 OPD encounters/day, identifying novel │
│                               │ Ayush-Allopathic herb-drug interaction trends across Indian demographics. │
├───────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ Queue Latency Optimization    │ Monitors median wait-time per department (e.g. Kayachikitsa: 14 min vs    │
│                               │ Shalya: 38 min), allowing dynamic re-allocation of medical officers.      │
├───────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ Zero-Delay Emergency Triage   │ Tracks emergency red-flags diverted directly to resuscitation bays (<45s)  │
│                               │ preventing preventable waiting-room cardiac arrests.                      │
├───────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ Statutory Audit Trail         │ Cryptographic Merkle verification guarantees zero tampering with doctor    │
│                               │ prescriptions, medicolegal MLC records, or Schedule E(1) poison logs.    │
└───────────────────────────────┴───────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Full Air-Gap Resilience Architecture: Zero Cloud Dependency

In remote Himalayan dispensaries, island clinics, or during nationwide telecom outages, the kiosk and doctor workstations operate autonomously:

```
                  ┌─────────────────────────────────────────┐
                  │    LOCAL HOSPITAL AIR-GAP SUBNET        │
                  │                                         │
                  │   ┌──────────────────────────────────┐  │
                  │   │   Sovereign Edge Node (NUC / Pi) │  │
                  │   │   - SQLite WAL High-Concurrency  │  │
                  │   │   - Local Causal DAG Engine      │  │
                  │   │   - Local Wasm OCR & Audio DSP   │  │
                  │   └──────────────────────────────────┘  │
                  │              ▲            ▲             │
                  │              │ LAN        │ LAN / Wi-Fi │
                  │              ▼            ▼             │
                  │     ┌──────────────┐  ┌──────────────┐  │
                  │     │ MediKiosk    │  │ Doctor Desk  │  │
                  │     │ (Touchscreen)│  │ (Cockpit)    │  │
                  │     └──────────────┘  └──────────────┘  │
                  └─────────────────────────────────────────┘
                                       │
                      Opportunistic WAN Sync (When Online)
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │ ABDM National Health Exchange & MoHFW   │
                  └─────────────────────────────────────────┘
```

1. **Local Edge Node**: Runs on a local mini-PC connected to the hospital switch.
2. **Local SQLite WAL Storage**: Reads/writes execute in sub-millisecond time with zero cloud roundtrips.
3. **Client-Side Neural DSP & OCR**: All audio beamforming, formant gating, and OCR run via WebAssembly directly in the browser.
4. **Opportunistic ABDM Gateway**: When internet is restored, local Bitemporal Merkle chains are signed and synced to the central ABDM FHIR R4 registry without clinical disruption.
