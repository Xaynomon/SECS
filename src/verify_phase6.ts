import { ComponentRegistry } from './registry/ComponentRegistry';
import {
  computeSignalTelemetry,
  getProbeLogicLevel,
  getProbeVoltage,
  getProbedResistance,
  getProbeTargetDisplay,
} from './utils/instrumentSignals';
import { useCircuitStore } from './store/useCircuitStore';
import { CircuitComponent, CircuitWire } from './types/circuit';

console.log('====================================================');
console.log('       SECS PHASE 6 VIRTUAL INSTRUMENTS VERIFICATION');
console.log('====================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${testName}`);
    if (detail) console.error(`     Detail: ${detail}`);
  }
}

// -----------------------------------------------------------------
// TEST 1: COMPONENT REGISTRY INSTRUMENT DEFINITIONS & 20px PINS
// -----------------------------------------------------------------
console.log('TEST 1: Component Registry Instrument Definitions');
const dmmDef = ComponentRegistry.get('multimeter');
assert(!!dmmDef, 'Multimeter is registered in ComponentRegistry');
assert(dmmDef?.category === 'instruments', 'Multimeter category is "instruments"');
assert(dmmDef?.pins.length === 2, 'Multimeter has 2 pins (v_plus, com)');
const dmmPinsOnGrid = dmmDef?.pins.every((p) => p.x % 20 === 0 && p.y % 20 === 0);
assert(!!dmmPinsOnGrid, 'Multimeter pins sit strictly on 20px grid multiples');

const scopeDef = ComponentRegistry.get('oscilloscope');
assert(!!scopeDef, 'Oscilloscope is registered in ComponentRegistry');
assert(scopeDef?.category === 'instruments', 'Oscilloscope category is "instruments"');
assert(scopeDef?.pins.length === 4, 'Oscilloscope has 4 pins (ch1, ch1_gnd, ch2, ch2_gnd)');
const scopePinsOnGrid = scopeDef?.pins.every((p) => p.x % 20 === 0 && p.y % 20 === 0);
assert(!!scopePinsOnGrid, 'Oscilloscope pins sit strictly on 20px grid multiples');

const laDef = ComponentRegistry.get('logic-analyzer');
assert(!!laDef, 'Logic Analyzer is registered in ComponentRegistry');
assert(laDef?.category === 'instruments', 'Logic Analyzer category is "instruments"');
assert(laDef?.pins.length === 9, 'Logic Analyzer has 9 pins (D0-D7 + GND)');
const laPinsOnGrid = laDef?.pins.every((p) => p.x % 20 === 0 && p.y % 20 === 0);
assert(!!laPinsOnGrid, 'Logic Analyzer pins sit strictly on 20px grid multiples');

// -----------------------------------------------------------------
// TEST 2: PROBE SIGNAL EXTRACTION (VOLTAGE & LOGIC LEVEL)
// -----------------------------------------------------------------
console.log('\nTEST 2: Probe Signal Extraction');
const mockComponents: CircuitComponent[] = [
  {
    id: 'V1',
    type: 'dc-source',
    label: 'V1',
    x: 0,
    y: 0,
    rotation: 0,
    mirrored: false,
    properties: { voltage: 9.0 },
    state: { pinVoltages: { pos: 9.0, neg: 0.0 } },
  },
  {
    id: 'R1',
    type: 'resistor',
    label: 'R1',
    x: 100,
    y: 0,
    rotation: 0,
    mirrored: false,
    properties: { resistance: 470 },
    state: { pinVoltages: { p1: 9.0, p2: 3.3 }, voltageDropV: 5.7, branchCurrentA: 0.012 },
  },
  {
    id: 'MCU1',
    type: 'arduino-uno',
    label: 'MCU1',
    x: 200,
    y: 200,
    rotation: 0,
    mirrored: false,
    properties: {},
    state: {
      pins: {
        D13: { mode: 'OUTPUT', value: 1 },
        D2: { mode: 'OUTPUT', value: 0 },
      },
    },
  },
];

const mockWires: CircuitWire[] = [
  {
    id: 'wire_1',
    fromCompId: 'V1',
    fromPinId: 'pos',
    toCompId: 'R1',
    toPinId: 'p1',
    waypoints: [],
    color: '#ef4444',
    state: { voltage: 9.0, current: 0.012, logicLevel: 1 },
  },
];

const vPos = getProbeVoltage({ type: 'pin', compId: 'V1', pinId: 'pos' }, mockComponents, mockWires);
assert(vPos === 9.0, `getProbeVoltage reads 9.0V on V1.pos (got: ${vPos}V)`);

const vWire = getProbeVoltage({ type: 'wire', wireId: 'wire_1' }, mockComponents, mockWires);
assert(vWire === 9.0, `getProbeVoltage reads 9.0V on wire_1 (got: ${vWire}V)`);

const vMcuHigh = getProbeVoltage({ type: 'pin', compId: 'MCU1', pinId: 'D13' }, mockComponents, mockWires);
assert(vMcuHigh === 5.0, `getProbeVoltage reads 5.0V on MCU1.D13 (got: ${vMcuHigh}V)`);

const lvlMcuHigh = getProbeLogicLevel({ type: 'pin', compId: 'MCU1', pinId: 'D13' }, mockComponents, mockWires);
assert(lvlMcuHigh === 1, `getProbeLogicLevel reads 1 on MCU1.D13 (got: ${lvlMcuHigh})`);

const lvlMcuLow = getProbeLogicLevel({ type: 'pin', compId: 'MCU1', pinId: 'D2' }, mockComponents, mockWires);
assert(lvlMcuLow === 0, `getProbeLogicLevel reads 0 on MCU1.D2 (got: ${lvlMcuLow})`);

// -----------------------------------------------------------------
// TEST 3: RESISTANCE & CONTINUITY TESTING
// -----------------------------------------------------------------
console.log('\nTEST 3: Resistance & Continuity Testing');
const resR1 = getProbedResistance(
  { type: 'pin', compId: 'R1', pinId: 'p1' },
  { type: 'pin', compId: 'R1', pinId: 'p2' },
  mockComponents,
  mockWires
);
assert(resR1.resistance === 470, `Probed resistance of R1 is 470Ω (got: ${resR1.resistance})`);
assert(resR1.isContinuity === false, '470Ω does not trigger continuity (< 50Ω)');

// Same wire continuity
const wireCont = getProbedResistance(
  { type: 'wire', wireId: 'wire_1' },
  { type: 'wire', wireId: 'wire_1' },
  mockComponents,
  mockWires
);
assert(wireCont.isContinuity === true, 'Probes on same wire trigger continuity (< 50Ω buzzer)');

// Disconnected probes (Open Loop)
const openLoop = getProbedResistance(
  { type: 'pin', compId: 'V1', pinId: 'pos' },
  { type: 'pin', compId: 'MCU1', pinId: 'D2' },
  mockComponents,
  [] // No wires
);
assert(openLoop.resistance === null, 'Disconnected probes return null resistance (O.L)');

// -----------------------------------------------------------------
// TEST 4: OSCILLOSCOPE SIGNAL TELEMETRY CALCULATION
// -----------------------------------------------------------------
console.log('\nTEST 4: Oscilloscope Signal Telemetry (Vpp, Vrms, Freq, Period, Duty)');
// Generate 1 kHz square wave: 0V to 5V with 50% duty cycle, sample at 100 kHz for 10ms
const squareWaveBuffer: Array<{ t: number; v: number }> = [];
const dtMs = 0.05; // 50 microseconds
for (let t = 0; t <= 10; t += dtMs) {
  // 1 kHz period is 1 ms: 0..0.5ms is 5V, 0.5..1.0ms is 0V
  const phase = (t % 1.0) / 1.0;
  const v = phase < 0.5 ? 5.0 : 0.0;
  squareWaveBuffer.push({ t, v });
}

const telemetry = computeSignalTelemetry(squareWaveBuffer, 1.0);
assert(telemetry.vMax === 5.0, `Vmax is 5.0V (got: ${telemetry.vMax}V)`);
assert(telemetry.vMin === 0.0, `Vmin is 0.0V (got: ${telemetry.vMin}V)`);
assert(telemetry.vPp === 5.0, `Vpp is 5.0V (got: ${telemetry.vPp}V)`);
assert(Math.abs(telemetry.vAvg - 2.5) < 0.2, `Vavg is ~2.5V (got: ${telemetry.vAvg}V)`);
assert(Math.abs(telemetry.frequencyHz - 1000) < 50, `Frequency is ~1000 Hz (got: ${telemetry.frequencyHz} Hz)`);
assert(Math.abs(telemetry.periodMs - 1.0) < 0.1, `Period is ~1.0 ms (got: ${telemetry.periodMs} ms)`);
assert(Math.abs(telemetry.dutyCyclePct - 50) <= 2, `Duty cycle is ~50% (got: ${telemetry.dutyCyclePct}%)`);

// -----------------------------------------------------------------
// TEST 5: ZUSTAND INSTRUMENTS & PROBE MANAGEMENT
// -----------------------------------------------------------------
console.log('\nTEST 5: Zustand Store Probe & Instrument Management');
const store = useCircuitStore.getState();

// Attach DMM probe
store.attachProbe('multimeter', 'red', { type: 'pin', compId: 'V1', pinId: 'pos', label: 'V1:pos' });
assert(
  useCircuitStore.getState().multimeter.redProbe?.label === 'V1:pos',
  'Multimeter Red Probe attached successfully'
);

// Black probe default behavior
assert(
  useCircuitStore.getState().multimeter.blackProbe === null,
  'Multimeter Black Probe defaults to null (interpreted as 0V GND)'
);

// Scope Channel 1 attach
store.attachProbe('oscilloscope', 'ch1', { type: 'wire', wireId: 'wire_1', label: 'Wire #1' });
assert(
  useCircuitStore.getState().oscilloscope.ch1.target?.wireId === 'wire_1',
  'Oscilloscope CH1 Probe attached successfully to wire_1'
);

// Logic Analyzer D0 attach
store.attachProbe('logicAnalyzer', 'D0', { type: 'pin', compId: 'MCU1', pinId: 'D13', label: 'MCU1:D13' });
assert(
  useCircuitStore.getState().logicAnalyzer.channels[0].target?.label === 'MCU1:D13',
  'Logic Analyzer D0 Probe attached successfully to MCU1:D13'
);

// Detach all probes at a target
store.detachAllProbesAtTarget({ type: 'pin', compId: 'V1', pinId: 'pos' });
assert(
  useCircuitStore.getState().multimeter.redProbe === null,
  'detachAllProbesAtTarget detached Red Probe from V1:pos'
);

// Helper display string
const displayStr = getProbeTargetDisplay({ type: 'pin', compId: 'MCU1', pinId: 'D13', label: 'MCU1:D13' });
assert(displayStr === 'MCU1:D13', `getProbeTargetDisplay formatted correctly (${displayStr})`);

// -----------------------------------------------------------------
// TEST 6: HOTFIX 6.1 - ARDUINO MULTI-PIN EXECUTION & NORMALIZATION
// -----------------------------------------------------------------
console.log('\nTEST 6: Hotfix 6.1 - Arduino Multi-Pin Execution & Normalization');
import { ArduinoRuntime } from './simulation/mcu/arduinoRuntime';
import { evaluateLogicalCircuit } from './simulation/logical/LogicalEngine';

const runtime = new ArduinoRuntime('test_uno', 'arduino-uno');
const sketchCode = `
void setup() {
  pinMode(13, OUTPUT);
  pinMode(12, OUTPUT);
}
void loop() {
  digitalWrite(13, HIGH);
  digitalWrite(12, HIGH);
  delay(200);
  digitalWrite(13, LOW);
  digitalWrite(12, HIGH);
  delay(200);
  digitalWrite(13, HIGH);
  digitalWrite(12, LOW);
  delay(200);
  digitalWrite(13, LOW);
  digitalWrite(12, LOW);
  delay(200);
}
`;

runtime.compile(sketchCode);
// Step at 0ms: setup runs, pin 13 and pin 12 both set to HIGH (1)
runtime.step(0);
const unoState0 = runtime.getInstanceData().pins;
assert(unoState0['d13']?.digitalValue === 1, `Arduino Pin 13 is HIGH at t=0ms (got: ${unoState0['d13']?.digitalValue})`);
assert(unoState0['d12']?.digitalValue === 1, `Arduino Pin 12 is HIGH at t=0ms (got: ${unoState0['d12']?.digitalValue})`);

// Logical engine evaluation with this MCU
const unoComp: CircuitComponent = {
  id: 'MCU_TEST',
  type: 'arduino-uno',
  label: 'MCU_TEST',
  x: 0,
  y: 0,
  rotation: 0,
  mirrored: false,
  properties: {},
  state: { pins: unoState0 }
};

const unoWires: CircuitWire[] = [
  { id: 'w_d13', fromCompId: 'MCU_TEST', fromPinId: 'd13', toCompId: 'R1', toPinId: 'p1', waypoints: [], color: '#3b82f6' },
  { id: 'w_d12', fromCompId: 'MCU_TEST', fromPinId: 'd12', toCompId: 'R1', toPinId: 'p2', waypoints: [], color: '#10b981' },
];

const logResult0 = evaluateLogicalCircuit([unoComp], unoWires, 0);
assert(logResult0.pinStates.get('MCU_TEST:d13') === 1, `LogicalEngine drives MCU_TEST:d13 as 1 at t=0ms (got: ${logResult0.pinStates.get('MCU_TEST:d13')})`);
assert(logResult0.pinStates.get('MCU_TEST:d12') === 1, `LogicalEngine drives MCU_TEST:d12 as 1 at t=0ms (got: ${logResult0.pinStates.get('MCU_TEST:d12')})`);

