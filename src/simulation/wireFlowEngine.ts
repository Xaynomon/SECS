import { CircuitComponent, CircuitWire, SimulationMode } from '../types/circuit';
import { ComponentRegistry } from '../registry/ComponentRegistry';
import { COMPONENT_DEFINITIONS } from '../constants/componentLibrary';

export interface WireFlowVisualResult {
  hasFlow: boolean;
  flowColor: string;
  flowDirection: 1 | -1;
  isProblematic: boolean;
  isShortCircuit: boolean;
  effectiveVoltage: number;
  effectiveCurrent: number;
}

// Active electricity timestamp map to bridge AC zero-crossings and prevent dash stutter
const wireLastActiveTimestamp = new Map<string, number>();

export function resetWireFlowEngineState(): void {
  wireLastActiveTimestamp.clear();
}

/**
 * Universally checks if a switch/fuse contact is OPEN.
 */
export function isComponentSwitchContactOpen(
  comp: CircuitComponent | undefined,
  pinId: string
): boolean {
  if (!comp) return false;
  const props = comp.properties || {};
  const state = comp.state || {};
  const pLower = (pinId || '').trim().toLowerCase();

  if (comp.type === 'pushbutton') {
    return !Boolean(state.isPressed || props.isPressed);
  }
  if (comp.type === 'builtin_spst_switch' || comp.type === 'builtin_switch_spst') {
    return !Boolean(props.closed ?? state.closed);
  }
  if (comp.type === 'toggle-switch') {
    const isT1 = props.state !== 'T2';
    if (pLower === 't1') return !isT1;
    if (pLower === 't2') return isT1;
    return false;
  }
  if (comp.type === 'builtin_dip_switch_4') {
    for (let i = 1; i <= 4; i++) {
      if (pLower === `in${i}` || pLower === `out${i}`) {
        return props[`sw${i}`] !== true;
      }
    }
  }
  if (comp.type === 'relay' || comp.type === 'builtin_relay') {
    const isEngaged = Boolean(state.isEnergized || state.isActive);
    if (pLower === 'no') return !isEngaged;
    if (pLower === 'nc') return isEngaged;
    return false;
  }
  if (comp.type === 'fuse' || comp.type === 'builtin_fuse') {
    return Boolean(state.isBurned || state.isBlown || props.isBlown);
  }
  return false;
}

/**
 * 1. Positive Start Terminals (sourceDist = 0):
 * VCC, 5V, 3V3, Battery (+), DC Source (+), AC Source (~ line / +),
 * Bridge Rectifier (DC+), Solar (+), Regulators & DC-DC Converter (OUT / VOUT+),
 * Logic Gate outputs, 555 OUT, Sensor OUT, MCU supply/GPIO driver pins.
 */
export function isPositiveStartTerminal(
  comp: CircuitComponent | undefined,
  pinId: string
): boolean {
  if (!comp) return false;
  const pLower = (pinId || '').trim().toLowerCase();
  const cType = comp.type;

  // 1. Dedicated VCC rails
  if (cType === 'vcc' || cType === 'builtin_vcc') return true;

  // 2. DC / Battery / Solar positive terminals
  if (
    ['dc-source', 'battery-9v', 'coin-cell', 'builtin_solar_panel'].includes(cType) &&
    ['pos', '+', 'p1', 'vcc'].includes(pLower)
  ) {
    return true;
  }

  // 3. AC Source positive / line terminal
  if (cType === 'ac-source' && ['pos', '~ line', 'p1', 'pin1'].includes(pLower)) {
    return true;
  }

  // 4. Bridge Rectifier DC+ output
  if (cType === 'builtin_bridge_rectifier' && ['dc_plus', 'dc+', 'dc_pos'].includes(pLower)) {
    return true;
  }

  // 5. Voltage Regulators & DC-DC Converters
  if (
    ['builtin_reg_7805', 'lm7805', 'voltage-regulator-7805'].includes(cType) &&
    ['out', 'vout', 'output'].includes(pLower)
  ) {
    return true;
  }
  if (
    ['builtin_dcdc_converter', 'dcdc-converter'].includes(cType) &&
    ['vout_plus', 'vout+'].includes(pLower)
  ) {
    return true;
  }

  // 6. Logic Gates & 555 Timers
  if (cType.startsWith('gate-') && ['out', 'output'].includes(pLower)) return true;
  if (['ic-555', 'builtin_555', 'timer-555'].includes(cType) && ['out', 'pin3', 'pin3_out'].includes(pLower)) return true;
  if (['builtin_comparator', 'builtin_opamp'].includes(cType) && ['out', 'output'].includes(pLower)) return true;

  // 7. Sequential Logic ICs & Flip-Flops
  if (
    [
      'builtin_shift_register',
      'builtin_counter_4bit',
      'builtin_bcd_decoder',
      'builtin_mux_4to1',
      'builtin_d_flipflop',
      'builtin_jk_flipflop',
    ].includes(cType) &&
    (pLower.startsWith('q') || pLower === 'y' || pLower === 'out' || pLower === 'nq')
  ) {
    return true;
  }

  // 8. Active Sensors & Radio Receivers
  if (
    ['builtin_soil_moisture', 'builtin_hall_sensor', 'builtin_vibration_sensor', 'builtin_ir_rx'].includes(cType) &&
    pLower === 'out'
  ) {
    return true;
  }
  if (cType === 'builtin_rf_radio' && pLower === 'rx') return true;

  // 9. MCU supply and digital driver pins
  if (['arduino-uno', 'esp32', 'pico', 'builtin_cpu_8bit', 'cpu-8bit'].includes(cType)) {
    if (['5v', '3v3', '3.3v', 'vbus', 'vsys', 'ioref'].includes(pLower)) return true;
  }

  return false;
}

