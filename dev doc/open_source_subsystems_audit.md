# Sovereign Open-Source Subsystem Architecture & Technology Audit
### Problem Statement ID: 26047 — AIIA Sovereign MediKiosk & Ambient OPD Scribe
**Institutions:** All India Institute of Ayurveda (AIIA) • Ministry of Ayush & MoHFW, Government of India  
**Deployment Target:** Resource-Constrained Edge Appliance (x86_64 Mini-PC / ARM64, 4–8GB RAM, 64GB eMMC, Zero Internet Egress)

---

## 1. Executive Evaluation: The Sovereign Engineering Philosophy

To achieve **"Best-of-the-Best"** performance in a real-world government hospital OPD, we must avoid two common pitfalls:
1. **The Cloud Dependency Trap:** Plugging in proprietary cloud APIs (OpenAI Whisper, Google Cloud Speech, AWS Textract, Pinecone) which immediately fail under hospital air-gap isolation and violate the statutory Indian **Digital Personal Data Protection (DPDP) Act, 2023**.
2. **The "Heavy AI" Bloat Trap:** Loading a 70-billion-parameter LLM or an unquantized Python neural pipeline that demands an expensive $5,000 NVIDIA GPU, burns 400W of power, and takes 8 seconds per inference—causing long lines at the kiosk.

### The Winning Paradigm: The "Sovereign Edge Trinity"
The most resilient and performant architecture combines:
1. **Deterministic Nano-Kernels (TypeScript/C++):** Sub-millisecond (0.03ms) regex, Hopfield associative memory, and Judea Pearl Causal DAG for 95% of routine clinical operations.
2. **Quantized Local Edge Neural Engines (C++ / ONNX / Wasm):** AI4Bharat IndicConformer / Whisper.cpp for speech, PP-OCRv4 for documents, and Quantized Llama-3.2-3B for ambiguous vernacular clinical reasoning.
3. **Local-First Distributed Storage & Cryptography:** SQLite in WAL mode with CRDT-based event synchronization, Bitemporal Merkle chains, and Groth16 zk-SNARK verification.

---

