import { CircuitComponent, CircuitWire, SimulationMode } from '../types/circuit';
import { ComponentRegistry } from '../registry/ComponentRegistry';
import { COMPONENT_DEFINITIONS } from '../constants/componentLibrary';

const GROUND_TYPES = new Set(['gnd', 'builtin_gnd', 'builtin_ground']);

let cachedFlowOrderSig = '';
let cachedFlowOrderResult: CircuitFlowRankResult | null = null;

/**
 * Generates a compact signature representing circuit connectivity and static switch/relay/fuse states
 * so multi-pass graph traversals can be safely memoized across 60FPS animation ticks.
 */
export function getTopologySignature(
  components: CircuitComponent[],
  wires: CircuitWire[]
): string {
  const compParts: string[] = new Array(components.length);
  for (let i = 0; i < components.length; i++) {
    const c = components[i];
    const p = c.properties || {};
    const s = c.state || {};
    const switchesKey = Array.isArray(p.switches) ? p.switches.join(',') : '';
    compParts[i] = `${c.id}:${c.type}:${p.closed ?? ''}:${p.isClosed ?? ''}:${p.pressed ?? ''}:${p.isPressed ?? ''}:${p.position ?? ''}:${p.mode ?? ''}:${p.voltage ?? ''}:${switchesKey}:${s.closed ?? ''}:${s.isClosed ?? ''}:${s.blown ?? ''}:${s.isOverloaded ?? ''}:${s.energized ?? ''}:${s.isEnergized ?? ''}`;
  }
  const wireParts: string[] = new Array(wires.length);
  for (let i = 0; i < wires.length; i++) {
    const w = wires[i];
    wireParts[i] = `${w.id}:${w.fromCompId}.${w.fromPinId}>${w.toCompId}.${w.toPinId}`;
  }
  return `${components.length}|${wires.length}|${compParts.join(';')}|${wireParts.join(';')}`;
}

export function resetCircuitFlowCache(): void {
  cachedFlowOrderSig = '';
  cachedFlowOrderResult = null;
}

/**
 * Universally identifies whether a component pin is a Power Source Output:
 * VCC, 5V, 3V3, Battery (+), AC (+), Solar (+), Regulator OUT, Gate/MCU/RX Output.
 */
export function isPowerSourceOutput(comp: CircuitComponent | undefined, pinId: string): boolean {
  if (!comp) return false;
  const pLower = (pinId || '').trim().toLowerCase();

  // 1. Dedicated VCC rails
  if (comp.type === 'vcc' || comp.type === 'builtin_vcc') return true;

  // 2. DC / Battery / AC / Solar positive terminals
  if (
    ['dc-source', 'battery-9v', 'coin-cell', 'builtin_solar_panel'].includes(comp.type) &&
    ['pos', '+', 'p1', 'vcc'].includes(pLower)
  ) {
    return true;
  }
  if (comp.type === 'ac-source' && ['pos', '~ line', 'p1'].includes(pLower)) {
    return true;
  }

  // 3. Voltage Regulators & DC-DC Converters
  if (
    ['builtin_reg_7805', 'lm7805', 'voltage-regulator-7805'].includes(comp.type) &&
    ['out', 'vout', 'output'].includes(pLower)
  ) {
    return true;
  }
  if (
    ['builtin_dcdc_converter', 'dcdc-converter'].includes(comp.type) &&
    ['vout_plus', 'vout+'].includes(pLower)
  ) {
    return true;
  }

  // 4. Bridge Rectifier DC+
  if (comp.type === 'builtin_bridge_rectifier' && pLower === 'dc_plus') {
    return true;
  }

  // 5. Logic Gates & 555 Timers
  if (comp.type.startsWith('gate-') && ['out', 'output'].includes(pLower)) return true;
  if (['ic-555', 'builtin_555', 'timer-555'].includes(comp.type) && ['out', 'pin3', 'pin3_out'].includes(pLower)) return true;
  if (comp.type === 'builtin_comparator' && pLower === 'out') return true;
  if (comp.type === 'builtin_opamp' && ['out', 'output'].includes(pLower)) return true;

  // 6. Sequential Logic ICs & Flip-Flops
  if (
    [
      'builtin_shift_register',
      'builtin_counter_4bit',
      'builtin_bcd_decoder',
      'builtin_mux_4to1',
      'builtin_d_flipflop',
      'builtin_jk_flipflop',
    ].includes(comp.type) &&
    (pLower.startsWith('q') || pLower === 'y' || pLower === 'out' || pLower === 'nq')
  ) {
    return true;
  }

  // 7. Active Sensors & Radio Receivers
  if (
    ['builtin_soil_moisture', 'builtin_hall_sensor', 'builtin_vibration_sensor', 'builtin_ir_rx'].includes(comp.type) &&
    pLower === 'out'
  ) {
    return true;
  }
  if (comp.type === 'builtin_rf_radio' && pLower === 'rx') {
    return true;
  }

  // 8. MCU supply and digital driver pins
  if (['arduino-uno', 'esp32', 'pico', 'builtin_cpu_8bit', 'cpu-8bit'].includes(comp.type)) {
    if (['5v', '3v3', '3.3v', 'vbus', 'vsys', 'ioref'].includes(pLower)) return true;
  }

  return false;
}

/**
 * Universally identifies whether a component pin is a Ground / Negative Return Terminal:
 * GND symbol, Battery (-), AC Neutral, Solar (-), Converter (-), MCU GND.
 */
export function isGroundReturnTerminal(comp: CircuitComponent | undefined, pinId: string): boolean {
  if (!comp) return false;
  const pLower = (pinId || '').trim().toLowerCase();

  // 1. Dedicated Ground Symbols
  if (GROUND_TYPES.has(comp.type)) return true;

  // 2. Power Sources Negative Terminals
  if (
    ['dc-source', 'battery-9v', 'coin-cell', 'builtin_solar_panel'].includes(comp.type) &&
    ['neg', '-', 'p2'].includes(pLower)
  ) {
    return true;
  }
  if (comp.type === 'ac-source' && ['neg', '~ neutral', 'p2'].includes(pLower)) {
    return true;
  }
  if (
    ['builtin_dcdc_converter', 'dcdc-converter'].includes(comp.type) &&
    ['vin_minus', 'vout_minus', 'vin-', 'vout-'].includes(pLower)
  ) {
    return true;
  }
  if (comp.type === 'builtin_bridge_rectifier' && pLower === 'dc_minus') {
    return true;
  }

  // 3. MCU Ground Pins
  if (
    ['arduino-uno', 'esp32', 'pico', 'builtin_cpu_8bit', 'cpu-8bit'].includes(comp.type) &&
    pLower.includes('gnd')
  ) {
    return true;
  }

  return false;
}

