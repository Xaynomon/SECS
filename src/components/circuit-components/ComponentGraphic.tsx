import React from 'react';
import { CircuitComponent, ComponentDefinition } from '../../types/circuit';
import { calculateResistorBands } from '../../utils/resistorColors';
import { useCircuitStore } from '../../store/useCircuitStore';

interface ComponentGraphicProps {
  component: CircuitComponent;
  definition: ComponentDefinition;
  isSelected: boolean;
  theme: 'dark' | 'light';
}

export const ComponentGraphic: React.FC<ComponentGraphicProps> = ({
  component: rawComponent,
  definition,
  isSelected,
  theme,
}) => {
  const simRunning = useCircuitStore((s) => s.simulationStatus === 'running');
  const component = simRunning ? rawComponent : { ...rawComponent, state: undefined };
  const { type, properties } = component;
  const isDark = theme === 'dark';
  const leadColor = isDark ? '#94a3b8' : '#64748b';
  const bodyStroke = isDark ? '#475569' : '#334155';
  const accentColor = '#38bdf8';

  const renderVisual = () => {
    switch (type) {
      // ----------------------------------------------------
      // 1. POWER & SOURCES
      // ----------------------------------------------------
      case 'dc-source': {
        const v = properties.voltage ?? 9;
        return (
          <g>
            {/* Terminal Leads */}
            <line x1="0" y1="20" x2="26" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="54" y1="20" x2="80" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            {/* Negative Plate (-) */}
            <rect x="26" y="10" width="6" height="20" rx="1.5" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1" />
            {/* Positive Plate (+) */}
            <rect x="48" y="4" width="6" height="32" rx="1.5" fill="#ef4444" stroke="#b91c1c" strokeWidth="1" />
            {/* Polarity Silkscreen */}
            <text x="64" y="16" fill="#ef4444" fontSize="12" fontWeight="bold" textAnchor="middle">+</text>
            <text x="14" y="16" fill="#3b82f6" fontSize="14" fontWeight="bold" textAnchor="middle">-</text>
            {/* Sub-label inside cell gap */}
            <text x="40" y="23" fill={leadColor} fontSize="8" fontWeight="bold" textAnchor="middle">
              {v}V
            </text>
          </g>
        );
      }

      case 'ac-source': {
        const wf = properties.waveform || 'sine';
        return (
          <g>
            {/* Leads */}
            <line x1="0" y1="20" x2="22" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="58" y1="20" x2="80" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            {/* Generator Dial Outer Rim */}
            <circle cx="40" cy="20" r="18" fill={isDark ? '#0f172a' : '#f8fafc'} stroke={bodyStroke} strokeWidth="2" />
            <circle cx="40" cy="20" r="15" fill="none" stroke={isDark ? '#1e293b' : '#e2e8f0'} strokeWidth="1" />
            {/* Dynamic Waveform Symbol */}
            {wf === 'square' ? (
              <path
                d="M 29 24 L 29 16 L 36 16 L 36 24 L 44 24 L 44 16 L 51 16"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : wf === 'triangle' ? (
              <path
                d="M 29 23 L 35 15 L 45 25 L 51 17"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : wf === 'sawtooth' ? (
              <path
                d="M 29 23 L 39 15 L 39 23 L 49 15"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <path
                d="M 30 20 Q 35 11, 40 20 T 50 20"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )}
          </g>
        );
      }

      case 'vcc': {
        return (
          <g>
            {/* Lead going down to pin (20, 40) */}
            <line x1="20" y1="40" x2="20" y2="18" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            {/* Arrowhead */}
            <polygon points="10,18 30,18 20,4" fill="#ef4444" stroke="#b91c1c" strokeWidth="1" />
            {/* Rail Voltage text */}
            <text x="20" y="32" fill="#ef4444" fontSize="9" fontWeight="bold" textAnchor="middle">
              +{properties.voltage ?? 5}V
            </text>
          </g>
        );
      }

      case 'gnd': {
        return (
          <g>
            {/* Stem from pin (20, 0) to ground bar */}
            <line x1="20" y1="0" x2="20" y2="18" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            {/* 3 Decreasing Earth Bars */}
            <line x1="4" y1="18" x2="36" y2="18" stroke={leadColor} strokeWidth="3.5" strokeLinecap="round" />
            <line x1="10" y1="25" x2="30" y2="25" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="16" y1="32" x2="24" y2="32" stroke={leadColor} strokeWidth="2" strokeLinecap="round" />
          </g>
        );
      }

      case 'coin-cell': {
        return (
          <g>
            {/* Leads */}
            <line x1="0" y1="20" x2="22" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="58" y1="20" x2="80" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            {/* Shiny Metallic Coin Cell Rim */}
            <circle cx="40" cy="20" r="18" fill={isDark ? '#334155' : '#e2e8f0'} stroke="#94a3b8" strokeWidth="2" />
            <circle cx="40" cy="20" r="14" fill={isDark ? '#1e293b' : '#f1f5f9'} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 2" />
            <text x="40" y="17" fill={isDark ? '#94a3b8' : '#475569'} fontSize="7.5" fontWeight="bold" textAnchor="middle">CR2032</text>
            <text x="40" y="27" fill="#ef4444" fontSize="9.5" fontWeight="bold" textAnchor="middle">+3V</text>
          </g>
        );
      }

      // ----------------------------------------------------
      // 2. PASSIVES (Resistor with dynamic 4 bands, Capacitors, etc.)
      // ----------------------------------------------------
      case 'resistor': {
        const bands = calculateResistorBands(properties.resistance ?? 1000, properties.tolerance ?? 5);
        return (
          <g>
            {/* Axial Lead Wires */}
            <line x1="0" y1="20" x2="18" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="62" y1="20" x2="80" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />

            {/* Silver Metal End Caps */}
            <rect x="18" y="11" width="5" height="18" rx="2" fill="#94a3b8" stroke="#64748b" strokeWidth="1" />
            <rect x="57" y="11" width="5" height="18" rx="2" fill="#94a3b8" stroke="#64748b" strokeWidth="1" />

            {/* Realistic Hourglass Resistor Ceramic Body */}
            {/* Left bulb -> narrow waist -> right bulb */}
            <path
              d="M 23 11
                 C 25 11, 28 13, 31 14
                 C 37 15, 43 15, 49 14
                 C 52 13, 55 11, 57 11
                 L 57 29
                 C 55 29, 52 27, 49 26
                 C 43 25, 37 25, 31 26
                 C 28 27, 25 29, 23 29
                 Z"
              fill={isDark ? '#d4b182' : '#fef3c7'}
              stroke="#b45309"
              strokeWidth="1.2"
            />

            {/* Dynamic 4 Color Bands */}
            {/* Band 1 (1st Digit) */}
            <rect x="25" y="12" width="4" height="16" fill={bands.band1} rx="0.5" />
            {/* Band 2 (2nd Digit) */}
            <rect x="33" y="13" width="4" height="14" fill={bands.band2} rx="0.5" />
            {/* Band 3 (Multiplier) */}
            <rect x="42" y="13" width="4" height="14" fill={bands.multiplier} rx="0.5" />
            {/* Band 4 (Tolerance: Gold/Silver) */}
            <rect x="51" y="12" width="3.5" height="16" fill={bands.tolerance} rx="0.5" />
          </g>
        );
      }

      case 'capacitor-ceramic': {
        const cVal = properties.capacitance ?? 100;
        const code = cVal >= 1000 ? `${cVal / 1000}µ` : cVal === 100 ? '104' : `${cVal}n`;
        return (
          <g>
            {/* Solder Leads */}
            <line x1="0" y1="20" x2="26" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="54" y1="20" x2="80" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />

            {/* Ceramic Orange/Tan Disc Body */}
            <circle cx="40" cy="20" r="14" fill="#ea580c" stroke="#9a3412" strokeWidth="1.5" />
            {/* Gloss Highlight */}
            <ellipse cx="36" cy="15" rx="6" ry="3" fill="#fdba74" opacity="0.6" transform="rotate(-20 36 15)" />
            {/* Markings */}
            <text x="40" y="23" fill="#ffffff" fontSize="8.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              {code}
            </text>
          </g>
        );
      }

      case 'capacitor-electrolytic': {
        return (
          <g>
            {/* Leads */}
            <line x1="0" y1="20" x2="24" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="56" y1="20" x2="80" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />

            {/* Main Black Aluminum Can Cylinder */}
            <rect x="24" y="6" width="32" height="28" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />

            {/* Distinct Silver Cathode Negative Stripe */}
            <rect x="24" y="6" width="8" height="28" rx="1" fill="#cbd5e1" />
            <text x="28" y="16" fill="#0f172a" fontSize="8" fontWeight="black" textAnchor="middle">-</text>
            <text x="28" y="26" fill="#0f172a" fontSize="8" fontWeight="black" textAnchor="middle">-</text>

            {/* Anode Plus Indicator */}
            <text x="46" y="24" fill="#ef4444" fontSize="12" fontWeight="bold" textAnchor="middle">+</text>

            {/* Top Crimp Vent Indentation */}
            <path d="M 38 7 L 44 7 M 41 5 L 41 9" stroke="#334155" strokeWidth="1" strokeLinecap="round" />
          </g>
        );
      }

      case 'inductor': {
        return (
          <g>
            <line x1="0" y1="20" x2="16" y2="20" stroke={leadColor} strokeWidth="2.5" />
            <line x1="64" y1="20" x2="80" y2="20" stroke={leadColor} strokeWidth="2.5" />
            {/* 4 Copper Wire Coils */}
            <path
              d="M 16 20 A 6 6 0 0 1 28 20 A 6 6 0 0 1 40 20 A 6 6 0 0 1 52 20 A 6 6 0 0 1 64 20"
              fill="none"
              stroke="#b45309"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Metallic core line */}
            <line x1="20" y1="9" x2="60" y2="9" stroke={leadColor} strokeWidth="1.5" strokeDasharray="3 2" />
          </g>
        );
      }

      case 'potentiometer': {
        const pct = properties.position ?? 50;
        const angle = -120 + (pct / 100) * 240; // -120 to +120 deg
        return (
          <g>
            {/* 3 Pins */}
            <line x1="0" y1="40" x2="16" y2="40" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="64" y1="40" x2="80" y2="40" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="40" y1="0" x2="40" y2="16" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />

            {/* Blue trimmer body */}
            <rect x="16" y="14" width="48" height="52" rx="4" fill="#0284c7" stroke="#0369a1" strokeWidth="1.5" />

            {/* Rotary dial disc */}
            <circle cx="40" cy="40" r="16" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
            {/* Wiper Notch */}
            <g transform={`rotate(${angle} 40 40)`}>
              <line x1="40" y1="40" x2="40" y2="27" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
              <polygon points="40,25 37,29 43,29" fill="#ef4444" />
            </g>
          </g>
        );
      }

      // ----------------------------------------------------
      // 3. SEMICONDUCTORS (Diode, Zener, NPN, MOSFET, Op-Amp)
      // ----------------------------------------------------
      case 'diode': {
        return (
          <g>
            <line x1="0" y1="20" x2="22" y2="20" stroke={leadColor} strokeWidth="2.5" />
            <line x1="58" y1="20" x2="80" y2="20" stroke={leadColor} strokeWidth="2.5" />

            {/* Black Cylinder Body DO-41 */}
            <rect x="22" y="11" width="36" height="18" rx="3" fill="#18181b" stroke="#3f3f46" strokeWidth="1.5" />

            {/* Silver Cathode Stripe Band */}
            <rect x="48" y="11" width="6" height="18" rx="0.5" fill="#e2e8f0" />

            {/* Silkscreen text */}
            <text x="35" y="23" fill="#a1a1aa" fontSize="7" fontWeight="bold" textAnchor="middle">
              1N4007
            </text>
          </g>
        );
      }

      case 'zener-diode': {
        return (
          <g>
            <line x1="0" y1="20" x2="24" y2="20" stroke={leadColor} strokeWidth="2" />
            <line x1="56" y1="20" x2="80" y2="20" stroke={leadColor} strokeWidth="2" />

            {/* Glass body */}
            <rect x="24" y="12" width="32" height="16" rx="3" fill="#fb923c" opacity="0.85" stroke="#c2410c" strokeWidth="1.5" />
            {/* Black cathode band */}
            <rect x="48" y="12" width="5" height="16" fill="#0f172a" />
            {/* Bent Zener line */}
            <path d="M 46 14 L 49 14 L 49 26 L 52 26" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
          </g>
        );
      }

      case 'transistor-npn': {
        return (
          <g>
            <line x1="-40" y1="0" x2="-10" y2="0" stroke={leadColor} strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="-40" x2="0" y2="-24" stroke={leadColor} strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="24" x2="0" y2="40" stroke={leadColor} strokeWidth="2" strokeLinecap="round" />

            <circle cx="0" cy="0" r="26" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1="-10" y1="-16" x2="-10" y2="16" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />

            {/* Collector line */}
            <line x1="-10" y1="-8" x2="0" y2="-24" stroke="#f8fafc" strokeWidth="2" />
            {/* Emitter line with outward-pointing arrow (NPN) */}
            <line x1="-10" y1="8" x2="0" y2="24" stroke="#f8fafc" strokeWidth="2" />
            <polygon points="-2,20 -9,15 -3,12" fill="#f97316" />

            <text x="12" y="4" fill="#94a3b8" fontSize="7" fontWeight="bold">NPN</text>
            <text x="-25" y="-4" fill="#cbd5e1" fontSize="5.5">B</text>
            <text x="4" y="-28" fill="#cbd5e1" fontSize="5.5">C</text>
            <text x="4" y="32" fill="#cbd5e1" fontSize="5.5">E</text>
          </g>
        );
      }

      case 'mosfet-n': {
        return (
          <g>
            <line x1="-40" y1="0" x2="-14" y2="0" stroke={leadColor} strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="-40" x2="0" y2="-22" stroke={leadColor} strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="22" x2="0" y2="40" stroke={leadColor} strokeWidth="2" strokeLinecap="round" />

            <circle cx="0" cy="0" r="26" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.5" />
            {/* Gate plate */}
            <line x1="-14" y1="-16" x2="-14" y2="16" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />
            {/* Channel segments */}
            <line x1="-8" y1="-14" x2="-8" y2="-6" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-8" y1="-3" x2="-8" y2="3" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-8" y1="6" x2="-8" y2="14" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />

            {/* Drain and Source connections */}
            <line x1="-8" y1="-10" x2="0" y2="-10" stroke="#f8fafc" strokeWidth="2" />
            <line x1="0" y1="-10" x2="0" y2="-22" stroke="#f8fafc" strokeWidth="2" />
            <line x1="-8" y1="10" x2="0" y2="10" stroke="#f8fafc" strokeWidth="2" />
            <line x1="0" y1="10" x2="0" y2="22" stroke="#f8fafc" strokeWidth="2" />

            {/* N-Channel inward arrow on center tap */}
            <line x1="-8" y1="0" x2="0" y2="0" stroke="#f8fafc" strokeWidth="1.5" />
            <polygon points="-8,0 -2,-3 -2,3" fill="#f97316" />

            <text x="10" y="4" fill="#38bdf8" fontSize="6.5" fontWeight="bold">N-MOS</text>
            <text x="-25" y="-4" fill="#cbd5e1" fontSize="5.5">G</text>
            <text x="4" y="-26" fill="#cbd5e1" fontSize="5.5">D</text>
            <text x="4" y="30" fill="#cbd5e1" fontSize="5.5">S</text>
          </g>
        );
      }

      case 'opamp': {
        return (
          <g>
            {/* Operational Amplifier Triangle */}
            <polygon
              points="18,12 18,68 70,40"
              fill={isDark ? '#0f172a' : '#f8fafc'}
              stroke={bodyStroke}
              strokeWidth="2"
            />
            {/* Inverting Input (-) */}
            <line x1="0" y1="20" x2="18" y2="20" stroke={leadColor} strokeWidth="2" />
            <text x="24" y="24" fill="#ef4444" fontSize="13" fontWeight="bold">-</text>

            {/* Non-Inverting Input (+) */}
            <line x1="0" y1="60" x2="18" y2="60" stroke={leadColor} strokeWidth="2" />
            <text x="24" y="64" fill="#22c55e" fontSize="13" fontWeight="bold">+</text>

            {/* Output Point */}
            <line x1="70" y1="40" x2="80" y2="40" stroke={leadColor} strokeWidth="2" />

            {/* Power rails V+ and V- */}
            <line x1="40" y1="0" x2="40" y2="26" stroke={leadColor} strokeWidth="1.5" />
            <line x1="40" y1="54" x2="40" y2="80" stroke={leadColor} strokeWidth="1.5" />
            <text x="46" y="22" fill={leadColor} fontSize="7">V+</text>
            <text x="46" y="64" fill={leadColor} fontSize="7">V-</text>
            <text x="42" y="44" fill={leadColor} fontSize="8" fontWeight="bold" textAnchor="middle">LM358</text>
          </g>
        );
      }

      // ----------------------------------------------------
      // 4. LOGIC GATES & 555 TIMER
      // ----------------------------------------------------
      // 4. LOGIC GATES (Slimmer, EDA-standard stepped leads)
      // ----------------------------------------------------
      case 'gate-and': {
        return (
          <g>
            {/* Stepped dogleg input leads */}
            <path d="M 0 20 L 14 20 L 14 33 L 26 33" fill="none" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 0 60 L 14 60 L 14 47 L 26 47" fill="none" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Output lead */}
            <line x1="53" y1="40" x2="80" y2="40" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            {/* Slim gate body */}
            <path
              d="M 26 27 L 40 27 A 13 13 0 0 1 40 53 L 26 53 Z"
              fill={isDark ? '#0f172a' : '#f8fafc'}
              stroke={bodyStroke}
              strokeWidth="2"
            />
            <text x="36" y="44" fill={bodyStroke} fontSize="11" fontWeight="bold" textAnchor="middle">&</text>
          </g>
        );
      }

      case 'gate-or': {
        return (
          <g>
            {/* Stepped dogleg input leads */}
            <path d="M 0 20 L 14 20 L 14 33 L 28 33" fill="none" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 0 60 L 14 60 L 14 47 L 28 47" fill="none" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Output lead */}
            <line x1="54" y1="40" x2="80" y2="40" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            {/* Slim gate body */}
            <path
              d="M 26 27 Q 32 40 26 53 Q 42 53 54 40 Q 42 27 26 27 Z"
              fill={isDark ? '#0f172a' : '#f8fafc'}
              stroke={bodyStroke}
              strokeWidth="2"
            />
            <text x="38" y="44" fill={bodyStroke} fontSize="10" fontWeight="bold" textAnchor="middle">≥</text>
          </g>
        );
      }

      case 'gate-not': {
        return (
          <g>
            {/* Input lead */}
            <line x1="0" y1="40" x2="26" y2="40" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            {/* Triangle body */}
            <polygon points="26,27 26,53 54,40" fill={isDark ? '#0f172a' : '#f8fafc'} stroke={bodyStroke} strokeWidth="2" />
            {/* Inversion bubble */}
            <circle cx="57" cy="40" r="3" fill={isDark ? '#0f172a' : '#f8fafc'} stroke={bodyStroke} strokeWidth="1.5" />
            {/* Output lead */}
            <line x1="60" y1="40" x2="80" y2="40" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <text x="35" y="43" fill={bodyStroke} fontSize="9" fontWeight="bold" textAnchor="middle">1</text>
          </g>
        );
      }

      case 'gate-nand': {
        return (
          <g>
            {/* Stepped dogleg input leads */}
            <path d="M 0 20 L 14 20 L 14 33 L 26 33" fill="none" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 0 60 L 14 60 L 14 47 L 26 47" fill="none" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Slim gate body */}
            <path
              d="M 26 27 L 40 27 A 13 13 0 0 1 40 53 L 26 53 Z"
              fill={isDark ? '#0f172a' : '#f8fafc'}
              stroke={bodyStroke}
              strokeWidth="2"
            />
            {/* Inversion bubble */}
            <circle cx="56" cy="40" r="3" fill={isDark ? '#0f172a' : '#f8fafc'} stroke={bodyStroke} strokeWidth="1.5" />
            {/* Output lead */}
            <line x1="59" y1="40" x2="80" y2="40" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <text x="36" y="44" fill={bodyStroke} fontSize="11" fontWeight="bold" textAnchor="middle">&</text>
          </g>
        );
      }

      case 'gate-nor': {
        return (
          <g>
            {/* Stepped dogleg input leads */}
            <path d="M 0 20 L 14 20 L 14 33 L 28 33" fill="none" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 0 60 L 14 60 L 14 47 L 28 47" fill="none" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Slim gate body */}
            <path
              d="M 26 27 Q 32 40 26 53 Q 42 53 54 40 Q 42 27 26 27 Z"
              fill={isDark ? '#0f172a' : '#f8fafc'}
              stroke={bodyStroke}
              strokeWidth="2"
            />
            {/* Inversion bubble */}
            <circle cx="57" cy="40" r="3" fill={isDark ? '#0f172a' : '#f8fafc'} stroke={bodyStroke} strokeWidth="1.5" />
            {/* Output lead */}
            <line x1="60" y1="40" x2="80" y2="40" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <text x="38" y="44" fill={bodyStroke} fontSize="10" fontWeight="bold" textAnchor="middle">≥</text>
          </g>
        );
      }

      case 'gate-xor': {
        return (
          <g>
            {/* Stepped dogleg input leads */}
            <path d="M 0 20 L 14 20 L 14 33 L 23 33" fill="none" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 0 60 L 14 60 L 14 47 L 23 47" fill="none" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Rear curve */}
            <path d="M 21 27 Q 27 40 21 53" fill="none" stroke={bodyStroke} strokeWidth="2" />
            {/* Slim gate body */}
            <path
              d="M 26 27 Q 32 40 26 53 Q 42 53 54 40 Q 42 27 26 27 Z"
              fill={isDark ? '#0f172a' : '#f8fafc'}
              stroke={bodyStroke}
              strokeWidth="2"
            />
            {/* Output lead */}
            <line x1="54" y1="40" x2="80" y2="40" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <text x="40" y="44" fill={bodyStroke} fontSize="9.5" fontWeight="bold" textAnchor="middle">=1</text>
          </g>
        );
      }

      case 'gate-xnor': {
        return (
          <g>
            {/* Stepped dogleg input leads */}
            <path d="M 0 20 L 14 20 L 14 33 L 23 33" fill="none" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 0 60 L 14 60 L 14 47 L 23 47" fill="none" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Rear curve */}
            <path d="M 21 27 Q 27 40 21 53" fill="none" stroke={bodyStroke} strokeWidth="2" />
            {/* Slim gate body */}
            <path
              d="M 26 27 Q 32 40 26 53 Q 42 53 54 40 Q 42 27 26 27 Z"
              fill={isDark ? '#0f172a' : '#f8fafc'}
              stroke={bodyStroke}
              strokeWidth="2"
            />
            {/* Inversion bubble */}
            <circle cx="57" cy="40" r="3" fill={isDark ? '#0f172a' : '#f8fafc'} stroke={bodyStroke} strokeWidth="1.5" />
            {/* Output lead */}
            <line x1="60" y1="40" x2="80" y2="40" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <text x="40" y="44" fill={bodyStroke} fontSize="9.5" fontWeight="bold" textAnchor="middle">=1</text>
          </g>
        );
      }

      case 'ic-555': {
        return (
          <g>
            {/* 8-Pin DIP Package Body centered in 80x120 */}
            <rect x="14" y="10" width="52" height="100" rx="4" fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
            {/* Half-moon orientation notch */}
            <path d="M 34 10 A 6 6 0 0 0 46 10" fill="#27272a" stroke="#3f3f46" strokeWidth="1.5" />
            <circle cx="22" cy="20" r="2.5" fill="#52525b" />
            {/* 8 Gull-wing Metal Lead Legs at y: 20, 40, 60, 80 */}
            {[20, 40, 60, 80].map((y) => (
              <React.Fragment key={y}>
                <line x1="0" y1={y} x2="14" y2={y} stroke="#cbd5e1" strokeWidth="2.5" />
                <line x1="66" y1={y} x2="80" y2={y} stroke="#cbd5e1" strokeWidth="2.5" />
              </React.Fragment>
            ))}
            <text x="40" y="58" fill="#f8fafc" fontSize="10" fontWeight="bold" textAnchor="middle">NE555P</text>
            <text x="40" y="70" fill="#a1a1aa" fontSize="7" textAnchor="middle">TIMER</text>
          </g>
        );
      }

      // ----------------------------------------------------
      // 4.5. 7-SEGMENT DISPLAY
      // ----------------------------------------------------
      case 'display-7seg': {
        const segs = simRunning ? (component.state?.segments ?? properties.segments ?? {}) : {};
        const ledColor = properties.color || '#ef4444';
        const offColor = isDark ? '#1e293b' : '#cbd5e1';

        const renderSeg = (isActive: boolean, d: string) => (
          <path
            d={d}
            fill={isActive ? ledColor : offColor}
            opacity={isActive ? 1.0 : 0.25}
            stroke={isActive ? '#ffffff' : 'transparent'}
            strokeWidth={isActive ? 0.5 : 0}
            filter={isActive ? `drop-shadow(0 0 6px ${ledColor})` : 'none'}
          />
        );

        return (
          <g>
            {/* Dark Bezel Display Casing */}
            <rect x="6" y="6" width="68" height="108" rx="6" fill="#090d16" stroke="#27272a" strokeWidth="2" />
            <rect x="12" y="12" width="56" height="96" rx="4" fill="#020617" stroke="#1e293b" strokeWidth="1" />

            {/* Decimal Display Segments */}
            {/* Segment A (Top) */}
            {renderSeg(!!segs.a, 'M 22 18 L 54 18 L 50 24 L 26 24 Z')}
            {/* Segment B (Top-Right) */}
            {renderSeg(!!segs.b, 'M 54 26 L 60 22 L 60 54 L 54 50 Z')}
            {/* Segment C (Bottom-Right) */}
            {renderSeg(!!segs.c, 'M 54 66 L 60 62 L 60 94 L 54 90 Z')}
            {/* Segment D (Bottom) */}
            {renderSeg(!!segs.d, 'M 26 96 L 50 96 L 54 102 L 22 102 Z')}
            {/* Segment E (Bottom-Left) */}
            {renderSeg(!!segs.e, 'M 18 62 L 24 66 L 24 90 L 18 94 Z')}
            {/* Segment F (Top-Left) */}
            {renderSeg(!!segs.f, 'M 18 22 L 24 26 L 24 50 L 18 54 Z')}
            {/* Segment G (Middle) */}
            {renderSeg(!!segs.g, 'M 25 57 L 28 54 L 48 54 L 51 57 L 48 60 L 28 60 Z')}
            {/* Segment DP (Decimal Point) */}
            <circle
              cx="64"
              cy="99"
              r="3.5"
              fill={segs.dp ? ledColor : offColor}
              opacity={segs.dp ? 1.0 : 0.25}
              filter={segs.dp ? `drop-shadow(0 0 6px ${ledColor})` : 'none'}
            />

            {/* Pin connection lines and small pin indicators */}
            <line x1="20" y1="0" x2="20" y2="12" stroke={leadColor} strokeWidth="2" />
            <line x1="40" y1="0" x2="40" y2="12" stroke={leadColor} strokeWidth="2" />
            <line x1="60" y1="0" x2="60" y2="12" stroke={leadColor} strokeWidth="2" />
            <line x1="68" y1="20" x2="80" y2="20" stroke={leadColor} strokeWidth="2" />

            <line x1="20" y1="108" x2="20" y2="120" stroke={leadColor} strokeWidth="2" />
            <line x1="40" y1="108" x2="40" y2="120" stroke={leadColor} strokeWidth="2" />
            <line x1="60" y1="108" x2="60" y2="120" stroke={leadColor} strokeWidth="2" />

            <line x1="0" y1="40" x2="12" y2="40" stroke={leadColor} strokeWidth="2" />
            <line x1="0" y1="80" x2="12" y2="80" stroke={leadColor} strokeWidth="2" />
          </g>
        );
      }

      // ----------------------------------------------------
      // 5. MICROCONTROLLERS (Arduino Uno R3, ESP32, Pico)
      // ----------------------------------------------------
      case 'arduino-uno': {
        const isPowered = simRunning && (component.state?.isPowered ?? (properties.isPowered !== false));
        const isL = simRunning && !!(component.state?.ledL ?? properties.ledL ?? ((component.state?.pinVoltages?.['d13'] ?? 0) >= 2.5));
        const isTx = simRunning && !!(component.state?.ledTx ?? properties.ledTx);
        const isRx = simRunning && !!(component.state?.ledRx ?? properties.ledRx);

        return (
          <g>
            {/* Authentic Italian Teal Arduino PCB (400x200 centered at 0,0) */}
            <rect
              x="-200"
              y="-100"
              width="400"
              height="200"
              rx="8"
              fill="#00878a"
              stroke="#005b5e"
              strokeWidth="2.5"
            />

            {/* Corner Mounting Holes */}
            <circle cx="-180" cy="-50" r="4.5" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1" />
            <circle cx="180" cy="-70" r="4.5" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1" />
            <circle cx="-120" cy="80" r="4.5" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1" />
            <circle cx="180" cy="80" r="4.5" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1" />

            {/* Left Edge: Metallic USB Type-B Port (anchored at x = -200) */}
            <rect x="-202" y="-60" width="46" height="44" rx="3" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
            <rect x="-196" y="-52" width="30" height="28" rx="2" fill="#0f172a" />
            <rect x="-186" y="-45" width="16" height="14" rx="1" fill="#94a3b8" />

            {/* Left Edge: DC Barrel Power Jack (anchored at x = -200) */}
            <rect x="-202" y="25" width="52" height="46" rx="3" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
            <circle cx="-176" cy="48" r="8" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
            <circle cx="-176" cy="48" r="3" fill="#0f172a" />

            {/* Momentary Tactile Reset Button (Upper Left) */}
            <rect x="-145" y="-52" width="16" height="16" rx="2" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
            <circle cx="-137" cy="-44" r="4.5" fill="#ef4444" />
            <text x="-137" y="-31" fill="#ffffff" fontSize="4.5" fontWeight="bold" textAnchor="middle">RESET</text>

            {/* 16MHz Silver Quartz Crystal Oscillator */}
            <rect x="-105" y="-15" width="24" height="14" rx="3" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
            <text x="-93" y="-6" fill="#475569" fontSize="5" fontWeight="bold" textAnchor="middle">16.000</text>

            {/* ATmega328P DIP-28 IC Chip & Socket (Right Center) */}
            <rect x="50" y="-15" width="105" height="32" rx="2" fill="#18181b" stroke="#3f3f46" strokeWidth="1.5" />
            <circle cx="55" cy="1" r="2.5" fill="#3f3f46" />
            <text x="102.5" y="4.5" fill="#f8fafc" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              ATMEGA328P-PU
            </text>

            {/* On-Board SMD Status LEDs (ON, L, TX, RX) */}
            {/* ON LED (Green) */}
            <rect x="-48" y="-15" width="8" height="6" rx="1" fill={isPowered ? '#22c55e' : '#14532d'} stroke="#15803d" strokeWidth="0.5" />
            {isPowered && <circle cx="-44" cy="-12" r="4.5" fill="#22c55e" opacity="0.3" pointerEvents="none" />}
            <text x="-44" y="-19" fill="#86efac" fontSize="4.5" fontWeight="bold" textAnchor="middle">ON</text>

            {/* L LED (Amber / Pin 13) */}
            <rect x="-28" y="-15" width="8" height="6" rx="1" fill={isL ? '#f59e0b' : '#78350f'} stroke="#b45309" strokeWidth="0.5" />
            {isL && <circle cx="-24" cy="-12" r="5" fill="#f59e0b" opacity="0.4" pointerEvents="none" />}
            <text x="-24" y="-19" fill="#fde68a" fontSize="4.5" fontWeight="bold" textAnchor="middle">L</text>

            {/* TX LED (Amber) */}
            <rect x="-8" y="-15" width="8" height="6" rx="1" fill={isTx ? '#f59e0b' : '#78350f'} stroke="#b45309" strokeWidth="0.5" />
            {isTx && <circle cx="-4" cy="-12" r="4.5" fill="#f59e0b" opacity="0.3" pointerEvents="none" />}
            <text x="-4" y="-19" fill="#fde68a" fontSize="4.5" fontWeight="bold" textAnchor="middle">TX</text>

            {/* RX LED (Amber) */}
            <rect x="12" y="-15" width="8" height="6" rx="1" fill={isRx ? '#f59e0b' : '#78350f'} stroke="#b45309" strokeWidth="0.5" />
            {isRx && <circle cx="16" cy="-12" r="4.5" fill="#f59e0b" opacity="0.3" pointerEvents="none" />}
            <text x="16" y="-19" fill="#fde68a" fontSize="4.5" fontWeight="bold" textAnchor="middle">RX</text>

            {/* Silkscreen Branding */}
            <text x="-40" y="38" fill="#ffffff" fontSize="16" fontWeight="black" textAnchor="middle">ARDUINO</text>
            <text x="-40" y="60" fill="#ffffff" fontSize="18" fontWeight="black" textAnchor="middle">UNO</text>

            {/* Header Plastic Housings (20px pitch) */}
            {/* Top Left Header (10 pins, x: -180 to 0) */}
            <rect x="-190" y="-107" width="200" height="14" rx="1.5" fill="#0f172a" stroke="#334155" strokeWidth="1" />
            {/* Top Right Header (8 pins, x: +40 to +180) */}
            <rect x="30" y="-107" width="160" height="14" rx="1.5" fill="#0f172a" stroke="#334155" strokeWidth="1" />
            {/* Bottom Left Power Header (8 pins, x: -140 to 0) */}
            <rect x="-150" y="93" width="160" height="14" rx="1.5" fill="#0f172a" stroke="#334155" strokeWidth="1" />
            {/* Bottom Right Analog Header (6 pins, x: +80 to +180) */}
            <rect x="70" y="93" width="120" height="14" rx="1.5" fill="#0f172a" stroke="#334155" strokeWidth="1" />

            {/* Top & Bottom Header Category Titles */}
            <text x="110" y="-78" fill="#ffffff" fontSize="6" fontWeight="bold" opacity="0.8" textAnchor="middle">DIGITAL (PWM ~)</text>
            <text x="-70" y="64" fill="#ffffff" fontSize="6" fontWeight="bold" opacity="0.8" textAnchor="middle">POWER</text>
            <text x="130" y="64" fill="#ffffff" fontSize="6" fontWeight="bold" opacity="0.8" textAnchor="middle">ANALOG IN</text>

            {/* DYNAMIC HEADER SOCKETS & SILKSCREEN LABELS: SINGLE SOURCE OF TRUTH */}
            {definition.pins.map((pin) => {
              const isTop = pin.y < 0;
              const pinLabel = pin.label || pin.name || pin.id;
              return (
                <g key={pin.id}>
                  {/* Female Header Socket at (pin.x, pin.y) */}
                  <rect
                    x={pin.x - 3.5}
                    y={pin.y - 3.5}
                    width="7"
                    height="7"
                    rx="1"
                    fill="#1e293b"
                    stroke="#0f172a"
                    strokeWidth="0.5"
                  />
                  <rect
                    x={pin.x - 1.8}
                    y={pin.y - 1.8}
                    width="3.6"
                    height="3.6"
                    rx="0.4"
                    fill="#020617"
                  />

                  {/* Silkscreen Pin Label */}
                  <text
                    x={pin.x}
                    y={isTop ? -86 : 80}
                    fill="#ffffff"
                    fontSize={pinLabel.length >= 4 ? '4.8' : '5.8'}
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="auto"
                  >
                    {pinLabel}
                  </text>
                </g>
              );
            })}
          </g>
        );
      }

      case 'esp32': {
        const isPowered = simRunning && (component.state?.isPowered ?? (properties.isPowered !== false));
        const isD2 = simRunning && !!(component.state?.ledL ?? properties.ledL ?? ((component.state?.pinVoltages?.['d2'] ?? 0) >= 2.5));
        const isTx = simRunning && !!(component.state?.ledTx ?? properties.ledTx);
        const isRx = simRunning && !!(component.state?.ledRx ?? properties.ledRx);

        return (
          <g>
            {/* Matte Black PCB (120x320 centered at 0,0) */}
            <rect
              x="-60"
              y="-160"
              width="120"
              height="320"
              rx="6"
              fill="#18181b"
              stroke="#3f3f46"
              strokeWidth="2"
            />

            {/* Golden Copper Antenna Serpentine Traces (Top) */}
            <path
              d="M -30 -155 L 30 -155 L 30 -150 L -22 -150 L -22 -146 L 24 -146 L 24 -142 L -16 -142"
              fill="none"
              stroke="#eab308"
              strokeWidth="1.8"
            />

            {/* Metallic RF Shield Can 'ESP-WROOM-32' */}
            <rect
              x="-34"
              y="-136"
              width="68"
              height="85"
              rx="3"
              fill="#cbd5e1"
              stroke="#94a3b8"
              strokeWidth="1.5"
            />
            <text x="0" y="-98" fill="#0f172a" fontSize="8" fontWeight="bold" textAnchor="middle">
              ESP-WROOM-32
            </text>
            <text x="0" y="-82" fill="#475569" fontSize="6.5" textAnchor="middle">
              Wi-Fi + BT 4.2
            </text>

            {/* Bottom Micro-USB Port */}
            <rect x="-16" y="152" width="32" height="12" rx="2" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
            <rect x="-10" y="156" width="20" height="6" fill="#0f172a" />

            {/* EN and BOOT tactile switches (placed at bottom, below pin row y = 140) */}
            <rect x="-42" y="146" width="10" height="10" rx="2" fill="#3f3f46" />
            <circle cx="-37" cy="151" r="2.5" fill="#cbd5e1" />
            <text x="-37" y="142" fill="#a1a1aa" fontSize="4.5" fontWeight="bold" textAnchor="middle">
              EN
            </text>

            <rect x="32" y="146" width="10" height="10" rx="2" fill="#3f3f46" />
            <circle cx="37" cy="151" r="2.5" fill="#cbd5e1" />
            <text x="37" y="142" fill="#a1a1aa" fontSize="4.5" fontWeight="bold" textAnchor="middle">
              BOOT
            </text>

            {/* Header Strip Plastic Housings along Left (x = -60) and Right (x = +60) spanning 20px pitch */}
            <rect x="-67" y="-150" width="14" height="300" rx="1.5" fill="#090d16" stroke="#27272a" strokeWidth="1" />
            <rect x="53" y="-150" width="14" height="300" rx="1.5" fill="#090d16" stroke="#27272a" strokeWidth="1" />

            {/* On-Board Status LEDs (PWR, D2) */}
            <rect x="-20" y="-38" width="6" height="4" rx="0.5" fill={isPowered ? '#ef4444' : '#7f1d1d'} />
            {isPowered && <circle cx="-17" cy="-36" r="3" fill="#ef4444" opacity="0.3" pointerEvents="none" />}
            <text x="-17" y="-41" fill="#fca5a5" fontSize="4.5" fontWeight="bold" textAnchor="middle">
              PWR
            </text>

            <rect x="14" y="-38" width="6" height="4" rx="0.5" fill={isD2 ? '#3b82f6' : '#1e3a8a'} />
            {isD2 && <circle cx="17" cy="-36" r="3.5" fill="#3b82f6" opacity="0.4" pointerEvents="none" />}
            <text x="17" y="-41" fill="#93c5fd" fontSize="4.5" fontWeight="bold" textAnchor="middle">
              D2
            </text>

            {/* TX/RX Activity */}
            {isTx && <circle cx="-5" cy="-36" r="1.5" fill="#f59e0b" />}
            {isRx && <circle cx="5" cy="-36" r="1.5" fill="#f59e0b" />}

            {/* Central Branding */}
            <text x="0" y="0" fill="#f8fafc" fontSize="13" fontWeight="bold" textAnchor="middle">
              ESP32
            </text>
            <text x="0" y="15" fill="#a1a1aa" fontSize="7.5" textAnchor="middle">
              DEVKIT V1
            </text>

            {/* DYNAMIC HEADER SOCKETS & SILKSCREEN LABELS: SINGLE SOURCE OF TRUTH */}
            {definition.pins.map((pin) => {
              const isLeft = pin.x < 0;
              const pinLabel = pin.label || pin.name || pin.id;
              return (
                <g key={pin.id}>
                  {/* Female Header Socket at exact (pin.x, pin.y) */}
                  <rect
                    x={pin.x - 3.5}
                    y={pin.y - 3.5}
                    width="7"
                    height="7"
                    rx="1"
                    fill="#1e293b"
                    stroke="#0f172a"
                    strokeWidth="0.5"
                  />
                  <rect
                    x={pin.x - 1.8}
                    y={pin.y - 1.8}
                    width="3.6"
                    height="3.6"
                    rx="0.4"
                    fill="#020617"
                  />

                  {/* Silkscreen Pin Label */}
                  <text
                    x={isLeft ? -48 : 48}
                    y={pin.y}
                    fill="#a1a1aa"
                    fontSize="5"
                    fontWeight="bold"
                    textAnchor={isLeft ? 'start' : 'end'}
                    dominantBaseline="middle"
                  >
                    {pinLabel}
                  </text>
                </g>
              );
            })}
          </g>
        );
      }

      case 'pico': {
        const isPowered = simRunning && (component.state?.isPowered ?? (properties.isPowered !== false));

        return (
          <g>
            {/* Green RP2040 Board (120x420 centered at 0,0) */}
            <rect
              x="-60"
              y="-210"
              width="120"
              height="420"
              rx="6"
              fill="#15803d"
              stroke="#166534"
              strokeWidth="2"
            />

            {/* Micro-USB Port on Top */}
            <rect x="-16" y="-215" width="32" height="14" rx="2" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
            <rect x="-10" y="-213" width="20" height="8" rx="1" fill="#0f172a" />

            {/* RP2040 Microchip in Center (x: 0, y: -15) */}
            <rect x="-18" y="-33" width="36" height="36" rx="3" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
            <circle cx="-12" cy="-27" r="2" fill="#475569" />
            <text x="0" y="-15" fill="#f8fafc" fontSize="7" fontWeight="bold" textAnchor="middle">
              RP2040
            </text>
            <text x="0" y="-4" fill="#94a3b8" fontSize="4.5" textAnchor="middle">
              21/40
            </text>

            {/* Green On-board LED */}
            <rect x="-26" y="-185" width="6" height="5" rx="0.5" fill={isPowered ? '#22c55e' : '#14532d'} />
            {isPowered && <circle cx="-23" cy="-182.5" r="3" fill="#22c55e" opacity="0.3" pointerEvents="none" />}
            <text x="-23" y="-190" fill="#86efac" fontSize="4.5" fontWeight="bold" textAnchor="middle">
              LED
            </text>

            {/* Board Title Silkscreen: Two Stacked Lines */}
            <text x="0" y="42" fill="#ffffff" fontSize="7" fontWeight="bold" textAnchor="middle">
              Raspberry Pi
            </text>
            <text x="0" y="54" fill="#86efac" fontSize="8" fontWeight="bold" textAnchor="middle">
              PICO
            </text>

            {/* Castellated Header Edge Strips spanning 20px pitch */}
            <rect x="-64" y="-200" width="8" height="400" rx="1" fill="#0f172a" opacity="0.6" />
            <rect x="56" y="-200" width="8" height="400" rx="1" fill="#0f172a" opacity="0.6" />

            {/* DYNAMIC HEADER SOCKETS & SILKSCREEN LABELS: SINGLE SOURCE OF TRUTH */}
            {definition.pins.map((pin) => {
              const isLeft = pin.x < 0;
              const pinLabel = pin.label || pin.name || pin.id;
              return (
                <g key={pin.id}>
                  {/* Castellated solder pad and through-hole pin header */}
                  <rect
                    x={pin.x - 3.5}
                    y={pin.y - 3.5}
                    width="7"
                    height="7"
                    rx="1"
                    fill="#1e293b"
                    stroke="#22c55e"
                    strokeWidth="0.5"
                  />
                  <circle cx={pin.x} cy={pin.y} r="1.8" fill="#020617" />

                  {/* Silkscreen Pin Label */}
                  <text
                    x={isLeft ? -46 : 46}
                    y={pin.y}
                    fill="#dcfce7"
                    fontSize="4.8"
                    fontWeight="bold"
                    textAnchor={isLeft ? 'start' : 'end'}
                    dominantBaseline="middle"
                  >
                    {pinLabel}
                  </text>
                </g>
              );
            })}
          </g>
        );
      }

      // ----------------------------------------------------
      // 6. SENSORS (Inputs)
      // ----------------------------------------------------
      case 'pushbutton': {
        const isPressed = properties.isPressed;
        return (
          <g>
            {/* 2 Solder Terminals at (0, 20) and (80, 20) */}
            <line x1="0" y1="20" x2="24" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="56" y1="20" x2="80" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />

            {/* Metallic Switch Body Plate */}
            <rect x="24" y="6" width="32" height="28" rx="4" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
            {/* Corner Rivet Indents */}
            <circle cx="28" cy="10" r="1.2" fill="#475569" />
            <circle cx="52" cy="10" r="1.2" fill="#475569" />
            <circle cx="28" cy="30" r="1.2" fill="#475569" />
            <circle cx="52" cy="30" r="1.2" fill="#475569" />

            {/* Dark Bezel Ring */}
            <circle cx="40" cy="20" r="11" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />

            {/* Tactile Plunger Button */}
            <circle
              cx="40"
              cy="20"
              r={isPressed ? 7 : 9}
              fill={isPressed ? '#22c55e' : '#ef4444'}
              stroke="#7f1d1d"
              strokeWidth="1.5"
              filter={isPressed ? 'none' : 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))'}
            />
          </g>
        );
      }

      case 'toggle-switch': {
        const isT1 = properties.state === 'T1';
        return (
          <g>
            {/* 3 Terminals: COM at (0, 40), T1 at (80, 20), T2 at (80, 60) */}
            <line x1="0" y1="40" x2="22" y2="40" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="58" y1="20" x2="80" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="58" y1="60" x2="80" y2="60" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />

            {/* Switch Housing (Metallic Box) centered in 80x80 */}
            <rect x="22" y="14" width="36" height="52" rx="4" fill={isDark ? '#1e293b' : '#e2e8f0'} stroke="#64748b" strokeWidth="1.5" />

            {/* Hex Bushing Nut */}
            <polygon points="34,32 46,32 52,40 46,48 34,48 28,40" fill="#94a3b8" stroke="#475569" strokeWidth="1" />

            {/* Chrome Toggle Bat Lever (Angles Up or Down) */}
            <line
              x1="40"
              y1="40"
              x2="40"
              y2={isT1 ? 20 : 60}
              stroke="#f1f5f9"
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Ball tip on lever */}
            <circle cx="40" cy={isT1 ? 20 : 60} r="4.5" fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />
          </g>
        );
      }

      case 'temp-sensor': {
        return (
          <g>
            {/* VCC at (0, 20), VOUT at (40, 0), GND at (80, 20) */}
            <line x1="0" y1="20" x2="24" y2="20" stroke={leadColor} strokeWidth="2" strokeLinecap="round" />
            <line x1="40" y1="0" x2="40" y2="12" stroke={leadColor} strokeWidth="2" strokeLinecap="round" />
            <line x1="56" y1="20" x2="80" y2="20" stroke={leadColor} strokeWidth="2" strokeLinecap="round" />
            {/* TO-92 Transistor Package Profile */}
            <path d="M 24 12 L 56 12 A 16 16 0 0 1 24 12" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
            <text x="40" y="28" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">TMP36</text>
          </g>
        );
      }

      case 'light-sensor': {
        return (
          <g>
            <line x1="0" y1="20" x2="20" y2="20" stroke={leadColor} strokeWidth="2" />
            <line x1="60" y1="20" x2="80" y2="20" stroke={leadColor} strokeWidth="2" />
            {/* Ceramic Disc */}
            <circle cx="40" cy="20" r="18" fill="#fef3c7" stroke="#b45309" strokeWidth="1.5" />
            {/* CdS Serpentine Track */}
            <path
              d="M 28 14 H 52 V 18 H 28 V 22 H 52 V 26 H 28"
              fill="none"
              stroke="#ea580c"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Light Rays */}
            <line x1="16" y1="4" x2="24" y2="10" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
            <line x1="24" y1="2" x2="32" y2="8" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
          </g>
        );
      }

      case 'ultrasonic': {
        return (
          <g>
            {/* Blue HC-SR04 PCB */}
            <rect x="6" y="8" width="88" height="44" rx="4" fill="#0284c7" stroke="#0369a1" strokeWidth="2" />

            {/* Aluminum Transducer Cylinders (Transmitter 'T' and Receiver 'R') */}
            <circle cx="28" cy="28" r="17" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
            <circle cx="28" cy="28" r="13" fill="#94a3b8" />
            <circle cx="28" cy="28" r="10" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
            <text x="28" y="32" fill="#0f172a" fontSize="11" fontWeight="black" textAnchor="middle">T</text>

            <circle cx="72" cy="28" r="17" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
            <circle cx="72" cy="28" r="13" fill="#94a3b8" />
            <circle cx="72" cy="28" r="10" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
            <text x="72" y="32" fill="#0f172a" fontSize="11" fontWeight="black" textAnchor="middle">R</text>

            {/* Quartz crystal in center */}
            <rect x="47" y="18" width="6" height="14" rx="2" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />

            {/* 4 Bottom Header Pins */}
            {[20, 40, 60, 80].map((x) => (
              <line key={x} x1={x} y1="52" x2={x} y2="60" stroke={leadColor} strokeWidth="2" />
            ))}
          </g>
        );
      }

      // ----------------------------------------------------
      // 7. ACTUATORS & OUTPUTS (LED with Leadframe, Fan, Buzzer, Relay)
      // ----------------------------------------------------
      case 'led-red':
      case 'led-green':
      case 'led-blue':
      case 'led-yellow': {
        const color =
          properties.color ||
          (type === 'led-red'
            ? '#ef4444'
            : type === 'led-green'
            ? '#22c55e'
            : type === 'led-blue'
            ? '#3b82f6'
            : '#eab308');
        const isLit =
          simRunning &&
          (component.state?.lit !== undefined
            ? component.state.lit
            : properties.lit === true);

        return (
          <g>
            {/* Terminal leads: Anode (0, 20), Cathode (80, 20) */}
            <line x1="0" y1="20" x2="26" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="54" y1="20" x2="80" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />

            {/* Glowing Aura if Lit */}
            {isLit && (
              <circle
                cx="40"
                cy="20"
                r="28"
                fill={color}
                opacity="0.45"
                filter={`drop-shadow(0 0 10px ${color})`}
                className="animate-pulse"
              />
            )}

            {/* Translucent Colored LED Glass Bulb Dome */}
            <circle
              cx="40"
              cy="20"
              r="14"
              fill={color}
              opacity={isLit ? 0.95 : 0.35}
              stroke={color}
              strokeWidth="2"
            />

            {/* Internal Metal Leadframe Plates */}
            {/* Anode Post (left) */}
            <line x1="32" y1="20" x2="37" y2="20" stroke="#f1f5f9" strokeWidth="2" />
            <line x1="37" y1="16" x2="37" y2="24" stroke="#f1f5f9" strokeWidth="2" />
            {/* Cathode Anvil Plate (right - larger triangular flag) */}
            <polygon points="42,14 48,14 45,24 42,24" fill="#f1f5f9" opacity="0.85" />
            {/* Microscopic LED Die & Bond Wire */}
            <circle cx="40" cy="18" r={isLit ? 2.5 : 1.5} fill={isLit ? '#ffffff' : '#fef08a'} />

            {/* Flat Cathode Edge Indication (Right Rim) */}
            <line x1="54" y1="12" x2="54" y2="28" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" opacity="0.8" />

            {/* Curved Glass Highlight Reflection */}
            <path
              d="M 30 15 A 11 11 0 0 1 42 9"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity={isLit ? 0.9 : 0.6}
            />
          </g>
        );
      }

      case 'led-rgb': {
        const hex = properties.colorHex || '#9333ea';
        const isLit = simRunning && Boolean(component.state?.lit);
        return (
          <g>
            {isLit && (
              <circle cx="40" cy="40" r="32" fill={hex} opacity="0.35" filter={`drop-shadow(0 0 10px ${hex})`} className="animate-pulse" />
            )}
            <circle cx="40" cy="40" r="22" fill={hex} opacity={isLit ? 0.95 : 0.4} stroke="#ffffff" strokeWidth="2" />
            {/* 4 Leads */}
            {[20, 40, 60].map((x) => (
              <line key={x} x1={x} y1="62" x2={x} y2="80" stroke={leadColor} strokeWidth="2" />
            ))}
            <line x1="62" y1="40" x2="80" y2="40" stroke={leadColor} strokeWidth="2" />
            <text x="40" y="44" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">RGB</text>
          </g>
        );
      }

      case 'dc-fan': {
        const isRunning =
          simRunning &&
          (component.state?.isRunning !== undefined
            ? component.state.isRunning
            : properties.isRunning === true);

        return (
          <g>
            {/* Outer Square Fan Shroud / Housing */}
            <rect x="8" y="8" width="64" height="64" rx="8" fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
            {/* 4 Corner Screw Holes */}
            <circle cx="14" cy="14" r="3" fill="#090d16" stroke="#475569" strokeWidth="1" />
            <circle cx="66" cy="14" r="3" fill="#090d16" stroke="#475569" strokeWidth="1" />
            <circle cx="14" cy="66" r="3" fill="#090d16" stroke="#475569" strokeWidth="1" />
            <circle cx="66" cy="66" r="3" fill="#090d16" stroke="#475569" strokeWidth="1" />

            {/* Inner Fan Duct Ring */}
            <circle cx="40" cy="40" r="26" fill={isDark ? '#090d16' : '#1e293b'} stroke="#334155" strokeWidth="1.5" />

            {/* 5 Aerodynamic Fan Blades & Hub */}
            <g
              className={isRunning ? 'animate-spin' : ''}
              style={{ transformOrigin: '40px 40px', animationDuration: '0.35s' }}
            >
              {[0, 72, 144, 216, 288].map((deg) => (
                <path
                  key={deg}
                  d="M 40 40 Q 54 22 42 16 Q 36 26 40 40"
                  fill={isRunning ? '#38bdf8' : '#0284c7'}
                  transform={`rotate(${deg} 40 40)`}
                />
              ))}
              {/* Central Motor Hub */}
              <circle cx="40" cy="40" r="8" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
            </g>

            {/* Power Leads at (0, 20) and (0, 60) */}
            <line x1="0" y1="20" x2="8" y2="20" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="0" y1="60" x2="8" y2="60" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
            <text x="14" y="23" fill="#ef4444" fontSize="7" fontWeight="bold">+</text>
            <text x="14" y="63" fill="#3b82f6" fontSize="8" fontWeight="bold">-</text>
          </g>
        );
      }

      case 'buzzer': {
        const isSounding =
          simRunning &&
          (component.state?.isSounding !== undefined
            ? component.state.isSounding
            : properties.isSounding === true);

        return (
          <g>
            {/* Leads at (0, 20) and (80, 20) */}
            <line x1="0" y1="20" x2="24" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="56" y1="20" x2="80" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            {/* ABS Cylinder Housing */}
            <circle cx="40" cy="20" r="16" fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
            {/* Center Sound Emitter Port */}
            <circle cx="40" cy="20" r="5" fill={isSounding ? '#38bdf8' : '#090d16'} stroke="#475569" strokeWidth="1.5" />

            {/* Silkscreen polarity */}
            <text x="16" y="16" fill="#ef4444" fontSize="10" fontWeight="bold">+</text>
            <text x="64" y="16" fill="#3b82f6" fontSize="11" fontWeight="bold">-</text>

            {/* Animated Outward Concentric Sound Wave Arcs */}
            {isSounding && (
              <g className="animate-pulse">
                <path d="M 58 12 A 12 12 0 0 1 58 28" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
                <path d="M 64 6 A 18 18 0 0 1 64 34" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
                <path d="M 70 0 A 24 24 0 0 1 70 40" fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
              </g>
            )}
          </g>
        );
      }

      case 'relay':
      case 'builtin_relay': {
        const isEngaged =
          simRunning && Boolean(component.state?.isEngaged ?? component.properties?.isEngaged);
        return (
          <g>
            {/* Blue Sugar-Cube Relay Module centered in 120x80 */}
            <rect x="14" y="8" width="92" height="64" rx="4" fill="#0284c7" stroke="#0369a1" strokeWidth="2" />
            {/* Text silkscreen */}
            <text x="56" y="24" fill="#ffffff" fontSize="8.5" fontWeight="bold" textAnchor="middle">SONGLE</text>
            <text x="56" y="34" fill="#ffffff" fontSize="7.5" fontWeight="bold" textAnchor="middle">RELAY 5VDC</text>
            <text x="56" y="44" fill="#bae6fd" fontSize="6.5" textAnchor="middle">10A 250VAC</text>

            {/* SMD Status LED with glow when active */}
            <circle
              cx="26"
              cy="20"
              r="3.5"
              fill={isEngaged ? '#22c55e' : '#14532d'}
              stroke={isEngaged ? '#4ade80' : '#052e16'}
              strokeWidth="1"
            />
            {isEngaged && (
              <circle cx="26" cy="20" r="6" fill="#22c55e" opacity="0.35" className="animate-pulse" />
            )}
            <text x="32" y="22" fill={isEngaged ? '#86efac' : '#64748b'} fontSize="6" fontWeight="bold">PWR</text>

            {/* Optocoupler IC */}
            <rect x="22" y="52" width="16" height="10" rx="1" fill="#18181b" />
            <circle cx="25" cy="55" r="1" fill="#71717a" />

            {/* Left Control Pins */}
            {[20, 40, 60].map((y) => (
              <line key={y} x1="0" y1={y} x2="14" y2={y} stroke={leadColor} strokeWidth="2.5" />
            ))}

            {/* Internal Contact Switch Armature Schematic on right */}
            {/* Contact Pads: COM (90, 40), NO (102, 22), NC (102, 58) */}
            <circle cx="90" cy="40" r="2" fill="#f59e0b" />
            <circle cx="102" cy="22" r="2" fill="#f59e0b" />
            <circle cx="102" cy="58" r="2" fill="#f59e0b" />

            {/* Animated Contact Armature Blade */}
            <line
              x1="90"
              y1="40"
              x2="102"
              y2={isEngaged ? 22 : 58}
              stroke="#fbbf24"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Right High-Power Switch Pins */}
            {[20, 40, 60].map((y) => (
              <line key={y} x1="106" y1={y} x2="120" y2={y} stroke={leadColor} strokeWidth="2.5" />
            ))}
            <text x="86" y="24" fill="#fef08a" fontSize="6.5" fontWeight="bold" textAnchor="end">NO</text>
            <text x="84" y="42" fill="#fef08a" fontSize="6.5" fontWeight="bold" textAnchor="end">COM</text>
            <text x="86" y="60" fill="#fef08a" fontSize="6.5" fontWeight="bold" textAnchor="end">NC</text>
          </g>
        );
      }

      // ----------------------------------------------------
      // 8. ANNOTATIONS
      // ----------------------------------------------------
      case 'textbox': {
        return (
          <g>
            <rect
              x="2"
              y="2"
              width={definition.width - 4}
              height={definition.height - 4}
              rx="4"
              fill={isDark ? '#854d0e' : '#fef08a'}
              stroke={isDark ? '#ca8a04' : '#facc15'}
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
            <text
              x={definition.width / 2}
              y={definition.height / 2 + 4}
              fill={isDark ? '#fef08a' : '#713f12'}
              fontSize="12"
              fontWeight="bold"
              textAnchor="middle"
            >
              Note / Text
            </text>
          </g>
        );
      }

      case 'multimeter': {
        const vPos = component.state?.pinVoltages?.['v_plus'] ?? 0;
        const vNeg = component.state?.pinVoltages?.['com'] ?? 0;
        const diffV = vPos - vNeg;
        const displayV = Math.abs(diffV) >= 100 ? diffV.toFixed(1) : diffV.toFixed(3);

        return (
          <g>
            {/* Outer Rugged Rubber Bezel (Fluke Yellow) */}
            <rect
              x="0"
              y="0"
              width="80"
              height="114"
              rx="10"
              fill="#eab308"
              stroke="#ca8a04"
              strokeWidth="2"
              filter="drop-shadow(0 2px 5px rgba(0,0,0,0.4))"
            />
            {/* Inner Dark Faceplate */}
            <rect
              x="5"
              y="5"
              width="70"
              height="104"
              rx="7"
              fill="#18181b"
              stroke="#27272a"
              strokeWidth="1.5"
            />
            {/* Backlit 7-Segment Digital LCD Display */}
            <rect
              x="10"
              y="10"
              width="60"
              height="28"
              rx="4"
              fill="#04151b"
              stroke="#0e3a47"
              strokeWidth="1.5"
            />
            <text
              x="14"
              y="18"
              fill="#38bdf8"
              fontSize="6"
              fontFamily="monospace"
              fontWeight="bold"
            >
              AUTO DC
            </text>
            <text
              x="66"
              y="32"
              fill="#38bdf8"
              fontSize="12"
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="end"
            >
              {displayV} V
            </text>

            {/* Central Rotary Selector Dial */}
            <circle cx="40" cy="58" r="15" fill="#27272a" stroke="#3f3f46" strokeWidth="1.5" />
            <circle cx="40" cy="58" r="10" fill="#3f3f46" />
            <line x1="40" y1="58" x2="40" y2="46" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" />
            <text x="40" y="44" fill="#facc15" fontSize="5.5" fontWeight="bold" textAnchor="middle">
              V⎓
            </text>
            <text x="56" y="56" fill="#94a3b8" fontSize="5" fontWeight="bold">
              Ω
            </text>
            <text x="24" y="56" fill="#94a3b8" fontSize="5" fontWeight="bold">
              A
            </text>

            {/* Banana Jacks */}
            {/* V+ Jack (Red) at x: 20 */}
            <circle cx="20" cy="94" r="7" fill="#dc2626" stroke="#991b1b" strokeWidth="1" />
            <circle cx="20" cy="94" r="3.5" fill="#090d16" />
            <text x="20" y="84" fill="#f87171" fontSize="5.5" fontWeight="bold" textAnchor="middle">
              VΩmA
            </text>
            <line x1="20" y1="101" x2="20" y2="120" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />

            {/* COM Jack (Black) at x: 60 */}
            <circle cx="60" cy="94" r="7" fill="#27272a" stroke="#090d16" strokeWidth="1" />
            <circle cx="60" cy="94" r="3.5" fill="#090d16" />
            <text x="60" y="84" fill="#cbd5e1" fontSize="5.5" fontWeight="bold" textAnchor="middle">
              COM
            </text>
            <line x1="60" y1="101" x2="60" y2="120" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
          </g>
        );
      }

      case 'oscilloscope': {
        return (
          <g>
            {/* Main Bench Chassis */}
            <rect
              x="0"
              y="0"
              width="140"
              height="90"
              rx="6"
              fill="#0f172a"
              stroke="#334155"
              strokeWidth="2"
              filter="drop-shadow(0 2px 6px rgba(0,0,0,0.5))"
            />
            {/* Screen Bezel & Cathode Graticule Screen */}
            <rect
              x="8"
              y="8"
              width="84"
              height="58"
              rx="4"
              fill="#020617"
              stroke="#1e293b"
              strokeWidth="1.5"
            />
            {/* Graticule Grid */}
            <line x1="8" y1="37" x2="92" y2="37" stroke="#1e293b" strokeWidth="1" strokeDasharray="2 2" />
            <line x1="50" y1="8" x2="50" y2="66" stroke="#1e293b" strokeWidth="1" strokeDasharray="2 2" />
            {/* Mini Animated/Live Scope Trace Waveform */}
            <path
              d="M 12 37 Q 22 18, 32 37 T 52 37 T 72 37 T 88 37"
              fill="none"
              stroke="#facc15"
              strokeWidth="1.5"
              filter="drop-shadow(0 0 2px #facc15)"
            />
            <path
              d="M 12 45 Q 22 55, 32 45 T 52 45 T 72 45 T 88 45"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.5"
              filter="drop-shadow(0 0 2px #38bdf8)"
              opacity="0.85"
            />
            <text x="12" y="16" fill="#facc15" fontSize="5" fontWeight="bold">
              CH1: 1V
            </text>
            <text x="54" y="16" fill="#38bdf8" fontSize="5" fontWeight="bold">
              CH2: 1V
            </text>

            {/* Right Control Knobs & Keys Panel */}
            <circle cx="112" cy="22" r="7" fill="#1e293b" stroke="#475569" strokeWidth="1" />
            <circle cx="112" cy="22" r="4" fill="#334155" />
            <text x="112" y="34" fill="#94a3b8" fontSize="4.5" textAnchor="middle">
              SCALE
            </text>

            <circle cx="112" cy="48" r="7" fill="#1e293b" stroke="#475569" strokeWidth="1" />
            <circle cx="112" cy="48" r="4" fill="#334155" />
            <text x="112" y="60" fill="#94a3b8" fontSize="4.5" textAnchor="middle">
              TIME
            </text>

            {/* BNC Connector Ports at Bottom */}
            {/* CH1 (Yellow) */}
            <circle cx="20" cy="78" r="5" fill="#facc15" />
            <circle cx="20" cy="78" r="2.5" fill="#090d16" />
            <text x="20" y="70" fill="#facc15" fontSize="5" fontWeight="bold" textAnchor="middle">
              CH1
            </text>
            <line x1="20" y1="83" x2="20" y2="100" stroke="#facc15" strokeWidth="1.5" strokeLinecap="round" />

            <circle cx="40" cy="78" r="4" fill="#475569" />
            <circle cx="40" cy="78" r="2" fill="#090d16" />
            <text x="40" y="70" fill="#94a3b8" fontSize="4.5" textAnchor="middle">
              GND
            </text>
            <line x1="40" y1="82" x2="40" y2="100" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />

            {/* CH2 (Cyan) */}
            <circle cx="100" cy="78" r="5" fill="#38bdf8" />
            <circle cx="100" cy="78" r="2.5" fill="#090d16" />
            <text x="100" y="70" fill="#38bdf8" fontSize="5" fontWeight="bold" textAnchor="middle">
              CH2
            </text>
            <line x1="100" y1="83" x2="100" y2="100" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />

            <circle cx="120" cy="78" r="4" fill="#475569" />
            <circle cx="120" cy="78" r="2" fill="#090d16" />
            <text x="120" y="70" fill="#94a3b8" fontSize="4.5" textAnchor="middle">
              GND
            </text>
            <line x1="120" y1="82" x2="120" y2="100" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        );
      }

      case 'logic-analyzer': {
        const channelColors = [
          '#38bdf8', '#a855f7', '#f59e0b', '#10b981',
          '#ec4899', '#06b6d4', '#f97316', '#84cc16'
        ];

        return (
          <g>
            {/* Sleek Anodized Aluminum Body */}
            <rect
              x="0"
              y="0"
              width="74"
              height="200"
              rx="8"
              fill="#1e1e24"
              stroke="#3f3f46"
              strokeWidth="2"
              filter="drop-shadow(0 2px 6px rgba(0,0,0,0.5))"
            />
            {/* Status Indicator LED */}
            <circle cx="37" cy="18" r="3.5" fill="#10b981" filter="drop-shadow(0 0 4px #10b981)" />
            {/* Silkscreen Branding */}
            <text x="37" y="32" fill="#f8fafc" fontSize="8" fontWeight="bold" textAnchor="middle">
              LOGIC 8
            </text>
            <text x="37" y="40" fill="#71717a" fontSize="5" textAnchor="middle">
              24MHz 8-CH
            </text>

            {/* Channel Output Pin Headers on Right (x = 74 to 80, y = 20..160) */}
            {channelColors.map((color, i) => {
              const yPos = 20 + i * 20;
              return (
                <g key={i}>
                  <rect x="60" y={yPos - 4} width="8" height="8" rx="1.5" fill="#090d16" stroke={color} strokeWidth="1" />
                  <circle cx="64" cy={yPos} r="2" fill={color} />
                  <text x="54" y={yPos + 3} fill={color} fontSize="6" fontWeight="bold" textAnchor="end">
                    D{i}
                  </text>
                  <line x1="68" y1={yPos} x2="80" y2={yPos} stroke={color} strokeWidth="2" strokeLinecap="round" />
                </g>
              );
            })}

            {/* GND Pin Header at y = 180 */}
            <rect x="60" y="176" width="8" height="8" rx="1.5" fill="#090d16" stroke="#71717a" strokeWidth="1" />
            <circle cx="64" cy="180" r="2" fill="#71717a" />
            <text x="54" y="183" fill="#a1a1aa" fontSize="6" fontWeight="bold" textAnchor="end">
              GND
            </text>
            <line x1="68" y1="180" x2="80" y2="180" stroke="#71717a" strokeWidth="2" strokeLinecap="round" />
          </g>
        );
      }

      // ----------------------------------------------------
      // 9. PHASE 7.1 EXPANSION PACK (12 NEW COMPONENTS)
      // ----------------------------------------------------
      case 'builtin_humidity_sensor':
      case 'humidity-sensor': {
        const humidity = Math.round(properties.humidity ?? 45);
        const threshold = properties.threshold ?? 60;
        const isHigh = humidity >= threshold;
        return (
          <g>
            {/* Bottom 3 Leads at (-20, 40), (0, 40), (+20, 40) */}
            <line x1="-20" y1="24" x2="-20" y2="40" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="0" y1="24" x2="0" y2="40" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="20" y1="24" x2="20" y2="40" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />

            {/* White/Cyan Perforated DHT22 Housing */}
            <rect
              x="-28"
              y="-34"
              width="56"
              height="58"
              rx="5"
              fill={isDark ? '#e0f2fe' : '#f0f9ff'}
              stroke="#0284c7"
              strokeWidth="2"
            />
            {/* Top Mounting Tab */}
            <rect x="-12" y="-39" width="24" height="6" rx="2" fill="#bae6fd" stroke="#0284c7" strokeWidth="1" />
            <circle cx="0" cy="-36" r="2" fill="#0f172a" />

            {/* Ventilation Louver Grille Slots */}
            {[-26, -20, -14, -8].map((yPos) => (
              <g key={yPos}>
                <rect x="-20" y={yPos} width="16" height="3" rx="1" fill="#0369a1" opacity="0.65" />
                <rect x="4" y={yPos} width="16" height="3" rx="1" fill="#0369a1" opacity="0.65" />
              </g>
            ))}

            {/* Live %RH Readout Badge */}
            <rect x="-22" y="-1" width="44" height="14" rx="3" fill="#0f172a" stroke={isHigh ? '#38bdf8' : '#334155'} strokeWidth="1" />
            <text x="0" y="9" fill={isHigh ? '#38bdf8' : '#94a3b8'} fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              {humidity}% RH
            </text>

            {/* Pin Labels */}
            <text x="-20" y="21" fill="#dc2626" fontSize="5" fontWeight="bold" textAnchor="middle">VCC</text>
            <text x="0" y="21" fill="#0284c7" fontSize="5" fontWeight="bold" textAnchor="middle">OUT</text>
            <text x="20" y="21" fill="#475569" fontSize="5" fontWeight="bold" textAnchor="middle">GND</text>
          </g>
        );
      }

      case 'builtin_dc_motor':
      case 'dc-motor': {
        const rpm = simRunning ? Math.round(component.state?.rpm ?? properties.rpm ?? 0) : 0;
        const direction = (
          simRunning ? component.state?.direction || properties.direction || 'IDLE' : 'IDLE'
        ) as 'CW' | 'CCW' | 'IDLE';
        const isSpinning = simRunning && rpm > 0 && direction !== 'IDLE';
        const spinDur = isSpinning ? `${Math.max(0.12, 0.8 - Math.min(0.65, rpm / 10000)).toFixed(2)}s` : '0s';

        return (
          <g>
            {/* Bottom Terminal Leads at (-20, 40) and (+20, 40) */}
            <line x1="-20" y1="22" x2="-20" y2="40" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
            <line x1="20" y1="22" x2="20" y2="40" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
            <rect x="-25" y="18" width="10" height="6" rx="1" fill="#dc2626" />
            <rect x="15" y="18" width="10" height="6" rx="1" fill="#2563eb" />

            {/* Brushed Steel Motor Can Housing */}
            <circle
              cx="0"
              cy="-6"
              r="28"
              fill={isDark ? '#334155' : '#cbd5e1'}
              stroke="#64748b"
              strokeWidth="2.5"
            />
            <circle cx="0" cy="-6" r="22" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />

            {/* Rotating Armature / Shaft Pulley */}
            <g
              className={isSpinning ? 'animate-spin' : ''}
              style={{
                transformOrigin: '0px -6px',
                animationDuration: spinDur,
                animationDirection: direction === 'CCW' ? 'reverse' : 'normal',
              }}
            >
              {[0, 60, 120, 180, 240, 300].map((deg) => (
                <line
                  key={deg}
                  x1="0"
                  y1="-6"
                  x2="0"
                  y2="-24"
                  stroke={direction === 'CW' ? '#22c55e' : direction === 'CCW' ? '#38bdf8' : '#64748b'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  transform={`rotate(${deg} 0 -6)`}
                />
              ))}
              {/* Keyway notch on rotor */}
              <circle cx="0" cy="-16" r="2.5" fill="#facc15" />
            </g>

            {/* Center Shaft Boss */}
            <circle cx="0" cy="-6" r="6" fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />

            {/* Direction & RPM Status Pill */}
            <rect x="-28" y="-36" width="56" height="12" rx="4" fill="#090d16" stroke="#334155" strokeWidth="1" />
            <text
              x="0"
              y="-27.5"
              fill={direction === 'CW' ? '#4ade80' : direction === 'CCW' ? '#38bdf8' : '#94a3b8'}
              fontSize="6.5"
              fontWeight="bold"
              textAnchor="middle"
              fontFamily="monospace"
            >
              {isSpinning ? `${direction === 'CW' ? '↻ CW' : '↺ CCW'} ${rpm}` : 'DC MOTOR'}
            </text>

            {/* Polarity Silkscreen */}
            <text x="-28" y="34" fill="#ef4444" fontSize="7" fontWeight="bold" textAnchor="middle">M+</text>
            <text x="28" y="34" fill="#3b82f6" fontSize="7" fontWeight="bold" textAnchor="middle">M-</text>
          </g>
        );
      }

      case 'builtin_servo_motor':
      case 'servo-motor': {
        const angle = simRunning
          ? Math.round(component.state?.servoAngle ?? properties.angle ?? 0)
          : 0;
        const hornRot = angle;

        return (
          <g>
            {/* Bottom 3 Leads: SIG (-20, 40), VCC (0, 40), GND (+20, 40) */}
            <line x1="-20" y1="22" x2="-20" y2="40" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="0" y1="22" x2="0" y2="40" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="20" y1="22" x2="20" y2="40" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" />

            {/* SG90 Mounting Ears */}
            <rect x="-36" y="-12" width="72" height="10" rx="2" fill="#0369a1" stroke="#0284c7" strokeWidth="1" />

            {/* Translucent Blue SG90 Body */}
            <rect
              x="-28"
              y="-28"
              width="56"
              height="50"
              rx="5"
              fill="#0284c7"
              stroke="#38bdf8"
              strokeWidth="1.8"
            />
            {/* Gearbox Dome */}
            <circle cx="0" cy="-8" r="14" fill="#0369a1" stroke="#38bdf8" strokeWidth="1.2" />

            {/* Silkscreen & Live Angle Readout */}
            <text x="0" y="15" fill="#e0f2fe" fontSize="7.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              SG90 {angle}°
            </text>

            {/* Rotating White Servo Horn Arm */}
            <g transform={`rotate(${hornRot} 0 -8)`}>
              <path
                d="M -5 -8 L -3 -34 A 3 3 0 0 1 3 -34 L 5 -8 A 5 5 0 0 1 -5 -8 Z"
                fill="#f8fafc"
                stroke="#475569"
                strokeWidth="1.5"
              />
              {/* Linkage holes on horn */}
              <circle cx="0" cy="-18" r="1.3" fill="#334155" />
              <circle cx="0" cy="-24" r="1.3" fill="#334155" />
              <circle cx="0" cy="-30" r="1.5" fill="#ef4444" />
              {/* Center brass screw */}
              <circle cx="0" cy="-8" r="3" fill="#94a3b8" stroke="#334155" strokeWidth="1" />
            </g>

            {/* Pin Labels */}
            <text x="-20" y="34" fill="#f59e0b" fontSize="5" fontWeight="bold">SIG</text>
            <text x="0" y="34" fill="#ef4444" fontSize="5" fontWeight="bold" textAnchor="middle">VCC</text>
            <text x="20" y="34" fill="#a1a1aa" fontSize="5" fontWeight="bold" textAnchor="end">GND</text>
          </g>
        );
      }

      case 'builtin_motion_sensor':
      case 'motion-sensor': {
        const motion = simRunning && Boolean(component.state?.lit || properties.motionDetected);
        return (
          <g>
            {/* Bottom 3 Leads at (-20, 40), (0, 40), (+20, 40) */}
            <line x1="-20" y1="24" x2="-20" y2="40" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="0" y1="24" x2="0" y2="40" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="20" y1="24" x2="20" y2="40" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />

            {/* HC-SR501 Green PCB Base */}
            <rect
              x="-32"
              y="-32"
              width="64"
              height="56"
              rx="5"
              fill="#15803d"
              stroke="#166534"
              strokeWidth="2"
            />

            {/* Expanding Radar Ring when Motion Detected */}
            {motion && (
              <circle
                cx="0"
                cy="-6"
                r="28"
                fill="none"
                stroke="#f97316"
                strokeWidth="2.5"
                strokeDasharray="4 2"
                className="animate-ping"
                opacity="0.75"
              />
            )}

            {/* White Faceted Fresnel Dome Lens */}
            <circle
              cx="0"
              cy="-6"
              r="21"
              fill={motion ? '#fed7aa' : '#f8fafc'}
              stroke={motion ? '#ea580c' : '#cbd5e1'}
              strokeWidth="2"
              filter={motion ? 'drop-shadow(0 0 8px #f97316)' : 'none'}
            />
            {/* Hexagonal Fresnel Facet Lines */}
            <polygon
              points="0,-20 12,-13 12,1 0,8 -12,1 -12,-13"
              fill="none"
              stroke={motion ? '#f97316' : '#cbd5e1'}
              strokeWidth="1.2"
            />
            <circle
              cx="0"
              cy="-6"
              r="7"
              fill={motion ? '#ef4444' : '#e2e8f0'}
              stroke={motion ? '#b91c1c' : '#94a3b8'}
              strokeWidth="1"
            />

            {/* Status Text */}
            <text
              x="0"
              y="21"
              fill={motion ? '#fef08a' : '#dcfce7'}
              fontSize="6"
              fontWeight="bold"
              textAnchor="middle"
              fontFamily="monospace"
            >
              {motion ? 'MOTION!' : 'PIR IDLE'}
            </text>
          </g>
        );
      }

      case 'builtin_gas_sensor':
      case 'gas-sensor': {
        const ppm = Math.round(properties.ppm ?? 50);
        const threshold = properties.threshold ?? 400;
        const isAlarm = ppm >= threshold;
        return (
          <g>
            {/* 4 Bottom Leads at (-40, 40), (-20, 40), (+20, 40), (+40, 40) */}
            <line x1="-40" y1="24" x2="-40" y2="40" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-20" y1="24" x2="-20" y2="40" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="20" y1="24" x2="20" y2="40" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="40" y1="24" x2="40" y2="40" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />

            {/* MQ-2 Breakout PCB (100x80 centered) */}
            <rect
              x="-46"
              y="-34"
              width="92"
              height="58"
              rx="5"
              fill="#991b1b"
              stroke="#7f1d1d"
              strokeWidth="2"
            />

            {/* Stainless-Steel Anti-Explosion Mesh Cylinder */}
            <circle
              cx="0"
              cy="-9"
              r="21"
              fill="#cbd5e1"
              stroke={isAlarm ? '#ef4444' : '#475569'}
              strokeWidth="2.5"
              filter={isAlarm ? 'drop-shadow(0 0 8px #ef4444)' : 'none'}
            />
            <circle cx="0" cy="-9" r="15" fill="#64748b" stroke="#334155" strokeWidth="1" />
            {/* Wire Gauze Cross-Hatch */}
            <path
              d="M -11 -14 L 11 -14 M -13 -9 L 13 -9 M -11 -4 L 11 -4 M -6 -20 L -6 2 M 0 -22 L 0 4 M 6 -20 L 6 2"
              stroke="#94a3b8"
              strokeWidth="1"
              opacity="0.7"
            />

            {/* Alarm DO LED */}
            <circle cx="34" cy="-22" r="3.5" fill={isAlarm ? '#22c55e' : '#14532d'} stroke="#ffffff" strokeWidth="0.6" />

            {/* Live PPM Badge */}
            <rect x="-32" y="11" width="64" height="11" rx="2.5" fill="#090d16" />
            <text
              x="0"
              y="19"
              fill={isAlarm ? '#f87171' : '#38bdf8'}
              fontSize="6.5"
              fontWeight="bold"
              textAnchor="middle"
              fontFamily="monospace"
            >
              MQ-2: {ppm} PPM
            </text>

            {/* Pin Labels */}
            <text x="-40" y="34" fill="#fca5a5" fontSize="5" fontWeight="bold" textAnchor="middle">VCC</text>
            <text x="-20" y="34" fill="#cbd5e1" fontSize="5" fontWeight="bold" textAnchor="middle">GND</text>
            <text x="20" y="34" fill="#86efac" fontSize="5" fontWeight="bold" textAnchor="middle">DO</text>
            <text x="40" y="34" fill="#7dd3fc" fontSize="5" fontWeight="bold" textAnchor="middle">AO</text>
          </g>
        );
      }

      case 'builtin_accelerometer':
      case 'accelerometer': {
        const ax = Number(properties.accelX ?? 0);
        const ay = Number(properties.accelY ?? 0);
        const az = Number(properties.accelZ ?? 1.0);
        const bubbleX = Math.max(-14, Math.min(14, ax * 5));
        const bubbleY = -8 + Math.max(-12, Math.min(12, ay * 4));

        return (
          <g>
            {/* 5 Bottom Pins: (-40, 40), (-20, 40), (0, 40), (+20, 40), (+40, 40) */}
            {[-40, -20, 0, 20, 40].map((px, idx) => (
              <line
                key={px}
                x1={px}
                y1="24"
                x2={px}
                y2="40"
                stroke={idx === 0 ? '#ef4444' : idx === 1 ? leadColor : '#38bdf8'}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            ))}

            {/* Purple/Indigo ADXL335 MEMS Breakout Board (120x80 centered) */}
            <rect
              x="-54"
              y="-34"
              width="108"
              height="58"
              rx="6"
              fill="#312e81"
              stroke="#4f46e5"
              strokeWidth="2"
            />

            {/* Bubble-Level Spirit Ring & MEMS Chip */}
            <circle cx="0" cy="-8" r="18" fill="#0f172a" stroke="#6366f1" strokeWidth="1.5" />
            <line x1="-18" y1="-8" x2="18" y2="-8" stroke="#312e81" strokeWidth="1" strokeDasharray="2 2" />
            <line x1="0" y1="-26" x2="0" y2="10" stroke="#312e81" strokeWidth="1" strokeDasharray="2 2" />

            {/* Dynamic Tilt Bubble Dot */}
            <circle
              cx={bubbleX}
              cy={bubbleY}
              r="4.5"
              fill="#38bdf8"
              stroke="#ffffff"
              strokeWidth="1"
              filter="drop-shadow(0 0 4px #38bdf8)"
            />

            {/* Axis Legend & Readouts */}
            <text x="-46" y="-22" fill="#a5b4fc" fontSize="6" fontWeight="bold">ADXL335</text>
            <text x="-46" y="-11" fill="#38bdf8" fontSize="6" fontFamily="monospace">X:{ax.toFixed(1)}g</text>
            <text x="-46" y="-2" fill="#4ade80" fontSize="6" fontFamily="monospace">Y:{ay.toFixed(1)}g</text>
            <text x="22" y="-11" fill="#facc15" fontSize="6" fontFamily="monospace">Z:{az.toFixed(1)}g</text>

            {/* Bottom Pin Silkscreen */}
            <text x="-40" y="21" fill="#fca5a5" fontSize="5" fontWeight="bold" textAnchor="middle">VCC</text>
            <text x="-20" y="21" fill="#cbd5e1" fontSize="5" fontWeight="bold" textAnchor="middle">GND</text>
            <text x="0" y="21" fill="#38bdf8" fontSize="5.5" fontWeight="bold" textAnchor="middle">X</text>
            <text x="20" y="21" fill="#4ade80" fontSize="5.5" fontWeight="bold" textAnchor="middle">Y</text>
            <text x="40" y="21" fill="#facc15" fontSize="5.5" fontWeight="bold" textAnchor="middle">Z</text>
          </g>
        );
      }

      case 'builtin_cpu_8bit':
      case 'cpu-8bit': {
        const regs = component.state?.asmRegisters;
        const pcHex = (regs?.pc ?? 0).toString(16).toUpperCase().padStart(2, '0');
        const accHex = (regs?.acc ?? 0).toString(16).toUpperCase().padStart(2, '0');
        const bHex = (regs?.regB ?? 0).toString(16).toUpperCase().padStart(2, '0');
        const zFlag = regs?.zeroFlag ?? 0;
        const cFlag = regs?.carryFlag ?? 0;
        const mnemonic = regs?.currentMnemonic || 'READY';

        return (
          <g>
            {/* 20-Pin Ceramic DIP Package (120x220 centered at 0,0) */}
            <rect
              x="-46"
              y="-104"
              width="92"
              height="208"
              rx="5"
              fill="#18181b"
              stroke="#52525b"
              strokeWidth="2.5"
            />
            {/* Top Half-Moon Orientation Notch */}
            <path d="M -12 -104 A 12 12 0 0 0 12 -104" fill="#090d16" stroke="#52525b" strokeWidth="1.5" />

            {/* Gold-Plated Ceramic Cavity Lid */}
            <rect
              x="-24"
              y="-58"
              width="48"
              height="68"
              rx="3"
              fill="#ca8a04"
              stroke="#facc15"
              strokeWidth="1.5"
            />
            <rect x="-20" y="-54" width="40" height="60" rx="2" fill="#090d16" />

            {/* CPU Branding & Live Register Telemetry Screen */}
            <text x="0" y="-76" fill="#facc15" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              SECS-808
            </text>
            <text x="0" y="-66" fill="#a1a1aa" fontSize="5.5" fontWeight="bold" textAnchor="middle">
              8-BIT ASM CPU
            </text>

            <text x="0" y="-42" fill="#38bdf8" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              PC:{pcHex} A:{accHex}
            </text>
            <text x="0" y="-30" fill="#4ade80" fontSize="6.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              B:{bHex} Z:{zFlag} C:{cFlag}
            </text>
            <text x="0" y="-14" fill="#f8fafc" fontSize="5.5" textAnchor="middle" fontFamily="monospace">
              {mnemonic.slice(0, 10)}
            </text>

            {/* 20 Gull-Wing Pins & Labels along Left (-60) and Right (+60) */}
            {definition.pins.map((pin) => {
              const isLeft = pin.x < 0;
              const pVal = component.state?.pinSignals?.[pin.id] ?? component.state?.pinSignals?.[pin.id.toLowerCase()];
              const isPinHigh = pVal === 1 || (component.state?.pinVoltages?.[pin.id] ?? 0) >= 2.0;
              return (
                <g key={pin.id}>
                  <line
                    x1={isLeft ? -60 : 46}
                    y1={pin.y}
                    x2={isLeft ? -46 : 60}
                    y2={pin.y}
                    stroke={isPinHigh ? '#38bdf8' : '#cbd5e1'}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <text
                    x={isLeft ? -42 : 42}
                    y={pin.y + 2}
                    fill={isPinHigh ? '#38bdf8' : '#d4d4d8'}
                    fontSize="5.5"
                    fontWeight="bold"
                    textAnchor={isLeft ? 'start' : 'end'}
                    fontFamily="monospace"
                  >
                    {pin.label || pin.name}
                  </text>
                </g>
              );
            })}
          </g>
        );
      }

      case 'builtin_oled_display':
      case 'oled-display': {
        const displaySize = String(properties.displaySize || '128x64');
        const pixelColor = String(properties.pixelColor || '#38bdf8');
        const rawText = String(component.state?.displayText ?? properties.displayText ?? '');
        const lines = rawText.trim()
          ? rawText.split('\n').slice(0, displaySize === '128x32' ? 2 : 4)
          : [];
        const progressBar = typeof properties.progressBar === 'number' ? properties.progressBar : null;
        const isSlim = displaySize === '128x32';
        const isLarge = displaySize === '128x64-large';
        const screenH = isSlim ? 34 : isLarge ? 56 : 48;
        const screenY = isSlim ? -24 : -34;

        return (
          <g>
            {/* 5 Bottom Pins: (-40, 40), (-20, 40), (0, 40), (+20, 40), (+40, 40) */}
            {[-40, -20, 0, 20, 40].map((px) => (
              <line key={px} x1={px} y1="26" x2={px} y2="40" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            ))}

            {/* OLED Breakout PCB (120x100 centered at 0,0) */}
            <rect
              x="-54"
              y="-44"
              width="108"
              height="74"
              rx="6"
              fill="#1e3a8a"
              stroke="#1d4ed8"
              strokeWidth="2"
            />
            {/* Corner Mounting Holes */}
            <circle cx="-47" cy="-37" r="2.5" fill="#090d16" stroke="#93c5fd" strokeWidth="0.8" />
            <circle cx="47" cy="-37" r="2.5" fill="#090d16" stroke="#93c5fd" strokeWidth="0.8" />

            {/* Pitch-Black Glass OLED Panel */}
            <rect
              x="-48"
              y={screenY}
              width="96"
              height={screenH}
              rx="3"
              fill="#020617"
              stroke="#334155"
              strokeWidth="1.5"
            />

            {/* Crisp Monospace Pixel Text Rows */}
            {lines.map((line, idx) => {
              const rowColor =
                pixelColor === 'yellow-blue'
                  ? idx === 0
                    ? '#facc15'
                    : '#38bdf8'
                  : pixelColor;
              return (
                <text
                  key={idx}
                  x="-43"
                  y={screenY + 11 + idx * 11}
                  fill={rowColor}
                  fontSize="7.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                  filter={`drop-shadow(0 0 2px ${rowColor})`}
                >
                  {line.slice(0, 16)}
                </text>
              );
            })}

            {/* Optional Progress Bar */}
            {progressBar !== null && (
              <g>
                <rect x="-42" y={screenY + screenH - 9} width="84" height="5" rx="1.5" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.8" />
                <rect
                  x="-41"
                  y={screenY + screenH - 8}
                  width={Math.round(82 * (Math.max(0, Math.min(100, progressBar)) / 100))}
                  height="3"
                  rx="1"
                  fill="#38bdf8"
                />
              </g>
            )}

            {/* Silkscreen Pin Labels */}
            <text x="-40" y="25" fill="#cbd5e1" fontSize="4.8" fontWeight="bold" textAnchor="middle">GND</text>
            <text x="-20" y="25" fill="#fca5a5" fontSize="4.8" fontWeight="bold" textAnchor="middle">VCC</text>
            <text x="0" y="25" fill="#93c5fd" fontSize="4.8" fontWeight="bold" textAnchor="middle">SCK</text>
            <text x="20" y="25" fill="#93c5fd" fontSize="4.8" fontWeight="bold" textAnchor="middle">SDA</text>
            <text x="40" y="25" fill="#fde68a" fontSize="4.8" fontWeight="bold" textAnchor="middle">DC</text>
          </g>
        );
      }

      case 'builtin_lcd_16x2':
      case 'lcd-16x2': {
        const row1 = String(component.state?.row1Text ?? properties.row1Text ?? '')
          .padEnd(16, ' ')
          .slice(0, 16);
        const row2 = String(component.state?.row2Text ?? properties.row2Text ?? '')
          .padEnd(16, ' ')
          .slice(0, 16);
        const isBlue = String(properties.backlightColor || '').toLowerCase().includes('blue');
        const bgFill = isBlue ? '#0284c7' : '#84cc16';
        const cellFill = isBlue ? '#0369a1' : '#65a30d';
        const textFill = isBlue ? '#f8fafc' : '#0f172a';

        return (
          <g>
            {/* 7 Bottom Pins at (-60, 40)..(+60, 40) */}
            {[-60, -40, -20, 0, 20, 40, 60].map((px) => (
              <line key={px} x1={px} y1="26" x2={px} y2="40" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            ))}

            {/* Green HD44780 PCB Bezel (160x80 centered at 0,0) */}
            <rect
              x="-76"
              y="-36"
              width="152"
              height="64"
              rx="5"
              fill="#15803d"
              stroke="#166534"
              strokeWidth="2"
            />
            {/* Black Metal Screen Frame */}
            <rect x="-70" y="-30" width="140" height="44" rx="3" fill="#090d16" stroke="#27272a" strokeWidth="1.5" />

            {/* Backlit 16x2 LCD Glass Viewport */}
            <rect x="-65" y="-26" width="130" height="36" rx="2" fill={bgFill} />

            {/* 16x2 Character Grid Cells & Text */}
            {Array.from({ length: 16 }).map((_, col) => {
              const cellX = -62 + col * 7.8;
              return (
                <g key={col}>
                  <rect x={cellX} y="-23" width="6.8" height="13" rx="0.5" fill={cellFill} opacity="0.45" />
                  <rect x={cellX} y="-7" width="6.8" height="13" rx="0.5" fill={cellFill} opacity="0.45" />
                  <text
                    x={cellX + 3.4}
                    y="-13.5"
                    fill={textFill}
                    fontSize="8.5"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {row1[col]}
                  </text>
                  <text
                    x={cellX + 3.4}
                    y="2.5"
                    fill={textFill}
                    fontSize="8.5"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {row2[col]}
                  </text>
                </g>
              );
            })}

            {/* Pin Silkscreen */}
            {[
              { x: -60, l: 'GND' },
              { x: -40, l: 'VCC' },
              { x: -20, l: 'SDA' },
              { x: 0, l: 'SCL' },
              { x: 20, l: 'D4' },
              { x: 40, l: 'D5' },
              { x: 60, l: 'D6' },
            ].map((p) => (
              <text key={p.x} x={p.x} y="24" fill="#dcfce7" fontSize="4.8" fontWeight="bold" textAnchor="middle">
                {p.l}
              </text>
            ))}
          </g>
        );
      }

      case 'builtin_sd_card':
      case 'sd-card': {
        const filesObj = (properties.files || {}) as Record<string, string>;
        const fileCount = Object.keys(filesObj).length;
        const sdActive = Boolean(component.state?.sdActivity);

        return (
          <g>
            {/* 6 Bottom Pins at (-60, 40), (-40, 40), (-20, 40), (+20, 40), (+40, 40), (+60, 40) */}
            {[-60, -40, -20, 20, 40, 60].map((px) => (
              <line key={px} x1={px} y1="24" x2={px} y2="40" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            ))}

            {/* Inserted MicroSD Card protruding from top edge */}
            <rect x="-24" y="-42" width="48" height="16" rx="2" fill="#dc2626" stroke="#991b1b" strokeWidth="1.2" />
            <text x="0" y="-33" fill="#ffffff" fontSize="5.5" fontWeight="bold" textAnchor="middle">
              16GB MicroSD
            </text>

            {/* Blue Breakout PCB (120x80 centered at 0,0) */}
            <rect
              x="-66"
              y="-32"
              width="132"
              height="58"
              rx="5"
              fill="#0369a1"
              stroke="#0284c7"
              strokeWidth="2"
            />

            {/* Brushed Stainless-Steel MicroSD Socket Shield */}
            <rect
              x="-34"
              y="-28"
              width="68"
              height="38"
              rx="3"
              fill="#cbd5e1"
              stroke="#64748b"
              strokeWidth="1.5"
            />
            <rect x="-24" y="-20" width="48" height="22" rx="2" fill="#0f172a" />
            <text x="0" y="-7" fill="#38bdf8" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              {fileCount} FILE{fileCount === 1 ? '' : 'S'}
            </text>

            {/* Activity LED (ACT) */}
            <circle
              cx="48"
              cy="-14"
              r="4"
              fill={sdActive ? '#22c55e' : '#14532d'}
              stroke="#ffffff"
              strokeWidth="0.8"
              filter={sdActive ? 'drop-shadow(0 0 6px #22c55e)' : 'none'}
            />
            <text x="48" y="-4" fill="#bae6fd" fontSize="5" fontWeight="bold" textAnchor="middle">ACT</text>

            {/* Pin Labels */}
            {[
              { x: -60, l: 'GND' },
              { x: -40, l: 'VCC' },
              { x: -20, l: 'MISO' },
              { x: 20, l: 'MOSI' },
              { x: 40, l: 'SCK' },
              { x: 60, l: 'CS' },
            ].map((p) => (
              <text key={p.x} x={p.x} y="21" fill="#e0f2fe" fontSize="4.8" fontWeight="bold" textAnchor="middle">
                {p.l}
              </text>
            ))}
          </g>
        );
      }

      case 'builtin_dcdc_converter':
      case 'dcdc-converter': {
        const targetV = Number(properties.targetVoltage ?? 12.0);
        const vOut = component.state?.outputVoltage ?? targetV;
        const mode = String(properties.converterMode || 'Auto Buck-Boost');
        const shortMode = mode.includes('Buck') && !mode.includes('Boost') ? 'BUCK' : mode.includes('Boost') && !mode.includes('Buck') ? 'BOOST' : 'AUTO';

        return (
          <g>
            {/* 4 Corner Leads: VIN+ (-60, -20), VIN- (-60, +20), VOUT+ (+60, -20), VOUT- (+60, +20) */}
            <line x1="-60" y1="-20" x2="-48" y2="-20" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
            <line x1="-60" y1="20" x2="-48" y2="20" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
            <line x1="48" y1="-20" x2="60" y2="-20" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
            <line x1="48" y1="20" x2="60" y2="20" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />

            {/* Blue Buck-Boost Module PCB (120x80 centered at 0,0) */}
            <rect
              x="-50"
              y="-34"
              width="100"
              height="68"
              rx="5"
              fill="#1e40af"
              stroke="#3b82f6"
              strokeWidth="2"
            />

            {/* Copper-Wound Toroidal Inductor Coil */}
            <circle cx="-20" cy="-6" r="14" fill="#18181b" stroke="#b45309" strokeWidth="3" strokeDasharray="3 1.5" />
            <circle cx="-20" cy="-6" r="6" fill="#1e40af" />

            {/* Blue Multiturn Trimmer Potentiometer with Brass Screw */}
            <rect x="-32" y="14" width="24" height="12" rx="1.5" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
            <circle cx="-26" cy="20" r="3.5" fill="#facc15" stroke="#b45309" strokeWidth="0.8" />
            <line x1="-28" y1="20" x2="-24" y2="20" stroke="#78350f" strokeWidth="1" />

            {/* 3-Digit Red 7-Segment LED Voltmeter Display */}
            <rect x="2" y="-22" width="40" height="22" rx="2.5" fill="#090d16" stroke="#334155" strokeWidth="1.2" />
            <text
              x="22"
              y="-7"
              fill="#ef4444"
              fontSize="10"
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
              filter="drop-shadow(0 0 4px #ef4444)"
            >
              {vOut.toFixed(1)}V
            </text>

            {/* Mode Badge */}
            <rect x="4" y="6" width="36" height="12" rx="2" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.8" />
            <text x="22" y="14.5" fill="#38bdf8" fontSize="6" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              {shortMode}
            </text>

            {/* Terminal Silkscreen */}
            <text x="-44" y="-17" fill="#fca5a5" fontSize="5" fontWeight="bold">IN+</text>
            <text x="-44" y="23" fill="#93c5fd" fontSize="5" fontWeight="bold">IN-</text>
            <text x="44" y="-17" fill="#fca5a5" fontSize="5" fontWeight="bold" textAnchor="end">OUT+</text>
            <text x="44" y="23" fill="#93c5fd" fontSize="5" fontWeight="bold" textAnchor="end">OUT-</text>
          </g>
        );
      }

      case 'builtin_numpad':
      case 'numpad': {
        const activeKey = String(properties.activeKey ?? component.state?.activeKey ?? '').trim().toUpperCase();
        const keys = [
          ['1', '2', '3', 'A'],
          ['4', '5', '6', 'B'],
          ['7', '8', '9', 'C'],
          ['*', '0', '#', 'D'],
        ];

        return (
          <g>
            {/* Left Row Pins (-60, -40..+40) & Right Col Pins (+60, -40..+40) */}
            {[-40, -20, 20, 40].map((py) => (
              <React.Fragment key={py}>
                <line x1="-60" y1={py} x2="-48" y2={py} stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
                <line x1="48" y1={py} x2="60" y2={py} stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
              </React.Fragment>
            ))}
            {/* Bottom Convenience Pins: VCC (-20, 80), OUT (0, 80), GND (+20, 80) */}
            <line x1="-20" y1="68" x2="-20" y2="80" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="0" y1="68" x2="0" y2="80" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="20" y1="68" x2="20" y2="80" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />

            {/* Membrane Numpad Body (120x160 centered at 0,0) */}
            <rect
              x="-48"
              y="-72"
              width="96"
              height="140"
              rx="7"
              fill="#0f172a"
              stroke="#334155"
              strokeWidth="2.5"
            />
            <text x="0" y="-60" fill="#94a3b8" fontSize="6" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              4x4 MATRIX KEYPAD {activeKey ? `[${activeKey}]` : ''}
            </text>

            {/* 16 Interactive Membrane Keys */}
            {keys.map((row, rIdx) =>
              row.map((k, cIdx) => {
                const kx = -40 + cIdx * 21;
                const ky = -52 + rIdx * 27;
                const isPressed = activeKey === k;
                const isLetter = ['A', 'B', 'C', 'D'].includes(k);
                const isSymbol = ['*', '#'].includes(k);
                const baseFill = isPressed
                  ? '#22c55e'
                  : isLetter
                  ? '#dc2626'
                  : isSymbol
                  ? '#ea580c'
                  : '#1e293b';

                return (
                  <g
                    key={k}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      useCircuitStore.getState().updateComponentProperty(component.id, 'activeKey', k);
                      setTimeout(() => {
                        useCircuitStore.getState().updateComponentProperty(component.id, 'activeKey', '');
                      }, 250);
                    }}
                  >
                    <rect
                      x={kx}
                      y={ky}
                      width="17"
                      height="21"
                      rx="3.5"
                      fill={baseFill}
                      stroke={isPressed ? '#86efac' : '#cbd5e1'}
                      strokeWidth={isPressed ? '1.8' : '1'}
                    />
                    <text
                      x={kx + 8.5}
                      y={ky + 14}
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {k}
                    </text>
                  </g>
                );
              })
            )}

            {/* Bottom Pin Labels */}
            <text x="-20" y="64" fill="#fca5a5" fontSize="4.8" fontWeight="bold" textAnchor="middle">VCC</text>
            <text x="0" y="64" fill="#38bdf8" fontSize="4.8" fontWeight="bold" textAnchor="middle">OUT</text>
            <text x="20" y="64" fill="#cbd5e1" fontSize="4.8" fontWeight="bold" textAnchor="middle">GND</text>
          </g>
        );
      }

      // =======================================================================
      // PHASE 7.4 EXPANSION: 16 COMPONENT FAMILIES (19 BUILTIN TYPES)
      // =======================================================================

      // 1. Voltage Comparator IC (LM393)
      case 'builtin_comparator': {
        const outBit = component.state?.logicOutput ?? (component.state?.outputVoltage ?? 0) >= 2.5 ? 1 : 0;
        return (
          <g>
            <line x1="-40" y1="-20" x2="-25" y2="-20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-40" y1="20" x2="-25" y2="20" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="0" y1="-40" x2="0" y2="-20" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="20" x2="0" y2="40" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
            <line x1="25" y1="0" x2="40" y2="0" stroke={outBit === 1 ? '#38bdf8' : leadColor} strokeWidth="2.5" strokeLinecap="round" />

            <polygon points="-25,-28 -25,28 25,0" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" strokeLinejoin="round" />
            <text x="-18" y="-14" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">+</text>
            <text x="-18" y="24" fill="#94a3b8" fontSize="11" fontWeight="bold" textAnchor="middle">-</text>

            {/* Hysteresis step wave icon */}
            <path d="M -6,8 L 0,8 L 0,-8 L 6,-8" fill="none" stroke="#eab308" strokeWidth="1.5" strokeLinecap="round" />
            <text x="0" y="-30" fill="#94a3b8" fontSize="6.5" fontWeight="bold" textAnchor="middle">LM393</text>
          </g>
        );
      }

      // 2. 8-Bit Shift Register (74HC595 SIPO)
      case 'builtin_shift_register': {
        const outputBits = (component.state?.outputBits ?? properties.outputBits ?? 0) & 0xFF;
        const bitsStr = outputBits.toString(2).padStart(8, '0');
        const qPinsY = [-60, -40, -20, 0, 20, 40, 60, 80];

        return (
          <g>
            {/* Left Pin Leads */}
            <line x1="-60" y1="-60" x2="-45" y2="-60" stroke={leadColor} strokeWidth="2" />
            <line x1="-60" y1="-20" x2="-45" y2="-20" stroke={leadColor} strokeWidth="2" />
            <line x1="-60" y1="20" x2="-45" y2="20" stroke={leadColor} strokeWidth="2" />
            <line x1="-60" y1="60" x2="-45" y2="60" stroke={leadColor} strokeWidth="2" />
            <line x1="-20" y1="-80" x2="-20" y2="-72" stroke="#ef4444" strokeWidth="2" />
            <line x1="-20" y1="72" x2="-20" y2="80" stroke="#64748b" strokeWidth="2" />

            {/* Right Pin Leads (Q0..Q7) */}
            {qPinsY.map((py, idx) => {
              const isHigh = (outputBits & (1 << idx)) !== 0;
              return (
                <line key={py} x1="45" y1={py} x2="60" y2={py} stroke={isHigh ? '#38bdf8' : leadColor} strokeWidth="2" />
              );
            })}

            {/* DIP IC Body */}
            <rect x="-45" y="-72" width="90" height="152" rx="6" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            <path d="M -8,-72 A 8,8 0 0,0 8,-72" fill="none" stroke="#475569" strokeWidth="2" />

            <text x="0" y="-55" fill="#f8fafc" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              74HC595
            </text>
            <text x="0" y="-44" fill="#94a3b8" fontSize="5.5" textAnchor="middle">8-BIT SIPO</text>

            {/* Live 8-Bit Binary Display Badge */}
            <rect x="-38" y="-12" width="76" height="24" rx="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
            <text x="0" y="4" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              {bitsStr}
            </text>

            {/* Pin Labels inside chip */}
            <text x="-40" y="-57" fill="#cbd5e1" fontSize="5" textAnchor="start">DATA</text>
            <text x="-40" y="-17" fill="#cbd5e1" fontSize="5" textAnchor="start">CLK</text>
            <text x="-40" y="23" fill="#cbd5e1" fontSize="5" textAnchor="start">LATCH</text>
            <text x="-40" y="63" fill="#cbd5e1" fontSize="5" textAnchor="start">RST</text>
            {qPinsY.map((py, idx) => (
              <text key={`l_q${idx}`} x="40" y={py + 2} fill="#94a3b8" fontSize="5" textAnchor="end">{`Q${idx}`}</text>
            ))}
          </g>
        );
      }

      // 3. BCD to 7-Segment Decoder (CD4511)
      case 'builtin_bcd_decoder': {
        const segPinsY = [-60, -40, -20, 0, 20, 40, 60];
        const segLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
        const val = typeof component.state?.count === 'number' ? component.state.count : 0;

        return (
          <g>
            {/* Left Inputs D0..D3 */}
            {[-60, -20, 20, 60].map((py) => (
              <line key={py} x1="-60" y1={py} x2="-45" y2={py} stroke={leadColor} strokeWidth="2" />
            ))}
            <line x1="0" y1="-80" x2="0" y2="-68" stroke="#ef4444" strokeWidth="2" />
            <line x1="0" y1="68" x2="0" y2="80" stroke="#64748b" strokeWidth="2" />

            {/* Right Segment Outputs a..g */}
            {segPinsY.map((py) => (
              <line key={py} x1="45" y1={py} x2="60" y2={py} stroke={leadColor} strokeWidth="2" />
            ))}

            <rect x="-45" y="-68" width="90" height="136" rx="6" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            <path d="M -8,-68 A 8,8 0 0,0 8,-68" fill="none" stroke="#475569" strokeWidth="2" />

            <text x="0" y="-50" fill="#f8fafc" fontSize="8" fontWeight="bold" textAnchor="middle">CD4511</text>
            <text x="0" y="-40" fill="#94a3b8" fontSize="5.5" textAnchor="middle">BCD-7SEG</text>

            {/* Digit Preview Box */}
            <rect x="-18" y="-16" width="36" height="32" rx="4" fill="#0f172a" stroke="#eab308" strokeWidth="1.5" />
            <text x="0" y="8" fill="#eab308" fontSize="18" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              {val < 10 ? val : '-'}
            </text>

            <text x="-40" y="-57" fill="#cbd5e1" fontSize="5">D0</text>
            <text x="-40" y="-17" fill="#cbd5e1" fontSize="5">D1</text>
            <text x="-40" y="23" fill="#cbd5e1" fontSize="5">D2</text>
            <text x="-40" y="63" fill="#cbd5e1" fontSize="5">D3</text>
            {segPinsY.map((py, idx) => (
              <text key={py} x="40" y={py + 2} fill="#94a3b8" fontSize="5" textAnchor="end">{segLetters[idx]}</text>
            ))}
          </g>
        );
      }

      // 4. 4-to-1 Multiplexer (74HC153)
      case 'builtin_mux_4to1': {
        const selIdx = typeof component.state?.selectedIndex === 'number' ? component.state.selectedIndex : 0;
        return (
          <g>
            {[-60, -20, 20, 60].map((py) => (
              <line key={py} x1="-40" y1={py} x2="-28" y2={py} stroke={leadColor} strokeWidth="2" />
            ))}
            <line x1="-20" y1="68" x2="-20" y2="80" stroke={leadColor} strokeWidth="2" />
            <line x1="20" y1="68" x2="20" y2="80" stroke={leadColor} strokeWidth="2" />
            <line x1="28" y1="0" x2="40" y2="0" stroke="#38bdf8" strokeWidth="2.5" />

            <polygon points="-28,-68 28,-36 28,36 -28,68" fill="#1e293b" stroke="#818cf8" strokeWidth="2" />
            <text x="0" y="-10" fill="#f8fafc" fontSize="8" fontWeight="bold" textAnchor="middle">MUX</text>
            <text x="0" y="4" fill="#a5b4fc" fontSize="6" textAnchor="middle">4:1</text>
            <text x="0" y="18" fill="#eab308" fontSize="6.5" fontWeight="bold" textAnchor="middle">SEL: I{selIdx}</text>

            <text x="-24" y="-57" fill="#cbd5e1" fontSize="5">I0</text>
            <text x="-24" y="-17" fill="#cbd5e1" fontSize="5">I1</text>
            <text x="-24" y="23" fill="#cbd5e1" fontSize="5">I2</text>
            <text x="-24" y="63" fill="#cbd5e1" fontSize="5">I3</text>
            <text x="24" y="2" fill="#38bdf8" fontSize="6" fontWeight="bold" textAnchor="end">Y</text>
            <text x="-20" y="62" fill="#cbd5e1" fontSize="5" textAnchor="middle">S0</text>
            <text x="20" y="62" fill="#cbd5e1" fontSize="5" textAnchor="middle">S1</text>
          </g>
        );
      }

      // 5A & 5B: D Flip-Flop & JK Flip-Flop
      case 'builtin_d_flipflop':
      case 'builtin_jk_flipflop': {
        const isD = component.type === 'builtin_d_flipflop';
        const qVal = component.state?.q ?? properties.q ?? 0;

        return (
          <g>
            {/* Input and Output Leads */}
            <line x1="-40" y1="-20" x2="-26" y2="-20" stroke={leadColor} strokeWidth="2" />
            <line x1="-40" y1={isD ? 20 : 0} x2="-26" y2={isD ? 20 : 0} stroke={leadColor} strokeWidth="2" />
            {!isD && <line x1="-40" y1="20" x2="-26" y2="20" stroke={leadColor} strokeWidth="2" />}
            {isD && <line x1="0" y1="-40" x2="0" y2="-26" stroke="#ef4444" strokeWidth="2" />}
            <line x1="0" y1="26" x2="0" y2="40" stroke="#64748b" strokeWidth="2" />
            <line x1="26" y1="-20" x2="40" y2="-20" stroke={qVal === 1 ? '#38bdf8' : leadColor} strokeWidth="2.5" />
            <line x1="26" y1="20" x2="40" y2="20" stroke={qVal === 0 ? '#38bdf8' : leadColor} strokeWidth="2" />

            <rect x="-26" y="-26" width="52" height="52" rx="4" fill="#1e293b" stroke={isD ? '#38bdf8' : '#a855f7'} strokeWidth="2" />
            {/* Clock Dynamic Edge Triangle */}
            <path d={`M -26,${(isD ? 20 : 0) - 5} L -18,${isD ? 20 : 0} L -26,${(isD ? 20 : 0) + 5}`} fill="none" stroke="#94a3b8" strokeWidth="1.5" />

            <text x="0" y="-12" fill="#f8fafc" fontSize="7" fontWeight="bold" textAnchor="middle">{isD ? '74HC74' : '74HC73'}</text>
            <text x="0" y="-3" fill="#94a3b8" fontSize="5" textAnchor="middle">{isD ? 'D-FF' : 'JK-FF'}</text>
            <rect x="-10" y="5" width="20" height="14" rx="2" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
            <text x="0" y="16" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">{qVal}</text>

            <text x="-22" y="-18" fill="#cbd5e1" fontSize="5">{isD ? 'D' : 'J'}</text>
            {!isD && <text x="-22" y="22" fill="#cbd5e1" fontSize="5">K</text>}
            <text x="22" y="-18" fill="#cbd5e1" fontSize="5" textAnchor="end">Q</text>
            <text x="22" y="22" fill="#cbd5e1" fontSize="5" textAnchor="end">!Q</text>
          </g>
        );
      }

      // 6. 4-Bit Binary Counter IC (74HC161)
      case 'builtin_counter_4bit': {
        const count = typeof component.state?.count === 'number' ? component.state.count : (typeof properties.count === 'number' ? properties.count : 0);
        const qY = [-60, -20, 20, 60];

        return (
          <g>
            <line x1="-40" y1="-40" x2="-26" y2="-40" stroke={leadColor} strokeWidth="2" />
            <line x1="-40" y1="0" x2="-26" y2="0" stroke={leadColor} strokeWidth="2" />
            <line x1="-40" y1="40" x2="-26" y2="40" stroke={leadColor} strokeWidth="2" />
            {qY.map((py, idx) => {
              const bitHigh = (count & (1 << idx)) !== 0;
              return <line key={py} x1="26" y1={py} x2="40" y2={py} stroke={bitHigh ? '#ec4899' : leadColor} strokeWidth="2" />;
            })}

            <rect x="-26" y="-68" width="52" height="136" rx="6" fill="#1e293b" stroke="#ec4899" strokeWidth="2" />
            <text x="0" y="-52" fill="#f8fafc" fontSize="7" fontWeight="bold" textAnchor="middle">74HC161</text>
            <text x="0" y="-42" fill="#f472b6" fontSize="5" textAnchor="middle">COUNTER</text>

            {/* Live Count Badge */}
            <rect x="-20" y="-15" width="40" height="30" rx="4" fill="#0f172a" stroke="#ec4899" strokeWidth="1.5" />
            <text x="0" y="2" fill="#ec4899" fontSize="14" fontWeight="bold" textAnchor="middle" fontFamily="monospace">{count}</text>
            <text x="0" y="11" fill="#94a3b8" fontSize="5.5" textAnchor="middle" fontFamily="monospace">
              {(count & 0xF).toString(2).padStart(4, '0')}
            </text>

            <text x="-22" y="-38" fill="#cbd5e1" fontSize="5">CLK</text>
            <text x="-22" y="2" fill="#cbd5e1" fontSize="5">EN</text>
            <text x="-22" y="42" fill="#cbd5e1" fontSize="5">RST</text>
            {qY.map((py, idx) => (
              <text key={py} x="22" y={py + 2} fill="#94a3b8" fontSize="5" textAnchor="end">{`Q${idx}`}</text>
            ))}
          </g>
        );
      }

      // 7. 4-Bit DIP Switch Bank
      case 'builtin_dip_switch_4': {
        const swStates = [
          Boolean(properties.sw1),
          Boolean(properties.sw2),
          Boolean(properties.sw3),
          Boolean(properties.sw4),
        ];
        const swY = [-60, -20, 20, 60];

        return (
          <g>
            {swY.map((py) => (
              <React.Fragment key={py}>
                <line x1="-40" y1={py} x2="-26" y2={py} stroke={leadColor} strokeWidth="2.5" />
                <line x1="26" y1={py} x2="40" y2={py} stroke={leadColor} strokeWidth="2.5" />
              </React.Fragment>
            ))}

            {/* Red DIP Package */}
            <rect x="-26" y="-70" width="52" height="140" rx="4" fill="#dc2626" stroke="#991b1b" strokeWidth="2" />
            <text x="0" y="-62" fill="#fecaca" fontSize="5.5" fontWeight="bold" textAnchor="middle">4-CH DIP</text>

            {/* 4 Interactive Slide Switches */}
            {swY.map((py, idx) => {
              const isOn = swStates[idx];
              return (
                <g
                  key={py}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const key = `sw${idx + 1}`;
                    useCircuitStore.getState().updateComponentProperty(component.id, key, !isOn);
                  }}
                >
                  <rect x="-18" y={py - 10} width="36" height="20" rx="3" fill="#7f1d1d" stroke="#450a0a" strokeWidth="1" />
                  <rect
                    x={isOn ? 0 : -16}
                    y={py - 8}
                    width="16"
                    height="16"
                    rx="2"
                    fill="#f8fafc"
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                    filter="drop-shadow(0 1px 2px rgba(0,0,0,0.5))"
                  />
                  <text x={isOn ? 8 : -8} y={py + 3} fill="#0f172a" fontSize="6.5" fontWeight="bold" textAnchor="middle">
                    {idx + 1}
                  </text>
                  <text x="-21" y={py + 2} fill="#fee2e2" fontSize="4.5" textAnchor="end">{isOn ? 'ON' : 'OFF'}</text>
                </g>
              );
            })}
          </g>
        );
      }

      // 8. Protective Fuse / Resettable Polyfuse
      case 'builtin_fuse': {
        const isBlown = properties.isBlown === true || component.state?.isBlown === true;
        const maxI = typeof properties.maxCurrent === 'number' ? properties.maxCurrent : 0.1;

        return (
          <g>
            <line x1="-40" y1="0" x2="-26" y2="0" stroke={leadColor} strokeWidth="3" strokeLinecap="round" />
            <line x1="26" y1="0" x2="40" y2="0" stroke={leadColor} strokeWidth="3" strokeLinecap="round" />

            {/* Glass Tube Body */}
            <rect x="-24" y="-12" width="48" height="24" rx="4" fill="#0f172a" fillOpacity="0.8" stroke="#94a3b8" strokeWidth="1.5" />
            {/* Metallic End Caps */}
            <rect x="-26" y="-13" width="8" height="26" rx="2" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
            <rect x="18" y="-13" width="8" height="26" rx="2" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />

            {isBlown ? (
              <g>
                <path d="M -18,0 L -6,0 L -2,-4 M 2,4 L 6,0 L 18,0" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="0" cy="0" r="3" fill="#ef4444" opacity="0.8" />
                <text x="0" y="-14" fill="#ef4444" fontSize="6.5" fontWeight="bold" textAnchor="middle">⚡ BLOWN</text>
              </g>
            ) : (
              <g>
                <path d="M -18,0 Q -9,-7 0,0 Q 9,7 18,0" fill="none" stroke="#facc15" strokeWidth="1.8" strokeLinecap="round" />
                <text x="0" y="-14" fill="#94a3b8" fontSize="5.5" textAnchor="middle">{`${(maxI * 1000).toFixed(0)}mA`}</text>
              </g>
            )}
          </g>
        );
      }

      // 9. H-Bridge Dual Motor Driver (L298N)
      case 'builtin_hbridge': {
        const dir = component.state?.direction || 'BRAKE';
        return (
          <g>
            <line x1="-60" y1="-40" x2="-44" y2="-40" stroke={leadColor} strokeWidth="2" />
            <line x1="-60" y1="0" x2="-44" y2="0" stroke={leadColor} strokeWidth="2" />
            <line x1="-60" y1="40" x2="-44" y2="40" stroke={leadColor} strokeWidth="2" />
            <line x1="-20" y1="44" x2="-20" y2="60" stroke="#ef4444" strokeWidth="2" />
            <line x1="20" y1="44" x2="20" y2="60" stroke="#64748b" strokeWidth="2" />
            <line x1="44" y1="-20" x2="60" y2="-20" stroke={leadColor} strokeWidth="2" />
            <line x1="44" y1="20" x2="60" y2="20" stroke={leadColor} strokeWidth="2" />

            <rect x="-44" y="-44" width="88" height="88" rx="6" fill="#991b1b" stroke="#7f1d1d" strokeWidth="2" />
            {/* Multi-fin heatsink */}
            <rect x="-26" y="-32" width="52" height="32" rx="3" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
            {[-18, -10, -2, 6, 14].map((fx) => (
              <line key={fx} x1={fx} y1="-30" x2={fx} y2="-4" stroke="#475569" strokeWidth="1.5" />
            ))}

            <text x="0" y="10" fill="#f8fafc" fontSize="8" fontWeight="bold" textAnchor="middle">L298N</text>
            <text x="0" y="22" fill="#fca5a5" fontSize="6.5" fontWeight="bold" textAnchor="middle">{dir}</text>

            <text x="-38" y="-38" fill="#cbd5e1" fontSize="4.5">ENA</text>
            <text x="-38" y="2" fill="#cbd5e1" fontSize="4.5">IN1</text>
            <text x="-38" y="42" fill="#cbd5e1" fontSize="4.5">IN2</text>
            <text x="38" y="-18" fill="#cbd5e1" fontSize="4.5" textAnchor="end">OUT1</text>
            <text x="38" y="22" fill="#cbd5e1" fontSize="4.5" textAnchor="end">OUT2</text>
          </g>
        );
      }

      // 10A. PNP Bipolar Transistor (2N3906)
      case 'builtin_pnp': {
        return (
          <g>
            <line x1="-40" y1="0" x2="-10" y2="0" stroke={leadColor} strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="-40" x2="0" y2="-24" stroke={leadColor} strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="24" x2="0" y2="40" stroke={leadColor} strokeWidth="2" strokeLinecap="round" />

            <circle cx="0" cy="0" r="26" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1="-10" y1="-16" x2="-10" y2="16" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />

            {/* Emitter line with inward-pointing arrow (PNP) */}
            <line x1="-10" y1="-8" x2="0" y2="-24" stroke="#f8fafc" strokeWidth="2" />
            <polygon points="-7,-11 -4,-18 -11,-15" fill="#f97316" />
            {/* Collector line */}
            <line x1="-10" y1="8" x2="0" y2="24" stroke="#f8fafc" strokeWidth="2" />

            <text x="12" y="4" fill="#94a3b8" fontSize="7" fontWeight="bold">PNP</text>
            <text x="-25" y="-4" fill="#cbd5e1" fontSize="5.5">B</text>
            <text x="4" y="-28" fill="#cbd5e1" fontSize="5.5">E</text>
            <text x="4" y="32" fill="#cbd5e1" fontSize="5.5">C</text>
          </g>
        );
      }

      // 10B. P-Channel MOSFET
      case 'builtin_pmos': {
        return (
          <g>
            <line x1="-40" y1="0" x2="-14" y2="0" stroke={leadColor} strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="-40" x2="0" y2="-22" stroke={leadColor} strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="22" x2="0" y2="40" stroke={leadColor} strokeWidth="2" strokeLinecap="round" />

            <circle cx="0" cy="0" r="26" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.5" />
            {/* Gate plate */}
            <line x1="-14" y1="-16" x2="-14" y2="16" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />
            {/* Channel segments */}
            <line x1="-8" y1="-14" x2="-8" y2="-6" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-8" y1="-3" x2="-8" y2="3" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-8" y1="6" x2="-8" y2="14" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />

            {/* Source and Drain connections */}
            <line x1="-8" y1="-10" x2="0" y2="-10" stroke="#f8fafc" strokeWidth="2" />
            <line x1="0" y1="-10" x2="0" y2="-22" stroke="#f8fafc" strokeWidth="2" />
            <line x1="-8" y1="10" x2="0" y2="10" stroke="#f8fafc" strokeWidth="2" />
            <line x1="0" y1="10" x2="0" y2="22" stroke="#f8fafc" strokeWidth="2" />

            {/* P-Channel outward arrow on center tap */}
            <line x1="-8" y1="0" x2="0" y2="0" stroke="#f8fafc" strokeWidth="1.5" />
            <polygon points="-6,-3 0,0 -6,3" fill="#f97316" />

            <text x="10" y="4" fill="#a78bfa" fontSize="6.5" fontWeight="bold">P-MOS</text>
            <text x="-25" y="-4" fill="#cbd5e1" fontSize="5.5">G</text>
            <text x="4" y="-26" fill="#cbd5e1" fontSize="5.5">S</text>
            <text x="4" y="30" fill="#cbd5e1" fontSize="5.5">D</text>
          </g>
        );
      }

      // 11A. Full-Wave Bridge Rectifier
      case 'builtin_bridge_rectifier': {
        return (
          <g>
            <line x1="-40" y1="-20" x2="-22" y2="-20" stroke={leadColor} strokeWidth="2" />
            <line x1="-40" y1="20" x2="-22" y2="20" stroke={leadColor} strokeWidth="2" />
            <line x1="22" y1="-20" x2="40" y2="-20" stroke="#ef4444" strokeWidth="2" />
            <line x1="22" y1="20" x2="40" y2="20" stroke="#64748b" strokeWidth="2" />

            <polygon points="0,-26 26,0 0,26 -26,0" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" strokeLinejoin="round" />
            <text x="-12" y="-12" fill="#38bdf8" fontSize="10" textAnchor="middle">~</text>
            <text x="-12" y="20" fill="#38bdf8" fontSize="10" textAnchor="middle">~</text>
            <text x="12" y="-12" fill="#ef4444" fontSize="9" fontWeight="bold" textAnchor="middle">+</text>
            <text x="12" y="20" fill="#cbd5e1" fontSize="10" fontWeight="bold" textAnchor="middle">-</text>
          </g>
        );
      }

      // 11B. 5V Linear Regulator (LM7805)
      case 'builtin_reg_7805': {
        const outV = (component.state?.outputVoltage ?? 5.0).toFixed(1);
        return (
          <g>
            <line x1="-40" y1="0" x2="-24" y2="0" stroke={leadColor} strokeWidth="2.5" />
            <line x1="0" y1="20" x2="0" y2="40" stroke="#64748b" strokeWidth="2.5" />
            <line x1="24" y1="0" x2="40" y2="0" stroke="#ef4444" strokeWidth="2.5" />

            {/* Heatsink Tab */}
            <rect x="-24" y="-34" width="48" height="14" rx="2" fill="#64748b" stroke="#475569" strokeWidth="1.5" />
            <circle cx="0" cy="-27" r="4" fill="#1e293b" />
            {/* TO-220 Body */}
            <rect x="-24" y="-20" width="48" height="40" rx="3" fill="#0f172a" stroke="#334155" strokeWidth="2" />

            <text x="0" y="-6" fill="#f8fafc" fontSize="7.5" fontWeight="bold" textAnchor="middle">LM7805</text>
            <text x="0" y="6" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">{outV}V</text>

            <text x="-18" y="14" fill="#cbd5e1" fontSize="5">IN</text>
            <text x="0" y="17" fill="#cbd5e1" fontSize="5" textAnchor="middle">GND</text>
            <text x="18" y="14" fill="#cbd5e1" fontSize="5" textAnchor="end">OUT</text>
          </g>
        );
      }

      // 12. Optocoupler Isolator (PC817)
      case 'builtin_optocoupler': {
        const isCoupled = component.state?.isCoupled === true;
        return (
          <g>
            <line x1="-40" y1="-20" x2="-24" y2="-20" stroke={leadColor} strokeWidth="2" />
            <line x1="-40" y1="20" x2="-24" y2="20" stroke={leadColor} strokeWidth="2" />
            <line x1="24" y1="-20" x2="40" y2="-20" stroke={leadColor} strokeWidth="2" />
            <line x1="24" y1="20" x2="40" y2="20" stroke={leadColor} strokeWidth="2" />

            <rect x="-24" y="-28" width="48" height="56" rx="4" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.5" />
            {/* Input LED triangle */}
            <polygon points="-16,-16 -16,-4 -8,-10" fill={isCoupled ? '#ef4444' : '#64748b'} />
            <line x1="-8" y1="-16" x2="-8" y2="-4" stroke={isCoupled ? '#ef4444' : '#64748b'} strokeWidth="1.5" />
            {/* Optical arrows */}
            <path d="M -4,-8 L 4,-3 M -4,-3 L 4,2" stroke={isCoupled ? '#eab308' : '#475569'} strokeWidth="1.5" strokeLinecap="round" />
            {/* Output Phototransistor */}
            <line x1="12" y1="-16" x2="12" y2="16" stroke="#cbd5e1" strokeWidth="2" />
            <line x1="12" y1="-10" x2="20" y2="-18" stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1="12" y1="10" x2="20" y2="18" stroke="#cbd5e1" strokeWidth="1.5" />

            <text x="0" y="22" fill="#94a3b8" fontSize="5.5" fontWeight="bold" textAnchor="middle">PC817</text>
          </g>
        );
      }

      // 13. Solar Panel Photovoltaic Cell
      case 'builtin_solar_panel': {
        const lux = typeof properties.lux === 'number' ? properties.lux : 100;
        const maxV = typeof properties.maxVoltage === 'number' ? properties.maxVoltage : 6.0;
        const vGen = (component.state?.outputVoltage ?? Math.min(maxV, 0.5 + (lux / 1000) * (maxV - 0.5))).toFixed(1);

        return (
          <g>
            <line x1="32" y1="-20" x2="40" y2="-20" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="32" y1="20" x2="40" y2="20" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />

            {/* Monocrystalline Solar Cell Grid */}
            <rect x="-34" y="-34" width="66" height="68" rx="4" fill="#082f49" stroke="#0284c7" strokeWidth="2" />
            {[-18, -2, 14].map((lx) => (
              <line key={lx} x1={lx} y1="-32" x2={lx} y2="32" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.4" />
            ))}
            {[-18, -2, 14].map((ly) => (
              <line key={ly} x1="-32" y1={ly} x2="30" y2={ly} stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.4" />
            ))}

            {/* Sun Icon and Generated Voltage Badge */}
            <circle cx="-16" cy="-16" r="6" fill="#eab308" />
            <rect x="-10" y="4" width="36" height="18" rx="3" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.2" />
            <text x="8" y="16" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              {vGen}V
            </text>
            <text x="-8" y="-12" fill="#facc15" fontSize="5.5" fontWeight="bold">☀️ {lux} lx</text>

            <text x="28" y="-16" fill="#ef4444" fontSize="7" fontWeight="bold">+</text>
            <text x="28" y="24" fill="#cbd5e1" fontSize="8" fontWeight="bold">-</text>
          </g>
        );
      }

      // 14. 2-Axis Analog Joystick Module (KY-023)
      case 'builtin_joystick': {
        const jx = Math.max(-100, Math.min(100, typeof properties.joyX === 'number' ? properties.joyX : 0));
        const jy = Math.max(-100, Math.min(100, typeof properties.joyY === 'number' ? properties.joyY : 0));
        const isPressed = properties.isPressed === true;
        const capX = (jx / 100) * 16;
        const capY = -10 + (jy / 100) * 16;

        return (
          <g>
            {[-40, -20, 0, 20, 40].map((px) => (
              <line key={px} x1={px} y1="46" x2={px} y2="60" stroke={px === -20 ? '#ef4444' : px === -40 ? '#64748b' : leadColor} strokeWidth="2" />
            ))}

            <rect x="-46" y="-52" width="92" height="98" rx="8" fill="#1e293b" stroke="#334155" strokeWidth="2" />
            {/* Gimbal Outer Ring */}
            <circle cx="0" cy="-10" r="32" fill="#0f172a" stroke="#475569" strokeWidth="2" />
            <circle cx="0" cy="-10" r="22" fill="#1e293b" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />

            {/* Draggable / Interactive 2D Thumbstick Cap */}
            <g
              style={{ cursor: 'grab' }}
              onClick={(e) => {
                e.stopPropagation();
                useCircuitStore.getState().updateComponentProperty(component.id, 'isPressed', !isPressed);
              }}
            >
              <circle
                cx={capX}
                cy={capY}
                r="16"
                fill={isPressed ? '#22c55e' : '#334155'}
                stroke={isPressed ? '#86efac' : '#94a3b8'}
                strokeWidth="2"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.6))"
              />
              <circle cx={capX} cy={capY} r="7" fill={isPressed ? '#15803d' : '#1e293b'} />
            </g>

            {/* Bottom Pin Labels */}
            <text x="-40" y="42" fill="#cbd5e1" fontSize="4.5" textAnchor="middle">GND</text>
            <text x="-20" y="42" fill="#fca5a5" fontSize="4.5" textAnchor="middle">VCC</text>
            <text x="0" y="42" fill="#38bdf8" fontSize="4.5" textAnchor="middle">VRX</text>
            <text x="20" y="42" fill="#38bdf8" fontSize="4.5" textAnchor="middle">VRY</text>
            <text x="40" y="42" fill="#cbd5e1" fontSize="4.5" textAnchor="middle">SW</text>
          </g>
        );
      }

      // 15. 10-Segment LED Bar Graph
      case 'builtin_led_bar_graph': {
        const count = typeof component.state?.litCount === 'number' ? component.state.litCount : (typeof properties.litCount === 'number' ? properties.litCount : 0);
        const barPinsY = [-60, -40, -20, 0, 20, 40, 60];

        return (
          <g>
            {barPinsY.map((py) => (
              <line key={py} x1="-40" y1={py} x2="-26" y2={py} stroke={leadColor} strokeWidth="2" />
            ))}
            {[-60, -40, -20, 20, 60].map((py) => (
              <line key={py} x1="26" y1={py} x2="40" y2={py} stroke={leadColor} strokeWidth="2" />
            ))}

            <rect x="-26" y="-72" width="52" height="144" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="2" />

            {/* 10 Stacked LED Segments: Bottom 4 Green, Mid 3 Yellow, Top 3 Red */}
            {Array.from({ length: 10 }).map((_, idx) => {
              const segIdx = 9 - idx; // 0 is bottom, 9 is top
              const isLit = segIdx < count;
              const color = segIdx < 4 ? '#22c55e' : segIdx < 7 ? '#eab308' : '#ef4444';
              const y = -64 + idx * 13;

              return (
                <rect
                  key={idx}
                  x="-18"
                  y={y}
                  width="36"
                  height="9"
                  rx="1.5"
                  fill={isLit ? color : '#1e293b'}
                  stroke={isLit ? '#ffffff' : '#334155'}
                  strokeWidth="0.8"
                  filter={isLit ? `drop-shadow(0 0 3px ${color})` : undefined}
                />
              );
            })}
          </g>
        );
      }

      // 16. Bipolar Stepper Motor (NEMA-17)
      case 'builtin_stepper_motor': {
        const angle = typeof component.state?.angle === 'number' ? component.state.angle : (typeof properties.angle === 'number' ? properties.angle : 0);
        return (
          <g>
            <line x1="-40" y1="-20" x2="-26" y2="-20" stroke={leadColor} strokeWidth="2" />
            <line x1="-40" y1="20" x2="-26" y2="20" stroke={leadColor} strokeWidth="2" />
            <line x1="26" y1="-20" x2="40" y2="-20" stroke={leadColor} strokeWidth="2" />
            <line x1="26" y1="20" x2="40" y2="20" stroke={leadColor} strokeWidth="2" />

            {/* NEMA-17 Square Faceplate */}
            <rect x="-28" y="-28" width="56" height="56" rx="5" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            {[-22, 22].map((bx) =>
              [-22, 22].map((by) => (
                <circle key={`${bx}_${by}`} cx={bx} cy={by} r="2.5" fill="#0f172a" stroke="#64748b" strokeWidth="1" />
              ))
            )}

            {/* Center Rotor Circle */}
            <circle cx="0" cy="0" r="18" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" />
            {/* Toothed Rotor Pointer */}
            <g transform={`rotate(${angle} 0 0)`}>
              <line x1="0" y1="0" x2="0" y2="-14" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
              <polygon points="-4,-11 0,-17 4,-11" fill="#38bdf8" />
              <circle cx="0" cy="0" r="5" fill="#38bdf8" />
            </g>

            <text x="0" y="24" fill="#94a3b8" fontSize="6.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              {Math.round(angle)}°
            </text>
            <text x="-24" y="-18" fill="#cbd5e1" fontSize="5">A+</text>
            <text x="-24" y="22" fill="#cbd5e1" fontSize="5">A-</text>
            <text x="24" y="-18" fill="#cbd5e1" fontSize="5" textAnchor="end">B+</text>
            <text x="24" y="22" fill="#cbd5e1" fontSize="5" textAnchor="end">B-</text>
          </g>
        );
      }

      // =====================================================================
      // PHASE 7.9 EXPANSION: 10 NEW COMPONENT FAMILIES (11 REGISTRY IDS)
      // =====================================================================

      // 17. Soil Moisture Sensor (builtin_soil_moisture) — 80x120
      case 'builtin_soil_moisture': {
        const moisture = typeof properties.moisture === 'number' ? properties.moisture : 20;
        const threshold = typeof properties.threshold === 'number' ? properties.threshold : 50;
        const triggerOnDry = properties.triggerOnDry === true;
        const isTrig =
          component.state?.logicOutput === 1 ||
          (triggerOnDry ? moisture < threshold : moisture >= threshold);

        return (
          <g>
            {/* Top 20px-Grid Pins: VCC (-20, -60), OUT (0, -60), GND (20, -60) */}
            <line x1="-20" y1="-60" x2="-20" y2="-44" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="0" y1="-60" x2="0" y2="-44" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="20" y1="-60" x2="20" y2="-44" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />

            {/* Top Control PCB Header */}
            <rect x="-30" y="-44" width="60" height="36" rx="4" fill="#0f172a" stroke="#0284c7" strokeWidth="2" />
            <text x="-20" y="-35" fill="#fca5a5" fontSize="4.5" fontWeight="bold" textAnchor="middle">VCC</text>
            <text x="0" y="-35" fill="#38bdf8" fontSize="4.5" fontWeight="bold" textAnchor="middle">OUT</text>
            <text x="20" y="-35" fill="#94a3b8" fontSize="4.5" fontWeight="bold" textAnchor="middle">GND</text>

            {/* Moisture Readout & Status LED */}
            <circle
              cx="-20"
              cy="-20"
              r="3.5"
              fill={isTrig ? '#22c55e' : '#1e293b'}
              stroke="#475569"
              strokeWidth="1"
              filter={isTrig ? 'drop-shadow(0 0 4px #22c55e)' : undefined}
            />
            <text x="4" y="-22" fill="#38bdf8" fontSize="7.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              💧{moisture}%
            </text>
            <text x="0" y="-12" fill="#94a3b8" fontSize="5" fontWeight="bold" textAnchor="middle">
              {triggerOnDry ? 'MODE: DRY' : 'MODE: WET'}
            </text>

            {/* Bifurcated Gold-Plated Fork Prongs */}
            <path
              d="M -24,-8 L -10,-8 L -10,46 L -17,56 L -24,46 Z"
              fill="#eab308"
              stroke="#ca8a04"
              strokeWidth="1.5"
            />
            <path
              d="M 10,-8 L 24,-8 L 24,46 L 17,56 L 10,46 Z"
              fill="#eab308"
              stroke="#ca8a04"
              strokeWidth="1.5"
            />
            {/* Conductive Trace Ribs on Prongs */}
            {[-2, 8, 18, 28, 38].map((py) => (
              <g key={py}>
                <line x1="-21" y1={py} x2="-13" y2={py} stroke="#fef08a" strokeWidth="1" />
                <line x1="13" y1={py} x2="21" y2={py} stroke="#fef08a" strokeWidth="1" />
              </g>
            ))}

            {/* Animated Water Droplets when Wet */}
            {moisture >= 35 && (
              <g>
                <circle cx="0" cy="10" r="3" fill="#38bdf8" opacity="0.85" />
                <circle cx="-4" cy="26" r="2.5" fill="#0ea5e9" opacity="0.85" />
                <circle cx="4" cy="38" r="3" fill="#38bdf8" opacity="0.85" />
              </g>
            )}
          </g>
        );
      }

      // 18. Traffic Light LED Module (builtin_traffic_light) — 80x120
      case 'builtin_traffic_light': {
        const rLit = component.state?.redLit === true;
        const yLit = component.state?.yellowLit === true;
        const gLit = component.state?.greenLit === true;

        return (
          <g>
            {/* Left 20px-Grid Pins: R (-40, -40), Y (-40, -20), G (-40, 20), GND (-40, 40) */}
            <line x1="-40" y1="-40" x2="-24" y2="-40" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-40" y1="-20" x2="-24" y2="-20" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-40" y1="20" x2="-24" y2="20" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-40" y1="40" x2="-24" y2="40" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />

            {/* Matte-Black Vertical Signal Housing */}
            <rect x="-24" y="-54" width="52" height="108" rx="10" fill="#0f172a" stroke="#475569" strokeWidth="2.5" />
            <rect x="-20" y="-50" width="44" height="100" rx="8" fill="#1e293b" stroke="#334155" strokeWidth="1" />

            {/* Pin Labels */}
            <text x="-17" y="-38" fill="#fca5a5" fontSize="5.5" fontWeight="bold">R</text>
            <text x="-17" y="-18" fill="#fde047" fontSize="5.5" fontWeight="bold">Y</text>
            <text x="-17" y="22" fill="#86efac" fontSize="5.5" fontWeight="bold">G</text>
            <text x="-17" y="42" fill="#94a3b8" fontSize="4.5" fontWeight="bold">GND</text>

            {/* Red Lamp (Top) */}
            <circle
              cx="4"
              cy="-34"
              r="13"
              fill={rLit ? '#ef4444' : '#450a0a'}
              stroke={rLit ? '#fca5a5' : '#334155'}
              strokeWidth="2"
              filter={rLit ? 'drop-shadow(0 0 10px #ef4444)' : undefined}
            />
            {rLit && <circle cx="0" cy="-38" r="4" fill="#fecaca" opacity="0.7" />}

            {/* Yellow Lamp (Middle) */}
            <circle
              cx="4"
              cy="0"
              r="13"
              fill={yLit ? '#eab308' : '#422006'}
              stroke={yLit ? '#fef08a' : '#334155'}
              strokeWidth="2"
              filter={yLit ? 'drop-shadow(0 0 10px #eab308)' : undefined}
            />
            {yLit && <circle cx="0" cy="-4" r="4" fill="#fef9c3" opacity="0.7" />}

            {/* Green Lamp (Bottom) */}
            <circle
              cx="4"
              cy="34"
              r="13"
              fill={gLit ? '#22c55e' : '#052e16'}
              stroke={gLit ? '#86efac' : '#334155'}
              strokeWidth="2"
              filter={gLit ? 'drop-shadow(0 0 10px #22c55e)' : undefined}
            />
            {gLit && <circle cx="0" cy="30" r="4" fill="#bbf7d0" opacity="0.7" />}
          </g>
        );
      }

      // 19. Submersible DC Water Pump (builtin_water_pump) — 80x80
      case 'builtin_water_pump': {
        const isRunning = component.state?.isRunning === true || (component.state?.flowRateLpm ?? 0) > 0;
        const flowRate = component.state?.flowRateLpm ?? 0;

        return (
          <g>
            {/* Left 20px-Grid Pins: P+ (-40, -20), P- (-40, 20) */}
            <line x1="-40" y1="-20" x2="-24" y2="-20" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-40" y1="20" x2="-24" y2="20" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />

            {/* Discharge Pipe Nozzle (Top Right) */}
            <rect x="6" y="-34" width="14" height="20" rx="2" fill="#0369a1" stroke="#38bdf8" strokeWidth="1.5" />
            {isRunning && (
              <g>
                <path
                  d="M 10,-35 Q 10,-44 6,-48 M 13,-35 Q 13,-45 13,-50 M 16,-35 Q 16,-44 20,-48"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle cx="8" cy="-44" r="2" fill="#7dd3fc" />
                <circle cx="18" cy="-43" r="2" fill="#7dd3fc" />
              </g>
            )}

            {/* Centrifugal Pump Volute Body */}
            <circle cx="0" cy="4" r="26" fill="#0c4a6e" stroke="#0284c7" strokeWidth="2.5" />
            <circle cx="0" cy="4" r="17" fill="#082f49" stroke="#38bdf8" strokeWidth="1.5" />

            {/* Spinning Impeller Blades */}
            <g
              className={isRunning ? 'fan-blades-spinning' : ''}
              style={{ transformOrigin: '0px 4px' }}
            >
              {[0, 60, 120, 180, 240, 300].map((deg) => (
                <line
                  key={deg}
                  x1="0"
                  y1="4"
                  x2={Math.cos((deg * Math.PI) / 180) * 14}
                  y2={4 + Math.sin((deg * Math.PI) / 180) * 14}
                  stroke={isRunning ? '#38bdf8' : '#64748b'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              ))}
              <circle cx="0" cy="4" r="4.5" fill="#0284c7" stroke="#bae6fd" strokeWidth="1" />
            </g>

            {/* Terminal Polarity & Live Flow Badge */}
            <text x="-28" y="-13" fill="#ef4444" fontSize="7" fontWeight="bold">+</text>
            <text x="-28" y="27" fill="#94a3b8" fontSize="8" fontWeight="bold">-</text>
            <text x="0" y="26" fill="#bae6fd" fontSize="5.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              {isRunning ? `${flowRate.toFixed(1)} L/m` : 'PUMP'}
            </text>
          </g>
        );
      }

      // 20. Incandescent Filament Bulb (builtin_filament_bulb) — 80x80
      case 'builtin_filament_bulb': {
        const rawB = component.state?.brightness ?? 0;
        const normB = rawB > 1 ? rawB / 100 : rawB;
        const isLit = (component.state?.lit === true || normB > 0.05) && !component.state?.isBurned;
        const isBurned = Boolean(component.state?.isBurned || component.state?.isOverloaded);

        return (
          <g>
            {/* Bottom 20px-Grid Pins: P1 (-20, 40), P2 (20, 40) */}
            <line x1="-20" y1="24" x2="-20" y2="40" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="20" y1="24" x2="20" y2="40" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-20" y1="24" x2="-10" y2="20" stroke={leadColor} strokeWidth="2" />
            <line x1="20" y1="24" x2="10" y2="20" stroke={leadColor} strokeWidth="2" />

            {/* Warm Radial Incandescent Halo when Lit */}
            {isLit && (
              <circle
                cx="0"
                cy="-10"
                r={26 + normB * 10}
                fill="#fde047"
                opacity={Math.min(0.65, 0.2 + normB * 0.45)}
                filter="drop-shadow(0 0 14px #facc15)"
              />
            )}

            {/* Threaded Metallic Edison Screw Base */}
            <rect x="-14" y="10" width="28" height="14" rx="3" fill="#64748b" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="-13" y1="14" x2="13" y2="14" stroke="#334155" strokeWidth="1.2" />
            <line x1="-13" y1="18" x2="13" y2="18" stroke="#334155" strokeWidth="1.2" />
            <path d="M -8,24 L 8,24 L 5,28 L -5,28 Z" fill="#1e293b" />

            {/* Glass Globe */}
            <circle
              cx="0"
              cy="-10"
              r="23"
              fill={isLit ? `rgba(254, 240, 138, ${0.25 + normB * 0.5})` : 'rgba(148, 163, 184, 0.12)'}
              stroke={isLit ? '#facc15' : '#94a3b8'}
              strokeWidth="2"
            />

            {/* Internal Support Posts & Coiled Tungsten Filament */}
            <line x1="-7" y1="10" x2="-7" y2="-6" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="7" y1="10" x2="7" y2="-6" stroke="#94a3b8" strokeWidth="1.5" />
            {isBurned ? (
              /* Snapped Filament when Overloaded */
              <path
                d="M -7,-6 L -4,-14 L -2,-10 M 2,-10 L 4,-14 L 7,-6"
                fill="none"
                stroke="#ef4444"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M -7,-6 L -5,-14 L -2,-8 L 0,-15 L 2,-8 L 5,-14 L 7,-6"
                fill="none"
                stroke={isLit ? '#fef08a' : '#cbd5e1'}
                strokeWidth={isLit ? '2.4' : '1.5'}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={isLit ? 'drop-shadow(0 0 6px #facc15)' : undefined}
              />
            )}
          </g>
        );
      }

      // 21. Wireless RF Radio + Antenna (builtin_rf_radio) — 80x80
      case 'builtin_rf_radio': {
        const isTx = component.state?.isTransmitting === true;
        const isRx = component.state?.isReceiving === true;
        const chRaw = String(properties.rfChannel || 'CH 1 (433.0 MHz)');
        const chShort = chRaw.split(' ')[0] + ' ' + (chRaw.split(' ')[1] || '1');

        return (
          <g>
            {/* 20px-Grid Leads: VCC (-40, -20), GND (-40, 20), TX (40, -20), RX (40, 20) */}
            <line x1="-40" y1="-20" x2="-28" y2="-20" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-40" y1="20" x2="-28" y2="20" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="28" y1="-20" x2="40" y2="-20" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="28" y1="20" x2="40" y2="20" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />

            {/* Helical Whip Antenna & Animated RF Waves */}
            <line x1="0" y1="-24" x2="0" y2="-38" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="0" cy="-38" r="2.5" fill="#facc15" />
            {(isTx || isRx) && (
              <g stroke={isTx ? '#38bdf8' : '#22c55e'} strokeWidth="1.5" fill="none">
                <path d="M -6,-34 A 7,7 0 0,1 -6,-42" className="buzzer-wave-1" />
                <path d="M 6,-34 A 7,7 0 0,0 6,-42" className="buzzer-wave-1" />
                <path d="M -11,-31 A 12,12 0 0,1 -11,-45" className="buzzer-wave-2" />
                <path d="M 11,-31 A 12,12 0 0,0 11,-45" className="buzzer-wave-2" />
              </g>
            )}

            {/* RF Transceiver PCB */}
            <rect x="-28" y="-24" width="56" height="52" rx="5" fill="#064e3b" stroke="#10b981" strokeWidth="2" />
            {/* Silver RF Shield Can */}
            <rect x="-18" y="-14" width="36" height="22" rx="2" fill="#334155" stroke="#94a3b8" strokeWidth="1.2" />
            <text x="0" y="-1" fill="#f8fafc" fontSize="6" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              RF {chShort}
            </text>

            {/* TX / RX Status LEDs */}
            <circle cx="-10" cy="16" r="3" fill={isTx ? '#38bdf8' : '#1e293b'} stroke="#475569" strokeWidth="0.8" />
            <circle cx="10" cy="16" r="3" fill={isRx ? '#22c55e' : '#1e293b'} stroke="#475569" strokeWidth="0.8" />

            {/* Pin Labels */}
            <text x="-25" y="-17" fill="#fca5a5" fontSize="4.5" fontWeight="bold">VCC</text>
            <text x="-25" y="22" fill="#cbd5e1" fontSize="4.5" fontWeight="bold">GND</text>
            <text x="25" y="-17" fill="#7dd3fc" fontSize="4.5" fontWeight="bold" textAnchor="end">TX</text>
            <text x="25" y="22" fill="#86efac" fontSize="4.5" fontWeight="bold" textAnchor="end">RX</text>
          </g>
        );
      }

      // 22A. Infrared (IR) Transmitter LED (builtin_ir_tx) — 80x80
      case 'builtin_ir_tx': {
        const isEmitting = component.state?.isEmitting === true || component.state?.lit === true;

        return (
          <g>
            {/* Horizontal 20px-Grid Pins: Anode (-40, 0), Cathode (40, 0) */}
            <line x1="-40" y1="0" x2="-15" y2="0" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="15" y1="0" x2="40" y2="0" stroke={leadColor} strokeWidth="2.5" strokeLinecap="round" />

            {isEmitting && (
              <circle
                cx="0"
                cy="0"
                r="22"
                fill="#d946ef"
                opacity="0.35"
                filter="drop-shadow(0 0 10px #d946ef)"
              />
            )}

            {/* Violet-Tinted IR LED Package */}
            <circle
              cx="0"
              cy="0"
              r="14"
              fill={isEmitting ? '#a855f7' : '#3b0764'}
              stroke={isEmitting ? '#f0abfc' : '#7e22ce'}
              strokeWidth="2"
            />
            <polygon points="-5,-6 -5,6 6,0" fill="#f5d0fe" />
            <line x1="6" y1="-6" x2="6" y2="6" stroke="#f5d0fe" strokeWidth="2" />

            {/* Animated Infrared Beam Rays */}
            {isEmitting && (
              <g stroke="#e879f9" strokeWidth="1.8" strokeLinecap="round">
                <line x1="-6" y1="-16" x2="-10" y2="-26" />
                <line x1="0" y1="-18" x2="0" y2="-28" />
                <line x1="6" y1="-16" x2="10" y2="-26" />
              </g>
            )}

            <text x="-24" y="-6" fill="#ef4444" fontSize="6.5" fontWeight="bold">+</text>
            <text x="22" y="-6" fill="#94a3b8" fontSize="6.5" fontWeight="bold">-</text>
            <text x="0" y="25" fill="#e879f9" fontSize="6" fontWeight="bold" textAnchor="middle">IR TX</text>
          </g>
        );
      }

      // 22B. Infrared (IR) Receiver Module TSOP38238 (builtin_ir_rx) — 80x80
      case 'builtin_ir_rx': {
        const isRx =
          component.state?.isReceivingIr === true ||
          component.state?.logicOutput === 1 ||
          properties.irDetected === true;

        return (
          <g>
            {/* Bottom 20px-Grid Pins: VCC (-20, 40), GND (0, 40), OUT (20, 40) */}
            <line x1="-20" y1="24" x2="-20" y2="40" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="0" y1="24" x2="0" y2="40" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="20" y1="24" x2="20" y2="40" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />

            {/* TSOP38238 Shielded Housing */}
            <rect x="-26" y="-28" width="52" height="52" rx="5" fill="#1e1b4b" stroke="#6366f1" strokeWidth="2" />
            {/* Dark IR Optical Filter Window */}
            <circle
              cx="0"
              cy="-6"
              r="13"
              fill={isRx ? '#701a75' : '#0f172a'}
              stroke={isRx ? '#f0abfc' : '#818cf8'}
              strokeWidth="1.8"
              filter={isRx ? 'drop-shadow(0 0 8px #d946ef)' : undefined}
            />
            {/* Metallic Shield Crosshair */}
            <line x1="-9" y1="-15" x2="9" y2="3" stroke="#64748b" strokeWidth="1" />
            <line x1="9" y1="-15" x2="-9" y2="3" stroke="#64748b" strokeWidth="1" />

            <text x="0" y="-20" fill="#c7d2fe" fontSize="5.5" fontWeight="bold" textAnchor="middle">
              {isRx ? '📡 IR DETECTED' : 'IR RX 38kHz'}
            </text>
            <text x="-20" y="19" fill="#fca5a5" fontSize="4.5" fontWeight="bold" textAnchor="middle">VCC</text>
            <text x="0" y="19" fill="#94a3b8" fontSize="4.5" fontWeight="bold" textAnchor="middle">GND</text>
            <text x="20" y="19" fill="#38bdf8" fontSize="4.5" fontWeight="bold" textAnchor="middle">OUT</text>
          </g>
        );
      }

      // 23. Hall-Effect Magnetic Sensor A3144 (builtin_hall_sensor) — 80x80
      case 'builtin_hall_sensor': {
        const mag = typeof properties.magneticField === 'number' ? properties.magneticField : 0;
        const threshold = typeof properties.threshold === 'number' ? properties.threshold : 30;
        const isTrig = component.state?.logicOutput === 1 || mag >= threshold;

        return (
          <g>
            {/* Bottom 20px-Grid Pins: VCC (-20, 40), GND (0, 40), OUT (20, 40) */}
            <line x1="-20" y1="24" x2="-20" y2="40" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="0" y1="24" x2="0" y2="40" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="20" y1="24" x2="20" y2="40" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />

            <rect x="-26" y="-28" width="52" height="52" rx="5" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />

            {/* TO-92 A3144 Hall Element */}
            <rect
              x="-14"
              y="-20"
              width="28"
              height="18"
              rx="3"
              fill={isTrig ? '#1e3a8a' : '#1e293b'}
              stroke={isTrig ? '#38bdf8' : '#64748b'}
              strokeWidth="1.5"
              filter={isTrig ? 'drop-shadow(0 0 6px #38bdf8)' : undefined}
            />
            <text x="0" y="-9" fill="#f8fafc" fontSize="6" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              🧲 {mag}mT
            </text>

            {/* Status LED */}
            <circle
              cx="0"
              cy="6"
              r="3.5"
              fill={isTrig ? '#22c55e' : '#334155'}
              filter={isTrig ? 'drop-shadow(0 0 4px #22c55e)' : undefined}
            />

            <text x="-20" y="19" fill="#fca5a5" fontSize="4.5" fontWeight="bold" textAnchor="middle">VCC</text>
            <text x="0" y="19" fill="#94a3b8" fontSize="4.5" fontWeight="bold" textAnchor="middle">GND</text>
            <text x="20" y="19" fill="#38bdf8" fontSize="4.5" fontWeight="bold" textAnchor="middle">OUT</text>
          </g>
        );
      }

      // 24. Vibration / Knock Sensor SW-420 (builtin_vibration_sensor) — 80x80
      case 'builtin_vibration_sensor': {
        const isVib =
          properties.vibrationDetected === true ||
          component.state?.vibrationDetected === true ||
          component.state?.logicOutput === 1;

        const triggerTapPulse = (e: React.MouseEvent) => {
          e.stopPropagation();
          useCircuitStore.getState().updateComponentProperty(component.id, 'vibrationDetected', true);
          setTimeout(() => {
            useCircuitStore.getState().updateComponentProperty(component.id, 'vibrationDetected', false);
          }, 1000);
        };

        return (
          <g>
            {/* Bottom 20px-Grid Pins: VCC (-20, 40), GND (0, 40), OUT (20, 40) */}
            <line x1="-20" y1="24" x2="-20" y2="40" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="0" y1="24" x2="0" y2="40" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="20" y1="24" x2="20" y2="40" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />

            <rect x="-28" y="-28" width="56" height="52" rx="5" fill="#172554" stroke="#3b82f6" strokeWidth="2" />

            {/* Blue SW-420 Spring-Tube Cartridge */}
            <rect
              x="-22"
              y="-22"
              width="20"
              height="30"
              rx="6"
              fill={isVib ? '#2563eb' : '#1e3a8a'}
              stroke={isVib ? '#93c5fd' : '#60a5fa'}
              strokeWidth="1.5"
              transform={isVib ? 'translate(1.5, -1)' : undefined}
            />
            {/* Internal Gold Vibration Spring */}
            <path
              d="M -12,-18 L -16,-14 L -8,-10 L -16,-6 L -8,-2 L -12,4"
              fill="none"
              stroke="#facc15"
              strokeWidth="1.5"
              strokeLinecap="round"
            />

            {/* Direct Interactive [TAP] Button on Module */}
            <g style={{ cursor: 'pointer' }} onClick={triggerTapPulse}>
              <rect
                x="2"
                y="-18"
                width="22"
                height="22"
                rx="4"
                fill={isVib ? '#f59e0b' : '#1e293b'}
                stroke={isVib ? '#fef08a' : '#60a5fa'}
                strokeWidth="1.2"
              />
              <text x="13" y="-8" fill="#ffffff" fontSize="6.5" fontWeight="bold" textAnchor="middle">🔨</text>
              <text x="13" y="0" fill="#bae6fd" fontSize="5" fontWeight="bold" textAnchor="middle">TAP</text>
            </g>

            <text x="-20" y="19" fill="#fca5a5" fontSize="4.5" fontWeight="bold" textAnchor="middle">VCC</text>
            <text x="0" y="19" fill="#94a3b8" fontSize="4.5" fontWeight="bold" textAnchor="middle">GND</text>
            <text x="20" y="19" fill="#38bdf8" fontSize="4.5" fontWeight="bold" textAnchor="middle">OUT</text>
          </g>
        );
      }

      // 25. Linear Push-Pull Solenoid Actuator (builtin_solenoid) — 80x80
      case 'builtin_solenoid': {
        const isEngaged = component.state?.isEngaged === true;

        return (
          <g>
            {/* Left 20px-Grid Pins: S+ (-40, -20), S- (-40, 20) */}
            <line x1="-40" y1="-20" x2="-26" y2="-20" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-40" y1="20" x2="-26" y2="20" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />

            {/* Moving Chrome Plunger & Return Spring (extends +12px right when energized) */}
            <g
              style={{
                transform: `translateX(${isEngaged ? 12 : 0}px)`,
                transition: 'transform 0.14s ease-out',
              }}
            >
              {/* Plunger Rod */}
              <rect x="8" y="-7" width="20" height="14" rx="2" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
              {/* Plunger Tip */}
              <rect x="24" y="-10" width="6" height="20" rx="2" fill={isEngaged ? '#22c55e' : '#94a3b8'} stroke="#475569" strokeWidth="1.2" />
              {/* Return Spring Coils */}
              <path d="M 12,-9 L 15,9 M 17,-9 L 20,9 M 22,-9 L 24,9" stroke="#64748b" strokeWidth="1.2" />
            </g>

            {/* Open-Frame Steel Solenoid Body */}
            <rect x="-26" y="-24" width="40" height="48" rx="4" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
            {/* Internal Copper Electromagnetic Coil Windings */}
            <rect
              x="-20"
              y="-18"
              width="28"
              height="36"
              rx="2"
              fill={isEngaged ? '#d97706' : '#92400e'}
              stroke="#f59e0b"
              strokeWidth="1.2"
            />
            {[-12, -4, 4, 12].map((cy) => (
              <line key={cy} x1="-19" y1={cy} x2="7" y2={cy} stroke="#fde68a" strokeWidth="0.9" strokeOpacity="0.6" />
            ))}

            <text x="-6" y="2" fill="#ffffff" fontSize="5.5" fontWeight="bold" textAnchor="middle">
              {isEngaged ? 'PUSH ➡️' : 'COIL'}
            </text>
            <text x="-32" y="-13" fill="#ef4444" fontSize="7" fontWeight="bold">+</text>
            <text x="-32" y="27" fill="#94a3b8" fontSize="8" fontWeight="bold">-</text>
          </g>
        );
      }

      // 26. 8Ω Dynamic Audio Speaker (builtin_speaker) — 80x80
      case 'builtin_speaker': {
        const isSounding = component.state?.isSounding === true;

        return (
          <g>
            {/* Bottom 20px-Grid Pins: SP+ (-20, 40), SP- (20, 40) */}
            <line x1="-20" y1="22" x2="-20" y2="40" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="20" y1="22" x2="20" y2="40" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />

            {/* Circular Speaker Frame & Ribbed Acoustic Cone */}
            <circle cx="0" cy="-4" r="28" fill="#0f172a" stroke="#475569" strokeWidth="2.5" />
            <circle
              cx="0"
              cy="-4"
              r="21"
              fill="#1e293b"
              stroke={isSounding ? '#38bdf8' : '#334155'}
              strokeWidth="1.5"
              className={isSounding ? 'buzzer-wave-1' : undefined}
            />
            <circle
              cx="0"
              cy="-4"
              r="14"
              fill="#0f172a"
              stroke={isSounding ? '#7dd3fc' : '#475569'}
              strokeWidth="1.2"
            />
            {/* Center Dust Cap */}
            <circle cx="0" cy="-4" r="7" fill={isSounding ? '#0284c7' : '#334155'} stroke="#94a3b8" strokeWidth="1" />

            {/* Radiating Acoustic Waves when Active */}
            {isSounding && (
              <g stroke="#38bdf8" strokeWidth="1.8" fill="none">
                <circle cx="0" cy="-4" r="32" strokeOpacity="0.7" className="buzzer-wave-1" />
                <circle cx="0" cy="-4" r="36" strokeOpacity="0.4" className="buzzer-wave-2" />
              </g>
            )}

            <text x="0" y="-2" fill="#f8fafc" fontSize="5.5" fontWeight="bold" textAnchor="middle">8Ω</text>
            <text x="-26" y="34" fill="#ef4444" fontSize="6.5" fontWeight="bold">+</text>
            <text x="24" y="34" fill="#94a3b8" fontSize="7" fontWeight="bold">-</text>
          </g>
        );
      }

      default: {
        return (
          <g>
            <rect
              x="4"
              y="4"
              width={definition.width - 8}
              height={definition.height - 8}
              rx="4"
              fill={isDark ? '#1e293b' : '#f8fafc'}
              stroke={bodyStroke}
              strokeWidth="2"
            />
          </g>
        );
      }
    }
  };

  const isOverloaded = component.state?.isOverloaded || component.state?.isBurned;
  const isCentered =
    definition.origin === 'center' ||
    component.type === 'arduino-uno' ||
    component.type === 'esp32' ||
    component.type === 'pico';

  const cx = definition.width / 2;
  const cy = definition.height / 2;

  const padding = 4;
  const selX = isCentered ? -(definition.width / 2) - padding : -padding;
  const selY = isCentered ? -(definition.height / 2) - padding : -padding;
  const selW = definition.width + padding * 2;
  const selH = definition.height + padding * 2;

  const flameCx = isCentered ? 0 : cx;
  const flameCy = isCentered ? 0 : cy;

  return (
    <g>
      {/* Selection Glow Indicator */}
      {isSelected && (
        <rect
          x={selX}
          y={selY}
          width={selW}
          height={selH}
          rx="6"
          fill="none"
          stroke={accentColor}
          strokeWidth="2.5"
          strokeDasharray="4 2"
          filter="drop-shadow(0 0 6px #38bdf8)"
        />
      )}

      {/* Component Visual Graphic */}
      {renderVisual()}

      {/* Overload Charred Tint, Fire & Smoke Effects */}
      {isOverloaded && (
        <g className="pointer-events-none select-none">
          {/* Charred / Burned Body Darkened Overlay */}
          <rect
            x={isCentered ? -(definition.width / 2) : 0}
            y={isCentered ? -(definition.height / 2) : 0}
            width={definition.width}
            height={definition.height}
            rx="4"
            fill="rgba(15, 23, 42, 0.65)"
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />

          {/* Rising Dark Smoke Particles */}
          <circle cx={flameCx - 7} cy={flameCy - 8} r="6" fill="#3f3f46" className="smoke-particle-1" />
          <circle cx={flameCx + 6} cy={flameCy - 10} r="8" fill="#27272a" className="smoke-particle-2" />
          <circle cx={flameCx - 1} cy={flameCy - 14} r="7" fill="#18181b" className="smoke-particle-3" />

          {/* Animated SVG Flame */}
          <g className="flame-active" style={{ transformOrigin: `${flameCx}px ${flameCy}px` }}>
            {/* Outer red/orange flame */}
            <path
              d={`M ${flameCx - 14} ${flameCy + 6} Q ${flameCx - 18} ${flameCy - 12} ${flameCx} ${flameCy - 26} Q ${flameCx + 18} ${flameCy - 12} ${flameCx + 14} ${flameCy + 6} Q ${flameCx} ${flameCy + 10} ${flameCx - 14} ${flameCy + 6}`}
              fill="#ea580c"
              opacity="0.95"
            />
            {/* Mid amber/yellow flame */}
            <path
              d={`M ${flameCx - 8} ${flameCy + 4} Q ${flameCx - 10} ${flameCy - 6} ${flameCx} ${flameCy - 18} Q ${flameCx + 10} ${flameCy - 6} ${flameCx + 8} ${flameCy + 4} Q ${flameCx} ${flameCy + 7} ${flameCx - 8} ${flameCy + 4}`}
              fill="#facc15"
              opacity="0.95"
            />
            {/* Inner white-hot core */}
            <path
              d={`M ${flameCx - 4} ${flameCy + 2} Q ${flameCx - 5} ${flameCy - 2} ${flameCx} ${flameCy - 10} Q ${flameCx + 5} ${flameCy - 2} ${flameCx + 4} ${flameCy + 2} Z`}
              fill="#ffffff"
              opacity="0.9"
            />
          </g>

          {/* Warning Badge: OVERLOAD! */}
          <g transform={`translate(${flameCx}, ${isCentered ? definition.height / 2 + 14 : definition.height + 14})`}>
            <rect
              x="-40"
              y="-9"
              width="80"
              height="18"
              rx="9"
              fill="#ef4444"
              stroke="#ffffff"
              strokeWidth="1"
              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
            />
            <text
              x="0"
              y="3.5"
              fill="#ffffff"
              fontSize="8.5"
              fontWeight="black"
              textAnchor="middle"
              fontFamily="monospace"
            >
              🔥 OVERLOAD!
            </text>
          </g>
        </g>
      )}
    </g>
  );
};
