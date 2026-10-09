# ABDM integration guide

How Hospital OS fits the Ayushman Bharat Digital Mission: what is implemented, what it needs from
NHA to go live, and how to verify each piece.

## What the backend does today

| Capability | Where | Status |
| --- | --- | --- |
| ABHA capture at the kiosk (number or address), format-checked | `routes/abdm.routes.ts` `/abha/verify` | Works offline; verifies with NHA only when `ABDM_CLIENT_ID/SECRET` are set |
| DPDP consent with an explicit `abha_link` purpose, withdrawable, exported with the record | `security/privacy.service.ts` | Live |
| FHIR R4 document bundle per finalized visit, NRCES NDHM profiles, OPConsultRecord sections | `services/fhirGenerator.service.ts` | Live, structurally validated in battery 4 |
| Care context per finalized visit of an ABHA patient | `services/abdmHip.service.ts` `registerCareContext` | Live; queued as `PENDING_GATEWAY` until credentials exist |
| HIP-initiated linking (`/v0.5/links/link/add-contexts`) | `linkCareContext` | Calls the gateway when configured |
| Consent artefact intake (`/v0.5/consents/hip/notify`) | `handleConsentNotify` | Live; denied for unknown patients or withdrawn local consent |
| Health-information request → encrypted push (`/v0.5/health-information/hip/request`) | `handleHiRequest` | Live; ECDH Curve25519 + HKDF-SHA256 + AES-256-GCM |
| Local HIU simulation (consent → request → push → decrypt → validate) | `POST /api/abdm/hip/simulate-hiu/:patientId` | Live, used in battery 25 and for demos |
| Terminology search (NAMASTE seed, AFI, ICD-11 TM2 after import) | `services/terminology.service.ts`, `GET /api/abdm/namaste/search` | Live; import the official export with `npm run import:namaste` |

## Bundle contents (OPConsultRecord)

Composition `type` SNOMED 371530004 with sections coded per the NDHM IG:

| Section | SNOMED | Resources |
| --- | --- | --- |
| Chief complaints | 422843007 | Condition (NAMASTE + ICD-10 + SNOMED, ICD-11 when present) |
| Physical examination | 425044008 | Observation (LOINC vitals: BP panel 85354-9, HR 8867-4, SpO2 2708-6, RR 9279-1, temp 8310-5, weight 29463-7, glucose 2339-0) |
| Allergies | 722446000 | AllergyIntolerance |
| Medical history | 371529009 | Condition (past medical) |
| Family history | 422432008 | FamilyMemberHistory |
| Investigation advice | 721963009 | ServiceRequest |
| Medications | 721912009 | MedicationRequest (prescribed), MedicationStatement (ongoing) |
| Follow up | 736271009 | Appointment |
| Procedure | 371525003 | Procedure (past surgical) |
| Other observations | 404684003 | Observation (social history, denied symptoms, negative ROS) |
| Document reference | 371530004 | DocumentReference (scanned documents) |

Identifiers are never invented: ABHA number and address appear only when the patient has them,
the MRN uses `HOSPITAL_FHIR_BASE/mrn`, the practitioner carries the council registration from the
staff record, and the facility id appears only when `HFR_FACILITY_ID` is set.

Full profile validation (run before any sandbox submission):

```bash
java -jar validator_cli.jar bundle.json -version 4.0.1 -ig nrces.in.ndhm.fhir.r4#6.5.0
```

## Going live: what NHA must issue

1. Sandbox client id and secret for the gateway (`ABDM_CLIENT_ID`, `ABDM_CLIENT_SECRET`,
   `ABDM_GATEWAY_URL`, `ABDM_CM_ID`).
2. HIP registration (`ABDM_HIP_ID`) and a public callback URL for `/api/abdm/hip/v0.5/*`; set
   `ABDM_CALLBACK_TOKEN` to what the gateway presents.
3. Health Facility Registry id (`HFR_FACILITY_ID`); Health Professional Registry ids can be stored
   per practitioner once available.
4. Sandbox test cases M1 (ABHA verification), M2 (HIP linking, consent, data push) and the
   Fidelius interop check for the encryption envelope.

## Verifying locally

```bash
cd backend
npm run test:http          # battery 25: kiosk → doctor → FHIR → seal → HIP simulation
npm run test:fhir          # battery 4: 1,000 bundles, structural validation, section codes
```

For a live demo without credentials: finalize a visit for a patient who entered an ABHA address,
then call `POST /api/abdm/hip/simulate-hiu/<patientId>` as a doctor. The response shows the
consent id, the transaction id, and for each care context whether the decrypted bundle validated
and its checksum matched.
