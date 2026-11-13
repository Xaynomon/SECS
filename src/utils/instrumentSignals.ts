import { CircuitComponent, CircuitWire, SimulationMode } from '../types/circuit';
import { ProbeTarget, ScopeTelemetry } from '../types/instruments';
import { buildNetlistNets } from '../simulation/logical/NetlistGraph';
import { evaluateLogicalCircuit } from '../simulation/logical/LogicalEngine';
import { evaluateSpiceCircuit } from '../simulation/spice/SpiceEngine';
import { getRectifierDcReferenceOffset } from './circuitFlow';

/**
 * Resolves the real-time electrical voltage (in Volts) at the given probe target,
 * with automatic differential referencing for floating DC rectifier loads.
 */
export function getProbeVoltage(
  target: ProbeTarget | null,
  components: CircuitComponent[],
  wires: CircuitWire[],
  simMode?: SimulationMode
): number {
  if (!target) return 0.0;
  const rawV = getRawProbeVoltage(target, components, wires, simMode);
  const offset = getRectifierDcReferenceOffset(target, components, wires, (cId, pId) => {
    const c = components.find((item) => item.id === cId);
    return c?.state?.pinVoltages?.[pId] ?? c?.state?.pinVoltages?.[pId.toLowerCase()];
  });
  return rawV - offset;
}

