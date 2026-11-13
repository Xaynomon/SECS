# SECS: Standalone Electronic Circuit Simulator ⚡

SECS is a high-performance, standalone electronic CAD and circuit simulation suite built with React, TypeScript, and Vite. It bridges the gap between simple logic simulators and steep, netlist-heavy SPICE packages.

## 🚀 Live Demo & Key Features
- **Dual-Engine Real-Time Simulation:** Real-time 4-state digital logic propagation alongside an iterative Modified Nodal Analysis (MNA) SPICE solver.
- **Smart A* Auto-Router:** Manhattan-style pathfinding that routes wires cleanly around component boundaries and dynamically offsets parallel wire paths.
- **55+ Interactive Components:** Includes power supplies, passives, semiconductors, logic gates, programmable microcontrollers, electromechanical actuators, and virtual bench instruments.
- **Wireless & Physical Stimuli:** Real-time distance-based cursor manipulators (e.g., lighting up a solar panel via a virtual lightbulb cursor) and wireless RF/IR canvas communication.
- **Virtual Lab Bench:** Fully functioning 60 FPS Digital Multimeter, 2-Channel Oscilloscope (with trigger lock and MATH/XY modes), and 8-Channel Logic Analyzer.

---

## 🛠️ Technology Stack
- **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide Icons
- **State Management:** Zustand (optimized 60 FPS viewport rendering)
- **Graphics:** Hybrid SVG (interactive schematic canvas) & HTML5 Canvas (high-frequency wave traces)
- **Database / Local I/O:** IndexedDB (automatic background draft saving), JSON (.secs files), and CSV BOM export

---

## 📐 Mathematical & Physics Models Implemented
### 1. Modified Nodal Analysis (MNA)
The analog engine constructs and solves Kirchhoff's Current Law (KCL) matrices [G] * [V] = [I] on every 0.5ms sub-step using Backward-Euler companion models for capacitors and inductors, and iterative Newton-Raphson loops for non-linear diodes and LEDs.

### 2. A* Manhattan Pathfinding
Uses a customized A* cost function to find the shortest direct orthogonal path:
f(n) = g(n) + h(n)
Where g(n) penalizes unnecessary wire bends, perpendicular overlaps, and component boundary intersections.

---

## 💻 How to Run & Build Locally

### Prerequisites
Make sure you have Node.js installed.

### Installation
1. Clone the repository:
   git clone https://github.com/Xaynomon/SECS.git

2. Install dependencies:
   npm install

3. Start the Vite development server:
   npm run dev

4. Open http://localhost:5173 in your browser.
