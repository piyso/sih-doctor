# MASTER REFINEMENTS SPECIFICATION (VOLUME I)

## The Definitive Manual of Optical, Tactile, Acoustic & Micro-Interaction Craft

**Smart India Hackathon 2026 | Problem Statement ID:** `26047`  
**All India Institute of Ayurveda (AIIA) • Ministry of Ayush & MoHFW, Government of India**  
**Document Type:** Master Micro-Interaction Craft, Optical Illusions, Haptic Physics & Zero-Defect Design Refinements  
**Target Benchmarks:** Apple macOS Sonoma/Tahoe • Spotify Encore • YouTube Studio • Tesla Cockpit UI

---

## 1. Executive Craft Mandate: The Anatomy of "God-Tier" Refinement

The difference between mediocre software and world-class craft lies in **invisible micro-refinements**: the optical compensations, acoustic envelopes, subpixel anti-aliasing, spring physics, and friction-reducing micro-interactions that users feel subconsciously without consciously identifying.

This document establishes the **strict engineering specifications for every micro-refinement** across the entire AIIA Sovereign MediKiosk and Doctor Desk frontend.

---

## 2. Optical Illusions & Perceptual Balance (Beyond Pure Geometry)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   OPTICAL REFINEMENT LAWS & FORMULAS                                   │
├───────────────────────────────┬──────────────────────────────────────┬─────────────────────────────────┤
│ PHENOMENON                    │ NAIVE GEOMETRIC FAILURE              │ SOVEREIGN OPTICAL CURE          │
├───────────────────────────────┼──────────────────────────────────────┼─────────────────────────────────┤
│ 1. Play Triangle Center of Mass│ Placing triangle at geometric 50%    │ Shift triangle +1.5px right     │
│    (Spotify Hover Button)     │ looks left-heavy and unbalanced.     │ to align visual center of mass. │
├───────────────────────────────┼──────────────────────────────────────┼─────────────────────────────────┤
│ 2. Nested Corner Radii Math   │ Using same border-radius on outer card│ R_inner = max(0, R_outer - Pad) │
│    (Apple Nested Glass Cards) │ and inner elements causes visual gap.│ Ensures concentric curves.      │
├───────────────────────────────┼──────────────────────────────────────┼─────────────────────────────────┤
│ 3. Text Antialiasing on OLED  │ Browser default subpixel rendering   │ -webkit-font-smoothing:         │
│    (Pitch-Black Backgrounds)  │ creates colored fringing on black.   │ antialiased (greyscale smoothing│
├───────────────────────────────┼──────────────────────────────────────┼─────────────────────────────────┤
│ 4. Foveal Optical Contrast    │ White (#fff) on pitch black can bloom│ Body text: #8e8e93 / #c7c7cc;   │
│    (Preventing Astigmatism)   │ and cause halos for astigmatic eyes. │ Pure white (#fff) for active.   │
├───────────────────────────────┼──────────────────────────────────────┼─────────────────────────────────┤
│ 5. Indic Matra Clipping       │ Line-height 1.1 cuts top/bottom vowel│ line-height: 1.60 with 4px top/ │
│    (Devanagari, Bengali, etc.)│ markers (ि, ी, ु, ू, े, ै, ो, ौ, ं)   │ bottom padding buffer.          │
└───────────────────────────────┴──────────────────────────────────────┴─────────────────────────────────┘
```

### 2.1 Nested Concentric Radii Formula

To prevent awkward visual gaps in nested glass panels (such as cards inside containers or buttons inside cards):
$$R_{\text{inner}} = \max\left(0,\; R_{\text{outer}} - P\right)$$
Where $R_{\text{outer}}$ is the card radius and $P$ is the internal padding:

- Outer Kiosk Card: $R_{\text{outer}} = 20\text{px}$, Padding $P = 16\text{px} \implies R_{\text{inner}} = 4\text{px}$ to $6\text{px}$.
- Floating Dynamic Island: $R_{\text{outer}} = 9999\text{px}$ (Pill), Inner Button: $R_{\text{inner}} = 9999\text{px}$.
- Tile Controls: $R_{\text{outer}} = 16\text{px}$, Padding $P = 12\text{px} \implies R_{\text{inner}} = 8\text{px}$.

---

## 3. The Physics of Tactile Feedback & Spring Mechanics

### 3.1 Dual-Phase Spring Curves

Generic CSS `ease` or `ease-in-out` feels lifeless and sluggish. Our design system utilizes two calibrated cubic-bezier curves matching Apple SwiftUI spring physics:

```css
:root {
  /* Fluid Snap In (Entrance / Opening) */
  --ease-fluid: cubic-bezier(0.16, 1, 0.3, 1);

  /* Tactile Spring Snap (Release / Recoil / Checkmark) */
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.15);

  /* Snappy Micro-Feedback (Hover / Focus) */
  --ease-snappy: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 3.2 Physical Displacement on Active Press

When any primary button or interactive card is pressed by mouse or finger, it does not merely change color. It undergoes physical displacement:

```css
.tactile-button {
  transition:
    transform 120ms var(--ease-snappy),
    filter 120ms ease,
    box-shadow 120ms ease;
}

.tactile-button:active {
  transform: scale(0.972) translateY(1px);
  filter: brightness(0.92);
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.4),
    inset 0 1px 1px rgba(0, 0, 0, 0.3);
}
```

---

## 4. Acoustic Refinement: The Pure Web Audio Synthesizer

In busy hospital environments, audio feedback must never be harsh, grating, or repetitive. Our system generates pure mathematical acoustic waves directly in the browser with **zero external sound files**:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              PURE ACOUSTIC SYNTHESIS HARMONICS TABLE                                   │
├────────────────────┬───────────┬──────────────┬──────────────┬─────────────────────────────────────────┤
│ EVENT              │ WAVEFORM  │ FREQUENCY    │ DURATION     │ PSYCHOACOUSTIC INTENT                   │
├────────────────────┼───────────┼──────────────┼──────────────┼─────────────────────────────────────────┤
│ Touch / Tap Pop    │ Pure Sine │ 520Hz ➔ 320Hz│ 40ms         │ Soft organic droplet, tactile closure   │
│ Verhoeff D5 Lock   │ Pure Sine │ 587Hz ➔ 880Hz│ 180ms (D5➔A5)│ Ascending fifth: dopamine success chime │
│ Mannequin Pain Locus│ Dual Sine│ 440Hz + 660Hz│ 120ms        │ Warm resonant chord, verifies selection │
│ Emergency Red Flag │ Triangle  │ 340Hz Pulse  │ 350ms        │ Non-jarring low pulse: staff notice     │
│ Print Slip Fanfare │ Pure Sine │ 523➔659➔784Hz│ 240ms (C-E-G)│ Major Triad: institutional celebration  │
└────────────────────┴───────────┴──────────────┴──────────────┴─────────────────────────────────────────┘
```

---

## 5. Speech Scribe Refinement: The Apple Music Live Karaoke Engine

In the consultation room, the Ambient Scribe must transcribe speech smoothly without distracting the doctor or making them feel like they are reading terminal logs.

```
                  ┌────────────────────────────────────────────────────────┐
  Upcoming Line:  │  "सांस लेने में भी परेशानी महसूस हो रही है..."       │  opacity: 0.28, blur: 0.5px
  ────────────────┼────────────────────────────────────────────────────────┤
  ACTIVE SPOKEN:  │  "छाती में बहुत तेज भारीपन और दर्द है"                 │  opacity: 1.0, color: #fff
                  │                                                        │  text-shadow: 0 0 20px #fff
  ────────────────┼────────────────────────────────────────────────────────┤
  Preceding Line: │  "नमस्ते डॉक्टर साहब, मुझे दो दिन से..."               │  opacity: 0.35, blur: 0px
                  └────────────────────────────────────────────────────────┘
```

### 5.1 Real-Time Streaming Text Animation

- **Active Phrase Bloom:** As speech chunks arrive via the ASR stream, words appear with a soft luminance bloom:
  ```css
  .lyric-active {
    color: #ffffff;
    font-size: 22px;
    font-weight: 600;
    line-height: 1.5;
    text-shadow: 0 0 24px rgba(255, 255, 255, 0.4);
    transform: scale(1.02);
    transition: all 350ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  ```
- **Focal Plane Auto-Centering:** The container automatically scrolls using `scrollIntoView({ behavior: 'smooth', block: 'center' })` so the doctor's eye remains at the natural 45% focal plane.
- **Entity Capsule Ejection:** When an entity is recognized (e.g. `[Angina]` or `[BP 160/100]`), the pill tag pops into existence using a spring scale:
  `@keyframes entityPop { 0% { transform: scale(0.6) translateY(8px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }`.

---

## 6. The Verhoeff $D_5$ Dihedral Verification Ring Refinement

The Verhoeff algorithm operates over the non-abelian Dihedral Group $D_5$. It guarantees **100% detection of all single-digit substitution errors** and **100% detection of all adjacent transposition errors**.

### 6.1 Interactive SVG Ring Physics

- As digits 1 through 11 are entered, an SVG circular progress ring smoothly increments (`stroke-dashoffset`).
- The ring color remains a serene translucent cyan (`#06b6d4`).
- Upon entering the 12th digit, the Verhoeff permutation table evaluates in $< 0.5\text{ms}$.
- If valid ($c = 0$):
  1. The ring snaps with spring recoil into brilliant emerald (`#10b981`).
  2. The center numeral transitions to an SVG checkmark with animated path drawing (`stroke-dasharray`).
  3. The `playVerhoeffLock()` ascending chime sounds.
  4. The patient name and demographics auto-fill in 400ms.

---

## 7. Anatomical Mannequin Refinement: Holographic Glass Shader

### 7.1 Bio-Luminescent Ripple Shader

When an anatomical locus (e.g. Precordium, Head, Epigastrium) is touched:

1. **Bio-luminescent Glow:** The selected SVG path activates a multi-layered drop-shadow filter:
   `filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.9)) drop-shadow(0 0 24px rgba(16, 185, 129, 0.5));`.
2. **Radial Water Ripple:** An SVG `<circle>` expands outward from the hit center `(cx, cy)`:
   `r: 10px ➔ 60px; opacity: 0.8 ➔ 0; transition: all 600ms cubic-bezier(0.16, 1, 0.3, 1);`.
3. **Emergency Crimson Shift:** If the chest is touched and pain score is $\ge 8$, the color smoothly interpolates from emerald (`#10b981`) to emergency crimson (`#f43f5e`) over 300ms.

---

## 8. Prescribing Safety: The Inline Bayesian Conflict HUD Refinement

Traditional EHR popups are punitive and annoying; doctors habitually dismiss them. Our **Inline Bayesian Conflict Interception HUD** refines safety into an effortless collaborative assistant:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                INLINE BAYESIAN CONFLICT INTERCEPTION HUD                               │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ⚠️ CRITICAL LETHAL DRUG-HERB INTERACTION DETECTED                                                      │
│ ────────────────────────────────────────────────────────────────────────────────────────────────────── │
│ Clash: Warfarin Sodium (5mg OD) ⨉ Yogaraja Guggulu (2 Tablets BD)                                      │
│ Pharmacological Mechanism: Commiphora mukul (Guggulsterones) competitively inhibits CYP2C9 & CYP3A4    │
│ hepatic microsomal enzymes, leading to profound Warfarin accumulation and life-threatening hemorrhage. │
│                                                                                                        │
│ Statistical Evidence: Bayes Factor BF10 = 168.4 (Decisive Evidence on Jeffreys Scale)                  │
│ Posterior Probability P(H1|Data) = 0.9941 • 14 Documented Hemorrhagic Case Reports                     │
│                                                                                                        │
│ ┌──────────────────────────────────────────────────┐ ┌──────────────────────────────────────────────┐  │
│ │ [ ⚡ ONE-CLICK SWITCH TO RASNASAPTAKA KWATHA ]    │ │ [ Clinical Override with Justification... ]  │  │
│ └──────────────────────────────────────────────────┘ └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Inline Expansion:** It does not block the screen. It smoothly unrolls directly underneath the interacting drug row (`max-height: 0 ➔ 200px` with spring easing).
2. **One-Click Safe Alternative:** Instead of just telling the doctor what is wrong, it provides an instant, approved substitute (_Rasnasaptaka Kwatha_ does not inhibit CYP2C9 and has identical anti-arthritic efficacy). Clicking it swaps the prescription instantly in 1 tap!

---

## 9. Official AIIA Case-Sheet Print Refinement (`@media print`)

To prevent thermal roll burn-out and ensure statutory institutional validity:

```css
@media print {
  /* Absolute Reset to Stark Institutional Black & White */
  *,
  *::before,
  *::after {
    background: transparent !important;
    color: #000000 !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }

  body {
    background: #ffffff !important;
    font-size: 11pt;
    line-height: 1.4;
  }

  .no-print {
    display: none !important;
  }

  .print-only {
    display: block !important;
  }

  /* Razor Institutional Table Borders */
  .rx-table th,
  .rx-table td {
    border: 1px solid #000000 !important;
    padding: 6px 10px !important;
  }

  /* Scannable Optical QR Container */
  .print-qr-code {
    width: 140px;
    height: 140px;
    border: 2px solid #000000;
    padding: 6px;
    page-break-inside: avoid;
  }
}
```

---

## 10. Summary & Rebuild Readiness

With this **Master Refinements Specification**, every micro-interaction, sound wave, optical centering offset, spring curve, and print rule is now mathematically defined.

We are ready to execute **Phase 1: Foundations & Design Tokens** with absolute zero shortcuts.