function getRawProbeVoltage(
  target: ProbeTarget | null,
  components: CircuitComponent[],
  wires: CircuitWire[],
  _simMode?: SimulationMode
): number {
  if (!target) return 0.0;

  if (target.type === 'wire' && target.wireId) {
    const wire = wires.find((w) => w.id === target.wireId);
    if (!wire) return 0.0;
    if (typeof wire.state?.voltage === 'number') {
      return wire.state.voltage;
    }
    if (wire.state?.logicLevel === 1) return 5.0;
    if (wire.state?.logicLevel === 0) return 0.0;
    return 0.0;
  }

  if (target.type === 'pin' && target.compId && target.pinId) {
    const comp = components.find((c) => c.id === target.compId);
    if (!comp) return 0.0;

    // 1. Direct pin voltage recorded by SPICE engine
    if (comp.state?.pinVoltages && typeof comp.state.pinVoltages[target.pinId] === 'number') {
      return comp.state.pinVoltages[target.pinId];
    }

    // 2. Microcontroller GPIO state
    if (comp.state?.pins) {
      const pNorm = target.pinId.toLowerCase().replace(/^~/, '');
      const candidates = [
        target.pinId,
        pNorm,
        pNorm.startsWith('d') ? pNorm.substring(1) : `d${pNorm}`,
        pNorm.startsWith('gp') ? pNorm.substring(2) : `gp${pNorm}`,
      ];
      let pinState: any = null;
      for (const cand of candidates) {
        if (comp.state.pins[cand]) {
          pinState = comp.state.pins[cand];
          break;
        }
      }
      if (!pinState) {
        const found = Object.keys(comp.state.pins).find((k) => k.toLowerCase() === pNorm);
        if (found) pinState = comp.state.pins[found];
      }

      if (pinState) {
        const highVoltage = comp.type === 'esp32' || comp.type === 'pico' ? 3.3 : 5.0;
        const isHigh = pinState.digitalValue === 1 || pinState.value === 1 || (pinState.voltage ?? 0) >= 2.0;
        if (isHigh) return highVoltage;
        if (pinState.mode === 'OUTPUT') return 0.0;
      }
    }

    // 3. Digital Logic output level
    if (comp.state?.pinSignals && comp.state.pinSignals[target.pinId] !== undefined) {
      const lvl = comp.state.pinSignals[target.pinId];
      if (lvl === 1) return 5.0;
      if (lvl === 0) return 0.0;
    }

    if (comp.state?.outputVoltage !== undefined && target.pinId === 'out') {
      return comp.state.outputVoltage;
    }

    // 4. Check connected wires to this pin
    const connectedWire = wires.find(
      (w) =>
        (w.fromCompId === comp.id && w.fromPinId === target.pinId) ||
        (w.toCompId === comp.id && w.toPinId === target.pinId)
    );
    if (connectedWire) {
      if (typeof connectedWire.state?.voltage === 'number') {
        return connectedWire.state.voltage;
      }
      if (connectedWire.state?.logicLevel === 1) return 5.0;
      if (connectedWire.state?.logicLevel === 0) return 0.0;
    }

    // 5. Default power pins
    if (comp.type === 'dc-source' || comp.type === 'battery-9v' || comp.type === 'coin-cell') {
      const vVal = comp.properties?.voltage || (comp.type === 'battery-9v' ? 9.0 : 3.0);
      if (target.pinId === 'pos' || target.pinId === '+' || target.pinId === 'p1') return vVal;
      if (target.pinId === 'neg' || target.pinId === '-' || target.pinId === 'p2') return 0.0;
    }

    if (comp.type === 'gnd') return 0.0;

    if (comp.type === 'ac-source') {
      const vPeak = typeof comp.properties?.amplitude === 'number' ? comp.properties.amplitude : 12;
      const freq = typeof comp.properties?.frequency === 'number' ? comp.properties.frequency : 50;
      const phase = typeof comp.properties?.phase === 'number' ? comp.properties.phase : 0;
      const offset = typeof comp.properties?.offset === 'number' ? comp.properties.offset : 0;
      const dutyCycle = typeof comp.properties?.dutyCycle === 'number' ? comp.properties.dutyCycle / 100 : 0.5;
      const waveform = (comp.properties?.waveform as string) || 'sine';
      const tSec = performance.now() / 1000;
      const phaseRad = (phase * Math.PI) / 180;
      const phiCycles = phase / 360;

      let vWave = 0;
      switch (waveform) {
        case 'square': {
          const cycleProgress = ((freq * tSec + phiCycles) % 1 + 1) % 1;
          vWave = cycleProgress < dutyCycle ? vPeak : -vPeak;
          break;
        }
        case 'triangle': {
          const angle = 2 * Math.PI * freq * tSec + phaseRad;
          vWave = (2 * vPeak / Math.PI) * Math.asin(Math.sin(angle));
          break;
        }
        case 'sawtooth': {
          const arg = freq * tSec + phiCycles;
          vWave = 2 * vPeak * (arg - Math.floor(0.5 + arg));
          break;
        }
        case 'sine':
        default: {
          vWave = vPeak * Math.sin(2 * Math.PI * freq * tSec + phaseRad);
          break;
        }
      }
      if (target.pinId === 'pos' || target.pinId === 'p1' || target.pinId === '~ Line') return vWave + offset;
      if (target.pinId === 'neg' || target.pinId === 'p2' || target.pinId === '~ Neutral') return 0.0;
    }
  }

  // Built-in Calibrator signals (e.g. compId: '__CALIBRATOR__')
  if (target.type === 'pin' && target.compId === '__CALIBRATOR__') {
    const tSec = performance.now() / 1000;
    if (target.pinId === 'CAL_SINE') {
      return 2.5 + 2.5 * Math.sin(2 * Math.PI * 1000 * tSec); // 0V to 5V sine
    }
    if (target.pinId === 'CAL_TRIANGLE') {
      const angle = 2 * Math.PI * 500 * tSec;
      return 2.5 + (5.0 / Math.PI) * Math.asin(Math.sin(angle));
    }
    if (target.pinId === 'CAL_SAWTOOTH') {
      const arg = 200 * tSec;
      return 2.5 + 5.0 * (arg - Math.floor(0.5 + arg));
    }
    // Default: 1kHz 5V Square Wave Calibrator (Standard oscilloscope test signal)
    const cycle = (1000 * tSec) % 1;
    return cycle < 0.5 ? 5.0 : 0.0;
  }

  return 0.0;
}

/**
 * Resolves the digital logic level (0, 1, 'Z', 'X') at the given probe target.
 * Uses a smart digital threshold (>= 1.4V or active LED/load current > 0.5mA -> 1 HIGH; < 1.4V -> 0 LOW)
 * so probing LED anodes after current-limiting resistors (~1.8V-2.2V) registers cleanly as digital 1/0.
 */