/**
 * 2. Final Return Destinations (gndDist = 0 - "All Return Roads Lead Here"):
 * GND symbol (builtin_ground / gnd), DC Source / Battery (-), AC Source (- / ~ neutral),
 * Bridge Rectifier (DC-) and AC inputs (for AC return), DC-DC Converter (VOUT- / VIN-),
 * Regulator (GND), MCU / IC ground pins.
 *
 * CRITICAL: Passive Capacitors (C1) and Inductors are NEVER seeded as return destinations.
 */
export function isNegativeReturnDestination(
  comp: CircuitComponent | undefined,
  pinId: string
): boolean {
  if (!comp) return false;
  const pLower = (pinId || '').trim().toLowerCase();
  const cType = comp.type;

  // 1. Dedicated Ground Symbols
  if (['gnd', 'builtin_gnd', 'builtin_ground'].includes(cType)) return true;

  // 2. Power Sources Negative Terminals
  if (
    ['dc-source', 'battery-9v', 'coin-cell', 'builtin_solar_panel'].includes(cType) &&
    ['neg', '-', 'p2'].includes(pLower)
  ) {
    return true;
  }
  if (cType === 'ac-source' && ['neg', '~ neutral', 'p2', 'pin2'].includes(pLower)) {
    return true;
  }

  // 3. Bridge Rectifier DC- return
  if (cType === 'builtin_bridge_rectifier') {
    if (['dc_minus', 'dc-', 'dc_neg'].includes(pLower)) return true;
  }

  // 4. DC-DC Converters & Voltage Regulators Return
  if (
    ['builtin_dcdc_converter', 'dcdc-converter'].includes(cType) &&
    ['vout_minus', 'vin_minus', 'vout-', 'vin-'].includes(pLower)
  ) {
    return true;
  }
  if (
    ['builtin_reg_7805', 'lm7805', 'voltage-regulator-7805'].includes(cType) &&
    ['gnd', 'ground'].includes(pLower)
  ) {
    return true;
  }

  // 5. MCU Ground Pins
  if (
    ['arduino-uno', 'esp32', 'pico', 'builtin_cpu_8bit', 'cpu-8bit'].includes(cType) &&
    pLower.includes('gnd')
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if a component is a closed switch contact connecting its terminals.
 */
function getClosedSwitchTerminalPairs(comp: CircuitComponent): Array<[string, string]> {
  const type = comp.type;
  const props = comp.properties || {};
  const state = comp.state || {};

  if (type === 'pushbutton') {
    const isPressed = Boolean(state.isPressed || props.isPressed);
    return isPressed ? [['p1', 'p2'], ['pin1', 'pin2']] : [];
  }
  if (type === 'builtin_spst_switch' || type === 'builtin_switch_spst') {
    const isClosed = Boolean(props.closed ?? state.closed);
    return isClosed ? [['p1', 'p2'], ['com', 'p2']] : [];
  }
  if (type === 'toggle-switch') {
    const isT1 = props.state !== 'T2';
    const activePin = isT1 ? 't1' : 't2';
    return [['com', activePin]];
  }
  if (type === 'builtin_dip_switch_4') {
    const pairs: Array<[string, string]> = [];
    for (let i = 1; i <= 4; i++) {
      if (props[`sw${i}`] === true) {
        pairs.push([`in${i}`, `out${i}`]);
      }
    }
    return pairs;
  }
  if (type === 'relay' || type === 'builtin_relay') {
    const isEngaged = Boolean(state.isEnergized || state.isActive);
    return [['com', isEngaged ? 'no' : 'nc']];
  }
  if (type === 'fuse' || type === 'builtin_fuse') {
    const isBlown = Boolean(state.isBurned || state.isBlown || props.isBlown);
    return isBlown ? [] : [['p1', 'p2']];
  }
  return [];
}

/**
 * Computes all component pins energized by active power sources OR charged capacitors (C >= 1uF, V >= 0.05V).
 * Traverses closed circuit paths; open switches / blown fuses block propagation across their contacts.
 * Bridge Rectifiers and capacitors are never treated as open switches.
 */
export function computeEnergizedPins(
  components: CircuitComponent[],
  wires: CircuitWire[]
): Set<string> {
  const energized = new Set<string>();
  const graph = new Map<string, Set<string>>();

  const addEdge = (u: string, v: string) => {
    if (u === v) return;
    if (!graph.has(u)) graph.set(u, new Set());
    if (!graph.has(v)) graph.set(v, new Set());
    graph.get(u)!.add(v);
    graph.get(v)!.add(u);
  };

  // 1. Wires connect pin to pin bidirectionally
  for (const w of wires) {
    const u = `${w.fromCompId}:${w.fromPinId.toLowerCase()}`;
    const v = `${w.toCompId}:${w.toPinId.toLowerCase()}`;
    addEdge(u, v);
  }

  // 2. Components provide internal pin-to-pin connections
  for (const c of components) {
    const props = c.properties || {};
    const state = c.state || {};
    const type = c.type;

    // Switches / Fuses: only connect contacts if CLOSED
    const closedPairs = getClosedSwitchTerminalPairs(c);
    if (closedPairs.length > 0) {
      for (const [p1, p2] of closedPairs) {
        addEdge(`${c.id}:${p1.toLowerCase()}`, `${c.id}:${p2.toLowerCase()}`);
      }
      continue;
    }
    if (
      [
        'pushbutton',
        'builtin_spst_switch',
        'builtin_switch_spst',
        'toggle-switch',
        'builtin_dip_switch_4',
        'fuse',
        'builtin_fuse',
      ].includes(type)
    ) {
      continue; // Open switch contacts don't conduct
    }

    // Capacitors: conduct internally AND act as energy source if charged (C >= 1uF, V >= 0.05V)
    if (type === 'capacitor-electrolytic' || type === 'capacitor-ceramic') {
      addEdge(`${c.id}:pos`, `${c.id}:neg`);
      addEdge(`${c.id}:p1`, `${c.id}:p2`);
      addEdge(`${c.id}:+`, `${c.id}:-`);
      const capFarad = typeof props.capacitance === 'number'
        ? props.capacitance * 1e-6
        : (type === 'capacitor-ceramic' ? 0.1e-6 : 10e-6);
      const vCap = Math.abs(state.voltageDropV ?? state.voltage ?? 0);
      if (capFarad >= 1e-6 && vCap >= 0.05) {
        energized.add(`${c.id}:pos`);
        energized.add(`${c.id}:neg`);
        energized.add(`${c.id}:p1`);
        energized.add(`${c.id}:p2`);
      }
      continue;
    }

    // Bridge Rectifier: 4 diodes conduct
    if (type === 'builtin_bridge_rectifier') {
      addEdge(`${c.id}:ac1`, `${c.id}:dc_plus`);
      addEdge(`${c.id}:ac2`, `${c.id}:dc_plus`);
      addEdge(`${c.id}:dc_minus`, `${c.id}:ac1`);
      addEdge(`${c.id}:dc_minus`, `${c.id}:ac2`);
      continue;
    }

    // Diodes, LEDs, IR TX, Zener
    if (
      [
        'diode',
        'diode-1n4148',
        'diode-1n4007',
        'zener-diode',
        'builtin_zener',
        'led',
        'led-red',
        'led-green',
        'led-blue',
        'led-yellow',
        'builtin_led',
        'builtin_ir_tx',
      ].includes(type)
    ) {
      addEdge(`${c.id}:anode`, `${c.id}:cathode`);
      addEdge(`${c.id}:pos`, `${c.id}:neg`);
      addEdge(`${c.id}:p1`, `${c.id}:p2`);
      addEdge(`${c.id}:+`, `${c.id}:-`);
      continue;
    }

    // 2-terminal passives, loads, sensors, actuators
    const def = ComponentRegistry.getComponentDefinition(type) || COMPONENT_DEFINITIONS[type];
    if (def?.pins && def.pins.length >= 2) {
      for (let i = 0; i < def.pins.length - 1; i++) {
        addEdge(`${c.id}:${def.pins[i].id.toLowerCase()}`, `${c.id}:${def.pins[i + 1].id.toLowerCase()}`);
      }
    }
  }

  // 3. Collect active power source seed pins
  for (const c of components) {
    const def = ComponentRegistry.getComponentDefinition(c.type) || COMPONENT_DEFINITIONS[c.type];
    if (!def?.pins) continue;
    for (const p of def.pins) {
      const pKey = `${c.id}:${p.id.toLowerCase()}`;
      if (isPositiveStartTerminal(c, p.id)) {
        energized.add(pKey);
      }
    }
  }

  // 4. BFS graph traversal from energized seeds
  const queue = [...energized];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const neighbors = graph.get(curr);
    if (!neighbors) continue;
    for (const next of neighbors) {
      if (!energized.has(next)) {
        energized.add(next);
        queue.push(next);
      }
    }
  }

  return energized;
}

/**
 * Computes deterministic topological Pin Ranks across the circuit.
 * Depends ONLY on circuit topology (never on oscillating voltages, and never on drawing order).
 *
 * Rules:
 * 1. Return / Ground Nets (touching GND, Battery -, AC Source -, Bridge Rectifier DC-, Converter VOUT-/VIN-, MCU GND):
 *    - Wire-only BFS along that net starting from Return Sink Pin(s): hopsToReturn = 0 at sink.
 *    - pinRank = -hopsToReturn (e.g. LED1- = -2, C1- = -1, BR1 DC- = 0).
 *    - Flow moves toward 0: lower pinRank -> higher pinRank!
 *
 * 2. Positive Supply & Signal Nets (NOT touching a return sink):
 *    - Identify Driver Pin(s):
 *      - Primary sources: VCC, Battery +, AC Source +, BR1 DC+, Solar +, Regulators, Converters, Gate/MCU/Sensor OUT.
 *      - For intermediate series nets: pin belonging to upstream component (smaller srcDist, ignoring parallel capacitors).
 *    - Wire-only BFS along that net starting from Driver Pin(s): hopsFromDriver = 0 at driver.
 *    - pinRank = hopsFromDriver (e.g. BR1 DC+ = 0, C1+ = 1, R2 p1 = 2).
 *    - Flow moves away from driver: lower pinRank -> higher pinRank!
 */
export function computePinRanks(
  components: CircuitComponent[],
  wires: CircuitWire[]
): Map<string, number> {
  const pinRank = new Map<string, number>();

  // 1. Build Undirected Wire Net Graph (Net Connectivity via Wires and Closed Switches)
  const wireNetAdj = new Map<string, Set<string>>();
  const addWireEdge = (u: string, v: string) => {
    if (u === v) return;
    if (!wireNetAdj.has(u)) wireNetAdj.set(u, new Set());
    if (!wireNetAdj.has(v)) wireNetAdj.set(v, new Set());
    wireNetAdj.get(u)!.add(v);
    wireNetAdj.get(v)!.add(u);
  };

  for (const w of wires) {
    const u = `${w.fromCompId}:${w.fromPinId.toLowerCase()}`;
    const v = `${w.toCompId}:${w.toPinId.toLowerCase()}`;
    addWireEdge(u, v);
  }

  for (const c of components) {
    const closedPairs = getClosedSwitchTerminalPairs(c);
    for (const [p1, p2] of closedPairs) {
      addWireEdge(`${c.id}:${p1.toLowerCase()}`, `${c.id}:${p2.toLowerCase()}`);
    }
  }

  // 2. Compute Global Conduction Distance from Primary + Sources (srcDist)
  // Used to identify the upstream driver pin for intermediate series nets
  const forwardGraph = new Map<string, Array<{ to: string; weight: number }>>();
  const addForwardEdge = (u: string, v: string, weight: number, bidirectional = false) => {
    if (u === v) return;
    if (!forwardGraph.has(u)) forwardGraph.set(u, []);
    forwardGraph.get(u)!.push({ to: v, weight });
    if (bidirectional) {
      if (!forwardGraph.has(v)) forwardGraph.set(v, []);
      forwardGraph.get(v)!.push({ to: u, weight });
    }
  };

  for (const w of wires) {
    const u = `${w.fromCompId}:${w.fromPinId.toLowerCase()}`;
    const v = `${w.toCompId}:${w.toPinId.toLowerCase()}`;
    addForwardEdge(u, v, 1, true);
  }

  for (const c of components) {
    const closedPairs = getClosedSwitchTerminalPairs(c);
    for (const [p1, p2] of closedPairs) {
      addForwardEdge(`${c.id}:${p1.toLowerCase()}`, `${c.id}:${p2.toLowerCase()}`, 1, true);
    }

    const type = c.type;
    // 2-terminal passives, loads, sensors, actuators (weight 10)
    if (
      [
        'resistor',
        'builtin_resistor',
        'photoresistor',
        'builtin_photoresistor',
        'thermistor',
        'builtin_thermistor',
        'potentiometer',
        'builtin_potentiometer',
        'inductor',
        'builtin_inductor',
        'builtin_filament_bulb',
        'buzzer',
        'dc-motor',
        'builtin_dc_motor',
        'dc-fan',
        'builtin_water_pump',
        'builtin_solenoid',
        'builtin_speaker',
      ].includes(type)
    ) {
      const def = ComponentRegistry.getComponentDefinition(type) || COMPONENT_DEFINITIONS[type];
      if (def?.pins && def.pins.length >= 2) {
        for (let i = 0; i < def.pins.length - 1; i++) {
          addForwardEdge(
            `${c.id}:${def.pins[i].id.toLowerCase()}`,
            `${c.id}:${def.pins[i + 1].id.toLowerCase()}`,
            10,
            true
          );
        }
      }
      continue;
    }

    // Polarized loads & Diodes (Strictly Anode -> Cathode, weight 10, ONE-WAY!)
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
        'zener-diode',
        'builtin_zener',
      ].includes(type)
    ) {
      addForwardEdge(`${c.id}:anode`, `${c.id}:cathode`, 10, false);
      addForwardEdge(`${c.id}:pos`, `${c.id}:neg`, 10, false);
      addForwardEdge(`${c.id}:p1`, `${c.id}:p2`, 10, false);
      addForwardEdge(`${c.id}:+`, `${c.id}:-`, 10, false);
      continue;
    }

    // Bridge Rectifier: AC inputs to DC+, and DC- to AC inputs
    if (type === 'builtin_bridge_rectifier') {
      addForwardEdge(`${c.id}:ac1`, `${c.id}:dc_plus`, 10, false);
      addForwardEdge(`${c.id}:ac2`, `${c.id}:dc_plus`, 10, false);
      addForwardEdge(`${c.id}:dc_minus`, `${c.id}:ac1`, 10, false);
      addForwardEdge(`${c.id}:dc_minus`, `${c.id}:ac2`, 10, false);
      continue;
    }

    // Traffic Light
    if (type === 'builtin_traffic_light') {
      addForwardEdge(`${c.id}:red`, `${c.id}:gnd`, 10, false);
      addForwardEdge(`${c.id}:yellow`, `${c.id}:gnd`, 10, false);
      addForwardEdge(`${c.id}:green`, `${c.id}:gnd`, 10, false);
      continue;
    }

    // NOTE: Capacitors are strictly NOT connected internally in forwardGraph!
  }

  const srcDist = new Map<string, number>();
  const pq: Array<{ node: string; d: number }> = [];

  for (const c of components) {
    const def = ComponentRegistry.getComponentDefinition(c.type) || COMPONENT_DEFINITIONS[c.type];
    if (!def?.pins) continue;
    for (const p of def.pins) {
      if (isPositiveStartTerminal(c, p.id)) {
        const key = `${c.id}:${p.id.toLowerCase()}`;
        srcDist.set(key, 0);
        pq.push({ node: key, d: 0 });
      }
    }
  }

  while (pq.length > 0) {
    pq.sort((a, b) => a.d - b.d);
    const { node: curr, d } = pq.shift()!;
    if (d > (srcDist.get(curr) ?? Infinity)) continue;

    for (const edge of forwardGraph.get(curr) || []) {
      const newD = d + edge.weight;
      if (newD < (srcDist.get(edge.to) ?? Infinity)) {
        srcDist.set(edge.to, newD);
        pq.push({ node: edge.to, d: newD });
      }
    }
  }

  // 3. Partition all Pins into Wire Nets (Connected Components of wireNetAdj)
  const visited = new Set<string>();
  const allPins = new Set<string>();
  for (const [pin] of wireNetAdj) allPins.add(pin);
  for (const w of wires) {
    allPins.add(`${w.fromCompId}:${w.fromPinId.toLowerCase()}`);
    allPins.add(`${w.toCompId}:${w.toPinId.toLowerCase()}`);
  }

  const compMap = new Map<string, CircuitComponent>();
  for (const c of components) compMap.set(c.id, c);

  for (const startPin of allPins) {
    if (visited.has(startPin)) continue;
    const netPins = new Set<string>();
    const q: string[] = [startPin];
    visited.add(startPin);

    while (q.length > 0) {
      const curr = q.shift()!;
      netPins.add(curr);
      for (const neighbor of wireNetAdj.get(curr) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          q.push(neighbor);
        }
      }
    }

    // 4. Determine if Net is a Return Net or Positive / Signal Net
    const returnSinks: string[] = [];
    for (const pKey of netPins) {
      const colonIdx = pKey.indexOf(':');
      const cId = pKey.substring(0, colonIdx);
      const pId = pKey.substring(colonIdx + 1);
      const comp = compMap.get(cId);
      if (isNegativeReturnDestination(comp, pId)) {
        returnSinks.push(pKey);
      }
    }

    if (returnSinks.length > 0) {
      // -------------------------------------------------------------
      // Case 1: Return Net
      // BFS from Return Sink(s) (hopsToReturn = 0)
      // pinRank = -hopsToReturn
      // -------------------------------------------------------------
      const hopsToReturn = new Map<string, number>();
      const bq: string[] = [];
      for (const sink of returnSinks) {
        hopsToReturn.set(sink, 0);
        bq.push(sink);
      }

      while (bq.length > 0) {
        const curr = bq.shift()!;
        const currHops = hopsToReturn.get(curr)!;
        for (const neighbor of wireNetAdj.get(curr) || []) {
          if (!hopsToReturn.has(neighbor)) {
            hopsToReturn.set(neighbor, currHops + 1);
            bq.push(neighbor);
          }
        }
      }

      for (const pKey of netPins) {
        const h = hopsToReturn.get(pKey) ?? 0;
        pinRank.set(pKey, -h);
      }
    } else {
      // -------------------------------------------------------------
      // Case 2: Positive Supply / Signal / Intermediate Net
      // Find Driver Pin(s):
      // 1. Check primary sources on net
      // 2. Otherwise pick pin with smallest srcDist
      // -------------------------------------------------------------
      const primaryDrivers: string[] = [];
      for (const pKey of netPins) {
        const colonIdx = pKey.indexOf(':');
        const cId = pKey.substring(0, colonIdx);
        const pId = pKey.substring(colonIdx + 1);
        const comp = compMap.get(cId);
        if (isPositiveStartTerminal(comp, pId)) {
          primaryDrivers.push(pKey);
        }
      }

      let drivers: string[] = [];
      if (primaryDrivers.length > 0) {
        drivers = primaryDrivers;
      } else {
        let minDist = Infinity;
        for (const pKey of netPins) {
          const d = srcDist.get(pKey) ?? Infinity;
          if (d < minDist) {
            minDist = d;
          }
        }
        for (const pKey of netPins) {
          if ((srcDist.get(pKey) ?? Infinity) === minDist) {
            drivers.push(pKey);
          }
        }
        if (drivers.length === 0) {
          drivers = [startPin];
        }
      }

      const hopsFromDriver = new Map<string, number>();
      const bq: string[] = [];
      for (const driver of drivers) {
        hopsFromDriver.set(driver, 0);
        bq.push(driver);
      }

      while (bq.length > 0) {
        const curr = bq.shift()!;
        const currHops = hopsFromDriver.get(curr)!;
        for (const neighbor of wireNetAdj.get(curr) || []) {
          if (!hopsFromDriver.has(neighbor)) {
            hopsFromDriver.set(neighbor, currHops + 1);
            bq.push(neighbor);
          }
        }
      }

      for (const pKey of netPins) {
        const h = hopsFromDriver.get(pKey) ?? 0;
        pinRank.set(pKey, h);
      }
    }
  }

  return pinRank;
}