// Step forward 200ms: d13 becomes LOW (0), d12 stays HIGH (1)
runtime.step(200);
const unoState200 = runtime.getInstanceData().pins;
assert(unoState200['d13']?.digitalValue === 0, `Arduino Pin 13 is LOW at t=200ms (got: ${unoState200['d13']?.digitalValue})`);
assert(unoState200['d12']?.digitalValue === 1, `Arduino Pin 12 is HIGH at t=200ms (got: ${unoState200['d12']?.digitalValue})`);

unoComp.state = { pins: unoState200 };
const logResult200 = evaluateLogicalCircuit([unoComp], unoWires, 200);
assert(logResult200.pinStates.get('MCU_TEST:d13') === 0, `LogicalEngine drives MCU_TEST:d13 as 0 at t=200ms (got: ${logResult200.pinStates.get('MCU_TEST:d13')})`);
assert(logResult200.pinStates.get('MCU_TEST:d12') === 1, `LogicalEngine drives MCU_TEST:d12 as 1 at t=200ms (got: ${logResult200.pinStates.get('MCU_TEST:d12')})`);

// Step forward another 200ms (t=400ms): d13 becomes HIGH (1), d12 becomes LOW (0)
runtime.step(400);
const unoState400 = runtime.getInstanceData().pins;
assert(unoState400['d13']?.digitalValue === 1, `Arduino Pin 13 is HIGH at t=400ms (got: ${unoState400['d13']?.digitalValue})`);
assert(unoState400['d12']?.digitalValue === 0, `Arduino Pin 12 is LOW at t=400ms (got: ${unoState400['d12']?.digitalValue})`);

// Test instrument probe reading on pin 12 & 13
unoComp.state = { pins: unoState400 };
const probeD13Lvl = getProbeLogicLevel({ type: 'pin', compId: 'MCU_TEST', pinId: 'd13' }, [unoComp], unoWires);
const probeD12Lvl = getProbeLogicLevel({ type: 'pin', compId: 'MCU_TEST', pinId: 'd12' }, [unoComp], unoWires);
assert(probeD13Lvl === 1, `getProbeLogicLevel reads 1 on MCU_TEST:d13 at t=400ms (got: ${probeD13Lvl})`);
assert(probeD12Lvl === 0, `getProbeLogicLevel reads 0 on MCU_TEST:d12 at t=400ms (got: ${probeD12Lvl})`);

// -----------------------------------------------------------------
// TEST 7: HOTFIX 6.1 - UNIQUE COMPONENT DESIGNATORS ACROSS PREFIXES
// -----------------------------------------------------------------
console.log('\nTEST 7: Hotfix 6.1 - Unique Component Designators Across Prefixes');
useCircuitStore.setState({ components: [], wires: [] });
store.addComponent('gate-and', 0, 0);
store.addComponent('gate-xor', 100, 0);
store.addComponent('gate-and', 200, 0);
store.addComponent('resistor', 300, 0);
store.addComponent('resistor', 400, 0);

const currentComps = useCircuitStore.getState().components;
const uLabels = currentComps.filter(c => c.label.startsWith('U')).map(c => c.label);
const rLabels = currentComps.filter(c => c.label.startsWith('R')).map(c => c.label);

assert(
  uLabels[0] === 'U1' && uLabels[1] === 'U2' && uLabels[2] === 'U3',
  `Logic gates sharing prefix 'U' receive unique sequential designators U1, U2, U3 (got: ${uLabels.join(', ')})`
);
assert(
  rLabels[0] === 'R1' && rLabels[1] === 'R2',
  `Resistors sharing prefix 'R' receive unique sequential designators R1, R2 (got: ${rLabels.join(', ')})`
);

// -----------------------------------------------------------------
// TEST 8: HOTFIX 6.1 - PROBE BADGE VERTICAL TIER STAGGERING
// -----------------------------------------------------------------
console.log('\nTEST 8: Hotfix 6.1 - Probe Badge Vertical Tier Staggering');
// Pin 13 at x = -100, Pin 12 at x = -80 (both on 20px grid)
const calcTierOffset = (pinX: number) => (Math.abs(Math.round(pinX / 20)) % 2 === 0 ? 18 : 36);
const tierPin13 = calcTierOffset(-100); // -100 / 20 = -5 (odd) -> 36
const tierPin12 = calcTierOffset(-80);  // -80 / 20 = -4 (even) -> 18

assert(tierPin13 === 36, `Pin 13 (x=-100) has tier offset 36px (got: ${tierPin13}px)`);
assert(tierPin12 === 18, `Pin 12 (x=-80) has tier offset 18px (got: ${tierPin12}px)`);
assert(Math.abs(tierPin13 - tierPin12) === 18, `Adjacent 20px pins have 18px vertical separation preventing horizontal collision`);

// -----------------------------------------------------------------
// TEST 9: HOTFIX 6.2 - OPEN-CIRCUIT PHANTOM BURNOUT PREVENTION
// -----------------------------------------------------------------
console.log('\nTEST 9: Hotfix 6.2 - Open-Circuit Phantom Burnout Prevention');
import { evaluateSpiceCircuit } from './simulation/spice/SpiceEngine';

// Case A: LED with Anode wired to 5V DC source, but Cathode completely unconnected
const openLedComps: CircuitComponent[] = [
  {
    id: 'DC1',
    type: 'dc-source',
    label: 'DC1',
    x: 0,
    y: 0,
    rotation: 0,
    mirrored: false,
    properties: { voltage: 5.0 },
  },
  {
    id: 'LED_OPEN',
    type: 'led-red',
    label: 'LED_OPEN',
    x: 60,
    y: 0,
    rotation: 0,
    mirrored: false,
    properties: {},
  },
  {
    id: 'GND1',
    type: 'gnd',
    label: 'GND1',
    x: 0,
    y: 100,
    rotation: 0,
    mirrored: false,
    properties: {},
  },
];

const openLedWires: CircuitWire[] = [
  { id: 'w_dc_gnd', fromCompId: 'DC1', fromPinId: 'neg', toCompId: 'GND1', toPinId: 'gnd', waypoints: [], color: '#000000' },
  // Only Anode connected to 5V DC+; Cathode has NO wire!
  { id: 'w_dc_anode', fromCompId: 'DC1', fromPinId: 'pos', toCompId: 'LED_OPEN', toPinId: 'anode', waypoints: [], color: '#ef4444' },
];

const openSpiceRes = evaluateSpiceCircuit(openLedComps, openLedWires, 0);
const ledRes = openSpiceRes.componentResults.get('LED_OPEN');

assert(ledRes !== undefined, 'LED_OPEN result exists in SPICE output');
assert(ledRes?.currentA === 0, `Open-circuit LED current is strictly 0 A (got: ${ledRes?.currentA} A)`);
assert(ledRes?.powerW === 0, `Open-circuit LED power is strictly 0 W (got: ${ledRes?.powerW} W)`);
assert(ledRes?.voltageDropV === 0, `Open-circuit LED voltage drop is strictly 0 V (got: ${ledRes?.voltageDropV} V)`);
assert(ledRes?.isBurned === false, `Open-circuit LED does NOT burn out (isBurned: ${ledRes?.isBurned})`);
assert(ledRes?.isOverloaded === false, `Open-circuit LED is NOT overloaded (isOverloaded: ${ledRes?.isOverloaded})`);
assert(ledRes?.brightness === 0, `Open-circuit LED brightness is strictly 0 (got: ${ledRes?.brightness})`);
assert(Math.abs((ledRes?.pinVoltages['cathode'] ?? 0) - 5.0) < 0.01, `Open-circuit Cathode pin floats to Anode potential 5V (got: ${ledRes?.pinVoltages['cathode']?.toFixed(2)} V)`);

// Case B: Resistor with Pin 1 wired to 9V battery, but Pin 2 unconnected
const openResComps: CircuitComponent[] = [
  { id: 'BAT1', type: 'dc-source', label: 'BAT1', x: 0, y: 0, rotation: 0, mirrored: false, properties: { voltage: 9.0 } },
  { id: 'R_OPEN', type: 'resistor', label: 'R_OPEN', x: 80, y: 0, rotation: 0, mirrored: false, properties: { resistance: 220, powerRating: 0.25 } },
  { id: 'GND2', type: 'gnd', label: 'GND2', x: 0, y: 100, rotation: 0, mirrored: false, properties: {} },
];
const openResWires: CircuitWire[] = [
  { id: 'w_bat_p1', fromCompId: 'BAT1', fromPinId: 'pos', toCompId: 'R_OPEN', toPinId: 'p1', waypoints: [], color: '#ef4444' },
  { id: 'w_bat_neg', fromCompId: 'BAT1', fromPinId: 'neg', toCompId: 'GND2', toPinId: 'gnd', waypoints: [], color: '#000000' },
];
const openResSpiceRes = evaluateSpiceCircuit(openResComps, openResWires, 0);
const rRes = openResSpiceRes.componentResults.get('R_OPEN');
assert(rRes?.currentA === 0, `Open-circuit resistor current is strictly 0 A (got: ${rRes?.currentA} A)`);
assert(rRes?.powerW === 0, `Open-circuit resistor power is strictly 0 W (got: ${rRes?.powerW} W)`);
assert(rRes?.isBurned === false, `Open-circuit resistor does NOT catch fire`);

// -----------------------------------------------------------------
// TEST 10: HOTFIX 6.2 - LOGIC GATE TO RESISTOR & LED PASS-THROUGH
// -----------------------------------------------------------------
console.log('\nTEST 10: Hotfix 6.2 - Logic Gate to Resistor & LED Pass-Through');

// Circuit: DC 5V (1) -> AND Gate Inputs (in_a=1, in_b=1)
// AND Gate Out -> Resistor (220Ω) -> LED Red -> GND (0)
const gateLedComps: CircuitComponent[] = [
  { id: 'DC_GATE', type: 'dc-source', label: 'DC_GATE', x: 0, y: 0, rotation: 0, mirrored: false, properties: { voltage: 5.0 } },
  { id: 'U_AND', type: 'gate-and', label: 'U1', x: 60, y: 0, rotation: 0, mirrored: false, properties: {} },
  { id: 'R_LIMIT', type: 'resistor', label: 'R1', x: 140, y: 0, rotation: 0, mirrored: false, properties: { resistance: 220 } },
  { id: 'LED_SERIES', type: 'led-red', label: 'LED1', x: 200, y: 0, rotation: 0, mirrored: false, properties: {} },
  { id: 'GND_GATE', type: 'gnd', label: 'GND_GATE', x: 260, y: 0, rotation: 0, mirrored: false, properties: {} },
];

const gateLedWires: CircuitWire[] = [
  { id: 'w_gnd_ref', fromCompId: 'DC_GATE', fromPinId: 'neg', toCompId: 'GND_GATE', toPinId: 'gnd', waypoints: [], color: '#000000' },
  { id: 'w1', fromCompId: 'DC_GATE', fromPinId: 'pos', toCompId: 'U_AND', toPinId: 'in_a', waypoints: [], color: '#ef4444' },
  { id: 'w2', fromCompId: 'DC_GATE', fromPinId: 'pos', toCompId: 'U_AND', toPinId: 'in_b', waypoints: [], color: '#ef4444' },
  { id: 'w3', fromCompId: 'U_AND', fromPinId: 'out', toCompId: 'R_LIMIT', toPinId: 'p1', waypoints: [], color: '#3b82f6' },
  { id: 'w4', fromCompId: 'R_LIMIT', fromPinId: 'p2', toCompId: 'LED_SERIES', toPinId: 'anode', waypoints: [], color: '#3b82f6' },
  { id: 'w5', fromCompId: 'LED_SERIES', fromPinId: 'cathode', toCompId: 'GND_GATE', toPinId: 'gnd', waypoints: [], color: '#000000' },
];

// Test 10A: Logical Engine Pass-Through
const gateLogResult = evaluateLogicalCircuit(gateLedComps, gateLedWires, 0);
const ledLogState = gateLogResult.componentStates.get('LED_SERIES');
assert(ledLogState?.lit === true, `LogicalEngine: Resistor passes HIGH through to LED (LED lit === true)`);
assert(ledLogState?.brightness === 100, `LogicalEngine: LED brightness is 100`);
assert(ledLogState?.hasSeriesResistor === true, `LogicalEngine: Identified current-limiting series resistor on LED net`);

// Test 10B: SPICE MNA Solver with Series Resistor & LED
const gateSpiceResult = evaluateSpiceCircuit(gateLedComps, gateLedWires, 0);
const ledSpiceRes = gateSpiceResult.componentResults.get('LED_SERIES');
assert(ledSpiceRes !== undefined, 'LED_SERIES SPICE result exists');
assert((ledSpiceRes?.currentA || 0) > 0.005, `SPICE: LED receives forward current (got: ${((ledSpiceRes?.currentA || 0) * 1000).toFixed(1)} mA > 5 mA)`);
assert((ledSpiceRes?.currentA || 0) < 0.025, `SPICE: Current-limiting resistor keeps current safe (got: ${((ledSpiceRes?.currentA || 0) * 1000).toFixed(1)} mA < 25 mA)`);
assert(ledSpiceRes?.isBurned === false, `SPICE: LED does NOT burn out with 220Ω resistor (isBurned: false)`);
assert(ledSpiceRes?.isOverloaded === false, `SPICE: LED is NOT overloaded with 220Ω resistor`);
assert((ledSpiceRes?.brightness || 0) > 0.4, `SPICE: LED brightness is properly illuminated (got: ${ledSpiceRes?.brightness?.toFixed(2)})`);

