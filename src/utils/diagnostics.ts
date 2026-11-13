import { COMPONENT_DEFINITIONS } from '../constants/componentLibrary';
import { CircuitComponent, CircuitWire, DiagnosticTip, SimulationMode } from '../types/circuit';

const chargedCapacitorTracker = new Set<string>();

export function resetDiagnosticsState(): void {
  chargedCapacitorTracker.clear();
}

export function runCircuitDiagnostics(
  components: CircuitComponent[],
  wires: CircuitWire[],
  simulationMode: SimulationMode = 'ANALOG',
  isSimRunning: boolean = true
): DiagnosticTip[] {
  const tips: DiagnosticTip[] = [];

  if (components.length === 0) {
    tips.push({
      id: 'empty-canvas',
      type: 'info',
      severity: 'tip',
      title: 'Empty Workspace',
      message: 'Drag and drop components from the library on the left to start designing your circuit.',
    });
    return tips;
  }

  // 1. Check for Active Overloads / Fire from SPICE Physics
  for (const comp of components) {
    if (comp.state?.isBurned || comp.state?.isOverloaded) {
      if (comp.type.startsWith('led-')) {
        const curr = comp.state.branchCurrentA ? Math.round(comp.state.branchCurrentA * 1000) : 180;
        tips.push({
          id: `overload-led-${comp.id}`,
          type: 'error',
          severity: 'critical',
          componentId: comp.id,
          title: '🔥 LED Caught Fire (Overcurrent)',
          message: `${comp.label} is receiving ${curr}mA (Max: 30mA) and caught fire! Add a 220Ω–1kΩ current-limiting resistor in series with the LED.`,
          actionLabel: 'Inspect LED',
        });
      } else if (comp.type === 'resistor') {
        const p = comp.state.powerW ? comp.state.powerW.toFixed(2) : '0.81';
        tips.push({
          id: `overload-resistor-${comp.id}`,
          type: 'warning',
          severity: 'warning',
          componentId: comp.id,
          title: '⚠️ Resistor Power Rating Overload',
          message: `${comp.label} is dissipating ${p}W, exceeding its rated limit. Increase resistance or use a higher wattage resistor.`,
          actionLabel: 'Inspect Resistor',
        });
      } else if (comp.type === 'capacitor-electrolytic') {
        tips.push({
          id: `overload-cap-${comp.id}`,
          type: 'error',
          severity: 'critical',
          componentId: comp.id,
          title: '🔥 Capacitor Exploded (Reversed Polarity / Overvoltage)',
          message: `${comp.label}: ${comp.state.overloadReason || 'Exploded due to reverse polarity or exceeding its voltage rating. Verify connections.'}`,
          actionLabel: 'Inspect Capacitor',
        });
      } else if (comp.type === 'dc-fan') {
        tips.push({
          id: `overload-fan-${comp.id}`,
          type: 'error',
          severity: 'critical',
          componentId: comp.id,
          title: '🔥 DC Fan Motor Coil Burnout',
          message: `${comp.label}: ${comp.state.overloadReason || 'Overvoltage exceeded 14V rating! Motor coil overheated and burned out.'}`,
          actionLabel: 'Inspect Fan',
        });
      } else if (comp.type === 'buzzer') {
        tips.push({
          id: `overload-buzzer-${comp.id}`,
          type: 'error',
          severity: 'critical',
          componentId: comp.id,
          title: '🔥 Piezo Buzzer Transducer Burnout',
          message: `${comp.label}: ${comp.state.overloadReason || 'Applied voltage exceeded 15V maximum rating! Transducer cracked and burned out.'}`,
          actionLabel: 'Inspect Buzzer',
        });
      } else if (comp.type === 'dc-source' || comp.type === 'battery-9v' || comp.type === 'coin-cell') {
        tips.push({
          id: `overload-src-${comp.id}`,
          type: 'error',
          severity: 'critical',
          componentId: comp.id,
          title: '🔥 Battery Short Circuit (Thermal Runaway)',
          message: `${comp.label}: ${comp.state.overloadReason || 'Direct short-circuit detected! Extreme discharge current is causing battery fire and thermal runaway.'}`,
          actionLabel: 'Inspect Power Source',
        });
      } else if (comp.type === 'diode' || comp.type === 'diode-1n4148' || comp.type === 'diode-1n4007' || comp.type === 'zener-diode') {
        tips.push({
          id: `overload-diode-${comp.id}`,
          type: 'error',
          severity: 'critical',
          componentId: comp.id,
          title: '🔥 Diode Thermal Burnout',
          message: `${comp.label}: ${comp.state.overloadReason || 'Forward current exceeded maximum 1.0A rating! PN junction destroyed.'}`,
          actionLabel: 'Inspect Diode',
        });
      } else {
        tips.push({
          id: `overload-comp-${comp.id}`,
          type: 'error',
          severity: 'critical',
          componentId: comp.id,
          title: '🔥 Component Overload Detected',
          message: `${comp.label}: ${comp.state.overloadReason || 'Exceeded safe maximum electrical ratings.'}`,
          actionLabel: 'Inspect Component',
        });
      }
    }
  }

  // 2. Direct Power-to-Ground Short Circuit Check
  for (const wire of wires) {
    const comp1 = components.find((c) => c.id === wire.fromCompId);
    const comp2 = components.find((c) => c.id === wire.toCompId);
    if (!comp1 || !comp2) continue;

    const def1 = COMPONENT_DEFINITIONS[comp1.type];
    const def2 = COMPONENT_DEFINITIONS[comp2.type];
    if (!def1 || !def2) continue;

    const pin1 = def1.pins.find((p) => p.id === wire.fromPinId);
    const pin2 = def2.pins.find((p) => p.id === wire.toPinId);

    if (
      pin1 &&
      pin2 &&
      ((pin1.type === 'power' && pin2.type === 'ground') ||
        (pin1.type === 'ground' && pin2.type === 'power'))
    ) {
      tips.push({
        id: `short-circuit-${wire.id}`,
        type: 'error',
        severity: 'critical',
        componentId: comp1.id,
        title: '🔥 Direct Power-to-Ground Short Circuit',
        message: `Short circuit detected between ${comp1.label} (${pin1.name}) and ${comp2.label} (${pin2.name})! Current is extremely high.`,
        actionLabel: 'Inspect Short',
      });
    }
  }

  // 3. LED Without Resistor (Pre-simulation static analysis)
  const leds = components.filter((c) => c.type.startsWith('led-'));
  const hasResistor = components.some((c) => c.type === 'resistor');
  for (const led of leds) {
    // If not already flagged by live SPICE overload
    if (!tips.some((t) => t.componentId === led.id)) {
      const hasAnodeWire = wires.some(
        (w) =>
          (w.fromCompId === led.id && (w.fromPinId === 'anode' || w.fromPinId === 'p1' || w.fromPinId === 'pos')) ||
          (w.toCompId === led.id && (w.toPinId === 'anode' || w.toPinId === 'p1' || w.toPinId === 'pos'))
      );
      const hasCathodeWire = wires.some(
        (w) =>
          (w.fromCompId === led.id && (w.fromPinId === 'cathode' || w.fromPinId === 'p2' || w.fromPinId === 'neg')) ||
          (w.toCompId === led.id && (w.toPinId === 'cathode' || w.toPinId === 'p2' || w.toPinId === 'neg'))
      );
      const isFullyConnected = hasAnodeWire && hasCathodeWire;
      const isProtected = (led.state as any)?.hasSeriesResistor === true || hasResistor;

      if (!isProtected && isFullyConnected && components.length >= 2) {
        tips.push({
          id: `no-resistor-led-${led.id}`,
          type: 'warning',
          severity: 'warning',
          componentId: led.id,
          title: '⚠️ LED Without Current-Limiting Resistor',
          message: `${led.label} has no current-limiting resistor in the circuit. Direct connection to power may burn out the LED.`,
          actionLabel: 'Locate LED',
        });
      }
    }
  }

  // 4. Reversed Polarity Check
  for (const comp of components) {
    if (comp.type.startsWith('led-') && comp.state?.voltageDropV && comp.state.voltageDropV < -0.5) {
      if (!tips.some((t) => t.componentId === comp.id)) {
        tips.push({
          id: `rev-polarity-${comp.id}`,
          type: 'warning',
          severity: 'warning',
          componentId: comp.id,
          title: '⚠️ Reversed Component Polarity',
          message: `${comp.label} is connected in reverse polarity. Swap the Anode (+) and Cathode (-) connections.`,
          actionLabel: 'Locate Component',
        });
      }
    }
  }

  // 5. Check for Ground (GND) Reference
  const hasGnd = components.some(
    (c) =>
      c.type === 'gnd' ||
      c.type === 'builtin_gnd' ||
      c.type === 'builtin_ground' ||
      c.type === 'dc-source' ||
      c.type === 'battery-9v' ||
      c.type === 'coin-cell' ||
      c.type === 'ac-source'
  );
  if (!hasGnd) {
    tips.push({
      id: 'no-gnd',
      type: 'info',
      severity: 'tip',
      title: '💡 Missing Ground Reference (GND)',
      message: 'SPICE simulation requires at least one Ground (GND) component to serve as the 0V reference node.',
      actionLabel: 'Add Ground',
    });
  }

  // 6. Check for Unconnected / Floating Pins
  const pinConnectionMap = new Map<string, number>();
  for (const wire of wires) {
    const k1 = `${wire.fromCompId}:${wire.fromPinId}`;
    const k2 = `${wire.toCompId}:${wire.toPinId}`;
    pinConnectionMap.set(k1, (pinConnectionMap.get(k1) || 0) + 1);
    pinConnectionMap.set(k2, (pinConnectionMap.get(k2) || 0) + 1);
  }

  const unconnectedComps: { id: string; label: string; pinCount: number }[] = [];
  for (const comp of components) {
    const def = COMPONENT_DEFINITIONS[comp.type];
    if (!def || comp.type === 'textbox') continue;

    const isMcu = def.category === 'mcu';
    let connectedPinCount = 0;

    for (const pin of def.pins) {
      const key = `${comp.id}:${pin.id}`;
      if ((pinConnectionMap.get(key) || 0) > 0) {
        connectedPinCount++;
      }
    }

    if (isMcu && connectedPinCount === 0) {
      unconnectedComps.push({ id: comp.id, label: comp.label, pinCount: def.pins.length });
    } else if (!isMcu && connectedPinCount < def.pins.length) {
      unconnectedComps.push({ id: comp.id, label: comp.label, pinCount: def.pins.length - connectedPinCount });
    }
  }

  if (unconnectedComps.length > 0) {
    const first = unconnectedComps[0];
    tips.push({
      id: 'unconnected-pins',
      type: 'info',
      severity: 'tip',
      componentId: first.id,
      title: '💡 Unconnected / Floating Pins Detected',
      message: `Component ${first.label} has ${first.pinCount} unconnected pin${first.pinCount > 1 ? 's' : ''} required for full operation.`,
      actionLabel: `Locate ${first.label}`,
    });
  }

  // 7. Check for Stored Capacitor Charge (Phase 7.18)
  // In ANALOG mode, detect capacitors holding stored electrostatic energy (|Vc| >= 0.10V)
  // Automatically clears when discharged below 0.05V or when simulation stops/resets.
  if (isSimRunning && simulationMode === 'ANALOG') {
    for (const comp of components) {
      if (comp.type === 'capacitor-electrolytic' || comp.type === 'capacitor-ceramic') {
        if (comp.state?.isBurned || comp.state?.isOverloaded) {
          chargedCapacitorTracker.delete(comp.id);
          continue;
        }

        const vDrop = comp.state?.voltageDropV !== undefined
          ? comp.state.voltageDropV
          : comp.state?.pinVoltages
          ? ((comp.state.pinVoltages['pos'] ?? comp.state.pinVoltages['p1'] ?? 0) -
             (comp.state.pinVoltages['neg'] ?? comp.state.pinVoltages['p2'] ?? 0))
          : 0;

        const absVc = Math.abs(vDrop);
        const isTracking = chargedCapacitorTracker.has(comp.id);
        const threshold = isTracking ? 0.05 : 0.10;

        if (absVc >= threshold) {
          chargedCapacitorTracker.add(comp.id);
          tips.push({
            id: `stored-charge-${comp.id}`,
            type: 'info',
            severity: 'tip',
            componentId: comp.id,
            title: `⚡ Stored Capacitor Charge (${comp.label})`,
            message: `Capacitor ${comp.label} is holding a stored electrical charge of ${absVc.toFixed(2)} V. In a circuit without a low-resistance discharge path (or below an LED's forward voltage threshold), a capacitor retains its trapped electrostatic energy until discharged.`,
            actionLabel: 'Inspect Capacitor',
          });
        } else {
          chargedCapacitorTracker.delete(comp.id);
        }
      }
    }
  } else {
    chargedCapacitorTracker.clear();
  }

  if (tips.length === 0) {
    tips.push({
      id: 'all-clear',
      type: 'success',
      severity: 'tip',
      title: 'Circuit Healthy',
      message: 'All SPICE electrical checks and topology constraints passed cleanly.',
    });
  }

  return tips;
}