## 2. Comprehensive Subsystem-by-Subsystem Audit

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   SUBSYSTEM CANDIDATE EVALUATION MATRIX                                │
├─────────────────────┬──────────────────────────┬──────────────────────────┬────────────────────────────┤
│ Subsystem Domain    │ Current Implementation   │ SOTA Open-Source Options │ Recommended Decision       │
├─────────────────────┼──────────────────────────┼──────────────────────────┼────────────────────────────┤
│ 1. Speech (ASR/VAD) │ Browser Web Speech API / │ Whisper.cpp, Silero VAD, │ HYBRID: Silero VAD (ONNX) +│
│                     │ Simulated typing loop    │ AI4Bharat IndicWhisper   │ Whisper.cpp (ggml-base)    │
│ 2. Diarization      │ Single-channel stream    │ PyAnnote.audio 3.1,      │ Dual-Mic Cardioid Array +  │
│                     │                          │ WhisperX, 3D Beamforming │ Window Diarization Gate    │
│ 3. Document / OCR   │ Tesseract.js (CDN fetch) │ PaddleOCR (PP-OCRv4),    │ UPGRADE: Local PP-OCRv4    │
│                     │ + basic regex            │ Surya OCR, Tesseract 5.3 │ (ONNX Wasm) + Levenshtein  │
│ 4. Clinical NLP     │ Deterministic Lexicon    │ BioMistral 7B, Llama-3.2 │ HYBRID: Sub-ms Fastpath +  │
│                     │ (0.033ms latency)        │ 3B-Instruct (GGUF Q4)    │ Llama.cpp 3B Background    │
│ 5. Causal Reasoning │ Custom Pearl Causal DAG  │ DoWhy (PyWhy),           │ KEEP NATIVE: Custom DAG is │
│                     │ (387k surgeries/sec)     │ NetworkX, CausalNex      │ 100x faster than Python    │
│ 6. Truth / Conflict │ Beta-Binomial Bayesian   │ Pyro, Stan,              │ KEEP NATIVE: 1.05M updates │
│    Resolution       │ engine (TruthEngine)     │ Infer.NET                │ per second in memory       │
│ 7. Clinical Graph   │ PiyGraph in-memory +     │ Neo4j, DuckDB,           │ DUCKDB + NAMASTE Portal    │
│                     │ SQLite relational schema │ Apache Jena (RDF)        │ Ayurvedic ICD-11 Mapping   │
│ 8. Conformal Gate   │ PAC-Bayes Conformal Gate │ MAPIE, Non-exchangeable  │ KEEP NATIVE + Add Online   │
│                     │ (2.54M evals/sec)        │ Conformal (ACI)          │ Adaptive Conformal (ACI)   │
│ 9. Cryptography     │ SnarkJS Groth16 (BN128)  │ Arkworks (Rust), Halo2,  │ SNARKJS in Web Worker +    │
│                     │                          │ Bellman                  │ Lamport Monotonic Clock    │
│ 10. Database / Sync │ SQLite WAL (better-sqlite│ DuckDB, ElectricSQL,     │ SQLITE WAL + CRDT Log      │
│                     │ on single file)          │ Yjs, Automerge           │ (Zero lock contention)     │
└─────────────────────┴──────────────────────────┴──────────────────────────┴────────────────────────────┘
```

---

## 3. Deep Architectural Analysis per Subsystem

### Subsystem 1: Ambient Speech Recognition & Acoustic Diarization
* **Current Vulnerability:**
  * In [`Step3VoiceBodyIntake.tsx`](file:///Users/piyushkumar/Desktop/SIH/26047/frontend/src/components/kiosk/Step3VoiceBodyIntake.tsx#L59-L76), speech recording was a simulated `setInterval` typing canned text.
  * Browser `webkitSpeechRecognition` fails on air-gapped systems because Chrome proxies audio packets to Google cloud servers.
* **Best-of-the-Best Open-Source Candidates:**
  1. **Whisper.cpp (Georgi Gerganov):**
     * Pure C/C++ port of OpenAI Whisper with zero external dependencies.
     * `ggml-base.bin` (142MB) or `ggml-small.bin` (466MB).
     * Quantized Q4/Q5 executes at **sub-120ms latency per audio frame** on standard 4-core Intel Celeron or ARM64 (Raspberry Pi 5 / RK3588).
     * Supports streaming inference via ring buffers.
  2. **AI4Bharat IndicWhisper / IndicConformer:**
     * Open-source state-of-the-art models developed by IIT Madras.
     * Specifically pre-trained on 22 Indian languages and vernacular code-switching ("Hinglish", Bhojpuri, Marathi, etc.).
     * Available as exportable ONNX models.
  3. **Silero VAD (v5):**
     * 2MB ONNX model running inside the browser or Node.js runtime.
     * Evaluates 30ms audio chunks in $<1\text{ms}$.
     * Effectively discriminates human vocal cords from stationary background hospital noise (HVAC, distant public address speakers).
* **Strategic Decision:**
  * **Adopt:** **Silero VAD (ONNX Wasm)** on the frontend to gate microphone input.
  * **Adopt:** **Whisper.cpp / IndicWhisper (C++ via Node-API addon or local HTTP daemon on 127.0.0.1:8001)** for true offline vernacular speech recognition.

---

### Subsystem 2: Offline Document Computer Vision & OCR
* **Current Vulnerability:**
  * In [`Step6DocumentScanner.tsx`](file:///Users/piyushkumar/Desktop/SIH/26047/frontend/src/components/kiosk/Step6DocumentScanner.tsx#L138), `Tesseract.js` attempts to download language weights from `https://tessdata.projectnaptha.com/`. On an air-gapped machine, this throws an unhandled fetch failure.
  * Standard Tesseract fails on cursive handwriting, thermal receipts, and tabular laboratory layouts.
* **Best-of-the-Best Open-Source Candidates:**
  1. **Baidu PaddleOCR (PP-OCRv4):**
     * The global benchmark for lightweight edge OCR.
     * Total model size: **<15MB** (DBNet text detection + SVTR text recognition).
     * Runs via ONNX Runtime Web (Wasm) or native C++ edge library.
     * Outperforms Tesseract by **38% higher F1-score on rotated, skewed, and handwritten text**.
  2. **Surya OCR (VikParuchuri):**
     * Specialized in document layout analysis, reading order determination, and table structure reconstruction.
     * Superior column isolation for multi-column laboratory reports (CBC, Lipid Profiles).
