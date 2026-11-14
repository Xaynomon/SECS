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

---

## Screenshots
<img width="1862" height="1028" alt="Screenshot 2026-11-14 170438" src="https://github.com/user-attachments/assets/9324de8f-f082-4f74-b1f1-b7064c6c2abf" />
<img width="1864" height="1030" alt="Screenshot 2026-11-14 170405" src="https://github.com/user-attachments/assets/d900b599-c0f0-43f2-870e-dc73525c6690" />
<img width="1863" height="1030" alt="Screenshot 2026-11-14 165155" src="https://github.com/user-attachments/assets/81dae66f-0fb9-4edb-b42b-931d2e914b14" />
<img width="1863" height="1030" alt="Screenshot 2026-11-14 164953" src="https://github.com/user-attachments/assets/63eb602a-5fc4-426d-aacd-15d70faacfa8" />
<img width="1865" height="1030" alt="Screenshot 2026-11-14 164811" src="https://github.com/user-attachments/assets/9d049290-c427-4760-a9f8-df52d297f547" />
<img width="1864" height="1031" alt="Screenshot 2026-11-14 164541" src="https://github.com/user-attachments/assets/1545cd40-ec33-4fea-910f-f9a8df161385" />
<img width="1865" height="1079" alt="Screenshot 2026-11-14 163938" src="https://github.com/user-attachments/assets/8821682b-6659-46a3-a0e1-9276a09b25fd" />
<img width="1866" height="1079" alt="Screenshot 2026-11-14 163806" src="https://github.com/user-attachments/assets/2e4ed5c2-8423-4ca2-abfa-b9fbaf6c7829" />



