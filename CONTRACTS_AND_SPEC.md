# AIIA Sovereign MediKiosk & Ambient OPD Scribe
## Frontend Developer & Outsourcing Specification (`CONTRACTS_AND_SPEC.md`)
**Problem Statement ID:** 26047 | **Ministry / Organization:** All India Institute of Ayurveda (AIIA), Ministry of Ayush & MoHFW, Govt. of India

---

## 1. Overview for Outsourced Frontend Developers

This repository is split into two independent, decoupled sub-systems:
1. `backend/`: High-performance sovereign Express + SQLite WAL + WebSocket engine (runs on local bare-metal / SBC).
2. `frontend/`: Standalone React 18 + Vite + TypeScript web application designed for touch-screen MediKiosks, tablets, and Doctor workstation desktops.

> [!IMPORTANT]
> **Outsource Readiness:** The frontend can be developed, tested, and completely demoed in **100% Standalone Mock Mode** without running the backend. Setting `VITE_USE_MOCK=true` or clicking the "Standalone Mock Mode" toggle in the header runs the full end-to-end clinical workflow with zero network dependencies.

---

## 2. Quickstart for Frontend Developers

```bash
cd frontend
npm install
npm run dev
```

The application will launch on `http://localhost:5173`.
By default, if the backend at `http://localhost:8000` is offline or unreachable, the frontend automatically falls back to local simulation mode with realistic network delays ($100-200\text{ ms}$).

### Environment Variables (`.env`)

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:8000` | REST API base URL |
| `VITE_WS_URL` | `ws://localhost:8000/ws/ambient` | WebSocket endpoint for live ambient speech transcription |
| `VITE_USE_MOCK` | `false` | Force standalone mock mode |

---

## 3. Universal Shared Data Contracts

All data structures are typed in `frontend/src/types/api.ts` (matching `shared/types.ts`).

### 3.1. Triage Priority (`TriagePriority`)
```typescript
type TriagePriority = 'EMERGENCY_RED_FLAG' | 'HIGH_PRIORITY' | 'ROUTINE';
```

### 3.2. SOCRATES Clinical Symptom (`SocratesSymptom`)
```typescript
interface SocratesSymptom {
  site: string;                 // e.g. "Substernal Precordium"
  onset: string;                // e.g. "3 hours ago during exertion"
  character: string;            // e.g. "Heavy crushing pressure"
  radiation: string;            // e.g. "Left arm and shoulder"
  associations: string[];       // e.g. ["Diaphoresis", "Breathlessness"]
  timing: string;               // e.g. "Continuous"
  exacerbatingFactors: string[];// e.g. ["Exertion"]
  relievingFactors: string[];   // e.g. ["Rest"]
  severityScore: number;        // 1 - 10 Visual Analog Scale
}
```

### 3.3. Charaka Dashavidha Pariksha (`DashavidhaPariksha`)
```typescript
type AgniType = 'SAMAGNI' | 'VISHAMAGNI' | 'TIKSHNAGNI' | 'MANDAGNI';

interface DashavidhaPariksha {
  prakriti?: string;            // e.g. "Vata-Pitta"
  vikriti?: string;             // e.g. "Pitta-Kapha Avarana"
  sara?: string;                // "Pravara" | "Madhyama" | "Avara"
  satva?: string;               // "Pravara" | "Madhyama" | "Avara"
  agni?: AgniType;              // SAMAGNI, VISHAMAGNI, TIKSHNAGNI, MANDAGNI
}
```

### 3.4. Dual-Pharmacology Medication Orders
```typescript
interface AllopathicMedication {
  id?: string;
  name: string;                 // e.g. "Warfarin", "Metformin"
  genericName?: string;
  dosage: string;               // e.g. "5 mg"
  route: string;                // "ORAL", "IV", "IM"
  frequency: string;            // "OD", "BD", "TDS", "HS"
  durationDays: number;
}

interface AyushFormulation {
  id?: string;
  classicalName: string;        // e.g. "Yogaraja Guggulu"
  namasteCode?: string;         // e.g. "AYU-FORM-002"
  dosageForm: string;           // "Vati", "Churna", "Asava", "Avaleha"
  dose: string;                 // "2 tablets (500mg)"
  anupana: string;              // Statutory vehicle: "Koshna Jala (Warm Water)"
  frequency: string;            // "BD"
  durationDays: number;
  pathya?: string[];            // Recommended diet
  apathya?: string[];          // Strict dietary contraindications
}
```

