import { evaluateSpiceCircuit, resetSpiceEngineState } from './simulation/spice/SpiceEngine';
import {
  computeAnalogWireFlow,
  computeLogicalWireFlow,
  computeFlowDirectionField,
} from './simulation/wireFlowEngine';
import { CircuitComponent, CircuitWire } from './types/circuit';

console.log('================================================================');
console.log('  SECS FORENSIC AUDIT & MNA RESTORATION VERIFICATION SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (detail) console.error(`         Detail: ${detail}`);
  }
}

// -----------------------------------------------------------------------------
// TEST 1: AC Source + Bridge Rectifier + 470uF Capacitor + 1k Load (7.7 Spec)
// -----------------------------------------------------------------------------
console.log('--- TEST 1: AC Bridge Rectifier + Smoothing Capacitor Physics ---');
resetSpiceEngineState();

function makeComp(partial: Partial<CircuitComponent> & { id: string; type: string }): CircuitComponent {
  return {
    label: partial.id,
    x: 0,
    y: 0,
    rotation: 0,
    mirrored: false,
    properties: {},
    state: {},
    ...partial,
  };
}

const test1Comps: CircuitComponent[] = [
  makeComp({
    id: 'ac1',
    type: 'ac-source',
    properties: { voltage: 12, frequency: 50 },
  }),
  makeComp({
    id: 'gnd1',
    type: 'builtin_gnd',
  }),
  makeComp({
    id: 'br1',
    type: 'builtin_bridge_rectifier',
  }),
  makeComp({
    id: 'c1',
    type: 'capacitor-electrolytic',
    properties: { capacitance: 470, maxVoltage: 25 }, // 470 uF
  }),
  makeComp({
    id: 'r_load',
    type: 'builtin_resistor',
    properties: { resistance: 1000 }, // 1k load
  }),
];

const test1Wires: CircuitWire[] = [
  // AC source to Ground reference
  { id: 'w_ac_neg', fromCompId: 'ac1', fromPinId: 'neg', toCompId: 'gnd1', toPinId: 'gnd', color: '#10b981', waypoints: [] },
  // AC source to BR1 AC1 and AC2
  { id: 'w_ac1', fromCompId: 'ac1', fromPinId: 'pos', toCompId: 'br1', toPinId: 'ac1', color: '#3b82f6', waypoints: [] },
  { id: 'w_ac2', fromCompId: 'ac1', fromPinId: 'neg', toCompId: 'br1', toPinId: 'ac2', color: '#3b82f6', waypoints: [] },
  // BR1 DC+ to C1 pos and R_load p1
  { id: 'w_dc_pos_c', fromCompId: 'br1', fromPinId: 'dc_plus', toCompId: 'c1', toPinId: 'pos', color: '#ef4444', waypoints: [] },
  { id: 'w_c_pos_r', fromCompId: 'c1', fromPinId: 'pos', toCompId: 'r_load', toPinId: 'p1', color: '#ef4444', waypoints: [] },
  // BR1 DC- to C1 neg and R_load p2
  { id: 'w_dc_neg_c', fromCompId: 'br1', fromPinId: 'dc_minus', toCompId: 'c1', toPinId: 'neg', color: '#1f2937', waypoints: [] },
  { id: 'w_c_neg_r', fromCompId: 'c1', fromPinId: 'neg', toCompId: 'r_load', toPinId: 'p2', color: '#1f2937', waypoints: [] },
];

const subDtSec = 0.0005; // 0.5ms sub-step
const numSteps = 100; // 50ms = 2.5 cycles of 50Hz
let minAcV = Infinity;
let maxAcV = -Infinity;
let minDcV = Infinity;
let maxDcV = -Infinity;
const dcHistory: number[] = [];

for (let step = 1; step <= numSteps; step++) {
  const simClockMs = step * (subDtSec * 1000);
  const spiceRes = evaluateSpiceCircuit(test1Comps, test1Wires, simClockMs, subDtSec);

  // Update component states for next step
  for (const c of test1Comps) {
    const cr = spiceRes.componentResults.get(c.id);
    if (cr) {
      c.state = {
        ...c.state,
        pinVoltages: cr.pinVoltages,
        voltageDropV: cr.voltageDropV,
        currentA: cr.currentA,
      };
    }
  }

  const acPosV = spiceRes.componentResults.get('ac1')?.pinVoltages?.['pos'] ?? 0;
  const c1PosV = spiceRes.componentResults.get('c1')?.pinVoltages?.['pos'] ?? 0;
  const c1NegV = spiceRes.componentResults.get('c1')?.pinVoltages?.['neg'] ?? 0;
  const dcV = c1PosV - c1NegV;

  minAcV = Math.min(minAcV, acPosV);
  maxAcV = Math.max(maxAcV, acPosV);

  // After first quarter cycle (10ms / step 20), capacitor is charged
  if (step >= 20) {
    minDcV = Math.min(minDcV, dcV);
    maxDcV = Math.max(maxDcV, dcV);
    dcHistory.push(dcV);
  }
}