// Backward-compatible aliases
export function isGroundEndpoint(comp: CircuitComponent | undefined, pinId: string): boolean {
  return isGroundReturnTerminal(comp, pinId);
}

export function isSourcePositiveEndpoint(comp: CircuitComponent | undefined, pinId: string): boolean {
  return isPowerSourceOutput(comp, pinId);
}

export function isDriverEndpoint(comp: CircuitComponent | undefined, pinId: string): boolean {
  return isPowerSourceOutput(comp, pinId);
}

/**
 * Computes shortest hop distance from Power Sources and to Ground across the entire
 * circuit (including through conducting component channels like resistors, closed switches, diodes).
 */
export function getCircuitHopDistances(
  allComponents: CircuitComponent[],
  allWires: CircuitWire[]
): { distToSrc: Map<string, number>; distToGnd: Map<string, number> } {
  const adj = new Map<string, string[]>();
  const addAdj = (k1: string, k2: string) => {
    if (!adj.has(k1)) adj.set(k1, []);
    if (!adj.has(k2)) adj.set(k2, []);
    adj.get(k1)!.push(k2);
    adj.get(k2)!.push(k1);
  };

  for (const w of allWires) {
    const k1 = `${w.fromCompId}:${w.fromPinId.toLowerCase()}`;
    const k2 = `${w.toCompId}:${w.toPinId.toLowerCase()}`;
    addAdj(k1, k2);
  }

  for (const c of allComponents) {
    const pairs = getComponentConductingPinPairs(c);
    for (const [p1, p2] of pairs) {
      addAdj(`${c.id}:${p1.toLowerCase()}`, `${c.id}:${p2.toLowerCase()}`);
    }
  }

  const srcRoots: string[] = [];
  const gndRoots: string[] = [];
  for (const c of allComponents) {
    const def = ComponentRegistry.getComponentDefinition(c.type) || COMPONENT_DEFINITIONS[c.type];
    if (!def?.pins) continue;
    for (const p of def.pins) {
      if (isPowerSourceOutput(c, p.id)) {
        srcRoots.push(`${c.id}:${p.id.toLowerCase()}`);
      }
      if (isGroundReturnTerminal(c, p.id)) {
        gndRoots.push(`${c.id}:${p.id.toLowerCase()}`);
      }
    }
  }

  const distToSrc = new Map<string, number>();
  const qSrc = [...srcRoots];
  for (const r of srcRoots) distToSrc.set(r, 0);
  while (qSrc.length > 0) {
    const curr = qSrc.shift()!;
    const d = distToSrc.get(curr)!;
    for (const nxt of adj.get(curr) || []) {
      if (!distToSrc.has(nxt)) {
        distToSrc.set(nxt, d + 1);
        qSrc.push(nxt);
      }
    }
  }

  const distToGnd = new Map<string, number>();
  const qGnd = [...gndRoots];
  for (const r of gndRoots) distToGnd.set(r, 0);
  while (qGnd.length > 0) {
    const curr = qGnd.shift()!;
    const d = distToGnd.get(curr)!;
    for (const nxt of adj.get(curr) || []) {
      if (!distToGnd.has(nxt)) {
        distToGnd.set(nxt, d + 1);
        qGnd.push(nxt);
      }
    }
  }

  return { distToSrc, distToGnd };
}

/**
 * Identifies whether current/signal enters INTO a component pin ('ENTRY')
 * or leaves OUT OF a component pin ('EXIT') based on component physics, polarity,
 * relative voltage drop, or circuit graph position.
 */