export function getProbeLogicLevel(
  target: ProbeTarget | null,
  components: CircuitComponent[],
  wires: CircuitWire[]
): 0 | 1 | 'Z' | 'X' {
  if (!target) return 'Z';

  if (target.type === 'wire' && target.wireId) {
    const wire = wires.find((w) => w.id === target.wireId);
    if (!wire) return 'Z';
    if (
      wire.state?.logicLevel === 1 ||
      wire.state?.logicLevel === 0 ||
      wire.state?.logicLevel === 'X'
    ) {
      return wire.state.logicLevel;
    }
    const v = wire.state?.voltage;
    const curr = wire.state?.current ?? 0;
    if (typeof v === 'number') {
      if (v >= 1.4 || (curr > 0.0005 && v > 0.5)) return 1;
      return 0;
    }
    if (wire.state?.logicLevel !== undefined && wire.state.logicLevel !== null) {
      return wire.state.logicLevel;
    }
    return 'Z';
  }

  if (target.type === 'pin' && target.compId && target.pinId) {
    const comp = components.find((c) => c.id === target.compId);
    if (!comp) return 'Z';

    const pinNorm = target.pinId.toLowerCase();

    // 1. LED Anode smart check: if LED is lit or has active forward current > 0.5mA
    if (comp.type.startsWith('led-') && (pinNorm === 'anode' || pinNorm === 'pos' || pinNorm === '+')) {
      if (comp.state?.lit === true || (comp.state?.branchCurrentA ?? 0) > 0.0005) {
        return 1;
      }
      if (comp.state?.pinVoltages && typeof comp.state.pinVoltages[target.pinId] === 'number') {
        return comp.state.pinVoltages[target.pinId] >= 1.4 ? 1 : 0;
      }
    }

    // 2. MCU pin
    if (comp.state?.pins) {
      const pNorm = target.pinId.toLowerCase().replace(/^~/, '');
      const candidates = [
        target.pinId,
        pNorm,
        pNorm.startsWith('d') ? pNorm.substring(1) : `d${pNorm}`,
        pNorm.startsWith('gp') ? pNorm.substring(2) : `gp${pNorm}`,
      ];
      let pin: any = null;
      for (const cand of candidates) {
        if (comp.state.pins[cand]) {
          pin = comp.state.pins[cand];
          break;
        }
      }
      if (!pin) {
        const found = Object.keys(comp.state.pins).find((k) => k.toLowerCase() === pNorm);
        if (found) pin = comp.state.pins[found];
      }

      if (pin) {
        if (pin.mode === 'OUTPUT') {
          return pin.digitalValue === 1 || pin.value === 1 || (pin.voltage ?? 0) >= 1.4 ? 1 : 0;
        }
      }
    }

    // 3. Direct SPICE pin voltage (smart >= 1.4V threshold)
    if (comp.state?.pinVoltages && typeof comp.state.pinVoltages[target.pinId] === 'number') {
      const pv = comp.state.pinVoltages[target.pinId];
      return pv >= 1.4 ? 1 : 0;
    }

    // 4. Logic pin signals
    if (comp.state?.pinSignals && comp.state.pinSignals[target.pinId] !== undefined) {
      const sig = comp.state.pinSignals[target.pinId];
      if (sig === 1 || sig === 0 || sig === 'X') return sig;
    }

    if (target.pinId === 'out' && comp.state?.logicOutput !== undefined) {
      return comp.state.logicOutput;
    }

    // 5. Connected wire state / voltage
    const connectedWire = wires.find(
      (w) =>
        (w.fromCompId === comp.id && w.fromPinId.toLowerCase() === pinNorm) ||
        (w.toCompId === comp.id && w.toPinId.toLowerCase() === pinNorm)
    );
    if (connectedWire) {
      if (
        connectedWire.state?.logicLevel === 1 ||
        connectedWire.state?.logicLevel === 0 ||
        connectedWire.state?.logicLevel === 'X'
      ) {
        return connectedWire.state.logicLevel;
      }
      if (typeof connectedWire.state?.voltage === 'number') {
        return connectedWire.state.voltage >= 1.4 ? 1 : 0;
      }
    }

    const v = getProbeVoltage(target, components, wires);
    if (v >= 1.4) return 1;
    if (connectedWire || comp.state?.pinSignals?.[target.pinId] === 0) return 0;
  }

  return 'Z';
}