/**
 * 1. Topological Wire Flow Direction Field
 * Computes deterministic flow direction for every wire based on Pin Rank:
 * Flow ALWAYS moves from the pin with smaller pinRank to the pin with larger pinRank.
 *
 *  1 = fromComp -> toComp (rankA <= rankB)
 * -1 = toComp -> fromComp (rankA > rankB)
 *
 * 100% constant across AC cycles, capacitor ripple, and drawing order!
 */
export function computeFlowDirectionField(
  components: CircuitComponent[],
  wires: CircuitWire[],
  _mode: SimulationMode = 'ANALOG',
  _solvedState?: any
): Map<string, 1 | -1> {
  const result = new Map<string, 1 | -1>();
  const pinRank = computePinRanks(components, wires);

  for (const wire of wires) {
    const pinA = `${wire.fromCompId}:${wire.fromPinId.toLowerCase()}`;
    const pinB = `${wire.toCompId}:${wire.toPinId.toLowerCase()}`;

    const rankA = pinRank.get(pinA) ?? 0;
    const rankB = pinRank.get(pinB) ?? 0;

    if (rankA < rankB) {
      result.set(wire.id, 1);
    } else if (rankA > rankB) {
      result.set(wire.id, -1);
    } else {
      // Deterministic tie-breaker for odd loops or symmetric branches
      result.set(wire.id, pinA <= pinB ? 1 : -1);
    }
  }

  return result;
}