export function getComponentPinFlowRole(
  comp: CircuitComponent | undefined,
  pinId: string,
  allComponents?: CircuitComponent[],
  allWires?: CircuitWire[],
  vPin?: number
): 'ENTRY' | 'EXIT' | 'NONE' {
  if (!comp) return 'NONE';
  const type = comp.type;
  const pLower = (pinId || '').trim().toLowerCase();

  // 1. Sources, Drivers, Regulators, Sensor Outputs, Gate Outputs (Always EXIT)
  if (isPowerSourceOutput(comp, pinId)) {
    return 'EXIT';
  }

  // 2. Ground & Negative Return Terminals, Gate Inputs (Always ENTRY)
  if (isGroundReturnTerminal(comp, pinId)) {
    return 'ENTRY';
  }

  // Logic Gate Inputs (in, in1, in2, a, b, etc.)
  if (type.startsWith('gate-') && ['in', 'in1', 'in2', 'a', 'b', 'input'].includes(pLower)) {
    return 'ENTRY';
  }
  if (
    ['builtin_comparator', 'builtin_opamp'].includes(type) &&
    ['in_plus', 'in+', 'in_minus', 'in-'].includes(pLower)
  ) {
    return 'ENTRY';
  }
  // Active sensor power supply return pin (Component GND)
  if (
    [
      'builtin_ir_rx',
      'builtin_soil_moisture',
      'builtin_hall_sensor',
      'builtin_vibration_sensor',
      'builtin_rf_radio',
    ].includes(type)
  ) {
    if (['gnd', 'ground'].includes(pLower)) return 'ENTRY';
  }

  // 3. Polarized 2-Terminal Loads (LEDs, Diodes, IR_TX, Motors, Pumps, Solenoids, Speakers, Buzzers)
  const isAnode = ['anode', 'pos', '+', 'm_plus', 'p_plus', 'p1'].includes(pLower);
  const isCathode = ['cathode', 'neg', '-', 'm_minus', 'p_minus', 'p2'].includes(pLower);

  if (
    [
      'led',
      'led-red',
      'led-green',
      'led-blue',
      'led-yellow',
      'builtin_led',
      'diode',
      'diode-1n4148',
      'diode-1n4007',
      'builtin_ir_tx',
      'buzzer',
      'builtin_dc_motor',
      'dc-motor',
      'dc-fan',
      'builtin_water_pump',
      'builtin_solenoid',
      'builtin_speaker',
    ].includes(type)
  ) {
    if (isAnode) return 'ENTRY';
    if (isCathode) return 'EXIT';
  }

  // Zener Diode: Reverse breakdown regulation vs Forward conduction
  if (type === 'zener-diode' || type === 'builtin_zener') {
    const vA = comp.state?.pinVoltages?.['anode'] ?? 0;
    const vC = comp.state?.pinVoltages?.['cathode'] ?? 0;
    const vz = typeof comp.properties?.zenerVoltage === 'number' ? comp.properties.zenerVoltage : 5.1;
    const isReverseZener = vC - vA >= vz - 0.2;
    if (isReverseZener) {
      if (isCathode) return 'ENTRY';
      if (isAnode) return 'EXIT';
    } else {
      if (isAnode) return 'ENTRY';
      if (isCathode) return 'EXIT';
    }
  }

  // Traffic Light Module
  if (type === 'builtin_traffic_light') {
    if (['red', 'yellow', 'green'].includes(pLower)) return 'ENTRY';
    if (pLower === 'gnd') return 'EXIT';
  }

  // 4. 2-Terminal Passive / Series Components
  // (Resistors, Potentiometers, Fuses, Closed Switches, Inductors, Bulbs, Capacitors)
  if (
    [
      'resistor',
      'builtin_resistor',
      'inductor',
      'builtin_inductor',
      'fuse',
      'builtin_fuse',
      'toggle-switch',
      'pushbutton',
      'builtin_spst_switch',
      'builtin_switch_spst',
      'potentiometer',
      'builtin_potentiometer',
      'builtin_filament_bulb',
      'photoresistor',
      'builtin_photoresistor',
      'thermistor',
      'builtin_thermistor',
      'capacitor-ceramic',
      'capacitor-electrolytic',
    ].includes(type)
  ) {
    let otherPinId: string | undefined = undefined;
    if (type === 'toggle-switch') {
      const isT1 = comp.properties?.state !== 'T2';
      const activePin = isT1 ? 't1' : 't2';
      if (pLower === 'com') otherPinId = activePin;
      else if (pLower === activePin) otherPinId = 'com';
    } else if (pLower === 'p1') otherPinId = 'p2';
    else if (pLower === 'p2') otherPinId = 'p1';
    else if (pLower === 'pos') otherPinId = 'neg';
    else if (pLower === 'neg') otherPinId = 'pos';
    else if (pLower === 'com') otherPinId = 'p2';

    // 4a. Compare solved node voltages at component's own two pins
    let vSelf: number | undefined = vPin;
    let vOther: number | undefined = undefined;

    if (comp.state?.pinVoltages && otherPinId) {
      if (vSelf === undefined) vSelf = comp.state.pinVoltages[pinId] ?? comp.state.pinVoltages[pLower];
      vOther = comp.state.pinVoltages[otherPinId] ?? comp.state.pinVoltages[otherPinId.toLowerCase()];
    }

    if (vSelf !== undefined && vOther !== undefined && Math.abs(vSelf - vOther) >= 0.001) {
      // Flow enters Higher Voltage (ENTRY) and leaves Lower Voltage (EXIT)
      return vSelf > vOther ? 'ENTRY' : 'EXIT';
    }

    // 4b. Fallback: Distance to Power Source vs Ground via BFS Graph
    if (allComponents && allWires && allWires.length > 0 && otherPinId) {
      const selfKey = `${comp.id}:${pLower}`;
      const otherKey = `${comp.id}:${otherPinId.toLowerCase()}`;

      const { distToSrc, distToGnd } = getCircuitHopDistances(allComponents, allWires);
      const sSelf = distToSrc.get(selfKey);
      const sOther = distToSrc.get(otherKey);
      if (sSelf !== undefined && sOther !== undefined && sSelf !== sOther) {
        // Closer to Source is ENTRY, further from Source is EXIT
        return sSelf < sOther ? 'ENTRY' : 'EXIT';
      }

      const gSelf = distToGnd.get(selfKey);
      const gOther = distToGnd.get(otherKey);
      if (gSelf !== undefined && gOther !== undefined && gSelf !== gOther) {
        // Closer to Ground is EXIT, further from Ground is ENTRY
        return gSelf > gOther ? 'ENTRY' : 'EXIT';
      }
    }
  }

  return 'NONE';
}

/**
 * Returns directed internal conduction pin pairs through a component
 * from + / Entry terminal to - / Exit terminal.
 */
