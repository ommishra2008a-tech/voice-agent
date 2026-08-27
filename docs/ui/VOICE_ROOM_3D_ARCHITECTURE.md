# 3D Spatial Voice Room Architecture

## 1. Spatial Scene Layout

The 3D AI Voice Room acts as an ambient, atmospheric background environment positioned behind the floating chat cards.

- **Theme Palette**:
  - Background: Deep Navy (`#050814`) to Deep Blue (`#0b142c`)
  - Cyber Facial Chassis: Dark Steel (`#081024`) with glowing Electric Cyan visor (`#00f0ff`) and Cyan Optic Eyes (`#38bdf8`)
  - Audio-Reactive Outer Aura: Wireframe Torus with Electric Cyan glow (`#00f0ff`)
  - Waveform: 32-bar spatial FFT visualizer reacting to audio energy

---

## 2. Dynamic Animations & Interaction

### 1. Organic Head Posture Tracking
- Tracks mouse pointer $X$ and $Y$ with linear interpolation (`lerp(rot, targetRot, 0.04)`).
- Natural idle breathing oscillation ($\sin(t \times 1.4) \times 0.04$).

### 2. Audio-Reactive Lip-Sync & Visemes
- Listens to Web Audio API `AnalyserNode` frequency spectrum during playback.
- Dynamically morphs mouth aperture geometry across visemes:
  - **A**: Height $= 1.3 \times \text{amplitude}$, Width $= 0.95$
  - **E**: Height $= 0.6 \times \text{amplitude}$, Width $= 1.4$
  - **I**: Height $= 0.35 \times \text{amplitude}$, Width $= 1.5$
  - **O**: Height $= 1.5 \times \text{amplitude}$, Width $= 0.75$
  - **U**: Height $= 0.9 \times \text{amplitude}$, Width $= 0.6$

### 3. Rainbow / Spectrum Cursor Flowing Trail
- Multi-point Catmull-Rom spline interpolation.
- Continuous dynamic HSL color progression: `hsl(${hue}, 100%, 65%)` with fading tail over 20 trail points.

### 4. Holographic Energy Click Ripple
- Triggered on mouse clicks: expanding cyan/purple holographic ping with 600ms TTL.