/**
 * 2. Compute Logical Wire Flow
 * In LOGICAL mode:
 * - High (1) logic level produces Blue animated electricity flow (#3b82f6 / #60a5fa).
 * - Low (0) or High-Impedance ('Z') logic level is 100% static.
 * - Logic contention ('X') highlights wire red.
 */
export function computeLogicalWireFlow(
  wire: CircuitWire,
  _fromComp?: CircuitComponent,
  _toComp?: CircuitComponent,
  wireState?: any,
  _compStates?: Map<string, any>,
  directionField?: Map<string, 1 | -1>
): WireFlowVisualResult {
  const logicLevel = wireState?.logicLevel ?? wire.state?.logicLevel;
  const isShortCircuit = logicLevel === 'X';
  const hasFlow = !isShortCircuit && logicLevel === 1;

  const flowDirection: 1 | -1 = directionField?.get(wire.id) ?? 1;

  return {
    hasFlow,
    flowColor: isShortCircuit ? '#ef4444' : hasFlow ? '#3b82f6' : wire.color,
    flowDirection,
    isProblematic: isShortCircuit,
    isShortCircuit,
    effectiveVoltage: hasFlow ? 5.0 : 0.0,
    effectiveCurrent: hasFlow ? 0.01 : 0.0,
  };
}