export function getComponentDirectedFlowPairs(comp: CircuitComponent): Array<[string, string]> {
  if (!comp) return [];
  const type = comp.type;
  const props = comp.properties || {};
  const state = comp.state || {};

  // 1. Passive 2-terminal components (Resistors, Potentiometers, Inductors, Capacitors, Bulbs)
  if (
    [
      'resistor',
      'builtin_resistor',
      'photoresistor',
      'builtin_photoresistor',
      'thermistor',
      'builtin_thermistor',
      'inductor',
      'builtin_inductor',
      'capacitor-ceramic',
      'capacitor-electrolytic',
      'builtin_filament_bulb',
    ].includes(type)
  ) {
    if (type === 'builtin_filament_bulb' && state.isBurned) return [];

    const v1 = state.pinVoltages?.['p1'] ?? state.pinVoltages?.['pos'] ?? state.pinVoltages?.['anode'];
    const v2 = state.pinVoltages?.['p2'] ?? state.pinVoltages?.['neg'] ?? state.pinVoltages?.['cathode'];
    if (v1 !== undefined && v2 !== undefined && Math.abs(v1 - v2) > 0.001) {
      return v1 > v2
        ? [
            ['p1', 'p2'],
            ['pos', 'neg'],
            ['anode', 'cathode'],
          ]
        : [
            ['p2', 'p1'],
            ['neg', 'pos'],
            ['cathode', 'anode'],
          ];
    }
    return [
      ['p1', 'p2'],
      ['p2', 'p1'],
      ['pos', 'neg'],
      ['neg', 'pos'],
      ['anode', 'cathode'],
      ['cathode', 'anode'],
    ];
  }

  if (['potentiometer', 'builtin_potentiometer'].includes(type)) {
    return [
      ['p1', 'wiper'],
      ['wiper', 'p1'],
      ['wiper', 'p2'],
      ['p2', 'wiper'],
      ['p1', 'p2'],
      ['p2', 'p1'],
    ];
  }

  // 2. Switches & Pushbuttons (strictly ZERO pairs when open!)
  if (type === 'toggle-switch') {
    const isT1 = props.state !== 'T2';
    return isT1
      ? [
          ['com', 't1'],
          ['t1', 'com'],
        ]
      : [
          ['com', 't2'],
          ['t2', 'com'],
        ];
  }
  if (type === 'pushbutton') {
    const isPressed = Boolean(state.isPressed || props.isPressed);
    return isPressed
      ? [
          ['p1', 'p2'],
          ['p2', 'p1'],
        ]
      : [];
  }
  if (type === 'builtin_spst_switch' || type === 'builtin_switch_spst') {
    const isClosed = Boolean(props.closed ?? state.closed);
    return isClosed
      ? [
          ['p1', 'p2'],
          ['p2', 'p1'],
          ['com', 'p2'],
          ['p2', 'com'],
          ['com', 'p1'],
          ['p1', 'com'],
        ]
      : [];
  }
  if (type === 'builtin_dip_switch_4') {
    const pairs: Array<[string, string]> = [];
    for (let i = 1; i <= 4; i++) {
      const isOn = Boolean(props[`s${i}`] ?? props[`switch${i}`] ?? state[`s${i}`] ?? props[`sw${i}`]);
      if (isOn) {
        pairs.push([`in${i}`, `out${i}`]);
        pairs.push([`out${i}`, `in${i}`]);
      }
    }
    return pairs;
  }
  if (['relay', 'builtin_relay'].includes(type)) {
    const pairs: Array<[string, string]> = [
      ['coil1', 'coil2'],
      ['vcc', 'gnd'],
    ];
    const isEngaged = Boolean(state.isEnergized || state.isActive);
    if (isEngaged) {
      pairs.push(['com', 'no']);
      pairs.push(['no', 'com']);
    } else {
      pairs.push(['com', 'nc']);
      pairs.push(['nc', 'com']);
    }
    return pairs;
  }

  // 3. Fuses
  if (['fuse', 'builtin_fuse'].includes(type)) {
    const isBlown = Boolean(state.isBurned || state.isBlown || props.isBlown);
    return isBlown
      ? []
      : [
          ['p1', 'p2'],
          ['p2', 'p1'],
        ];
  }

  // 4. Polarized Loads & Diodes (Strictly Anode/Positive -> Cathode/Negative)
  if (
    [
      'diode',
      'diode-1n4148',
      'diode-1n4007',
      'led',
      'led-red',
      'led-green',
      'led-blue',
      'led-yellow',
      'builtin_led',
      'builtin_ir_tx',
    ].includes(type)
  ) {
    return [
      ['anode', 'cathode'],
      ['pos', 'neg'],
      ['+', '-'],
      ['p1', 'p2'],
    ];
  }

  if (['zener-diode', 'builtin_zener'].includes(type)) {
    const vA = state.pinVoltages?.['anode'] ?? 0;
    const vC = state.pinVoltages?.['cathode'] ?? 0;
    const vz = typeof props.zenerVoltage === 'number' ? props.zenerVoltage : 5.1;
    const isReverse = vC - vA >= vz - 0.2;
    if (isReverse) {
      return [
        ['cathode', 'anode'],
        ['neg', 'pos'],
      ];
    }
    return [
      ['anode', 'cathode'],
      ['pos', 'neg'],
    ];
  }

  // Actuators & Motors
  if (
    [
      'builtin_dc_motor',
      'dc-motor',
      'dc-fan',
      'builtin_water_pump',
      'builtin_solenoid',
      'builtin_speaker',
      'buzzer',
    ].includes(type)
  ) {
    return [
      ['pos', 'neg'],
      ['+', '-'],
      ['p_plus', 'p_minus'],
      ['m_plus', 'm_minus'],
      ['p1', 'p2'],
      ['vcc', 'gnd'],
    ];
  }

  // Traffic Light
  if (type === 'builtin_traffic_light') {
    return [
      ['red', 'gnd'],
      ['yellow', 'gnd'],
      ['green', 'gnd'],
    ];
  }

  // Regulators & Converters
  if (['builtin_reg_7805', 'voltage-regulator-7805', 'lm7805'].includes(type)) {
    return [
      ['in', 'gnd'],
      ['vin', 'gnd'],
    ];
  }
  if (['builtin_dcdc_converter', 'dcdc-converter'].includes(type)) {
    return [
      ['vin_plus', 'vin_minus'],
      ['vin+', 'vin-'],
    ];
  }

  // Bridge Rectifier
  if (type === 'builtin_bridge_rectifier') {
    return [
      ['ac1', 'dc_plus'],
      ['ac2', 'dc_plus'],
      ['dc_minus', 'ac1'],
      ['dc_minus', 'ac2'],
    ];
  }

  // Transistors & MOSFETs
  if (['transistor-npn', 'builtin_npn'].includes(type)) {
    return [
      ['base', 'emitter'],
      ['b', 'e'],
      ['collector', 'emitter'],
      ['c', 'e'],
    ];
  }
  if (['transistor-pnp', 'builtin_pnp'].includes(type)) {
    return [
      ['emitter', 'collector'],
      ['e', 'c'],
      ['emitter', 'base'],
      ['e', 'b'],
    ];
  }
  if (['mosfet-n', 'builtin_n_mosfet'].includes(type)) {
    return [
      ['drain', 'source'],
      ['d', 's'],
    ];
  }
  if (['mosfet-p', 'builtin_p_mosfet'].includes(type)) {
    return [
      ['source', 'drain'],
      ['s', 'd'],
    ];
  }

  return [];
}

export interface CircuitFlowRankResult {
  flowOrder: Map<string, number>;
  sourceDist: Map<string, number>;
  gndDist: Map<string, number>;
}

/**
 * Universal Flow Rank Engine ("+ to - Towards GND" Potential & Hop-Distance Field):
 * Computes a global Flow Progress Score across all connected pins in the circuit:
 * 1. Seeds start at active positive sources (sourceDist = 0) and final destinations at GND (gndDist = 0).
 * 2. Runs Dijkstra along wires (+1 hop) and forward through components (+10 per stage).
 * 3. Combines into flowOrder(p) = sourceDist(p) - gndDist(p), which strictly increases from Source to GND.
 */
/**
 * Computes topological component flow order with O(1) memoization when circuit
 * topology and switching states are unchanged.
 */
export function computeCircuitFlowOrder(
  allComponents: CircuitComponent[],
  allWires: CircuitWire[]
): CircuitFlowRankResult {
  const sig = getTopologySignature(allComponents, allWires);
  if (sig === cachedFlowOrderSig && cachedFlowOrderResult) {
    return cachedFlowOrderResult;
  }
  const result = computeCircuitFlowOrderUncached(allComponents, allWires);
  cachedFlowOrderSig = sig;
  cachedFlowOrderResult = result;
  return result;
}