---

## 4. REST API Endpoint Specifications

### 4.1. Health Check
- **Endpoint:** `GET /health`
- **Response:**
```json
{
  "status": "HEALTHY",
  "service": "AIIA MediKiosk Sovereign Engine",
  "version": "1.0.0",
  "statutoryCompliance": "DPDP Act 2023 / ABDM M3 / Ministry of Ayush",
  "uptimeSeconds": 142.5
}
```

### 4.2. Audio / Text Vernacular Parser
- **Endpoint:** `POST /api/kiosk/parse-audio`
- **Request Body:**
```json
{
  "transcript": "3 दिन से सीने में बहुत तेज़ दर्द है बाईं बांह में जा रहा है और पसीना छूट रहा है। बीपी 160/100 है।"
}
```
- **Response (Latency: $0.017\text{ ms}$):**
```json
{
  "success": true,
  "data": {
    "symptoms": [
      {
        "site": "Substernal Precordium",
        "onset": "3 days ago",
        "character": "Sharp or crushing pain",
        "radiation": "Left arm",
        "associations": ["Diaphoresis / sweating"],
        "timing": "Continuous",
        "exacerbatingFactors": [],
        "relievingFactors": [],
        "severityScore": 9
      }
    ],
    "vitals": {
      "bp": "160/100",
      "pulse": 112,
      "spo2": "93%",
      "temp": "98.6°F"
    },
    "isEmergencyRedFlag": true,
    "redFlagTriggers": [
      "Acute Substernal Chest Pain with Radiation to Left Arm",
      "Hypertensive Urgency (160/100)"
    ]
  }
}
```

### 4.3. Save MediKiosk Intake
- **Endpoint:** `POST /api/kiosk/intake`
- **Request Body:**
```json
{
  "patient": {
    "name": "Ramesh Kumar",
    "age": 58,
    "gender": "MALE",
    "phone": "9876543210",
    "aadhaar": "234567890123",
    "abhaId": "91-4567-8901-2345"
  },
  "symptoms": [...],
  "pariksha": { "prakriti": "Pitta-Vata", "agni": "VISHAMAGNI" },
  "vitals": { "bp": "160/100", "pulse": 112, "spo2": "93%", "temp": "98.6°F" },
  "rawTranscript": "..."
}
```
- **Response:**
```json
{
  "success": true,
  "sessionId": "sess-a9128f7c-3104-469b",
  "patientId": "pat-001",
  "triagePriority": "EMERGENCY_RED_FLAG",
  "redFlags": ["Acute Substernal Chest Pain", "Hypertensive Urgency"],
  "status": "DIVERTED_EMERGENCY",
  "message": "CRITICAL ALERT: Emergency signs detected. Divert to Emergency Resuscitation Bay."
}
```

### 4.4. Fetch Doctor Queue
- **Endpoint:** `GET /api/doctor/queue`
- **Response:** Returns list of `PatientQueueItem[]` ordered with Emergency Red Flags at the top.

### 4.5. Evaluate Herb-Drug Interactions (Truth Engine)
- **Endpoint:** `POST /api/contraindications/evaluate`
- **Request Body:**
```json
{
  "allopathic": [{ "name": "Warfarin" }],
  "ayush": [{ "classicalName": "Yogaraja Guggulu" }]
}
```
- **Response:**
```json
{
  "success": true,
  "alerts": [
    {
      "allopathicDrug": "Warfarin",
      "ayushHerb": "Yogaraja Guggulu (Guggulsterones)",
      "severity": "CRITICAL_LETHAL",
      "mechanism": "CYP3A4 / CYP2C9 inhibition coupled with antiplatelet action.",
      "clinicalConsequence": "Elevation of INR (>4.5), severe hemorrhage risk.",
      "recommendedAction": "STAT CLINICAL OVERRIDE REQUIRED: Discontinue or reduce dose.",
      "bayesianConfidence": 0.994
    }
  ]
}
```