const acVpp = maxAcV - minAcV;
const dcVpp = maxDcV - minDcV;
const avgDcV = dcHistory.reduce((a, b) => a + b, 0) / dcHistory.length;

console.log(`  AC1 Min: ${minAcV.toFixed(2)}V, Max: ${maxAcV.toFixed(2)}V, Vpp: ${acVpp.toFixed(2)}V`);
console.log(`  DC Min: ${minDcV.toFixed(2)}V, Max: ${maxDcV.toFixed(2)}V, Vpp: ${dcVpp.toFixed(2)}V, Avg: ${avgDcV.toFixed(2)}V`);

assert(
  minAcV < -11.0 && maxAcV > 11.0 && acVpp > 23.0,
  '1. AC Source produces full unclipped sine wave (swings +/- 12V, Vpp ~ 24V)',
  `min=${minAcV.toFixed(2)}, max=${maxAcV.toFixed(2)}, Vpp=${acVpp.toFixed(2)}`
);

assert(
  avgDcV >= 9.8 && avgDcV <= 11.2,
  '2. DC output voltage charges to ~10.6V peak and maintains smooth DC average (~10.25V)',
  `avgDcV=${avgDcV.toFixed(2)}`
);

assert(
  dcVpp < 1.0,
  `3. Smoothing capacitor (470uF) maintains smooth DC line with ripple Vpp < 1.0V (measured ${dcVpp.toFixed(3)}V)`,
  `dcVpp=${dcVpp.toFixed(3)}`
);

assert(
  minDcV > 9.0,
  `4. DC voltage never collapses to 0.0V during AC negative half-cycles (min DC = ${minDcV.toFixed(2)}V)`,
  `minDcV=${minDcV.toFixed(2)}`
);

// -----------------------------------------------------------------------------
// TEST 2: Open Pushbutton vs Closed Pushbutton (Zero Leakage + Visual Flow)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Open Pushbutton vs Closed Pushbutton ---');
resetSpiceEngineState();

const test2Comps: CircuitComponent[] = [
  makeComp({
    id: 'vcc1',
    type: 'vcc',
    properties: { voltage: 5 },
  }),
  makeComp({
    id: 'sw1',
    type: 'pushbutton',
    state: { isPressed: false }, // OPEN
  }),
  makeComp({
    id: 'r1',
    type: 'builtin_resistor',
    properties: { resistance: 1000 },
  }),
  makeComp({
    id: 'ir_tx1',
    type: 'builtin_ir_tx',
    properties: { forwardVoltage: 1.4 },
  }),
  makeComp({
    id: 'gnd1',
    type: 'builtin_gnd',
  }),
];

const test2Wires: CircuitWire[] = [
  { id: 'w_vcc_sw', fromCompId: 'vcc1', fromPinId: 'vcc', toCompId: 'sw1', toPinId: 'p1', color: '#ef4444', waypoints: [] },
  { id: 'w_sw_r1', fromCompId: 'sw1', fromPinId: 'p2', toCompId: 'r1', toPinId: 'p1', color: '#f59e0b', waypoints: [] },
  { id: 'w_r1_tx', fromCompId: 'r1', fromPinId: 'p2', toCompId: 'ir_tx1', toPinId: 'anode', color: '#10b981', waypoints: [] },
  { id: 'w_tx_gnd', fromCompId: 'ir_tx1', fromPinId: 'cathode', toCompId: 'gnd1', toPinId: 'gnd', color: '#1f2937', waypoints: [] },
];

// Step A: SW1 is OPEN
const spiceOpen = evaluateSpiceCircuit(test2Comps, test2Wires, 0, 0.0005);
for (const c of test2Comps) {
  const cr = spiceOpen.componentResults.get(c.id);
  if (cr) {
    c.state = { ...c.state, pinVoltages: cr.pinVoltages, currentA: cr.currentA };
  }
}

const vDownstream = spiceOpen.componentResults.get('ir_tx1')?.pinVoltages?.['anode'] ?? 0;
const iDownstream = spiceOpen.componentResults.get('ir_tx1')?.currentA ?? 0;

assert(
  Math.abs(vDownstream) < 0.001 && Math.abs(iDownstream) < 1e-9,
  '5. Pure MNA: Open switch has zero conductance (downstream V=0.00V, I=0.00A)',
  `vDownstream=${vDownstream}, iDownstream=${iDownstream}`
);

// Visual Wire Flow Engine Check when SW1 is OPEN
const flowVccToSw = computeAnalogWireFlow(
  test2Wires[0],
  test2Comps[0],
  test2Comps[1],
  spiceOpen.wireVoltages.get('w_vcc_sw'),
  spiceOpen.wireCurrents.get('w_vcc_sw'),
  test2Comps,
  test2Wires,
  true
);

const flowSwToR1 = computeAnalogWireFlow(
  test2Wires[1],
  test2Comps[1],
  test2Comps[2],
  spiceOpen.wireVoltages.get('w_sw_r1'),
  spiceOpen.wireCurrents.get('w_sw_r1'),
  test2Comps,
  test2Wires,
  true
);