/**
 * 3. Compute Analog Wire Flow
 * In ANALOG mode:
 * - Checks live voltage (>= 0.05V) OR branch current (>= 10 uA).
 * - Evaluates open-switch isolation: wires downstream of an open switch do NOT animate
 *   unless they have an active charged capacitor (C >= 1uF) holding charge.
 * - Live source wire connected directly to the open switch terminal (e.g. VCC -> SW1) ALWAYS animates.
 * - Anti-stuttering: bridges AC sine zero-crossings & diode reverse-bias troughs via a 65ms hold window
 *   so CSS dash animation glides smoothly without hitching or resetting.
 * - Animates Warm Yellow (#fbbf24 / #fde047) at calm, steady speed.
 */
export function computeAnalogWireFlow(
  wire: CircuitWire,
  fromComp: CircuitComponent | undefined,
  toComp: CircuitComponent | undefined,
  wireVoltage: number | undefined,
  wireCurrent: number | undefined,
  components: CircuitComponent[],
  wires: CircuitWire[],
  isSimRunning: boolean = true,
  precomputedEnergizedPins?: Set<string>,
  precomputedDirectionField?: Map<string, 1 | -1>,
  simTimeMs?: number
): WireFlowVisualResult {
  const wireCurrentA = isSimRunning ? Math.abs(wireCurrent ?? wire.state?.current ?? 0) : 0;
  const rawWireVoltage = wireVoltage ?? wire.state?.voltage ?? 0.0;
  const logicLevel = wire.state?.logicLevel;

  // Short-circuit / Overloaded component detection
  const endpointOverloaded = Boolean(
    (fromComp?.state?.isBurned ||
      fromComp?.state?.isOverloaded ||
      toComp?.state?.isBurned ||
      toComp?.state?.isOverloaded) &&
      wireCurrentA > 0.025
  );

  const isShortCircuit = Boolean(
    isSimRunning &&
      (logicLevel === 'X' ||
        endpointOverloaded ||
        (wireCurrentA > 1.5 && Math.abs(rawWireVoltage) < 0.5))
  );
  const isProblematic = isShortCircuit;

  // 1. Direct power source output connection: VCC1 -> SW1 terminal is live!
  const isDirectlyConnectedToSource =
    isPositiveStartTerminal(fromComp, wire.fromPinId) ||
    isPositiveStartTerminal(toComp, wire.toPinId);

  // 2. Reachability from any active source or charged capacitor (C >= 1uF)
  const energizedPins =
    precomputedEnergizedPins ?? computeEnergizedPins(components, wires);

  const fromKey = `${wire.fromCompId}:${wire.fromPinId.toLowerCase()}`;
  const toKey = `${wire.toCompId}:${wire.toPinId.toLowerCase()}`;
  const isWireEnergized =
    isDirectlyConnectedToSource ||
    energizedPins.has(fromKey) ||
    energizedPins.has(toKey);

  // If disconnected from power sources and without stored capacitor charge, suppress voltage to 0V
  const effectiveVoltage = isWireEnergized ? rawWireVoltage : 0.0;

  // Branch current inheritance for series circuits
  const getCompPinBranchCurrent = (comp: CircuitComponent | undefined, pinId: string): number => {
    if (!comp) return 0;
    const cType = comp.type;
    const pLower = (pinId || '').trim().toLowerCase();

    if (['vcc', 'builtin_vcc', 'gnd', 'builtin_gnd', 'builtin_ground'].includes(cType)) {
      return 0;
    }
    if (
      [
        'builtin_ir_rx',
        'builtin_soil_moisture',
        'builtin_hall_sensor',
        'builtin_vibration_sensor',
        'builtin_rf_radio',
      ].includes(cType)
    ) {
      if (['gnd', 'ground'].includes(pLower)) {
        const outV = comp.state?.outputVoltage ?? comp.state?.pinVoltages?.['out'] ?? 0;
        const isConducting = Boolean(comp.state?.isReceivingIr || outV >= 2.0);
        return isConducting ? Math.abs(comp.state?.currentA ?? 0) : 0;
      }
      if (['out', 'rx'].includes(pLower)) {
        return Math.abs(comp.state?.currentA ?? 0);
      }
      return 0;
    }
    return Math.abs(comp.state?.currentA ?? 0);
  };

  const fromCompI = getCompPinBranchCurrent(fromComp, wire.fromPinId);
  const toCompI = getCompPinBranchCurrent(toComp, wire.toPinId);
  const effectiveCurrent = isWireEnergized
    ? Math.max(wireCurrentA, fromCompI, toCompI)
    : 0.0;

  // Instantaneous activity check:
  // Active Voltage above noise floor: |V| >= 0.05V (50 mV)
  // Active Current above leakage floor: |I| >= 10 uA (0.01 mA)
  const isInstantActive = Math.abs(effectiveVoltage) >= 0.05 || effectiveCurrent >= 0.00001;

  // Anti-stutter: Hold active state across AC zero-crossings (65ms hold window ~3 half-cycles of 50Hz)
  const now = typeof simTimeMs === 'number' ? simTimeMs : Date.now();
  if (isInstantActive && isWireEnergized && isSimRunning) {
    wireLastActiveTimestamp.set(wire.id, now);
  }

  const lastActiveTime = wireLastActiveTimestamp.get(wire.id) ?? 0;
  const isWithinZeroCrossingHold = isSimRunning && isWireEnergized && (now - lastActiveTime < 65);

  const hasFlow =
    isSimRunning &&
    !isProblematic &&
    isWireEnergized &&
    (isInstantActive || isWithinZeroCrossingHold);

  const flowDirection: 1 | -1 = precomputedDirectionField?.get(wire.id) ?? 1;

  const flowColor = isShortCircuit
    ? '#ef4444'
    : hasFlow
    ? '#fbbf24'
    : wire.color;

  return {
    hasFlow,
    flowColor,
    flowDirection,
    isProblematic,
    isShortCircuit,
    effectiveVoltage,
    effectiveCurrent,
  };
}