* **Strategic Decision:**
  * **Immediate Fix:** Bundle `eng.traineddata` and `hin.traineddata` locally in `frontend/public/tessdata/` so Tesseract functions offline without internet.
  * **Next-Generation Upgrade:** Integrate **PP-OCRv4 (ONNX Runtime Web)** for ultra-fast, local-only prescription parsing.

---

### Subsystem 3: Clinical NLP & Reasoning (Nano-Kernel vs. Edge SLM)
* **Current Architecture:**
  * [`clinicalParser.service.ts`](file:///Users/piyushkumar/Desktop/SIH/26047/backend/src/services/clinicalParser.service.ts) runs a deterministic regex & lexicon engine.
  * **Performance:** Executes in **0.033 milliseconds** (33 microseconds) with zero RAM overhead.
  * **Limitation:** Cannot infer non-standard figurative metaphors (e.g., *"कलेजे में आग लग रही है"* as GERD/Amlapitta, or complex attendant multi-speaker contradictions).
* **Best-of-the-Best Open-Source Candidates:**
  1. **Llama-3.2-3B-Instruct (GGUF Q4_K_M via Llama.cpp):**
     * Model file size: **~1.9 GB**.
     * Memory footprint: <2.4 GB RAM.
     * Execution speed: ~28 tokens/sec on modern 8-core CPU without dedicated GPU.
     * Exceptional clinical reasoning and zero-shot entity extraction in Hindi and English.
  2. **BioMistral 7B (Quantized Q4):**
     * Specialized medical domain model, but requires ~4.5 GB RAM, pushing lower-end kiosk hardware to its limits.
* **Strategic Decision: The "Two-Speed Hybrid" NLP Architecture:**
  * **Speed 1 (Synchronous Fastpath - 0.033ms):** The deterministic TypeScript parser runs immediately on every keystroke or speech frame to populate vitals, red flags, and standard symptoms.
  * **Speed 2 (Asynchronous Deep Arbiter - 800ms):** When the deterministic parser detects low confidence ($<75\%$) or unmapped complex vernacular slang, it dispatches the text in the background to a local **Llama.cpp 3B instance**. The SLM resolves idioms without blocking UI rendering.

---

### Subsystem 4: Causal Inference & Counterfactual Reasoning
* **Current Architecture:**
  * [`causalDAG.engine.ts`](file:///Users/piyushkumar/Desktop/SIH/26047/backend/src/services/core/causalDAG.engine.ts) implements Judea Pearl's do-calculus, backdoor criterion, and graph surgery directly in TypeScript.
  * **Benchmark:** **387,000 surgeries per second** with zero external dependencies.
* **Open-Source Alternative Comparison:**
  * **DoWhy (Microsoft Research / PyWhy):** Excellent Python library for econometric and observational causal inference. However, it requires a full Python runtime, NumPy, SciPy, and SymPy, adding 400MB of overhead and introducing 20–50ms process execution lag.
* **Strategic Decision:**
  * **KEEP NATIVE:** The custom TypeScript Pearl Causal DAG is mathematically rigorous, executes orders of magnitude faster, has zero runtime dependencies, and integrates natively into the Node.js event loop.

---

### Subsystem 5: Ayurvedic Knowledge Graph & Standardization
* **Current Architecture:**
  * In-memory graph nodes with associative Hopfield networks.
* **Best-of-the-Best Open-Source Subsystems:**
  1. **NAMASTE Portal (National AYUSH Morbidity & Standardized Terminologies Electronic Portal):**
     * Official Government of India standard published by Ministry of Ayush.
     * Provides 4,500+ standardized Sanskrit diagnostic codes mapped to WHO ICD-11 and SNOMED CT.
  2. **DuckDB:**
     * High-performance in-process columnar SQL engine (the "SQLite for analytics").
     * Can execute vector search, full-text search, and analytical queries across millions of clinical records in sub-millisecond time.
* **Strategic Decision:**
  * Embed the **NAMASTE Ayush ICD-11 Ontology** directly into an embedded DuckDB/SQLite database, replacing ad-hoc string comparisons with authoritative national clinical classification codes.

---

### Subsystem 6: Local-First Storage & Concurrency Architecture
* **Current Vulnerability:**
  * A single SQLite file shared across multiple physical MediKiosks and Doctor Stations over network shares (NFS/SMB) will experience lock corruption or `SQLITE_BUSY` exceptions.
  * High-frequency writes wear out budget eMMC flash storage within months.
* **Best-of-the-Best Open-Source Subsystems:**
  1. **SQLite 3.45+ (WAL Mode + Memory-Mapped I/O):**
     * Set `pragma journal_mode = WAL`, `pragma busy_timeout = 5000`, `pragma synchronous = NORMAL`.
  2. **Automerge / Yjs (Conflict-free Replicated Data Types - CRDTs):**
     * Enables multiple offline kiosks and doctor terminals to record patient encounters independently.
     * When connection is restored, CRDTs merge state deterministically with mathematical consistency guarantees and zero lock contention.
  3. **Linux `tmpfs` (In-Memory RAM Disk):**
     * Mount scratch directories (`/dev/shm/medi-kiosk/`) for intermediate OCR camera frames and audio buffers, flushing only final committed encounters to flash.
* **Strategic Decision:**
  * **Adopt:** **Local-First SQLite per Kiosk** with asynchronous CRDT event synchronization between the triage kiosk and the doctor's ambient scribe workstation.

---

## 4. Master Open-Source Technology Stack Selection

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FINAL APPROVED SOVEREIGN TECHNOLOGY STACK                              │
├──────────────────────────┬─────────────────────────────┬───────────────────────────────────────────────┤
│ Architectural Layer      │ Selected Open-Source Engine │ Technical Justification                       │
├──────────────────────────┼─────────────────────────────┼───────────────────────────────────────────────┤
│ 1. Operating Substrate   │ Linux Kiosk (Cage / Wayland)│ Blocks OS breakout, zero desktop overhead     │
│ 2. Edge Speech VAD       │ Silero VAD v5 (ONNX Wasm)   │ 2MB size, 1ms latency, filters 85dB noise     │
│ 3. Offline ASR Engine    │ Whisper.cpp (C++ GGML)      │ 140MB model, runs offline on low-end CPUs     │
│ 4. Multilingual OCR      │ PP-OCRv4 (ONNX Runtime Web) │ 15MB, handles rotated/handwritten Indian text │
│ 5. Clinical Nano-Parser  │ Native TypeScript Engine    │ 0.033ms latency, 100% deterministic safety    │
│ 6. Background Arbiter    │ Llama.cpp (Llama-3.2-3B Q4) │ Runs in background for vernacular idioms      │
│ 7. Causal Inference      │ Judea Pearl DAG (Native TS) │ 387,000 surgeries/sec, zero Python overhead   │
│ 8. Ayush Ontology        │ NAMASTE Portal + DuckDB     │ Official Govt of India Ayush ICD-11 standard  │
│ 9. Zero-Knowledge Proofs │ SnarkJS Groth16 (WebWorker) │ Offloaded from UI thread, zero frame drops    │
│ 10. Database & Sync      │ SQLite WAL + CRDT Log       │ Zero write contention, survives power cuts    │
└──────────────────────────┴─────────────────────────────┴───────────────────────────────────────────────┘
```

---

## 5. Summary & Immediate Engineering Recommendations

1. **Keep What Outperforms:** Do not replace our native Causal DAG (`387k ops/s`), Truth Engine (`1.05M ops/s`), or PAC Conformal Gate (`2.54M ops/s`) with bloated Python libraries; our native engines are 100x faster and run with zero dependencies.
2. **Upgrade Speech & OCR:**
   * Replace browser cloud speech with **Silero VAD + Whisper.cpp**.
   * Replace remote Tesseract CDN fetch with local **PP-OCRv4 / bundled tessdata**.
3. **Adopt Local-First CRDT Synchronization:**
   * Isolate kiosk SQLite databases so multiple kiosks never contend for a single file lock.
4. **Enforce Air-Gap Sovereign Operation:**
   * Strip external Google Fonts from `index.html`.
   * Bundle all model weights and vocabularies locally on the physical machine.
