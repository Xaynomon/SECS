# Project Initialization: SECS (Standalone Electronic Circuit Simulator) - Phase 1: Core Architecture, UI Shell & Interactive Canvas

## 1. Project Overview & Tech Stack
You are building **SECS (Standalone Electronic Circuit Simulator)**, a desktop electronic circuit design and simulation application for Windows inspired by Cirkit Designer, Wokwi, and Falstad.
- **Framework:** React 18+ with TypeScript and Vite (configured to run cleanly in a desktop window / Electron-ready).
- **Styling:** Tailwind CSS + Lucide React icons.
- **State Management:** Zustand (for global circuit state: components, wires, simulation mode, theme, undo/redo history, and viewport transform).
- **Canvas Rendering:** HTML5 `<svg>` + `<canvas>` hybrid or high-performance interactive SVG viewport with hardware-accelerated CSS/SVG transforms for pan, zoom, grid snapping, and orthogonal wire routing.

## 2. Phase 1 Objectives
In this first phase, build the complete, production-grade **UI Shell, Theme Engine, Component Sidebar, Top Simulation Toolbar, and Interactive Grid Canvas** with full drag-and-drop component placement and customizable wire routing. Do NOT leave placeholder stubs—make Phase 1 fully interactive and functional.

---

## 3. Detailed Feature Specifications for Phase 1

### A. Theme Engine (Light & Dark Mode)
- Support instant toggling between **Dark Theme** (default, sleek modern PCB/CAD aesthetic with dark slate backgrounds `#0f172a` / `#1e293b`) and **Light Theme** (clean lab schematic style `#f8fafc` / `#ffffff`).
- Persist theme preference in `localStorage`.

### B. Top Control & Toolbar Bar (Cirkit-Inspired)
Create a sleek top navigation and control bar divided into logical groups:
1. **Branding & File Menu:**
   - App Logo & Title: `SECS` (with a subtle circuit icon).
   - Buttons: `New`, `Save (.secs)`, `Load`, `Export` (dropdown UI ready for PNG, SVG, BOM CSV).
2. **Edit & Viewport Controls:**
   - `Undo` (`Ctrl+Z`), `Redo` (`Ctrl+Y`), `Delete Selected` (`Del`), `Rotate 90°` (`R`), `Flip Horizontal` (`F`).
   - `Zoom In`, `Zoom Out`, `Fit to Screen`, and a live Zoom Percentage badge.
3. **Simulation Mode Selector (Segmented Pill Control):**
   - Modes: `LOGICAL` (Digital fast logic), `SPICE` (In-depth analog/physics), `MIXED` (Analog + Digital + MCU).
   - Display a subtle tooltip or badge indicating the active mode.
4. **Simulation Playback Controls:**
   - `Run / Play` (green), `Pause` (amber), `Stop / Reset` (red), `Step Forward` (single tick), and a `Simulation Speed` selector (`0.1x`, `0.5x`, `1x`, `2x`).
   - Live Simulation Clock / Status indicator (`Stopped`, `Running - 60 FPS`).
5. **Wire Color Picker & Instrument Launchers:**
   - Quick **Wire Color Swatch Picker** (Red, Black, Blue, Green, Yellow, Orange, Purple, White, Brown) so users can choose the active wire color before or after drawing a wire.
   - Toggle buttons for Bench Instruments (UI toggles ready for Phase 6): `Multimeter`, `Oscilloscope`, `Logic Analyzer`, and `Smart Tips Panel`.
   - `Theme Toggle` button (Sun/Moon icon).

### C. Left Sidebar: Searchable Component Library
- Collapsible left panel with a sticky **Search Bar** at the top (filters components in real time by name, tag, or description) and **Category Tabs / Accordions**:
  1. **Power & Sources:** DC Voltage Source (Battery), AC Source, VCC (+5V/+3.3V), Ground (GND), Coin Cell.
  2. **Passives:** Resistor, Capacitor (Ceramic & Electrolytic), Inductor, Potentiometer.
  3. **Semiconductors:** Diode, Zener Diode, NPN Transistor (2N2222), N-Channel MOSFET, Op-Amp (LM358).
  4. **Logic Gates:** AND, OR, NOT, NAND, NOR, XOR, 7-Segment Display, 555 Timer IC.
  5. **Microcontrollers:** Arduino Uno R3, ESP32 DevKit V1, Raspberry Pi Pico.
  6. **Sensors (Interactive Inputs):** Pushbutton, Toggle Switch, Temperature Sensor (NTC/TMP36), Light Sensor (LDR Photoresistor), Ultrasonic Distance Sensor.
  7. **Actuators & Outputs:** LED (Red, Green, Blue, Yellow), RGB LED, DC Cooling Fan, Piezo Buzzer, Relay Module.
- Each item in the sidebar must show a neat SVG thumbnail preview, name, and short category badge.

### D. Central Workspace: Infinite Snap-to-Grid Circuit Canvas
1. **Grid & Viewport:**
   - Render a responsive dot or minor/major line grid (`20px` base grid unit).
   - Pan with Middle-Mouse Drag or `Space + Left Drag`. Zoom smoothly toward the cursor using the Mouse Wheel (`25%` to `400%`).
2. **Drag-and-Drop Component Placement & Snapping:**
   - Dragging any component from the Left Sidebar onto the canvas spawns an instance snapped strictly to the `20px` grid coordinates.
   - Components on the canvas must render stylized, recognizable vector graphics (Cirkit-style: clean rounded IC bodies, colored resistor bands, recognizable Arduino board silhouette, fan blades, LED bulb dome) with distinct **Interactive Pin Terminals**.
   - Hovering over any pin highlights the pin and displays a tooltip with the Pin Name (e.g., `VCC`, `GND`, `D13`, `Anode`, `Cathode`).
3. **Selection & Manipulation:**
   - Click to select a component or wire (shows a glowing selection outline).
   - Drag selected components across the canvas with strict grid snapping; connected wires must dynamically re-route and stay attached.
   - Support `R` key to rotate 90 degrees and `Delete`/`Backspace` to remove.
4. **Orthogonal Wire Routing & Color Customization:**
   - Clicking a component pin starts wire drawing mode; moving the mouse shows a live orthogonal (90-degree Manhattan-style) preview path snapped to the grid.
   - Clicking another pin completes the connection.
   - Allow clicking along the path while drawing to add manual bend waypoints.
   - Clicking an existing wire selects it, allowing the user to change its color via the Top Bar Wire Color Picker or delete it.

### E. Right Contextual Inspector & Smart Tips Drawer
- When a component or wire is selected, show a clean **Properties Inspector** on the right side:
  - Component Label/Designator (e.g., `R1`, `LED1`, `U1`).
  - Editable electrical parameters depending on component type (e.g., Resistance in $\Omega$/k$\Omega$, Voltage in $V$, Capacitance in $\mu F$, LED Color, Wire Color).
- At the bottom-right of the canvas, include a collapsible **"Smart Tips & Diagnostics" HUD card** that will display real-time circuit health warnings and configuration tips. Populate it initially with basic structural checks (e.g., *"Tip: Unconnected pins detected on R1"*, *"Tip: No Ground (GND) reference found in circuit"*).

## 4. Deliverable Expectations
- Write clean, modular TypeScript code split into logical folders (`src/components/`, `src/store/`, `src/types/`, `src/utils/`, `src/assets/`).
- Ensure all 7 component categories are populated with SVG visual renderers and accurate pin definitions so we can immediately build the Save/Load system and Simulation Engines in the next phases.
- Verify there are zero TypeScript or compilation errors and the app runs immediately via `npm run dev`.