// -----------------------------------------------------------------
// TEST 11: HOTFIX 6.2 - LATCHED COMPONENT BURNOUT & NON-BLINKING DIAGNOSTICS
// -----------------------------------------------------------------
console.log('\nTEST 11: Hotfix 6.2 - Latched Burnout & Non-Blinking Diagnostics');
useCircuitStore.setState({ components: [], wires: [], latchedDiagnostics: {} });

// Place LED directly across 9V DC Source with NO resistor (Overcurrent Burnout Hazard)
store.addComponent('dc-source', 0, 0);
store.addComponent('led-red', 100, 0);
const cBat = useCircuitStore.getState().components.find(c => c.type === 'dc-source')!;
const cLed = useCircuitStore.getState().components.find(c => c.type === 'led-red')!;

useCircuitStore.setState({
  wires: [
    { id: 'w_test_1', fromCompId: cBat.id, fromPinId: 'pos', toCompId: cLed.id, toPinId: 'anode', waypoints: [], color: '#ef4444' },
    { id: 'w_test_2', fromCompId: cLed.id, fromPinId: 'cathode', toCompId: cBat.id, toPinId: 'neg', waypoints: [], color: '#000000' },
  ],
});

// Run step: LED experiences massive overcurrent (> 300mA) and catches fire
store.stepSimulation();
const burnedLed = useCircuitStore.getState().components.find(c => c.id === cLed.id)!;
assert(burnedLed.state?.isBurned === true, `LED catches fire and burns out (isBurned: true)`);
assert(burnedLed.state?.isOverloaded === true, `LED state marks isOverloaded: true`);

// Check latched diagnostics
const latchedAfterBurn = useCircuitStore.getState().latchedDiagnostics;
const ledTipKey = `overload-led-${cLed.id}`;
assert(latchedAfterBurn[ledTipKey] !== undefined, `Latched diagnostic recorded for burned LED (${ledTipKey})`);
assert(latchedAfterBurn[ledTipKey]?.peakValue !== undefined, `Latched diagnostic tracks Peak Current (got: ${latchedAfterBurn[ledTipKey]?.peakValue})`);

// Reset simulation: confirms latched burnout and diagnostics are cleared cleanly
store.resetSimulation();
const resetLed = useCircuitStore.getState().components.find(c => c.id === cLed.id)!;
assert(resetLed.state?.isBurned === false, `Reset simulation clears component burnout (isBurned: false)`);
assert(Object.keys(useCircuitStore.getState().latchedDiagnostics).length === 0, `Reset simulation clears latched diagnostics map`);

// -----------------------------------------------------------------
// TEST 12: HOTFIX 6.2 - K-MAP & QUINE-MCCLUSKEY MINIMAL SOP SOLVER
// -----------------------------------------------------------------
console.log('\nTEST 12: Hotfix 6.2 - K-Map & Quine-McCluskey Minimal SOP Solver');
import { solveBooleanFunction, TruthTableRow } from './utils/booleanSolver';

// Test 12A: 2-Variable AND Gate (Y = A·B)
const andTable: TruthTableRow[] = [
  { index: 0, inputs: [0, 0], output: 0 },
  { index: 1, inputs: [0, 1], output: 0 },
  { index: 2, inputs: [1, 0], output: 0 },
  { index: 3, inputs: [1, 1], output: 1 },
];
const andResult = solveBooleanFunction(andTable, ['A', 'B']);
assert(andResult.sop === 'Y = A·B', `2-var AND solved as "Y = A·B" (got: ${andResult.sop})`);
assert(andResult.logicGates === 'AND(A, B)', `2-var AND logic gate identified as "AND(A, B)" (got: ${andResult.logicGates})`);
assert(andResult.kmapGrid.cells.length === 2 && andResult.kmapGrid.cells[0].length === 2, `2-var K-Map grid has 2x2 dimensions`);

// Test 12B: 2-Variable XOR Gate (Y = A ⊕ B)
const xorTable: TruthTableRow[] = [
  { index: 0, inputs: [0, 0], output: 0 },
  { index: 1, inputs: [0, 1], output: 1 },
  { index: 2, inputs: [1, 0], output: 1 },
  { index: 3, inputs: [1, 1], output: 0 },
];
const xorResult = solveBooleanFunction(xorTable, ['A', 'B']);
assert(xorResult.sop === 'Y = A ⊕ B', `2-var XOR solved as "Y = A ⊕ B" (got: ${xorResult.sop})`);
assert(xorResult.logicGates === 'XOR(A, B)', `2-var XOR logic gate identified as "XOR(A, B)"`);

// Test 12C: 3-Variable Reduction with Don't Care (Y = A + B)
// When A=1 or B=1, output is 1; C is don't care
const threeVarTable: TruthTableRow[] = [
  { index: 0, inputs: [0, 0, 0], output: 0 },
  { index: 1, inputs: [0, 0, 1], output: 0 },
  { index: 2, inputs: [0, 1, 0], output: 1 },
  { index: 3, inputs: [0, 1, 1], output: 1 },
  { index: 4, inputs: [1, 0, 0], output: 1 },
  { index: 5, inputs: [1, 0, 1], output: 1 },
  { index: 6, inputs: [1, 1, 0], output: 1 },
  { index: 7, inputs: [1, 1, 1], output: 1 },
];
const threeVarResult = solveBooleanFunction(threeVarTable, ['A', 'B', 'C']);
assert(threeVarResult.sop.includes('B') && threeVarResult.sop.includes('A') && !threeVarResult.sop.includes('C'), `3-var solver eliminates redundant variable C (got: ${threeVarResult.sop})`);
assert(threeVarResult.kmapGrid.colHeaders.join('') === '00011110', `3-var K-Map columns follow Gray code (00, 01, 11, 10)`);

// -----------------------------------------------------------------
// TEST 13: HOTFIX 6.3 - UNIVERSAL GROUND (GND1/GND2/GND3) & SUPPLY PIN BINDING
// -----------------------------------------------------------------
console.log('\nTEST 13: Hotfix 6.3 - Universal Ground (GND1/GND2/GND3) & Supply Pin Binding');
import { evaluateAutomatedTruthTable } from './utils/instrumentSignals';

// Build circuit with Arduino Uno:
// - Pin d13 (HIGH) -> R1 (220Ω) -> LED1 Anode, LED1 Cathode -> Arduino GND3
// - Pin d12 (HIGH) -> R2 (220Ω) -> LED2 Anode, LED2 Cathode -> Arduino GND2
// Notice GND2 and GND3 are NOT wired together externally; both must independently bind to Node 0 (0.00V)!
const dualGndComps: CircuitComponent[] = [
  {
    id: 'MCU_DUAL',
    type: 'arduino-uno',
    label: 'MCU1',
    x: 0,
    y: 0,
    rotation: 0,
    mirrored: false,
    properties: {},
    state: {
      pinStates: { d13: 1, d12: 1 },
      pinVoltages: { d13: 5.0, d12: 5.0 },
    },
  },
  { id: 'R_LED1', type: 'resistor', label: 'R1', x: 100, y: -60, rotation: 0, mirrored: false, properties: { resistance: 220 } },
  { id: 'LED_1', type: 'led-red', label: 'LED1', x: 180, y: -60, rotation: 0, mirrored: false, properties: {} },
  { id: 'R_LED2', type: 'resistor', label: 'R2', x: 100, y: 60, rotation: 0, mirrored: false, properties: { resistance: 220 } },
  { id: 'LED_2', type: 'led-green', label: 'LED2', x: 180, y: 60, rotation: 0, mirrored: false, properties: {} },
];

const dualGndWires: CircuitWire[] = [
  // Branch 1 -> GND3
  { id: 'w_d13_r1', fromCompId: 'MCU_DUAL', fromPinId: 'd13', toCompId: 'R_LED1', toPinId: 'p1', waypoints: [], color: '#ef4444' },
  { id: 'w_r1_led1', fromCompId: 'R_LED1', fromPinId: 'p2', toCompId: 'LED_1', toPinId: 'anode', waypoints: [], color: '#ef4444' },
  { id: 'w_led1_gnd3', fromCompId: 'LED_1', fromPinId: 'cathode', toCompId: 'MCU_DUAL', toPinId: 'gnd3', waypoints: [], color: '#000000' },
  // Branch 2 -> GND2
  { id: 'w_d12_r2', fromCompId: 'MCU_DUAL', fromPinId: 'd12', toCompId: 'R_LED2', toPinId: 'p1', waypoints: [], color: '#22c55e' },
  { id: 'w_r2_led2', fromCompId: 'R_LED2', fromPinId: 'p2', toCompId: 'LED_2', toPinId: 'anode', waypoints: [], color: '#22c55e' },
  { id: 'w_led2_gnd2', fromCompId: 'LED_2', fromPinId: 'cathode', toCompId: 'MCU_DUAL', toPinId: 'gnd2', waypoints: [], color: '#000000' },
];

const dualGndSpice = evaluateSpiceCircuit(dualGndComps, dualGndWires, 0);
const led1Spice = dualGndSpice.componentResults.get('LED_1');
const led2Spice = dualGndSpice.componentResults.get('LED_2');
const mcuSpice = dualGndSpice.componentResults.get('MCU_DUAL');

assert(Math.abs(led1Spice?.pinVoltages['cathode'] ?? 99) < 0.001, `LED1 Cathode wired to Arduino GND3 is strictly 0.00V in SPICE (got: ${led1Spice?.pinVoltages['cathode']?.toFixed(3)}V)`);
assert(Math.abs(led2Spice?.pinVoltages['cathode'] ?? 99) < 0.001, `LED2 Cathode wired to Arduino GND2 is strictly 0.00V in SPICE (got: ${led2Spice?.pinVoltages['cathode']?.toFixed(3)}V)`);
assert((led1Spice?.currentA ?? 0) > 0.005, `LED1 wired to GND3 conducts forward current in SPICE (${((led1Spice?.currentA ?? 0) * 1000).toFixed(2)} mA)`);
assert((led2Spice?.currentA ?? 0) > 0.005, `LED2 wired to GND2 conducts forward current in SPICE (${((led2Spice?.currentA ?? 0) * 1000).toFixed(2)} mA)`);
assert((led1Spice?.brightness ?? 0) > 0.4 && (led2Spice?.brightness ?? 0) > 0.4, `Both LED1 (GND3) and LED2 (GND2) illuminate properly in SPICE`);
assert(Math.abs((mcuSpice?.pinVoltages['5v'] ?? 0) - 5.0) < 0.01, `Arduino 5V pin outputs 5.00V in SPICE (got: ${mcuSpice?.pinVoltages['5v']?.toFixed(2)}V)`);
assert(Math.abs((mcuSpice?.pinVoltages['3v3'] ?? 0) - 3.3) < 0.01, `Arduino 3V3 pin outputs 3.30V in SPICE (got: ${mcuSpice?.pinVoltages['3v3']?.toFixed(2)}V)`);

// -----------------------------------------------------------------
// TEST 14: HOTFIX 6.3 - PER-WIRE SPICE CURRENT & MODE VISUAL ISOLATION
// -----------------------------------------------------------------
console.log('\nTEST 14: Hotfix 6.3 - Per-Wire SPICE Current & Mode Visual Isolation');
// Set d13 = HIGH (active current), d12 = LOW (0V -> 0mA current)
dualGndComps[0].state = {
  pinStates: { d13: 1, d12: 0 },
  pinVoltages: { d13: 5.0, d12: 0.0 },
};
const branchSpice = evaluateSpiceCircuit(dualGndComps, dualGndWires, 0);
const iWireActive = branchSpice.wireCurrents.get('w_d13_r1') ?? 0;
const iWireInactive = branchSpice.wireCurrents.get('w_d12_r2') ?? 0;

assert(iWireActive > 0.005, `Active branch wire (d13=HIGH) carries current (${(iWireActive * 1000).toFixed(2)} mA > 0.01 mA)`);
assert(iWireInactive < 0.00001, `Inactive branch wire (d12=LOW) carries 0 mA (${(iWireInactive * 1000).toFixed(5)} mA)`);

// Verify ANALOG mode in store sets wire.state.logicLevel to undefined while preserving wire.state.current
useCircuitStore.setState({
  components: dualGndComps,
  wires: dualGndWires,
  simulationMode: 'ANALOG',
  simulationStatus: 'running',
});
store.runSimulationCycle(0);
const spiceWires = useCircuitStore.getState().wires;
const activeW = spiceWires.find(w => w.id === 'w_d13_r1')!;
const inactiveW = spiceWires.find(w => w.id === 'w_d12_r2')!;
assert(activeW.state?.logicLevel === undefined, `In ANALOG mode, wire.state.logicLevel is undefined (uses SPICE current-flow animation instead of digital green glow)`);
assert((activeW.state?.current ?? 0) > 0.005, `In ANALOG mode, active wire has current > 5mA`);
assert((inactiveW.state?.current ?? 0) < 0.00001, `In ANALOG mode, zero-current wire has current ~ 0A`);

// Switch to LOGICAL mode -> wire.state.logicLevel immediately populates
store.setSimulationMode('LOGICAL');
const logicalWires = useCircuitStore.getState().wires;
assert(logicalWires.find(w => w.id === 'w_d13_r1')?.state?.logicLevel === 1, `Switching to LOGICAL mode immediately sets active wire logicLevel to 1`);
assert(logicalWires.find(w => w.id === 'w_d12_r2')?.state?.logicLevel === 0, `Switching to LOGICAL mode immediately sets LOW wire logicLevel to 0`);

