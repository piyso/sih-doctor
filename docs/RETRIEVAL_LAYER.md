# Encrypted similar-case retrieval layer

The first working embodiment, inside the hospital OS, of the pending patent application
*Adaptive Distributed Memory Retrieval Apparatus with Reinforcement Learning* (Indian application 202531095594,
priority 5 Oct 2025; PCT/IN2026/052065). Added 9 October 2026. Code: `backend/src/services/retrieval/`,
route `backend/src/routes/retrieval.routes.ts`, battery `backend/tests/retrieval_layer.test.ts`, panel
`frontend/src/components/doctor/SimilarCasesPanel.tsx`.

## What it does for the doctor

For the selected patient it returns up to six **de-identified** past presentations that look like this one
(this facility's encounters and intakes, plus a clearly labelled synthetic reference shard for cold start), with
their diagnoses, prescriptions and investigations. It replaces the five hand-written syndrome prototypes as the
"what did similar patients turn out to have" signal, without ever showing a name, phone, ABHA or date.

## What it does for the patent

Every query runs through the mechanism the application claims, and the response carries the decision so the
screen shows it:

| Claimed element | Implemented here | Status |
| :-- | :-- | :-- |
| Two-stage retrieval: coarse search over quantized vectors, full-precision re-ranking, packed evaluation (claim 19) | int8 coarse scan (k = 48) → 256-dimensional re-rank; 16 candidates packed per CKKS ciphertext, one ciphertext-plaintext multiply and 8 rotate-and-add steps | **real** |
| Homomorphic engine on an encrypted query (claims 1, 8, 21) | CKKS, Microsoft SEAL through node-seal 5.1.5, N = 8192, moduli 60/40/40/60, scale 2^40 | **real** (query encrypted; candidates plaintext on the peer; the orchestrator holds the client key in this single-node form) |
| Latency prediction from runtime telemetry (claims 8, 12) | online ridge regression on ciphertext count, queue depth, CPU utilisation | **real** |
| Predictor release gate (claim 13) | predictions used only once the held-out MAE is small; default mode until then | **real** |
| Mode-switching threshold (claims 1, 8) | fixed 250 ms (`RETRIEVAL_THRESHOLD_MS`), the application's basic embodiment | **real, fixed** |
| Enclave-ratio guard, prospective, per window of W (claims 8, 20) | W = 100, max ratio 0.80; every window has at least 20 % homomorphic operations whatever the predictions | **real** |
| Secure-memory guard (claim 9) | prospective footprint check against an 85 % ceiling of the isolated evaluator's budget | **real accounting over a stand-in region** |
| Noise-floor admission and refresh (claims 11, 21) | residual level budget checked before every level-consuming operation; refresh by decrypt-and-re-encrypt when it would fall below 0.15 | **real** |
| Tier override (claim 15) | departments matching mental-health, HIV, addiction or reproductive-health keywords, and pregnant patients, always run homomorphically | **real** |
| Calibrated score smudging inside the enclave (claim 21) | Gaussian noise, σ = 2^-9, added inside the isolated worker before scores leave it | **real noise, software isolation** |
| Hardware-isolated enclave (SGX/TDX/CCA) | a worker thread with its own heap; no attestation, no hardware memory protection | **stand-in** (this host has no enclave) |
| Reinforcement-learning agent tuning threshold, compression, cache (claims 1 to 5) | not implemented; the threshold is fixed | **not implemented** |
| Zero-knowledge proof of enclave results (claim 18) | not implemented | **not implemented** |
| Attested telemetry, decryption quorum, multiple peer nodes (claims 16, 17) | single process, single node | **not implemented** |

Say it this way: "the kiosk now runs the guarded two-stage encrypted retrieval of our pending application on one
node, with a software stand-in for the enclave; the multi-node, hardware-enclave form is the state-level roadmap."

## Measured on this machine (Apple M4, node-seal WebAssembly)

| Step | Time |
| :-- | :-- |
| Encrypt the query (one ciphertext, 446 KB) | about 10 ms |
| Multiply plus 8 rotations, one ciphertext (16 candidates) | about 37 ms |
| Decrypt one ciphertext | about 10 ms |
| Full query, 48 candidates, homomorphic mode (3 ciphertexts), measured on the live server | 75 to 120 ms |
| Full query, isolated mode | under 5 ms |
| Coarse scan over 400 cases | under 1 ms |

The battery prints its own numbers each run.

## API

`POST /api/retrieval/similar` (clinician roles) with `{ "sessionId": "..." }` or `{ "query": { "symptoms": [...], "ageBand": "41-60", ... } }`,
optional `topN` (1 to 25). Returns `results`, `decision` (mode, candidate mode, prediction, guards, window share),
`stages` (timings, ciphertexts, refreshes, smudging sigma) and `privacy` (how the query was protected).
`GET /api/retrieval/status` returns engines, parameters, counters, predictor state and corpus size.

Configuration: `RETRIEVAL_THRESHOLD_MS` (250), `RETRIEVAL_WINDOW_W` (100), `RETRIEVAL_MAX_ENCLAVE_RATIO` (0.8),
`RETRIEVAL_SECURE_MEMORY_CEILING` (0.85), `RETRIEVAL_REFERENCE_SHARD` (`on`/`off`), `RETRIEVAL_TIER1_KEYWORDS`.

## Run

```bash
cd backend && npx tsx tests/retrieval_layer.test.ts
```

## Limits, honestly

- One node. The orchestrator, the peer and the client key live in one process. The multi-facility form needs a
  state orchestrator and district peers with enclave hardware (Azure DCsv3 or on-premise Xeon with SGX/TDX).
- The "enclave" is a worker thread. It gives isolation from the request path and real smudging, not hardware
  confidentiality. Never call it a TEE.
- The embedding is hashed TF-IDF over structured fields, not a neural model, by design (no LLM in the patient path).
  It finds presentations with shared findings, diagnoses and drugs; it does not understand free text.
- The reference shard is synthetic. Results from it are labelled `reference` on every screen.
- The threshold is fixed. The application's learning agent is a later step; its own validation showed a tuned fixed
  configuration performs as well.

## Roadmap to the claimed system

1. Second peer: run the retrieval service on a district server; the kiosk becomes a client holding the key.
2. Hardware enclave: Gramine-SGX build of the isolated evaluator with remote attestation (the patent folder's SGX kit).
3. Attested telemetry and the decryption quorum (claims 16, 17).
4. Learned threshold and compression level once two or more nodes produce non-stationary load.
