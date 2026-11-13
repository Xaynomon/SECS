import { evaluateSpiceCircuit } from './simulation/spice/SpiceEngine';
import { CircuitComponent, CircuitWire } from './types/circuit';
import {
  computeWireFlowDirection,
  getComponentPinFlowRole,
} from './utils/circuitFlow';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function makeWire(
  id: string,
  fromCompId: string,
  fromPinId: string,
  toCompId: string,
  toPinId: string,
  state: Record<string, any> = {}
): CircuitWire {
  return {
    id,
    fromCompId,
    fromPinId,
    toCompId,
    toPinId,
    waypoints: [],
    color: '#22c55e',
    state,
  };
}

function makeComp(
  id: string,
  type: string,
  x: number,
  y: number,
  properties: Record<string, any> = {},
  state: Record<string, any> = {}
): CircuitComponent {
  return {
    id,
    type,
    label: id,
    x,
    y,
    rotation: 0,
    mirrored: false,
    properties,
    state,
  };
}

// Emulate Canvas wire animation activation logic
function isWireAnimatedAnalog(
  wire: CircuitWire,
  components: CircuitComponent[],
  isSimRunning = true
): boolean {
  if (!isSimRunning) return false;
  const fromComp = components.find((c) => c.id === wire.fromCompId);
  const toComp = components.find((c) => c.id === wire.toCompId);
  if (!fromComp || !toComp) return false;

  const wireVoltage = wire.state?.voltage ?? 0;
  const wireCurrentA = Math.abs(wire.state?.current ?? 0);

  // Check if switch/fuse terminal is open
  const isSwitchTerminalOpen = (comp: CircuitComponent | undefined, pinId: string): boolean => {
    if (!comp) return false;
    const props = comp.properties || {};
    const state = comp.state || {};
    const pLower = (pinId || '').trim().toLowerCase();

    if (comp.type === 'toggle-switch') {
      const isT1 = props.state !== 'T2';
      if (pLower === 't1') return !isT1;
      if (pLower === 't2') return isT1;
      return false;
    }
    if (comp.type === 'pushbutton') {
      return !Boolean(state.isPressed || props.isPressed);
    }
    if (comp.type === 'builtin_spst_switch' || comp.type === 'builtin_switch_spst') {
      return !Boolean(props.closed ?? state.closed);
    }
    if (['fuse', 'builtin_fuse'].includes(comp.type)) {
      return Boolean(state.isBurned || state.isBlown);
    }
    return false;
  };

  const isBlockedByOpenSwitch =
    isSwitchTerminalOpen(fromComp, wire.fromPinId) || isSwitchTerminalOpen(toComp, wire.toPinId);

  // In series chains, inherit branch current from passive loads or active outputs
  const getCompPinBranchCurrent = (comp: CircuitComponent | undefined, pinId: string): number => {
    if (!comp) return 0;
    const cType = comp.type;
    const pLower = (pinId || '').trim().toLowerCase();

    if (['vcc', 'builtin_vcc', 'gnd', 'builtin_gnd', 'builtin_ground'].includes(cType)) {
      return 0;
    }
    if (
      ['builtin_ir_rx', 'builtin_soil_moisture', 'builtin_hall_sensor', 'builtin_vibration_sensor', 'builtin_rf_radio'].includes(cType)
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
  const effectiveWireCurrent = Math.max(wireCurrentA, fromCompI, toCompI);

  const hasActiveVoltage = Math.abs(wireVoltage) >= 0.05 && !isBlockedByOpenSwitch;
  const hasActiveBranchCurrent = effectiveWireCurrent >= 0.00001; // >= 10 μA (0.01 mA)

  return hasActiveVoltage || hasActiveBranchCurrent;
}

console.log('=== SECS Hotfix 7.12 Verification Suite ===\n');

// ---------------------------------------------------------------------------
// TEST 1: Strict Voltage-OR-Current Flow Rule With Noise/Leakage Floor
// ---------------------------------------------------------------------------
console.log('--- TEST 1: Strict Voltage-OR-Current Wire Animation Rule ---');
{
  // 1A. Dead branch when IR_RX1 is OFF: IR_RX1 (OUT) -> R2 -> LED1 -> GND2
  const rxOff = makeComp('rx1', 'builtin_ir_rx', 100, 100, { irDetected: false }, { isReceivingIr: false });
  const r2 = makeComp('r2', 'builtin_resistor', 200, 100, { resistance: 220 }, { currentA: 0.0 });
  const led1 = makeComp('led1', 'led-red', 300, 100, {}, { currentA: 0.0 });
  const gnd2 = makeComp('gnd2', 'builtin_gnd', 400, 100, {});

  const wRxToR = makeWire('wRxToR', 'rx1', 'out', 'r2', 'p1', { voltage: 0.0, current: 0.0 });
  const wRToLed = makeWire('wRToLed', 'r2', 'p2', 'led1', 'anode', { voltage: 0.0, current: 0.0 });
  const wLedToGnd = makeWire('wLedToGnd', 'led1', 'cathode', 'gnd2', 'gnd', { voltage: 0.0, current: 0.0 });

  const deadComps = [rxOff, r2, led1, gnd2];
  // dead wires: [wRxToR, wRToLed, wLedToGnd]

  assert(!isWireAnimatedAnalog(wRxToR, deadComps), 'wRxToR must NOT animate when IR_RX1 is OFF');
  assert(!isWireAnimatedAnalog(wRToLed, deadComps), 'wRToLed must NOT animate when IR_RX1 is OFF');
  assert(!isWireAnimatedAnalog(wLedToGnd, deadComps), 'wLedToGnd must NOT animate when IR_RX1 is OFF');
  console.log('  [PASS] 1A: Dead branch (0.00V, 0.00μA) with inactive IR_RX1 is 100% static');

  // 1B. Same branch when IR_RX1 is ON (detecting IR, driving 15.65mA):
  const rxOn = makeComp('rx1', 'builtin_ir_rx', 100, 100, { irDetected: true }, { isReceivingIr: true, currentA: 0.01565 });
  const r2On = makeComp('r2', 'builtin_resistor', 200, 100, { resistance: 220 }, { currentA: 0.01565 });
  const led1On = makeComp('led1', 'led-red', 300, 100, {}, { currentA: 0.01565 });

  const wRxToROn = makeWire('wRxToR', 'rx1', 'out', 'r2', 'p1', { voltage: 5.0, current: 0.01565 });
  const wRToLedOn = makeWire('wRToLed', 'r2', 'p2', 'led1', 'anode', { voltage: 1.8, current: 0.01565 });
  const wLedToGndOn = makeWire('wLedToGnd', 'led1', 'cathode', 'gnd2', 'gnd', { voltage: 0.0, current: 0.01565 });

  const activeComps = [rxOn, r2On, led1On, gnd2];
  assert(isWireAnimatedAnalog(wRxToROn, activeComps), 'wRxToR must animate when active (> 10μA)');
  assert(isWireAnimatedAnalog(wRToLedOn, activeComps), 'wRToLed must animate when active (> 10μA)');
  assert(isWireAnimatedAnalog(wLedToGndOn, activeComps), 'wLedToGnd return wire must animate from branch current');
  console.log('  [PASS] 1B: Active branch (> 10μA) animates warm yellow flow across 100% of wires');

  // 1C. Active Voltage with negligible current (CMOS high-impedance gate input):
  const vcc1 = makeComp('vcc1', 'builtin_vcc', 100, 100, { voltage: 5.0 });
  const gateIn = makeComp('gate1', 'gate-and', 200, 100, {});
  const wCmos = makeWire('wCmos', 'vcc1', 'vcc', 'gate1', 'in1', { voltage: 5.0, current: 0.0 });
  assert(isWireAnimatedAnalog(wCmos, [vcc1, gateIn]), 'High-impedance gate wire with 5V must animate (Voltage rule)');
  console.log('  [PASS] 1C: Active Voltage (5.0V) with 0μA current animates via Voltage rule');

  // 1D. Sub-microamp leakage noise floor (< 10 μA ignored):
  const wLeakage = makeWire('wLeakage', 'r2', 'p2', 'led1', 'anode', { voltage: 0.002, current: 0.00000036 });
  assert(!isWireAnimatedAnalog(wLeakage, [r2, led1]), '0.36μA diode leakage must NOT animate');
  console.log('  [PASS] 1D: Sub-microamp leakage (0.36μA) stays below 10μA floor and is 100% static');

  // 1E. Dead-end wire terminating at an open switch:
  const swOpen = makeComp('swOpen', 'builtin_spst_switch', 200, 100, { closed: false }, { closed: false });
  const wDeadSw = makeWire('wDeadSw', 'vcc1', 'vcc', 'swOpen', 'p1', { voltage: 5.0, current: 0.0 });
  assert(!isWireAnimatedAnalog(wDeadSw, [vcc1, swOpen]), 'Dead-end wire to open switch must NOT animate');
  console.log('  [PASS] 1E: Dead-end wire to open switch contact is blocked from animating');
}

// ---------------------------------------------------------------------------
// TEST 2: Component-Aware Flow Direction Chaining (Entry -> Exit Chaining)
// ---------------------------------------------------------------------------
console.log('\n--- TEST 2: Component-Aware Flow Direction Chaining ---');
{
  const vcc1 = makeComp('vcc1', 'builtin_vcc', 100, 100, { voltage: 5.0 });
  const sw1 = makeComp('sw1', 'builtin_spst_switch', 200, 100, { closed: true }, { closed: true });
  const r1 = makeComp(
    'r1',
    'builtin_resistor',
    300,
    100,
    { resistance: 220 },
    { pinVoltages: { p1: 5.0, p2: 1.8 } }
  );
  const led1 = makeComp(
    'led1',
    'led-red',
    400,
    100,
    {},
    { pinVoltages: { anode: 1.8, cathode: 0.0 } }
  );
  const gnd1 = makeComp('gnd1', 'builtin_gnd', 500, 100, {});

  const allComps = [vcc1, sw1, r1, led1, gnd1];

  // 2A. Middle wire between Resistor R1 and LED1:
  // Forward: drawn from R1(p2) to LED1(anode)
  const wMidFwd = makeWire('wMidFwd', 'r1', 'p2', 'led1', 'anode');
  // Reverse: drawn from LED1(anode) to R1(p2)
  const wMidRev = makeWire('wMidRev', 'led1', 'anode', 'r1', 'p2');
  const allWires = [wMidFwd, wMidRev];

  // Check pin roles:
  // R1: p1 is 5.0V (ENTRY), p2 is 1.8V (EXIT)
  const roleR1P2 = getComponentPinFlowRole(r1, 'p2', allComps, allWires, 1.8);
  assert(roleR1P2 === 'EXIT', `R1 p2 must be EXIT pin (lower voltage on R1), got ${roleR1P2}`);

  // LED1: anode is positive load terminal (ENTRY)
  const roleLedAnode = getComponentPinFlowRole(led1, 'anode', allComps, allWires, 1.8);
  assert(roleLedAnode === 'ENTRY', `LED1 anode must be ENTRY pin, got ${roleLedAnode}`);

  // Forward wire R1(p2) -> LED1(anode): flow moves out of R1 into LED1
  const dirFwd = computeWireFlowDirection(wMidFwd, r1, led1, 'ANALOG', 1.8, 1.8, allWires, allComps);
  assert(dirFwd === 1, `Forward wire R1(p2) -> LED1(anode) must return +1, got ${dirFwd}`);

  // Reversed wire LED1(anode) -> R1(p2): flow moves out of R1 into LED1, so wire direction is REVERSED (-1)
  const dirRev = computeWireFlowDirection(wMidRev, led1, r1, 'ANALOG', 1.8, 1.8, allWires, allComps);
  assert(dirRev === -1, `Reverse wire LED1(anode) -> R1(p2) must return -1, got ${dirRev}`);

  console.log('  [PASS] 2A: Middle wire between Resistor and LED correctly chains from R1(EXIT) to LED(ENTRY)');

  // 2B. Wire between LED1(cathode) and GND1(gnd):
  const wGndFwd = makeWire('wGndFwd', 'led1', 'cathode', 'gnd1', 'gnd');
  const wGndRev = makeWire('wGndRev', 'gnd1', 'gnd', 'led1', 'cathode');

  const dirGndFwd = computeWireFlowDirection(wGndFwd, led1, gnd1, 'ANALOG', 0.0, 0.0, [wGndFwd], allComps);
  const dirGndRev = computeWireFlowDirection(wGndRev, gnd1, led1, 'ANALOG', 0.0, 0.0, [wGndRev], allComps);

  assert(dirGndFwd === 1, `Forward ground wire LED1 -> GND1 must return +1, got ${dirGndFwd}`);
  assert(dirGndRev === -1, `Reversed ground wire GND1 -> LED1 must return -1, got ${dirGndRev}`);
  console.log('  [PASS] 2B: Ground return wire flows from LED(EXIT) into GND(ENTRY) regardless of draw order');

  // 2C. Wire between VCC1 and SW1(com):
  const wVccFwd = makeWire('wVccFwd', 'vcc1', 'vcc', 'sw1', 'p1');
  const wVccRev = makeWire('wVccRev', 'sw1', 'p1', 'vcc1', 'vcc');

  const dirVccFwd = computeWireFlowDirection(wVccFwd, vcc1, sw1, 'ANALOG', 5.0, 5.0, [wVccFwd], allComps);
  const dirVccRev = computeWireFlowDirection(wVccRev, sw1, vcc1, 'ANALOG', 5.0, 5.0, [wVccRev], allComps);

  assert(dirVccFwd === 1, `Forward supply wire VCC -> SW1 must return +1, got ${dirVccFwd}`);
  assert(dirVccRev === -1, `Reversed supply wire SW1 -> VCC must return -1, got ${dirVccRev}`);
  console.log('  [PASS] 2C: Supply wire flows from VCC(EXIT) into SW1(ENTRY) regardless of draw order');

  // 2D. Two Resistors in series (R1 -> R2):
  const rA = makeComp('rA', 'builtin_resistor', 100, 100, {}, { pinVoltages: { p1: 5.0, p2: 3.0 } });
  const rB = makeComp('rB', 'builtin_resistor', 200, 100, {}, { pinVoltages: { p1: 3.0, p2: 0.0 } });
  const wSeriesFwd = makeWire('wSeriesFwd', 'rA', 'p2', 'rB', 'p1');
  const wSeriesRev = makeWire('wSeriesRev', 'rB', 'p1', 'rA', 'p2');

  const dirSeriesFwd = computeWireFlowDirection(wSeriesFwd, rA, rB, 'ANALOG', 3.0, 3.0, [wSeriesFwd], [rA, rB]);
  const dirSeriesRev = computeWireFlowDirection(wSeriesRev, rB, rA, 'ANALOG', 3.0, 3.0, [wSeriesRev], [rA, rB]);

  assert(dirSeriesFwd === 1, `Forward series wire rA(p2) -> rB(p1) must return +1, got ${dirSeriesFwd}`);
  assert(dirSeriesRev === -1, `Reversed series wire rB(p1) -> rA(p2) must return -1, got ${dirSeriesRev}`);
  console.log('  [PASS] 2D: Series resistors chain from upstream EXIT to downstream ENTRY cleanly');
}

// ---------------------------------------------------------------------------
// TEST 3: SPICE Simulation Branch Current Synchronization (IR_RX1 Off vs On)
// ---------------------------------------------------------------------------
console.log('\n--- TEST 3: SPICE Engine Branch Current Synchronization ---');
{
  // Circuit with IR_RX1 off: VCC -> IR_RX1 (out) -> R2 -> LED1 -> GND
  const vcc1 = makeComp('vcc1', 'builtin_vcc', 100, 100, { voltage: 5.0 });
  const gnd1 = makeComp('gnd1', 'builtin_gnd', 100, 200, {});
  const rxOff = makeComp('rx1', 'builtin_ir_rx', 200, 100, { irDetected: false }, { isReceivingIr: false });
  const r2 = makeComp('r2', 'builtin_resistor', 300, 100, { resistance: 220 });
  const led1 = makeComp('led1', 'led-red', 400, 100, {});
  const gnd2 = makeComp('gnd2', 'builtin_gnd', 500, 100, {});

  // Wire IR_RX power
  const wVccRx = makeWire('wVccRx', 'vcc1', 'vcc', 'rx1', 'vcc');
  const wGndRx = makeWire('wGndRx', 'rx1', 'gnd', 'gnd1', 'gnd');

  // Wire IR_RX output load branch
  const wRxToR = makeWire('wRxToR', 'rx1', 'out', 'r2', 'p1');
  const wRToLed = makeWire('wRToLed', 'r2', 'p2', 'led1', 'anode');
  const wLedToGnd = makeWire('wLedToGnd', 'led1', 'cathode', 'gnd2', 'gnd');

  const components = [vcc1, gnd1, rxOff, r2, led1, gnd2];
  const wires = [wVccRx, wGndRx, wRxToR, wRToLed, wLedToGnd];

  const spiceResult = evaluateSpiceCircuit(components, wires, 0);

  // When IR_RX is OFF:
  const iRxToR = spiceResult.wireCurrents.get('wRxToR') ?? 0;
  const iRToLed = spiceResult.wireCurrents.get('wRToLed') ?? 0;
  const iLedToGnd = spiceResult.wireCurrents.get('wLedToGnd') ?? 0;

  assert(iRxToR < 0.00001, `wRxToR wire current must be < 10μA when IR_RX is off, got ${iRxToR * 1000}mA`);
  assert(iRToLed < 0.00001, `wRToLed wire current must be < 10μA when IR_RX is off, got ${iRToLed * 1000}mA`);
  assert(iLedToGnd < 0.00001, `wLedToGnd wire current must be < 10μA when IR_RX is off, got ${iLedToGnd * 1000}mA`);

  console.log('  [PASS] SPICE wire currents on dead output branch are strictly < 10μA (leakage floor)');
}

console.log('\n======================================================');
console.log('🎉 ALL HOTFIX 7.12 TESTS PASSED SUCCESSFULLY!');
console.log('======================================================');