// -----------------------------------------------------------------
// TEST 15: HOTFIX 6.3 - LIVE WIRE REMOVAL IMMEDIATELY EXTINGUISHES BURNOUT
// -----------------------------------------------------------------
console.log('\nTEST 15: Hotfix 6.3 - Live Wire Removal Immediately Extinguishes Component Fire/Overload');
useCircuitStore.setState({ components: [], wires: [], latchedDiagnostics: {}, simulationMode: 'ANALOG', simulationStatus: 'running' });
store.addComponent('dc-source', 0, 0);
store.addComponent('led-red', 100, 0);
const bSrc = useCircuitStore.getState().components.find(c => c.type === 'dc-source')!;
const bLed = useCircuitStore.getState().components.find(c => c.type === 'led-red')!;

store.addWire(bSrc.id, 'pos', bLed.id, 'anode');
store.addWire(bLed.id, 'cathode', bSrc.id, 'neg');

// Verify LED is currently on fire
const burningNow = useCircuitStore.getState().components.find(c => c.id === bLed.id)!;
assert(burningNow.state?.isBurned === true, `LED catches fire when wired directly across 9V source`);

// Now remove wire while simulation is running
const firstBurnWireId = useCircuitStore.getState().wires[0].id;
store.removeWire(firstBurnWireId);
const afterWireRemoved = useCircuitStore.getState().components.find(c => c.id === bLed.id)!;
assert(afterWireRemoved.state?.isBurned === false, `Removing wire during live simulation immediately clears isBurned to false`);
assert(afterWireRemoved.state?.isOverloaded === false, `Removing wire during live simulation immediately clears isOverloaded to false`);
assert(Object.keys(useCircuitStore.getState().latchedDiagnostics).length === 0, `Removing wire during live simulation clears latchedDiagnostics`);

// -----------------------------------------------------------------
// TEST 16: HOTFIX 6.3 - SMART >=1.4V DIGITAL THRESHOLD & INSTANT 2^N K-MAP EVALUATOR
// -----------------------------------------------------------------
console.log('\nTEST 16: Hotfix 6.3 - Smart >=1.4V Digital Threshold & Instant Automated Truth Table / K-Map');
// Build circuit: MCU d13 (A) & d12 (B) -> AND Gate -> R1 (1kΩ) -> LED1 Anode (forward voltage ~1.9V) -> GND
const kmapCircuitComps: CircuitComponent[] = [
  {
    id: 'MCU_KMAP',
    type: 'arduino-uno',
    label: 'MCU1',
    x: 0,
    y: 0,
    rotation: 0,
    mirrored: false,
    properties: {},
    state: { pinStates: { d13: 1, d12: 1 }, pinVoltages: { d13: 5.0, d12: 5.0 } },
  },
  { id: 'U_GATE', type: 'gate-and', label: 'U1', x: 100, y: 0, rotation: 0, mirrored: false, properties: {} },
  { id: 'R_1K', type: 'resistor', label: 'R1', x: 180, y: 0, rotation: 0, mirrored: false, properties: { resistance: 1000 } },
  { id: 'LED_OUT', type: 'led-red', label: 'LED1', x: 260, y: 0, rotation: 0, mirrored: false, properties: {} },
];
const kmapCircuitWires: CircuitWire[] = [
  { id: 'wk_a', fromCompId: 'MCU_KMAP', fromPinId: 'd13', toCompId: 'U_GATE', toPinId: 'in_a', waypoints: [], color: '#ef4444' },
  { id: 'wk_b', fromCompId: 'MCU_KMAP', fromPinId: 'd12', toCompId: 'U_GATE', toPinId: 'in_b', waypoints: [], color: '#22c55e' },
  { id: 'wk_out', fromCompId: 'U_GATE', fromPinId: 'out', toCompId: 'R_1K', toPinId: 'p1', waypoints: [], color: '#3b82f6' },
  { id: 'wk_led', fromCompId: 'R_1K', fromPinId: 'p2', toCompId: 'LED_OUT', toPinId: 'anode', waypoints: [], color: '#eab308' },
  { id: 'wk_gnd', fromCompId: 'LED_OUT', fromPinId: 'cathode', toCompId: 'MCU_KMAP', toPinId: 'gnd1', waypoints: [], color: '#000000' },
];

// Verify smart digital threshold at LED1:anode (~1.9V forward voltage after 1kΩ resistor)
useCircuitStore.setState({ components: kmapCircuitComps, wires: kmapCircuitWires, simulationMode: 'ANALOG', simulationStatus: 'running' });
store.runSimulationCycle(0);
const solvedKmapComps = useCircuitStore.getState().components;
const solvedKmapWires = useCircuitStore.getState().wires;
const ledAnodeV = getProbeVoltage({ type: 'pin', compId: 'LED_OUT', pinId: 'anode' }, solvedKmapComps, solvedKmapWires, 'ANALOG');
const ledAnodeLogic = getProbeLogicLevel({ type: 'pin', compId: 'LED_OUT', pinId: 'anode' }, solvedKmapComps, solvedKmapWires);

assert(ledAnodeV >= 1.4 && ledAnodeV <= 2.5, `LED1 Anode after 1kΩ resistor clamps at ~1.8V-2.1V forward voltage (got: ${ledAnodeV.toFixed(2)}V)`);
assert(ledAnodeLogic === 1, `Smart >=1.4V digital threshold classifies active LED1 Anode (${ledAnodeV.toFixed(2)}V) as Logic 1 (HIGH)`);

// Verify instant 2^N automated Truth Table & K-Map evaluation across all 4 input combinations (00, 01, 10, 11)
// without waiting for live clock ticks!
const autoMap = evaluateAutomatedTruthTable(
  solvedKmapComps,
  solvedKmapWires,
  [
    { type: 'pin', compId: 'MCU_KMAP', pinId: 'd13' },
    { type: 'pin', compId: 'MCU_KMAP', pinId: 'd12' },
  ],
  { type: 'pin', compId: 'LED_OUT', pinId: 'anode' }
);

assert(
  autoMap[0] === 0 && autoMap[1] === 0 && autoMap[2] === 0 && autoMap[3] === 1,
  `Instant automated Truth Table evaluator solves all 2^2 combinations for AND->1kΩ->LED1:anode (00->${autoMap[0]}, 01->${autoMap[1]}, 10->${autoMap[2]}, 11->${autoMap[3]})`
);

const autoRows: TruthTableRow[] = [0, 1, 2, 3].map((idx) => ({
  index: idx,
  inputs: [(idx >> 1) & 1, idx & 1] as (0 | 1)[],
  output: autoMap[idx] ?? 'X',
}));
const instantKmapSolution = solveBooleanFunction(autoRows, ['A', 'B']);
assert(
  instantKmapSolution.sop === 'Y = A·B',
  `Instant K-Map solver produces minimal SOP "Y = A·B" immediately without waiting for clock ticks (got: ${instantKmapSolution.sop})`
);

// -----------------------------------------------------------------
// TEST 17: HOTFIX 6.4 - COMPONENT DRAG-AND-DROP, MOVE & UNDO/REDO
// -----------------------------------------------------------------
console.log('\nTEST 17: Hotfix 6.4 - Component Drag-and-Drop, moveComponent & Undo/Redo Integration');
import { getProject } from './utils/indexedDb';
useCircuitStore.setState({ components: [], wires: [], historyPast: [], historyFuture: [] });

// Test 17A: Fallback default viewport placement when x, y are undefined (Sidebar click-to-place)
const placedId1 = store.addComponent('resistor');
const compR = useCircuitStore.getState().components.find((c) => c.id === placedId1)!;
assert(compR !== undefined, 'addComponent without coordinates successfully creates component');
assert(compR.x % 20 === 0 && compR.y % 20 === 0, `Fallback viewport placement aligns to 20px grid (x=${compR.x}, y=${compR.y})`);

// Test 17B: moveComponent updates coordinates snapped to grid
const initialX = compR.x;
const initialY = compR.y;
const preSnapshot = {
  components: JSON.parse(JSON.stringify(useCircuitStore.getState().components)),
  wires: JSON.parse(JSON.stringify(useCircuitStore.getState().wires)),
};
store.moveComponent(compR.id, initialX + 63, initialY + 41); // Should snap to +60, +40
const movedR = useCircuitStore.getState().components.find((c) => c.id === compR.id)!;
assert(movedR.x === initialX + 60, `moveComponent snaps X to 20px grid (${movedR.x} === ${initialX + 60})`);
assert(movedR.y === initialY + 40, `moveComponent snaps Y to 20px grid (${movedR.y} === ${initialY + 40})`);

// Test 17C: commitComponentMove & Undo/Redo
store.commitComponentMove(preSnapshot);
assert(useCircuitStore.getState().canUndo === true, 'commitComponentMove sets canUndo to true');
store.undo();
const undoneR = useCircuitStore.getState().components.find((c) => c.id === compR.id)!;
assert(undoneR.x === initialX && undoneR.y === initialY, `undo() restores component position to initial coordinates (${undoneR.x}, ${undoneR.y})`);
store.redo();
const redoneR = useCircuitStore.getState().components.find((c) => c.id === compR.id)!;
assert(redoneR.x === initialX + 60 && redoneR.y === initialY + 40, `redo() reapplies moved component coordinates (${redoneR.x}, ${redoneR.y})`);

// -----------------------------------------------------------------
// TEST 18: HOTFIX 6.4 - COLLAPSED SIDEBAR MINI-ICON REGISTRY & SEARCH
// -----------------------------------------------------------------
console.log('\nTEST 18: Hotfix 6.4 - Collapsed Sidebar Mini-Icon Registry & Search');
const allRegistryComps = ComponentRegistry.getAllComponents();
assert(allRegistryComps.length >= 25, `ComponentRegistry has at least 25 components for mini icon column (got: ${allRegistryComps.length})`);

// Search test cases
const search555 = ComponentRegistry.searchComponents('555');
assert(search555.some((c) => c.id === 'ic-555'), 'searchComponents("555") finds 555 Timer IC');

const searchLed = ComponentRegistry.searchComponents('led');
assert(searchLed.some((c) => c.id === 'led-red') && searchLed.some((c) => c.id === 'led-rgb'), 'searchComponents("led") finds Red LED and RGB LED');

const searchMcu = ComponentRegistry.searchComponents('arduino');
assert(searchMcu.some((c) => c.id === 'arduino-uno'), 'searchComponents("arduino") finds Arduino Uno R3');

// -----------------------------------------------------------------
// TEST 19: HOTFIX 6.4 - REAL-TIME PROJECT AUTO-SAVE & INDEXEDDB
// -----------------------------------------------------------------
console.log('\nTEST 19: Hotfix 6.4 - Real-Time Project Auto-Save & IndexedDB Integration');
store.newCircuit();
const newProjectId = useCircuitStore.getState().currentProjectId;
assert(typeof newProjectId === 'string' && newProjectId.startsWith('proj_'), `newCircuit() generates a unique currentProjectId ready for auto-save (got: ${newProjectId})`);
assert(useCircuitStore.getState().autoSaveStatus === 'idle', `newCircuit() initializes autoSaveStatus to "idle"`);

// Add a component and verify auto-save transition
store.addComponent('led-blue', 100, 100);
store.setCurrentProjectName('AutoSave Test Circuit');

// Test saveCurrentProjectToDb
await store.saveCurrentProjectToDb();
const savedProjectRecord = await getProject(newProjectId!);
assert(savedProjectRecord !== undefined, `Project record was written to IndexedDB with key ${newProjectId}`);
assert(savedProjectRecord?.name === 'AutoSave Test Circuit', `Saved project has matching title "${savedProjectRecord?.name}"`);
assert(savedProjectRecord?.componentCount === 1, `Saved project has componentCount === 1 (got: ${savedProjectRecord?.componentCount})`);

// Test autoSaveStatus transitions
store.setAutoSaveStatus('saving');
assert(useCircuitStore.getState().autoSaveStatus === 'saving', 'autoSaveStatus can be set to "saving"');
store.setAutoSaveStatus('saved');
assert(useCircuitStore.getState().autoSaveStatus === 'saved', 'autoSaveStatus can be set to "saved"');

// -----------------------------------------------------------------
// TEST 20: HOTFIX 6.5 - ANALOG SIMULATION & READ-ONLY K-MAP EVALUATION
// -----------------------------------------------------------------
console.log('\nTEST 20: Hotfix 6.5 - ANALOG Simulation Mode & Automated Probing');
assert(useCircuitStore.getState().simulationMode === 'ANALOG', 'Circuit store defaults to "ANALOG" simulation mode');

// Test unified simulation cycle execution
store.newCircuit();
store.addComponent('dc-source', 100, 100);
store.addComponent('resistor', 200, 100);
store.addComponent('gnd', 300, 100);

const vSrc = useCircuitStore.getState().components.find((c) => c.type === 'dc-source')!;
const rComp = useCircuitStore.getState().components.find((c) => c.type === 'resistor')!;
const gndComp = useCircuitStore.getState().components.find((c) => c.type === 'gnd')!;

store.startDrawingWire(vSrc.id, 'pos', { x: 100, y: 100 });
store.completeDrawingWire(rComp.id, 'p1');

store.startDrawingWire(rComp.id, 'p2', { x: 200, y: 100 });
store.completeDrawingWire(gndComp.id, 'gnd');

