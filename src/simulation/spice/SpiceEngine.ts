import { CircuitComponent, CircuitWire } from '../../types/circuit';
import { ComponentRegistry } from '../../registry/ComponentRegistry';
import {
  buildNetlistNets,
  isUniversalGroundPin,
  isUniversalSupplyPin,
} from '../logical/NetlistGraph';
import { MatrixSolver } from './MatrixSolver';
import { SpiceComponentResult, SpiceSimulationResult } from './types';

// Persistent dynamic state across simulation steps (for capacitors, inductors, etc.)
const dynamicCapacitorVoltages = new Map<string, number>();
const dynamicInductorCurrents = new Map<string, number>();

/**
 * Resets all persistent SPICE reactive states (capacitors and inductors).
 * Called when simulation is stopped, reset, or a new circuit/template is loaded.
 */
export function resetSpiceEngineState(): void {
  dynamicCapacitorVoltages.clear();
  dynamicInductorCurrents.clear();
}

/**
 * Executes a cycle of the SPICE Modified Nodal Analysis (MNA) Engine.
 * Features an iterative Newton-Raphson non-linear loop for diodes, LEDs, and transistors,
 * automatic ground reference selection, universal thermal & electrical overload detection,
 * and real-time output visuals.
 */
export function evaluateSpiceCircuit(
  components: CircuitComponent[],
  wires: CircuitWire[],
  clockMs: number,
  timeStepSec: number = 0.05
): SpiceSimulationResult {
  // 1. Build discrete electrical nets from wires & switch states
  const { nets, pinToNetMap, wireToNetMap } = buildNetlistNets(components, wires);

  // 2. Universally Identify All Ground Nets Bound to Node 0 (0V Reference)
  // Across ALL components in the registry (Arduino GND1/GND2/GND3, ESP32 GND1/GND2,
  // Pi Pico GND1..GND8, 555 Timer GND, Power Sources neg, Dedicated GND, etc.)
  const gndNetIds = new Set<string>();
  for (const net of nets) {
    for (const p of net.pins) {
      const comp = components.find((c) => c.id === p.compId);
      if (!comp) continue;
      const def = ComponentRegistry.get(comp.type);
      const pinDef = def?.pins.find((pd) => pd.id.toLowerCase() === p.pinId.toLowerCase());
      if (isUniversalGroundPin(comp.type, p.pinId, pinDef?.label)) {
        gndNetIds.add(net.id);
      }
    }
  }

  // Fallback to first available net only if no ground pin is present anywhere
  if (gndNetIds.size === 0 && nets.length > 0) {
    gndNetIds.add(nets[0].id);
  }

  // Assign Node Index to each Net (0 for all GND nets, 1..N for other nodes)
  const netToNodeId = new Map<string, number>();
  let nextNodeIndex = 1;
  for (const net of nets) {
    if (gndNetIds.has(net.id)) {
      netToNodeId.set(net.id, 0);
    } else {
      netToNodeId.set(net.id, nextNodeIndex++);
    }
  }

  const numNodes = nextNodeIndex - 1; // Nodes 1 to numNodes

  // Multi-pin candidate lookup helper to find assigned Node Index
  const getPinNode = (compId: string, ...pinCandidates: string[]): number => {
    for (const pid of pinCandidates) {
      const candidates = [
        pid,
        pid.toLowerCase(),
        pid.toUpperCase(),
        pid.startsWith('d') ? pid.substring(1) : `d${pid}`,
        pid.startsWith('gp') ? pid.substring(2) : `gp${pid}`,
      ];
      for (const cand of candidates) {
        const net = pinToNetMap.get(`${compId}:${cand}`);
        if (net) {
          const nodeId = netToNodeId.get(net.id);
          if (nodeId !== undefined) return nodeId;
        }
      }
    }

    // Case-insensitive fallback across all pinToNetMap entries
    for (const pid of pinCandidates) {
      const targetPrefix = `${compId.toLowerCase()}:${pid.toLowerCase()}`;
      for (const [k, net] of pinToNetMap.entries()) {
        if (k.toLowerCase() === targetPrefix) {
          const nodeId = netToNodeId.get(net.id);
          if (nodeId !== undefined) return nodeId;
        }
      }
    }
    return -1; // Unconnected or unassigned
  };

  // 3. Count Independent Voltage Sources (MNA extension branch rows)
  interface VoltageSourceBranch {
    compId: string;
    posNode: number;
    negNode: number;
    voltage: number;
    seriesR: number;
    pinId?: string;
    logicGateType?: string;
    inputNodeA?: number;
    inputNodeB?: number;
  }

  const voltageSources: VoltageSourceBranch[] = [];
  const deadShortSources = new Map<string, { voltage: number; current: number }>();

  for (const comp of components) {
    const props = comp.properties || {};

    switch (comp.type) {
      case 'dc-source': {
        const pos = getPinNode(comp.id, 'pos', '+', 'p1');
        const neg = getPinNode(comp.id, 'neg', '-', 'p2');
        const v = typeof props.voltage === 'number' ? props.voltage : 9;
        const rInt = typeof props.internalResistance === 'number' ? Math.max(0.01, props.internalResistance) : 0.05;
        const negRef = neg !== -1 ? neg : 0;
        if (pos !== -1) {
          if (pos === negRef) {
            deadShortSources.set(comp.id, { voltage: v, current: v / rInt });
          } else {
            voltageSources.push({ compId: comp.id, posNode: pos, negNode: negRef, voltage: v, seriesR: rInt, pinId: 'pos' });
          }
        }
        break;
      }

      case 'battery-9v':
      case 'power-supply':
      case 'dc-supply': {
        const pos = getPinNode(comp.id, 'pos', '+', 'p1');
        const neg = getPinNode(comp.id, 'neg', '-', 'p2');
        const v = typeof props.voltage === 'number' ? props.voltage : 9;
        const negRef = neg !== -1 ? neg : 0;
        if (pos !== -1) {
          if (pos === negRef) {
            deadShortSources.set(comp.id, { voltage: v, current: v / 0.05 });
          } else {
            voltageSources.push({ compId: comp.id, posNode: pos, negNode: negRef, voltage: v, seriesR: 0.05, pinId: 'pos' });
          }
        }
        break;
      }

      case 'coin-cell': {
        const pos = getPinNode(comp.id, 'pos', '+', 'p1');
        const neg = getPinNode(comp.id, 'neg', '-', 'p2');
        const v = typeof props.voltage === 'number' ? props.voltage : 3;
        const negRef = neg !== -1 ? neg : 0;
        if (pos !== -1) {
          if (pos === negRef) {
            deadShortSources.set(comp.id, { voltage: v, current: v / 0.1 });
          } else {
            voltageSources.push({ compId: comp.id, posNode: pos, negNode: negRef, voltage: v, seriesR: 0.1, pinId: 'pos' });
          }
        }
        break;
      }

      case 'vcc':
      case 'builtin_vcc': {
        const vccNode = getPinNode(comp.id, 'vcc', 'out');
        const v = typeof props.voltage === 'number' ? props.voltage : 5;
        if (vccNode !== -1 && vccNode !== 0) {
          voltageSources.push({ compId: comp.id, posNode: vccNode, negNode: 0, voltage: v, seriesR: 0.01, pinId: 'vcc' });
        }
        break;
      }

      case 'ac-source': {
        const pos = getPinNode(comp.id, 'pos', 'p1', '~ Line');
        const neg = getPinNode(comp.id, 'neg', 'p2', '~ Neutral');
        const vPeak = typeof props.amplitude === 'number' ? props.amplitude : typeof props.voltage === 'number' ? props.voltage : 12;
        const freq = typeof props.frequency === 'number' ? props.frequency : 50;
        const phase = typeof props.phase === 'number' ? props.phase : 0;
        const offset = typeof props.offset === 'number' ? props.offset : 0;
        const dutyCycle = typeof props.dutyCycle === 'number' ? props.dutyCycle / 100 : 0.5;
        const waveform = (props.waveform as string) || 'sine';
        const tSec = clockMs / 1000;
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

        const vInstant = vWave + offset;
        const negRef = neg !== -1 ? neg : 0;
        if (pos !== -1 && pos !== negRef) {
          voltageSources.push({ compId: comp.id, posNode: pos, negNode: negRef, voltage: vInstant, seriesR: 0.02, pinId: 'pos' });
        }
        break;
      }

      case 'temp-sensor': {
        const temp = typeof props.temperatureC === 'number' ? props.temperatureC : 25;
        const outNet = pinToNetMap.get(`${comp.id}:vout`);
        const connectsToMcuAnalog = outNet?.pins.some((pRef) => {
          if (pRef.compId === comp.id) return false;
          const other = components.find((c) => c.id === pRef.compId);
          if (!other) return false;
          const isMcu = other.type === 'arduino-uno' || other.type === 'esp32' || other.type === 'pico';
          const isAnalogPin = pRef.pinId.toLowerCase().startsWith('a') || pRef.pinId.toLowerCase().startsWith('adc');
          return isMcu && isAnalogPin;
        });

        const threshold = typeof props.threshold === 'number' ? props.threshold : 50;
        const vout = connectsToMcuAnalog
          ? Math.max(0.1, Math.min(2.0, 0.5 + 0.01 * temp))
          : (temp >= threshold ? 5.0 : 0.0);

        const outNode = getPinNode(comp.id, 'vout');
        const gndNode = getPinNode(comp.id, 'gnd');
        const gndRef = gndNode !== -1 ? gndNode : 0;
        if (outNode !== -1 && outNode !== gndRef) {
          voltageSources.push({ compId: comp.id, posNode: outNode, negNode: gndRef, voltage: vout, seriesR: 10, pinId: 'vout' });
        }
        break;
      }

      case 'builtin_humidity_sensor':
      case 'humidity-sensor': {
        const humidity = typeof props.humidity === 'number' ? props.humidity : 35;
        const outNet = pinToNetMap.get(`${comp.id}:out`);
        const connectsToMcuAnalog = outNet?.pins.some((pRef) => {
          if (pRef.compId === comp.id) return false;
          const other = components.find((c) => c.id === pRef.compId);
          if (!other) return false;
          const isMcu = other.type === 'arduino-uno' || other.type === 'esp32' || other.type === 'pico';
          const isAnalogPin = pRef.pinId.toLowerCase().startsWith('a') || pRef.pinId.toLowerCase().startsWith('adc');
          return isMcu && isAnalogPin;
        });

        const threshold = typeof props.threshold === 'number' ? props.threshold : 60;
        const vout = connectsToMcuAnalog
          ? 5.0 * Math.max(0, Math.min(1, humidity / 100))
          : (humidity >= threshold ? 5.0 : 0.0);

        const outNode = getPinNode(comp.id, 'out');
        const gndNode = getPinNode(comp.id, 'gnd');
        const gndRef = gndNode !== -1 ? gndNode : 0;
        if (outNode !== -1 && outNode !== gndRef) {
          voltageSources.push({ compId: comp.id, posNode: outNode, negNode: gndRef, voltage: vout, seriesR: 10, pinId: 'out' });
        }
        break;
      }

      case 'builtin_motion_sensor':
      case 'motion-sensor': {
        const motion = props.motionDetected === true || comp.state?.motionDetected === true;
        const vout = motion ? 3.3 : 0.0;
        const outNode = getPinNode(comp.id, 'out');
        const gndNode = getPinNode(comp.id, 'gnd');
        const gndRef = gndNode !== -1 ? gndNode : 0;
        if (outNode !== -1 && outNode !== gndRef) {
          voltageSources.push({ compId: comp.id, posNode: outNode, negNode: gndRef, voltage: vout, seriesR: 10, pinId: 'out' });
        }
        break;
      }

      case 'builtin_gas_sensor':
      case 'gas-sensor': {
        const ppm = typeof props.ppm === 'number' ? props.ppm : 50;
        const threshold = typeof props.threshold === 'number' ? props.threshold : 400;
        const vDo = ppm >= threshold ? 5.0 : 0.0;
        const vAo = 0.2 + 4.6 * Math.max(0, Math.min(1, ppm / 2000));
        const doNode = getPinNode(comp.id, 'do');
        const aoNode = getPinNode(comp.id, 'ao');
        const gndNode = getPinNode(comp.id, 'gnd');
        const gndRef = gndNode !== -1 ? gndNode : 0;
        if (doNode !== -1 && doNode !== gndRef) {
          voltageSources.push({ compId: comp.id, posNode: doNode, negNode: gndRef, voltage: vDo, seriesR: 10, pinId: 'do' });
        }
        if (aoNode !== -1 && aoNode !== gndRef) {
          voltageSources.push({ compId: comp.id, posNode: aoNode, negNode: gndRef, voltage: vAo, seriesR: 10, pinId: 'ao' });
        }
        break;
      }

      case 'builtin_accelerometer':
      case 'accelerometer': {
        const ax = typeof props.accelX === 'number' ? props.accelX : 0.0;
        const ay = typeof props.accelY === 'number' ? props.accelY : 0.0;
        const az = typeof props.accelZ === 'number' ? props.accelZ : 1.0;
        const vx = Math.max(0, Math.min(3.3, 1.65 + (ax / 3.0) * 1.65));
        const vy = Math.max(0, Math.min(3.3, 1.65 + (ay / 3.0) * 1.65));
        const vz = Math.max(0, Math.min(3.3, 1.65 + (az / 3.0) * 1.65));
        const gndNode = getPinNode(comp.id, 'gnd');
        const gndRef = gndNode !== -1 ? gndNode : 0;
        const xNode = getPinNode(comp.id, 'x');
        const yNode = getPinNode(comp.id, 'y');
        const zNode = getPinNode(comp.id, 'z');
        if (xNode !== -1 && xNode !== gndRef) {
          voltageSources.push({ compId: comp.id, posNode: xNode, negNode: gndRef, voltage: vx, seriesR: 10, pinId: 'x' });
        }
        if (yNode !== -1 && yNode !== gndRef) {
          voltageSources.push({ compId: comp.id, posNode: yNode, negNode: gndRef, voltage: vy, seriesR: 10, pinId: 'y' });
        }
        if (zNode !== -1 && zNode !== gndRef) {
          voltageSources.push({ compId: comp.id, posNode: zNode, negNode: gndRef, voltage: vz, seriesR: 10, pinId: 'z' });
        }
        break;
      }

      case 'builtin_numpad':
      case 'numpad': {
        const activeKey = String(
          props.activeKey ?? props.pressedKey ?? comp.state?.activeKey ?? comp.state?.pressedKey ?? ''
        )
          .trim()
          .toUpperCase();
        const keyOrder = ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D'];
        const keyIdx = keyOrder.indexOf(activeKey) + 1;
        const vOut = keyIdx > 0 ? keyIdx * 0.3 : 0.0;
        const outNode = getPinNode(comp.id, 'out');
        const gndNode = getPinNode(comp.id, 'gnd');
        const gndRef = gndNode !== -1 ? gndNode : 0;
        if (outNode !== -1 && outNode !== gndRef) {
          voltageSources.push({ compId: comp.id, posNode: outNode, negNode: gndRef, voltage: vOut, seriesR: 10, pinId: 'out' });
        }
        break;
      }

      // -----------------------------------------------------------------------
      // PHASE 7.4 ACTIVE VOLTAGE SOURCES (Solar Panel, Regulators, Comparator, etc.)
      // -----------------------------------------------------------------------
      case 'builtin_solar_panel': {
        const posNode = getPinNode(comp.id, 'pos', '+', 'p1');
        const negNode = getPinNode(comp.id, 'neg', '-', 'p2');
        const lux = typeof props.lux === 'number' ? props.lux : 100;
        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 6.0;
        const vGen = Math.min(maxV, 0.5 + (lux / 1000) * (maxV - 0.5));
        const negRef = negNode !== -1 ? negNode : 0;
        if (posNode !== -1 && posNode !== negRef) {
          voltageSources.push({ compId: comp.id, posNode, negNode: negRef, voltage: vGen, seriesR: 5.0, pinId: 'pos' });
        }
        break;
      }

      case 'builtin_joystick': {
        const vrxNode = getPinNode(comp.id, 'vrx');
        const vryNode = getPinNode(comp.id, 'vry');
        const swNode = getPinNode(comp.id, 'sw');
        const gndNode = getPinNode(comp.id, 'gnd');
        const gndRef = gndNode !== -1 ? gndNode : 0;
        const jx = typeof props.joyX === 'number' ? props.joyX : 0;
        const jy = typeof props.joyY === 'number' ? props.joyY : 0;
        const pressed = props.isPressed === true;
        const vrxV = Math.max(0, Math.min(5, 2.5 + (jx / 100) * 2.5));
        const vryV = Math.max(0, Math.min(5, 2.5 + (jy / 100) * 2.5));
        const swV = pressed ? 0.0 : 5.0;
        if (vrxNode !== -1 && vrxNode !== gndRef) {
          voltageSources.push({ compId: comp.id, posNode: vrxNode, negNode: gndRef, voltage: vrxV, seriesR: 100, pinId: 'vrx' });
        }
        if (vryNode !== -1 && vryNode !== gndRef) {
          voltageSources.push({ compId: comp.id, posNode: vryNode, negNode: gndRef, voltage: vryV, seriesR: 100, pinId: 'vry' });
        }
        if (swNode !== -1 && swNode !== gndRef) {
          voltageSources.push({ compId: comp.id, posNode: swNode, negNode: gndRef, voltage: swV, seriesR: 100, pinId: 'sw' });
        }
        break;
      }

      // -----------------------------------------------------------------------
      // PHASE 7.9 SENSORS & WIRELESS RF / IR RECEIVER VOLTAGE SOURCES
      // -----------------------------------------------------------------------
      case 'builtin_soil_moisture': {
        const moisture = typeof props.moisture === 'number' ? props.moisture : 20;
        const threshold = typeof props.threshold === 'number' ? props.threshold : 50;
        const triggerOnDry = props.triggerOnDry === true;
        const outNet = pinToNetMap.get(`${comp.id}:out`);
        const connectsToMcuAnalog = outNet?.pins.some((pRef) => {
          if (pRef.compId === comp.id) return false;
          const other = components.find((c) => c.id === pRef.compId);
          if (!other) return false;
          const isMcu = other.type === 'arduino-uno' || other.type === 'esp32' || other.type === 'pico';
          const isAnalogPin = pRef.pinId.toLowerCase().startsWith('a') || pRef.pinId.toLowerCase().startsWith('adc');
          return isMcu && isAnalogPin;
        });
        const isTrig = triggerOnDry ? moisture < threshold : moisture >= threshold;
        const vout = connectsToMcuAnalog
          ? 5.0 * Math.max(0, Math.min(1, moisture / 100))
          : (isTrig ? 5.0 : 0.0);
        const outNode = getPinNode(comp.id, 'out');
        const gndNode = getPinNode(comp.id, 'gnd');
        const gndRef = gndNode !== -1 ? gndNode : 0;
        if (outNode !== -1 && outNode !== gndRef) {
          voltageSources.push({ compId: comp.id, posNode: outNode, negNode: gndRef, voltage: vout, seriesR: 15.0, pinId: 'out' });
        }
        break;
      }

      case 'builtin_hall_sensor': {
        const mag = typeof props.magneticField === 'number' ? props.magneticField : 0;
        const threshold = typeof props.threshold === 'number' ? props.threshold : 30;
        const vout = mag >= threshold ? 5.0 : 0.0;
        const outNode = getPinNode(comp.id, 'out');
        const gndNode = getPinNode(comp.id, 'gnd');
        const gndRef = gndNode !== -1 ? gndNode : 0;
        if (outNode !== -1 && outNode !== gndRef) {
          voltageSources.push({ compId: comp.id, posNode: outNode, negNode: gndRef, voltage: vout, seriesR: 15.0, pinId: 'out' });
        }
        break;
      }

      case 'builtin_vibration_sensor': {
        const vib = props.vibrationDetected === true || comp.state?.vibrationDetected === true;
        const vout = vib ? 5.0 : 0.0;
        const outNode = getPinNode(comp.id, 'out');
        const gndNode = getPinNode(comp.id, 'gnd');
        const gndRef = gndNode !== -1 ? gndNode : 0;
        if (outNode !== -1 && outNode !== gndRef) {
          voltageSources.push({ compId: comp.id, posNode: outNode, negNode: gndRef, voltage: vout, seriesR: 15.0, pinId: 'out' });
        }
        break;
      }

      case 'builtin_ir_rx': {
        const irInit = props.irDetected === true || comp.state?.isReceivingIr === true;
        const outNode = getPinNode(comp.id, 'out');
        const gndNode = getPinNode(comp.id, 'gnd');
        const gndRef = gndNode !== -1 ? gndNode : 0;
        if (outNode !== -1 && outNode !== gndRef) {
          voltageSources.push({ compId: comp.id, posNode: outNode, negNode: gndRef, voltage: irInit ? 5.0 : 0.0, seriesR: 15.0, pinId: 'out' });
        }
        break;
      }

      case 'builtin_rf_radio': {
        const rxNode = getPinNode(comp.id, 'rx');
        const gndNode = getPinNode(comp.id, 'gnd');
        const gndRef = gndNode !== -1 ? gndNode : 0;
        if (rxNode !== -1 && rxNode !== gndRef) {
          // RX output pin initialized strictly to 0.0V (conductance to GND via 25Ω)
          voltageSources.push({ compId: comp.id, posNode: rxNode, negNode: gndRef, voltage: 0.0, seriesR: 25.0, pinId: 'rx' });
        }
        break;
      }

      case 'builtin_shift_register':
      case 'builtin_counter_4bit':
      case 'builtin_bcd_decoder':
      case 'builtin_mux_4to1':
      case 'builtin_d_flipflop':
      case 'builtin_jk_flipflop': {
        // Logic IC output pins stamped as digital driver voltage sources
        const def = ComponentRegistry.getComponentDefinition(comp.type);
        if (def && def.pins) {
          for (const p of def.pins) {
            if (p.direction === 'output') {
              const pNode = getPinNode(comp.id, p.id);
              if (pNode > 0) {
                // If defined in state, drive corresponding bit
                const bit = comp.state?.[p.id] ?? comp.state?.pinSignals?.[p.id] ?? 0;
                const v = bit === 1 ? 5.0 : 0.0;
                voltageSources.push({ compId: comp.id, posNode: pNode, negNode: 0, voltage: v, seriesR: 25.0, pinId: p.id });
              }
            }
          }
        }
        break;
      }

      case 'arduino-uno':
      case 'esp32':
      case 'pico':
      case 'builtin_cpu_8bit':
      case 'cpu-8bit': {
        // Universally bind all MCU 5V (5.0V) and 3V3 (3.3V) supply pins referenced to Node 0 (GND)
        const stampedSupplyNodes = new Set<number>();
        const supply5VPins = ['5v', 'vbus', 'vsys', 'ioref', 'vcc'];
        for (const sPin of supply5VPins) {
          const sNode = getPinNode(comp.id, sPin);
          if (sNode !== -1) {
            if (sNode === 0) {
              deadShortSources.set(`${comp.id}_${sPin}`, { voltage: 5.0, current: 5.0 / 0.05 });
            } else if (!stampedSupplyNodes.has(sNode)) {
              stampedSupplyNodes.add(sNode);
              voltageSources.push({ compId: comp.id, posNode: sNode, negNode: 0, voltage: 5.0, seriesR: 0.05, pinId: sPin });
            }
          }
        }

        const supply3V3Pins = ['3v3', '3.3v', 'p3v3', 'vref'];
        for (const sPin of supply3V3Pins) {
          const sNode = getPinNode(comp.id, sPin);
          if (sNode !== -1) {
            if (sNode === 0) {
              deadShortSources.set(`${comp.id}_${sPin}`, { voltage: 3.3, current: 3.3 / 0.05 });
            } else if (!stampedSupplyNodes.has(sNode)) {
              stampedSupplyNodes.add(sNode);
              voltageSources.push({ compId: comp.id, posNode: sNode, negNode: 0, voltage: 3.3, seriesR: 0.05, pinId: sPin });
            }
          }
        }

        // Active output pins driven by MCU runtime (SPICE & MIXED Modes)
        const mcuVoltage = comp.type === 'esp32' || comp.type === 'pico' ? 3.3 : 5.0;
        const gndRef = 0; // Universal 0V ground reference
        const stampedGpioNodes = new Set<number>();

        const stampMcuPinVoltage = (pinKey: string, vOut: number) => {
          const pNode = getPinNode(comp.id, pinKey);
          if (pNode !== -1 && !stampedGpioNodes.has(pNode)) {
            stampedGpioNodes.add(pNode);
            if (pNode === gndRef) {
              if (vOut > 0) {
                deadShortSources.set(`${comp.id}_${pinKey}`, { voltage: vOut, current: vOut / 25.0 });
              }
            } else {
              voltageSources.push({
                compId: comp.id,
                posNode: pNode,
                negNode: gndRef,
                voltage: vOut,
                seriesR: 25.0, // 25Ω internal CMOS channel resistance
                pinId: pinKey,
              });
            }
          }
        };

        // 1. Check explicit pinStates / pinVoltages (if present)
        const explicitPinStates = comp.state?.pinStates;
        if (explicitPinStates && typeof explicitPinStates === 'object') {
          for (const [pinKey, rawVal] of Object.entries(explicitPinStates as Record<string, any>)) {
            if (rawVal === 1 || rawVal === 0 || rawVal === true || rawVal === false) {
              const explicitV = comp.state?.pinVoltages?.[pinKey];
              const vOut = typeof explicitV === 'number' ? explicitV : (rawVal === 1 || rawVal === true ? mcuVoltage : 0.0);
              stampMcuPinVoltage(pinKey, vOut);
            }
          }
        }

        // 2. Check MCU runtime pins map
        const pinStates = comp.state?.pins || comp.properties?.pins;
        if (pinStates) {
          for (const [pinKey, pinObj] of Object.entries(pinStates as Record<string, any>)) {
            if (pinObj && pinObj.mode === 'OUTPUT') {
              const vOut = typeof pinObj.voltage === 'number'
                ? pinObj.voltage
                : (pinObj.digitalValue === 1 || pinObj.value === 1 ? mcuVoltage : 0.0);
              stampMcuPinVoltage(pinKey, vOut);
            }
          }
        }
        break;
      }

      case 'gate-buffer':
      case 'gate-and':
      case 'gate-or':
      case 'gate-not':
      case 'gate-nand':
      case 'gate-nor':
      case 'gate-xor':
      case 'gate-xnor':
      case 'ic-555':
      case 'builtin_555':
      case 'timer-555': {
        // Logic gates and 555 timers are evaluated via the Universal 100-Step Gate Cascade below
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3B. Universal 100-Step Gate & Passive Reachability Cascade Pre-Pass
  // Rules:
  // - Rule 1: Unconnected or floating ('Z') gate inputs NEVER generate signals.
  //   If ANY required input pin of a gate is unconnected (-1) or not in drivenNodes,
  //   the gate output is High-Z ('Z') and is NOT stamped as a voltage source.
  // - Rule 3: Unidirectional active gate cascade (Input -> Output) up to 100 steps
  //   with passive series bridge / voltage divider propagation.
  // -------------------------------------------------------------------------
  const drivenNodes = new Map<number, number>();
  const stiffDrivenNodes = new Set<number>();

  if (gndNetIds.size > 0) {
    drivenNodes.set(0, 0.0);
    stiffDrivenNodes.add(0);
  }

  for (const src of voltageSources) {
    if (src.negNode === 0 && src.posNode > 0) {
      drivenNodes.set(src.posNode, src.voltage);
      stiffDrivenNodes.add(src.posNode);
    } else if (src.posNode === 0 && src.negNode > 0) {
      drivenNodes.set(src.negNode, -src.voltage);
      stiffDrivenNodes.add(src.negNode);
    } else if (src.posNode > 0 && src.negNode > 0) {
      const vNeg = drivenNodes.get(src.negNode) ?? 0.0;
      drivenNodes.set(src.negNode, vNeg);
      drivenNodes.set(src.posNode, vNeg + src.voltage);
      stiffDrivenNodes.add(src.posNode);
      stiffDrivenNodes.add(src.negNode);
    }
  }

  // Collect linear bidirectional passive bridges for reachability & divider estimation
  interface PassiveBridgeBranch {
    n1: number;
    n2: number;
    G: number;
  }
  const passiveBridges: PassiveBridgeBranch[] = [];
  for (const comp of components) {
    const props = comp.properties || {};
    if (comp.type === 'resistor') {
      const n1 = getPinNode(comp.id, 'p1', 'pin1', 't1');
      const n2 = getPinNode(comp.id, 'p2', 'pin2', 't2');
      if (n1 !== -1 && n2 !== -1 && n1 !== n2) {
        const r = Math.max(0.01, typeof props.resistance === 'number' ? props.resistance : 1000);
        passiveBridges.push({ n1, n2, G: 1 / r });
      }
    } else if (comp.type === 'inductor' || comp.type === 'builtin_inductor') {
      const n1 = getPinNode(comp.id, 'p1', 'pin1');
      const n2 = getPinNode(comp.id, 'p2', 'pin2');
      if (n1 !== -1 && n2 !== -1 && n1 !== n2) {
        passiveBridges.push({ n1, n2, G: 1.0 });
      }
    } else if (comp.type === 'light-sensor') {
      const n1 = getPinNode(comp.id, 'p1', 'pin1');
      const n2 = getPinNode(comp.id, 'p2', 'pin2');
      if (n1 !== -1 && n2 !== -1 && n1 !== n2) {
        const lux = typeof props.lux === 'number' ? props.lux : 100;
        const threshold = typeof props.threshold === 'number' ? props.threshold : 500;
        if (lux >= threshold) {
          const r = Math.max(50, Math.round(500000 / Math.pow(Math.max(1, lux), 0.7)));
          passiveBridges.push({ n1, n2, G: 1 / r });
        } else {
          // If n1 is VCC/driven, pull n2 to GND (0); if n2 is VCC/driven, pull n1 to GND (0)
          if (stiffDrivenNodes.has(n1) && !stiffDrivenNodes.has(n2)) {
            passiveBridges.push({ n1: n2, n2: 0, G: 100.0 });
          } else if (stiffDrivenNodes.has(n2) && !stiffDrivenNodes.has(n1)) {
            passiveBridges.push({ n1, n2: 0, G: 100.0 });
          }
        }
      }
    } else if (comp.type === 'potentiometer') {
      const t1 = getPinNode(comp.id, 't1');
      const wiper = getPinNode(comp.id, 'wiper');
      const t2 = getPinNode(comp.id, 't2');
      const maxR = typeof props.maxResistance === 'number' ? props.maxResistance : 10000;
      const pos = Math.max(0.001, Math.min(0.999, (typeof props.position === 'number' ? props.position : 50) / 100));
      const r1 = Math.max(0.1, pos * maxR);
      const r2 = Math.max(0.1, (1 - pos) * maxR);
      if (t1 !== -1 && wiper !== -1 && t1 !== wiper) passiveBridges.push({ n1: t1, n2: wiper, G: 1 / r1 });
      if (wiper !== -1 && t2 !== -1 && wiper !== t2) passiveBridges.push({ n1: wiper, n2: t2, G: 1 / r2 });
    } else if (comp.type === 'pushbutton' && (props.isPressed === true || comp.state?.isPressed === true)) {
      const n1 = getPinNode(comp.id, 'p1', 'pin1');
      const n2 = getPinNode(comp.id, 'p2', 'pin2');
      if (n1 !== -1 && n2 !== -1 && n1 !== n2) {
        passiveBridges.push({ n1, n2, G: 100.0 });
      }
    } else if ((comp.type === 'builtin_spst_switch' || comp.type === 'builtin_switch_spst') && (props.closed === true || comp.state?.closed === true)) {
      const n1 = getPinNode(comp.id, 'p1', 'com');
      const n2 = getPinNode(comp.id, 'p2');
      if (n1 !== -1 && n2 !== -1 && n1 !== n2) {
        passiveBridges.push({ n1, n2, G: 100.0 });
      }
    } else if ((comp.type === 'fuse' || comp.type === 'builtin_fuse') && !comp.state?.isBurned && !comp.state?.isBlown) {
      const n1 = getPinNode(comp.id, 'p1');
      const n2 = getPinNode(comp.id, 'p2');
      if (n1 !== -1 && n2 !== -1 && n1 !== n2) {
        passiveBridges.push({ n1, n2, G: 20.0 });
      }
    } else if (comp.type === 'toggle-switch') {
      const com = getPinNode(comp.id, 'com');
      const isT1 = props.state !== 'T2';
      const target = isT1 ? getPinNode(comp.id, 't1') : getPinNode(comp.id, 't2');
      if (com !== -1 && target !== -1 && com !== target) {
        passiveBridges.push({ n1: com, n2: target, G: 100.0 });
      }
    } else if (comp.type === 'builtin_filament_bulb') {
      const n1 = getPinNode(comp.id, 'p1');
      const n2 = getPinNode(comp.id, 'p2');
      if (n1 !== -1 && n2 !== -1 && n1 !== n2) {
        const r = Math.max(0.1, typeof props.resistance === 'number' ? props.resistance : 24);
        passiveBridges.push({ n1, n2, G: 1 / r });
      }
    } else if (comp.type === 'builtin_water_pump') {
      const n1 = getPinNode(comp.id, 'p_plus');
      const n2 = getPinNode(comp.id, 'p_minus');
      if (n1 !== -1 && n2 !== -1 && n1 !== n2) {
        const r = Math.max(0.1, typeof props.resistance === 'number' ? props.resistance : 25);
        passiveBridges.push({ n1, n2, G: 1 / r });
      }
    } else if (comp.type === 'builtin_solenoid') {
      const n1 = getPinNode(comp.id, 's_plus');
      const n2 = getPinNode(comp.id, 's_minus');
      if (n1 !== -1 && n2 !== -1 && n1 !== n2) {
        const r = Math.max(0.1, typeof props.coilResistance === 'number' ? props.coilResistance : 20);
        passiveBridges.push({ n1, n2, G: 1 / r });
      }
    } else if (comp.type === 'builtin_speaker') {
      const n1 = getPinNode(comp.id, 'sp_plus');
      const n2 = getPinNode(comp.id, 'sp_minus');
      if (n1 !== -1 && n2 !== -1 && n1 !== n2) {
        const r = Math.max(0.1, typeof props.impedance === 'number' ? props.impedance : 8);
        passiveBridges.push({ n1, n2, G: 1 / r });
      }
    }
  }

  const activeGateOutputs = new Map<string, 0 | 1>();

  for (let step = 0; step < 100; step++) {
    let changed = false;

    // A. Propagate driven potentials across passive bridges (series resistors & voltage dividers)
    for (let n = 1; n <= numNodes; n++) {
      if (stiffDrivenNodes.has(n)) continue;
      let weightedSum = 0;
      let totalG = 0;
      for (const br of passiveBridges) {
        if (br.n1 === n && drivenNodes.has(br.n2)) {
          weightedSum += br.G * drivenNodes.get(br.n2)!;
          totalG += br.G;
        } else if (br.n2 === n && drivenNodes.has(br.n1)) {
          weightedSum += br.G * drivenNodes.get(br.n1)!;
          totalG += br.G;
        }
      }
      if (totalG > 0) {
        const vEst = weightedSum / totalG;
        const prev = drivenNodes.get(n);
        if (prev === undefined || Math.abs(prev - vEst) > 1e-4) {
          drivenNodes.set(n, vEst);
          changed = true;
        }
      }
    }

    // B. Evaluate all Logic Gates & 555 Timers unidirectionally (Input -> Output)
    for (const comp of components) {
      if (comp.type === 'ic-555' || comp.type === 'builtin_555' || comp.type === 'timer-555') {
        const outNode = getPinNode(comp.id, 'out', 'pin3_out', 'pin3', 'output');
        const tSec = clockMs / 1000;
        const freq = typeof comp.properties?.frequency === 'number' ? comp.properties.frequency : 1.0;
        const duty = typeof comp.properties?.dutyCycle === 'number' ? comp.properties.dutyCycle / 100 : 0.5;
        const phase = (tSec * freq) % 1.0;
        const outBit: 0 | 1 = phase < duty ? 1 : 0;
        if (activeGateOutputs.get(comp.id) !== outBit) {
          activeGateOutputs.set(comp.id, outBit);
          changed = true;
        }
        if (outNode > 0) {
          const vOut = outBit === 1 ? 5.0 : 0.0;
          stiffDrivenNodes.add(outNode);
          if (drivenNodes.get(outNode) !== vOut) {
            drivenNodes.set(outNode, vOut);
            changed = true;
          }
        }
      } else if (comp.type === 'gate-not' || comp.type === 'gate-buffer') {
        const inNode = getPinNode(comp.id, 'in', 'in_a', 'in1', 'a');
        const outNode = getPinNode(comp.id, 'out', 'output');
        if (inNode === -1 || !drivenNodes.has(inNode)) {
          // Universal Rule 1: Unconnected or floating ('Z') input -> High-Z ('Z') output
          if (activeGateOutputs.has(comp.id)) {
            activeGateOutputs.delete(comp.id);
            changed = true;
          }
        } else {
          const vIn = drivenNodes.get(inNode)!;
          const inHigh = vIn >= 2.0;
          const outBit: 0 | 1 = comp.type === 'gate-not' ? (inHigh ? 0 : 1) : (inHigh ? 1 : 0);
          if (activeGateOutputs.get(comp.id) !== outBit) {
            activeGateOutputs.set(comp.id, outBit);
            changed = true;
          }
          if (outNode > 0) {
            const vOut = outBit === 1 ? 5.0 : 0.0;
            stiffDrivenNodes.add(outNode);
            if (drivenNodes.get(outNode) !== vOut) {
              drivenNodes.set(outNode, vOut);
              changed = true;
            }
          }
        }
      } else if (
        comp.type === 'gate-and' ||
        comp.type === 'gate-or' ||
        comp.type === 'gate-nand' ||
        comp.type === 'gate-nor' ||
        comp.type === 'gate-xor' ||
        comp.type === 'gate-xnor'
      ) {
        const nodeA = getPinNode(comp.id, 'in_a', 'in1', 'a');
        const nodeB = getPinNode(comp.id, 'in_b', 'in2', 'b');
        const outNode = getPinNode(comp.id, 'out', 'output');

        if (nodeA === -1 || nodeB === -1 || !drivenNodes.has(nodeA) || !drivenNodes.has(nodeB)) {
          // Universal Rule 1: Any unconnected or floating ('Z') input -> High-Z ('Z') output
          if (activeGateOutputs.has(comp.id)) {
            activeGateOutputs.delete(comp.id);
            changed = true;
          }
        } else {
          const vA = drivenNodes.get(nodeA)!;
          const vB = drivenNodes.get(nodeB)!;
          const aHigh = vA >= 2.0;
          const bHigh = vB >= 2.0;
          let isHigh = false;
          if (comp.type === 'gate-and') isHigh = aHigh && bHigh;
          else if (comp.type === 'gate-or') isHigh = aHigh || bHigh;
          else if (comp.type === 'gate-nand') isHigh = !(aHigh && bHigh);
          else if (comp.type === 'gate-nor') isHigh = !(aHigh || bHigh);
          else if (comp.type === 'gate-xor') isHigh = aHigh !== bHigh;
          else if (comp.type === 'gate-xnor') isHigh = aHigh === bHigh;

          const outBit: 0 | 1 = isHigh ? 1 : 0;
          if (activeGateOutputs.get(comp.id) !== outBit) {
            activeGateOutputs.set(comp.id, outBit);
            changed = true;
          }
          if (outNode > 0) {
            const vOut = outBit === 1 ? 5.0 : 0.0;
            stiffDrivenNodes.add(outNode);
            if (drivenNodes.get(outNode) !== vOut) {
              drivenNodes.set(outNode, vOut);
              changed = true;
            }
          }
        }
      }
    }

    if (!changed) break;
  }

  // Stamp ONLY active (non-'Z') Logic Gates and 555 Timers as MNA Voltage Sources
  for (const comp of components) {
    if (!activeGateOutputs.has(comp.id)) continue;
    const outBit = activeGateOutputs.get(comp.id)!;
    const outNode = getPinNode(comp.id, 'out', 'pin3_out', 'pin3', 'output');
    if (outNode !== -1) {
      const vOut = outBit === 1 ? 5.0 : 0.0;
      if (outNode === 0) {
        if (vOut > 0) {
          deadShortSources.set(`${comp.id}_out`, { voltage: vOut, current: vOut / 25.0 });
        }
      } else {
        voltageSources.push({
          compId: comp.id,
          posNode: outNode,
          negNode: 0,
          voltage: vOut,
          seriesR: 25.0, // 25Ω internal CMOS channel resistance
          pinId: 'out',
          logicGateType: comp.type,
          inputNodeA:
            comp.type === 'gate-not' || comp.type === 'gate-buffer'
              ? getPinNode(comp.id, 'in', 'in_a', 'in1', 'a')
              : getPinNode(comp.id, 'in_a', 'in1', 'a'),
          inputNodeB: getPinNode(comp.id, 'in_b', 'in2', 'b'),
        });
      }
    }
  }

  const numSources = voltageSources.length;
  const matrixSize = numNodes + numSources;

  // 4. Iterative Newton-Raphson Non-Linear MNA Solver
  // We initialize node voltages to 0V (and Node 0 is strictly 0V)
  const nodeVoltages = new Map<number, number>();
  nodeVoltages.set(0, 0.0);
  for (let i = 1; i <= numNodes; i++) {
    nodeVoltages.set(i, drivenNodes.get(i) ?? 0.0);
  }

  // Pre-seed known positive DC rail and active gate output nodes
  for (const src of voltageSources) {
    if (src.posNode > 0 && src.negNode === 0 && src.voltage > 0) {
      nodeVoltages.set(src.posNode, src.voltage);
    }
  }

  let finalSolution: number[] = new Array(matrixSize).fill(0);
  const MAX_ITERATIONS = 15;
  const CONVERGENCE_THRESHOLD = 0.001; // 1mV

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    // Initialize MNA Matrix A and RHS Vector Z
    const A: number[][] = Array.from({ length: matrixSize }, () => new Array(matrixSize).fill(0));
    const Z: number[] = new Array(matrixSize).fill(0);

    // GMIN shunt to ground (1e-9 S) on all nodes to prevent floating singularity
    for (let i = 0; i < numNodes; i++) {
      A[i][i] += 1e-9;
    }

    // Helper to add conductance G between node1 and node2
    const stampConductance = (node1: number, node2: number, G: number) => {
      if (G <= 0 || !isFinite(G)) return;
      if (node1 > 0) A[node1 - 1][node1 - 1] += G;
      if (node2 > 0) A[node2 - 1][node2 - 1] += G;
      if (node1 > 0 && node2 > 0) {
        A[node1 - 1][node2 - 1] -= G;
        A[node2 - 1][node1 - 1] -= G;
      }
    };

    // Helper to stamp diode companion current source on RHS
    // For diode current Id = Gd * (Va - Vc - Vf) = Gd*(Va - Vc) - Gd*Vf
    // Current leaving Anode moves to RHS as +Gd*Vf
    // Current entering Cathode moves to RHS as -Gd*Vf
    const stampDiodeRHS = (anodeNode: number, cathodeNode: number, Ieq: number) => {
      if (anodeNode > 0) Z[anodeNode - 1] += Ieq;
      if (cathodeNode > 0) Z[cathodeNode - 1] -= Ieq;
    };

    // Stamp Passives & Actuators
    for (const comp of components) {
      const props = comp.properties || {};

      switch (comp.type) {
        case 'resistor':
        case 'builtin_resistor': {
          const n1 = getPinNode(comp.id, 'p1', 'pin1', 't1');
          const n2 = getPinNode(comp.id, 'p2', 'pin2', 't2');
          if (n1 !== -1 && n2 !== -1 && n1 !== n2) {
            const r = Math.max(0.01, typeof props.resistance === 'number' ? props.resistance : 1000);
            stampConductance(n1, n2, 1 / r);
          }
          break;
        }

        case 'potentiometer': {
          const t1 = getPinNode(comp.id, 't1');
          const wiper = getPinNode(comp.id, 'wiper');
          const t2 = getPinNode(comp.id, 't2');
          const maxR = typeof props.maxResistance === 'number' ? props.maxResistance : 10000;
          const pos = Math.max(0.001, Math.min(0.999, (typeof props.position === 'number' ? props.position : 50) / 100));

          const r1 = Math.max(0.1, pos * maxR);
          const r2 = Math.max(0.1, (1 - pos) * maxR);

          if (t1 !== -1 && wiper !== -1 && t1 !== wiper) {
            stampConductance(t1, wiper, 1 / r1);
          }
          if (wiper !== -1 && t2 !== -1 && wiper !== t2) {
            stampConductance(wiper, t2, 1 / r2);
          }
          break;
        }

        case 'light-sensor': {
          const n1 = getPinNode(comp.id, 'p1', 'pin1');
          const n2 = getPinNode(comp.id, 'p2', 'pin2');
          if (n1 !== -1 && n2 !== -1 && n1 !== n2) {
            const lux = typeof props.lux === 'number' ? props.lux : 100;
            const threshold = typeof props.threshold === 'number' ? props.threshold : 500;
            if (lux >= threshold) {
              const r = Math.max(50, Math.round(500000 / Math.pow(Math.max(1, lux), 0.7)));
              stampConductance(n1, n2, 1 / r);
            } else {
              stampConductance(n1, n2, 1 / 1000000);
              const isN1Vcc = (nodeVoltages.get(n1) ?? 0) >= 3.0;
              const isN2Vcc = (nodeVoltages.get(n2) ?? 0) >= 3.0;
              if (isN1Vcc && n2 > 0) {
                stampConductance(n2, 0, 1 / 1000);
              } else if (isN2Vcc && n1 > 0) {
                stampConductance(n1, 0, 1 / 1000);
              }
            }
          }
          break;
        }

        case 'capacitor-ceramic':
        case 'capacitor-electrolytic': {
          // Backward Euler companion model: G_eq = C / dt, I_eq = G_eq * V_prev
          const pos = getPinNode(comp.id, 'pos', 'p1', '+');
          const neg = getPinNode(comp.id, 'neg', 'p2', '-');
          if (pos !== -1 && neg !== -1 && pos !== neg) {
            const capFarad = Math.max(1e-12, typeof props.capacitance === 'number' ? props.capacitance * 1e-6 : 10e-6);
            const geq = capFarad / Math.max(1e-4, timeStepSec);
            stampConductance(pos, neg, geq);

            const vPrev = dynamicCapacitorVoltages.get(comp.id) || 0;
            const ieq = geq * vPrev;
            // Cap current enters pos and leaves neg
            if (pos > 0) Z[pos - 1] += ieq;
            if (neg > 0) Z[neg - 1] -= ieq;
          }
          break;
        }

        case 'inductor':
        case 'builtin_inductor': {
          // Backward Euler companion model: G_eq = dt / L, I_eq = I_prev
          const n1 = getPinNode(comp.id, 'p1', 'pin1');
          const n2 = getPinNode(comp.id, 'p2', 'pin2');
          if (n1 !== -1 && n2 !== -1 && n1 !== n2) {
            const indHenry = Math.max(1e-9, typeof props.inductance === 'number' ? props.inductance * 1e-3 : 1e-3);
            const geq = Math.max(1e-4, timeStepSec) / indHenry;
            stampConductance(n1, n2, geq);

            const iPrev = dynamicInductorCurrents.get(comp.id) || 0;
            if (n1 > 0) Z[n1 - 1] -= iPrev;
            if (n2 > 0) Z[n2 - 1] += iPrev;
          }
          break;
        }

        case 'pushbutton': {
          const n1 = getPinNode(comp.id, 'p1', 'pin1');
          const n2 = getPinNode(comp.id, 'p2', 'pin2');
          if (n1 !== -1 && n2 !== -1 && n1 !== n2) {
            const isClosed = Boolean(props.isPressed === true || comp.state?.isPressed === true);
            if (isClosed) {
              stampConductance(n1, n2, 100.0); // 0.01 ohm closed resistance
            }
            // When OPEN: G_open = 0, strictly zero conductance/leakage across open terminals!
          }
          break;
        }

        case 'builtin_spst_switch':
        case 'builtin_switch_spst': {
          const n1 = getPinNode(comp.id, 'p1', 'com');
          const n2 = getPinNode(comp.id, 'p2');
          if (n1 !== -1 && n2 !== -1 && n1 !== n2) {
            const isClosed = Boolean(props.closed === true || comp.state?.closed === true);
            if (isClosed) {
              stampConductance(n1, n2, 100.0); // 0.01 ohm closed resistance
            }
            // When OPEN: G_open = 0, strictly zero conductance/leakage across open terminals!
          }
          break;
        }

        case 'toggle-switch': {
          const com = getPinNode(comp.id, 'com');
          const t1 = getPinNode(comp.id, 't1');
          const t2 = getPinNode(comp.id, 't2');
          const isT1 = props.state !== 'T2';
          if (com !== -1) {
            if (isT1 && t1 !== -1 && com !== t1) {
              stampConductance(com, t1, 100.0);
            }
            if (!isT1 && t2 !== -1 && com !== t2) {
              stampConductance(com, t2, 100.0);
            }
            // Unselected terminal has zero conductance (G_open = 0)!
          }
          break;
        }

        case 'buzzer': {
          const pos = getPinNode(comp.id, 'pos', '+', 'p1');
          const neg = getPinNode(comp.id, 'neg', '-', 'p2');
          if (pos !== -1 && neg !== -1 && pos !== neg) {
            const rBuzzer = 100; // Piezo transducer internal impedance (~100 Ohm)
            stampConductance(pos, neg, 1 / rBuzzer);
          }
          break;
        }

        case 'dc-fan': {
          const pos = getPinNode(comp.id, 'pos', 'vcc', '+');
          const neg = getPinNode(comp.id, 'neg', 'gnd', '-');
          if (pos !== -1 && neg !== -1 && pos !== neg) {
            const rFan = 40; // 12V Brushless motor internal resistance (~40 Ohm, ~300mA)
            stampConductance(pos, neg, 1 / rFan);
          }
          break;
        }

        case 'builtin_dc_motor':
        case 'dc-motor': {
          const pos = getPinNode(comp.id, 'm_plus', 'pos', '+');
          const neg = getPinNode(comp.id, 'm_minus', 'neg', '-');
          if (pos !== -1 && neg !== -1 && pos !== neg) {
            const rMotor = 20; // 20 Ohm brushed DC motor winding resistance
            stampConductance(pos, neg, 1 / rMotor);
          }
          break;
        }

        case 'builtin_servo_motor':
        case 'servo-motor': {
          const vcc = getPinNode(comp.id, 'vcc');
          const gnd = getPinNode(comp.id, 'gnd');
          const sig = getPinNode(comp.id, 'sig');
          if (vcc !== -1 && gnd !== -1 && vcc !== gnd) {
            stampConductance(vcc, gnd, 1 / 200);
          }
          if (sig !== -1 && gnd !== -1 && sig !== gnd) {
            stampConductance(sig, gnd, 1 / 10000);
          }
          break;
        }

        case 'builtin_humidity_sensor':
        case 'humidity-sensor':
        case 'builtin_motion_sensor':
        case 'motion-sensor':
        case 'builtin_accelerometer':
        case 'accelerometer':
        case 'builtin_soil_moisture':
        case 'builtin_hall_sensor':
        case 'builtin_vibration_sensor':
        case 'builtin_ir_rx': {
          const vcc = getPinNode(comp.id, 'vcc');
          const gnd = getPinNode(comp.id, 'gnd');
          if (vcc !== -1 && gnd !== -1 && vcc !== gnd) {
            stampConductance(vcc, gnd, 1 / 250);
          }
          break;
        }

        case 'builtin_rf_radio': {
          const vcc = getPinNode(comp.id, 'vcc');
          const gnd = getPinNode(comp.id, 'gnd');
          const gndRef = gnd !== -1 ? gnd : 0;
          if (vcc !== -1 && vcc !== gndRef) {
            stampConductance(vcc, gndRef, 1 / 250); // Internal IC quiescent consumption
          }
          const tx = getPinNode(comp.id, 'tx');
          if (tx !== -1 && tx !== gndRef) {
            stampConductance(tx, gndRef, 1 / 100000); // 100kΩ internal pull-down on TX input to GND
          }
          break;
        }

        case 'builtin_filament_bulb': {
          const n1 = getPinNode(comp.id, 'p1');
          const n2 = getPinNode(comp.id, 'p2');
          if (n1 !== -1 && n2 !== -1 && n1 !== n2) {
            const rBulb = Math.max(0.1, typeof props.resistance === 'number' ? props.resistance : 24);
            stampConductance(n1, n2, 1 / rBulb);
          }
          break;
        }

        case 'builtin_water_pump': {
          const pos = getPinNode(comp.id, 'p_plus');
          const neg = getPinNode(comp.id, 'p_minus');
          if (pos !== -1 && neg !== -1 && pos !== neg) {
            const rPump = Math.max(0.1, typeof props.resistance === 'number' ? props.resistance : 25);
            stampConductance(pos, neg, 1 / rPump);
          }
          break;
        }

        case 'builtin_solenoid': {
          const pos = getPinNode(comp.id, 's_plus');
          const neg = getPinNode(comp.id, 's_minus');
          if (pos !== -1 && neg !== -1 && pos !== neg) {
            const rCoil = Math.max(0.1, typeof props.coilResistance === 'number' ? props.coilResistance : 20);
            stampConductance(pos, neg, 1 / rCoil);
          }
          break;
        }

        case 'builtin_speaker': {
          const pos = getPinNode(comp.id, 'sp_plus');
          const neg = getPinNode(comp.id, 'sp_minus');
          if (pos !== -1 && neg !== -1 && pos !== neg) {
            const rSpk = Math.max(0.1, typeof props.impedance === 'number' ? props.impedance : 8);
            stampConductance(pos, neg, 1 / rSpk);
          }
          break;
        }

        case 'builtin_gas_sensor':
        case 'gas-sensor': {
          const vcc = getPinNode(comp.id, 'vcc');
          const gnd = getPinNode(comp.id, 'gnd');
          if (vcc !== -1 && gnd !== -1 && vcc !== gnd) {
            stampConductance(vcc, gnd, 1 / 100); // MQ-2 internal heater resistance
          }
          break;
        }

        case 'builtin_oled_display':
        case 'oled-display':
        case 'builtin_lcd_16x2':
        case 'lcd-16x2':
        case 'builtin_sd_card':
        case 'sd-card': {
          const vcc = getPinNode(comp.id, 'vcc');
          const gnd = getPinNode(comp.id, 'gnd');
          if (vcc !== -1 && gnd !== -1 && vcc !== gnd) {
            stampConductance(vcc, gnd, 1 / 200);
          }
          break;
        }

        case 'builtin_dcdc_converter':
        case 'dcdc-converter': {
          const vinP = getPinNode(comp.id, 'vin_plus', 'vin+');
          const vinM = getPinNode(comp.id, 'vin_minus', 'vin-');
          const voutP = getPinNode(comp.id, 'vout_plus', 'vout+');
          const voutM = getPinNode(comp.id, 'vout_minus', 'vout-');
          const inNeg = vinM !== -1 ? vinM : 0;
          const outNeg = voutM !== -1 ? voutM : 0;

          const vInP = vinP !== -1 ? (nodeVoltages.get(vinP) ?? 0.0) : 0.0;
          const vInM = inNeg > 0 ? (nodeVoltages.get(inNeg) ?? 0.0) : 0.0;
          const vIn = Math.max(0, vInP - vInM);

          const mode = String(props.mode || props.converterMode || 'auto').toLowerCase();
          const targetV = typeof props.targetVoltage === 'number' ? props.targetVoltage : 12.0;

          let vTarget = 0.0;
          if (vIn >= 2.5) {
            if (mode.includes('buck') && !mode.includes('boost')) {
              vTarget = Math.min(targetV, Math.max(0, vIn - 0.5));
            } else if (mode.includes('boost') && !mode.includes('buck')) {
              vTarget = Math.max(targetV, vIn);
            } else {
              vTarget = targetV;
            }
          }

          if (voutP !== -1 && voutP !== outNeg) {
            const rOut = 0.5; // 0.5 ohm output impedance
            const gOut = 1.0 / rOut;
            stampConductance(voutP, outNeg, gOut);
            if (voutP > 0) Z[voutP - 1] += gOut * vTarget;
            if (outNeg > 0) Z[outNeg - 1] -= gOut * vTarget;

            const vOutP_curr = nodeVoltages.get(voutP) ?? 0.0;
            const vOutM_curr = outNeg > 0 ? (nodeVoltages.get(outNeg) ?? 0.0) : 0.0;
            const vOut_curr = Math.max(0, vOutP_curr - vOutM_curr);
            const iOut = Math.max(0, (vTarget - vOut_curr) * gOut);

            const efficiency = 0.90;
            const pOut = vTarget * iOut;
            const pIn = pOut / efficiency;
            const iQuiescent = 0.005; // 5mA quiescent current
            const iIn = (vIn > 0.5 ? pIn / vIn : 0) + iQuiescent;

            if (vinP !== -1 && vinP !== inNeg && vIn > 0.05) {
              const gIn = iIn / Math.max(0.2, vIn);
              stampConductance(vinP, inNeg, gIn);
            }
          } else if (vinP !== -1 && vinP !== inNeg) {
            stampConductance(vinP, inNeg, 0.005 / Math.max(0.2, vIn));
          }
          break;
        }

        case 'builtin_reg_7805':
        case 'voltage-regulator-7805':
        case 'lm7805': {
          const inNode = getPinNode(comp.id, 'in', 'vin', 'input');
          const outNode = getPinNode(comp.id, 'out', 'vout', 'output');
          const gndNode = getPinNode(comp.id, 'gnd', 'ground');
          const gndRef = gndNode !== -1 ? gndNode : 0;

          const vInRaw = inNode !== -1 ? (nodeVoltages.get(inNode) ?? 0.0) : 0.0;
          const vGndRaw = gndRef > 0 ? (nodeVoltages.get(gndRef) ?? 0.0) : 0.0;
          const vIn = Math.max(0, vInRaw - vGndRaw);

          let vTarget = 0.0;
          if (vIn >= 7.0) {
            vTarget = 5.0;
          } else if (vIn > 2.0) {
            vTarget = Math.max(0, vIn - 2.0); // 2.0V dropout
          } else {
            vTarget = 0.0;
          }

          if (outNode !== -1 && outNode !== gndRef) {
            const rOut = 0.5; // 0.5 ohm output resistance
            const gOut = 1.0 / rOut;
            stampConductance(outNode, gndRef, gOut);
            if (outNode > 0) Z[outNode - 1] += gOut * vTarget;
            if (gndRef > 0) Z[gndRef - 1] -= gOut * vTarget;

            const vOutRaw = nodeVoltages.get(outNode) ?? 0.0;
            const vOut = Math.max(0, vOutRaw - vGndRaw);
            const iOut = Math.max(0, (vTarget - vOut) * gOut);
            const iQuiescent = 0.002; // 2mA quiescent current
            const iIn = iOut + iQuiescent;

            if (inNode !== -1 && inNode !== gndRef && vIn > 0.05) {
              const gIn = iIn / Math.max(0.2, vIn);
              stampConductance(inNode, gndRef, gIn);
            }
          } else if (inNode !== -1 && inNode !== gndRef) {
            stampConductance(inNode, gndRef, 0.002 / Math.max(0.2, vIn));
          }
          break;
        }

        case 'opamp':
        case 'builtin_opamp': {
          const inPNode = getPinNode(comp.id, 'in_pos', 'in_plus', 'in+', 'inp');
          const inNNode = getPinNode(comp.id, 'in_neg', 'in_minus', 'in-', 'inm');
          const outNode = getPinNode(comp.id, 'out', 'output');
          const vPosNode = getPinNode(comp.id, 'v_pos', 'vcc', 'power');
          const vNegNode = getPinNode(comp.id, 'v_neg', 'vee', 'gnd', 'ground');
          const gndRef = vNegNode !== -1 ? vNegNode : 0;

          if (outNode !== -1 && outNode !== gndRef) {
            const vRailPos = vPosNode !== -1 ? (nodeVoltages.get(vPosNode) ?? 15.0) : 15.0;
            const vRailNeg = vNegNode !== -1 ? (nodeVoltages.get(vNegNode) ?? 0.0) : 0.0;
            const aol = Math.min(10000, typeof props.openLoopGain === 'number' ? props.openLoopGain : 10000);
            const vMid = (vRailPos + vRailNeg) / 2.0;

            const rOut = 10.0; // 10 ohm output resistance
            const gOut = 1.0 / rOut;

            // Stamp linear VCVS output branch: Gout * (Vout - (Vmid + AOL*(Vp - Vn))) = 0
            stampConductance(outNode, gndRef, gOut);
            if (outNode > 0) {
              if (inPNode > 0) A[outNode - 1][inPNode - 1] -= gOut * aol;
              if (inNNode > 0) A[outNode - 1][inNNode - 1] += gOut * aol;
              Z[outNode - 1] += gOut * vMid;
            }
            if (gndRef > 0) {
              if (inPNode > 0) A[gndRef - 1][inPNode - 1] += gOut * aol;
              if (inNNode > 0) A[gndRef - 1][inNNode - 1] -= gOut * aol;
              Z[gndRef - 1] -= gOut * vMid;
            }
          }
          break;
        }

        case 'relay':
        case 'builtin_relay': {
          const vcc = getPinNode(comp.id, 'vcc');
          const gnd = getPinNode(comp.id, 'gnd');
          const inNode = getPinNode(comp.id, 'in');
          const com = getPinNode(comp.id, 'com');
          const no = getPinNode(comp.id, 'no');
          const nc = getPinNode(comp.id, 'nc');

          // Coil resistance 70 ohm between VCC and GND
          if (vcc !== -1 && gnd !== -1 && vcc !== gnd) {
            stampConductance(vcc, gnd, 1 / 70.0);
          }

          const vVcc = vcc !== -1 ? (nodeVoltages.get(vcc) ?? 5.0) : 5.0;
          const vGnd = gnd !== -1 ? (nodeVoltages.get(gnd) ?? 0.0) : 0.0;
          const vIn = inNode !== -1 ? (nodeVoltages.get(inNode) ?? 0.0) : 0.0;
          const vDiff = vVcc - vGnd;
          const triggerActive = props.triggerActive ?? 'LOW';
          const expectedSig = triggerActive === 'LOW' ? (vIn - vGnd <= 1.5) : (vIn - vGnd >= 2.5);
          const isEngaged = vDiff >= 3.5 && expectedSig;

          if (com !== -1) {
            if (isEngaged && no !== -1 && com !== no) {
              stampConductance(com, no, 20.0); // 0.05 ohm
            }
            if (!isEngaged && nc !== -1 && com !== nc) {
              stampConductance(com, nc, 20.0); // 0.05 ohm
            }
          }
          break;
        }

        case 'fuse':
        case 'builtin_fuse': {
          const n1 = getPinNode(comp.id, 'p1');
          const n2 = getPinNode(comp.id, 'p2');
          const isBlown = props.isBlown === true || comp.state?.isBlown === true;
          if (!isBlown && n1 !== -1 && n2 !== -1 && n1 !== n2) {
            stampConductance(n1, n2, 20.0); // 0.05 ohm
          }
          break;
        }

        case 'builtin_dip_switch_4': {
          for (let i = 1; i <= 4; i++) {
            const inNode = getPinNode(comp.id, `in${i}`);
            const outNode = getPinNode(comp.id, `out${i}`);
            const isClosed = props[`sw${i}`] === true;
            if (isClosed && inNode !== -1 && outNode !== -1 && inNode !== outNode) {
              stampConductance(inNode, outNode, 100.0);
            }
          }
          break;
        }

        case 'builtin_optocoupler': {
          const a = getPinNode(comp.id, 'anode');
          const k = getPinNode(comp.id, 'cathode');
          const c = getPinNode(comp.id, 'collector');
          const e = getPinNode(comp.id, 'emitter');
          if (a !== -1 && k !== -1 && a !== k) {
            const va = nodeVoltages.get(a) ?? 0;
            const vk = nodeVoltages.get(k) ?? 0;
            const ifFwd = va - vk >= 1.1;
            if (ifFwd) {
              stampConductance(a, k, 1 / 100); // IR LED forward conduction
            }
            if (c !== -1 && e !== -1 && c !== e) {
              if (ifFwd) {
                stampConductance(c, e, 1 / 10.0);
              }
            }
          }
          break;
        }

        case 'builtin_led_bar_graph': {
          const gnd = getPinNode(comp.id, 'gnd');
          const gndRef = gnd !== -1 ? gnd : 0;
          for (let i = 1; i <= 10; i++) {
            const bn = getPinNode(comp.id, `b${i}`);
            if (bn !== -1 && bn !== gndRef) {
              const vb = nodeVoltages.get(bn) ?? 0;
              const vg = nodeVoltages.get(gndRef) ?? 0;
              if (vb - vg >= 1.8) {
                stampConductance(bn, gndRef, 1 / 120);
              }
            }
          }
          break;
        }

        case 'builtin_stepper_motor': {
          const ap = getPinNode(comp.id, 'a_plus');
          const am = getPinNode(comp.id, 'a_minus');
          const bp = getPinNode(comp.id, 'b_plus');
          const bm = getPinNode(comp.id, 'b_minus');
          if (ap !== -1 && am !== -1 && ap !== am) {
            stampConductance(ap, am, 1 / 30);
          }
          if (bp !== -1 && bm !== -1 && bp !== bm) {
            stampConductance(bp, bm, 1 / 30);
          }
          break;
        }

        // ----------------------------------------------------
        // Non-Linear Components (Diodes, LEDs, Transistors)
        // Evaluated iteratively using current node voltages
        // ----------------------------------------------------
        case 'builtin_bridge_rectifier': {
          const ac1 = getPinNode(comp.id, 'ac1');
          const ac2 = getPinNode(comp.id, 'ac2');
          const dcP = getPinNode(comp.id, 'dc_plus');
          const dcM = getPinNode(comp.id, 'dc_minus');

          const stampBridgeDiode = (anode: number, cathode: number) => {
            if (anode !== -1 && cathode !== -1 && anode !== cathode) {
              const va = nodeVoltages.get(anode) ?? 0;
              const vc = nodeVoltages.get(cathode) ?? 0;
              const vDiff = va - vc;
              const vf = 0.7;
              if (vDiff >= vf) {
                const ron = 1.0;
                const gd = 1 / ron;
                stampConductance(anode, cathode, gd);
                stampDiodeRHS(anode, cathode, gd * vf);
              } else {
                stampConductance(anode, cathode, 1e-9);
              }
            }
          };

          // Full-wave 4-diode bridge:
          // D1: ac1 -> dc_plus
          stampBridgeDiode(ac1, dcP);
          // D2: ac2 -> dc_plus
          stampBridgeDiode(ac2, dcP);
          // D3: dc_minus -> ac1
          stampBridgeDiode(dcM, ac1);
          // D4: dc_minus -> ac2
          stampBridgeDiode(dcM, ac2);
          break;
        }

        case 'diode':
        case 'diode-1n4148':
        case 'diode-1n4007':
        case 'zener-diode':
        case 'builtin_zener': {
          const anode = getPinNode(comp.id, 'anode', 'pos', '+', 'p1');
          const cathode = getPinNode(comp.id, 'cathode', 'neg', '-', 'p2');
          if (anode !== -1 && cathode !== -1 && anode !== cathode) {
            const va = nodeVoltages.get(anode) ?? 0;
            const vc = nodeVoltages.get(cathode) ?? 0;
            const vDiff = va - vc;
            const isZener = comp.type === 'zener-diode' || comp.type === 'builtin_zener';
            const vz = typeof props.zenerVoltage === 'number' ? props.zenerVoltage : 5.1;
            const vf = typeof props.forwardVoltage === 'number' ? props.forwardVoltage : 0.7;

            if (vDiff >= vf) {
              // Forward ON
              const ron = 1.0;
              const gd = 1 / ron;
              stampConductance(anode, cathode, gd);
              stampDiodeRHS(anode, cathode, gd * vf);
            } else if (isZener && vDiff <= -vz) {
              // Zener reverse breakdown ON (Rz = 2.0 Ohm, Gz = 0.5 S clamping)
              const rz = typeof props.zenerResistance === 'number' ? props.zenerResistance : 2.0;
              const gz = 1 / rz;
              stampConductance(cathode, anode, gz);
              stampDiodeRHS(cathode, anode, gz * vz);
            } else {
              // Sub-threshold OFF
              stampConductance(anode, cathode, 1e-9);
            }
          }
          break;
        }

        case 'led':
        case 'builtin_led':
        case 'led-red':
        case 'led-green':
        case 'led-blue':
        case 'led-yellow': {
          const anode = getPinNode(comp.id, 'anode', 'pos', '+', 'p1');
          const cathode = getPinNode(comp.id, 'cathode', 'neg', '-', 'p2');
          if (anode !== -1 && cathode !== -1 && anode !== cathode) {
            const va = nodeVoltages.get(anode) ?? 0;
            const vc = nodeVoltages.get(cathode) ?? 0;
            const vDiff = va - vc;

            const vf =
              typeof props.forwardVoltage === 'number'
                ? props.forwardVoltage
                : comp.type === 'led-red'
                ? 1.8
                : comp.type === 'led-green'
                ? 2.1
                : comp.type === 'led-blue'
                ? 3.0
                : 2.0;

            if (vDiff >= vf) {
              // Forward ON
              const ron = 15.0; // Dynamic internal forward slope resistance
              const gd = 1 / ron;
              stampConductance(anode, cathode, gd);
              stampDiodeRHS(anode, cathode, gd * vf);
            } else if (vDiff >= 1.45) {
              // Soft sub-threshold knee conduction (enables series LEDs driven by 5V logic gates)
              const vKnee = 1.45;
              const rKnee = 50.0;
              const gKnee = 1 / rKnee;
              stampConductance(anode, cathode, gKnee);
              stampDiodeRHS(anode, cathode, gKnee * vKnee);
            } else if (vDiff < -5.0) {
              // Reverse breakdown conduction
              const rBr = 10.0;
              const gBr = 1 / rBr;
              stampConductance(cathode, anode, gBr);
              stampDiodeRHS(cathode, anode, gBr * 5.0);
            } else {
              // OFF
              stampConductance(anode, cathode, 1e-9);
            }
          }
          break;
        }

        case 'transistor-npn':
        case 'builtin_npn': {
          const base = getPinNode(comp.id, 'base', 'b');
          const collector = getPinNode(comp.id, 'collector', 'c');
          const emitter = getPinNode(comp.id, 'emitter', 'e');
          if (base !== -1 && emitter !== -1) {
            const vb = nodeVoltages.get(base) ?? 0;
            const ve = nodeVoltages.get(emitter) ?? 0;
            const vc = collector !== -1 ? nodeVoltages.get(collector) ?? 0 : ve;
            const vbe = vb - ve;
            const vce = vc - ve;

            if (vbe >= 0.65) {
              // Base-emitter diode conducting
              const gbe = 1 / 200; // 200 ohm internal base-emitter forward resistance
              stampConductance(base, emitter, gbe);
              stampDiodeRHS(base, emitter, gbe * 0.65);

              // Collector-emitter channel conduction
              if (collector !== -1 && collector !== emitter) {
                const hfe = typeof props.gainHfe === 'number' ? props.gainHfe : typeof props.beta === 'number' ? props.beta : 100;
                const ib = Math.max(0, (vbe - 0.65) / 200);
                const icDesired = hfe * ib;
                const rce = vce > 0.3 ? Math.max(2.0, vce / Math.max(1e-4, icDesired)) : 2.0;
                stampConductance(collector, emitter, 1 / rce);
              }
            } else {
              stampConductance(base, emitter, 1e-9);
              if (collector !== -1 && collector !== emitter) {
                stampConductance(collector, emitter, 1e-9);
              }
            }
          }
          break;
        }

        case 'builtin_pnp':
        case 'transistor-pnp': {
          const base = getPinNode(comp.id, 'base', 'b');
          const collector = getPinNode(comp.id, 'collector', 'c');
          const emitter = getPinNode(comp.id, 'emitter', 'e');
          if (base !== -1 && emitter !== -1) {
            const vb = nodeVoltages.get(base) ?? 0;
            const ve = nodeVoltages.get(emitter) ?? 0;
            const vc = collector !== -1 ? nodeVoltages.get(collector) ?? 0 : ve;
            const veb = ve - vb;
            const vec = ve - vc;

            if (veb >= 0.65) {
              // Emitter-base diode conducting
              const geb = 1 / 200; // 200 ohm internal emitter-base forward resistance
              stampConductance(emitter, base, geb);
              stampDiodeRHS(emitter, base, geb * 0.65);

              // Emitter-collector channel conduction
              if (collector !== -1 && collector !== emitter) {
                const hfe = typeof props.gainHfe === 'number' ? props.gainHfe : typeof props.beta === 'number' ? props.beta : 100;
                const ib = Math.max(0, (veb - 0.65) / 200);
                const icDesired = hfe * ib;
                const rec = vec > 0.3 ? Math.max(2.0, vec / Math.max(1e-4, icDesired)) : 2.0;
                stampConductance(emitter, collector, 1 / rec);
              }
            } else {
              stampConductance(emitter, base, 1e-9);
              if (collector !== -1 && collector !== emitter) {
                stampConductance(emitter, collector, 1e-9);
              }
            }
          }
          break;
        }

        case 'mosfet-n':
        case 'builtin_nmos': {
          const gate = getPinNode(comp.id, 'gate', 'g');
          const drain = getPinNode(comp.id, 'drain', 'd');
          const source = getPinNode(comp.id, 'source', 's');
          if (gate !== -1 && drain !== -1 && source !== -1) {
            const vg = nodeVoltages.get(gate) ?? 0;
            const vs = nodeVoltages.get(source) ?? 0;
            const vgs = vg - vs;
            const vth = typeof props.vth === 'number' ? props.vth : 2.0;

            if (vgs >= vth) {
              const rds = typeof props.rdsOn === 'number' ? Math.max(0.01, props.rdsOn) : 0.5;
              stampConductance(drain, source, 1 / rds);
            } else {
              stampConductance(drain, source, 1e-8);
            }
          }
          break;
        }

        case 'builtin_pmos':
        case 'mosfet-p': {
          const gate = getPinNode(comp.id, 'gate', 'g');
          const drain = getPinNode(comp.id, 'drain', 'd');
          const source = getPinNode(comp.id, 'source', 's');
          if (gate !== -1 && drain !== -1 && source !== -1) {
            const vg = nodeVoltages.get(gate) ?? 0;
            const vs = nodeVoltages.get(source) ?? 0;
            const vsg = vs - vg;
            const vth = typeof props.vth === 'number' ? props.vth : 2.0;

            if (vsg >= vth) {
              const rsd = typeof props.rdsOn === 'number' ? Math.max(0.01, props.rdsOn) : 0.5;
              stampConductance(source, drain, 1 / rsd);
            } else {
              stampConductance(source, drain, 1e-8);
            }
          }
          break;
        }

        case 'builtin_comparator': {
          const outNode = getPinNode(comp.id, 'out', 'output');
          const inPNode = getPinNode(comp.id, 'in_plus', 'in+', 'inp');
          const inMNode = getPinNode(comp.id, 'in_minus', 'in-', 'inm');
          const vccNode = getPinNode(comp.id, 'vcc', 'power');
          const gndNode = getPinNode(comp.id, 'gnd', 'ground');
          const gndRef = gndNode !== -1 ? gndNode : 0;

          if (outNode !== -1 && outNode !== gndRef) {
            const vVCC = vccNode !== -1 ? (nodeVoltages.get(vccNode) ?? 5.0) : 5.0;
            const vGND = gndRef !== 0 ? (nodeVoltages.get(gndRef) ?? 0.0) : 0.0;
            const vP = inPNode !== -1 ? (nodeVoltages.get(inPNode) ?? 0.0) : 0.0;
            const isMConnected = inMNode !== -1;
            const vM = isMConnected
              ? (nodeVoltages.get(inMNode) ?? 0.0)
              : (typeof props.thresholdVoltage === 'number' ? props.thresholdVoltage : 2.5);

            const vTarget = vP > vM ? vVCC : vGND;
            const rOut = 25.0; // 25 ohm output impedance
            const gOut = 1.0 / rOut;
            stampConductance(outNode, gndRef, gOut);
            if (outNode > 0) Z[outNode - 1] += gOut * vTarget;
            if (gndRef > 0) Z[gndRef - 1] -= gOut * vTarget;
          }
          break;
        }

        case 'builtin_hbridge': {
          const out1 = getPinNode(comp.id, 'out1');
          const out2 = getPinNode(comp.id, 'out2');
          const in1 = getPinNode(comp.id, 'in1');
          const in2 = getPinNode(comp.id, 'in2');
          const ena = getPinNode(comp.id, 'ena');
          const vcc = getPinNode(comp.id, 'vcc');
          const gnd = getPinNode(comp.id, 'gnd');
          const gndRef = gnd !== -1 ? gnd : 0;

          const vEna = ena !== -1 ? (nodeVoltages.get(ena) ?? 5.0) : 5.0;
          const vIn1 = in1 !== -1 ? (nodeVoltages.get(in1) ?? 0.0) : 0.0;
          const vIn2 = in2 !== -1 ? (nodeVoltages.get(in2) ?? 0.0) : 0.0;
          const vVcc = vcc !== -1 ? (nodeVoltages.get(vcc) ?? 12.0) : 12.0;
          const vGnd = gndRef !== 0 ? (nodeVoltages.get(gndRef) ?? 0.0) : 0.0;

          if (vEna >= 2.0) {
            const rDriver = 2.0; // 2.0 ohm output driver impedance
            const gDriver = 1.0 / rDriver;

            let target1 = vGnd;
            let target2 = vGnd;
            if (vIn1 >= 2.0 && vIn2 < 2.0) {
              target1 = vVcc;
              target2 = vGnd;
            } else if (vIn2 >= 2.0 && vIn1 < 2.0) {
              target1 = vGnd;
              target2 = vVcc;
            }

            if (out1 !== -1 && out1 !== gndRef) {
              stampConductance(out1, gndRef, gDriver);
              if (out1 > 0) Z[out1 - 1] += gDriver * target1;
              if (gndRef > 0) Z[gndRef - 1] -= gDriver * target1;
            }
            if (out2 !== -1 && out2 !== gndRef) {
              stampConductance(out2, gndRef, gDriver);
              if (out2 > 0) Z[out2 - 1] += gDriver * target2;
              if (gndRef > 0) Z[gndRef - 1] -= gDriver * target2;
            }
          }
          break;
        }

        case 'builtin_traffic_light': {
          const gnd = getPinNode(comp.id, 'gnd');
          if (gnd !== -1) {
            const vg = nodeVoltages.get(gnd) ?? 0;
            for (const p of ['r', 'y', 'g']) {
              const pNode = getPinNode(comp.id, p);
              if (pNode !== -1 && pNode !== gnd) {
                const vp = nodeVoltages.get(pNode) ?? 0;
                const vDiff = vp - vg;
                if (vDiff >= 1.8) {
                  const gd = 1 / 150.0; // 150Ω integrated current-limiting resistor + 2.0V LED drop
                  stampConductance(pNode, gnd, gd);
                  stampDiodeRHS(pNode, gnd, gd * 2.0);
                } else {
                  stampConductance(pNode, gnd, 1e-9);
                }
              }
            }
          }
          break;
        }

        case 'builtin_ir_tx': {
          const anode = getPinNode(comp.id, 'anode', 'pos', '+', 'p1');
          const cathode = getPinNode(comp.id, 'cathode', 'neg', '-', 'p2');
          if (anode !== -1 && cathode !== -1 && anode !== cathode) {
            const va = nodeVoltages.get(anode) ?? 0;
            const vc = nodeVoltages.get(cathode) ?? 0;
            const vDiff = va - vc;
            const vf = typeof props.forwardVoltage === 'number' ? props.forwardVoltage : 1.4;
            const ron = typeof props.ron === 'number' ? props.ron : 10.0;
            if (vDiff >= vf) {
              const gd = 1 / ron;
              stampConductance(anode, cathode, gd);
              stampDiodeRHS(anode, cathode, gd * vf);
            } else if (vDiff >= 1.1) {
              const gKnee = 1 / 40.0;
              stampConductance(anode, cathode, gKnee);
              stampDiodeRHS(anode, cathode, gKnee * 1.1);
            } else {
              stampConductance(anode, cathode, 1e-9);
            }
          }
          break;
        }
      }
    }

    // Dynamically update Wireless IR Receiver & Wireless RF Radio output sources inside Newton-Raphson
    for (const src of voltageSources) {
      const srcComp = components.find((c) => c.id === src.compId);
      if (!srcComp) continue;
      if (srcComp.type === 'builtin_ir_rx' && src.pinId === 'out') {
        const vccNode = getPinNode(srcComp.id, 'vcc');
        const gndNode = getPinNode(srcComp.id, 'gnd');
        const vVcc = vccNode !== -1 ? (nodeVoltages.get(vccNode) ?? 5.0) : 5.0;
        const vGnd = gndNode !== -1 ? (nodeVoltages.get(gndNode) ?? 0.0) : 0.0;
        const isPowered = (vccNode === -1 || vVcc - vGnd >= 2.5) && (gndNode === -1 || vGnd <= 2.5);
        let irActive = srcComp.properties?.irDetected === true;
        if (isPowered && !irActive) {
          for (const other of components) {
            if (other.type === 'builtin_ir_tx') {
              const dist = Math.hypot((other.x ?? 0) - (srcComp.x ?? 0), (other.y ?? 0) - (srcComp.y ?? 0));
              if (dist <= 600) {
                const aNode = getPinNode(other.id, 'anode', 'pos', '+', 'p1');
                const cNode = getPinNode(other.id, 'cathode', 'neg', '-', 'p2');
                if (aNode !== -1 && cNode !== -1 && aNode !== cNode) {
                  const va = nodeVoltages.get(aNode) ?? 0;
                  const vc = nodeVoltages.get(cNode) ?? 0;
                  const vf = typeof other.properties?.forwardVoltage === 'number' ? other.properties.forwardVoltage : 1.4;
                  const ron = typeof other.properties?.ron === 'number' ? other.properties.ron : 10.0;
                  const ifCurrent = va - vc >= vf ? (va - vc - vf) / ron : va - vc >= 1.1 ? (va - vc - 1.1) / 40.0 : 0;
                  const maxI = typeof other.properties?.maxCurrent === 'number' ? other.properties.maxCurrent : 0.05;
                  if (ifCurrent >= 0.002 && ifCurrent <= maxI) {
                    irActive = true;
                    break;
                  }
                }
              }
            }
          }
        }
        src.voltage = isPowered && irActive ? 5.0 : 0.0;
        if (src.posNode > 0) drivenNodes.set(src.posNode, src.voltage);
      } else if (srcComp.type === 'builtin_rf_radio' && src.pinId === 'rx') {
        const vccNode = getPinNode(srcComp.id, 'vcc');
        const gndNode = getPinNode(srcComp.id, 'gnd');
        const vVcc = vccNode !== -1 ? (nodeVoltages.get(vccNode) ?? 5.0) : 5.0;
        const vGnd = gndNode !== -1 ? (nodeVoltages.get(gndNode) ?? 0.0) : 0.0;
        const isPowered = (vccNode === -1 || vVcc - vGnd >= 3.0) && (gndNode !== -1 && vGnd <= 2.5);
        const myChannel = srcComp.properties?.rfChannel || 'CH 1 (433.0 MHz)';
        let rxV = 0.0;
        if (isPowered) {
          for (const other of components) {
            if (other.id !== srcComp.id && other.type === 'builtin_rf_radio') {
              const otherChannel = other.properties?.rfChannel || 'CH 1 (433.0 MHz)';
              if (otherChannel === myChannel) {
                const oVccNode = getPinNode(other.id, 'vcc');
                const oGndNode = getPinNode(other.id, 'gnd');
                const oTxNode = getPinNode(other.id, 'tx');
                const oVcc = oVccNode !== -1 ? (nodeVoltages.get(oVccNode) ?? 5.0) : 5.0;
                const oGnd = oGndNode !== -1 ? (nodeVoltages.get(oGndNode) ?? 0.0) : 0.0;
                const oSupply = oVcc - oGnd;
                const oPowered = (oVccNode === -1 || oSupply >= 3.0) && (oGndNode !== -1 && oGnd <= 2.5);
                const oTxConnected = oTxNode !== -1;
                const oTx = oTxConnected ? (nodeVoltages.get(oTxNode) ?? 0.0) - oGnd : 0.0;
                if (oPowered && oTxConnected && oTx >= 2.0) {
                  rxV = 5.0;
                  break;
                }
              }
            }
          }
        }
        src.voltage = rxV;
        if (src.posNode > 0) drivenNodes.set(src.posNode, src.voltage);
      }
    }

    // Re-evaluate logic gate source voltages inside Newton-Raphson ONLY if transistors/MOSFETs
    // or wireless RX bridges are present and might switch a gate input node after iter >= 2
    const hasTransistors = components.some(
      (c) =>
        c.type === 'transistor-npn' ||
        c.type === 'builtin_npn' ||
        c.type === 'transistor-pnp' ||
        c.type === 'builtin_pnp' ||
        c.type === 'mosfet-n' ||
        c.type === 'builtin_nmos' ||
        c.type === 'mosfet-p' ||
        c.type === 'builtin_pmos' ||
        c.type === 'builtin_ir_rx' ||
        c.type === 'builtin_rf_radio'
    );
    if (hasTransistors && iter >= 2) {
      for (const src of voltageSources) {
        if (src.logicGateType && src.logicGateType !== 'ic-555') {
          let isHigh = false;
          if (src.logicGateType === 'gate-not' || src.logicGateType === 'gate-buffer') {
            if (src.inputNodeA === undefined || src.inputNodeA <= 0 || !drivenNodes.has(src.inputNodeA)) continue;
            const vIn = nodeVoltages.get(src.inputNodeA) ?? 0;
            isHigh = src.logicGateType === 'gate-not' ? vIn < 2.0 : vIn >= 2.0;
          } else {
            if (
              src.inputNodeA === undefined ||
              src.inputNodeB === undefined ||
              !drivenNodes.has(src.inputNodeA) ||
              !drivenNodes.has(src.inputNodeB)
            ) {
              continue;
            }
            const vA = src.inputNodeA > 0 ? (nodeVoltages.get(src.inputNodeA) ?? 0) : 0;
            const vB = src.inputNodeB > 0 ? (nodeVoltages.get(src.inputNodeB) ?? 0) : 0;
            const aHigh = vA >= 2.0;
            const bHigh = vB >= 2.0;

            if (src.logicGateType === 'gate-and') isHigh = aHigh && bHigh;
            else if (src.logicGateType === 'gate-or') isHigh = aHigh || bHigh;
            else if (src.logicGateType === 'gate-nand') isHigh = !(aHigh && bHigh);
            else if (src.logicGateType === 'gate-nor') isHigh = !(aHigh || bHigh);
            else if (src.logicGateType === 'gate-xor') isHigh = aHigh !== bHigh;
            else if (src.logicGateType === 'gate-xnor') isHigh = aHigh === bHigh;
          }
          src.voltage = isHigh ? 5.0 : 0.0;
          activeGateOutputs.set(src.compId, isHigh ? 1 : 0);
        }
      }
    }

    // Stamp Voltage Source Branches (B, C, D blocks)
    for (let k = 0; k < numSources; k++) {
      const src = voltageSources[k];
      const branchRow = numNodes + k;

      if (src.posNode > 0) {
        A[src.posNode - 1][branchRow] += 1;
        A[branchRow][src.posNode - 1] += 1;
      }
      if (src.negNode > 0) {
        A[src.negNode - 1][branchRow] -= 1;
        A[branchRow][src.negNode - 1] -= 1;
      }

      A[branchRow][branchRow] = -src.seriesR;
      Z[branchRow] = src.voltage;
    }

    // Solve Matrix Equation A * X = Z
    const solution = MatrixSolver.solve(A, Z);
    finalSolution = solution;

    // Check convergence
    let maxDiff = 0;
    for (let i = 1; i <= numNodes; i++) {
      const vOld = nodeVoltages.get(i) ?? 0.0;
      const vNew = solution[i - 1] ?? 0.0;
      maxDiff = Math.max(maxDiff, Math.abs(vNew - vOld));
      // Damped update for stable convergence
      nodeVoltages.set(i, 0.7 * vNew + 0.3 * vOld);
    }

    // Clamp opamp outputs to rails if saturated
    for (const comp of components) {
      if (comp.type === 'opamp' || comp.type === 'builtin_opamp') {
        const outNode = getPinNode(comp.id, 'out', 'output');
        const vPosNode = getPinNode(comp.id, 'v_pos', 'vcc', 'power');
        const vNegNode = getPinNode(comp.id, 'v_neg', 'vee', 'gnd', 'ground');
        const vRailPos = vPosNode !== -1 ? (nodeVoltages.get(vPosNode) ?? 15.0) : 15.0;
        const vRailNeg = vNegNode !== -1 ? (nodeVoltages.get(vNegNode) ?? 0.0) : 0.0;
        if (outNode > 0) {
          const vRaw = nodeVoltages.get(outNode) ?? 0.0;
          nodeVoltages.set(outNode, Math.max(vRailNeg, Math.min(vRailPos, vRaw)));
        }
      }
    }

    if (maxDiff < CONVERGENCE_THRESHOLD && iter >= 1) {
      break;
    }
  }

  // Final Node Voltages Map
  nodeVoltages.set(0, 0.0); // Ground is strictly 0V reference
  for (let i = 1; i <= numNodes; i++) {
    nodeVoltages.set(i, finalSolution[i - 1] || 0.0);
  }

  // Map to Electrical Nets
  const netVoltages = new Map<string, number>();
  for (const [netId, nodeId] of netToNodeId.entries()) {
    netVoltages.set(netId, nodeVoltages.get(nodeId) ?? 0.0);
  }

  // Map to Wires
  const wireVoltages = new Map<string, number>();
  const wireCurrents = new Map<string, number>();
  for (const wire of wires) {
    const net = wireToNetMap.get(wire.id);
    const v = net ? netVoltages.get(net.id) ?? 0.0 : 0.0;
    wireVoltages.set(wire.id, v);
    wireCurrents.set(wire.id, 0.0);
  }

  // 5. Post-Process Component Voltages, Currents, Power, Output Visuals & Overload Detection
  const componentResults = new Map<string, SpiceComponentResult>();

  for (const comp of components) {
    const props = comp.properties || {};
    const pinVoltages: Record<string, number> = {};

    const isPinConnected = (...pinCandidates: string[]): boolean => {
      return getPinNode(comp.id, ...pinCandidates) !== -1;
    };

    const getPinV = (...pinCandidates: string[]): number => {
      const n = getPinNode(comp.id, ...pinCandidates);
      const v = n === -1 ? 0.0 : nodeVoltages.get(n) ?? 0.0;
      if (pinCandidates[0]) {
        pinVoltages[pinCandidates[0]] = v;
      }
      return v;
    };

    let voltageDropV = 0.0;
    let currentA = 0.0;
    let powerW = 0.0;
    let isOverloaded = false;
    let isBurned = false;
    let overloadReason: string | undefined;
    let brightness: number | undefined;
    let rpm: number | undefined;
    let direction: 'CW' | 'CCW' | 'IDLE' | undefined;
    let servoAngle: number | undefined;
    let sdActivity: boolean | undefined;
    let isSounding: boolean | undefined;
    let outputVoltage: number | undefined;
    let logicOutput: 0 | 1 | 'Z' | 'X' | undefined;
    let cResultIsEngaged: boolean | undefined = undefined;
    let inputCurrentA: number | undefined = undefined;
    let outputCurrentA: number | undefined = undefined;
    let redLit: boolean | undefined = undefined;
    let yellowLit: boolean | undefined = undefined;
    let greenLit: boolean | undefined = undefined;
    let flowRateLpm: number | undefined = undefined;
    let isTransmitting: boolean | undefined = undefined;
    let isReceiving: boolean | undefined = undefined;
    let isEmitting: boolean | undefined = undefined;
    let isReceivingIr: boolean | undefined = undefined;

    switch (comp.type) {
      case 'resistor':
      case 'builtin_resistor': {
        const isConn1 = isPinConnected('p1', 'pin1');
        const isConn2 = isPinConnected('p2', 'pin2');
        if (!isConn1 || !isConn2) {
          // Open circuit! Floating pin floats to connected pin's voltage
          const vConn = isConn1 ? getPinV('p1', 'pin1') : isConn2 ? getPinV('p2', 'pin2') : 0.0;
          pinVoltages['p1'] = vConn;
          pinVoltages['p2'] = vConn;
          voltageDropV = 0.0;
          currentA = 0.0;
          powerW = 0.0;
          isOverloaded = false;
          isBurned = false;
          break;
        }

        const v1 = getPinV('p1', 'pin1');
        const v2 = getPinV('p2', 'pin2');
        voltageDropV = Math.abs(v1 - v2);
        const r = Math.max(0.01, typeof props.resistance === 'number' ? props.resistance : 1000);
        currentA = voltageDropV / r;
        powerW = voltageDropV * currentA;

        // Resistor Overload check (default rated power 0.25W / 250mW)
        const maxP = typeof props.powerRating === 'number' ? props.powerRating : typeof props.maxPowerW === 'number' ? props.maxPowerW : 0.25;
        if (powerW > maxP) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `Power dissipation ${powerW.toFixed(2)}W exceeds maximum rating of ${maxP}W! Burned out from thermal overload.`;
        }
        break;
      }

      case 'potentiometer': {
        const isConnT1 = isPinConnected('t1');
        const isConnT2 = isPinConnected('t2');
        const isConnW = isPinConnected('wiper');

        if (!isConnW && !isConnT1 && !isConnT2) {
          voltageDropV = 0.0;
          currentA = 0.0;
          powerW = 0.0;
          break;
        }

        const vT1 = getPinV('t1');
        const vWiper = getPinV('wiper');
        const vT2 = getPinV('t2');

        const maxR = typeof props.maxResistance === 'number' ? props.maxResistance : 10000;
        const pos = Math.max(0.001, Math.min(0.999, (typeof props.position === 'number' ? props.position : 50) / 100));
        const r1 = Math.max(0.1, pos * maxR);
        const r2 = Math.max(0.1, (1 - pos) * maxR);

        const i1 = isConnT1 && isConnW ? Math.abs(vT1 - vWiper) / r1 : 0;
        const i2 = isConnT2 && isConnW ? Math.abs(vT2 - vWiper) / r2 : 0;
        currentA = Math.max(i1, i2);
        powerW = i1 * i1 * r1 + i2 * i2 * r2;
        voltageDropV = Math.max(isConnT1 && isConnW ? Math.abs(vT1 - vWiper) : 0, isConnT2 && isConnW ? Math.abs(vT2 - vWiper) : 0);

        if (powerW > 0.5) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `Potentiometer resistive track overheated (${powerW.toFixed(2)}W > 0.5W rating)!`;
        }
        break;
      }

      case 'toggle-switch': {
        const isT1 = props.state !== 'T2';
        const activePin = isT1 ? 't1' : 't2';
        const vCom = getPinV('com');
        const vAct = getPinV(activePin);
        voltageDropV = Math.abs(vCom - vAct);
        currentA = voltageDropV / 0.01;
        powerW = voltageDropV * currentA;
        break;
      }

      case 'pushbutton': {
        const isPressed = Boolean(comp.state?.isPressed || props.isPressed);
        if (isPressed) {
          voltageDropV = Math.abs(getPinV('p1') - getPinV('p2'));
          currentA = voltageDropV / 0.01;
          powerW = voltageDropV * currentA;
        } else {
          voltageDropV = 0.0;
          currentA = 0.0;
          powerW = 0.0;
        }
        break;
      }

      case 'builtin_spst_switch':
      case 'builtin_switch_spst': {
        const isClosed = Boolean(props.closed ?? comp.state?.closed);
        if (isClosed) {
          const v1 = getPinV('p1', 'com');
          const v2 = getPinV('p2');
          voltageDropV = Math.abs(v1 - v2);
          currentA = voltageDropV / 0.01;
          powerW = voltageDropV * currentA;
        } else {
          voltageDropV = 0.0;
          currentA = 0.0;
          powerW = 0.0;
        }
        break;
      }

      case 'led':
      case 'builtin_led':
      case 'led-red':
      case 'led-green':
      case 'led-blue':
      case 'led-yellow': {
        const isConnA = isPinConnected('anode', 'pos', '+', 'p1');
        const isConnC = isPinConnected('cathode', 'neg', '-', 'p2');
        if (!isConnA || !isConnC) {
          // Open circuit! Floating pin floats to connected pin's voltage
          const vConn = isConnA ? getPinV('anode', 'pos', '+', 'p1') : isConnC ? getPinV('cathode', 'neg', '-', 'p2') : 0.0;
          pinVoltages['anode'] = vConn;
          pinVoltages['cathode'] = vConn;
          voltageDropV = 0.0;
          currentA = 0.0;
          powerW = 0.0;
          brightness = 0.0;
          isOverloaded = false;
          isBurned = false;
          overloadReason = undefined;
          break;
        }

        const nodeA = getPinNode(comp.id, 'anode', 'pos', '+', 'p1');
        const nodeC = getPinNode(comp.id, 'cathode', 'neg', '-', 'p2');
        if (nodeA === nodeC) {
          // Anode and Cathode shorted together
          voltageDropV = 0.0;
          currentA = 0.0;
          powerW = 0.0;
          brightness = 0.0;
          isOverloaded = false;
          isBurned = false;
          break;
        }

        const vAnode = getPinV('anode', 'pos', '+', 'p1');
        const vCathode = getPinV('cathode', 'neg', '-', 'p2');
        const vDiff = vAnode - vCathode;
        voltageDropV = vDiff;

        const vf =
          typeof props.forwardVoltage === 'number'
            ? props.forwardVoltage
            : comp.type === 'led-red'
            ? 1.8
            : comp.type === 'led-green'
            ? 2.1
            : comp.type === 'led-blue'
            ? 3.0
            : 2.0;

        if (vDiff >= vf) {
          // Forward conduction
          currentA = Math.max(0, (vDiff - vf) / 15.0);
          powerW = vDiff * currentA;
          // Full brightness at 20mA (0.02A)
          brightness = Math.min(1.0, currentA / 0.02);

          // LED Overcurrent Overload: > 30mA (e.g. hooked directly across battery without resistor)
          if (currentA > 0.03) {
            isOverloaded = true;
            isBurned = true;
            overloadReason = `Forward current ${(currentA * 1000).toFixed(0)}mA exceeds maximum 30mA limit! Caught fire without current-limiting resistor.`;
          }
        } else if (vDiff >= 1.45) {
          // Soft sub-threshold knee conduction (e.g. series LEDs driven by 5V logic gate)
          currentA = Math.max(0, (vDiff - 1.45) / 60.0);
          powerW = vDiff * currentA;
          brightness = Math.min(1.0, currentA / 0.012);
        } else if (vDiff < -5.0) {
          // Reverse breakdown destruction (> 5V reverse bias)
          currentA = Math.abs(vDiff + 5.0) / 10.0;
          powerW = Math.abs(vDiff) * currentA;
          brightness = 0.0;
          isOverloaded = true;
          isBurned = true;
          overloadReason = `Reverse breakdown voltage ${Math.abs(vDiff).toFixed(1)}V exceeds maximum 5V limit! Reverse bias destroyed LED junction.`;
        } else {
          // Sub-threshold or reversed within safe limit
          brightness = 0.0;
        }
        break;
      }

      case 'diode':
      case 'diode-1n4148':
      case 'diode-1n4007':
      case 'zener-diode':
      case 'builtin_zener': {
        const isConnA = isPinConnected('anode', 'pos', '+', 'p1');
        const isConnC = isPinConnected('cathode', 'neg', '-', 'p2');
        if (!isConnA || !isConnC) {
          const vConn = isConnA ? getPinV('anode', 'pos', '+', 'p1') : isConnC ? getPinV('cathode', 'neg', '-', 'p2') : 0.0;
          pinVoltages['anode'] = vConn;
          pinVoltages['cathode'] = vConn;
          voltageDropV = 0.0;
          currentA = 0.0;
          powerW = 0.0;
          isOverloaded = false;
          isBurned = false;
          break;
        }

        const vAnode = getPinV('anode', 'pos', '+', 'p1');
        const vCathode = getPinV('cathode', 'neg', '-', 'p2');
        const vDiff = vAnode - vCathode;
        voltageDropV = Math.abs(vDiff);
        const isZener = comp.type === 'zener-diode' || comp.type === 'builtin_zener';
        const vz = typeof props.zenerVoltage === 'number' ? props.zenerVoltage : 5.1;
        const maxP = typeof props.maxPower === 'number' ? props.maxPower : 0.5;

        if (vDiff > 0.7) {
          currentA = (vDiff - 0.7) / 1.0;
          powerW = vDiff * currentA;
          if (currentA > 1.0 || powerW > 1.0) {
            isOverloaded = true;
            isBurned = true;
            overloadReason = `Diode thermal burnout! Forward current ${currentA.toFixed(2)}A exceeds 1.0A maximum rating.`;
          }
        } else if (isZener && vDiff <= -vz) {
          // Normal reverse Zener regulation clamping (NO reverse polarity warning!)
          const rz = typeof props.zenerResistance === 'number' ? props.zenerResistance : 2.0;
          const vRev = -vDiff; // vc - va
          currentA = (vRev - vz) / rz;
          powerW = vRev * currentA;
          if (powerW > maxP) {
            isOverloaded = true;
            isBurned = true;
            overloadReason = `Zener thermal burnout! Power dissipation ${powerW.toFixed(2)}W exceeds maximum ${maxP.toFixed(2)}W rating.`;
          }
        }
        break;
      }

      case 'capacitor-electrolytic': {
        const isConnPos = isPinConnected('pos', '+', 'p1');
        const isConnNeg = isPinConnected('neg', '-', 'p2');
        if (!isConnPos || !isConnNeg) {
          const vConn = isConnPos ? getPinV('pos', '+', 'p1') : isConnNeg ? getPinV('neg', '-', 'p2') : 0.0;
          pinVoltages['pos'] = vConn;
          pinVoltages['neg'] = vConn;
          voltageDropV = 0.0;
          currentA = 0.0;
          isOverloaded = false;
          isBurned = false;
          break;
        }

        const vPos = getPinV('pos', '+', 'p1');
        const vNeg = getPinV('neg', '-', 'p2');
        voltageDropV = vPos - vNeg;

        const vPrev = dynamicCapacitorVoltages.get(comp.id) ?? 0.0;
        const capFarad = Math.max(1e-12, typeof props.capacitance === 'number' ? props.capacitance * 1e-6 : 10e-6);
        const geq = capFarad / Math.max(1e-4, timeStepSec);
        currentA = Math.abs(geq * (voltageDropV - vPrev));
        powerW = Math.abs(voltageDropV * currentA);
        dynamicCapacitorVoltages.set(comp.id, voltageDropV);

        const vMax = typeof props.maxVoltage === 'number' ? props.maxVoltage : 16.0;

        // Electrolytic Capacitor polarity and overvoltage checks
        if (vNeg > vPos + 0.8) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `Exploded due to reversed polarity connection (${(vNeg - vPos).toFixed(1)}V reverse bias)!`;
        } else if (voltageDropV > vMax) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `Dielectric breakdown! Applied voltage ${voltageDropV.toFixed(1)}V exceeds rated ${vMax}V.`;
        }
        break;
      }

      case 'capacitor-ceramic': {
        const isConn1 = isPinConnected('p1', 'pos');
        const isConn2 = isPinConnected('p2', 'neg');
        if (!isConn1 || !isConn2) {
          const vConn = isConn1 ? getPinV('p1', 'pos') : isConn2 ? getPinV('p2', 'neg') : 0.0;
          pinVoltages['p1'] = vConn;
          pinVoltages['p2'] = vConn;
          voltageDropV = 0.0;
          currentA = 0.0;
          isOverloaded = false;
          isBurned = false;
          break;
        }

        const v1 = getPinV('p1', 'pos');
        const v2 = getPinV('p2', 'neg');
        voltageDropV = Math.abs(v1 - v2);
        const vPrev = dynamicCapacitorVoltages.get(comp.id) ?? 0.0;
        const capFarad = Math.max(1e-12, typeof props.capacitance === 'number' ? props.capacitance * 1e-6 : 0.1e-6);
        const geq = capFarad / Math.max(1e-4, timeStepSec);
        currentA = Math.abs(geq * ((v1 - v2) - vPrev));
        powerW = Math.abs(voltageDropV * currentA);
        dynamicCapacitorVoltages.set(comp.id, v1 - v2);
        const vMax = typeof props.maxVoltage === 'number' ? props.maxVoltage : 50.0;
        if (voltageDropV > vMax) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `Ceramic capacitor dielectric breakdown (${voltageDropV.toFixed(1)}V > ${vMax}V rating)!`;
        }
        break;
      }

      case 'inductor':
      case 'builtin_inductor': {
        const isConn1 = isPinConnected('p1');
        const isConn2 = isPinConnected('p2');
        if (!isConn1 || !isConn2) {
          const vConn = isConn1 ? getPinV('p1') : isConn2 ? getPinV('p2') : 0.0;
          pinVoltages['p1'] = vConn;
          pinVoltages['p2'] = vConn;
          voltageDropV = 0.0;
          currentA = 0.0;
          break;
        }

        const v1 = getPinV('p1');
        const v2 = getPinV('p2');
        voltageDropV = Math.abs(v1 - v2);
        const indHenry = Math.max(1e-9, typeof props.inductance === 'number' ? props.inductance * 1e-3 : 1e-3);
        const iPrev = dynamicInductorCurrents.get(comp.id) || 0;
        const iNext = iPrev + ((v1 - v2) * timeStepSec) / indHenry;
        dynamicInductorCurrents.set(comp.id, iNext);
        currentA = Math.abs(iNext);
        powerW = voltageDropV * currentA;
        break;
      }

      case 'dc-fan': {
        const isConnPos = isPinConnected('pos', 'vcc', '+');
        const isConnNeg = isPinConnected('neg', 'gnd', '-');
        if (!isConnPos || !isConnNeg) {
          const vConn = isConnPos ? getPinV('pos', 'vcc', '+') : isConnNeg ? getPinV('neg', 'gnd', '-') : 0.0;
          pinVoltages['pos'] = vConn;
          pinVoltages['neg'] = vConn;
          voltageDropV = 0.0;
          currentA = 0.0;
          powerW = 0.0;
          rpm = 0.0;
          isOverloaded = false;
          isBurned = false;
          break;
        }

        const vPos = getPinV('pos', 'vcc', '+');
        const vNeg = getPinV('neg', 'gnd', '-');
        voltageDropV = Math.max(0, vPos - vNeg);
        currentA = voltageDropV / 40.0;
        powerW = voltageDropV * currentA;

        // Fan spins when voltage >= 2.5V
        if (voltageDropV >= 2.5) {
          rpm = Math.min(3000, Math.round((voltageDropV / 12) * 2500));
        } else {
          rpm = 0;
        }

        // Fan overvoltage check (rated 12V, max 14V)
        if (voltageDropV > 14.0 || currentA > 0.35) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `Motor coil burned out! Applied voltage ${voltageDropV.toFixed(1)}V exceeds 14V rating.`;
        }
        break;
      }

      case 'builtin_dc_motor':
      case 'dc-motor': {
        const isConnPlus = isPinConnected('m_plus', 'pos', '+');
        const isConnMinus = isPinConnected('m_minus', 'neg', '-');
        if (!isConnPlus || !isConnMinus) {
          const vConn = isConnPlus
            ? getPinV('m_plus', 'pos', '+')
            : isConnMinus
            ? getPinV('m_minus', 'neg', '-')
            : 0.0;
          pinVoltages['m_plus'] = vConn;
          pinVoltages['m_minus'] = vConn;
          voltageDropV = 0.0;
          currentA = 0.0;
          powerW = 0.0;
          rpm = 0;
          direction = 'IDLE';
          isOverloaded = false;
          isBurned = false;
          break;
        }

        const vPlus = getPinV('m_plus', 'pos', '+');
        const vMinus = getPinV('m_minus', 'neg', '-');
        const vSigned = vPlus - vMinus;
        voltageDropV = Math.abs(vSigned);
        currentA = voltageDropV / 20.0;
        powerW = voltageDropV * currentA;

        if (voltageDropV >= 0.5) {
          rpm = Math.min(9000, Math.round(voltageDropV * 500));
          direction = vSigned >= 0 ? 'CW' : 'CCW';
        } else {
          rpm = 0;
          direction = 'IDLE';
        }

        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 18.0;
        if (voltageDropV > maxV) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `DC Brushed Motor windings burned out! Applied voltage ${voltageDropV.toFixed(1)}V exceeds ${maxV}V rating.`;
        }
        break;
      }

      case 'builtin_servo_motor':
      case 'servo-motor': {
        const isConnVcc = isPinConnected('vcc');
        const isConnGnd = isPinConnected('gnd');
        const isConnSig = isPinConnected('sig');
        const vVcc = isConnVcc ? getPinV('vcc') : 5.0;
        const vGnd = isConnGnd ? getPinV('gnd') : 0.0;
        const vSig = isConnSig ? getPinV('sig') : 0.0;
        const vSupply = isConnVcc ? Math.max(0, vVcc - vGnd) : 5.0;

        voltageDropV = vSupply;
        currentA = isConnVcc && isConnGnd ? vSupply / 200.0 : 0.0;
        powerW = voltageDropV * currentA;

        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 7.5;
        if (isConnVcc && vSupply > maxV) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `SG90 Servo controller IC burned out! Supply voltage ${vSupply.toFixed(1)}V exceeds ${maxV}V max rating.`;
        }

        let resolvedAngle = 0;

        const isPowered = (!isConnVcc || vVcc >= 3.0) && (!isConnGnd || vGnd <= 0.8) && vSupply >= 3.0;
        if (isPowered && isConnSig) {
          const sigNet = pinToNetMap.get(`${comp.id}:sig`);
          let foundMcuAngle: number | undefined;
          if (sigNet) {
            for (const pinRef of sigNet.pins) {
              if (pinRef.compId === comp.id) continue;
              const otherComp = components.find((c) => c.id === pinRef.compId);
              const mcuPins = otherComp?.state?.pins as Record<string, any> | undefined;
              if (mcuPins) {
                const pObj =
                  mcuPins[pinRef.pinId] ||
                  mcuPins[pinRef.pinId.toLowerCase()] ||
                  mcuPins[pinRef.pinId.toUpperCase()] ||
                  (pinRef.pinId.toLowerCase().startsWith('d')
                    ? mcuPins[pinRef.pinId.substring(1)]
                    : mcuPins[`D${pinRef.pinId}`]);
                if (pObj) {
                  if (typeof pObj.servoAngle === 'number') {
                    foundMcuAngle = pObj.servoAngle;
                    break;
                  } else if (typeof pObj.pwmValue === 'number' && pObj.pwmValue > 0) {
                    foundMcuAngle = Math.round((pObj.pwmValue / 255) * 180);
                    break;
                  }
                }
              }
            }
          }
          if (foundMcuAngle !== undefined) {
            resolvedAngle = foundMcuAngle;
          } else if (vSig >= 0.5) {
            resolvedAngle = Math.min(180, Math.max(0, Math.round((vSig / 5.0) * 180)));
          } else {
            resolvedAngle = 0;
          }
        } else {
          resolvedAngle = 0;
        }
        servoAngle = Math.max(0, Math.min(180, resolvedAngle));
        break;
      }

      case 'builtin_humidity_sensor':
      case 'humidity-sensor': {
        const isConnVcc = isPinConnected('vcc');
        const isConnGnd = isPinConnected('gnd');
        const vVcc = isConnVcc ? getPinV('vcc') : 5.0;
        const vGnd = isConnGnd ? getPinV('gnd') : 0.0;
        const vOut = isPinConnected('out')
          ? getPinV('out')
          : 5.0 * Math.max(0, Math.min(1, (typeof props.humidity === 'number' ? props.humidity : 45) / 100));
        pinVoltages['out'] = vOut;
        const vSupply = isConnVcc ? Math.max(0, vVcc - vGnd) : 5.0;
        voltageDropV = vSupply;
        currentA = isConnVcc && isConnGnd ? vSupply / 250.0 : 0.0;
        powerW = voltageDropV * currentA;
        outputVoltage = vOut;
        logicOutput = vOut >= 2.0 ? 1 : 0;

        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 6.5;
        if (isConnVcc && vSupply > maxV) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `DHT22 Humidity Sensor destroyed by overvoltage (${vSupply.toFixed(1)}V > ${maxV}V max rating)!`;
        }
        break;
      }

      case 'builtin_motion_sensor':
      case 'motion-sensor': {
        const isConnVcc = isPinConnected('vcc');
        const isConnGnd = isPinConnected('gnd');
        const vVcc = isConnVcc ? getPinV('vcc') : 5.0;
        const vGnd = isConnGnd ? getPinV('gnd') : 0.0;
        const motion = props.motionDetected === true || comp.state?.motionDetected === true;
        const vOut = isPinConnected('out') ? getPinV('out') : motion ? 3.3 : 0.0;
        pinVoltages['out'] = vOut;
        const vSupply = isConnVcc ? Math.max(0, vVcc - vGnd) : 5.0;
        voltageDropV = vSupply;
        currentA = isConnVcc && isConnGnd ? vSupply / 250.0 : 0.0;
        powerW = voltageDropV * currentA;
        outputVoltage = vOut;
        logicOutput = vOut >= 1.4 ? 1 : 0;
        brightness = motion ? 1.0 : 0.0;

        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 20.0;
        if (isConnVcc && vSupply > maxV) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `HC-SR501 PIR Sensor regulator burned out (${vSupply.toFixed(1)}V > ${maxV}V max)!`;
        }
        break;
      }

      case 'builtin_gas_sensor':
      case 'gas-sensor': {
        const isConnVcc = isPinConnected('vcc');
        const isConnGnd = isPinConnected('gnd');
        const vVcc = isConnVcc ? getPinV('vcc') : 5.0;
        const vGnd = isConnGnd ? getPinV('gnd') : 0.0;
        const ppm = typeof props.ppm === 'number' ? props.ppm : 50;
        const threshold = typeof props.threshold === 'number' ? props.threshold : 400;
        const vDo = isPinConnected('do') ? getPinV('do') : ppm >= threshold ? 5.0 : 0.0;
        const vAo = isPinConnected('ao')
          ? getPinV('ao')
          : 0.2 + 4.6 * Math.max(0, Math.min(1, ppm / 2000));
        pinVoltages['do'] = vDo;
        pinVoltages['ao'] = vAo;
        const vSupply = isConnVcc ? Math.max(0, vVcc - vGnd) : 5.0;
        voltageDropV = vSupply;
        currentA = isConnVcc && isConnGnd ? vSupply / 100.0 : 0.0;
        powerW = voltageDropV * currentA;
        outputVoltage = vAo;
        logicOutput = vDo >= 2.0 ? 1 : 0;
        brightness = vDo >= 2.0 ? 1.0 : 0.0;

        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 6.5;
        if (isConnVcc && vSupply > maxV) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `MQ-2 Gas Sensor heater coil burned out (${vSupply.toFixed(1)}V > ${maxV}V max rating)!`;
        }
        break;
      }

      case 'builtin_accelerometer':
      case 'accelerometer': {
        const isConnVcc = isPinConnected('vcc');
        const isConnGnd = isPinConnected('gnd');
        const vVcc = isConnVcc ? getPinV('vcc') : 3.3;
        const vGnd = isConnGnd ? getPinV('gnd') : 0.0;
        const ax = typeof props.accelX === 'number' ? props.accelX : 0.0;
        const ay = typeof props.accelY === 'number' ? props.accelY : 0.0;
        const az = typeof props.accelZ === 'number' ? props.accelZ : 1.0;
        const vx = isPinConnected('x') ? getPinV('x') : Math.max(0, Math.min(3.3, 1.65 + (ax / 3.0) * 1.65));
        const vy = isPinConnected('y') ? getPinV('y') : Math.max(0, Math.min(3.3, 1.65 + (ay / 3.0) * 1.65));
        const vz = isPinConnected('z') ? getPinV('z') : Math.max(0, Math.min(3.3, 1.65 + (az / 3.0) * 1.65));
        pinVoltages['x'] = vx;
        pinVoltages['y'] = vy;
        pinVoltages['z'] = vz;
        const vSupply = isConnVcc ? Math.max(0, vVcc - vGnd) : 3.3;
        voltageDropV = vSupply;
        currentA = isConnVcc && isConnGnd ? vSupply / 250.0 : 0.0;
        powerW = voltageDropV * currentA;
        outputVoltage = vx;
        logicOutput = vx >= 2.0 ? 1 : 0;

        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 6.0;
        if (isConnVcc && vSupply > maxV) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `ADXL335 MEMS Accelerometer destroyed by overvoltage (${vSupply.toFixed(1)}V > ${maxV}V max)!`;
        }
        break;
      }

      case 'builtin_oled_display':
      case 'oled-display':
      case 'builtin_lcd_16x2':
      case 'lcd-16x2':
      case 'builtin_sd_card':
      case 'sd-card': {
        const isConnVcc = isPinConnected('vcc');
        const isConnGnd = isPinConnected('gnd');
        const vVcc = isConnVcc ? getPinV('vcc') : 0.0;
        const vGnd = isConnGnd ? getPinV('gnd') : 0.0;
        const vSda = isPinConnected('sda') ? getPinV('sda') : 0.0;
        const vMosi = isPinConnected('mosi') ? getPinV('mosi') : 0.0;
        const vSck = isPinConnected('sck') ? getPinV('sck') : 0.0;
        const vSupply = isConnVcc ? Math.max(0, vVcc - vGnd) : Math.max(vSda, vMosi, vSck);
        voltageDropV = vSupply;
        currentA = isConnVcc && isConnGnd && vSupply > 0 ? vSupply / 200.0 : 0.0;
        powerW = voltageDropV * currentA;
        brightness = vSupply >= 2.5 ? 1.0 : 0.0;
        if (comp.type === 'builtin_sd_card' || comp.type === 'sd-card') {
          sdActivity = vSupply >= 2.5 && (vMosi >= 1.4 || vSck >= 1.4);
        }

        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 6.5;
        if (isConnVcc && vSupply > maxV) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `Module controller IC damaged by overvoltage (${vSupply.toFixed(1)}V > ${maxV}V max rating)!`;
        }
        break;
      }

      case 'builtin_dcdc_converter':
      case 'dcdc-converter': {
        const isConnVinP = isPinConnected('vin_plus', 'vin+');
        const isConnVinM = isPinConnected('vin_minus', 'vin-');
        const vInP = isConnVinP ? getPinV('vin_plus', 'vin+') : 0.0;
        const vInM = isConnVinM ? getPinV('vin_minus', 'vin-') : 0.0;
        const vIn = Math.max(0, vInP - vInM);

        const vOutP = isPinConnected('vout_plus', 'vout+') ? getPinV('vout_plus', 'vout+') : 0.0;
        const vOutM = isPinConnected('vout_minus', 'vout-') ? getPinV('vout_minus', 'vout-') : 0.0;
        const vOut = Math.max(0, vOutP - vOutM);

        const mode = String(props.mode || props.converterMode || 'auto').toLowerCase();
        const targetV = typeof props.targetVoltage === 'number' ? props.targetVoltage : 12.0;
        let vReg = 0.0;
        if (vIn >= 2.5) {
          vReg = targetV;
          if (mode.includes('buck') && !mode.includes('boost')) {
            vReg = Math.min(targetV, Math.max(0, vIn - 0.5));
          } else if (mode.includes('boost') && !mode.includes('buck')) {
            vReg = Math.max(targetV, vIn);
          }
        }

        pinVoltages['vin_plus'] = vInP;
        pinVoltages['vin_minus'] = vInM;
        pinVoltages['vout_plus'] = vOutP;
        pinVoltages['vout_minus'] = vOutM;
        voltageDropV = vIn;
        outputVoltage = vOut;
        logicOutput = vOut >= 2.0 ? 1 : 0;
        brightness = vIn >= 2.5 ? 1.0 : 0.0;

        const iOut = Math.max(0, (vReg - vOut) / 0.5);
        const pOut = vOut * iOut;
        const pIn = pOut / 0.90;
        const iIn = (vIn > 0.5 ? pIn / vIn : 0) + 0.005;
        inputCurrentA = iIn;
        outputCurrentA = iOut;
        currentA = iIn;
        powerW = vIn * iIn;

        const maxInV = typeof props.maxInputVoltage === 'number' ? props.maxInputVoltage : 40.0;
        if (vIn > maxInV) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `DC-DC Buck-Boost MOSFET regulator exploded from input overvoltage (${vIn.toFixed(1)}V > ${maxInV}V max)!`;
        }
        break;
      }

      case 'builtin_numpad':
      case 'numpad': {
        const activeKey = String(
          props.activeKey ?? props.pressedKey ?? comp.state?.activeKey ?? comp.state?.pressedKey ?? ''
        )
          .trim()
          .toUpperCase();
        const keyOrder = ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D'];
        const keyIdx = keyOrder.indexOf(activeKey) + 1;
        const vOut = isPinConnected('out') ? getPinV('out') : keyIdx > 0 ? keyIdx * 0.3 : 0.0;
        pinVoltages['out'] = vOut;
        outputVoltage = vOut;
        logicOutput = keyIdx > 0 ? 1 : 0;
        break;
      }

      // -----------------------------------------------------------------------
      // PHASE 7.4 & 7.8 POST-SOLUTION RESULTS & TELEMETRY
      // -----------------------------------------------------------------------
      case 'fuse':
      case 'builtin_fuse': {
        const v1 = getPinV('p1');
        const v2 = getPinV('p2');
        voltageDropV = Math.abs(v1 - v2);
        const maxI = typeof props.maxCurrent === 'number' ? props.maxCurrent : 0.1;
        let isBlown = props.isBlown === true || comp.state?.isBlown === true;
        currentA = isBlown ? 0.0 : voltageDropV / 0.05;
        powerW = voltageDropV * currentA;
        if (!isBlown && currentA > maxI) {
          isBlown = true;
          comp.state = { ...(comp.state || {}), isBlown: true };
          if (comp.properties) comp.properties.isBlown = true;
          props.isBlown = true;
        }
        pinVoltages['p1'] = v1;
        pinVoltages['p2'] = v2;
        outputVoltage = isBlown ? 0.0 : v2;
        break;
      }

      case 'builtin_comparator': {
        const vInP = getPinV('in_plus', 'in+', 'inp');
        const isConnInM = isPinConnected('in_minus', 'in-', 'inm');
        const vInM = isConnInM ? getPinV('in_minus', 'in-', 'inm') : (typeof props.thresholdVoltage === 'number' ? props.thresholdVoltage : 2.5);
        const vcc = isPinConnected('vcc') ? getPinV('vcc') : 5.0;
        const vOut = vInP > vInM ? vcc : 0.0;
        outputVoltage = vOut;
        logicOutput = vInP > vInM ? 1 : 0;
        pinVoltages['out'] = vOut;
        break;
      }

      case 'opamp':
      case 'builtin_opamp': {
        const vP = getPinV('in_pos', 'in_plus', 'in+', 'inp');
        const vN = getPinV('in_neg', 'in_minus', 'in-', 'inm');
        const vPos = isPinConnected('v_pos', 'vcc') ? getPinV('v_pos', 'vcc') : 15.0;
        const vNeg = isPinConnected('v_neg', 'vee', 'gnd') ? getPinV('v_neg', 'vee', 'gnd') : 0.0;
        const vOutRaw = getPinV('out', 'output');
        const vOut = Math.max(vNeg, Math.min(vPos, vOutRaw));
        pinVoltages['out'] = vOut;
        outputVoltage = vOut;
        voltageDropV = Math.abs(vP - vN);
        currentA = Math.abs(vOut) / 10.0;
        powerW = Math.abs(vPos - vNeg) * 0.002 + Math.abs(vOut * currentA);
        break;
      }

      case 'relay':
      case 'builtin_relay': {
        const vVcc = isPinConnected('vcc') ? getPinV('vcc') : 5.0;
        const vGnd = isPinConnected('gnd') ? getPinV('gnd') : 0.0;
        const vIn = isPinConnected('in') ? getPinV('in') : 0.0;
        const vDiff = vVcc - vGnd;
        const triggerActive = props.triggerActive ?? 'LOW';
        const expectedSig = triggerActive === 'LOW' ? (vIn - vGnd <= 1.5) : (vIn - vGnd >= 2.5);
        const isEngaged = vDiff >= 3.5 && expectedSig;

        cResultIsEngaged = isEngaged;
        currentA = isEngaged ? vDiff / 70.0 : 0.0; // 70 ohm coil
        powerW = vDiff * currentA;
        break;
      }

      case 'builtin_solar_panel': {
        const lux = typeof props.lux === 'number' ? props.lux : 100;
        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 6.0;
        const vGen = Math.min(maxV, 0.5 + (lux / 1000) * (maxV - 0.5));
        outputVoltage = vGen;
        const vNeg = getPinV('neg', '-', 'p2');
        pinVoltages['neg'] = vNeg;
        pinVoltages['pos'] = isPinConnected('pos', '+', 'p1') ? getPinV('pos', '+', 'p1') : vNeg + vGen;
        break;
      }

      case 'builtin_reg_7805':
      case 'voltage-regulator-7805':
      case 'lm7805': {
        const vIn = getPinV('in', 'vin', 'input');
        const vGnd = getPinV('gnd', 'ground');
        const vOut = getPinV('out', 'vout', 'output');
        const vDiff = Math.max(0, vIn - vGnd);
        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 35.0;
        if (vDiff > maxV) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `LM7805 regulator burned out! Input ${vDiff.toFixed(1)}V exceeds ${maxV}V max rating.`;
        }
        outputVoltage = vOut;
        pinVoltages['in'] = vIn;
        pinVoltages['gnd'] = vGnd;
        pinVoltages['out'] = vOut;

        const vTarget = vDiff >= 7.0 ? 5.0 : Math.max(0, vDiff - 2.0);
        const iOut = Math.max(0, (vTarget - (vOut - vGnd)) / 0.5);
        const iQuiescent = 0.002;
        const iIn = iOut + iQuiescent;
        inputCurrentA = iIn;
        outputCurrentA = iOut;
        currentA = iIn;
        powerW = (vIn - vOut) * iOut + vIn * iQuiescent;
        if (powerW > (typeof props.maxPower === 'number' ? props.maxPower : 15.0)) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `LM7805 thermal burnout! Power dissipation ${powerW.toFixed(2)}W exceeds 15W rating without heatsink.`;
        }
        break;
      }

      case 'builtin_hbridge': {
        const ena = isPinConnected('ena') ? getPinV('ena') : 5.0;
        const in1 = getPinV('in1');
        const in2 = getPinV('in2');
        const vcc = isPinConnected('vcc') ? getPinV('vcc') : 12.0;
        const gnd = isPinConnected('gnd') ? getPinV('gnd') : 0.0;
        const vDiff = vcc - gnd;
        let vOut1 = 0.0;
        let vOut2 = 0.0;
        let dir: 'CW' | 'CCW' | 'IDLE' = 'IDLE';
        if (ena >= 2.0) {
          if (in1 >= 2.0 && in2 < 2.0) {
            vOut1 = vDiff;
            vOut2 = 0.0;
            dir = 'CW';
          } else if (in2 >= 2.0 && in1 < 2.0) {
            vOut1 = 0.0;
            vOut2 = vDiff;
            dir = 'CCW';
          }
        }
        pinVoltages['out1'] = vOut1;
        pinVoltages['out2'] = vOut2;
        direction = dir;
        break;
      }

      case 'builtin_bridge_rectifier': {
        const vAc1 = getPinV('ac1');
        const vAc2 = getPinV('ac2');
        const dcP = getPinV('dc_plus');
        const dcM = getPinV('dc_minus');
        pinVoltages['ac1'] = vAc1;
        pinVoltages['ac2'] = vAc2;
        pinVoltages['dc_plus'] = dcP;
        pinVoltages['dc_minus'] = dcM;
        outputVoltage = Math.max(0, dcP - dcM);
        voltageDropV = outputVoltage;

        const iD1 = Math.max(0, (vAc1 - dcP - 0.7) / 1.0);
        const iD2 = Math.max(0, (vAc2 - dcP - 0.7) / 1.0);
        const iD3 = Math.max(0, (dcM - vAc1 - 0.7) / 1.0);
        const iD4 = Math.max(0, (dcM - vAc2 - 0.7) / 1.0);
        const instI = Math.max(iD1 + iD2, iD3 + iD4);

        const prevI = dynamicInductorCurrents.get(`br_${comp.id}`) ?? 0;
        const smoothI = Math.max(instI, prevI * 0.9);
        dynamicInductorCurrents.set(`br_${comp.id}`, smoothI);

        currentA = smoothI;
        powerW = outputVoltage * currentA;
        break;
      }

      case 'builtin_optocoupler': {
        const va = getPinV('anode');
        const vk = getPinV('cathode');
        pinVoltages['anode'] = va;
        pinVoltages['cathode'] = vk;
        pinVoltages['collector'] = getPinV('collector');
        pinVoltages['emitter'] = getPinV('emitter');
        break;
      }

      case 'builtin_joystick': {
        const jx = typeof props.joyX === 'number' ? props.joyX : 0;
        const jy = typeof props.joyY === 'number' ? props.joyY : 0;
        const pressed = props.isPressed === true;
        const vrxV = Math.max(0, Math.min(5, 2.5 + (jx / 100) * 2.5));
        const vryV = Math.max(0, Math.min(5, 2.5 + (jy / 100) * 2.5));
        const swV = pressed ? 0.0 : 5.0;
        pinVoltages['vrx'] = isPinConnected('vrx') ? getPinV('vrx') : vrxV;
        pinVoltages['vry'] = isPinConnected('vry') ? getPinV('vry') : vryV;
        pinVoltages['sw'] = isPinConnected('sw') ? getPinV('sw') : swV;
        break;
      }

      case 'builtin_led_bar_graph': {
        let count = 0;
        const isAinConn = isPinConnected('ain');
        if (isAinConn) {
          const vAin = getPinV('ain');
          count = Math.min(10, Math.max(0, Math.round((vAin / 5.0) * 10)));
        } else {
          for (let i = 1; i <= 10; i++) {
            if (getPinV(`b${i}`) >= 2.0) count++;
          }
        }
        outputVoltage = count;
        break;
      }

      case 'builtin_stepper_motor': {
        const vAp = getPinV('a_plus');
        const vBp = getPinV('b_plus');
        const isStep = vAp >= 2.5;
        const dirCw = vBp >= 2.5;
        let angle = typeof comp.state?.angle === 'number' ? comp.state.angle : (typeof props.angle === 'number' ? props.angle : 0);
        const prevStep = comp.state?.prevStep;
        if (!prevStep && isStep) {
          angle = (angle + (dirCw ? 15 : -15) + 360) % 360;
        }
        comp.state = { ...(comp.state || {}), angle, prevStep: isStep };
        outputVoltage = angle;
        break;
      }

      case 'builtin_dip_switch_4': {
        for (let i = 1; i <= 4; i++) {
          pinVoltages[`in${i}`] = getPinV(`in${i}`);
          pinVoltages[`out${i}`] = getPinV(`out${i}`);
        }
        break;
      }

      case 'builtin_shift_register':
      case 'builtin_counter_4bit':
      case 'builtin_bcd_decoder':
      case 'builtin_mux_4to1':
      case 'builtin_d_flipflop':
      case 'builtin_jk_flipflop': {
        const def = ComponentRegistry.getComponentDefinition(comp.type);
        if (def && def.pins) {
          for (const p of def.pins) {
            pinVoltages[p.id] = getPinV(p.id);
          }
        }
        break;
      }

      case 'buzzer': {
        const isConnPos = isPinConnected('pos', '+', 'p1');
        const isConnNeg = isPinConnected('neg', '-', 'p2');
        if (!isConnPos || !isConnNeg) {
          const vConn = isConnPos ? getPinV('pos', '+', 'p1') : isConnNeg ? getPinV('neg', '-', 'p2') : 0.0;
          pinVoltages['pos'] = vConn;
          pinVoltages['neg'] = vConn;
          voltageDropV = 0.0;
          currentA = 0.0;
          powerW = 0.0;
          isSounding = false;
          isOverloaded = false;
          isBurned = false;
          break;
        }

        const vPos = getPinV('pos', '+', 'p1');
        const vNeg = getPinV('neg', '-', 'p2');
        voltageDropV = Math.max(0, vPos - vNeg);
        currentA = voltageDropV / 100.0;
        powerW = voltageDropV * currentA;

        // Piezo buzzer sounds when voltage >= 2.0V
        isSounding = voltageDropV >= 2.0;

        // Buzzer overvoltage check (max 15V)
        if (voltageDropV > 15.0 || powerW > 0.5) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `Piezo transducer cracked and burned out from overvoltage (${voltageDropV.toFixed(1)}V > 15V rating)!`;
        }
        break;
      }

      case 'gate-buffer':
      case 'gate-and':
      case 'gate-or':
      case 'gate-not':
      case 'gate-nand':
      case 'gate-nor':
      case 'gate-xor':
      case 'gate-xnor':
      case 'ic-555':
      case 'builtin_555':
      case 'timer-555': {
        if (!activeGateOutputs.has(comp.id)) {
          // Universal Rule 1: Unconnected or floating ('Z') input -> High-Z ('Z') inactive output
          voltageDropV = 0.0;
          currentA = 0.0;
          powerW = 0.0;
          outputVoltage = undefined;
          logicOutput = 'Z';
          break;
        }
        const outBit = activeGateOutputs.get(comp.id)!;
        const isOutConn = isPinConnected('out', 'pin3_out', 'pin3', 'output');
        const vOut = isOutConn
          ? getPinV('out', 'pin3_out', 'pin3', 'output')
          : outBit === 1
          ? 5.0
          : 0.0;
        pinVoltages['out'] = vOut;
        voltageDropV = vOut;
        outputVoltage = vOut;
        logicOutput = outBit;
        const srcIdx = voltageSources.findIndex((s) => s.compId === comp.id);
        if (srcIdx !== -1) {
          currentA = Math.abs(finalSolution[numNodes + srcIdx] || 0.0);
          powerW = vOut * currentA;
        }
        break;
      }

      case 'transistor-npn':
      case 'builtin_npn': {
        const vb = getPinV('base', 'b');
        const vc = getPinV('collector', 'c');
        const ve = getPinV('emitter', 'e');
        voltageDropV = Math.abs(vc - ve);
        const vbe = vb - ve;
        if (vbe >= 0.65) {
          const hfe = typeof props.gainHfe === 'number' ? props.gainHfe : typeof props.beta === 'number' ? props.beta : 100;
          const ib = Math.max(0, (vbe - 0.65) / 200);
          currentA = Math.min(0.8, hfe * ib);
          powerW = voltageDropV * currentA;
          if (powerW > 0.625 || currentA > 0.8) {
            isOverloaded = true;
            isBurned = true;
            overloadReason = `2N2222 BJT thermal burnout! Dissipating ${powerW.toFixed(2)}W (exceeds 0.625W max limit).`;
          }
        }
        break;
      }

      case 'builtin_pnp':
      case 'transistor-pnp': {
        const vb = getPinV('base', 'b');
        const vc = getPinV('collector', 'c');
        const ve = getPinV('emitter', 'e');
        voltageDropV = Math.abs(ve - vc);
        const veb = ve - vb;
        if (veb >= 0.65) {
          const hfe = typeof props.gainHfe === 'number' ? props.gainHfe : typeof props.beta === 'number' ? props.beta : 100;
          const ib = Math.max(0, (veb - 0.65) / 200);
          currentA = Math.min(0.8, hfe * ib);
          powerW = voltageDropV * currentA;
          if (powerW > 0.625 || currentA > 0.8) {
            isOverloaded = true;
            isBurned = true;
            overloadReason = `2N3906 PNP BJT thermal burnout! Dissipating ${powerW.toFixed(2)}W (exceeds 0.625W max limit).`;
          }
        }
        break;
      }

      case 'mosfet-n':
      case 'builtin_nmos': {
        const vg = getPinV('gate', 'g');
        const vd = getPinV('drain', 'd');
        const vs = getPinV('source', 's');
        voltageDropV = Math.abs(vd - vs);
        const vgs = vg - vs;
        const vth = typeof props.vth === 'number' ? props.vth : 2.0;
        if (vgs >= vth) {
          currentA = voltageDropV / 0.5;
          powerW = voltageDropV * currentA;
          if (powerW > 1.5 || currentA > 10.0) {
            isOverloaded = true;
            isBurned = true;
            overloadReason = `MOSFET thermal breakdown! Current ${currentA.toFixed(1)}A exceeded maximum rating.`;
          }
        }
        break;
      }

      case 'builtin_pmos':
      case 'mosfet-p': {
        const vg = getPinV('gate', 'g');
        const vd = getPinV('drain', 'd');
        const vs = getPinV('source', 's');
        voltageDropV = Math.abs(vs - vd);
        const vsg = vs - vg;
        const vth = typeof props.vth === 'number' ? props.vth : 2.0;
        if (vsg >= vth) {
          currentA = voltageDropV / 0.5;
          powerW = voltageDropV * currentA;
          if (powerW > 1.5 || currentA > 10.0) {
            isOverloaded = true;
            isBurned = true;
            overloadReason = `P-MOSFET thermal breakdown! Current ${currentA.toFixed(1)}A exceeded maximum rating.`;
          }
        }
        break;
      }

      case 'ac-source': {
        const vPeak = typeof props.amplitude === 'number' ? props.amplitude : typeof props.voltage === 'number' ? props.voltage : 12;
        const freq = typeof props.frequency === 'number' ? props.frequency : 10;
        const phase = typeof props.phase === 'number' ? props.phase : 0;
        const offset = typeof props.offset === 'number' ? props.offset : 0;
        const dutyCycle = typeof props.dutyCycle === 'number' ? props.dutyCycle / 100 : 0.5;
        const waveform = (props.waveform as string) || 'sine';
        const tSec = clockMs / 1000;
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
        const vInstant = vWave + offset;

        const isConnPos = isPinConnected('pos', '+', 'p1', '~ Line');
        const negV = getPinV('neg', '-', 'p2', '~ Neutral');
        const posV = isConnPos ? getPinV('pos', '+', 'p1', '~ Line') : (negV + vInstant);
        pinVoltages['pos'] = posV;
        pinVoltages['neg'] = negV;
        outputVoltage = posV - negV;
        voltageDropV = outputVoltage;

        const srcIdx = voltageSources.findIndex((s) => s.compId === comp.id);
        if (srcIdx !== -1) {
          const rawI = Math.abs(finalSolution[numNodes + srcIdx] || 0.0);
          const prevAcI = dynamicInductorCurrents.get(`ac_${comp.id}`) ?? 0;
          const smoothAcI = Math.max(rawI, prevAcI * 0.9);
          dynamicInductorCurrents.set(`ac_${comp.id}`, smoothAcI);
          currentA = smoothAcI;
          powerW = voltageDropV * currentA;
        }
        break;
      }

      case 'dc-source':
      case 'battery-9v':
      case 'coin-cell': {
        const isConnPos = isPinConnected('pos', '+', 'p1');
        const negV = getPinV('neg', '-', 'p2');
        const ratedV = typeof props.voltage === 'number' ? props.voltage : comp.type === 'battery-9v' ? 9.0 : 3.0;
        const posV = isConnPos ? getPinV('pos', '+', 'p1') : (negV + ratedV);
        pinVoltages['pos'] = posV;
        pinVoltages['neg'] = negV;
        voltageDropV = posV - negV;

        if (deadShortSources.has(comp.id)) {
          const ds = deadShortSources.get(comp.id)!;
          currentA = ds.current;
          powerW = ds.voltage * currentA;
          voltageDropV = ds.voltage;
          isOverloaded = true;
          isBurned = true;
          overloadReason = `Critical short-circuit across power terminals! Dangerous discharge current of ${currentA.toFixed(1)}A causing battery fire/thermal runaway.`;
        } else {
          // Find branch current from the solution vector
          const srcIdx = voltageSources.findIndex((s) => s.compId === comp.id);
          if (srcIdx !== -1) {
            const rawI = Math.abs(finalSolution[numNodes + srcIdx] || 0.0);
            currentA = rawI;
            powerW = voltageDropV * currentA;

            // Short-circuit threshold (5A)
            if (currentA > 5.0) {
              isOverloaded = true;
              isBurned = true;
              overloadReason = `Critical short-circuit! High discharge current of ${currentA.toFixed(1)}A caused thermal runaway and fire.`;
            }
          }
        }
        break;
      }

      case 'arduino-uno':
      case 'esp32':
      case 'pico':
      case 'builtin_cpu_8bit':
      case 'cpu-8bit': {
        // Sample voltages for all registry-defined MCU pins & aliases
        const def = ComponentRegistry.get(comp.type);
        if (def?.pins) {
          for (const pd of def.pins) {
            if (isUniversalGroundPin(comp.type, pd.id, pd.label)) {
              pinVoltages[pd.id] = 0.0;
            } else {
              const sup = isUniversalSupplyPin(comp.type, pd.id, pd.label);
              const n = getPinNode(comp.id, pd.id);
              if (n !== -1) {
                pinVoltages[pd.id] = nodeVoltages.get(n) ?? (sup.isSupply ? sup.voltage : 0.0);
              } else if (sup.isSupply) {
                pinVoltages[pd.id] = sup.voltage;
              } else {
                getPinV(pd.id);
              }
            }
          }
        }

        const extraPins = [
          'gnd', 'gnd1', 'gnd2', 'gnd3', 'gnd4', 'gnd5', 'gnd6', 'gnd7', 'gnd8',
          'gnd_l', 'gnd_r', '5v', '3v3', 'vbus', 'vsys', 'ioref',
        ];
        for (const p of extraPins) {
          if (isUniversalGroundPin(comp.type, p)) {
            pinVoltages[p] = 0.0;
          } else {
            const sup = isUniversalSupplyPin(comp.type, p);
            const n = getPinNode(comp.id, p);
            if (n !== -1) {
              pinVoltages[p] = nodeVoltages.get(n) ?? (sup.isSupply ? sup.voltage : 0.0);
            } else if (sup.isSupply) {
              pinVoltages[p] = sup.voltage;
            }
          }
        }

        // Check dead-short pin sources directly to ground
        for (const [key, ds] of deadShortSources.entries()) {
          if (key.startsWith(`${comp.id}_`)) {
            const pinName = key.replace(`${comp.id}_`, '').toUpperCase();
            currentA = Math.max(currentA, ds.current);
            isOverloaded = true;
            isBurned = true;
            overloadReason = `MCU Pin Overcurrent Hazard: Pin ${pinName} dead-shorted directly to GND! Dangerous discharge current of ${(ds.current * 1000).toFixed(1)} mA destroyed GPIO driver (max 40 mA limit exceeded)!`;
          }
        }

        // Check all voltage source branches belonging to this MCU
        voltageSources.forEach((src, idx) => {
          if (src.compId === comp.id) {
            const branchI = Math.abs(finalSolution[numNodes + idx] || 0.0);
            currentA = Math.max(currentA, branchI);
            // ATmega328P I/O pin max current rating is 40mA (0.040A)
            if (
              src.pinId &&
              !['5v', 'vbus', 'vsys', 'ioref', '3v3', '3.3v', 'p3v3', 'vref'].includes(
                src.pinId.toLowerCase()
              )
            ) {
              if (branchI > 0.040) {
                isOverloaded = true;
                isBurned = true;
                overloadReason = `MCU Pin Overcurrent: Pin ${src.pinId.toUpperCase()} drew ${(branchI * 1000).toFixed(1)} mA (exceeded 40 mA absolute max limit). GPIO driver destroyed!`;
              }
            }
          }
        });
        break;
      }

      // -----------------------------------------------------------------------
      // PHASE 7.9 EXPANSION: POST-SOLVE TELEMETRY & BURNOUT CHECKS
      // -----------------------------------------------------------------------
      case 'builtin_soil_moisture': {
        const vVcc = isPinConnected('vcc') ? getPinV('vcc') : 5.0;
        const vGnd = isPinConnected('gnd') ? getPinV('gnd') : 0.0;
        const vSupply = Math.max(0, vVcc - vGnd);
        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 6.5;
        const moisture = typeof props.moisture === 'number' ? props.moisture : 20;
        const threshold = typeof props.threshold === 'number' ? props.threshold : 50;
        const triggerOnDry = props.triggerOnDry === true;
        const isTrig = triggerOnDry ? moisture < threshold : moisture >= threshold;
        const vOut = isPinConnected('out') ? getPinV('out') : (isTrig ? 5.0 : 0.0);
        pinVoltages['out'] = vOut;
        voltageDropV = vSupply;
        outputVoltage = vOut;
        logicOutput = vOut >= 2.5 ? 1 : 0;
        const srcIdx = voltageSources.findIndex((s) => s.compId === comp.id);
        const outI = srcIdx !== -1 ? Math.abs(finalSolution[numNodes + srcIdx] || 0.0) : 0;
        currentA = Math.max(vSupply / 250.0, outI);
        powerW = vSupply * currentA;
        if (vSupply > maxV) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `Soil Moisture Sensor overvoltage burnout! Supply voltage ${vSupply.toFixed(1)}V exceeds ${maxV}V rating.`;
        }
        break;
      }

      case 'builtin_traffic_light': {
        const isGndConn = isPinConnected('gnd');
        const vGnd = isGndConn ? getPinV('gnd') : 0.0;
        const vR = isPinConnected('r') ? getPinV('r') : vGnd;
        const vY = isPinConnected('y') ? getPinV('y') : vGnd;
        const vG = isPinConnected('g') ? getPinV('g') : vGnd;
        pinVoltages['r'] = vR;
        pinVoltages['y'] = vY;
        pinVoltages['g'] = vG;
        pinVoltages['gnd'] = vGnd;
        if (!isGndConn) {
          redLit = false;
          yellowLit = false;
          greenLit = false;
          brightness = 0;
          break;
        }
        const dR = isPinConnected('r') ? vR - vGnd : 0;
        const dY = isPinConnected('y') ? vY - vGnd : 0;
        const dG = isPinConnected('g') ? vG - vGnd : 0;
        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 12.0;
        if (Math.max(dR, dY, dG) > maxV) {
          isOverloaded = true;
          isBurned = true;
          redLit = false;
          yellowLit = false;
          greenLit = false;
          brightness = 0;
          voltageDropV = Math.max(dR, dY, dG);
          currentA = (voltageDropV - 2.0) / 150.0;
          powerW = voltageDropV * currentA;
          overloadReason = `Traffic Light LED module overvoltage burnout! Input ${voltageDropV.toFixed(1)}V exceeds ${maxV}V rating.`;
        } else {
          redLit = dR >= 1.8;
          yellowLit = dY >= 1.8;
          greenLit = dG >= 1.8;
          const iR = redLit ? Math.max(0.001, (dR - 2.0) / 150.0) : 0;
          const iY = yellowLit ? Math.max(0.001, (dY - 2.0) / 150.0) : 0;
          const iG = greenLit ? Math.max(0.001, (dG - 2.0) / 150.0) : 0;
          currentA = iR + iY + iG;
          voltageDropV = Math.max(0, dR, dY, dG);
          powerW = Math.max(0, dR * iR + dY * iY + dG * iG);
          brightness = redLit || yellowLit || greenLit ? 1.0 : 0.0;
        }
        break;
      }

      case 'builtin_water_pump': {
        const isConnP = isPinConnected('p_plus');
        const isConnM = isPinConnected('p_minus');
        if (!isConnP || !isConnM) {
          const vConn = isConnP ? getPinV('p_plus') : isConnM ? getPinV('p_minus') : 0.0;
          pinVoltages['p_plus'] = vConn;
          pinVoltages['p_minus'] = vConn;
          flowRateLpm = 0;
          rpm = 0;
          break;
        }
        const vP = getPinV('p_plus');
        const vM = getPinV('p_minus');
        voltageDropV = Math.abs(vP - vM);
        const rPump = Math.max(0.1, typeof props.resistance === 'number' ? props.resistance : 25);
        currentA = voltageDropV / rPump;
        powerW = voltageDropV * currentA;
        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 16.0;
        if (voltageDropV > maxV) {
          isOverloaded = true;
          isBurned = true;
          flowRateLpm = 0;
          rpm = 0;
          overloadReason = `Submersible Water Pump overvoltage burnout! ${voltageDropV.toFixed(1)}V exceeds ${maxV}V rating.`;
        } else if (voltageDropV >= 2.5) {
          flowRateLpm = Number(Math.min(4.5, Math.max(0.4, 0.5 + ((voltageDropV - 3.0) / 9.0) * 3.0)).toFixed(2));
          rpm = Math.round((voltageDropV / 12.0) * 3000);
        } else {
          flowRateLpm = 0;
          rpm = 0;
        }
        break;
      }

      case 'builtin_filament_bulb': {
        const isConn1 = isPinConnected('p1');
        const isConn2 = isPinConnected('p2');
        if (!isConn1 || !isConn2) {
          const vConn = isConn1 ? getPinV('p1') : isConn2 ? getPinV('p2') : 0.0;
          pinVoltages['p1'] = vConn;
          pinVoltages['p2'] = vConn;
          brightness = 0;
          break;
        }
        const v1 = getPinV('p1');
        const v2 = getPinV('p2');
        voltageDropV = Math.abs(v1 - v2);
        const rBulb = Math.max(0.1, typeof props.resistance === 'number' ? props.resistance : 24);
        currentA = voltageDropV / rBulb;
        powerW = (voltageDropV * voltageDropV) / rBulb;
        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 15.0;
        const maxP = typeof props.maxPower === 'number' ? props.maxPower : 8.0;
        if (voltageDropV > maxV || powerW > maxP) {
          isOverloaded = true;
          isBurned = true;
          brightness = 0;
          overloadReason = `Tungsten filament snapped and burned out! (${voltageDropV.toFixed(1)}V / ${powerW.toFixed(2)}W exceeds ${maxV}V / ${maxP}W rating).`;
        } else {
          brightness = voltageDropV >= 1.0 ? Math.min(1.0, Math.max(0.1, powerW / 6.0)) : 0.0;
        }
        break;
      }

      case 'builtin_rf_radio': {
        const vVcc = isPinConnected('vcc') ? getPinV('vcc') : 5.0;
        const vGnd = isPinConnected('gnd') ? getPinV('gnd') : 0.0;
        const vTx = isPinConnected('tx') ? getPinV('tx') : 0.0;
        const vRx = isPinConnected('rx') ? getPinV('rx') : 0.0;
        const vSupply = Math.max(0, vVcc - vGnd);
        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 6.5;
        const isGndConnected = isPinConnected('gnd');
        const isPowered = (!isPinConnected('vcc') || vSupply >= 3.0) && isGndConnected && vGnd <= 2.5;
        const srcIdx = voltageSources.findIndex((s) => s.compId === comp.id && s.pinId === 'rx');
        const rxSrcV = srcIdx !== -1 ? voltageSources[srcIdx].voltage : 0.0;
        const finalRxV = isPinConnected('rx') ? vRx : rxSrcV;
        pinVoltages['rx'] = finalRxV;
        pinVoltages['tx'] = vTx;
        const isTxConnected = isPinConnected('tx');
        isTransmitting = isPowered && isTxConnected && vTx - vGnd >= 2.0;
        isReceiving = isPowered && finalRxV - vGnd >= 2.0;
        outputVoltage = finalRxV;
        logicOutput = isReceiving ? 1 : 0;
        voltageDropV = vSupply;
        const outI = srcIdx !== -1 ? Math.abs(finalSolution[numNodes + srcIdx] || 0.0) : 0;
        currentA = Math.max(vSupply / 250.0, outI);
        powerW = vSupply * currentA;
        if (vSupply > maxV) {
          isOverloaded = true;
          isBurned = true;
          isTransmitting = false;
          isReceiving = false;
          overloadReason = `RF Transceiver overvoltage burnout! Supply ${vSupply.toFixed(1)}V exceeds ${maxV}V rating.`;
        }
        break;
      }

      case 'builtin_ir_tx': {
        const isConnA = isPinConnected('anode', 'pos', '+', 'p1');
        const isConnC = isPinConnected('cathode', 'neg', '-', 'p2');
        if (!isConnA || !isConnC) {
          const vConn = isConnA ? getPinV('anode', 'pos', '+', 'p1') : isConnC ? getPinV('cathode', 'neg', '-', 'p2') : 0.0;
          pinVoltages['anode'] = vConn;
          pinVoltages['cathode'] = vConn;
          isEmitting = false;
          brightness = 0;
          break;
        }
        const vA = getPinV('anode', 'pos', '+', 'p1');
        const vC = getPinV('cathode', 'neg', '-', 'p2');
        const vDiff = vA - vC;
        voltageDropV = Math.max(0, vDiff);
        const vf = typeof props.forwardVoltage === 'number' ? props.forwardVoltage : 1.4;
        const ron = typeof props.ron === 'number' ? props.ron : 10.0;
        const maxI = typeof props.maxCurrent === 'number' ? props.maxCurrent : 0.05;
        if (vDiff >= vf) {
          currentA = (vDiff - vf) / ron;
        } else if (vDiff >= 1.1) {
          currentA = (vDiff - 1.1) / 40.0;
        } else {
          currentA = 0;
        }
        powerW = voltageDropV * currentA;
        if (currentA > maxI) {
          isOverloaded = true;
          isBurned = true;
          isEmitting = false;
          brightness = 0;
          overloadReason = `IR Transmitter LED overcurrent burnout! Forward current ${(currentA * 1000).toFixed(1)}mA exceeds ${(maxI * 1000).toFixed(0)}mA rating (missing series current-limiting resistor).`;
        } else {
          isEmitting = currentA >= 0.002;
          brightness = isEmitting ? Math.min(1.0, currentA / 0.02) : 0.0;
        }
        break;
      }

      case 'builtin_ir_rx': {
        const vVcc = isPinConnected('vcc') ? getPinV('vcc') : 5.0;
        const vGnd = isPinConnected('gnd') ? getPinV('gnd') : 0.0;
        const vSupply = Math.max(0, vVcc - vGnd);
        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 6.5;
        const srcIdx = voltageSources.findIndex((s) => s.compId === comp.id && s.pinId === 'out');
        const srcV = srcIdx !== -1 ? voltageSources[srcIdx].voltage : 0.0;
        const vOut = isPinConnected('out') ? getPinV('out') : srcV;
        pinVoltages['out'] = vOut;
        isReceivingIr = vOut - vGnd >= 2.0;
        outputVoltage = vOut;
        logicOutput = isReceivingIr ? 1 : 0;
        voltageDropV = vSupply;
        const outI = srcIdx !== -1 ? Math.abs(finalSolution[numNodes + srcIdx] || 0.0) : 0;
        currentA = Math.max(vSupply / 250.0, outI);
        powerW = vSupply * currentA;
        if (vSupply > maxV) {
          isOverloaded = true;
          isBurned = true;
          isReceivingIr = false;
          overloadReason = `IR Receiver TSOP38238 overvoltage burnout! Supply ${vSupply.toFixed(1)}V exceeds ${maxV}V rating.`;
        }
        break;
      }

      case 'builtin_hall_sensor': {
        const vVcc = isPinConnected('vcc') ? getPinV('vcc') : 5.0;
        const vGnd = isPinConnected('gnd') ? getPinV('gnd') : 0.0;
        const vSupply = Math.max(0, vVcc - vGnd);
        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 24.0;
        const mag = typeof props.magneticField === 'number' ? props.magneticField : 0;
        const threshold = typeof props.threshold === 'number' ? props.threshold : 30;
        const vOut = isPinConnected('out') ? getPinV('out') : (mag >= threshold ? 5.0 : 0.0);
        pinVoltages['out'] = vOut;
        outputVoltage = vOut;
        logicOutput = vOut >= 2.5 ? 1 : 0;
        voltageDropV = vSupply;
        const srcIdx = voltageSources.findIndex((s) => s.compId === comp.id);
        const outI = srcIdx !== -1 ? Math.abs(finalSolution[numNodes + srcIdx] || 0.0) : 0;
        currentA = Math.max(vSupply / 250.0, outI);
        powerW = vSupply * currentA;
        if (vSupply > maxV) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `Hall-Effect Sensor A3144 overvoltage burnout! Supply ${vSupply.toFixed(1)}V exceeds ${maxV}V rating.`;
        }
        break;
      }

      case 'builtin_vibration_sensor': {
        const vVcc = isPinConnected('vcc') ? getPinV('vcc') : 5.0;
        const vGnd = isPinConnected('gnd') ? getPinV('gnd') : 0.0;
        const vSupply = Math.max(0, vVcc - vGnd);
        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 6.5;
        const vib = props.vibrationDetected === true || comp.state?.vibrationDetected === true;
        const vOut = isPinConnected('out') ? getPinV('out') : (vib ? 5.0 : 0.0);
        pinVoltages['out'] = vOut;
        outputVoltage = vOut;
        logicOutput = vOut >= 2.5 ? 1 : 0;
        voltageDropV = vSupply;
        const srcIdx = voltageSources.findIndex((s) => s.compId === comp.id);
        const outI = srcIdx !== -1 ? Math.abs(finalSolution[numNodes + srcIdx] || 0.0) : 0;
        currentA = Math.max(vSupply / 250.0, outI);
        powerW = vSupply * currentA;
        if (vSupply > maxV) {
          isOverloaded = true;
          isBurned = true;
          overloadReason = `Vibration Sensor SW-420 overvoltage burnout! Supply ${vSupply.toFixed(1)}V exceeds ${maxV}V rating.`;
        }
        break;
      }

      case 'builtin_solenoid': {
        const isConnP = isPinConnected('s_plus');
        const isConnM = isPinConnected('s_minus');
        if (!isConnP || !isConnM) {
          const vConn = isConnP ? getPinV('s_plus') : isConnM ? getPinV('s_minus') : 0.0;
          pinVoltages['s_plus'] = vConn;
          pinVoltages['s_minus'] = vConn;
          cResultIsEngaged = false;
          break;
        }
        const vP = getPinV('s_plus');
        const vM = getPinV('s_minus');
        voltageDropV = Math.abs(vP - vM);
        const rCoil = Math.max(0.1, typeof props.coilResistance === 'number' ? props.coilResistance : 20);
        currentA = voltageDropV / rCoil;
        powerW = voltageDropV * currentA;
        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 18.0;
        if (voltageDropV > maxV) {
          isOverloaded = true;
          isBurned = true;
          cResultIsEngaged = false;
          overloadReason = `Solenoid coil thermal burnout! ${voltageDropV.toFixed(1)}V exceeds ${maxV}V rating.`;
        } else {
          cResultIsEngaged = voltageDropV >= 3.5;
        }
        break;
      }

      case 'builtin_speaker': {
        const isConnP = isPinConnected('sp_plus');
        const isConnM = isPinConnected('sp_minus');
        if (!isConnP || !isConnM) {
          const vConn = isConnP ? getPinV('sp_plus') : isConnM ? getPinV('sp_minus') : 0.0;
          pinVoltages['sp_plus'] = vConn;
          pinVoltages['sp_minus'] = vConn;
          isSounding = false;
          break;
        }
        const vP = getPinV('sp_plus');
        const vM = getPinV('sp_minus');
        voltageDropV = Math.abs(vP - vM);
        const rSpk = Math.max(0.1, typeof props.impedance === 'number' ? props.impedance : 8);
        currentA = voltageDropV / rSpk;
        powerW = (voltageDropV * voltageDropV) / rSpk;
        const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 12.0;
        const maxP = typeof props.maxPower === 'number' ? props.maxPower : 2.0;
        if (voltageDropV > maxV || powerW > maxP) {
          isOverloaded = true;
          isBurned = true;
          isSounding = false;
          overloadReason = `8Ω Speaker voice-coil burnout! Dissipating ${powerW.toFixed(2)}W at ${voltageDropV.toFixed(1)}V (exceeds ${maxP}W / ${maxV}V rating — add series resistor or amplifier).`;
        } else {
          isSounding = voltageDropV >= 0.5;
        }
        break;
      }

      default: {
        getPinV('vcc', 'out', '5v', '3v3');
        getPinV('gnd', 'neg');
        getPinV('p1', 'in', 'in_a', 'in_b');
        getPinV('p2', 'out');
        break;
      }
    }

    // Ensure all component pins report their nodal voltage if connected, and universal grounds report 0.0V
    const compDef = ComponentRegistry.get(comp.type);
    if (compDef?.pins) {
      for (const pd of compDef.pins) {
        if (pinVoltages[pd.id] === undefined) {
          const n = getPinNode(comp.id, pd.id);
          if (n !== -1) {
            pinVoltages[pd.id] = nodeVoltages.get(n) ?? 0.0;
          }
        }
        if (isUniversalGroundPin(comp.type, pd.id, pd.label)) {
          pinVoltages[pd.id] = 0.0;
        }
      }
    }

    if (comp.type === 'builtin_solar_panel') {
      const lux = typeof props.lux === 'number' ? props.lux : 100;
      const maxV = typeof props.maxVoltage === 'number' ? props.maxVoltage : 6.0;
      const vGen = Math.min(maxV, 0.5 + (lux / 1000) * (maxV - 0.5));
      if (pinVoltages['pos'] === undefined) pinVoltages['pos'] = vGen;
      if (pinVoltages['+'] === undefined) pinVoltages['+'] = vGen;
      if (pinVoltages['p1'] === undefined) pinVoltages['p1'] = vGen;
    } else if (comp.type === 'builtin_joystick') {
      const jx = typeof props.joyX === 'number' ? props.joyX : 0;
      const jy = typeof props.joyY === 'number' ? props.joyY : 0;
      const pressed = props.isPressed === true;
      if (pinVoltages['vrx'] === undefined) pinVoltages['vrx'] = Math.max(0, Math.min(5, 2.5 + (jx / 100) * 2.5));
      if (pinVoltages['vry'] === undefined) pinVoltages['vry'] = Math.max(0, Math.min(5, 2.5 + (jy / 100) * 2.5));
      if (pinVoltages['sw'] === undefined) pinVoltages['sw'] = pressed ? 0.0 : 5.0;
    }

    const fuseBlown = comp.type === 'builtin_fuse' ? (props.isBlown === true || comp.state?.isBlown === true) : undefined;
    const fuseR = comp.type === 'builtin_fuse' ? (fuseBlown ? 1e9 : 0.05) : undefined;

    componentResults.set(comp.id, {
      componentId: comp.id,
      voltageDropV,
      currentA,
      powerW,
      isOverloaded,
      isBurned,
      isBlown: fuseBlown,
      resistance: fuseR,
      overloadReason,
      brightness,
      rpm,
      direction,
      servoAngle,
      sdActivity,
      isSounding,
      outputVoltage,
      logicOutput,
      pinVoltages,
      isEngaged: cResultIsEngaged,
      inputCurrentA,
      outputCurrentA,
      redLit,
      yellowLit,
      greenLit,
      flowRateLpm,
      isTransmitting,
      isReceiving,
      isEmitting,
      isReceivingIr,
    });
  }

  // -------------------------------------------------------------------------
  // 6. Universal Upstream Current Tracing & Per-Wire Current Calculation
  // Trace active closed-loop load currents backwards through active logic gate
  // chains and passive bridges all the way back to primary power sources (Battery+/VCC/MCU),
  // so every wire from Source -> [Gate Chain] -> Load -> Ground animates continuously.
  // -------------------------------------------------------------------------
  const nodeDemandCurrent = new Map<number, number>();
  const raiseNodeDemand = (nodeId: number, curr: number) => {
    if (nodeId <= 0 || curr <= 1e-6 || !drivenNodes.has(nodeId)) return false;
    const prev = nodeDemandCurrent.get(nodeId) ?? 0;
    if (curr > prev + 1e-7) {
      nodeDemandCurrent.set(nodeId, curr);
      return true;
    }
    return false;
  };

  // Seed demand from active gates that are directly driving closed-loop loads
  for (const comp of components) {
    if (!activeGateOutputs.has(comp.id)) continue;
    const res = componentResults.get(comp.id);
    if (!res || res.currentA <= 1e-6) continue;
    if (comp.type === 'gate-not' || comp.type === 'gate-buffer') {
      const inNode = getPinNode(comp.id, 'in', 'in_a', 'in1', 'a');
      raiseNodeDemand(inNode, res.currentA);
    } else if (comp.type !== 'ic-555' && comp.type !== 'builtin_555' && comp.type !== 'timer-555') {
      const nodeA = getPinNode(comp.id, 'in_a', 'in1', 'a');
      const nodeB = getPinNode(comp.id, 'in_b', 'in2', 'b');
      raiseNodeDemand(nodeA, res.currentA);
      raiseNodeDemand(nodeB, res.currentA);
    }
  }

  // Propagate demand backwards across active gate stages & passive bridges (up to 100 steps)
  for (let step = 0; step < 100; step++) {
    let changed = false;

    for (const br of passiveBridges) {
      const d1 = nodeDemandCurrent.get(br.n1) ?? 0;
      const d2 = nodeDemandCurrent.get(br.n2) ?? 0;
      if (d1 > 1e-6 && raiseNodeDemand(br.n2, d1)) changed = true;
      if (d2 > 1e-6 && raiseNodeDemand(br.n1, d2)) changed = true;
    }

    for (const comp of components) {
      if (!activeGateOutputs.has(comp.id)) continue;
      const outNode = getPinNode(comp.id, 'out', 'pin3_out', 'pin3', 'output');
      const demandedI = outNode > 0 ? (nodeDemandCurrent.get(outNode) ?? 0) : 0;
      const res = componentResults.get(comp.id);
      if (res && demandedI > res.currentA + 1e-7) {
        res.currentA = demandedI;
        res.powerW = Math.abs(res.outputVoltage ?? 0) * demandedI;
        changed = true;
      }
      const gateCurr = res?.currentA ?? 0;
      if (gateCurr > 1e-6) {
        if (comp.type === 'gate-not' || comp.type === 'gate-buffer') {
          const inNode = getPinNode(comp.id, 'in', 'in_a', 'in1', 'a');
          if (raiseNodeDemand(inNode, gateCurr)) changed = true;
        } else if (comp.type !== 'ic-555' && comp.type !== 'builtin_555' && comp.type !== 'timer-555') {
          const nodeA = getPinNode(comp.id, 'in_a', 'in1', 'a');
          const nodeB = getPinNode(comp.id, 'in_b', 'in2', 'b');
          if (raiseNodeDemand(nodeA, gateCurr)) changed = true;
          if (raiseNodeDemand(nodeB, gateCurr)) changed = true;
        }
      }
    }

    if (!changed) break;
  }

  // Update primary power source currents if they supply an active gate chain
  for (const comp of components) {
    if (
      comp.type === 'dc-source' ||
      comp.type === 'battery-9v' ||
      comp.type === 'coin-cell' ||
      comp.type === 'ac-source' ||
      comp.type === 'vcc' ||
      comp.type === 'builtin_vcc'
    ) {
      const posNode = getPinNode(comp.id, 'pos', '+', 'p1', '~ Line', 'vcc', 'out');
      const demandedI = posNode > 0 ? (nodeDemandCurrent.get(posNode) ?? 0) : 0;
      const res = componentResults.get(comp.id);
      if (res && demandedI > res.currentA) {
        res.currentA = demandedI;
        res.powerW = Math.abs(res.voltageDropV) * demandedI;
      }
    }
  }

  // Build a per-pin current lookup so multi-pin MCUs and shared GND pins don't leak current onto inactive pins/wires
  const pinCurrentMap = new Map<string, number>();
  const setPinCurrent = (compId: string, pinId: string, curr: number) => {
    const k = `${compId}:${pinId.toLowerCase()}`;
    pinCurrentMap.set(k, Math.max(pinCurrentMap.get(k) ?? 0, curr));
  };

  for (const comp of components) {
    const res = componentResults.get(comp.id);
    if (!res) continue;
    if (
      comp.type !== 'arduino-uno' &&
      comp.type !== 'esp32' &&
      comp.type !== 'pico' &&
      comp.type !== 'builtin_cpu_8bit' &&
      comp.type !== 'cpu-8bit' &&
      comp.type !== 'gnd' &&
      comp.type !== 'builtin_gnd' &&
      comp.type !== 'builtin_ground'
    ) {
      if (comp.type === 'builtin_dcdc_converter' || comp.type === 'dcdc-converter') {
        const iIn = res.inputCurrentA ?? res.currentA;
        const iOut = res.outputCurrentA ?? res.currentA;
        setPinCurrent(comp.id, 'vin_plus', iIn);
        setPinCurrent(comp.id, 'vin_minus', iIn);
        setPinCurrent(comp.id, 'vout_plus', iOut);
        setPinCurrent(comp.id, 'vout_minus', iOut);
      } else if (comp.type === 'builtin_reg_7805' || comp.type === 'voltage-regulator-7805' || comp.type === 'lm7805') {
        const iIn = res.inputCurrentA ?? res.currentA;
        const iOut = res.outputCurrentA ?? res.currentA;
        setPinCurrent(comp.id, 'in', iIn);
        setPinCurrent(comp.id, 'vin', iIn);
        setPinCurrent(comp.id, 'input', iIn);
        setPinCurrent(comp.id, 'out', iOut);
        setPinCurrent(comp.id, 'vout', iOut);
        setPinCurrent(comp.id, 'output', iOut);
        setPinCurrent(comp.id, 'gnd', Math.abs(iIn - iOut));
        setPinCurrent(comp.id, 'ground', Math.abs(iIn - iOut));
      } else if (
        [
          'builtin_ir_rx',
          'builtin_soil_moisture',
          'builtin_hall_sensor',
          'builtin_vibration_sensor',
          'builtin_rf_radio',
        ].includes(comp.type)
      ) {
        const srcIdx = voltageSources.findIndex((s) => s.compId === comp.id && (s.pinId === 'out' || s.pinId === 'rx'));
        const outI = srcIdx !== -1 ? Math.abs(finalSolution[numNodes + srcIdx] || 0.0) : 0.0;
        setPinCurrent(comp.id, 'out', outI);
        setPinCurrent(comp.id, 'rx', outI);
        setPinCurrent(comp.id, 'vcc', res.currentA);
        // Only set current on GND pin of 3-pin sensor when actively outputting/conducting > 10 μA
        if (outI > 0.00001) {
          setPinCurrent(comp.id, 'gnd', res.currentA);
        } else {
          setPinCurrent(comp.id, 'gnd', 0.0);
        }
      } else {
        for (const net of nets) {
          for (const p of net.pins) {
            if (p.compId === comp.id) {
              setPinCurrent(comp.id, p.pinId, res.currentA);
            }
          }
        }
      }
    }
  }

  // Record exact branch currents (including upstream gate demand) for each voltage source pin
  voltageSources.forEach((src, idx) => {
    const mnaI = Math.abs(finalSolution[numNodes + idx] || 0.0);
    const demandedI = src.posNode > 0 ? (nodeDemandCurrent.get(src.posNode) ?? 0.0) : 0.0;
    const branchI = Math.max(mnaI, demandedI);
    if (src.pinId) {
      const pNorm = src.pinId.toLowerCase();
      setPinCurrent(src.compId, pNorm, branchI);
      if (pNorm.startsWith('d')) setPinCurrent(src.compId, pNorm.substring(1), branchI);
      else setPinCurrent(src.compId, `d${pNorm}`, branchI);
      if (pNorm.startsWith('gp')) setPinCurrent(src.compId, pNorm.substring(2), branchI);
      else setPinCurrent(src.compId, `gp${pNorm}`, branchI);
    }
  });

  // Count wires attached to each component pin for KCL degree-1 pin bounding
  const pinWireCount = new Map<string, number>();
  for (const wire of wires) {
    const fk = `${wire.fromCompId}:${wire.fromPinId.toLowerCase()}`;
    const tk = `${wire.toCompId}:${wire.toPinId.toLowerCase()}`;
    pinWireCount.set(fk, (pinWireCount.get(fk) ?? 0) + 1);
    pinWireCount.set(tk, (pinWireCount.get(tk) ?? 0) + 1);
  }

  // Compute net-level current from attached pins
  const netCurrentMap = new Map<string, number>();
  for (const net of nets) {
    let maxNetI = 0.0;
    for (const p of net.pins) {
      const pinI = pinCurrentMap.get(`${p.compId}:${p.pinId.toLowerCase()}`) ?? 0.0;
      if (pinI > maxNetI) maxNetI = pinI;
    }
    netCurrentMap.set(net.id, maxNetI);
  }

  for (const wire of wires) {
    const fromComp = components.find((c) => c.id === wire.fromCompId);
    const toComp = components.find((c) => c.id === wire.toCompId);
    const isFromGroundComp = fromComp && (fromComp.type === 'gnd' || fromComp.type === 'builtin_gnd' || fromComp.type === 'builtin_ground');
    const isToGroundComp = toComp && (toComp.type === 'gnd' || toComp.type === 'builtin_gnd' || toComp.type === 'builtin_ground');

    const fk = `${wire.fromCompId}:${wire.fromPinId.toLowerCase()}`;
    const tk = `${wire.toCompId}:${wire.toPinId.toLowerCase()}`;
    const fromI = pinCurrentMap.get(fk);
    const toI = pinCurrentMap.get(tk);
    const fromDeg = pinWireCount.get(fk) ?? 1;
    const toDeg = pinWireCount.get(tk) ?? 1;
    const net = wireToNetMap.get(wire.id);
    const netI = net ? netCurrentMap.get(net.id) ?? 0.0 : 0.0;

    let wireI = netI;
    if (isToGroundComp && fromI !== undefined) {
      wireI = fromI;
    } else if (isFromGroundComp && toI !== undefined) {
      wireI = toI;
    } else if (fromI !== undefined && toI === undefined) {
      wireI = fromI;
    } else if (toI !== undefined && fromI === undefined) {
      wireI = toI;
    } else if (fromI !== undefined && toI !== undefined) {
      if (fromDeg === 1 && toDeg > 1) {
        wireI = fromI;
      } else if (toDeg === 1 && fromDeg > 1) {
        wireI = toI;
      } else if (fromDeg === 1 && toDeg === 1) {
        wireI = fromI > 0 && toI > 0 ? Math.min(fromI, toI) : Math.max(fromI, toI);
      } else {
        wireI = Math.max(fromI, toI);
      }
    }

    // In a series chain, inherit active branch current from series components
    if (wireI < 0.00001) {
      const isFromPassive = fromComp && !['vcc', 'builtin_vcc', 'gnd', 'builtin_gnd', 'builtin_ground'].includes(fromComp.type);
      const isToPassive = toComp && !['vcc', 'builtin_vcc', 'gnd', 'builtin_gnd', 'builtin_ground'].includes(toComp.type);
      const c1I = isFromPassive ? (fromI ?? 0) : 0;
      const c2I = isToPassive ? (toI ?? 0) : 0;
      const maxSeriesI = Math.max(c1I, c2I);
      if (maxSeriesI >= 0.00001) {
        wireI = maxSeriesI;
      }
    } else if (wireI === 0 && netI > 0) {
      if ((fromI !== undefined && fromI > 0) || (toI !== undefined && toI > 0)) {
        wireI = Math.max(fromI ?? 0, toI ?? 0, netI);
      }
    }

    wireCurrents.set(wire.id, wireI);
  }

  return {
    nodeVoltages,
    netVoltages,
    wireVoltages,
    wireCurrents,
    componentResults,
    timeStepSec,
  };
}