/**
 * Calculates current flowing through a probed wire or component in Amperes
 */
export function getProbeCurrent(
  target: ProbeTarget | null,
  components: CircuitComponent[],
  wires: CircuitWire[]
): number {
  if (!target) return 0.0;

  if (target.type === 'wire' && target.wireId) {
    const wire = wires.find((w) => w.id === target.wireId);
    return wire?.state?.current ?? 0.0;
  }

  if (target.type === 'pin' && target.compId) {
    const comp = components.find((c) => c.id === target.compId);
    return comp?.state?.branchCurrentA ?? 0.0;
  }

  return 0.0;
}

/**
 * Measures equivalent resistance in Ohms between two probe targets
 */
export function getProbedResistance(
  red: ProbeTarget | null,
  black: ProbeTarget | null,
  components: CircuitComponent[],
  wires: CircuitWire[]
): { resistance: number | null; isContinuity: boolean; diodeVf?: number } {
  if (!red) return { resistance: null, isContinuity: false };

  // If both probes are on the same wire or component pin
  if (black && red.type === black.type) {
    if (red.type === 'wire' && red.wireId === black.wireId) {
      return { resistance: 0.02, isContinuity: true };
    }
    if (red.type === 'pin' && red.compId === black.compId && red.pinId === black.pinId) {
      return { resistance: 0.0, isContinuity: true };
    }
  }

  // If both probes are on opposite pins of the SAME 2-pin passive component
  if (red.type === 'pin' && black?.type === 'pin' && red.compId === black.compId) {
    const comp = components.find((c) => c.id === red.compId);
    if (comp) {
      if (comp.type === 'resistor' || comp.type === 'potentiometer') {
        const r = typeof comp.properties?.resistance === 'number' ? comp.properties.resistance : 1000;
        return { resistance: r, isContinuity: r < 50 };
      }
      if (comp.type === 'diode' || comp.type === 'led') {
        const isAnode = red.pinId === 'anode' || red.pinId === 'p1' || red.pinId === '+';
        if (isAnode) {
          const vf = comp.type === 'led' ? 1.9 : 0.65;
          return { resistance: 15.0, isContinuity: true, diodeVf: vf };
        } else {
          return { resistance: null, isContinuity: false }; // Reverse biased O.L
        }
      }
      if (comp.type === 'pushbutton') {
        const isClosed = !!comp.properties?.isPressed;
        return isClosed
          ? { resistance: 0.05, isContinuity: true }
          : { resistance: null, isContinuity: false };
      }
      if (comp.type === 'toggle-switch') {
        const isClosed = comp.properties?.state === 'T1';
        return isClosed
          ? { resistance: 0.05, isContinuity: true }
          : { resistance: null, isContinuity: false };
      }
    }
  }

  // Check if they are connected through wires to the same net
  const vRed = getProbeVoltage(red, components, wires);
  const vBlack = black ? getProbeVoltage(black, components, wires) : 0.0;
  const iBranch = Math.max(getProbeCurrent(red, components, wires), 1e-9);

  const deltaV = Math.abs(vRed - vBlack);
  if (deltaV < 0.001 && red.compId && black?.compId) {
    // Both are at identical potential, check if directly wired
    return { resistance: 0.05, isContinuity: true };
  }

  if (iBranch > 1e-6) {
    const calcR = deltaV / iBranch;
    return { resistance: calcR, isContinuity: calcR < 50 };
  }

  return { resistance: null, isContinuity: false };
}

/**
 * Computes live oscilloscope signal telemetry (Vpp, Vrms, Freq, Period, Duty Cycle)
 * from a time-series buffer of voltage samples.
 */