store.startDrawingWire(gndComp.id, 'gnd', { x: 300, y: 100 });
store.completeDrawingWire(vSrc.id, 'neg');

// Run simulation cycle
store.setSimulationStatus('running');
store.runSimulationCycle(50);

const simWires = useCircuitStore.getState().wires;
const carriesCurrent = simWires.some((w) => Math.abs(w.state?.current ?? 0) > 0.00001);
assert(carriesCurrent, 'Unified simulation cycle computes active closed-loop current (|I| > 0.01mA) on wires');

// Test Automated K-Map evaluation for combinational logic
const testComps20: CircuitComponent[] = [
  {
    id: 'MCU_T20',
    type: 'arduino-uno',
    label: 'MCU20',
    x: 0,
    y: 0,
    rotation: 0,
    mirrored: false,
    properties: {},
    state: {},
  },
  {
    id: 'U_AND',
    type: 'gate-and',
    label: 'U_AND',
    x: 100,
    y: 0,
    rotation: 0,
    mirrored: false,
    properties: {},
    state: {},
  },
  {
    id: 'LED_T20',
    type: 'led-red',
    label: 'LED20',
    x: 200,
    y: 0,
    rotation: 0,
    mirrored: false,
    properties: {},
    state: {},
  },
];
const testWires20: CircuitWire[] = [
  {
    id: 'w20_a',
    fromCompId: 'MCU_T20',
    fromPinId: 'd2',
    toCompId: 'U_AND',
    toPinId: 'in_a',
    waypoints: [],
    color: '#3b82f6',
  },
  {
    id: 'w20_b',
    fromCompId: 'MCU_T20',
    fromPinId: 'd3',
    toCompId: 'U_AND',
    toPinId: 'in_b',
    waypoints: [],
    color: '#3b82f6',
  },
  {
    id: 'w20_out',
    fromCompId: 'U_AND',
    fromPinId: 'out',
    toCompId: 'LED_T20',
    toPinId: 'anode',
    waypoints: [],
    color: '#10b981',
  },
  {
    id: 'w20_gnd',
    fromCompId: 'LED_T20',
    fromPinId: 'cathode',
    toCompId: 'MCU_T20',
    toPinId: 'gnd1',
    waypoints: [],
    color: '#000000',
  },
];

const autoTruthResult = evaluateAutomatedTruthTable(
  testComps20,
  testWires20,
  [
    { type: 'pin', compId: 'MCU_T20', pinId: 'd2', label: 'MCU20:D2' },
    { type: 'pin', compId: 'MCU_T20', pinId: 'd3', label: 'MCU20:D3' },
  ],
  { type: 'pin', compId: 'LED_T20', pinId: 'anode', label: 'LED20:anode' }
);

assert(autoTruthResult[0] === 0, 'evaluateAutomatedTruthTable: AND gate (0, 0) => 0');
assert(autoTruthResult[1] === 0, 'evaluateAutomatedTruthTable: AND gate (0, 1) => 0');
assert(autoTruthResult[2] === 0, 'evaluateAutomatedTruthTable: AND gate (1, 0) => 0');
assert(autoTruthResult[3] === 1, 'evaluateAutomatedTruthTable: AND gate (1, 1) => 1');

// -----------------------------------------------------------------
// TEST 21: HOTFIX 6.7 - TWO-MODE SYSTEM (LOGICAL vs ANALOG)
// -----------------------------------------------------------------
console.log('\nTEST 21: Hotfix 6.7 - Two-Mode System (LOGICAL vs ANALOG)');
store.setSimulationMode('LOGICAL');
assert(useCircuitStore.getState().simulationMode === 'LOGICAL', 'Simulation mode switches to LOGICAL');
// In LOGICAL mode, verify burnout hazards are disabled even when connecting 9V directly across an LED
store.newCircuit();
store.addComponent('dc-source', 0, 0);
store.addComponent('led-red', 100, 0);
const bat9V = useCircuitStore.getState().components.find(c => c.type === 'dc-source')!;
const ledOverload = useCircuitStore.getState().components.find(c => c.type === 'led-red')!;
store.addWire(bat9V.id, 'pos', ledOverload.id, 'anode');
store.addWire(ledOverload.id, 'cathode', bat9V.id, 'neg');
store.setSimulationStatus('running');
store.runSimulationCycle(0);

const logicalLedState = useCircuitStore.getState().components.find(c => c.id === ledOverload.id)!;
assert(!logicalLedState.state?.isBurned, 'In LOGICAL mode, burnout/fire hazards are strictly disabled');

// Switch to ANALOG mode -> SPICE solver runs and catches fire immediately due to 9V direct short across LED!
store.setSimulationMode('ANALOG');
store.runSimulationCycle(0);
const analogLedState = useCircuitStore.getState().components.find(c => c.id === ledOverload.id)!;
assert(analogLedState.state?.isBurned === true, 'In ANALOG mode, SPICE solver actively triggers thermal burnout/fire');

// -----------------------------------------------------------------
// TEST 22: HOTFIX 6.7 - AC VOLTAGE SOURCE MULTI-WAVEFORM EVALUATION
// -----------------------------------------------------------------
console.log('\nTEST 22: Hotfix 6.7 - AC Source Multi-Waveform Evaluation (Sine, Square, Triangle, Sawtooth)');
const acComps: CircuitComponent[] = [
  {
    id: 'AC_SRC',
    type: 'ac-source',
    label: 'AC1',
    x: 0,
    y: 0,
    rotation: 0,
    mirrored: false,
    properties: { waveform: 'sine', amplitude: 10, frequency: 100, offset: 0 },
    state: {},
  },
  {
    id: 'R_LOAD',
    type: 'resistor',
    label: 'R1',
    x: 100,
    y: 0,
    rotation: 0,
    mirrored: false,
    properties: { resistance: 1000 },
    state: {},
  },
];
const acWires: CircuitWire[] = [
  { id: 'w_ac_pos', fromCompId: 'AC_SRC', fromPinId: 'pos', toCompId: 'R_LOAD', toPinId: 'p1', waypoints: [], color: '#f59e0b' },
  { id: 'w_ac_neg', fromCompId: 'R_LOAD', fromPinId: 'p2', toCompId: 'AC_SRC', toPinId: 'neg', waypoints: [], color: '#000000' },
];

// 1. Sine wave evaluation
const sineRes = evaluateSpiceCircuit(acComps, acWires, 2.5); // at t = 2.5ms (1/4 cycle of 100Hz -> sin(pi/2) = 1)
const sineV = sineRes.componentResults.get('AC_SRC')?.pinVoltages['pos'] ?? 0;
assert(Math.abs(sineV - 10.0) < 0.2, `AC Source evaluates Sine peak voltage at quarter period (~10.0V, got: ${sineV.toFixed(2)}V)`);

// 2. Square wave evaluation
acComps[0].properties = { waveform: 'square', amplitude: 10, frequency: 100, dutyCycle: 50, offset: 0 };
const sqResHigh = evaluateSpiceCircuit(acComps, acWires, 2.5); // t = 2.5ms (< 50% duty cycle)
const sqResLow = evaluateSpiceCircuit(acComps, acWires, 7.5); // t = 7.5ms (> 50% duty cycle)
const sqVHigh = sqResHigh.componentResults.get('AC_SRC')?.pinVoltages['pos'] ?? 0;
const sqVLow = sqResLow.componentResults.get('AC_SRC')?.pinVoltages['pos'] ?? 0;
assert(Math.abs(sqVHigh - 10.0) < 0.2, `Square wave HIGH half is +10V (got: ${sqVHigh.toFixed(2)}V)`);
assert(Math.abs(sqVLow - (-10.0)) < 0.2, `Square wave LOW half is -10V (got: ${sqVLow.toFixed(2)}V)`);

// 3. Triangle wave evaluation
acComps[0].properties = { waveform: 'triangle', amplitude: 10, frequency: 100, offset: 0 };
const triRes = evaluateSpiceCircuit(acComps, acWires, 2.5); // quarter cycle peak
const triV = triRes.componentResults.get('AC_SRC')?.pinVoltages['pos'] ?? 0;
assert(Math.abs(triV - 10.0) < 0.2, `Triangle wave quarter cycle reaches +10V (got: ${triV.toFixed(2)}V)`);

// 4. Sawtooth wave evaluation
acComps[0].properties = { waveform: 'sawtooth', amplitude: 10, frequency: 100, offset: 0 };
const sawRes = evaluateSpiceCircuit(acComps, acWires, 0); // start of cycle ~ 0
const sawV = sawRes.componentResults.get('AC_SRC')?.pinVoltages['pos'] ?? 0;
assert(Math.abs(sawV) < 0.5, `Sawtooth wave at t=0 passes near 0V (got: ${sawV.toFixed(2)}V)`);

// -----------------------------------------------------------------
// TEST 23: HOTFIX 6.7 - OSCILLOSCOPE CALIBRATOR & PROBE TARGETING
// -----------------------------------------------------------------
console.log('\nTEST 23: Hotfix 6.7 - Oscilloscope Calibrator Reference Signals');
const calSqrV = getProbeVoltage({ type: 'pin', compId: '__CALIBRATOR__', pinId: 'CAL_1KHZ' }, [], []);
assert(calSqrV === 0.0 || calSqrV === 5.0, `Calibrator 1kHz Square outputs valid 0V or 5V reference level (got: ${calSqrV}V)`);

const calSineV = getProbeVoltage({ type: 'pin', compId: '__CALIBRATOR__', pinId: 'CAL_SINE' }, [], []);
assert(calSineV >= 0.0 && calSineV <= 5.0, `Calibrator 1kHz Sine outputs voltage bounded in [0V, 5V] (got: ${calSineV.toFixed(2)}V)`);

// -----------------------------------------------------------------
// TEST 24: UNIVERSAL ENGINE SCENARIO 1 - 6 NOT GATES IN SERIES
// Battery+ -> U1 -> U2 -> U3 -> U4 -> U5 -> U6 -> R1 -> LED1 -> Battery-
// -----------------------------------------------------------------
console.log('\nTEST 24: Universal Engine Scenario 1 - 6 NOT Gates in Series (LOGICAL & ANALOG)');

const buildNotChainCircuit = (numGates: number): { comps: CircuitComponent[]; wires: CircuitWire[] } => {
  const comps: CircuitComponent[] = [
    { id: 'BAT_CHAIN', type: 'battery-9v', label: 'BAT1', x: 0, y: 0, rotation: 0, mirrored: false, properties: { voltage: 9.0 }, state: {} },
  ];
  for (let i = 1; i <= numGates; i++) {
    comps.push({
      id: `U_${i}`,
      type: 'gate-not',
      label: `U${i}`,
      x: i * 80,
      y: 0,
      rotation: 0,
      mirrored: false,
      properties: {},
      state: {},
    });
  }
  comps.push(
    { id: 'R_CHAIN', type: 'resistor', label: 'R1', x: (numGates + 1) * 80, y: 0, rotation: 0, mirrored: false, properties: { resistance: 220 }, state: {} },
    { id: 'LED_CHAIN', type: 'led-red', label: 'LED1', x: (numGates + 2) * 80, y: 0, rotation: 0, mirrored: false, properties: {}, state: {} }
  );

  const wires: CircuitWire[] = [
    { id: 'w_bat_u1', fromCompId: 'BAT_CHAIN', fromPinId: 'pos', toCompId: 'U_1', toPinId: 'in', waypoints: [], color: '#ef4444' },
  ];
  for (let i = 1; i < numGates; i++) {
    wires.push({
      id: `w_u${i}_u${i + 1}`,
      fromCompId: `U_${i}`,
      fromPinId: 'out',
      toCompId: `U_${i + 1}`,
      toPinId: 'in',
      waypoints: [],
      color: '#3b82f6',
    });
  }
  wires.push(
    { id: `w_u${numGates}_r1`, fromCompId: `U_${numGates}`, fromPinId: 'out', toCompId: 'R_CHAIN', toPinId: 'p1', waypoints: [], color: '#3b82f6' },
    { id: 'w_r1_led', fromCompId: 'R_CHAIN', fromPinId: 'p2', toCompId: 'LED_CHAIN', toPinId: 'anode', waypoints: [], color: '#22c55e' },
    { id: 'w_led_bat', fromCompId: 'LED_CHAIN', fromPinId: 'cathode', toCompId: 'BAT_CHAIN', toPinId: 'neg', waypoints: [], color: '#000000' }
  );

  return { comps, wires };
};

const { comps: chain6Comps, wires: chain6Wires } = buildNotChainCircuit(6);