function computeCircuitFlowOrderUncached(
  allComponents: CircuitComponent[],
  allWires: CircuitWire[]
): CircuitFlowRankResult {
  const forwardEdges = new Map<string, Array<{ to: string; weight: number }>>();
  const reverseEdges = new Map<string, Array<{ to: string; weight: number }>>();

  const addEdge = (
    graph: Map<string, Array<{ to: string; weight: number }>>,
    u: string,
    v: string,
    weight: number
  ) => {
    if (!graph.has(u)) graph.set(u, []);
    graph.get(u)!.push({ to: v, weight });
  };

  // 1. Wires: Bidirectional edges with weight 1
  for (const w of allWires) {
    const u = `${w.fromCompId}:${w.fromPinId.toLowerCase()}`;
    const v = `${w.toCompId}:${w.toPinId.toLowerCase()}`;
    addEdge(forwardEdges, u, v, 1);
    addEdge(forwardEdges, v, u, 1);
    addEdge(reverseEdges, u, v, 1);
    addEdge(reverseEdges, v, u, 1);
  }

  // 2. Components: Directed internal edges with weight 10
  for (const c of allComponents) {
    const pairs = getComponentDirectedFlowPairs(c);
    for (const [pEntry, pExit] of pairs) {
      const u = `${c.id}:${pEntry.toLowerCase()}`;
      const v = `${c.id}:${pExit.toLowerCase()}`;
      addEdge(forwardEdges, u, v, 10);
      addEdge(reverseEdges, v, u, 10);
    }
  }

  // 3. Seed Sources (+) and Grounds (-)
  const srcSeeds: string[] = [];
  const gndSeeds: string[] = [];

  for (const c of allComponents) {
    const def = ComponentRegistry.getComponentDefinition(c.type) || COMPONENT_DEFINITIONS[c.type];
    if (!def?.pins) continue;
    for (const p of def.pins) {
      const pKey = `${c.id}:${p.id.toLowerCase()}`;
      if (isPowerSourceOutput(c, p.id)) {
        // If it is a dynamic driver (sensor, gate, timer), verify it is active (> 0.1V)
        const v =
          c.state?.pinVoltages?.[p.id] ??
          c.state?.pinVoltages?.[p.id.toLowerCase()] ??
          c.state?.outputVoltage;
        if (v === undefined || v >= 0.1) {
          srcSeeds.push(pKey);
        }
      }
      if (isGroundReturnTerminal(c, p.id)) {
        gndSeeds.push(pKey);
      }
    }
  }

  // 4. Dijkstra from Sources and Grounds
  const runDijkstra = (
    graph: Map<string, Array<{ to: string; weight: number }>>,
    seeds: string[]
  ): Map<string, number> => {
    const dist = new Map<string, number>();
    const pq: Array<{ node: string; d: number }> = [];

    for (const s of seeds) {
      dist.set(s, 0);
      pq.push({ node: s, d: 0 });
    }

    while (pq.length > 0) {
      pq.sort((a, b) => a.d - b.d);
      const { node: curr, d } = pq.shift()!;
      if (d > (dist.get(curr) ?? Infinity)) continue;

      for (const edge of graph.get(curr) || []) {
        const newD = d + edge.weight;
        if (newD < (dist.get(edge.to) ?? Infinity)) {
          dist.set(edge.to, newD);
          pq.push({ node: edge.to, d: newD });
        }
      }
    }
    return dist;
  };

  const sourceDist = runDijkstra(forwardEdges, srcSeeds);
  const gndDist = runDijkstra(reverseEdges, gndSeeds);

  // 5. Combine into single monotonic Flow Progress Score
  const flowOrder = new Map<string, number>();
  const allPins = new Set([...sourceDist.keys(), ...gndDist.keys()]);
  for (const p of allPins) {
    const hasSrc = sourceDist.has(p);
    const hasGnd = gndDist.has(p);
    if (hasSrc && hasGnd) {
      flowOrder.set(p, sourceDist.get(p)! - gndDist.get(p)!);
    } else if (hasSrc) {
      flowOrder.set(p, -10000 + sourceDist.get(p)!);
    } else if (hasGnd) {
      flowOrder.set(p, 10000 - gndDist.get(p)!);
    }
  }

  return { flowOrder, sourceDist, gndDist };
}

/**
 * Determines whether wire animation dashes should flow from -> to (+1) or to -> from (-1).
 *
 * Implements Universal "+ to - Towards GND" Potential & Hop-Distance Field:
 * 1. Tier 1 (Global Flow Order - Highest Priority):
 *    - Pin with lower flowOrder (closer to + Source) flows to pin with higher flowOrder (closer to GND).
 *    - If flowOrder(pinA) < flowOrder(pinB) -> FORWARD (+1)
 *    - If flowOrder(pinB) < flowOrder(pinA) -> REVERSED (-1)
 * 2. Tier 2 (Component-Aware Flow Direction Chaining):
 *    - Flow leaves EXIT pin of upstream component and enters ENTRY pin of downstream component.
 * 3. Tier 3 (Voltage Drop Fallback Across Different Nodes):
 *    - Higher Voltage -> Lower Voltage
 */