### 4.6. Generate ABDM FHIR R4 Document Bundle
- **Endpoint:** `GET /api/abdm/fhir-bundle/:sessionId`
- **Response:** Fully structured HL7 FHIR R4 Bundle with NAMASTE Tri-Coding (`A-Codes` + `ICD-11` + `SNOMED-CT`).

### 4.7. Verify Patent zk-SNARK Proof
- **Endpoint:** `POST /api/security/verify-zkp`
- **Response:**
```json
{
  "verified": true,
  "badge": {
    "protocol": "Groth16",
    "curve": "BN128",
    "soundnessProven": true,
    "tamperResistant": true
  }
}
```

### 4.8. Sovereign Lever Gateway Diagnostics
- **Endpoint:** `GET /api/security/lever-diagnostics`
- **Description:** Real-time diagnostics of all 3 connected computational levers on this PC:
- **Response:**
```json
{
  "success": true,
  "diagnostics": {
    "piyApiProjectCloud": {
      "connected": true,
      "path": "/Users/piyushkumar/Desktop/project cloud",
      "subsystems": [
        "TruthEngine (Beta-Binomial Bayesian Updating)",
        "PACConformalGate (99% Statistical Triage Safety)",
        "SovereignNER (Verhoeff D5 Aadhaar Validation)",
        "PiyGraph (Causal Ayush-Allopathy Multi-Hop Traversal)"
      ]
    },
    "piyNotesAudio": {
      "connected": true,
      "path": "/Users/piyushkumar/Desktop/1.piynoteskiro",
      "subsystems": [
        "PhoneticNormalizer (Hinglish/Code-Switching Dialects)",
        "AudioPipelineService (Linear 16kHz PCM VAD Engine)"
      ]
    },
    "patentZkpArbiter": {
      "connected": true,
      "path": "/Users/piyushkumar/Desktop/patent/proof. and fixing/zkp_circuit",
      "protocol": "Groth16 / BN128 (Patent Claims 1–43)"
    }
  }
}
```

---

## 5. WebSocket Ambient Audio Stream

- **URL:** `ws://localhost:8000/ws/ambient`
- **Client Sends:** Audio PCM chunks or text tokens.
- **Server Broadcasts:**
```json
{
  "speaker": "Doctor",
  "text": "बीपी 160/100 है। सीने में भारी दबाव महसूस हो रहा है।",
  "timestamp": "10:16:30",
  "isFinal": true
}
```

---

## 6. UI Wireframe Specifications

1. **Patient MediKiosk:**
   - Designed for high accessibility: 6 Indian languages, large touch buttons ($\ge 48\text{px}$).
   - Verhoeff $D_5$ instant checkmark validation for 12-digit Aadhaar.
   - Interactive SVG Human Body Map with pulsing targets.
   - Dynamic Canvas Audio Visualizer during speech recording.
   - Printable OPD Token Ticket with QR pass.

2. **Doctor OPD Desk:**
   - 2-column layout: 320px triaged queue sidebar on left; clinical workstation on right.
   - Pre-consultation summary panel with Dashavidha Pariksha and OCR scanned labs.
   - Ambient transcription scribe with live native microphone (`hi-IN` / `en-IN`) and autonomous simulated stream.
   - Dual-pharmacology prescription pad with real-time Bayesian conflict modal popup.
   - Official AIIA Government OPD Case-Sheet & Thermal Prescription Modal with 14-digit Verhoeff ABHA QR code, NAMASTE Tri-Coding, Classical Anupana & Kala, Charaka Pathya-Apathya, and Groth16 zk-SNARK cryptographic state seal.
   - 1-click ABDM FHIR R4 JSON inspection modal.

3. **Triage Admin Heatmap:**
   - OPD census analytics, emergency red flag diversion count, and wait-time projection.