// 24A: LOGICAL Mode evaluation for 6 NOT Gates
const log6Res = evaluateLogicalCircuit(chain6Comps, chain6Wires, 0);
const hasAnyXContention = Array.from(log6Res.wireStates.values()).some((v) => v === 'X');
assert(!hasAnyXContention, 'LOGICAL 6-Gate Chain: Zero "X" bus contention errors across all wires');
assert(log6Res.componentStates.get('U_1')?.logicOutput === 0, 'LOGICAL 6-Gate Chain: U1 outputs 0');
assert(log6Res.componentStates.get('U_2')?.logicOutput === 1, 'LOGICAL 6-Gate Chain: U2 outputs 1');
assert(log6Res.componentStates.get('U_3')?.logicOutput === 0, 'LOGICAL 6-Gate Chain: U3 outputs 0 (no false contention after 3rd gate)');
assert(log6Res.componentStates.get('U_4')?.logicOutput === 1, 'LOGICAL 6-Gate Chain: U4 outputs 1');
assert(log6Res.componentStates.get('U_5')?.logicOutput === 0, 'LOGICAL 6-Gate Chain: U5 outputs 0');
assert(log6Res.componentStates.get('U_6')?.logicOutput === 1, 'LOGICAL 6-Gate Chain: U6 outputs 1');
assert(log6Res.componentStates.get('LED_CHAIN')?.lit === true, 'LOGICAL 6-Gate Chain: Final LED1 lights up brightly (lit === true)');
// Hotfix 6.9: Verify strict alternating HIGH (1) Blue Flow vs LOW (0) Static wires across the 6 inverters
assert(log6Res.activeFlowWires?.has('w_bat_u1') === true, 'LOGICAL 6-Gate Chain: Wire 1 (Bat+ -> U1, logic 1) shows Blue Flow');
assert(log6Res.activeFlowWires?.has('w_u1_u2') === false, 'LOGICAL 6-Gate Chain: Wire 2 (U1 -> U2, logic 0) is Static (Blue Flow OFF)');
assert(log6Res.activeFlowWires?.has('w_u2_u3') === true, 'LOGICAL 6-Gate Chain: Wire 3 (U2 -> U3, logic 1) shows Blue Flow');
assert(log6Res.activeFlowWires?.has('w_u3_u4') === false, 'LOGICAL 6-Gate Chain: Wire 4 (U3 -> U4, logic 0) is Static (Blue Flow OFF)');
assert(log6Res.activeFlowWires?.has('w_u4_u5') === true, 'LOGICAL 6-Gate Chain: Wire 5 (U4 -> U5, logic 1) shows Blue Flow');
assert(log6Res.activeFlowWires?.has('w_u5_u6') === false, 'LOGICAL 6-Gate Chain: Wire 6 (U5 -> U6, logic 0) is Static (Blue Flow OFF)');
assert(log6Res.activeFlowWires?.has('w_u6_r1') === true, 'LOGICAL 6-Gate Chain: Wire 7 (U6 -> R1, logic 1) shows Blue Flow');
assert(log6Res.activeFlowWires?.has('w_r1_led') === true, 'LOGICAL 6-Gate Chain: Wire 8 (R1 -> LED1, logic 1) shows Blue Flow');
assert(log6Res.activeFlowWires?.has('w_led_bat') === false, 'LOGICAL 6-Gate Chain: Wire 9 (LED1 -> Bat-, logic 0) is Static (Blue Flow OFF)');

// 24B: ANALOG Mode evaluation for 6 NOT Gates
const spice6Res = evaluateSpiceCircuit(chain6Comps, chain6Wires, 0);
assert(spice6Res.componentResults.get('U_1')?.logicOutput === 0, 'ANALOG 6-Gate Chain: U1 outputs 0 (0V)');
assert(spice6Res.componentResults.get('U_2')?.logicOutput === 1, 'ANALOG 6-Gate Chain: U2 outputs 1 (5V)');
assert(spice6Res.componentResults.get('U_3')?.logicOutput === 0, 'ANALOG 6-Gate Chain: U3 outputs 0 (0V)');
assert(spice6Res.componentResults.get('U_4')?.logicOutput === 1, 'ANALOG 6-Gate Chain: U4 outputs 1 (5V)');
assert(spice6Res.componentResults.get('U_5')?.logicOutput === 0, 'ANALOG 6-Gate Chain: U5 outputs 0 (0V)');
assert(spice6Res.componentResults.get('U_6')?.logicOutput === 1, 'ANALOG 6-Gate Chain: U6 outputs 1 (~5V)');
assert((spice6Res.componentResults.get('LED_CHAIN')?.brightness ?? 0) > 0.4, 'ANALOG 6-Gate Chain: Final LED1 lights up brightly');
assert(
  chain6Wires.every((w) => (spice6Res.wireCurrents.get(w.id) ?? 0) > 0.005),
  `ANALOG 6-Gate Chain: Every wire from Battery+ through U1..U6, R1, LED1 to Battery- carries active current (> 5mA)`
);

// -----------------------------------------------------------------
// TEST 25: UNIVERSAL ENGINE SCENARIO 2 - 5 NOT GATES IN SERIES
// Battery+ -> U1 -> U2 -> U3 -> U4 -> U5 -> R1 -> LED1 -> Battery-
// -----------------------------------------------------------------
console.log('\nTEST 25: Universal Engine Scenario 2 - 5 NOT Gates in Series (LOGICAL & ANALOG)');
const { comps: chain5Comps, wires: chain5Wires } = buildNotChainCircuit(5);

const log5Res = evaluateLogicalCircuit(chain5Comps, chain5Wires, 0);
assert(log5Res.componentStates.get('U_5')?.logicOutput === 0, 'LOGICAL 5-Gate Chain: 5th inverter U5 outputs 0 (LOW)');
assert(log5Res.componentStates.get('LED_CHAIN')?.lit === false, 'LOGICAL 5-Gate Chain: LED1 stays OFF (lit === false)');

const spice5Res = evaluateSpiceCircuit(chain5Comps, chain5Wires, 0);
assert(spice5Res.componentResults.get('U_5')?.logicOutput === 0, 'ANALOG 5-Gate Chain: 5th inverter U5 outputs 0 (0V)');
assert((spice5Res.componentResults.get('LED_CHAIN')?.brightness ?? 0) === 0, 'ANALOG 5-Gate Chain: LED1 stays OFF (brightness === 0)');
assert((spice5Res.componentResults.get('LED_CHAIN')?.currentA ?? 0) === 0, 'ANALOG 5-Gate Chain: LED1 current is 0A');

// -----------------------------------------------------------------
// TEST 26: UNIVERSAL ENGINE SCENARIO 3 - DELETING ANY GATE (1..6) IN 6-GATE CHAIN
// -----------------------------------------------------------------
console.log('\nTEST 26: Universal Engine Scenario 3 - Deleting Any Gate (1st..6th) in 6-Gate Chain');

for (let delIdx = 1; delIdx <= 6; delIdx++) {
  const delId = `U_${delIdx}`;

  // Test in Store with LOGICAL mode
  const fresh6Log = buildNotChainCircuit(6);
  useCircuitStore.setState({
    components: fresh6Log.comps,
    wires: fresh6Log.wires,
    simulationMode: 'LOGICAL',
    simulationStatus: 'running',
  });
  store.runSimulationCycle(0);
  store.removeComponent(delId);

  const afterLogComps = useCircuitStore.getState().components;
  const afterLogWires = useCircuitStore.getState().wires;
  const ledAfterLog = afterLogComps.find((c) => c.id === 'LED_CHAIN')!;
  assert(
    ledAfterLog.state?.lit === false,
    `LOGICAL Mode (Delete U${delIdx}): LED1 immediately turns OFF (lit === ${ledAfterLog.state?.lit})`
  );

  // Check all remaining downstream gates (U_{delIdx+1}..U_6) output 'Z' (NEVER 1!)
  for (let d = delIdx + 1; d <= 6; d++) {
    const downGate = afterLogComps.find((c) => c.id === `U_${d}`)!;
    assert(
      downGate.state?.logicOutput === 'Z',
      `LOGICAL Mode (Delete U${delIdx}): Downstream gate U${d} outputs 'Z' (got: ${downGate.state?.logicOutput})`
    );
  }
  const rWireLog = afterLogWires.find((w) => w.id === 'w_r1_led');
  assert(
    (rWireLog?.state?.current ?? 0) === 0 && rWireLog?.state?.logicLevel !== 1,
    `LOGICAL Mode (Delete U${delIdx}): Downstream LED wire stops animating (logicLevel=${rWireLog?.state?.logicLevel}, current=${rWireLog?.state?.current})`
  );

  // Test in Store with ANALOG mode
  const fresh6Analog = buildNotChainCircuit(6);
  useCircuitStore.setState({
    components: fresh6Analog.comps,
    wires: fresh6Analog.wires,
    simulationMode: 'ANALOG',
    simulationStatus: 'running',
  });
  store.runSimulationCycle(0);
  store.removeComponent(delId);

  const afterAnalogComps = useCircuitStore.getState().components;
  const afterAnalogWires = useCircuitStore.getState().wires;
  const ledAfterAnalog = afterAnalogComps.find((c) => c.id === 'LED_CHAIN')!;
  assert(
    ledAfterAnalog.state?.lit === false && (ledAfterAnalog.state?.brightness ?? 0) === 0,
    `ANALOG Mode (Delete U${delIdx}): LED1 immediately turns OFF (lit=${ledAfterAnalog.state?.lit}, brightness=${ledAfterAnalog.state?.brightness})`
  );

  for (let d = delIdx + 1; d <= 6; d++) {
    const downGate = afterAnalogComps.find((c) => c.id === `U_${d}`)!;
    assert(
      downGate.state?.logicOutput === 'Z' && downGate.state?.outputVoltage === undefined,
      `ANALOG Mode (Delete U${delIdx}): Downstream gate U${d} is High-Z inactive (logicOutput=${downGate.state?.logicOutput}, outputVoltage=${downGate.state?.outputVoltage})`
    );
  }
  const rWireAnalog = afterAnalogWires.find((w) => w.id === 'w_r1_led');
  assert(
    (rWireAnalog?.state?.current ?? 0) === 0,
    `ANALOG Mode (Delete U${delIdx}): Downstream current drops to 0mA (got: ${rWireAnalog?.state?.current}A)`
  );
}

// -----------------------------------------------------------------
// TEST 27: UNIVERSAL ENGINE SCENARIO 4 - SERIES LEDs & RESISTORS
// Source -> Gate -> R1 -> LED1 -> LED2 -> GND
// -----------------------------------------------------------------
console.log('\nTEST 27: Universal Engine Scenario 4 - Series LEDs & Resistors (Source -> Gate -> R1 -> LED1 -> LED2 -> GND)');

const seriesLedComps: CircuitComponent[] = [
  { id: 'SRC_SER', type: 'dc-source', label: 'V1', x: 0, y: 0, rotation: 0, mirrored: false, properties: { voltage: 5.0 }, state: {} },
  { id: 'GATE_SER', type: 'gate-buffer', label: 'U1', x: 80, y: 0, rotation: 0, mirrored: false, properties: {}, state: {} },
  { id: 'R_SER', type: 'resistor', label: 'R1', x: 160, y: 0, rotation: 0, mirrored: false, properties: { resistance: 100 }, state: {} },
  { id: 'LED_SER1', type: 'led-red', label: 'LED1', x: 240, y: 0, rotation: 0, mirrored: false, properties: {}, state: {} },
  { id: 'LED_SER2', type: 'led-red', label: 'LED2', x: 320, y: 0, rotation: 0, mirrored: false, properties: {}, state: {} },
  { id: 'GND_SER', type: 'gnd', label: 'GND1', x: 400, y: 0, rotation: 0, mirrored: false, properties: {}, state: {} },
];

const seriesLedWires: CircuitWire[] = [
  { id: 'ws_gnd0', fromCompId: 'SRC_SER', fromPinId: 'neg', toCompId: 'GND_SER', toPinId: 'gnd', waypoints: [], color: '#000000' },
  { id: 'ws_1', fromCompId: 'SRC_SER', fromPinId: 'pos', toCompId: 'GATE_SER', toPinId: 'in', waypoints: [], color: '#ef4444' },
  { id: 'ws_2', fromCompId: 'GATE_SER', fromPinId: 'out', toCompId: 'R_SER', toPinId: 'p1', waypoints: [], color: '#3b82f6' },
  { id: 'ws_3', fromCompId: 'R_SER', fromPinId: 'p2', toCompId: 'LED_SER1', toPinId: 'anode', waypoints: [], color: '#3b82f6' },
  { id: 'ws_4', fromCompId: 'LED_SER1', fromPinId: 'cathode', toCompId: 'LED_SER2', toPinId: 'anode', waypoints: [], color: '#22c55e' },
  { id: 'ws_5', fromCompId: 'LED_SER2', fromPinId: 'cathode', toCompId: 'GND_SER', toPinId: 'gnd', waypoints: [], color: '#000000' },
];

// 27A: LOGICAL Mode Series LEDs
const logSeriesRes = evaluateLogicalCircuit(seriesLedComps, seriesLedWires, 0);
assert(logSeriesRes.componentStates.get('LED_SER1')?.lit === true, 'LOGICAL Series LEDs: LED1 is lit');
assert(logSeriesRes.componentStates.get('LED_SER2')?.lit === true, 'LOGICAL Series LEDs: LED2 is lit');
assert(
  ['ws_1', 'ws_2', 'ws_3', 'ws_4'].every((wid) => logSeriesRes.activeFlowWires?.has(wid)) &&
    !logSeriesRes.activeFlowWires?.has('ws_5'),
  'LOGICAL Series LEDs: HIGH (1) wires ws_1..ws_4 show Blue Flow and GND (0) wire ws_5 is Static'
);

// 27B: ANALOG Mode Series LEDs
const spiceSeriesRes = evaluateSpiceCircuit(seriesLedComps, seriesLedWires, 0);
const sLed1 = spiceSeriesRes.componentResults.get('LED_SER1');
const sLed2 = spiceSeriesRes.componentResults.get('LED_SER2');
assert((sLed1?.currentA ?? 0) > 0.003 && (sLed1?.brightness ?? 0) > 0.15, `ANALOG Series LEDs: LED1 conducts and lights up (I=${((sLed1?.currentA ?? 0) * 1000).toFixed(2)}mA)`);
assert((sLed2?.currentA ?? 0) > 0.003 && (sLed2?.brightness ?? 0) > 0.15, `ANALOG Series LEDs: LED2 conducts and lights up (I=${((sLed2?.currentA ?? 0) * 1000).toFixed(2)}mA)`);
assert(
  ['ws_1', 'ws_2', 'ws_3', 'ws_4', 'ws_5'].every((wid) => (spiceSeriesRes.wireCurrents.get(wid) ?? 0) > 0.003),
  'ANALOG Series LEDs: Electricity flow animates across all wires from Source through Gate, R1, LED1, LED2 to GND'
);