export function computeWireFlowDirection(
  wire: CircuitWire,
  fromComp: CircuitComponent | undefined,
  toComp: CircuitComponent | undefined,
  _simulationMode?: SimulationMode,
  vFrom?: number,
  vTo?: number,
  allWires?: CircuitWire[],
  allComponents?: CircuitComponent[]
): 1 | -1 | 0 {
  if (_simulationMode === 'OFF') return 0;
  if (!fromComp || !toComp) return 1;

  // ---------------------------------------------------------------------------
  // Tier 1: Universal "+ to GND" Potential & Hop-Distance Field (Global Flow Order)
  // ---------------------------------------------------------------------------
  if (allWires && allWires.length > 0 && allComponents && allComponents.length > 0) {
    const fromKey = `${wire.fromCompId}:${wire.fromPinId.toLowerCase()}`;
    const toKey = `${wire.toCompId}:${wire.toPinId.toLowerCase()}`;
    const { flowOrder, sourceDist, gndDist } = computeCircuitFlowOrder(allComponents, allWires);

    const orderFrom = flowOrder.get(fromKey);
    const orderTo = flowOrder.get(toKey);

    if (orderFrom !== undefined && orderTo !== undefined && orderFrom !== orderTo) {
      return orderFrom < orderTo ? 1 : -1;
    }

    // Single-ended reachability (e.g. open switches or uncompleted loops)
    const sFrom = sourceDist.get(fromKey);
    const sTo = sourceDist.get(toKey);
    if (sFrom !== undefined && sTo !== undefined && sFrom !== sTo) {
      return sFrom < sTo ? 1 : -1;
    }
    if (sFrom !== undefined && sTo === undefined) {
      return 1; // away from source
    }
    if (sTo !== undefined && sFrom === undefined) {
      return -1; // away from source
    }

    const gFrom = gndDist.get(fromKey);
    const gTo = gndDist.get(toKey);
    if (gFrom !== undefined && gTo !== undefined && gFrom !== gTo) {
      return gFrom > gTo ? 1 : -1;
    }
    if (gTo !== undefined && gFrom === undefined) {
      return 1; // towards ground
    }
    if (gFrom !== undefined && gTo === undefined) {
      return -1; // towards ground
    }
  }

  // ---------------------------------------------------------------------------
  // Tier 2: Component-Aware Flow Direction Chaining (Entry -> Exit Chaining)
  // ---------------------------------------------------------------------------
  const fromRole = getComponentPinFlowRole(fromComp, wire.fromPinId, allComponents, allWires, vFrom);
  const toRole = getComponentPinFlowRole(toComp, wire.toPinId, allComponents, allWires, vTo);

  const isForward =
    (fromRole === 'EXIT' && toRole !== 'EXIT') ||
    (toRole === 'ENTRY' && fromRole !== 'ENTRY');

  const isReversed =
    (toRole === 'EXIT' && fromRole !== 'EXIT') ||
    (fromRole === 'ENTRY' && toRole !== 'ENTRY');

  if (isForward && !isReversed) {
    return 1;
  }
  if (isReversed && !isForward) {
    return -1;
  }

  // ---------------------------------------------------------------------------
  // Tier 3: Voltage Drop Fallback Across Different Nodes
  // ---------------------------------------------------------------------------
  if (vFrom !== undefined && vTo !== undefined && Math.abs(vFrom - vTo) > 0.001) {
    return vFrom > vTo ? 1 : -1;
  }

  // Fallback based on load polarity: anode/pos -> cathode/neg
  const pFrom = wire.fromPinId.toLowerCase();
  const pTo = wire.toPinId.toLowerCase();
  const isFromLoadCathode = ['cathode', 'neg', '-'].includes(pFrom);
  const isToLoadCathode = ['cathode', 'neg', '-'].includes(pTo);
  if (isFromLoadCathode && !isToLoadCathode) return 1;
  if (isToLoadCathode && !isFromLoadCathode) return -1;

  return 1;
}

/**
 * Identifies the floating DC return reference voltage (e.g. DC- of a Bridge Rectifier)
 * when a probe target is on the rectified DC output net and DC- is not tied to earth ground.
 */
export function getRectifierDcReferenceOffset(
  target: { type: 'wire' | 'pin'; compId?: string; pinId?: string; wireId?: string } | null | undefined,
  components: CircuitComponent[],
  wires: CircuitWire[],
  getPinVoltageFn: (compId: string, pinId: string) => number | undefined
): number {
  if (!target) return 0.0;

  // Find any bridge rectifier
  const br = components.find((c) => c.type === 'builtin_bridge_rectifier');
  if (!br) return 0.0;

  // Check if dc_minus is connected to an explicit GND component
  const visited = new Set<string>();
  const queue: Array<{ compId: string; pinId: string }> = [{ compId: br.id, pinId: 'dc_minus' }];
  let isGndConnected = false;
  const dcMinusNetPins = new Set<string>();

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const key = `${curr.compId}:${curr.pinId.toLowerCase()}`;
    if (visited.has(key)) continue;
    visited.add(key);
    dcMinusNetPins.add(key);

    const comp = components.find((c) => c.id === curr.compId);
    if (comp && (comp.type === 'gnd' || comp.type === 'builtin_ground' || comp.type === 'builtin_gnd')) {
      isGndConnected = true;
      break;
    }

    // Traverse wires attached to this pin
    for (const w of wires) {
      if (w.fromCompId === curr.compId && w.fromPinId.toLowerCase() === curr.pinId.toLowerCase()) {
        queue.push({ compId: w.toCompId, pinId: w.toPinId });
      } else if (w.toCompId === curr.compId && w.toPinId.toLowerCase() === curr.pinId.toLowerCase()) {
        queue.push({ compId: w.fromCompId, pinId: w.fromPinId });
      }
    }
  }

  // If DC- is tied to GND, reference offset is strictly 0.0V
  if (isGndConnected) return 0.0;

  const vDcMinus = getPinVoltageFn(br.id, 'dc_minus') ?? 0.0;
  if (Math.abs(vDcMinus) < 1e-4) return 0.0;

  // Check if target is in the DC domain (either on DC+ net, DC- net, or DC load component)
  const dcPlusVisited = new Set<string>();
  const dcPlusQueue: Array<{ compId: string; pinId: string }> = [{ compId: br.id, pinId: 'dc_plus' }];
  const dcPlusNetPins = new Set<string>();

  while (dcPlusQueue.length > 0) {
    const curr = dcPlusQueue.shift()!;
    const key = `${curr.compId}:${curr.pinId.toLowerCase()}`;
    if (dcPlusVisited.has(key)) continue;
    dcPlusVisited.add(key);
    dcPlusNetPins.add(key);

    for (const w of wires) {
      if (w.fromCompId === curr.compId && w.fromPinId.toLowerCase() === curr.pinId.toLowerCase()) {
        dcPlusQueue.push({ compId: w.toCompId, pinId: w.toPinId });
      } else if (w.toCompId === curr.compId && w.toPinId.toLowerCase() === curr.pinId.toLowerCase()) {
        dcPlusQueue.push({ compId: w.fromCompId, pinId: w.fromPinId });
      }
    }
  }

  if (target.type === 'pin' && target.compId && target.pinId) {
    const pKey = `${target.compId}:${target.pinId.toLowerCase()}`;
    if (dcPlusNetPins.has(pKey) || dcMinusNetPins.has(pKey)) {
      return vDcMinus;
    }
    const comp = components.find((c) => c.id === target.compId);
    if (comp) {
      const pins = ['pos', 'neg', 'p1', 'p2', 'anode', 'cathode'];
      const hasDcPlus = pins.some((p) => dcPlusNetPins.has(`${comp.id}:${p}`));
      const hasDcMinus = pins.some((p) => dcMinusNetPins.has(`${comp.id}:${p}`));
      if (hasDcPlus || hasDcMinus) {
        return vDcMinus;
      }
    }
  } else if (target.type === 'wire' && target.wireId) {
    const w = wires.find((wire) => wire.id === target.wireId);
    if (w) {
      const fk = `${w.fromCompId}:${w.fromPinId.toLowerCase()}`;
      const tk = `${w.toCompId}:${w.toPinId.toLowerCase()}`;
      if (dcPlusNetPins.has(fk) || dcPlusNetPins.has(tk) || dcMinusNetPins.has(fk) || dcMinusNetPins.has(tk)) {
        return vDcMinus;
      }
    }
  }

  return 0.0;
}

