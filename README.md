<div align="center">

# AuraGainCurveLab

**A 50-engine interactive gain-curve laboratory for the Web Audio API**

[![License: MIT](https://img.shields.io/badge/License-MIT-7ee787.svg)](LICENSE)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio%20API-Required-ff8a3d.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![WASM](https://img.shields.io/badge/WASM-Optional%20Fallback-4fd3c4.svg)](https://webassembly.org/)
[![Vanilla JS](https://img.shields.io/badge/Vanilla%20JS-No%20Build%20Step-fbbf24.svg)]()

</div>

---

## Overview

AuraGainCurveLab is a browser-based audio research tool that instantiates **50 independent gain-scaling engines**, each applying a mathematically distinct gain curve to a live audio source. It is designed for:

- **Audio engineers** exploring how different gain envelopes affect perceived loudness
- **DSP researchers** comparing curve algorithms side-by-side
- **Educators** demonstrating the relationship between linear amplitude scaling and logarithmic hearing
- **Developers** studying Web Audio API patterns, WASM integration, and real-time visualisation

Every engine operates on its own Web Audio graph, with independent source selection, cycle duration, and monitor volume — while a master bus provides global transport, source routing, and overall mix control.

---

## Features

### 50 Unique Gain Curves
Each engine implements a distinct mathematical function mapping cycle phase `p ∈ [0, 1]` to gain `g ∈ [0.01, 1.0]`:

| Category | Engines |
|----------|---------|
| **Basic** | Linear Descent, Exponential Decay, Logarithmic, Power 2/4/8/¼, Inverse Square, Hyperbolic, Arctangent |
| **Periodic** | Sine Tremolo, Sine Squared, Cosine Half, Sine Chirp, FM Modulation, AM Modulation, Beat Frequency |
| **Wave-shaped** | Square Gate, Triangle Wave, Sawtooth Up/Down, Pulse 10%/25%/50% |
| **Easing** | Smoothstep, Quintic Ease, Cubic Ease In/Out, Back Ease, Elastic, Circular |
| **Window** | Gaussian Bell, Parabolic, Swell |
| **Stepped** | Stepped 5, Staircase 10, Stutter 4× |
| **Envelope** | Hold & Decay, Attack-Sustain, Exponential Attack, Exponential Rise, Logarithmic Rise/Decay |
| **Dynamic** | Bounce, Chaos LFO, Random Walk, Fractal Noise, Damped Oscillation, Double Exponential, Sigmoid |

### Multi-Source Input
Per-engine and master-level source selection:
- **Tone** — Sine oscillator (440 Hz default)
- **Live Mic** — Real-time microphone capture
- **White Noise** — Flat spectral density
- **Pink Noise** — −3 dB/octave (Paul Kellet algorithm)
- **Brown Noise** — −6 dB/octave (cumulative integration)

### Precision Timing
Cycle durations from **2 seconds down to 1 millisecond**:
`2 s | 1 s | 0.5 s | 0.1 s | 0.05 s | 0.01 s | 0.005 s | 0.001 s`

### Dual-Bus Architecture
```
Source ─┬─► [gainBefore] ──► [analyserBefore] ──► ( metering only )
        │
        └─► [gainAfter]  ──► [analyserAfter]  ──► [monitorGain] ──► [masterGain] ──► [destination]
                              ↑ gain curve applied here
```

### Real-Time Visualisation
- **Curve preview** — Static shape with live playhead
- **Oscilloscope** — Time-domain waveform of the scaled output
- **dB readout** — Live RMS level before vs. after
- **Delta meter** — Level reduction in decibels

### WASM + JS Fallback
An embedded WebAssembly DSP module accelerates noise generation and RMS calculation. If WASM fails to instantiate (missing export, CSP restriction, unsupported browser), the app seamlessly falls back to:
- High-fidelity JS noise generators (Kellet pink, cumulative brown, white)
- Standard JS RMS-to-dBFS calculation

No functionality is lost. No user intervention required.

---

## Quick Start

No build step. No dependencies. Just serve and open.

```bash
# Clone or download
unzip auragaincurvelab.zip
cd auragaincurvelab

# Serve locally (any static server works)
npx serve .
# or
python3 -m http.server 8080
# or
php -S localhost:8080
```

Open `http://localhost:3000` (or `:8080`) in a modern browser.

> **Note:** Browsers require a secure context (`localhost` or HTTPS) for microphone access.

---

## Architecture

```
project/
├── index.html          # Entry point — minimal shell, dynamic grid injection
├── styles.css          # Dark theme, CSS Grid layout, responsive breakpoints
├── main.js             # Engine manager — 50-card grid, master controls, RAF loop
├── engine.js           # AudioEngine class — self-contained track with WAA graph
├── gain-curves.js      # 50 curve definitions (phase → gain functions)
├── visualizer.js       # Canvas drawing utilities (scope, preview, playhead)
├── wasm.js             # DSP module — WASM loader + JS fallback
└── README.md           # This file
```

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Vanilla JS, no bundler** | Zero build step; works served from any static host |
| **ES modules** | Clean dependency graph; native browser support |
| **One shared AudioContext** | Required by Web Audio API spec; all engines branch from it |
| **Master GainNode** | True master fader without touching per-engine monitor levels |
| **16-point curve sampling** | Non-linear curves (elastic, bounce, etc.) need sub-sample scheduling to avoid zipper noise |
| **requestAnimationFrame loop** | Single animation frame drives all 50 visualisers efficiently |
| **Dynamic DOM generation** | Cards injected at runtime; no brittle querySelector chains |

---

## Master Controls

| Control | Scope | Description |
|---------|-------|-------------|
| **▶ Start All** | Global | Starts every engine that isn't already running |
| **■ Stop All** | Global | Halts all engines and resets gain to unity |
| **Master Source** | All engines | Switches every engine's input simultaneously |
| **Master Duration** | All engines | Sets cycle duration on all engines simultaneously |
| **Master Monitor Volume** | Per-engine | Sets each engine's local monitor gain |
| **Master App Volume** | Overall mix | Scales the entire output bus (master fader) |

---

## Per-Engine Controls

Each of the 50 cards provides:
- **▶ / ■** — Individual start/stop
- **Source** dropdown — Tone / Mic / White / Pink / Brown
- **Duration** dropdown — 2s → 1ms
- **Monitor Volume** slider — 0–100%
- **Live readouts** — Current gain % and Δ dB

---

## Browser Compatibility

| Feature | Required | Fallback |
|---------|----------|----------|
| Web Audio API | ✅ Yes | N/A |
| WebAssembly | ❌ No | JS implementations |
| getUserMedia | ❌ No | Mic source disabled |
| ES Modules | ✅ Yes | N/A |

Tested on Chrome 120+, Firefox 121+, Safari 17+, Edge 120+.

---

## Safety Notes

- **Headphones recommended** when using Live Mic to avoid acoustic feedback
- Each engine has its own monitor volume — start low and adjust
- The Master App Volume is your final safety net
- Microphone audio is processed entirely in-browser; nothing is recorded, transmitted, or stored

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with the Web Audio API, Canvas 2D, and zero external dependencies.

</div>