// -----------------------------------------------------------------
// TEST 28: HOTFIX 6.9 - ACTIVE-LOW SINKING, 9V->5V GATE DIFFERENTIAL LOAD & MCU ALTERNATING FLOW
// -----------------------------------------------------------------
console.log('\nTEST 28: Hotfix 6.9 - Active-Low Sinking, 9V->5V Gate Differential Load (LED5) & MCU Alternating Flow');

// 28A: Active-Low Current Sinking (VCC 5V -> R1 -> LED_SINK -> NOT Gate Output = 0)
const sinkComps: CircuitComponent[] = [
  { id: 'V_5V', type: 'vcc', label: 'VCC1', x: 0, y: 0, rotation: 0, mirrored: false, properties: { voltage: 5.0 }, state: {} },
  { id: 'U_SINK', type: 'gate-not', label: 'U1', x: 80, y: 0, rotation: 0, mirrored: false, properties: {}, state: {} },
  { id: 'R_SINK', type: 'resistor', label: 'R1', x: 160, y: 0, rotation: 0, mirrored: false, properties: { resistance: 220 }, state: {} },
  { id: 'LED_SINK', type: 'led-red', label: 'LED1', x: 240, y: 0, rotation: 0, mirrored: false, properties: {}, state: {} },
];
const sinkWires: CircuitWire[] = [
  // Drive U_SINK input with 1 -> U_SINK outputs 0 (LOW)
  { id: 'w_v_in', fromCompId: 'V_5V', fromPinId: 'vcc', toCompId: 'U_SINK', toPinId: 'in', waypoints: [], color: '#ef4444' },
  // Wire V_5V -> R_SINK -> LED_SINK (Anode), and LED_SINK (Cathode) -> U_SINK.out (0)
  { id: 'w_v_r', fromCompId: 'V_5V', fromPinId: 'vcc', toCompId: 'R_SINK', toPinId: 'p1', waypoints: [], color: '#ef4444' },
  { id: 'w_r_led', fromCompId: 'R_SINK', fromPinId: 'p2', toCompId: 'LED_SINK', toPinId: 'anode', waypoints: [], color: '#ef4444' },
  { id: 'w_led_uout', fromCompId: 'LED_SINK', fromPinId: 'cathode', toCompId: 'U_SINK', toPinId: 'out', waypoints: [], color: '#3b82f6' },
];
const sinkLogRes = evaluateLogicalCircuit(sinkComps, sinkWires, 0);
assert(sinkLogRes.componentStates.get('U_SINK')?.logicOutput === 0, 'Active-Low Sink: NOT gate outputs 0 (LOW)');
assert(sinkLogRes.componentStates.get('LED_SINK')?.lit === true, 'Active-Low Sink: LED lights up when Cathode sinks into LOW (0) gate output');
assert(sinkLogRes.activeFlowWires?.has('w_r_led') === true, 'Active-Low Sink: Anode HIGH (1) wire shows Blue Flow');
assert(sinkLogRes.activeFlowWires?.has('w_led_uout') === false, 'Active-Low Sink: Cathode LOW (0) wire to gate output is Static');

// 28B: Higher-Voltage Source Sinking into Lower-Voltage Gate HIGH Output (9V Battery+ -> LED5 -> 5V Gate Output = 1)
const diffComps: CircuitComponent[] = [
  { id: 'BAT_9V', type: 'battery-9v', label: 'BAT1', x: 0, y: 0, rotation: 0, mirrored: false, properties: { voltage: 9.0 }, state: {} },
  { id: 'U_INV1', type: 'gate-not', label: 'U1', x: 80, y: 0, rotation: 0, mirrored: false, properties: {}, state: {} },
  { id: 'U_INV2', type: 'gate-not', label: 'U2', x: 160, y: 0, rotation: 0, mirrored: false, properties: {}, state: {} },
  { id: 'LED_5', type: 'led-red', label: 'LED5', x: 240, y: 0, rotation: 0, mirrored: false, properties: {}, state: {} },
];
const diffWires: CircuitWire[] = [
  // BAT_9V (+) -> U_INV1 (0) -> U_INV2 (1, 5V)
  { id: 'wd_1', fromCompId: 'BAT_9V', fromPinId: 'pos', toCompId: 'U_INV1', toPinId: 'in', waypoints: [], color: '#ef4444' },
  { id: 'wd_2', fromCompId: 'U_INV1', fromPinId: 'out', toCompId: 'U_INV2', toPinId: 'in', waypoints: [], color: '#3b82f6' },
  // BAT_9V (+) -> LED5 Anode, LED5 Cathode -> U_INV2.out (5V HIGH) => 9V - 5V = 4V >= 2.0V
  { id: 'wd_anode', fromCompId: 'BAT_9V', fromPinId: 'pos', toCompId: 'LED_5', toPinId: 'anode', waypoints: [], color: '#ef4444' },
  { id: 'wd_cathode', fromCompId: 'LED_5', fromPinId: 'cathode', toCompId: 'U_INV2', toPinId: 'out', waypoints: [], color: '#3b82f6' },
];
const diffLogRes = evaluateLogicalCircuit(diffComps, diffWires, 0);
assert(diffLogRes.componentStates.get('U_INV2')?.logicOutput === 1, '9V->5V Differential: U_INV2 outputs 1 (5V)');
assert(
  diffLogRes.componentStates.get('LED_5')?.lit === true,
  '9V->5V Differential: LED5 lights up in LOGICAL mode when driven by 9V Anode into 5V HIGH Gate Output (9V - 5V = 4V >= 2V)'
);

// 28C: Arduino Pin 13 & Pin 12 Alternating Wire Flow in LOGICAL Mode
const rMcuLoad: CircuitComponent = {
  id: 'R1',
  type: 'resistor',
  label: 'R1',
  x: 100,
  y: 0,
  rotation: 0,
  mirrored: false,
  properties: { resistance: 220 },
  state: {},
};

// At t=200ms: d13 is LOW (0), d12 is HIGH (1)
unoComp.state = {
  pins: {
    d13: { mode: 'OUTPUT', digitalValue: 0, analogValue: 0, voltage: 0.0 },
    d12: { mode: 'OUTPUT', digitalValue: 1, analogValue: 0, voltage: 5.0 },
  },
};
const mcuAltRes200 = evaluateLogicalCircuit([unoComp, rMcuLoad], unoWires, 200);
assert(
  mcuAltRes200.wireStates.get('w_d13') === 0 && !mcuAltRes200.activeFlowWires?.has('w_d13'),
  'MCU Alternating Flow (t=200ms): Pin 13 (LOW) wire is 0 and Static (NO Blue Flow)'
);
assert(
  mcuAltRes200.wireStates.get('w_d12') === 1 && mcuAltRes200.activeFlowWires?.has('w_d12') === true,
  'MCU Alternating Flow (t=200ms): Pin 12 (HIGH) wire is 1 and shows Blue Flow'
);

// At t=400ms: d13 is HIGH (1), d12 is LOW (0)
unoComp.state = {
  pins: {
    d13: { mode: 'OUTPUT', digitalValue: 1, analogValue: 0, voltage: 5.0 },
    d12: { mode: 'OUTPUT', digitalValue: 0, analogValue: 0, voltage: 0.0 },
  },
};
const mcuAltRes400 = evaluateLogicalCircuit([unoComp, rMcuLoad], unoWires, 400);
assert(
  mcuAltRes400.wireStates.get('w_d13') === 1 && mcuAltRes400.activeFlowWires?.has('w_d13') === true,
  'MCU Alternating Flow (t=400ms): Pin 13 (HIGH) wire is 1 and shows Blue Flow'
);
assert(
  mcuAltRes400.wireStates.get('w_d12') === 0 && !mcuAltRes400.activeFlowWires?.has('w_d12'),
  'MCU Alternating Flow (t=400ms): Pin 12 (LOW) wire is 0 and Static (NO Blue Flow)'
);

// -----------------------------------------------------------------
// TEST 29: PHASE 7.1 COMPONENT EXPANSION PACK (12 NEW COMPONENTS)
// -----------------------------------------------------------------
import { AsmRuntime } from './simulation/mcu/asmRuntime';

console.log('\nTEST 29: Phase 7.1 - 12 New Components, 20px Grid Pin Alignment, Assembly CPU, Motors, Sensors, Displays & DC-DC');

const phase7Ids = [
  'builtin_humidity_sensor',
  'builtin_dc_motor',
  'builtin_servo_motor',
  'builtin_motion_sensor',
  'builtin_gas_sensor',
  'builtin_accelerometer',
  'builtin_cpu_8bit',
  'builtin_oled_display',
  'builtin_lcd_16x2',
  'builtin_sd_card',
  'builtin_dcdc_converter',
  'builtin_numpad',
];

for (const id of phase7Ids) {
  const def = ComponentRegistry.get(id);
  assert(!!def, `Phase 7.1 Registry: ${id} is registered`);
  const allPinsGrid = def?.pins.every((p) => p.x % 20 === 0 && p.y % 20 === 0) ?? false;
  assert(allPinsGrid, `Phase 7.1 Grid Rule: All ${def?.pins.length} pins of ${id} sit on exact 20px multiples`);
}

// 29A: DC Brushed Motor Bidirectional Rotation (CW vs CCW) in LOGICAL & ANALOG Modes
const dcCompsCW: CircuitComponent[] = [
  { id: 'V_DC', type: 'battery-9v', label: 'V1', x: 0, y: 0, rotation: 0, mirrored: false, properties: { voltage: 9.0 }, state: {} },
  { id: 'M1', type: 'builtin_dc_motor', label: 'MOT1', x: 100, y: 0, rotation: 0, mirrored: false, properties: { nominalVoltage: 9.0, maxRpm: 3000 }, state: {} },
];
const dcWiresCW: CircuitWire[] = [
  { id: 'wm1', fromCompId: 'V_DC', fromPinId: 'pos', toCompId: 'M1', toPinId: 'm_plus', waypoints: [], color: '#ef4444' },
  { id: 'wm2', fromCompId: 'V_DC', fromPinId: 'neg', toCompId: 'M1', toPinId: 'm_minus', waypoints: [], color: '#3b82f6' },
];
const dcLogCW = evaluateLogicalCircuit(dcCompsCW, dcWiresCW, 0);
assert(dcLogCW.componentStates.get('M1')?.direction === 'CW' && dcLogCW.componentStates.get('M1')?.isRunning === true, 'DC Motor (LOGICAL): Forward polarity (M+ = 1, M- = 0) spins CW ↻');

const dcAnaCW = evaluateSpiceCircuit(dcCompsCW, dcWiresCW, 0);
assert(dcAnaCW.componentResults.get('M1')?.direction === 'CW' && (dcAnaCW.componentResults.get('M1')?.rpm ?? 0) > 2500, 'DC Motor (ANALOG): Forward 9V spins CW at ~4500 RPM');

// Reverse polarity (M+ -> GND, M- -> +9V) => CCW!
const dcWiresCCW: CircuitWire[] = [
  { id: 'wm3', fromCompId: 'V_DC', fromPinId: 'pos', toCompId: 'M1', toPinId: 'm_minus', waypoints: [], color: '#ef4444' },
  { id: 'wm4', fromCompId: 'V_DC', fromPinId: 'neg', toCompId: 'M1', toPinId: 'm_plus', waypoints: [], color: '#3b82f6' },
];
const dcLogCCW = evaluateLogicalCircuit(dcCompsCW, dcWiresCCW, 0);
assert(dcLogCCW.componentStates.get('M1')?.direction === 'CCW' && dcLogCCW.componentStates.get('M1')?.isRunning === true, 'DC Motor (LOGICAL): Reverse polarity (M+ = 0, M- = 1) spins CCW ↺');

const dcAnaCCW = evaluateSpiceCircuit(dcCompsCW, dcWiresCCW, 0);
assert(dcAnaCCW.componentResults.get('M1')?.direction === 'CCW' && (dcAnaCCW.componentResults.get('M1')?.rpm ?? 0) > 2500, 'DC Motor (ANALOG): Reverse 9V spins CCW ↺ at ~4500 RPM');

// 29B: Servo Motor (SG90) Control in LOGICAL & ANALOG Modes
const servoComps: CircuitComponent[] = [
  { id: 'V_SRV', type: 'vcc', label: 'VCC1', x: 0, y: 0, rotation: 0, mirrored: false, properties: { voltage: 5.0 }, state: {} },
  { id: 'G_SRV', type: 'gnd', label: 'GND1', x: 0, y: 80, rotation: 0, mirrored: false, properties: {}, state: {} },
  { id: 'SRV1', type: 'builtin_servo_motor', label: 'SRV1', x: 100, y: 0, rotation: 0, mirrored: false, properties: { targetAngle: 135, restAngle: 0 }, state: {} },
];
const servoWires: CircuitWire[] = [
  { id: 'ws1', fromCompId: 'V_SRV', fromPinId: 'vcc', toCompId: 'SRV1', toPinId: 'vcc', waypoints: [], color: '#ef4444' },
  { id: 'ws2', fromCompId: 'G_SRV', fromPinId: 'gnd', toCompId: 'SRV1', toPinId: 'gnd', waypoints: [], color: '#3b82f6' },
  { id: 'ws3', fromCompId: 'V_SRV', fromPinId: 'vcc', toCompId: 'SRV1', toPinId: 'sig', waypoints: [], color: '#f59e0b' },
];
const srvLog = evaluateLogicalCircuit(servoComps, servoWires, 0);
assert(srvLog.componentStates.get('SRV1')?.servoAngle === 135, 'Servo Motor (LOGICAL): SIG = HIGH rotates horn to targetAngle (135°)');
const srvAna = evaluateSpiceCircuit(servoComps, servoWires, 0);
assert(srvAna.componentResults.get('SRV1')?.servoAngle === 180, 'Servo Motor (ANALOG): 5.0V on SIG rotates horn to 180°');