/**
 * Returns the pairs of pins that conduct current through a component
 * based on its physical component type and live dynamic state (e.g. switch position,
 * fuse status, transistor conduction, diode polarity).
 */
export function getComponentConductingPinPairs(comp: CircuitComponent): Array<[string, string]> {
  if (!comp) return [];
  const type = comp.type;
  const props = comp.properties || {};
  const state = comp.state || {};

  // 1. Passive 2-terminal components (Resistors, Potentiometers, Sensors)
  if (
    [
      'resistor',
      'builtin_resistor',
      'photoresistor',
      'builtin_photoresistor',
      'thermistor',
      'builtin_thermistor',
    ].includes(type)
  ) {
    return [
      ['p1', 'p2'],
      ['pos', 'neg'],
      ['anode', 'cathode'],
    ];
  }
  if (['potentiometer', 'builtin_potentiometer'].includes(type)) {
    return [
      ['p1', 'wiper'],
      ['wiper', 'p2'],
      ['p1', 'p2'],
    ];
  }

  // 2. Switches & Pushbuttons
  if (type === 'toggle-switch') {
    const isT1 = props.state !== 'T2';
    return isT1 ? [['com', 't1']] : [['com', 't2']];
  }
  if (type === 'pushbutton') {
    const isPressed = Boolean(state.isPressed || props.isPressed);
    return isPressed ? [['p1', 'p2']] : [];
  }
  if (type === 'builtin_spst_switch' || type === 'builtin_switch_spst') {
    const isClosed = Boolean(props.closed ?? state.closed);
    return isClosed ? [['p1', 'p2'], ['com', 'p1']] : [];
  }
  if (type === 'builtin_dip_switch_4') {
    const pairs: Array<[string, string]> = [];
    for (let i = 1; i <= 4; i++) {
      const isOn = Boolean(props[`s${i}`] ?? props[`switch${i}`] ?? state[`s${i}`]);
      if (isOn) {
        pairs.push([`in${i}`, `out${i}`]);
      }
    }
    return pairs;
  }
  if (['relay', 'builtin_relay'].includes(type)) {
    const pairs: Array<[string, string]> = [['coil1', 'coil2']];
    const isEnergized = Boolean(state.isEnergized || state.isActive);
    if (isEnergized) {
      pairs.push(['com', 'no']);
    } else {
      pairs.push(['com', 'nc']);
    }
    return pairs;
  }

  // 3. Fuses
  if (['fuse', 'builtin_fuse'].includes(type)) {
    const isBlown = Boolean(state.isBurned || state.isBlown);
    return isBlown ? [] : [['p1', 'p2']];
  }

  // 4. Inductors
  if (['inductor', 'builtin_inductor'].includes(type)) {
    return [['p1', 'p2']];
  }

  // 5. Capacitors (pass AC or dynamic transient current in closed loops)
  if (['capacitor-ceramic', 'capacitor-electrolytic'].includes(type)) {
    return [
      ['p1', 'p2'],
      ['pos', 'neg'],
    ];
  }

  // 6. Diodes, LEDs, Zener, IR Transmitter
  if (
    [
      'diode',
      'diode-1n4148',
      'diode-1n4007',
      'led',
      'led-red',
      'led-green',
      'led-blue',
      'led-yellow',
      'builtin_ir_tx',
    ].includes(type)
  ) {
    return [
      ['anode', 'cathode'],
      ['pos', 'neg'],
      ['p1', 'p2'],
    ];
  }
  if (['zener-diode', 'builtin_zener'].includes(type)) {
    return [
      ['anode', 'cathode'],
      ['cathode', 'anode'],
      ['pos', 'neg'],
    ];
  }

  // 7. Bridge Rectifier
  if (type === 'builtin_bridge_rectifier') {
    return [
      ['ac1', 'dc_plus'],
      ['ac2', 'dc_plus'],
      ['ac1', 'dc_minus'],
      ['ac2', 'dc_minus'],
    ];
  }

  // 8. Actuators, Motors, Pumps, Solenoids, Bulbs, Speakers, Buzzers
  if (type === 'builtin_filament_bulb') {
    return state.isBurned ? [] : [['p1', 'p2']];
  }
  if (['builtin_dc_motor', 'dc-motor', 'dc-fan'].includes(type)) {
    return [
      ['m_plus', 'm_minus'],
      ['pos', 'neg'],
      ['vcc', 'gnd'],
    ];
  }
  if (['builtin_water_pump', 'builtin_solenoid', 'builtin_speaker', 'buzzer'].includes(type)) {
    return [
      ['pos', 'neg'],
      ['p1', 'p2'],
    ];
  }
  if (type === 'builtin_traffic_light') {
    return [
      ['red', 'gnd'],
      ['yellow', 'gnd'],
      ['green', 'gnd'],
    ];
  }

  // 9. Voltage Regulators & Converters
  if (['builtin_reg_7805', 'voltage-regulator-7805', 'lm7805'].includes(type)) {
    return [
      ['in', 'gnd'],
      ['vin', 'gnd'],
      ['out', 'gnd'],
      ['vout', 'gnd'],
    ];
  }
  if (['builtin_dcdc_converter', 'dcdc-converter'].includes(type)) {
    return [
      ['vin_plus', 'vin_minus'],
      ['vout_plus', 'vout_minus'],
    ];
  }

  // 10. Transistors & MOSFETs
  if (
    [
      'bjt-npn',
      'builtin_transistor_npn',
      'builtin_pnp',
      'bjt-pnp',
      'builtin_transistor_pnp',
      'n-mosfet',
      'builtin_mosfet_n',
      'p-mosfet',
      'builtin_pmos',
      'builtin_mosfet_p',
    ].includes(type)
  ) {
    if (state.isConducting || (state.currentA ?? 0) > 0.0001) {
      return [
        ['collector', 'emitter'],
        ['c', 'e'],
        ['drain', 'source'],
        ['d', 's'],
      ];
    }
    return [];
  }

  // 11. Generic ICs (no internal passive shorts)
  return [];
}

