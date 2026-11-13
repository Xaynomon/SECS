import { CircuitComponent, CircuitWire } from '../../types/circuit';
import { ComponentRegistry } from '../../registry/ComponentRegistry';
import {
  buildNetlistNets,
  isUniversalGroundPin,
  isUniversalSupplyPin,
} from './NetlistGraph';
import {
  ComponentSimulationState,
  ElectricalNet,
  LogicLevel,
  LogicalSimulationResult,
} from './types';

/**
 * Executes a cycle of the Universal Graph-Based Digital Logical Simulation Engine.
 *
 * Implements:
 * - Rule 1: Unconnected / Floating ('Z') gate inputs strictly output 'Z' (never 1).
 * - Rule 2: Two-Phase Graph Convergence Solver (up to 100 iterations) with
 *   unidirectional gate evaluation, weak resistive pass-throughs, and dual
 *   reachability flags (hasHighPath / hasGroundReturn) for series loads.
 */
export function evaluateLogicalCircuit(
  components: CircuitComponent[],
  wires: CircuitWire[],
  clockMs: number = 0
): LogicalSimulationResult {
  // 1. Build discrete electrical nets from connected wires & switch contacts
  const { nets, pinToNetMap, wireToNetMap } = buildNetlistNets(components, wires);

  const componentStates = new Map<string, ComponentSimulationState>();
  const pinStates = new Map<string, LogicLevel>();
  const contentionErrors: Array<{ netId: string; message: string; compIds: string[] }> = [];

  // Per-net keyed strong & weak drivers (keyed by `${compId}:${pinId.toLowerCase()}`)
  const strongDriversMap = new Map<string, Map<string, 0 | 1>>();
  const strongDriverVoltagesMap = new Map<string, Map<string, number>>();
  const weakDriversMap = new Map<string, Map<string, 0 | 1>>();
  for (const net of nets) {
    strongDriversMap.set(net.id, new Map());
    strongDriverVoltagesMap.set(net.id, new Map());
    weakDriversMap.set(net.id, new Map());
  }

  // Case-insensitive & alias-aware Net lookup for a component pin
  const getNetForPin = (compId: string, ...pinCandidates: string[]): ElectricalNet | undefined => {
    for (const pid of pinCandidates) {
      const candidates = [
        pid,
        pid.toLowerCase(),
        pid.toUpperCase(),
        pid.toLowerCase().startsWith('d') ? pid.substring(1) : `d${pid.toLowerCase()}`,
        pid.toLowerCase().startsWith('gp') ? pid.substring(2) : `gp${pid.toLowerCase()}`,
      ];
      for (const cand of candidates) {
        const net = pinToNetMap.get(`${compId}:${cand}`);
        if (net) return net;
      }
    }
    return undefined;
  };

  // Strictly reads the resolved net state on an input pin ('Z' if unconnected)
  const getInputNetLevel = (compId: string, ...pinCandidates: string[]): LogicLevel => {
    const net = getNetForPin(compId, ...pinCandidates);
    return net ? net.level : 'Z';
  };

  // Reads a pin's resolved logic level (for post-convergence component state inspection)
  const getPinLevel = (compId: string, ...pinCandidates: string[]): LogicLevel => {
    const net = getNetForPin(compId, ...pinCandidates);
    if (net) return net.level;
    for (const pid of pinCandidates) {
      const exact = pinStates.get(`${compId}:${pid}`);
      if (exact !== undefined) return exact;
      const lower = pinStates.get(`${compId}:${pid.toLowerCase()}`);
      if (lower !== undefined) return lower;
    }
    return 'Z';
  };

  // Sets or removes a strong driver on a pin and its attached net
  const setStrongDriver = (compId: string, pinId: string, level: LogicLevel, voltageV?: number) => {
    pinStates.set(`${compId}:${pinId}`, level);
    pinStates.set(`${compId}:${pinId.toLowerCase()}`, level);

    const net = getNetForPin(compId, pinId);
    if (!net) return;

    const drivers = strongDriversMap.get(net.id)!;
    const driverVoltages = strongDriverVoltagesMap.get(net.id)!;
    const dKey = `${compId}:${pinId.toLowerCase()}`;
    if (level === 0 || level === 1) {
      drivers.set(dKey, level);
      const vNominal = voltageV !== undefined ? voltageV : level === 1 ? 5.0 : 0.0;
      driverVoltages.set(dKey, vNominal);
    } else {
      drivers.delete(dKey);
      driverVoltages.delete(dKey);
    }
  };

  // 2. Seed Primary Sources (Strong Drivers: VCC/Battery+/AC+/MCU_HIGH = 1, GND/Battery-/AC-/MCU_LOW = 0)
  for (const comp of components) {
    const def = ComponentRegistry.get(comp.type);
    if (def?.pins) {
      for (const pinDef of def.pins) {
        if (isUniversalGroundPin(comp.type, pinDef.id, pinDef.label)) {
          setStrongDriver(comp.id, pinDef.id, 0, 0.0);
        } else {
          const supply = isUniversalSupplyPin(comp.type, pinDef.id, pinDef.label);
          if (supply.isSupply) {
            setStrongDriver(comp.id, pinDef.id, 1, supply.voltage);
          }
        }
      }
    }

    switch (comp.type) {
      case 'dc-source':
      case 'battery-9v': {
        const vSrc = typeof comp.properties?.voltage === 'number' ? comp.properties.voltage : 9.0;
        setStrongDriver(comp.id, 'pos', 1, vSrc);
        setStrongDriver(comp.id, 'neg', 0, 0.0);
        break;
      }

      case 'coin-cell': {
        const vSrc = typeof comp.properties?.voltage === 'number' ? comp.properties.voltage : 3.0;
        setStrongDriver(comp.id, 'pos', 1, vSrc);
        setStrongDriver(comp.id, 'neg', 0, 0.0);
        break;
      }

      case 'ac-source': {
        const vSrc =
          typeof comp.properties?.amplitude === 'number'
            ? comp.properties.amplitude
            : typeof comp.properties?.voltage === 'number'
            ? comp.properties.voltage
            : 12.0;
        setStrongDriver(comp.id, 'pos', 1, vSrc);
        setStrongDriver(comp.id, 'neg', 0, 0.0);
        break;
      }

      case 'gnd': {
        setStrongDriver(comp.id, 'gnd', 0, 0.0);
        break;
      }

      case 'vcc': {
        const vSrc = typeof comp.properties?.voltage === 'number' ? comp.properties.voltage : 5.0;
        setStrongDriver(comp.id, 'vcc', 1, vSrc);
        setStrongDriver(comp.id, 'out', 1, vSrc);
        break;
      }

      case 'arduino-uno':
      case 'esp32':
      case 'pico':
      case 'builtin_cpu_8bit':
      case 'cpu-8bit': {
        const mcuHighV = comp.type === 'esp32' || comp.type === 'pico' ? 3.3 : 5.0;
        for (const pSupply of ['5v', 'vbus', 'vsys', 'ioref', 'vcc']) {
          setStrongDriver(comp.id, pSupply, 1, 5.0);
        }
        for (const pSupply3 of ['3v3', '3.3v', 'p3v3', 'vref']) {
          setStrongDriver(comp.id, pSupply3, 1, 3.3);
        }
        for (const pGnd of [
          'gnd', 'gnd1', 'gnd2', 'gnd3', 'gnd4', 'gnd5', 'gnd6', 'gnd7', 'gnd8',
          'gnd_l', 'gnd_r', 'gnd_1', 'gnd_2', 'gnd_3', 'gnd_4', 'gnd_5', 'gnd_6', 'gnd_7', 'gnd_8',
        ]) {
          setStrongDriver(comp.id, pGnd, 0, 0.0);
        }

        const driveMcuPinAliases = (pinKey: string, bitVal: 0 | 1) => {
          const net = getNetForPin(comp.id, pinKey);
          const canonicalKey = net
            ? net.pins.find((p) => p.compId === comp.id)?.pinId || pinKey
            : pinKey;
          setStrongDriver(comp.id, canonicalKey, bitVal, bitVal === 1 ? mcuHighV : 0.0);
          pinStates.set(`${comp.id}:${pinKey}`, bitVal);
          pinStates.set(`${comp.id}:${pinKey.toLowerCase()}`, bitVal);
          pinStates.set(`${comp.id}:${pinKey.toUpperCase()}`, bitVal);
          if (pinKey.toLowerCase().startsWith('d')) {
            pinStates.set(`${comp.id}:${pinKey.substring(1)}`, bitVal);
          }
          if (pinKey.toLowerCase().startsWith('gp')) {
            pinStates.set(`${comp.id}:${pinKey.substring(2)}`, bitVal);
          }
        };

        const mcuPins = comp.state?.pins || comp.properties?.pins;
        const explicitPinStates = comp.state?.pinStates;
        const drivenByRuntime = new Set<string>();

        if (mcuPins) {
          for (const [pinKey, pinObj] of Object.entries(mcuPins as Record<string, any>)) {
            if (pinObj && pinObj.mode === 'OUTPUT') {
              const bitVal: 0 | 1 =
                pinObj.digitalValue === 1 || pinObj.value === 1 || (pinObj.voltage ?? 0) >= 1.4
                  ? 1
                  : 0;
              driveMcuPinAliases(pinKey, bitVal);
              drivenByRuntime.add(pinKey.toLowerCase());
            }
          }
        }
        if (explicitPinStates && typeof explicitPinStates === 'object') {
          for (const [pinKey, rawVal] of Object.entries(explicitPinStates as Record<string, any>)) {
            if (drivenByRuntime.has(pinKey.toLowerCase())) continue;
            if (rawVal === 1 || rawVal === 0 || rawVal === true || rawVal === false) {
              driveMcuPinAliases(pinKey, rawVal === 1 || rawVal === true ? 1 : 0);
            }
          }
        }
        if (!mcuPins && !explicitPinStates && comp.type === 'arduino-uno') {
          const d13Blink: 0 | 1 = Math.floor(clockMs / 1000) % 2 === 0 ? 1 : 0;
          driveMcuPinAliases('d13', d13Blink);
        }
        break;
      }

      default:
        break;
    }
  }

  // Resolves all net logic levels from strongDrivers (and weakDrivers when no strong driver exists)
  const resolveNets = () => {
    for (const net of nets) {
      const sMap = strongDriversMap.get(net.id)!;
      const wMap = weakDriversMap.get(net.id)!;
      const sVals = Array.from(sMap.values());
      const hasStrong1 = sVals.includes(1);
      const hasStrong0 = sVals.includes(0);

      net.driverValues = sVals;
      net.driverCount = sVals.length;

      if (hasStrong1 && hasStrong0) {
        net.level = 'X';
        net.contention = true;
      } else if (hasStrong1) {
        net.level = 1;
        net.contention = false;
      } else if (hasStrong0) {
        net.level = 0;
        net.contention = false;
      } else {
        const wVals = Array.from(wMap.values());
        const hasWeak1 = wVals.includes(1);
        const hasWeak0 = wVals.includes(0);
        if (hasWeak1) {
          net.level = 1;
          net.contention = false;
        } else if (hasWeak0) {
          net.level = 0;
          net.contention = false;
        } else {
          net.level = 'Z';
          net.contention = false;
        }
      }

      for (const pin of net.pins) {
        pinStates.set(`${pin.compId}:${pin.pinId}`, net.level);
        pinStates.set(`${pin.compId}:${pin.pinId.toLowerCase()}`, net.level);
      }
    }
  };

  // Propagates weak pass-through signals across bidirectional resistive elements
  const propagateWeakPassThroughs = () => {
    for (const wMap of weakDriversMap.values()) {
      wMap.clear();
    }
    resolveNets();

    const maxPassSteps = components.length + 2;
    for (let pStep = 0; pStep < maxPassSteps; pStep++) {
      let passChanged = false;

      for (const comp of components) {
        if (comp.type === 'resistor' || comp.type === 'inductor' || comp.type === 'builtin_filament_bulb') {
          const net1 = getNetForPin(comp.id, 'p1', 'pin1', 't1');
          const net2 = getNetForPin(comp.id, 'p2', 'pin2', 't2');
          if (net1 && net2 && net1 !== net2) {
            if ((net1.level === 1 || net1.level === 0) && net2.level === 'Z' && strongDriversMap.get(net2.id)!.size === 0) {
              weakDriversMap.get(net2.id)!.set(`${comp.id}:p2`, net1.level);
              resolveNets();
              passChanged = true;
            } else if ((net2.level === 1 || net2.level === 0) && net1.level === 'Z' && strongDriversMap.get(net1.id)!.size === 0) {
              weakDriversMap.get(net1.id)!.set(`${comp.id}:p1`, net2.level);
              resolveNets();
              passChanged = true;
            }
          }
        } else if (comp.type === 'light-sensor') {
          const lux = typeof comp.properties?.lux === 'number' ? comp.properties.lux : 100;
          const thresh = typeof comp.properties?.threshold === 'number' ? comp.properties.threshold : 500;
          const levelToPropagate: LogicLevel = lux >= thresh ? 1 : 0;
          const net1 = getNetForPin(comp.id, 'p1', 'pin1');
          const net2 = getNetForPin(comp.id, 'p2', 'pin2');
          if (net1 && net2 && net1 !== net2) {
            if ((net1.level === 1 || net1.level === 0) && strongDriversMap.get(net2.id)!.size === 0) {
              const outLvl = net1.level === 1 ? levelToPropagate : net1.level;
              if (weakDriversMap.get(net2.id)!.get(`${comp.id}:p2`) !== outLvl) {
                weakDriversMap.get(net2.id)!.set(`${comp.id}:p2`, outLvl);
                resolveNets();
                passChanged = true;
              }
            } else if ((net2.level === 1 || net2.level === 0) && strongDriversMap.get(net1.id)!.size === 0) {
              const outLvl = net2.level === 1 ? levelToPropagate : net2.level;
              if (weakDriversMap.get(net1.id)!.get(`${comp.id}:p1`) !== outLvl) {
                weakDriversMap.get(net1.id)!.set(`${comp.id}:p1`, outLvl);
                resolveNets();
                passChanged = true;
              }
            }
          }
        } else if (comp.type === 'potentiometer') {
          const pos = comp.properties?.position ?? 50;
          const netT1 = getNetForPin(comp.id, 't1');
          const netT2 = getNetForPin(comp.id, 't2');
          const netWiper = getNetForPin(comp.id, 'wiper');

          if (netWiper && netWiper.level === 'Z' && strongDriversMap.get(netWiper.id)!.size === 0) {
            if (pos >= 50 && netT1 && (netT1.level === 0 || netT1.level === 1)) {
              weakDriversMap.get(netWiper.id)!.set(`${comp.id}:wiper`, netT1.level);
              resolveNets();
              passChanged = true;
            } else if (pos < 50 && netT2 && (netT2.level === 0 || netT2.level === 1)) {
              weakDriversMap.get(netWiper.id)!.set(`${comp.id}:wiper`, netT2.level);
              resolveNets();
              passChanged = true;
            }
          }
        } else if (comp.type === 'transistor-npn' || comp.type === 'builtin_npn') {
          const baseLvl = getInputNetLevel(comp.id, 'base', 'b');
          if (baseLvl === 1) {
            const netC = getNetForPin(comp.id, 'collector', 'c');
            const netE = getNetForPin(comp.id, 'emitter', 'e');
            if (netC && netE && netC !== netE) {
              if ((netC.level === 1 || netC.level === 0) && strongDriversMap.get(netE.id)!.size === 0) {
                weakDriversMap.get(netE.id)!.set(`${comp.id}:emitter`, netC.level);
                resolveNets();
                passChanged = true;
              } else if ((netE.level === 1 || netE.level === 0) && strongDriversMap.get(netC.id)!.size === 0) {
                weakDriversMap.get(netC.id)!.set(`${comp.id}:collector`, netE.level);
                resolveNets();
                passChanged = true;
              }
            }
          }
        } else if (comp.type === 'mosfet-n' || comp.type === 'builtin_nmos') {
          const gateLvl = getInputNetLevel(comp.id, 'gate', 'g');
          if (gateLvl === 1) {
            const netD = getNetForPin(comp.id, 'drain', 'd');
            const netS = getNetForPin(comp.id, 'source', 's');
            if (netD && netS && netD !== netS) {
              if ((netD.level === 1 || netD.level === 0) && strongDriversMap.get(netS.id)!.size === 0) {
                weakDriversMap.get(netS.id)!.set(`${comp.id}:source`, netD.level);
                resolveNets();
                passChanged = true;
              } else if ((netS.level === 1 || netS.level === 0) && strongDriversMap.get(netD.id)!.size === 0) {
                weakDriversMap.get(netD.id)!.set(`${comp.id}:drain`, netS.level);
                resolveNets();
                passChanged = true;
              }
            }
          }
        } else if (comp.type === 'builtin_pnp' || comp.type === 'transistor-pnp') {
          const baseLvl = getInputNetLevel(comp.id, 'base', 'b');
          if (baseLvl === 0) {
            const netE = getNetForPin(comp.id, 'emitter', 'e');
            const netC = getNetForPin(comp.id, 'collector', 'c');
            if (netE && netC && netE !== netC) {
              if ((netE.level === 1 || netE.level === 0) && strongDriversMap.get(netC.id)!.size === 0) {
                weakDriversMap.get(netC.id)!.set(`${comp.id}:collector`, netE.level);
                resolveNets();
                passChanged = true;
              } else if ((netC.level === 1 || netC.level === 0) && strongDriversMap.get(netE.id)!.size === 0) {
                weakDriversMap.get(netE.id)!.set(`${comp.id}:emitter`, netC.level);
                resolveNets();
                passChanged = true;
              }
            }
          }
        } else if (comp.type === 'builtin_pmos' || comp.type === 'mosfet-p') {
          const gateLvl = getInputNetLevel(comp.id, 'gate', 'g');
          if (gateLvl === 0) {
            const netS = getNetForPin(comp.id, 'source', 's');
            const netD = getNetForPin(comp.id, 'drain', 'd');
            if (netS && netD && netS !== netD) {
              if ((netS.level === 1 || netS.level === 0) && strongDriversMap.get(netD.id)!.size === 0) {
                weakDriversMap.get(netD.id)!.set(`${comp.id}:drain`, netS.level);
                resolveNets();
                passChanged = true;
              } else if ((netD.level === 1 || netD.level === 0) && strongDriversMap.get(netS.id)!.size === 0) {
                weakDriversMap.get(netS.id)!.set(`${comp.id}:source`, netD.level);
                resolveNets();
                passChanged = true;
              }
            }
          }
        } else if (comp.type === 'builtin_optocoupler') {
          const aLvl = getInputNetLevel(comp.id, 'anode');
          const kLvl = getInputNetLevel(comp.id, 'cathode');
          if (aLvl === 1 && kLvl === 0) {
            const netC = getNetForPin(comp.id, 'collector');
            const netE = getNetForPin(comp.id, 'emitter');
            if (netC && netE && netC !== netE) {
              if ((netC.level === 1 || netC.level === 0) && strongDriversMap.get(netE.id)!.size === 0) {
                weakDriversMap.get(netE.id)!.set(`${comp.id}:emitter`, netC.level);
                resolveNets();
                passChanged = true;
              } else if ((netE.level === 1 || netE.level === 0) && strongDriversMap.get(netC.id)!.size === 0) {
                weakDriversMap.get(netC.id)!.set(`${comp.id}:collector`, netE.level);
                resolveNets();
                passChanged = true;
              }
            }
          }
        } else if (comp.type === 'builtin_fuse') {
          const isBlown = comp.properties?.isBlown === true || comp.state?.isBlown === true;
          if (!isBlown) {
            const net1 = getNetForPin(comp.id, 'p1');
            const net2 = getNetForPin(comp.id, 'p2');
            if (net1 && net2 && net1 !== net2) {
              if ((net1.level === 1 || net1.level === 0) && strongDriversMap.get(net2.id)!.size === 0) {
                weakDriversMap.get(net2.id)!.set(`${comp.id}:p2`, net1.level);
                resolveNets();
                passChanged = true;
              } else if ((net2.level === 1 || net2.level === 0) && strongDriversMap.get(net1.id)!.size === 0) {
                weakDriversMap.get(net1.id)!.set(`${comp.id}:p1`, net2.level);
                resolveNets();
                passChanged = true;
              }
            }
          }
        } else if (comp.type === 'builtin_dip_switch_4') {
          for (let i = 1; i <= 4; i++) {
            const isClosed = comp.properties?.[`sw${i}`] === true;
            if (isClosed) {
              const net1 = getNetForPin(comp.id, `in${i}`, `sw${i}_a`);
              const net2 = getNetForPin(comp.id, `out${i}`, `sw${i}_b`);
              if (net1 && net2 && net1 !== net2) {
                if ((net1.level === 1 || net1.level === 0) && strongDriversMap.get(net2.id)!.size === 0) {
                  weakDriversMap.get(net2.id)!.set(`${comp.id}:out${i}`, net1.level);
                  resolveNets();
                  passChanged = true;
                } else if ((net2.level === 1 || net2.level === 0) && strongDriversMap.get(net1.id)!.size === 0) {
                  weakDriversMap.get(net1.id)!.set(`${comp.id}:in${i}`, net2.level);
                  resolveNets();
                  passChanged = true;
                }
              }
            }
          }
        }
      }

      if (!passChanged) break;
    }
  };

  // Initial resolution of primary sources and pass-throughs
  propagateWeakPassThroughs();

  // Compute atomic 4-way junction countdown values (tensValue & onesValue from single integer currentSeconds)
  const atomicJunctionCountdowns = new Map<
    'n' | 'e' | 's' | 'w',
    { currentSeconds: number; tensValue: number; onesValue: number }
  >();
  for (const comp of components) {
    if (comp.type !== 'builtin_cpu_8bit' && comp.type !== 'cpu-8bit') continue;
    const preset = comp.state?.asmRegisters?.junctionCountdowns;
    if (preset && preset.n && preset.e && preset.s && preset.w) {
      (['n', 'e', 's', 'w'] as const).forEach((k) => {
        const currentSeconds = Math.max(0, Math.round(preset[k].currentSeconds));
        atomicJunctionCountdowns.set(k, {
          currentSeconds,
          tensValue: Math.floor(currentSeconds / 10),
          onesValue: currentSeconds % 10,
        });
      });
      break;
    }

    const bitVal = (pinId: string): number => (getPinLevel(comp.id, pinId) === 1 ? 1 : 0);
    const phaseMask = bitVal('out4') | (bitVal('out5') << 1) | (bitVal('out6') << 2) | (bitVal('out7') << 3);
    if (phaseMask === 1 || phaseMask === 2 || phaseMask === 4 || phaseMask === 8) {
      const activePhase = phaseMask === 1 ? 0 : phaseMask === 2 ? 1 : phaseMask === 4 ? 2 : 3;
      const rawOnes =
        bitVal('out0') | (bitVal('out1') << 1) | (bitVal('out2') << 2) | (bitVal('out3') << 3);
      const phaseSecondsRemaining = rawOnes === 0 ? 10 : rawOnes;
      (['n', 'e', 's', 'w'] as const).forEach((k, jIdx) => {
        const slot = (jIdx - activePhase + 4) % 4;
        const slotOffset = slot === 0 ? 0 : slot === 1 ? 0 : slot === 2 ? 10 : 20;
        const totalSecondsRemaining = slotOffset + phaseSecondsRemaining;
        const currentSeconds = Math.max(0, Math.round(totalSecondsRemaining));
        const tensValue = Math.floor(currentSeconds / 10);
        const onesValue = currentSeconds % 10;
        atomicJunctionCountdowns.set(k, { currentSeconds, tensValue, onesValue });
      });
      break;
    }
  }

  // =========================================================================
  // 3. PHASE A: 100-Iteration Unidirectional Logic Gate Convergence Loop
  // =========================================================================
  const gateOutputsMap = new Map<string, LogicLevel>();
  const nextCompStates = new Map<string, Record<string, any>>();

  for (let step = 0; step < 100; step++) {
    const prevNetLevels = nets.map((n) => n.level);
    let gateChanged = false;

    // Synchronously evaluate all Logic Gates & Active ICs from current input net states
    const nextGateOutputs = new Map<
      string,
      Array<{ pinId: string; level: LogicLevel; voltageV?: number }>
    >();
    const addGateOutput = (
      compId: string,
      pinId: string,
      level: LogicLevel,
      voltageV?: number
    ) => {
      if (!nextGateOutputs.has(compId)) {
        nextGateOutputs.set(compId, []);
      }
      nextGateOutputs.get(compId)!.push({ pinId, level, voltageV });
    };

    for (const comp of components) {
      switch (comp.type) {
        case 'gate-not': {
          const inSig = getInputNetLevel(comp.id, 'in', 'in_a', 'in1', 'a');
          // Rule 1: Unconnected / 'Z' input MUST output 'Z' (NEVER 1!)
          const outVal: LogicLevel =
            inSig === 'Z' ? 'Z' : inSig === 'X' ? 'X' : inSig === 1 ? 0 : 1;
          addGateOutput(comp.id, 'out', outVal);
          break;
        }

        case 'gate-buffer':
        case 'buffer': {
          const inSig = getInputNetLevel(comp.id, 'in', 'in_a', 'in1', 'a');
          const outVal: LogicLevel =
            inSig === 'Z' ? 'Z' : inSig === 'X' ? 'X' : inSig === 1 ? 1 : 0;
          addGateOutput(comp.id, 'out', outVal);
          break;
        }

        case 'gate-and':
        case 'gate-or':
        case 'gate-nand':
        case 'gate-nor':
        case 'gate-xor':
        case 'gate-xnor': {
          const inA = getInputNetLevel(comp.id, 'in_a', 'in1', 'a');
          const inB = getInputNetLevel(comp.id, 'in_b', 'in2', 'b');
          let outVal: LogicLevel = 'Z';

          // Rule 1: If ANY required input pin is 'Z', gate output MUST be 'Z'
          if (inA === 'Z' || inB === 'Z') {
            outVal = 'Z';
          } else if (inA === 'X' || inB === 'X') {
            outVal = 'X';
          } else {
            if (comp.type === 'gate-and') outVal = inA === 1 && inB === 1 ? 1 : 0;
            else if (comp.type === 'gate-or') outVal = inA === 1 || inB === 1 ? 1 : 0;
            else if (comp.type === 'gate-nand') outVal = inA === 1 && inB === 1 ? 0 : 1;
            else if (comp.type === 'gate-nor') outVal = inA === 1 || inB === 1 ? 0 : 1;
            else if (comp.type === 'gate-xor') outVal = inA !== inB ? 1 : 0;
            else if (comp.type === 'gate-xnor') outVal = inA === inB ? 1 : 0;
          }

          addGateOutput(comp.id, 'out', outVal);
          break;
        }

        case 'ic-555':
        case 'builtin_555':
        case 'timer-555': {
          const vcc = getInputNetLevel(comp.id, 'pin8_vcc', 'vcc');
          const gnd = getInputNetLevel(comp.id, 'pin1_gnd', 'gnd');
          const isPowered = vcc === 1 && gnd === 0;
          const tSec = clockMs / 1000;
          const freq = typeof comp.properties?.frequency === 'number' ? comp.properties.frequency : 1.0;
          const duty = typeof comp.properties?.dutyCycle === 'number' ? comp.properties.dutyCycle / 100 : 0.5;
          const phase = (tSec * freq) % 1.0;
          const outVal: LogicLevel = isPowered
            ? (phase < duty ? 1 : 0)
            : 'Z';
          addGateOutput(comp.id, 'pin3_out', outVal);
          addGateOutput(comp.id, 'out', outVal);
          break;
        }

        case 'temp-sensor': {
          const vcc = getInputNetLevel(comp.id, 'vcc');
          const gnd = getInputNetLevel(comp.id, 'gnd');
          const isPowered = vcc === 1 && gnd === 0;
          if (isPowered) {
            const temp = comp.properties?.temperatureC ?? 25;
            const threshold = comp.properties?.threshold ?? 50;
            const outVal: 0 | 1 = temp >= threshold ? 1 : 0;
            addGateOutput(comp.id, 'vout', outVal);
          } else {
            addGateOutput(comp.id, 'vout', 'Z');
          }
          break;
        }

        case 'builtin_humidity_sensor':
        case 'humidity-sensor': {
          const vccNet = getNetForPin(comp.id, 'vcc');
          const vcc = getInputNetLevel(comp.id, 'vcc');
          const gnd = getInputNetLevel(comp.id, 'gnd');
          const isPowered = (!vccNet || vcc === 1) && gnd !== 1;
          if (isPowered) {
            const humidity = comp.properties?.humidity ?? 45;
            const threshold = comp.properties?.threshold ?? 60;
            const outVal: 0 | 1 = humidity >= threshold ? 1 : 0;
            addGateOutput(comp.id, 'out', outVal, 5.0 * (humidity / 100));
          } else {
            addGateOutput(comp.id, 'out', 'Z');
          }
          break;
        }

        case 'builtin_motion_sensor':
        case 'motion-sensor': {
          const vccNet = getNetForPin(comp.id, 'vcc');
          const vcc = getInputNetLevel(comp.id, 'vcc');
          const gnd = getInputNetLevel(comp.id, 'gnd');
          const isPowered = (!vccNet || vcc === 1) && gnd !== 1;
          if (isPowered) {
            const motion =
              comp.properties?.motionDetected === true || comp.state?.motionDetected === true;
            const outVal: 0 | 1 = motion ? 1 : 0;
            addGateOutput(comp.id, 'out', outVal, motion ? 3.3 : 0.0);
          } else {
            addGateOutput(comp.id, 'out', 'Z');
          }
          break;
        }

        case 'builtin_gas_sensor':
        case 'gas-sensor': {
          const vccNet = getNetForPin(comp.id, 'vcc');
          const vcc = getInputNetLevel(comp.id, 'vcc');
          const gnd = getInputNetLevel(comp.id, 'gnd');
          const isPowered = (!vccNet || vcc === 1) && gnd !== 1;
          if (isPowered) {
            const ppm = comp.properties?.ppm ?? 50;
            const threshold = comp.properties?.threshold ?? 400;
            const doVal: 0 | 1 = ppm >= threshold ? 1 : 0;
            const vAo = 0.2 + 4.6 * Math.min(1, Math.max(0, ppm / 2000));
            const aoVal: 0 | 1 = vAo >= 2.0 ? 1 : 0;
            addGateOutput(comp.id, 'do', doVal, doVal === 1 ? 5.0 : 0.0);
            addGateOutput(comp.id, 'ao', aoVal, vAo);
          } else {
            addGateOutput(comp.id, 'do', 'Z');
            addGateOutput(comp.id, 'ao', 'Z');
          }
          break;
        }

        case 'builtin_accelerometer':
        case 'accelerometer': {
          const vccNet = getNetForPin(comp.id, 'vcc');
          const vcc = getInputNetLevel(comp.id, 'vcc');
          const gnd = getInputNetLevel(comp.id, 'gnd');
          const isPowered = (!vccNet || vcc === 1) && gnd !== 1;
          if (isPowered) {
            const ax = comp.properties?.accelX ?? 0.0;
            const ay = comp.properties?.accelY ?? 0.0;
            const az = comp.properties?.accelZ ?? 1.0;
            const thresh = comp.properties?.tiltThreshold ?? 0.5;
            const xVal: 0 | 1 = ax > thresh ? 1 : 0;
            const yVal: 0 | 1 = ay > thresh ? 1 : 0;
            const zVal: 0 | 1 = az > thresh ? 1 : 0;
            addGateOutput(comp.id, 'x', xVal, Math.max(0, Math.min(3.3, 1.65 + (ax / 3.0) * 1.65)));
            addGateOutput(comp.id, 'y', yVal, Math.max(0, Math.min(3.3, 1.65 + (ay / 3.0) * 1.65)));
            addGateOutput(comp.id, 'z', zVal, Math.max(0, Math.min(3.3, 1.65 + (az / 3.0) * 1.65)));
          } else {
            addGateOutput(comp.id, 'x', 'Z');
            addGateOutput(comp.id, 'y', 'Z');
            addGateOutput(comp.id, 'z', 'Z');
          }
          break;
        }

        case 'builtin_dcdc_converter':
        case 'dcdc-converter': {
          const vinPlus = getInputNetLevel(comp.id, 'vin_plus');
          const vinMinus = getInputNetLevel(comp.id, 'vin_minus');
          const targetV =
            typeof comp.properties?.targetVoltage === 'number' ? comp.properties.targetVoltage : 12.0;
          if (vinPlus === 1 && vinMinus !== 1) {
            addGateOutput(comp.id, 'vout_plus', 1, targetV);
            addGateOutput(comp.id, 'vout_minus', 0, 0.0);
          } else if (vinPlus === 0) {
            addGateOutput(comp.id, 'vout_plus', 0, 0.0);
            addGateOutput(comp.id, 'vout_minus', 0, 0.0);
          } else {
            addGateOutput(comp.id, 'vout_plus', 'Z');
          }
          break;
        }

        case 'builtin_numpad':
        case 'numpad': {
          const activeKey = String(
            comp.properties?.activeKey ??
              comp.properties?.pressedKey ??
              comp.state?.activeKey ??
              comp.state?.pressedKey ??
              ''
          ).trim();
          const outVal: 0 | 1 = activeKey.length > 0 ? 1 : 0;
          addGateOutput(comp.id, 'out', outVal, outVal === 1 ? 5.0 : 0.0);
          break;
        }

        // =====================================================================
        // PHASE 7.4 & 7.8 EXPANSION: ACTIVE GATES & LOGIC ICS
        // =====================================================================

        case 'opamp':
        case 'builtin_opamp': {
          const inP = getInputNetLevel(comp.id, 'in_pos', 'in_plus', 'in+', 'inp');
          const inN = getInputNetLevel(comp.id, 'in_neg', 'in_minus', 'in-', 'inm');
          if (inP === 'Z' && inN === 'Z') {
            addGateOutput(comp.id, 'out', 'Z');
          } else {
            const outVal: 0 | 1 = inP === 1 && inN !== 1 ? 1 : 0;
            addGateOutput(comp.id, 'out', outVal, outVal === 1 ? 5.0 : 0.0);
          }
          break;
        }

        case 'builtin_comparator': {
          const inP = getInputNetLevel(comp.id, 'in_plus', 'in+', 'inp');
          const inM = getInputNetLevel(comp.id, 'in_minus', 'in-', 'inm');
          if (inP === 'Z') {
            addGateOutput(comp.id, 'out', 'Z');
          } else {
            let outVal: 0 | 1 = 0;
            if (inM === 'Z') {
              // Reference threshold
              const th = typeof comp.properties?.thresholdVoltage === 'number' ? comp.properties.thresholdVoltage : 2.5;
              const isHigh = inP === 1 || (comp.state?.pinVoltages?.['in_plus'] !== undefined && comp.state.pinVoltages['in_plus'] > th);
              outVal = isHigh ? 1 : 0;
            } else {
              outVal = inP === 1 && inM === 0 ? 1 : 0;
            }
            addGateOutput(comp.id, 'out', outVal, outVal === 1 ? 5.0 : 0.0);
          }
          break;
        }

        case 'builtin_shift_register': {
          const data = getInputNetLevel(comp.id, 'data');
          const clk = getInputNetLevel(comp.id, 'clk');
          const latch = getInputNetLevel(comp.id, 'latch');
          const rst = getInputNetLevel(comp.id, 'rst');
          const autoLatch = comp.properties?.autoLatch !== false;

          const staged = nextCompStates.get(comp.id);
          let shiftBits = staged ? staged.shiftBits : (typeof comp.state?.shiftBits === 'number' ? comp.state.shiftBits : (typeof comp.properties?.shiftBits === 'number' ? comp.properties.shiftBits : 0));
          let outputBits = staged ? staged.outputBits : (typeof comp.state?.outputBits === 'number' ? comp.state.outputBits : (typeof comp.properties?.outputBits === 'number' ? comp.properties.outputBits : 0));
          const prevClk = comp.state?.prevClk;
          const prevLatch = comp.state?.prevLatch;

          if (step === 0) {
            if (rst === 1) {
              shiftBits = 0;
              outputBits = 0;
            } else {
              const isRisingClk = (prevClk === 0 || prevClk === undefined) && clk === 1;
              if (isRisingClk) {
                const bit = data === 1 ? 1 : 0;
                shiftBits = ((shiftBits << 1) & 0xFF) | bit;
                if (autoLatch || latch === 1) {
                  outputBits = shiftBits;
                }
              }
              const isRisingLatch = (prevLatch === 0 || prevLatch === undefined) && latch === 1;
              if (isRisingLatch) {
                outputBits = shiftBits;
              }
            }
            nextCompStates.set(comp.id, { shiftBits, outputBits, prevClk: clk, prevLatch: latch });
          }

          for (let i = 0; i < 8; i++) {
            const qBit: 0 | 1 = (outputBits & (1 << i)) ? 1 : 0;
            addGateOutput(comp.id, `q${i}`, qBit, qBit * 5.0);
            addGateOutput(comp.id, `q${String.fromCharCode(97 + i)}`, qBit, qBit * 5.0);
          }
          break;
        }

        case 'builtin_bcd_decoder': {
          let val: number;
          const jMatch = comp.id.match(/^dec_([nesw])_(tens|ones)$/i);
          const jKey = jMatch ? (jMatch[1].toLowerCase() as 'n' | 'e' | 's' | 'w') : null;
          const jEntry = jKey ? atomicJunctionCountdowns.get(jKey) : undefined;
          if (jMatch && jEntry) {
            val = jMatch[2].toLowerCase() === 'tens' ? jEntry.tensValue : jEntry.onesValue;
            const b0: 0 | 1 = (val & 1) !== 0 ? 1 : 0;
            const b1: 0 | 1 = (val & 2) !== 0 ? 1 : 0;
            const b2: 0 | 1 = (val & 4) !== 0 ? 1 : 0;
            const b3: 0 | 1 = (val & 8) !== 0 ? 1 : 0;
            pinStates.set(`${comp.id}:d0`, b0);
            pinStates.set(`${comp.id}:d1`, b1);
            pinStates.set(`${comp.id}:d2`, b2);
            pinStates.set(`${comp.id}:d3`, b3);
          } else {
            const d0 = getInputNetLevel(comp.id, 'd0', 'a') === 1 ? 1 : 0;
            const d1 = getInputNetLevel(comp.id, 'd1', 'b') === 1 ? 2 : 0;
            const d2 = getInputNetLevel(comp.id, 'd2', 'c') === 1 ? 4 : 0;
            const d3 = getInputNetLevel(comp.id, 'd3', 'd') === 1 ? 8 : 0;
            val = d0 + d1 + d2 + d3;
          }

          // Standard CD4511 7-segment active-high truth table for 0-9
          const segMap: Record<number, number[]> = {
            0: [1, 1, 1, 1, 1, 1, 0], // a,b,c,d,e,f,g
            1: [0, 1, 1, 0, 0, 0, 0],
            2: [1, 1, 0, 1, 1, 0, 1],
            3: [1, 1, 1, 1, 0, 0, 1],
            4: [0, 1, 1, 0, 0, 1, 1],
            5: [1, 0, 1, 1, 0, 1, 1],
            6: [1, 0, 1, 1, 1, 1, 1],
            7: [1, 1, 1, 0, 0, 0, 0],
            8: [1, 1, 1, 1, 1, 1, 1],
            9: [1, 1, 1, 1, 0, 1, 1],
          };
          const segs = segMap[val] ?? [0, 0, 0, 0, 0, 0, 0];
          const segNames = ['qa', 'qb', 'qc', 'qd', 'qe', 'qf', 'qg'];
          const altSegNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
          for (let i = 0; i < 7; i++) {
            const bit = (segs[i] ? 1 : 0) as 0 | 1;
            addGateOutput(comp.id, segNames[i], bit, bit * 5.0);
            addGateOutput(comp.id, altSegNames[i], bit, bit * 5.0);
          }
          break;
        }

        case 'builtin_mux_4to1': {
          const s0 = getInputNetLevel(comp.id, 's0') === 1 ? 1 : 0;
          const s1 = getInputNetLevel(comp.id, 's1') === 1 ? 2 : 0;
          const idx = s0 + s1;
          const selVal = getInputNetLevel(comp.id, `i${idx}`);
          if (selVal === 'Z') {
            addGateOutput(comp.id, 'y', 'Z');
            addGateOutput(comp.id, 'out', 'Z');
          } else {
            const bit: 0 | 1 = selVal === 1 ? 1 : 0;
            addGateOutput(comp.id, 'y', bit, bit * 5.0);
            addGateOutput(comp.id, 'out', bit, bit * 5.0);
          }
          break;
        }

        case 'builtin_d_flipflop': {
          const d = getInputNetLevel(comp.id, 'd');
          const clk = getInputNetLevel(comp.id, 'clk');
          const set = getInputNetLevel(comp.id, 'set');
          const rst = getInputNetLevel(comp.id, 'rst');
          const prevClk = comp.state?.prevClk;

          let q: 0 | 1 = (comp.state?.q ?? comp.properties?.q ?? 0) === 1 ? 1 : 0;
          if (set === 1) {
            q = 1;
          } else if (rst === 1) {
            q = 0;
          } else {
            const isRising = (prevClk === 0 || prevClk === undefined) && clk === 1;
            if (isRising) {
              q = d === 1 ? 1 : 0;
            }
          }
          const nq: 0 | 1 = q === 1 ? 0 : 1;
          addGateOutput(comp.id, 'q', q, q * 5.0);
          addGateOutput(comp.id, 'nq', nq, nq * 5.0);
          break;
        }

        case 'builtin_jk_flipflop': {
          const j = getInputNetLevel(comp.id, 'j');
          const k = getInputNetLevel(comp.id, 'k');
          const clk = getInputNetLevel(comp.id, 'clk');
          const rst = getInputNetLevel(comp.id, 'rst');
          const prevClk = comp.state?.prevClk;

          let q: 0 | 1 = (comp.state?.q ?? comp.properties?.q ?? 0) === 1 ? 1 : 0;
          if (rst === 1) {
            q = 0;
          } else {
            const isRising = (prevClk === 0 || prevClk === undefined) && clk === 1;
            if (isRising) {
              if (j === 1 && k === 1) {
                q = q === 1 ? 0 : 1;
              } else if (j === 1 && k !== 1) {
                q = 1;
              } else if (j !== 1 && k === 1) {
                q = 0;
              }
            }
          }
          const nq: 0 | 1 = q === 1 ? 0 : 1;
          addGateOutput(comp.id, 'q', q, q * 5.0);
          addGateOutput(comp.id, 'nq', nq, nq * 5.0);
          break;
        }

        case 'builtin_counter_4bit': {
          const clk = getInputNetLevel(comp.id, 'clk');
          const en = getInputNetLevel(comp.id, 'en');
          const rst = getInputNetLevel(comp.id, 'rst');
          const prevClk = comp.state?.prevClk;

          const staged = nextCompStates.get(comp.id);
          let count = staged ? staged.count : (typeof comp.state?.count === 'number' ? comp.state.count : (typeof comp.properties?.count === 'number' ? comp.properties.count : 0));
          if (step === 0) {
            if (rst === 1) {
              count = 0;
            } else {
              const isRising = (prevClk === 0 || prevClk === undefined) && clk === 1;
              const isEnabled = en === 1 || en === 'Z' || en === undefined;
              if (isRising && isEnabled) {
                count = (count + 1) % 16;
              }
            }
            nextCompStates.set(comp.id, { count, prevClk: clk });
          }
          const q0: 0 | 1 = (count & 1) ? 1 : 0;
          const q1: 0 | 1 = (count & 2) ? 1 : 0;
          const q2: 0 | 1 = (count & 4) ? 1 : 0;
          const q3: 0 | 1 = (count & 8) ? 1 : 0;
          addGateOutput(comp.id, 'q0', q0, q0 * 5.0);
          addGateOutput(comp.id, 'q1', q1, q1 * 5.0);
          addGateOutput(comp.id, 'q2', q2, q2 * 5.0);
          addGateOutput(comp.id, 'q3', q3, q3 * 5.0);
          addGateOutput(comp.id, 'qa', q0, q0 * 5.0);
          addGateOutput(comp.id, 'qb', q1, q1 * 5.0);
          addGateOutput(comp.id, 'qc', q2, q2 * 5.0);
          addGateOutput(comp.id, 'qd', q3, q3 * 5.0);
          break;
        }

        case 'builtin_dip_switch_4': {
          const pullup = comp.properties?.internalPullup === true;
          if (pullup) {
            for (let i = 1; i <= 4; i++) {
              const swOn = comp.properties?.[`sw${i}`] === true;
              const bit: 0 | 1 = swOn ? 1 : 0;
              addGateOutput(comp.id, `out${i}`, bit, bit * 5.0);
            }
          }
          break;
        }

        case 'builtin_hbridge': {
          const ena = getInputNetLevel(comp.id, 'ena');
          const in1 = getInputNetLevel(comp.id, 'in1');
          const in2 = getInputNetLevel(comp.id, 'in2');
          const isEnabled = ena === 1 || ena === 'Z' || ena === undefined;
          if (isEnabled) {
            if (in1 === 1 && in2 !== 1) {
              addGateOutput(comp.id, 'out1', 1, 12.0);
              addGateOutput(comp.id, 'out2', 0, 0.0);
            } else if (in1 !== 1 && in2 === 1) {
              addGateOutput(comp.id, 'out1', 0, 0.0);
              addGateOutput(comp.id, 'out2', 1, 12.0);
            } else {
              addGateOutput(comp.id, 'out1', 0, 0.0);
              addGateOutput(comp.id, 'out2', 0, 0.0);
            }
          } else {
            addGateOutput(comp.id, 'out1', 'Z');
            addGateOutput(comp.id, 'out2', 'Z');
          }
          break;
        }

        case 'builtin_reg_7805':
        case 'voltage-regulator-7805':
        case 'lm7805': {
          const vin = getInputNetLevel(comp.id, 'in', 'vin', 'input');
          const gnd = getInputNetLevel(comp.id, 'gnd', 'ground');
          if (vin === 1 && gnd !== 1) {
            addGateOutput(comp.id, 'out', 1, 5.0);
          } else {
            addGateOutput(comp.id, 'out', 0, 0.0);
          }
          break;
        }

        case 'builtin_bridge_rectifier': {
          const ac1 = getInputNetLevel(comp.id, 'ac1');
          const ac2 = getInputNetLevel(comp.id, 'ac2');
          if (ac1 === 1 || ac2 === 1) {
            addGateOutput(comp.id, 'dc_plus', 1, 5.0);
            addGateOutput(comp.id, 'dc_minus', 0, 0.0);
          } else {
            addGateOutput(comp.id, 'dc_plus', 0, 0.0);
            addGateOutput(comp.id, 'dc_minus', 0, 0.0);
          }
          break;
        }

        case 'builtin_solar_panel': {
          const lux = typeof comp.properties?.lux === 'number' ? comp.properties.lux : 100;
          const maxV = typeof comp.properties?.maxVoltage === 'number' ? comp.properties.maxVoltage : 6.0;
          const vGen = Math.min(maxV, 0.5 + (lux / 1000) * (maxV - 0.5));
          const outBit: 0 | 1 = lux >= 400 ? 1 : 0;
          addGateOutput(comp.id, 'pos', outBit, vGen);
          addGateOutput(comp.id, 'neg', 0, 0.0);
          break;
        }

        case 'builtin_joystick': {
          const xVal = typeof comp.properties?.joyX === 'number' ? comp.properties.joyX : 0;
          const yVal = typeof comp.properties?.joyY === 'number' ? comp.properties.joyY : 0;
          const pressed = comp.properties?.isPressed === true;
          const vrxBit: 0 | 1 = xVal > 30 ? 1 : 0;
          const vryBit: 0 | 1 = yVal > 30 ? 1 : 0;
          const swBit: 0 | 1 = pressed ? 0 : 1;
          const vrxV = 2.5 + (xVal / 100) * 2.5;
          const vryV = 2.5 + (yVal / 100) * 2.5;
          addGateOutput(comp.id, 'vrx', vrxBit, vrxV);
          addGateOutput(comp.id, 'vry', vryBit, vryV);
          addGateOutput(comp.id, 'sw', swBit, swBit * 5.0);
          break;
        }

        case 'builtin_stepper_motor': {
          const clk = getInputNetLevel(comp.id, 'a_plus');
          const dir = getInputNetLevel(comp.id, 'b_plus');
          const prevClk = comp.state?.prevClk;
          const staged = nextCompStates.get(comp.id);
          let angle = staged ? staged.angle : (typeof comp.state?.angle === 'number' ? comp.state.angle : (typeof comp.properties?.angle === 'number' ? comp.properties.angle : 0));
          let stepCount = staged ? staged.stepCount : (typeof comp.state?.stepCount === 'number' ? comp.state.stepCount : 0);
          if (step === 0) {
            const isRising = (prevClk === 0 || prevClk === undefined) && clk === 1;
            if (isRising) {
              const stepDeg = typeof comp.properties?.stepDeg === 'number' ? comp.properties.stepDeg : 1.8;
              const delta = dir === 1 ? -stepDeg : stepDeg;
              angle = (angle + delta + 360) % 360;
              stepCount += 1;
            }
            nextCompStates.set(comp.id, { angle, stepCount, prevClk: clk });
          }
          break;
        }

        // =====================================================================
        // PHASE 7.9 EXPANSION: SENSORS, WIRELESS RF & IR BRIDGES
        // =====================================================================
        case 'builtin_soil_moisture': {
          const vccNet = getNetForPin(comp.id, 'vcc');
          const vcc = getInputNetLevel(comp.id, 'vcc');
          const gnd = getInputNetLevel(comp.id, 'gnd');
          const isPowered = (!vccNet || vcc === 1) && gnd !== 1;
          if (isPowered) {
            const moisture = typeof comp.properties?.moisture === 'number' ? comp.properties.moisture : 20;
            const threshold = typeof comp.properties?.threshold === 'number' ? comp.properties.threshold : 50;
            const triggerOnDry = comp.properties?.triggerOnDry === true;
            const isTrig = triggerOnDry ? moisture < threshold : moisture >= threshold;
            const outVal: 0 | 1 = isTrig ? 1 : 0;
            addGateOutput(comp.id, 'out', outVal, outVal === 1 ? 5.0 : 0.0);
          } else {
            addGateOutput(comp.id, 'out', 'Z');
          }
          break;
        }

        case 'builtin_hall_sensor': {
          const vccNet = getNetForPin(comp.id, 'vcc');
          const vcc = getInputNetLevel(comp.id, 'vcc');
          const gnd = getInputNetLevel(comp.id, 'gnd');
          const isPowered = (!vccNet || vcc === 1) && gnd !== 1;
          if (isPowered) {
            const mag = typeof comp.properties?.magneticField === 'number' ? comp.properties.magneticField : 0;
            const threshold = typeof comp.properties?.threshold === 'number' ? comp.properties.threshold : 30;
            const outVal: 0 | 1 = mag >= threshold ? 1 : 0;
            addGateOutput(comp.id, 'out', outVal, outVal === 1 ? 5.0 : 0.0);
          } else {
            addGateOutput(comp.id, 'out', 'Z');
          }
          break;
        }

        case 'builtin_vibration_sensor': {
          const vccNet = getNetForPin(comp.id, 'vcc');
          const vcc = getInputNetLevel(comp.id, 'vcc');
          const gnd = getInputNetLevel(comp.id, 'gnd');
          const isPowered = (!vccNet || vcc === 1) && gnd !== 1;
          if (isPowered) {
            const vib = comp.properties?.vibrationDetected === true || comp.state?.vibrationDetected === true;
            const outVal: 0 | 1 = vib ? 1 : 0;
            addGateOutput(comp.id, 'out', outVal, outVal === 1 ? 5.0 : 0.0);
          } else {
            addGateOutput(comp.id, 'out', 'Z');
          }
          break;
        }

        case 'builtin_ir_rx': {
          const vccNet = getNetForPin(comp.id, 'vcc');
          const vcc = getInputNetLevel(comp.id, 'vcc');
          const gnd = getInputNetLevel(comp.id, 'gnd');
          const isPowered = (!vccNet || vcc === 1) && gnd !== 1;
          if (isPowered) {
            let irActive = comp.properties?.irDetected === true;
            if (!irActive) {
              for (const other of components) {
                if (other.type === 'builtin_ir_tx') {
                  const dist = Math.hypot((other.x ?? 0) - (comp.x ?? 0), (other.y ?? 0) - (comp.y ?? 0));
                  if (dist <= 600) {
                    const txA = getInputNetLevel(other.id, 'anode');
                    const txC = getInputNetLevel(other.id, 'cathode');
                    if (txA === 1 && txC === 0) {
                      irActive = true;
                      break;
                    }
                  }
                }
              }
            }
            const outVal: 0 | 1 = irActive ? 1 : 0;
            addGateOutput(comp.id, 'out', outVal, outVal === 1 ? 5.0 : 0.0);
          } else {
            addGateOutput(comp.id, 'out', 'Z');
          }
          break;
        }

        case 'builtin_rf_radio': {
          const vccNet = getNetForPin(comp.id, 'vcc');
          const vcc = getInputNetLevel(comp.id, 'vcc');
          const gnd = getInputNetLevel(comp.id, 'gnd');
          const isPowered = (!vccNet || vcc === 1) && gnd !== 1;
          if (isPowered) {
            const myChannel = comp.properties?.rfChannel || 'CH 1 (433.0 MHz)';
            let rxActive = false;
            for (const other of components) {
              if (other.id !== comp.id && other.type === 'builtin_rf_radio') {
                const otherChannel = other.properties?.rfChannel || 'CH 1 (433.0 MHz)';
                if (otherChannel === myChannel) {
                  const oVccNet = getNetForPin(other.id, 'vcc');
                  const oVcc = getInputNetLevel(other.id, 'vcc');
                  const oGnd = getInputNetLevel(other.id, 'gnd');
                  const oPowered = (!oVccNet || oVcc === 1) && oGnd !== 1;
                  const oTx = getInputNetLevel(other.id, 'tx');
                  if (oPowered && oTx === 1) {
                    rxActive = true;
                    break;
                  }
                }
              }
            }
            const outVal: 0 | 1 = rxActive ? 1 : 0;
            addGateOutput(comp.id, 'rx', outVal, outVal === 1 ? 5.0 : 0.0);
          } else {
            addGateOutput(comp.id, 'rx', 'Z');
          }
          break;
        }

        default:
          break;
      }
    }

    // Apply updated gate outputs to strongDrivers
    for (const [compId, outList] of nextGateOutputs.entries()) {
      for (const { pinId, level, voltageV } of outList) {
        const gKey = `${compId}:${pinId}`;
        if (gateOutputsMap.get(gKey) !== level) {
          gateOutputsMap.set(gKey, level);
          gateOutputsMap.set(compId, level);
          gateChanged = true;
        }
        setStrongDriver(compId, pinId, level, voltageV);
      }
    }

    // Re-evaluate nets and weak pass-through bridges
    propagateWeakPassThroughs();

    const netsIdentical = nets.every((n, idx) => n.level === prevNetLevels[idx]);
    if (!gateChanged && netsIdentical) {
      break;
    }
  }

  // Record final contention errors (only true strong driver collisions)
  for (const net of nets) {
    if (net.contention) {
      const compIds = Array.from(new Set(net.pins.map((p) => p.compId)));
      contentionErrors.push({
        netId: net.id,
        message: 'Direct Short Circuit: Logic High (1) and Ground (0) contending on the same wire!',
        compIds,
      });
    }
  }

  // =========================================================================
  // 4. PHASE B: Dual Reachability & Voltage-Differential Solver
  // Supports:
  // - Standard HIGH (1) source -> LOW (0) ground return
  // - Active-Low current sinking into any LOW (0) Logic Gate or MCU output pin
  // - Higher-voltage source (e.g. 9V Battery+) sinking into lower-voltage (5V/3.3V) Gate/MCU HIGH output
  // =========================================================================
  const maxHighV = new Map<string, number>();
  const minSinkV = new Map<string, number>();

  for (const net of nets) {
    const sMap = strongDriversMap.get(net.id)!;
    const vMap = strongDriverVoltagesMap.get(net.id)!;
    const sVals = Array.from(sMap.values());
    const vVals = Array.from(vMap.values());

    net.hasHighPath = !net.contention && sVals.includes(1);
    net.hasGroundReturn = !net.contention && sVals.includes(0);

    if (!net.contention && vVals.length > 0) {
      let maxV = -Infinity;
      let minV = Infinity;
      for (const [dKey, bit] of sMap.entries()) {
        const v = vMap.get(dKey) ?? (bit === 1 ? 5.0 : 0.0);
        if (bit === 1 && v > maxV) maxV = v;
        if (v < minV) minV = v;
      }
      if (maxV > -Infinity) maxHighV.set(net.id, maxV);
      if (minV < Infinity) minSinkV.set(net.id, minV);
    }
  }

  const propagatePotentialPair = (
    net1: ElectricalNet | undefined,
    net2: ElectricalNet | undefined,
    allowBidirectional: boolean
  ): boolean => {
    if (!net1 || !net2 || net1 === net2) return false;
    let changed = false;

    const net1Strong0 = strongDriversMap.get(net1.id)!.size > 0 && net1.level === 0;
    const net2Strong0 = strongDriversMap.get(net2.id)!.size > 0 && net2.level === 0;
    const net1Strong1 = strongDriversMap.get(net1.id)!.size > 0 && net1.level === 1;
    const net2Strong1 = strongDriversMap.get(net2.id)!.size > 0 && net2.level === 1;

    // Forward: net1 -> net2
    if (net1.hasHighPath && !net2.hasHighPath && !net2Strong0) {
      net2.hasHighPath = true;
      changed = true;
    }
    const vHigh1 = maxHighV.get(net1.id);
    if (vHigh1 !== undefined && !net2Strong0 && strongDriversMap.get(net2.id)!.size === 0) {
      const prev2 = maxHighV.get(net2.id) ?? -Infinity;
      if (vHigh1 > prev2 + 1e-4) {
        maxHighV.set(net2.id, vHigh1);
        changed = true;
      }
    }

    // Backward: net2 -> net1 (sink / ground return)
    if (net2.hasGroundReturn && !net1.hasGroundReturn && !net1Strong1) {
      net1.hasGroundReturn = true;
      changed = true;
    }
    const vSink2 = minSinkV.get(net2.id);
    if (vSink2 !== undefined && strongDriversMap.get(net1.id)!.size === 0) {
      const prev1 = minSinkV.get(net1.id) ?? Infinity;
      if (vSink2 < prev1 - 1e-4) {
        minSinkV.set(net1.id, vSink2);
        changed = true;
      }
    }

    if (allowBidirectional) {
      // Forward: net2 -> net1
      if (net2.hasHighPath && !net1.hasHighPath && !net1Strong0) {
        net1.hasHighPath = true;
        changed = true;
      }
      const vHigh2 = maxHighV.get(net2.id);
      if (vHigh2 !== undefined && !net1Strong0 && strongDriversMap.get(net1.id)!.size === 0) {
        const prev1 = maxHighV.get(net1.id) ?? -Infinity;
        if (vHigh2 > prev1 + 1e-4) {
          maxHighV.set(net1.id, vHigh2);
          changed = true;
        }
      }

      // Backward: net1 -> net2
      if (net1.hasGroundReturn && !net2.hasGroundReturn && !net2Strong1) {
        net2.hasGroundReturn = true;
        changed = true;
      }
      const vSink1 = minSinkV.get(net1.id);
      if (vSink1 !== undefined && strongDriversMap.get(net2.id)!.size === 0) {
        const prev2 = minSinkV.get(net2.id) ?? Infinity;
        if (vSink1 < prev2 - 1e-4) {
          minSinkV.set(net2.id, vSink1);
          changed = true;
        }
      }
    }

    return changed;
  };

  // Evaluates whether a polarized load (Anode netA -> Cathode netC) has a valid forward conduction path
  const isPolarizedLoadActive = (
    netA: ElectricalNet | undefined,
    netC: ElectricalNet | undefined
  ): boolean => {
    if (!netA || !netC || netA === netC) return false;
    if (netA.contention || netC.contention) return false;

    // 1. Standard HIGH (1) source to LOW (0) ground/gate/MCU sink
    if (netA.hasHighPath && netC.hasGroundReturn) {
      return true;
    }

    // 2. Higher-voltage source (e.g. >= 7V / 9V Battery+) sinking into a lower-voltage (<= 5V) Gate/MCU output
    const vAnode = maxHighV.get(netA.id);
    const vCathode = minSinkV.get(netC.id);
    if (
      vAnode !== undefined &&
      vCathode !== undefined &&
      vAnode >= 7.0 &&
      vCathode <= 5.0 &&
      vAnode - vCathode >= 2.0
    ) {
      return true;
    }

    return false;
  };

  const maxReachSteps = components.length + 5;
  for (let rStep = 0; rStep < maxReachSteps; rStep++) {
    let reachChanged = false;

    for (const comp of components) {
      switch (comp.type) {
        case 'resistor':
        case 'inductor': {
          const net1 = getNetForPin(comp.id, 'p1', 'pin1', 't1');
          const net2 = getNetForPin(comp.id, 'p2', 'pin2', 't2');
          if (propagatePotentialPair(net1, net2, true)) reachChanged = true;
          break;
        }

        case 'light-sensor': {
          const lux = comp.properties?.lux ?? 500;
          if (lux >= 500) {
            const net1 = getNetForPin(comp.id, 'p1', 'pin1');
            const net2 = getNetForPin(comp.id, 'p2', 'pin2');
            if (propagatePotentialPair(net1, net2, true)) reachChanged = true;
          }
          break;
        }

        case 'potentiometer': {
          const netT1 = getNetForPin(comp.id, 't1');
          const netT2 = getNetForPin(comp.id, 't2');
          const netW = getNetForPin(comp.id, 'wiper');
          if (propagatePotentialPair(netT1, netW, true)) reachChanged = true;
          if (propagatePotentialPair(netT2, netW, true)) reachChanged = true;
          break;
        }

        // Polarized Forward-Conducting Loads (Anode/Pos -> Cathode/Neg ONLY)
        case 'led':
        case 'builtin_led':
        case 'led-red':
        case 'led-green':
        case 'led-blue':
        case 'led-yellow':
        case 'diode':
        case 'diode-1n4148':
        case 'diode-1n4007':
        case 'zener-diode':
        case 'buzzer':
        case 'dc-fan':
        case 'builtin_oled_display':
        case 'oled-display':
        case 'builtin_lcd_16x2':
        case 'lcd-16x2':
        case 'builtin_sd_card':
        case 'sd-card':
        case 'builtin_servo_motor':
        case 'servo-motor': {
          const netA = getNetForPin(comp.id, 'anode', 'pos', 'vcc', '+', 'p1');
          const netC = getNetForPin(comp.id, 'cathode', 'neg', 'gnd', '-', 'p2');
          if (propagatePotentialPair(netA, netC, false)) reachChanged = true;
          break;
        }

        case 'builtin_dc_motor':
        case 'dc-motor': {
          const netPlus = getNetForPin(comp.id, 'm_plus', 'pos', '+');
          const netMinus = getNetForPin(comp.id, 'm_minus', 'neg', '-');
          if (propagatePotentialPair(netPlus, netMinus, true)) reachChanged = true;
          break;
        }

        case 'builtin_fuse': {
          const isBlown = comp.properties?.isBlown === true || comp.state?.isBlown === true;
          if (!isBlown) {
            const net1 = getNetForPin(comp.id, 'p1');
            const net2 = getNetForPin(comp.id, 'p2');
            if (propagatePotentialPair(net1, net2, true)) reachChanged = true;
          }
          break;
        }

        case 'builtin_dip_switch_4': {
          for (let i = 1; i <= 4; i++) {
            const isClosed = comp.properties?.[`sw${i}`] === true;
            if (isClosed) {
              const netIn = getNetForPin(comp.id, `in${i}`);
              const netOut = getNetForPin(comp.id, `out${i}`);
              if (propagatePotentialPair(netIn, netOut, true)) reachChanged = true;
            }
          }
          break;
        }

        case 'transistor-npn':
        case 'builtin_npn': {
          const b = getInputNetLevel(comp.id, 'base', 'b');
          if (b === 1) {
            const netC = getNetForPin(comp.id, 'collector', 'c');
            const netE = getNetForPin(comp.id, 'emitter', 'e');
            if (propagatePotentialPair(netC, netE, false)) reachChanged = true;
          }
          break;
        }

        case 'mosfet-n':
        case 'builtin_nmos': {
          const g = getInputNetLevel(comp.id, 'gate', 'g');
          if (g === 1) {
            const netD = getNetForPin(comp.id, 'drain', 'd');
            const netS = getNetForPin(comp.id, 'source', 's');
            if (propagatePotentialPair(netD, netS, false)) reachChanged = true;
          }
          break;
        }

        case 'builtin_pnp':
        case 'transistor-pnp': {
          const b = getInputNetLevel(comp.id, 'base', 'b');
          if (b === 0) {
            const netE = getNetForPin(comp.id, 'emitter', 'e');
            const netC = getNetForPin(comp.id, 'collector', 'c');
            if (propagatePotentialPair(netE, netC, false)) reachChanged = true;
          }
          break;
        }

        case 'builtin_pmos':
        case 'mosfet-p': {
          const g = getInputNetLevel(comp.id, 'gate', 'g');
          if (g === 0) {
            const netS = getNetForPin(comp.id, 'source', 's');
            const netD = getNetForPin(comp.id, 'drain', 'd');
            if (propagatePotentialPair(netS, netD, false)) reachChanged = true;
          }
          break;
        }

        case 'builtin_optocoupler': {
          const netA = getNetForPin(comp.id, 'anode');
          const netK = getNetForPin(comp.id, 'cathode');
          if (isPolarizedLoadActive(netA, netK) || (getInputNetLevel(comp.id, 'anode') === 1 && getInputNetLevel(comp.id, 'cathode') === 0)) {
            const netC = getNetForPin(comp.id, 'collector');
            const netE = getNetForPin(comp.id, 'emitter');
            if (propagatePotentialPair(netC, netE, false)) reachChanged = true;
          }
          break;
        }

        case 'builtin_led_bar_graph': {
          const netGnd = getNetForPin(comp.id, 'gnd');
          for (let i = 1; i <= 10; i++) {
            const netB = getNetForPin(comp.id, `b${i}`);
            if (propagatePotentialPair(netB, netGnd, false)) reachChanged = true;
          }
          break;
        }

        case 'builtin_stepper_motor': {
          const netAp = getNetForPin(comp.id, 'a_plus');
          const netAm = getNetForPin(comp.id, 'a_minus');
          if (propagatePotentialPair(netAp, netAm, true)) reachChanged = true;
          const netBp = getNetForPin(comp.id, 'b_plus');
          const netBm = getNetForPin(comp.id, 'b_minus');
          if (propagatePotentialPair(netBp, netBm, true)) reachChanged = true;
          break;
        }

        case 'builtin_traffic_light': {
          const netGnd = getNetForPin(comp.id, 'gnd');
          for (const p of ['r', 'y', 'g']) {
            const netP = getNetForPin(comp.id, p);
            if (propagatePotentialPair(netP, netGnd, false)) reachChanged = true;
          }
          break;
        }

        case 'builtin_water_pump': {
          const netPlus = getNetForPin(comp.id, 'p_plus');
          const netMinus = getNetForPin(comp.id, 'p_minus');
          if (propagatePotentialPair(netPlus, netMinus, false)) reachChanged = true;
          break;
        }

        case 'builtin_filament_bulb': {
          const net1 = getNetForPin(comp.id, 'p1');
          const net2 = getNetForPin(comp.id, 'p2');
          if (propagatePotentialPair(net1, net2, true)) reachChanged = true;
          break;
        }

        case 'builtin_ir_tx': {
          const netA = getNetForPin(comp.id, 'anode');
          const netC = getNetForPin(comp.id, 'cathode');
          if (propagatePotentialPair(netA, netC, false)) reachChanged = true;
          break;
        }

        case 'builtin_solenoid': {
          const netPlus = getNetForPin(comp.id, 's_plus');
          const netMinus = getNetForPin(comp.id, 's_minus');
          if (propagatePotentialPair(netPlus, netMinus, true)) reachChanged = true;
          break;
        }

        case 'builtin_speaker': {
          const netPlus = getNetForPin(comp.id, 'sp_plus');
          const netMinus = getNetForPin(comp.id, 'sp_minus');
          if (propagatePotentialPair(netPlus, netMinus, true)) reachChanged = true;
          break;
        }

        default:
          break;
      }
    }

    if (!reachChanged) break;
  }

  // Promote intermediate series-load nets (e.g. between LED1 cathode and LED2 anode)
  // that have both forward high reachability and backward ground/sink return so they resolve to 1
  for (const net of nets) {
    if (net.level === 'Z') {
      const vHi = maxHighV.get(net.id);
      const vLo = minSinkV.get(net.id);
      const hasDiffSink =
        vHi !== undefined && vLo !== undefined && vHi >= 7.0 && vLo <= 5.0 && vHi - vLo >= 2.0;
      if ((net.hasHighPath && net.hasGroundReturn) || hasDiffSink) {
        net.level = 1;
        for (const pin of net.pins) {
          pinStates.set(`${pin.compId}:${pin.pinId}`, 1);
          pinStates.set(`${pin.compId}:${pin.pinId.toLowerCase()}`, 1);
        }
      }
    }
  }

  // =========================================================================
  // 5. Compute Dynamic Visual Outputs for Components & Active HIGH (1) Flow Wires
  // =========================================================================
  for (const comp of components) {
    const cState: ComponentSimulationState = {};

    switch (comp.type) {
      case 'led':
      case 'builtin_led':
      case 'led-red':
      case 'led-green':
      case 'led-blue':
      case 'led-yellow': {
        const netA = getNetForPin(comp.id, 'anode', 'pos', '+', 'p1');
        const netC = getNetForPin(comp.id, 'cathode', 'neg', '-', 'p2');
        const isLit = isPolarizedLoadActive(netA, netC);
        cState.lit = isLit;
        cState.brightness = isLit ? 100 : 0;

        const hasSeriesRes = components.some(
          (other) =>
            other.type === 'resistor' &&
            (other.properties?.resistance ?? 1000) >= 100 &&
            (netA?.pins.some((p) => p.compId === other.id) ||
              netC?.pins.some((p) => p.compId === other.id))
        );
        cState.hasSeriesResistor = hasSeriesRes;
        break;
      }

      case 'led-rgb': {
        const netR = getNetForPin(comp.id, 'r');
        const netG = getNetForPin(comp.id, 'g');
        const netB = getNetForPin(comp.id, 'b');
        const netCat = getNetForPin(comp.id, 'cathode');
        const rLit = isPolarizedLoadActive(netR, netCat);
        const gLit = isPolarizedLoadActive(netG, netCat);
        const bLit = isPolarizedLoadActive(netB, netCat);
        const isLit = rLit || gLit || bLit;
        cState.lit = isLit;
        break;
      }

      case 'diode':
      case 'diode-1n4148':
      case 'diode-1n4007':
      case 'zener-diode': {
        break;
      }

      case 'dc-fan': {
        const netP = getNetForPin(comp.id, 'pos', 'vcc', '+');
        const netN = getNetForPin(comp.id, 'neg', 'gnd', '-');
        const isRunning = isPolarizedLoadActive(netP, netN);
        cState.isRunning = isRunning;
        cState.angularVelocity = isRunning ? 2200 : 0;
        break;
      }

      case 'builtin_dc_motor':
      case 'dc-motor': {
        const netPlus = getNetForPin(comp.id, 'm_plus', 'pos', '+');
        const netMinus = getNetForPin(comp.id, 'm_minus', 'neg', '-');
        const isCW = isPolarizedLoadActive(netPlus, netMinus);
        const isCCW = !isCW && isPolarizedLoadActive(netMinus, netPlus);
        if (isCW) {
          cState.isRunning = true;
          cState.direction = 'CW';
          cState.rpm = 3000;
          cState.angularVelocity = 3000;
        } else if (isCCW) {
          cState.isRunning = true;
          cState.direction = 'CCW';
          cState.rpm = 3000;
          cState.angularVelocity = -3000;
        } else {
          cState.isRunning = false;
          cState.direction = 'IDLE';
          cState.rpm = 0;
          cState.angularVelocity = 0;
        }
        break;
      }

      case 'builtin_servo_motor':
      case 'servo-motor': {
        const netVcc = getNetForPin(comp.id, 'vcc');
        const netGnd = getNetForPin(comp.id, 'gnd');
        const netSig = getNetForPin(comp.id, 'sig');
        const vccLevel = getPinLevel(comp.id, 'vcc');
        const gndLevel = getPinLevel(comp.id, 'gnd');
        const sigLevel = getPinLevel(comp.id, 'sig');

        const hasVcc = !netVcc || vccLevel === 1;
        const hasGnd = !netGnd || gndLevel === 0;
        const isPowered = hasVcc && hasGnd;

        const targetDeg = typeof comp.properties?.targetAngle === 'number' ? comp.properties.targetAngle : 90;
        let resolvedAngle = 0;

        if (isPowered && netSig) {
          let foundMcuAngle: number | undefined;
          for (const pinRef of netSig.pins) {
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
          if (foundMcuAngle !== undefined) {
            resolvedAngle = foundMcuAngle;
          } else if (sigLevel === 1) {
            resolvedAngle = targetDeg;
          } else {
            resolvedAngle = 0;
          }
        } else {
          resolvedAngle = 0;
        }

        cState.servoAngle = Math.max(0, Math.min(180, resolvedAngle));
        cState.isRunning = isPowered && resolvedAngle > 0;
        break;
      }

      case 'builtin_humidity_sensor':
      case 'humidity-sensor': {
        const humidity = comp.properties?.humidity ?? 45;
        cState.outputVoltage = 5.0 * (humidity / 100);
        cState.logicOutput = getPinLevel(comp.id, 'out');
        break;
      }

      case 'builtin_motion_sensor':
      case 'motion-sensor': {
        const motion =
          comp.properties?.motionDetected === true || comp.state?.motionDetected === true;
        cState.outputVoltage = motion ? 3.3 : 0.0;
        cState.logicOutput = getPinLevel(comp.id, 'out');
        cState.lit = motion;
        break;
      }

      case 'builtin_gas_sensor':
      case 'gas-sensor': {
        const ppm = comp.properties?.ppm ?? 50;
        cState.outputVoltage = 0.2 + 4.6 * Math.min(1, Math.max(0, ppm / 2000));
        cState.logicOutput = getPinLevel(comp.id, 'do');
        cState.lit = cState.logicOutput === 1;
        break;
      }

      case 'builtin_accelerometer':
      case 'accelerometer': {
        const ax = comp.properties?.accelX ?? 0.0;
        cState.outputVoltage = Math.max(0, Math.min(3.3, 1.65 + (ax / 3.0) * 1.65));
        cState.logicOutput = getPinLevel(comp.id, 'x');
        break;
      }

      case 'builtin_oled_display':
      case 'oled-display': {
        const netVcc = getNetForPin(comp.id, 'vcc');
        const netGnd = getNetForPin(comp.id, 'gnd');
        const isPowered =
          isPolarizedLoadActive(netVcc, netGnd) ||
          getPinLevel(comp.id, 'vcc') === 1 ||
          getPinLevel(comp.id, 'sda') === 1 ||
          getPinLevel(comp.id, 'sck') === 1;
        cState.lit = isPowered;
        cState.brightness = isPowered ? 100 : 0;
        break;
      }

      case 'builtin_lcd_16x2':
      case 'lcd-16x2': {
        const netVcc = getNetForPin(comp.id, 'vcc');
        const netGnd = getNetForPin(comp.id, 'gnd');
        const d4 = getPinLevel(comp.id, 'd4');
        const d5 = getPinLevel(comp.id, 'd5');
        const d6 = getPinLevel(comp.id, 'd6');
        const isPowered =
          isPolarizedLoadActive(netVcc, netGnd) ||
          getPinLevel(comp.id, 'vcc') === 1 ||
          getPinLevel(comp.id, 'sda') === 1 ||
          d4 === 1 ||
          d5 === 1 ||
          d6 === 1;
        cState.lit = isPowered;
        cState.brightness = isPowered ? 100 : 0;
        break;
      }

      case 'builtin_sd_card':
      case 'sd-card': {
        const netVcc = getNetForPin(comp.id, 'vcc');
        const netGnd = getNetForPin(comp.id, 'gnd');
        const isPowered =
          isPolarizedLoadActive(netVcc, netGnd) || getPinLevel(comp.id, 'vcc') === 1;
        const mosi = getPinLevel(comp.id, 'mosi');
        const sck = getPinLevel(comp.id, 'sck');
        const cs = getPinLevel(comp.id, 'cs');
        cState.lit = isPowered;
        cState.sdActivity = isPowered && (mosi === 1 || sck === 1 || cs === 0);
        break;
      }

      case 'builtin_dcdc_converter':
      case 'dcdc-converter': {
        const vinLevel = getPinLevel(comp.id, 'vin_plus');
        const targetV =
          typeof comp.properties?.targetVoltage === 'number' ? comp.properties.targetVoltage : 12.0;
        cState.lit = vinLevel === 1;
        cState.outputVoltage = vinLevel === 1 ? targetV : 0.0;
        cState.logicOutput = getPinLevel(comp.id, 'vout_plus');
        break;
      }

      case 'builtin_numpad':
      case 'numpad': {
        const activeKey = String(
          comp.properties?.activeKey ?? comp.state?.activeKey ?? ''
        ).trim();
        cState.logicOutput = activeKey.length > 0 ? 1 : 0;
        cState.outputVoltage = activeKey.length > 0 ? 5.0 : 0.0;
        break;
      }

      case 'builtin_comparator': {
        const outLvl = getPinLevel(comp.id, 'out');
        cState.logicOutput = outLvl;
        cState.outputVoltage = outLvl === 1 ? 5.0 : 0.0;
        break;
      }

      case 'builtin_shift_register': {
        const staged = nextCompStates.get(comp.id);
        cState.outputBits = staged?.outputBits ?? comp.state?.outputBits ?? comp.properties?.outputBits ?? 0;
        cState.shiftBits = staged?.shiftBits ?? comp.state?.shiftBits ?? comp.properties?.shiftBits ?? 0;
        break;
      }

      case 'builtin_bcd_decoder': {
        const jMatch = comp.id.match(/^dec_([nesw])_(tens|ones)$/i);
        const jKey = jMatch ? (jMatch[1].toLowerCase() as 'n' | 'e' | 's' | 'w') : null;
        const jEntry = jKey ? atomicJunctionCountdowns.get(jKey) : undefined;
        if (jMatch && jEntry) {
          cState.count = jMatch[2].toLowerCase() === 'tens' ? jEntry.tensValue : jEntry.onesValue;
        } else {
          const d0 = getPinLevel(comp.id, 'd0', 'a') === 1 ? 1 : 0;
          const d1 = getPinLevel(comp.id, 'd1', 'b') === 1 ? 2 : 0;
          const d2 = getPinLevel(comp.id, 'd2', 'c') === 1 ? 4 : 0;
          const d3 = getPinLevel(comp.id, 'd3', 'd') === 1 ? 8 : 0;
          cState.count = d0 + d1 + d2 + d3;
        }
        break;
      }

      case 'builtin_mux_4to1': {
        cState.logicOutput = getPinLevel(comp.id, 'y');
        break;
      }

      case 'builtin_d_flipflop':
      case 'builtin_jk_flipflop': {
        cState.q = getPinLevel(comp.id, 'q');
        cState.nq = getPinLevel(comp.id, 'nq');
        break;
      }

      case 'builtin_counter_4bit': {
        const staged = nextCompStates.get(comp.id);
        cState.count = staged?.count ?? comp.state?.count ?? comp.properties?.count ?? 0;
        break;
      }

      case 'builtin_dip_switch_4': {
        cState.sw1 = comp.properties?.sw1 === true;
        cState.sw2 = comp.properties?.sw2 === true;
        cState.sw3 = comp.properties?.sw3 === true;
        cState.sw4 = comp.properties?.sw4 === true;
        for (let i = 1; i <= 4; i++) {
          const isClosed = comp.properties?.[`sw${i}`] === true;
          const inLvl = getPinLevel(comp.id, `in${i}`, `sw${i}_a`);
          const outLvl = getPinLevel(comp.id, `out${i}`, `sw${i}_b`);
          if (isClosed) {
            if ((inLvl === 1 || inLvl === 0) && outLvl === 'Z') {
              pinStates.set(`${comp.id}:out${i}`, inLvl);
              pinStates.set(`${comp.id}:sw${i}_b`, inLvl);
            } else if ((outLvl === 1 || outLvl === 0) && inLvl === 'Z') {
              pinStates.set(`${comp.id}:in${i}`, outLvl);
              pinStates.set(`${comp.id}:sw${i}_a`, outLvl);
            }
          } else {
            if (outLvl === 'Z') pinStates.set(`${comp.id}:sw${i}_b`, 'Z');
            if (inLvl === 'Z') pinStates.set(`${comp.id}:sw${i}_a`, 'Z');
          }
        }
        break;
      }

      case 'builtin_fuse': {
        cState.isBlown = comp.properties?.isBlown === true || comp.state?.isBlown === true;
        if (!cState.isBlown) {
          const p1Lvl = getPinLevel(comp.id, 'p1');
          const p2Lvl = getPinLevel(comp.id, 'p2');
          if ((p1Lvl === 1 || p1Lvl === 0) && p2Lvl === 'Z') {
            pinStates.set(`${comp.id}:p2`, p1Lvl);
          } else if ((p2Lvl === 1 || p2Lvl === 0) && p1Lvl === 'Z') {
            pinStates.set(`${comp.id}:p1`, p2Lvl);
          }
        }
        break;
      }

      case 'builtin_hbridge': {
        const out1 = getPinLevel(comp.id, 'out1');
        const out2 = getPinLevel(comp.id, 'out2');
        cState.direction = out1 === 1 && out2 === 0 ? 'CW' : out1 === 0 && out2 === 1 ? 'CCW' : 'BRAKE';
        cState.motorDirection = cState.direction;
        cState.isRunning = out1 !== out2;
        break;
      }

      case 'transistor-npn':
      case 'builtin_npn':
      case 'mosfet-n':
      case 'builtin_nmos': {
        const isBjt = comp.type === 'transistor-npn' || comp.type === 'builtin_npn';
        const ctrl = getPinLevel(comp.id, isBjt ? 'base' : 'gate', isBjt ? 'b' : 'g');
        cState.isConducting = ctrl === 1;
        if (cState.isConducting) {
          if (isBjt) {
            const cLvl = getPinLevel(comp.id, 'collector', 'c');
            if (cLvl === 1 || cLvl === 0) {
              pinStates.set(`${comp.id}:emitter`, cLvl);
            }
          } else {
            const dLvl = getPinLevel(comp.id, 'drain', 'd');
            if (dLvl === 1 || dLvl === 0) {
              pinStates.set(`${comp.id}:source`, dLvl);
            }
          }
        }
        break;
      }

      case 'builtin_pnp':
      case 'transistor-pnp':
      case 'builtin_pmos':
      case 'mosfet-p': {
        const isBjt = comp.type === 'builtin_pnp' || comp.type === 'transistor-pnp';
        const ctrl = getPinLevel(comp.id, isBjt ? 'base' : 'gate', isBjt ? 'b' : 'g');
        cState.isConducting = ctrl === 0;
        if (cState.isConducting) {
          if (isBjt) {
            const eLvl = getPinLevel(comp.id, 'emitter', 'e');
            if (eLvl === 1 || eLvl === 0) {
              pinStates.set(`${comp.id}:collector`, eLvl);
            }
          } else {
            const sLvl = getPinLevel(comp.id, 'source', 's');
            if (sLvl === 1 || sLvl === 0) {
              pinStates.set(`${comp.id}:drain`, sLvl);
            }
          }
        }
        break;
      }

      case 'opamp':
      case 'builtin_opamp': {
        const outLvl = getPinLevel(comp.id, 'out', 'output');
        cState.outputVoltage = outLvl === 1 ? 5.0 : 0.0;
        cState.logicOutput = outLvl;
        break;
      }

      case 'builtin_bridge_rectifier': {
        cState.outputVoltage = getPinLevel(comp.id, 'dc_plus') === 1 ? 5.0 : 0.0;
        break;
      }

      case 'builtin_reg_7805':
      case 'voltage-regulator-7805':
      case 'lm7805': {
        const outLvl = getPinLevel(comp.id, 'out', 'vout');
        cState.lit = outLvl === 1;
        cState.outputVoltage = outLvl === 1 ? 5.0 : 0.0;
        break;
      }

      case 'builtin_optocoupler': {
        const a = getPinLevel(comp.id, 'anode');
        const k = getPinLevel(comp.id, 'cathode');
        cState.isCoupled = a === 1 && k === 0;
        if (cState.isCoupled) {
          const cLvl = getPinLevel(comp.id, 'collector');
          if (cLvl === 1 || cLvl === 0) {
            pinStates.set(`${comp.id}:emitter`, cLvl);
          }
        }
        break;
      }

      case 'builtin_solar_panel': {
        const lux = typeof comp.properties?.lux === 'number' ? comp.properties.lux : 100;
        const maxV = typeof comp.properties?.maxVoltage === 'number' ? comp.properties.maxVoltage : 6.0;
        cState.outputVoltage = Math.min(maxV, 0.5 + (lux / 1000) * (maxV - 0.5));
        cState.lux = lux;
        break;
      }

      case 'builtin_joystick': {
        cState.joyX = comp.properties?.joyX ?? 0;
        cState.joyY = comp.properties?.joyY ?? 0;
        cState.isPressed = comp.properties?.isPressed === true;
        break;
      }

      case 'builtin_led_bar_graph': {
        let count = 0;
        for (let i = 1; i <= 10; i++) {
          if (getPinLevel(comp.id, `b${i}`) === 1) count++;
        }
        cState.litCount = count;
        break;
      }

      case 'builtin_stepper_motor': {
        const staged = nextCompStates.get(comp.id);
        cState.angle = staged?.angle ?? comp.state?.angle ?? comp.properties?.angle ?? 0;
        cState.stepCount = staged?.stepCount ?? comp.state?.stepCount ?? 0;
        break;
      }

      case 'buzzer': {
        const netP = getNetForPin(comp.id, 'pos', '+', 'p1');
        const netN = getNetForPin(comp.id, 'neg', '-', 'p2');
        const isSounding = isPolarizedLoadActive(netP, netN);
        cState.isSounding = isSounding;
        break;
      }

      case 'display-7seg': {
        const com = getPinLevel(comp.id, 'com1', 'com');
        const isCC = com === 0;
        const isCA = com === 1;
        const activeTarget = isCC ? 1 : isCA ? 0 : null;

        if (activeTarget !== null) {
          cState.segments = {
            a: getPinLevel(comp.id, 'pin_a') === activeTarget,
            b: getPinLevel(comp.id, 'pin_b') === activeTarget,
            c: getPinLevel(comp.id, 'pin_c') === activeTarget,
            d: getPinLevel(comp.id, 'pin_d') === activeTarget,
            e: getPinLevel(comp.id, 'pin_e') === activeTarget,
            f: getPinLevel(comp.id, 'pin_f') === activeTarget,
            g: getPinLevel(comp.id, 'pin_g') === activeTarget,
            dp: getPinLevel(comp.id, 'pin_dp') === activeTarget,
          };
        } else {
          cState.segments = {
            a: false, b: false, c: false, d: false,
            e: false, f: false, g: false, dp: false,
          };
        }
        break;
      }

      case 'relay':
      case 'builtin_relay': {
        const vcc = getPinLevel(comp.id, 'vcc');
        const gnd = getPinLevel(comp.id, 'gnd');
        const inSig = getPinLevel(comp.id, 'in');
        const triggerActive = comp.properties?.triggerActive ?? 'LOW';
        const expectedSig = triggerActive === 'LOW' ? 0 : 1;

        const isEngaged = vcc === 1 && gnd === 0 && inSig === expectedSig;
        cState.isEngaged = isEngaged;
        break;
      }

      case 'temp-sensor': {
        const temp = comp.properties?.temperatureC ?? 25;
        cState.outputVoltage = Math.max(0, Math.min(5, (temp + 50) * 0.01 + 0.5));
        cState.logicOutput = gateOutputsMap.get(comp.id) ?? getPinLevel(comp.id, 'vout');
        break;
      }

      case 'light-sensor': {
        const lux = comp.properties?.lux ?? 500;
        cState.outputVoltage = Math.max(100, Math.round(500000 / Math.pow(Math.max(1, lux), 0.7)));
        break;
      }

      case 'gate-and':
      case 'gate-or':
      case 'gate-not':
      case 'gate-buffer':
      case 'buffer':
      case 'gate-nand':
      case 'gate-nor':
      case 'gate-xor':
      case 'gate-xnor': {
        const outLevel = gateOutputsMap.get(comp.id) ?? 'Z';
        cState.logicOutput = outLevel;
        cState.outputVoltage = outLevel === 1 ? 5.0 : 0.0;
        pinStates.set(`${comp.id}:out`, outLevel);
        break;
      }

      // =====================================================================
      // PHASE 7.9 EXPANSION: COMPONENT VISUAL STATES
      // =====================================================================
      case 'builtin_soil_moisture': {
        const outLvl = getPinLevel(comp.id, 'out');
        cState.logicOutput = outLvl;
        cState.outputVoltage = outLvl === 1 ? 5.0 : 0.0;
        cState.lit = outLvl === 1;
        break;
      }

      case 'builtin_traffic_light': {
        const netGnd = getNetForPin(comp.id, 'gnd');
        const gndLvl = getPinLevel(comp.id, 'gnd');
        const hasGnd = Boolean(netGnd && (netGnd.hasGroundReturn || gndLvl === 0));
        const rLit =
          isPolarizedLoadActive(getNetForPin(comp.id, 'r'), netGnd) ||
          (hasGnd && getPinLevel(comp.id, 'r') === 1);
        const yLit =
          isPolarizedLoadActive(getNetForPin(comp.id, 'y'), netGnd) ||
          (hasGnd && getPinLevel(comp.id, 'y') === 1);
        const gLit =
          isPolarizedLoadActive(getNetForPin(comp.id, 'g'), netGnd) ||
          (hasGnd && getPinLevel(comp.id, 'g') === 1);
        cState.redLit = rLit;
        cState.yellowLit = yLit;
        cState.greenLit = gLit;
        cState.lit = rLit || yLit || gLit;
        cState.brightness = cState.lit ? 100 : 0;
        break;
      }

      case 'builtin_water_pump': {
        const netPlus = getNetForPin(comp.id, 'p_plus');
        const netMinus = getNetForPin(comp.id, 'p_minus');
        const isPumping =
          isPolarizedLoadActive(netPlus, netMinus) ||
          (getPinLevel(comp.id, 'p_plus') === 1 && getPinLevel(comp.id, 'p_minus') !== 1);
        cState.isRunning = isPumping;
        cState.flowRateLpm = isPumping ? 2.4 : 0;
        cState.rpm = isPumping ? 2400 : 0;
        break;
      }

      case 'builtin_filament_bulb': {
        const net1 = getNetForPin(comp.id, 'p1');
        const net2 = getNetForPin(comp.id, 'p2');
        const p1 = getPinLevel(comp.id, 'p1');
        const p2 = getPinLevel(comp.id, 'p2');
        const isLit =
          isPolarizedLoadActive(net1, net2) ||
          isPolarizedLoadActive(net2, net1) ||
          (p1 === 1 && p2 === 0) ||
          (p2 === 1 && p1 === 0);
        cState.lit = isLit;
        cState.brightness = isLit ? 100 : 0;
        break;
      }

      case 'builtin_rf_radio': {
        const vccNet = getNetForPin(comp.id, 'vcc');
        const vcc = getPinLevel(comp.id, 'vcc');
        const gnd = getPinLevel(comp.id, 'gnd');
        const isPowered = (!vccNet || vcc === 1) && gnd !== 1;
        const txLvl = getPinLevel(comp.id, 'tx');
        const rxLvl = getPinLevel(comp.id, 'rx');
        cState.isTransmitting = isPowered && txLvl === 1;
        cState.isReceiving = isPowered && rxLvl === 1;
        cState.logicOutput = rxLvl;
        cState.outputVoltage = rxLvl === 1 ? 5.0 : 0.0;
        cState.lit = Boolean(cState.isTransmitting || cState.isReceiving);
        break;
      }

      case 'builtin_ir_tx': {
        const netA = getNetForPin(comp.id, 'anode');
        const netC = getNetForPin(comp.id, 'cathode');
        const isEmitting =
          isPolarizedLoadActive(netA, netC) ||
          (getPinLevel(comp.id, 'anode') === 1 && getPinLevel(comp.id, 'cathode') === 0);
        cState.isEmitting = isEmitting;
        cState.lit = isEmitting;
        cState.brightness = isEmitting ? 100 : 0;
        break;
      }

      case 'builtin_ir_rx': {
        const outLvl = getPinLevel(comp.id, 'out');
        cState.isReceivingIr = outLvl === 1;
        cState.logicOutput = outLvl;
        cState.outputVoltage = outLvl === 1 ? 5.0 : 0.0;
        cState.lit = outLvl === 1;
        break;
      }

      case 'builtin_hall_sensor': {
        const outLvl = getPinLevel(comp.id, 'out');
        cState.logicOutput = outLvl;
        cState.outputVoltage = outLvl === 1 ? 5.0 : 0.0;
        cState.lit = outLvl === 1;
        break;
      }

      case 'builtin_vibration_sensor': {
        const outLvl = getPinLevel(comp.id, 'out');
        cState.logicOutput = outLvl;
        cState.outputVoltage = outLvl === 1 ? 5.0 : 0.0;
        cState.lit = outLvl === 1;
        break;
      }

      case 'builtin_solenoid': {
        const netPlus = getNetForPin(comp.id, 's_plus');
        const netMinus = getNetForPin(comp.id, 's_minus');
        const sPlus = getPinLevel(comp.id, 's_plus');
        const sMinus = getPinLevel(comp.id, 's_minus');
        const isEngaged =
          isPolarizedLoadActive(netPlus, netMinus) ||
          isPolarizedLoadActive(netMinus, netPlus) ||
          (sPlus === 1 && sMinus === 0) ||
          (sMinus === 1 && sPlus === 0);
        cState.isEngaged = isEngaged;
        break;
      }

      case 'builtin_speaker': {
        const netPlus = getNetForPin(comp.id, 'sp_plus');
        const netMinus = getNetForPin(comp.id, 'sp_minus');
        const spPlus = getPinLevel(comp.id, 'sp_plus');
        const spMinus = getPinLevel(comp.id, 'sp_minus');
        const isSounding =
          isPolarizedLoadActive(netPlus, netMinus) ||
          isPolarizedLoadActive(netMinus, netPlus) ||
          (spPlus === 1 && spMinus === 0) ||
          (spMinus === 1 && spPlus === 0);
        cState.isSounding = isSounding;
        cState.voltageDropV = isSounding ? 5.0 : 0.0;
        break;
      }

      default:
        break;
    }

    const pinSignals: Record<string, LogicLevel> = {};
    for (const [key, lvl] of pinStates.entries()) {
      if (key.startsWith(`${comp.id}:`)) {
        const pinId = key.substring(comp.id.length + 1);
        pinSignals[pinId] = lvl;
      }
    }
    for (const [key, net] of pinToNetMap.entries()) {
      if (key.startsWith(`${comp.id}:`)) {
        const pinId = key.substring(comp.id.length + 1);
        pinSignals[pinId] = net.level;
      }
    }
    if (cState.logicOutput !== undefined) {
      pinSignals['out'] = cState.logicOutput;
    }
    cState.pinSignals = pinSignals;

    componentStates.set(comp.id, cState);
  }

  // Strict HIGH (1) Rule for LOGICAL Mode Wire Flow:
  // ONLY nets & wires whose resolved digital logic level is 1 (HIGH) show Blue Flow!
  // Any wire with logicLevel === 0 (LOW) or 'Z' (Floating) is strictly static.
  const activeFlowNets = new Set<string>();
  for (const net of nets) {
    if (net.level === 1 && !net.contention) {
      activeFlowNets.add(net.id);
    }
  }

  const wireStates = new Map<string, LogicLevel>();
  const activeFlowWires = new Set<string>();

  for (const wire of wires) {
    const net = wireToNetMap.get(wire.id);
    const level: LogicLevel = net ? net.level : 'Z';
    wireStates.set(wire.id, level);

    if (level === 1 && net && !net.contention) {
      activeFlowWires.add(wire.id);
    }
  }

  // Ensure all registered pins of placed components have an explicit state ('Z' if unconnected)
  for (const comp of components) {
    const def = ComponentRegistry.get(comp.type);
    if (def?.pins) {
      for (const p of def.pins) {
        const k = `${comp.id}:${p.id}`;
        const kLower = `${comp.id}:${p.id.toLowerCase()}`;
        if (!pinStates.has(k)) {
          pinStates.set(k, 'Z');
        }
        if (!pinStates.has(kLower)) {
          pinStates.set(kLower, 'Z');
        }
      }
    }
  }

  const netStates = new Map<string, LogicLevel>();
  for (const net of nets) {
    net.isActiveFlow = activeFlowNets.has(net.id);
    netStates.set(net.id, net.level);
  }

  return {
    netStates,
    wireStates,
    pinStates,
    componentStates,
    contentionErrors,
    activeFlowWires,
  };
}