// 29C: Step-Up / Step-Down DC-DC Converter (Buck 12V -> 5.0V & Boost 5V -> 12.0V)
const dcdcBuckComps: CircuitComponent[] = [
  { id: 'V_12V', type: 'power-supply', label: 'V1', x: 0, y: 0, rotation: 0, mirrored: false, properties: { voltage: 12.0 }, state: {} },
  { id: 'U_BUCK', type: 'builtin_dcdc_converter', label: 'REG1', x: 120, y: 0, rotation: 0, mirrored: false, properties: { mode: 'buck', targetVoltage: 5.0 }, state: {} },
  { id: 'R_LOAD', type: 'resistor', label: 'R1', x: 240, y: 0, rotation: 0, mirrored: false, properties: { resistance: 1000 }, state: {} },
];
const dcdcBuckWires: CircuitWire[] = [
  { id: 'wb1', fromCompId: 'V_12V', fromPinId: 'pos', toCompId: 'U_BUCK', toPinId: 'vin_plus', waypoints: [], color: '#ef4444' },
  { id: 'wb2', fromCompId: 'V_12V', fromPinId: 'neg', toCompId: 'U_BUCK', toPinId: 'vin_minus', waypoints: [], color: '#3b82f6' },
  { id: 'wb3', fromCompId: 'U_BUCK', fromPinId: 'vout_plus', toCompId: 'R_LOAD', toPinId: 'p1', waypoints: [], color: '#f59e0b' },
  { id: 'wb4', fromCompId: 'U_BUCK', fromPinId: 'vout_minus', toCompId: 'R_LOAD', toPinId: 'p2', waypoints: [], color: '#3b82f6' },
];
const buckAna = evaluateSpiceCircuit(dcdcBuckComps, dcdcBuckWires, 0);
assert(Math.abs((buckAna.componentResults.get('U_BUCK')?.outputVoltage ?? 0) - 5.0) < 0.05, 'DC-DC Buck Converter (ANALOG): Steps down 12.0V input to regulated 5.00V output');

// Step-Up Boost: 5.0V input -> 12.0V output
dcdcBuckComps[0].properties.voltage = 5.0;
dcdcBuckComps[1].properties = { mode: 'boost', targetVoltage: 12.0 };
const boostAna = evaluateSpiceCircuit(dcdcBuckComps, dcdcBuckWires, 0);
assert(Math.abs((boostAna.componentResults.get('U_BUCK')?.outputVoltage ?? 0) - 12.0) < 0.05, 'DC-DC Boost Converter (ANALOG): Steps up 5.0V input to regulated 12.00V output');

// 29D: 4x4 Matrix Membrane Numpad Row-to-Column Shorting & Digital Output
const numpadComps: CircuitComponent[] = [
  { id: 'V_NP', type: 'vcc', label: 'VCC1', x: 0, y: 0, rotation: 0, mirrored: false, properties: { voltage: 5.0 }, state: {} },
  { id: 'G_NP', type: 'gnd', label: 'GND1', x: 0, y: 80, rotation: 0, mirrored: false, properties: {}, state: {} },
  { id: 'KP1', type: 'builtin_numpad', label: 'KP1', x: 120, y: 0, rotation: 0, mirrored: false, properties: { activeKey: '5', pressedKey: '5' }, state: {} },
  { id: 'R_KP', type: 'resistor', label: 'R1', x: 240, y: 0, rotation: 0, mirrored: false, properties: { resistance: 1000 }, state: {} },
];
// Key '5' is Row 2 (r2), Col 2 (c2). Wire VCC -> r2, and c2 -> R_KP -> GND
const numpadWires: CircuitWire[] = [
  { id: 'wnp1', fromCompId: 'V_NP', fromPinId: 'vcc', toCompId: 'KP1', toPinId: 'vcc', waypoints: [], color: '#ef4444' },
  { id: 'wnp2', fromCompId: 'G_NP', fromPinId: 'gnd', toCompId: 'KP1', toPinId: 'gnd', waypoints: [], color: '#3b82f6' },
  { id: 'wnp3', fromCompId: 'V_NP', fromPinId: 'vcc', toCompId: 'KP1', toPinId: 'r2', waypoints: [], color: '#ef4444' },
  { id: 'wnp4', fromCompId: 'KP1', fromPinId: 'c2', toCompId: 'R_KP', toPinId: 'p1', waypoints: [], color: '#10b981' },
  { id: 'wnp5', fromCompId: 'R_KP', fromPinId: 'p2', toCompId: 'G_NP', toPinId: 'gnd', waypoints: [], color: '#3b82f6' },
];
const npLog = evaluateLogicalCircuit(numpadComps, numpadWires, 0);
assert(npLog.pinStates.get('KP1:c2') === 1, "Numpad (LOGICAL): Pressing '5' shorts Row 2 (r2) to Column 2 (c2) and passes HIGH (1)");
assert(npLog.pinStates.get('KP1:out') === 1, "Numpad (LOGICAL): Pressing '5' sets OUT pin HIGH (1)");
const npAna = evaluateSpiceCircuit(numpadComps, numpadWires, 0);
assert((npAna.componentResults.get('R_KP')?.pinVoltages?.['p1'] ?? 0) > 4.9, "Numpad (ANALOG): Pressing '5' conducts 5V from Row 2 (r2) to Column 2 (c2)");

// 29E: New Sensors (Humidity DHT22, PIR Motion HC-SR501, Gas MQ-2, 3-Axis Accelerometer ADXL335)
const sensorComps: CircuitComponent[] = [
  { id: 'V_SNS', type: 'vcc', label: 'VCC1', x: 0, y: 0, rotation: 0, mirrored: false, properties: { voltage: 5.0 }, state: {} },
  { id: 'G_SNS', type: 'gnd', label: 'GND1', x: 0, y: 80, rotation: 0, mirrored: false, properties: {}, state: {} },
  { id: 'HUM1', type: 'builtin_humidity_sensor', label: 'HUM1', x: 100, y: 0, rotation: 0, mirrored: false, properties: { humidity: 80, threshold: 60 }, state: {} },
  { id: 'PIR1', type: 'builtin_motion_sensor', label: 'PIR1', x: 200, y: 0, rotation: 0, mirrored: false, properties: { motionDetected: true }, state: {} },
  { id: 'GAS1', type: 'builtin_gas_sensor', label: 'GAS1', x: 300, y: 0, rotation: 0, mirrored: false, properties: { ppm: 1000, threshold: 400 }, state: {} },
  { id: 'ACC1', type: 'builtin_accelerometer', label: 'ACC1', x: 400, y: 0, rotation: 0, mirrored: false, properties: { accelX: 1.0, accelY: 0.0, accelZ: -1.0 }, state: {} },
];
const sensorWires: CircuitWire[] = [
  { id: 'ws_h1', fromCompId: 'V_SNS', fromPinId: 'vcc', toCompId: 'HUM1', toPinId: 'vcc', waypoints: [], color: '#ef4444' },
  { id: 'ws_h2', fromCompId: 'G_SNS', fromPinId: 'gnd', toCompId: 'HUM1', toPinId: 'gnd', waypoints: [], color: '#3b82f6' },
  { id: 'ws_p1', fromCompId: 'V_SNS', fromPinId: 'vcc', toCompId: 'PIR1', toPinId: 'vcc', waypoints: [], color: '#ef4444' },
  { id: 'ws_p2', fromCompId: 'G_SNS', fromPinId: 'gnd', toCompId: 'PIR1', toPinId: 'gnd', waypoints: [], color: '#3b82f6' },
  { id: 'ws_g1', fromCompId: 'V_SNS', fromPinId: 'vcc', toCompId: 'GAS1', toPinId: 'vcc', waypoints: [], color: '#ef4444' },
  { id: 'ws_g2', fromCompId: 'G_SNS', fromPinId: 'gnd', toCompId: 'GAS1', toPinId: 'gnd', waypoints: [], color: '#3b82f6' },
  { id: 'ws_a1', fromCompId: 'V_SNS', fromPinId: 'vcc', toCompId: 'ACC1', toPinId: 'vcc', waypoints: [], color: '#ef4444' },
  { id: 'ws_a2', fromCompId: 'G_SNS', fromPinId: 'gnd', toCompId: 'ACC1', toPinId: 'gnd', waypoints: [], color: '#3b82f6' },
];
const snsLog = evaluateLogicalCircuit(sensorComps, sensorWires, 0);
assert(snsLog.pinStates.get('HUM1:out') === 1, 'Humidity Sensor (LOGICAL): 80% RH >= 60% threshold outputs HIGH (1)');
assert(snsLog.pinStates.get('PIR1:out') === 1, 'PIR Motion Sensor (LOGICAL): motionDetected = true outputs HIGH (1)');
assert(snsLog.pinStates.get('GAS1:do') === 1, 'Gas Sensor MQ-2 (LOGICAL): 1000 ppm >= 400 ppm threshold outputs DO = HIGH (1)');
assert(snsLog.pinStates.get('ACC1:x') === 1 && snsLog.pinStates.get('ACC1:y') === 0, 'Accelerometer ADXL335 (LOGICAL): X=+1.0g (>0.5g) outputs 1, Y=0g outputs 0');

const snsAna = evaluateSpiceCircuit(sensorComps, sensorWires, 0);
assert(Math.abs((snsAna.componentResults.get('HUM1')?.outputVoltage ?? 0) - 4.0) < 0.05, 'Humidity Sensor (ANALOG): 80% RH outputs 4.00V (5V * 0.8)');
assert(Math.abs((snsAna.componentResults.get('PIR1')?.outputVoltage ?? 0) - 3.3) < 0.05, 'PIR Motion Sensor (ANALOG): motionDetected outputs 3.30V');
assert(Math.abs((snsAna.componentResults.get('GAS1')?.outputVoltage ?? 0) - 2.5) < 0.05, 'Gas Sensor MQ-2 (ANALOG): 1000 ppm outputs AO = 2.50V (0.2V + 4.6V * 0.5)');
assert(Math.abs((snsAna.componentResults.get('ACC1')?.pinVoltages?.['y'] ?? 0) - 1.65) < 0.05, 'Accelerometer ADXL335 (ANALOG): 0g on Y-axis outputs 1.65V');

// 29F: SECS-808 8-Bit Programmable Assembly Microprocessor Execution & Pin Driving
const asmCpu = new AsmRuntime('CPU1');
const asmOk = asmCpu.compile(`
  MOV A, 5
  MOV B, 10
  ADD B
  OUT A
`);
assert(asmOk === true, 'SECS-808 Assembly CPU: Program compiles cleanly');
asmCpu.executeOneInstruction(0); // MOV A, 5
asmCpu.executeOneInstruction(0); // MOV B, 10
asmCpu.executeOneInstruction(0); // ADD B -> A = 15 (0x0F = 00001111b)
asmCpu.executeOneInstruction(0); // OUT A -> out0..out3 = HIGH (1), out4..out7 = LOW (0)
const regs = asmCpu.getRegisters();
assert(regs.acc === 15 && regs.regB === 10, 'SECS-808 Assembly CPU: Registers ACC=15 (0x0F), REG B=10 (0x0A)');
const cpuPins = asmCpu.getInstanceData().pins;
assert(
  cpuPins.out0.digitalValue === 1 &&
    cpuPins.out3.digitalValue === 1 &&
    cpuPins.out4.digitalValue === 0,
  'SECS-808 Assembly CPU: OUT A drives out0..out3 HIGH (5V) and out4..out7 LOW (0V)'
);

// 29G: Arduino OLED, LCD & SD Card Peripheral API Integration
const periphMcu = new ArduinoRuntime('MCU_PERIPH', 'arduino-uno');
periphMcu.compile(`
void setup() {
  OLED.clear();
  OLED.println("TEMP: 25C");
  LCD.clear();
  LCD.setCursor(0, 0);
  LCD.print("HELLO SECS");
  SD.println("log.csv", "100,4.98");
}
void loop() {}
`);
periphMcu.step(20);
const pState = periphMcu.getInstanceData().peripheralState;
assert(pState?.oledLines?.[0] === 'TEMP: 25C', 'MCU Peripheral API: OLED.println updates OLED screen buffer');
assert(pState?.lcdRows?.[0]?.startsWith('HELLO SECS') === true, 'MCU Peripheral API: LCD.print updates 16x2 LCD character row');
const sdWrites = pState?.sdPendingWrites || periphMcu.consumeSdWrites();
assert(
  sdWrites.length === 1 && sdWrites[0].filename === 'log.csv' && sdWrites[0].text.trim() === '100,4.98',
  'MCU Peripheral API: SD.println queues virtual SD card file write'
);

console.log('\n====================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('>>> ALL PHASE 6 VIRTUAL INSTRUMENT TESTS PASSED! <<<');
}