/**
 * Universally computes the set of wire IDs that participate in an unbroken,
 * closed electrical loop between an active Power Source and a Ground / Return terminal.
 *
 * Implements bi-directional BFS traversal:
 * 1. Multi-source BFS from all active Power Sources (VCC, Battery +, AC Line, Solar, etc.)
 * 2. Multi-source BFS from all Ground / Return terminals (GND, Battery -, AC Neutral, etc.)
 * 3. A wire is in a closed loop IF AND ONLY IF it can reach BOTH a Source and a Ground!
 */
export function getClosedLoopWireIds(
  components: CircuitComponent[],
  wires: CircuitWire[]
): Set<string> {
  const closedLoopWireIds = new Set<string>();
  if (!components || components.length === 0 || !wires || wires.length === 0) {
    return closedLoopWireIds;
  }

  // 1. Build pin-to-pin adjacency graph
  // Key: compId:pinId (lowercased)
  const pinGraph = new Map<string, Array<{ neighborKey: string; wireId?: string }>>();
  const addEdge = (k1: string, k2: string, wireId?: string) => {
    if (!pinGraph.has(k1)) pinGraph.set(k1, []);
    if (!pinGraph.has(k2)) pinGraph.set(k2, []);
    pinGraph.get(k1)!.push({ neighborKey: k2, wireId });
    pinGraph.get(k2)!.push({ neighborKey: k1, wireId });
  };

  // Wire edges
  for (const w of wires) {
    const k1 = `${w.fromCompId}:${w.fromPinId.toLowerCase()}`;
    const k2 = `${w.toCompId}:${w.toPinId.toLowerCase()}`;
    addEdge(k1, k2, w.id);
  }

  // Internal component conducting edges
  for (const c of components) {
    const conductingPairs = getComponentConductingPinPairs(c);
    for (const [p1, p2] of conductingPairs) {
      const k1 = `${c.id}:${p1.toLowerCase()}`;
      const k2 = `${c.id}:${p2.toLowerCase()}`;
      addEdge(k1, k2);
    }
  }

  // 2. Collect all active Power Source Output roots
  const sourceRoots: string[] = [];
  for (const c of components) {
    const def = ComponentRegistry.getComponentDefinition(c.type) || COMPONENT_DEFINITIONS[c.type];
    if (!def?.pins) continue;

    // Check if source is active (e.g. non-zero voltage if configured)
    const props = c.properties || {};
    const state = c.state || {};
    let isActiveSource = true;
    if (['vcc', 'builtin_vcc', 'dc-source', 'battery-9v', 'coin-cell'].includes(c.type)) {
      if (typeof props.voltage === 'number' && props.voltage <= 0) isActiveSource = false;
    } else if (c.type === 'ac-source') {
      if (typeof props.amplitude === 'number' && props.amplitude <= 0) isActiveSource = false;
    } else if (c.type.startsWith('gate-') || ['builtin_comparator', 'builtin_opamp'].includes(c.type)) {
      if (state.logicLevel === 0 || (typeof state.voltage === 'number' && state.voltage < 0.5)) {
        isActiveSource = false;
      }
    }

    if (!isActiveSource) continue;

    for (const p of def.pins) {
      if (isPowerSourceOutput(c, p.id)) {
        sourceRoots.push(`${c.id}:${p.id.toLowerCase()}`);
      }
    }
  }

  // 3. Collect all Ground / Return roots
  const groundRoots: string[] = [];
  for (const c of components) {
    const def = ComponentRegistry.getComponentDefinition(c.type) || COMPONENT_DEFINITIONS[c.type];
    if (!def?.pins) continue;
    for (const p of def.pins) {
      if (isGroundReturnTerminal(c, p.id)) {
        groundRoots.push(`${c.id}:${p.id.toLowerCase()}`);
      }
    }
  }

  if (sourceRoots.length === 0 || groundRoots.length === 0) {
    return closedLoopWireIds;
  }

  // 4. BFS from Source Roots
  const sourceRootSet = new Set<string>(sourceRoots);
  const groundRootSet = new Set<string>(groundRoots);

  const visitedPinsFromSrc = new Set<string>(sourceRoots);
  const visitedWiresFromSrc = new Set<string>();
  const srcQueue = [...sourceRoots];

  while (srcQueue.length > 0) {
    const curr = srcQueue.shift()!;
    // Terminate path expansion once a Ground/Return boundary terminal is reached
    if (!sourceRootSet.has(curr) && groundRootSet.has(curr)) {
      continue;
    }
    const neighbors = pinGraph.get(curr) || [];
    for (const edge of neighbors) {
      if (edge.wireId) {
        visitedWiresFromSrc.add(edge.wireId);
      }
      if (!visitedPinsFromSrc.has(edge.neighborKey)) {
        visitedPinsFromSrc.add(edge.neighborKey);
        srcQueue.push(edge.neighborKey);
      }
    }
  }

  // 5. BFS from Ground Roots
  const visitedPinsFromGnd = new Set<string>(groundRoots);
  const visitedWiresFromGnd = new Set<string>();
  const gndQueue = [...groundRoots];

  while (gndQueue.length > 0) {
    const curr = gndQueue.shift()!;
    // Terminate path expansion once a Power Source boundary terminal is reached
    if (!groundRootSet.has(curr) && sourceRootSet.has(curr)) {
      continue;
    }
    const neighbors = pinGraph.get(curr) || [];
    for (const edge of neighbors) {
      if (edge.wireId) {
        visitedWiresFromGnd.add(edge.wireId);
      }
      if (!visitedPinsFromGnd.has(edge.neighborKey)) {
        visitedPinsFromGnd.add(edge.neighborKey);
        gndQueue.push(edge.neighborKey);
      }
    }
  }

  // 6. A wire is in a closed loop IF AND ONLY IF it can reach BOTH a Source and a Ground!
  for (const w of wires) {
    if (visitedWiresFromSrc.has(w.id) && visitedWiresFromGnd.has(w.id)) {
      closedLoopWireIds.add(w.id);
    }
  }

  return closedLoopWireIds;
}

/**
 * Checks whether a single wire is part of an unbroken closed loop between an active
 * Power Source and Ground/Negative Return.
 */
export function isWireInClosedLoop(
  wire: CircuitWire,
  components: CircuitComponent[],
  wires: CircuitWire[]
): boolean {
  const loopWires = getClosedLoopWireIds(components, wires);
  return loopWires.has(wire.id);
}