const flowR1ToTx = computeAnalogWireFlow(
  test2Wires[2],
  test2Comps[2],
  test2Comps[3],
  spiceOpen.wireVoltages.get('w_r1_tx'),
  spiceOpen.wireCurrents.get('w_r1_tx'),
  test2Comps,
  test2Wires,
  true
);

assert(
  flowVccToSw.hasFlow === true && flowVccToSw.flowColor === '#fbbf24',
  '6. Wire Flow Engine: Live source wire VCC1 -> SW1 animates Warm Yellow when switch is open',
  `hasFlow=${flowVccToSw.hasFlow}, color=${flowVccToSw.flowColor}`
);

assert(
  flowSwToR1.hasFlow === false && flowR1ToTx.hasFlow === false,
  '7. Wire Flow Engine: Downstream wires SW1 -> R1 -> IR_TX are strictly STATIC (no phantom animation)',
  `flowSwToR1=${flowSwToR1.hasFlow}, flowR1ToTx=${flowR1ToTx.hasFlow}`
);

// Step B: User presses SW1 (CLOSED)
test2Comps[1].state = { isPressed: true };
const spiceClosed = evaluateSpiceCircuit(test2Comps, test2Wires, 1, 0.0005);
for (const c of test2Comps) {
  const cr = spiceClosed.componentResults.get(c.id);
  if (cr) {
    c.state = { ...c.state, pinVoltages: cr.pinVoltages, currentA: cr.currentA };
  }
}

const txCurrent = spiceClosed.componentResults.get('ir_tx1')?.currentA ?? 0;
// Current should be ~ (5.0 - 1.4) / (1000 + 10) ~ 3.56 mA
assert(
  txCurrent >= 0.003 && txCurrent <= 0.004,
  `8. Pure MNA: Closed switch conducts current through IR TX (~3.56 mA, measured ${(txCurrent * 1000).toFixed(2)} mA)`,
  `txCurrent=${txCurrent}`
);

const flowSwToR1Closed = computeAnalogWireFlow(
  test2Wires[1],
  test2Comps[1],
  test2Comps[2],
  spiceClosed.wireVoltages.get('w_sw_r1'),
  spiceClosed.wireCurrents.get('w_sw_r1'),
  test2Comps,
  test2Wires,
  true
);

const flowR1ToTxClosed = computeAnalogWireFlow(
  test2Wires[2],
  test2Comps[2],
  test2Comps[3],
  spiceClosed.wireVoltages.get('w_r1_tx'),
  spiceClosed.wireCurrents.get('w_r1_tx'),
  test2Comps,
  test2Wires,
  true
);

assert(
  flowSwToR1Closed.hasFlow === true && flowR1ToTxClosed.hasFlow === true,
  '9. Wire Flow Engine: When switch closes, all circuit wires animate Warm Yellow',
  `flowSwToR1=${flowSwToR1Closed.hasFlow}, flowR1ToTx=${flowR1ToTxClosed.hasFlow}`
);

// -----------------------------------------------------------------------------
// TEST 3: Wire Flow Direction Field & Logical Mode Blue Flow
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Wire Flow Direction Field & Logical Mode Blue Flow ---');

const dirField = computeFlowDirectionField(test2Comps, test2Wires, 'ANALOG');
assert(
  dirField.get('w_vcc_sw') === 1 && dirField.get('w_sw_r1') === 1,
  '10. Flow Direction Field points from +VCC towards GND (1: from -> to)',
  `w_vcc_sw=${dirField.get('w_vcc_sw')}, w_sw_r1=${dirField.get('w_sw_r1')}`
);

// Logical Wire Flow
const dummyWire: CircuitWire = { id: 'w_log', fromCompId: 'gate1', fromPinId: 'out', toCompId: 'led1', toPinId: 'anode', color: '#10b981', waypoints: [] };
const logHighFlow = computeLogicalWireFlow(dummyWire, undefined, undefined, { logicLevel: 1 });
const logLowFlow = computeLogicalWireFlow(dummyWire, undefined, undefined, { logicLevel: 0 });
const logZFlow = computeLogicalWireFlow(dummyWire, undefined, undefined, { logicLevel: 'Z' });

assert(
  logHighFlow.hasFlow === true && logHighFlow.flowColor === '#3b82f6',
  '11. Logical Mode: Logic Level 1 produces Blue (#3b82f6) animated flow',
  `hasFlow=${logHighFlow.hasFlow}, color=${logHighFlow.flowColor}`
);

assert(
  logLowFlow.hasFlow === false && logZFlow.hasFlow === false,
  '12. Logical Mode: Logic Level 0 and "Z" are 100% static',
  `logLow=${logLowFlow.hasFlow}, logZ=${logZFlow.hasFlow}`
);

console.log(`\n================================================================`);
console.log(`  AUDIT RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log(`================================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