export function computeSignalTelemetry(
  buffer: Array<{ t: number; v: number }>,
  timebaseMsPerDiv: number
): ScopeTelemetry {
  if (!buffer || buffer.length < 2) {
    return {
      vMax: 0,
      vMin: 0,
      vPp: 0,
      vAvg: 0,
      vRms: 0,
      frequencyHz: 0,
      periodMs: 0,
      dutyCyclePct: 0,
    };
  }

  let vMax = -Infinity;
  let vMin = Infinity;
  let sum = 0;
  let sumSq = 0;

  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i].v;
    if (v > vMax) vMax = v;
    if (v < vMin) vMin = v;
    sum += v;
    sumSq += v * v;
  }

  const n = buffer.length;
  const vAvg = sum / n;
  const vRms = Math.sqrt(sumSq / n);
  const vPp = Math.max(0, vMax - vMin);

  // If signal is flat DC
  if (vPp < 0.08) {
    return {
      vMax: Number(vMax.toFixed(3)),
      vMin: Number(vMin.toFixed(3)),
      vPp: 0,
      vAvg: Number(vAvg.toFixed(3)),
      vRms: Number(vRms.toFixed(3)),
      frequencyHz: 0,
      periodMs: 0,
      dutyCyclePct: 0,
    };
  }

  // Calculate frequency and period via zero-crossings around the midpoint
  const vMid = (vMax + vMin) / 2;
  const risingEdges: number[] = [];
  let highSamples = 0;

  for (let i = 1; i < buffer.length; i++) {
    const prev = buffer[i - 1].v;
    const curr = buffer[i].v;
    if (curr >= vMid) highSamples++;

    if (prev < vMid && curr >= vMid) {
      // Linear interpolation to estimate exact crossing time
      const dt = buffer[i].t - buffer[i - 1].t;
      const frac = dt > 0 ? (vMid - prev) / (curr - prev || 1) : 0;
      risingEdges.push(buffer[i - 1].t + dt * frac);
    }
  }

  let periodMs = 0;
  let frequencyHz = 0;

  if (risingEdges.length >= 2) {
    const periods: number[] = [];
    for (let i = 1; i < risingEdges.length; i++) {
      const p = risingEdges[i] - risingEdges[i - 1];
      if (p > 0.1) periods.push(p);
    }
    if (periods.length > 0) {
      periodMs = periods.reduce((a, b) => a + b, 0) / periods.length;
      frequencyHz = 1000 / periodMs;
    }
  } else {
    // Fallback: estimate from total time span if oscillating
    const span = buffer[buffer.length - 1].t - buffer[0].t;
    if (span > 0 && vPp > 0.2) {
      periodMs = timebaseMsPerDiv * 2;
      frequencyHz = 1000 / (periodMs || 1);
    }
  }

  const dutyCyclePct = Math.round((highSamples / n) * 100);

  return {
    vMax: Number(vMax.toFixed(3)),
    vMin: Number(vMin.toFixed(3)),
    vPp: Number(vPp.toFixed(3)),
    vAvg: Number(vAvg.toFixed(3)),
    vRms: Number(vRms.toFixed(3)),
    frequencyHz: Math.round(frequencyHz * 10) / 10,
    periodMs: Math.round(periodMs * 100) / 100,
    dutyCyclePct: Math.min(100, Math.max(0, dutyCyclePct)),
  };
}

/**
 * Generates human-friendly target label for probe pickers and badges
 */
export function getProbeTargetDisplay(target: ProbeTarget | null): string {
  if (!target) return 'Unconnected (Float)';
  if (target.label) return target.label;
  if (target.type === 'wire') return `Wire #${target.wireId?.slice(-4) || '1'}`;
  return `${target.compId || 'Comp'}:${target.pinId || 'pin'}`;
}

/**
 * Automatically tests and simulates all 2^N binary input combinations (00, 01, 10, 11...)
 * through the connected circuit network for the selected Input Probe Targets (A, B, C, D)
 * and measures the resulting digital logic state (0 or 1) at Output Probe Target (Y).
 */
export function evaluateAutomatedTruthTable(
  components: CircuitComponent[],
  wires: CircuitWire[],
  inputTargets: (ProbeTarget | null)[],
  outputTarget: ProbeTarget | null
): Record<number, 0 | 1> {
  const result: Record<number, 0 | 1> = {};
  const numInputs = inputTargets.length;
  if (!outputTarget || numInputs < 1 || numInputs > 4) return result;
  if (!inputTargets.some((t) => t !== null)) return result;

  const { pinToNetMap, wireToNetMap } = buildNetlistNets(components, wires);

  const findNetForTarget = (t: ProbeTarget | null) => {
    if (!t) return undefined;
    if (t.type === 'wire' && t.wireId) {
      return wireToNetMap.get(t.wireId);
    }
    if (t.type === 'pin' && t.compId && t.pinId) {
      const exact = pinToNetMap.get(`${t.compId}:${t.pinId}`);
      if (exact) return exact;
      const lowerKey = `${t.compId.toLowerCase()}:${t.pinId.toLowerCase()}`;
      for (const [k, n] of pinToNetMap.entries()) {
        if (k.toLowerCase() === lowerKey) return n;
      }
    }
    return undefined;
  };

  const numRows = 1 << numInputs;

  for (let m = 0; m < numRows; m++) {
    // Deep clone components and wires for isolated synthetic combination evaluation
    const testComps: CircuitComponent[] = components.map((c) => ({
      ...c,
      properties: { ...(c.properties || {}) },
      state: c.state
        ? {
            ...c.state,
            pins: c.state.pins ? JSON.parse(JSON.stringify(c.state.pins)) : undefined,
          }
        : {},
    }));
    let testWires: CircuitWire[] = wires.map((w) => ({
      ...w,
      state: {},
    }));

    for (let i = 0; i < numInputs; i++) {
      const inTarget = inputTargets[i];
      if (!inTarget) continue;

      const bitVal: 0 | 1 = (((m >> (numInputs - 1 - i)) & 1) === 1 ? 1 : 0);
      const inNet = findNetForTarget(inTarget);

      let anchorCompId: string | undefined;
      let anchorPinId: string | undefined;

      if (inTarget.type === 'pin' && inTarget.compId && inTarget.pinId) {
        anchorCompId = inTarget.compId;
        anchorPinId = inTarget.pinId;
      } else if (inTarget.type === 'wire' && inTarget.wireId) {
        const w = testWires.find((x) => x.id === inTarget.wireId);
        if (w) {
          anchorCompId = w.fromCompId;
          anchorPinId = w.fromPinId;
        }
      }

      // Override any MCU pin sitting on this input net (or directly targeted)
      const overrideMcuPin = (compId: string, rawPinId: string) => {
        const comp = testComps.find((c) => c.id === compId);
        if (!comp || !['arduino-uno', 'esp32', 'pico'].includes(comp.type)) return;
        if (!comp.state) comp.state = {};
        if (!comp.state.pins) comp.state.pins = {};
        const pNorm = rawPinId.toLowerCase().replace(/^~/, '');
        const vHigh = comp.type === 'esp32' || comp.type === 'pico' ? 3.3 : 5.0;
        const pinObj = {
          mode: 'OUTPUT',
          digitalValue: bitVal,
          value: bitVal,
          voltage: bitVal === 1 ? vHigh : 0.0,
        };
        const aliases = [
          rawPinId,
          pNorm,
          pNorm.toUpperCase(),
          pNorm.startsWith('d') ? pNorm.substring(1) : `d${pNorm}`,
          pNorm.startsWith('gp') ? pNorm.substring(2) : `gp${pNorm}`,
        ];
        for (const al of aliases) {
          comp.state.pins[al] = pinObj;
        }
      };

      if (anchorCompId && anchorPinId) {
        overrideMcuPin(anchorCompId, anchorPinId);
      }

      if (inNet) {
        const powerCompIdsOnNet = new Set<string>();
        for (const p of inNet.pins) {
          overrideMcuPin(p.compId, p.pinId);
          const cObj = testComps.find((x) => x.id === p.compId);
          if (
            cObj &&
            ['dc-source', 'battery-9v', 'coin-cell', 'vcc', 'gnd'].includes(cObj.type) &&
            (p.pinId === 'pos' || p.pinId === 'vcc' || p.pinId === 'out' || p.pinId === 'gnd')
          ) {
            powerCompIdsOnNet.add(cObj.id);
          }
        }
        if (powerCompIdsOnNet.size > 0) {
          testWires = testWires.filter(
            (w) => !powerCompIdsOnNet.has(w.fromCompId) && !powerCompIdsOnNet.has(w.toCompId)
          );
        }
      }

      // Inject synthetic ideal source driving the input target
      if (anchorCompId && anchorPinId) {
        const synthId = `__synth_kmap_in_${i}`;
        const synthPin = bitVal === 1 ? 'vcc' : 'gnd';
        testComps.push({
          id: synthId,
          type: bitVal === 1 ? 'vcc' : 'gnd',
          label: synthId,
          x: 0,
          y: 0,
          rotation: 0,
          mirrored: false,
          properties: { voltage: bitVal === 1 ? 5.0 : 0.0 },
          state: {},
        });
        testWires.push({
          id: `__synth_wire_${i}`,
          fromCompId: synthId,
          fromPinId: synthPin,
          toCompId: anchorCompId,
          toPinId: anchorPinId,
          waypoints: [],
          color: '#000000',
        });
      }
    }

    // 1. Evaluate Logical Pass to seed gate outputs
    const logRes1 = evaluateLogicalCircuit(testComps, testWires, 0);
    for (const c of testComps) {
      const cs = logRes1.componentStates.get(c.id);
      if (cs) {
        c.state = { ...c.state, ...cs };
      }
    }

    // 2. Evaluate SPICE MNA Pass for analog resistor/LED/transistor voltages & currents
    const spiceRes = evaluateSpiceCircuit(testComps, testWires, 0, 0.05);
    testWires = testWires.map((w) => {
      const v = spiceRes.wireVoltages.get(w.id) ?? 0;
      const curr = spiceRes.wireCurrents.get(w.id) ?? 0;
      return {
        ...w,
        state: {
          ...w.state,
          voltage: v,
          current: curr,
          logicLevel: v >= 1.4 ? 1 : 0,
        },
      };
    });
    for (const c of testComps) {
      const sr = spiceRes.componentResults.get(c.id);
      if (sr) {
        c.state = {
          ...c.state,
          voltageDropV: sr.voltageDropV,
          branchCurrentA: sr.currentA,
          powerW: sr.powerW,
          lit: (sr.brightness ?? 0) > 0.05,
          brightness: sr.brightness ?? (sr.currentA > 0.0005 ? 1 : 0),
          outputVoltage: sr.outputVoltage ?? c.state?.outputVoltage,
          logicOutput: sr.logicOutput ?? c.state?.logicOutput,
          pinVoltages: sr.pinVoltages,
        };
      }
    }

    // 3. Final Logical Pass for digital net levels
    const logRes2 = evaluateLogicalCircuit(testComps, testWires, 0);
    testWires = testWires.map((w) => {
      const lvl = logRes2.wireStates.get(w.id);
      return {
        ...w,
        state: {
          ...w.state,
          logicLevel: lvl === 1 || lvl === 0 ? lvl : w.state?.logicLevel,
        },
      };
    });
    for (const c of testComps) {
      const cs = logRes2.componentStates.get(c.id);
      if (cs) {
        c.state = {
          ...c.state,
          pinSignals: cs.pinSignals,
          logicOutput: cs.logicOutput ?? c.state?.logicOutput,
          lit: Boolean(c.state?.lit || cs.lit),
        };
      }
    }

    const outLvl = getProbeLogicLevel(outputTarget, testComps, testWires);
    result[m] = outLvl === 1 ? 1 : 0;
  }

  return result;
}
