import fs from 'fs';
import path from 'path';
import { CircuitComponent, CircuitWire } from './types/circuit';
import {
  computeFlowDirectionField,
  computeAnalogWireFlow,
  computeLogicalWireFlow,
  resetWireFlowEngineState,
  isPositiveStartTerminal,
  isNegativeReturnDestination,
} from './simulation/wireFlowEngine';

console.log('================================================================');
console.log('  SECS HOTFIX 7.16 WIRE FLOW DIRECTION & ANTI-STUTTER TEST SUITE');
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

function makeComp(
  id: string,
  type: string,
  properties: Record<string, any> = {},
  state: Record<string, any> = {}
): CircuitComponent {
  return {
    id,
    type,
    label: id,
    x: 0,
    y: 0,
    rotation: 0,
    mirrored: false,
    properties,
    state,
  };
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

// -----------------------------------------------------------------------------
// TEST 1: Source & Return Terminal Identification
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Universal Source and Return Terminal Identification ---');

const acComp = makeComp('AC1', 'ac-source');
const brComp = makeComp('BR1', 'builtin_bridge_rectifier');
const capComp = makeComp('C1', 'capacitor-electrolytic');
const indComp = makeComp('L1', 'inductor');
const batComp = makeComp('BAT1', 'battery-9v');
const gndComp = makeComp('GND1', 'gnd');

assert(isPositiveStartTerminal(acComp, 'pos'), '1. AC source pos pin identified as start terminal');
assert(isPositiveStartTerminal(brComp, 'dc_plus'), '2. Bridge Rectifier dc_plus identified as start terminal');
assert(isPositiveStartTerminal(batComp, 'pos'), '3. Battery pos identified as start terminal');
assert(!isPositiveStartTerminal(capComp, 'pos'), '4. Capacitor pos is strictly NOT seeded as start terminal');
assert(!isPositiveStartTerminal(indComp, 'p1'), '5. Inductor pin is strictly NOT seeded as start terminal');

assert(isNegativeReturnDestination(gndComp, 'gnd'), '6. GND pin identified as return destination');
assert(isNegativeReturnDestination(batComp, 'neg'), '7. Battery neg identified as return destination');
assert(isNegativeReturnDestination(acComp, 'neg'), '8. AC source neg pin identified as return destination');
assert(isNegativeReturnDestination(brComp, 'dc_minus'), '9. Bridge Rectifier dc_minus identified as return destination');
assert(!isNegativeReturnDestination(capComp, 'neg'), '10. Capacitor neg is strictly NOT seeded as return destination');
assert(!isNegativeReturnDestination(indComp, 'p2'), '11. Inductor pin is strictly NOT seeded as return destination');

// -----------------------------------------------------------------------------
// TEST 2: AC-to-DC Bridge Rectifier Circuit Topological Direction Field
// Circuit: AC1 -> BR1 -> C1 -> R2 -> LED1 (No explicit GND placed)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Return-Rail & Supply-Rail Flow Direction Field ---');

const components = [
  makeComp('AC1', 'ac-source', { voltage: 12, frequency: 50 }),
  makeComp('BR1', 'builtin_bridge_rectifier'),
  makeComp('C1', 'capacitor-electrolytic', { capacitance: 0.00047 }),
  makeComp('R2', 'resistor', { resistance: 1000 }),
  makeComp('LED1', 'led-red'),
];

const wires = [
  // AC Loop
  makeWire('w_ac_pos', 'AC1', 'pos', 'BR1', 'ac1'),
  makeWire('w_ac_neg', 'BR1', 'ac2', 'AC1', 'neg'),
  // DC Supply Rail
  makeWire('w_dc_pos1', 'BR1', 'dc_plus', 'C1', 'pos'),
  makeWire('w_dc_pos2', 'C1', 'pos', 'R2', 'p1'),
  // Load
  makeWire('w_load', 'R2', 'p2', 'LED1', 'anode'),
  // DC Return Rail ("All Return Roads Lead to BR1 DC-")
  makeWire('w_dc_ret1', 'LED1', 'cathode', 'C1', 'neg'),
  makeWire('w_dc_ret2', 'C1', 'neg', 'BR1', 'dc_minus'),
];

const dirField = computeFlowDirectionField(components, wires, 'ANALOG');

// Return Rail Directions
const dirRet1 = dirField.get('w_dc_ret1');
assert(
  dirRet1 === 1,
  '12. Return Rail: LED1 (cathode) -> C1 (neg) flows forward into C1 (neg)',
  `Received: ${dirRet1}, expected 1`
);

const dirRet2 = dirField.get('w_dc_ret2');
assert(
  dirRet2 === 1,
  '13. Return Rail: C1 (neg) -> BR1 (dc_minus) flows forward into BR1 (dc_minus)',
  `Received: ${dirRet2}, expected 1`
);

// Supply Rail Directions
const dirPos1 = dirField.get('w_dc_pos1');
assert(
  dirPos1 === 1,
  '14. Supply Rail: BR1 (dc_plus) -> C1 (pos) flows forward from BR1 (dc_plus)',
  `Received: ${dirPos1}, expected 1`
);

const dirPos2 = dirField.get('w_dc_pos2');
assert(
  dirPos2 === 1,
  '15. Supply Rail: C1 (pos) -> R2 (p1) flows forward away from C1 (pos) into R2 (p1)',
  `Received: ${dirPos2}, expected 1`
);

const dirLoad = dirField.get('w_load');
assert(
  dirLoad === 1,
  '16. Load: R2 (p2) -> LED1 (anode) flows forward into LED1 anode',
  `Received: ${dirLoad}, expected 1`
);

// AC Loop Directions
const dirAcPos = dirField.get('w_ac_pos');
assert(
  dirAcPos === 1,
  '17. AC Supply: AC1 (pos) -> BR1 (ac1) flows forward from AC1 pos',
  `Received: ${dirAcPos}, expected 1`
);

const dirAcNeg = dirField.get('w_ac_neg');
assert(
  dirAcNeg === 1,
  '18. AC Return: BR1 (ac2) -> AC1 (neg) flows forward into AC1 neg',
  `Received: ${dirAcNeg}, expected 1`
);

// -----------------------------------------------------------------------------
// TEST 3: Drawing Order Invariance (Symmetry)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Drawing Order Invariance (Symmetry) ---');

// Reversing from/to on return wire: from C1 (neg) to LED1 (cathode)
const reverseWires = [
  ...wires.filter((w) => w.id !== 'w_dc_ret1'),
  makeWire('w_dc_ret1_rev', 'C1', 'neg', 'LED1', 'cathode'),
];

const revDirField = computeFlowDirectionField(components, reverseWires, 'ANALOG');
const dirRetRev = revDirField.get('w_dc_ret1_rev');
assert(
  dirRetRev === -1,
  '19. Reversing drawn wire endpoints (C1:neg -> LED1:cathode) produces -1, maintaining exact physical flow from LED1 to C1',
  `Received: ${dirRetRev}, expected -1`
);

// -----------------------------------------------------------------------------
// TEST 4: Anti-Stuttering AC Zero-Crossing Hold Window
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: Anti-Stuttering Zero-Crossing Hold Window ---');

resetWireFlowEngineState();

const testWire = wires[0]; // w_ac_pos
const fromComp = components[0]; // AC1
const toComp = components[1]; // BR1

// Frame 1: Active sine wave peak (V = 16.9V, I = 0.015A) at t = 5ms
const tPeak = 1000;
const resPeak = computeAnalogWireFlow(
  testWire,
  fromComp,
  toComp,
  16.9,
  0.015,
  components,
  wires,
  true,
  new Set(['AC1:pos', 'BR1:ac1']),
  dirField,
  tPeak
);

assert(resPeak.hasFlow === true, '20. Frame 1: Peak AC voltage/current produces active flow (hasFlow = true)');
assert(resPeak.flowDirection === 1, '21. Frame 1: Flow direction is 1 (forward)');

// Frame 2: Zero crossing at t = 10ms (5ms later) (V = 0.00V, I = 0.00A)
const tZeroCrossing = tPeak + 5; // 5ms later (< 65ms hold window)
const resZero = computeAnalogWireFlow(
  testWire,
  fromComp,
  toComp,
  0.0,
  0.0,
  components,
  wires,
  true,
  new Set(['AC1:pos', 'BR1:ac1']),
  dirField,
  tZeroCrossing
);

assert(
  resZero.hasFlow === true,
  '22. Frame 2: AC zero-crossing (0V, 0A) holds flow active across hold window (prevents unmount/stutter)',
  `Received hasFlow: ${resZero.hasFlow}`
);
assert(
  resZero.flowDirection === 1,
  '23. Frame 2: Flow direction remains strictly 1 (does not flip or reverse)',
  `Received flowDirection: ${resZero.flowDirection}`
);

// Frame 3: Negative half-cycle peak at t = 15ms (10ms later) (instantaneous V = -16.9V, I = 0.015A)
const tNegPeak = tPeak + 10;
const resNegPeak = computeAnalogWireFlow(
  testWire,
  fromComp,
  toComp,
  -16.9,
  0.015,
  components,
  wires,
  true,
  new Set(['AC1:pos', 'BR1:ac1']),
  dirField,
  tNegPeak
);

assert(resNegPeak.hasFlow === true, '24. Frame 3: Negative half-cycle remains active (hasFlow = true)');
assert(
  resNegPeak.flowDirection === 1,
  '25. Frame 3: Flow direction remains constant 1 (NEVER flips on negative half-cycles!)',
  `Received: ${resNegPeak.flowDirection}`
);

// Frame 4: Simulation stopped (isSimRunning = false)
const resStopped = computeAnalogWireFlow(
  testWire,
  fromComp,
  toComp,
  16.9,
  0.015,
  components,
  wires,
  false,
  new Set(['AC1:pos', 'BR1:ac1']),
  dirField,
  tNegPeak
);

assert(resStopped.hasFlow === false, '26. Simulation stopped immediately sets hasFlow = false');

// -----------------------------------------------------------------------------
// TEST 5: CircuitCanvas Integration & Precomputed Direction Field
// -----------------------------------------------------------------------------
console.log('\n--- TEST 5: CircuitCanvas.tsx Integration Verification ---');

const canvasPath = path.join(process.cwd(), 'src', 'components', 'canvas', 'CircuitCanvas.tsx');
const canvasContent = fs.readFileSync(canvasPath, 'utf-8');

assert(
  canvasContent.includes('computeFlowDirectionField'),
  '27. CircuitCanvas.tsx imports computeFlowDirectionField from wireFlowEngine'
);

assert(
  canvasContent.includes('const directionField = computeFlowDirectionField(components, wires, simulationMode);'),
  '28. CircuitCanvas.tsx computes directionField in renderWires'
);

assert(
  canvasContent.includes('directionField') &&
    canvasContent.includes('computeAnalogWireFlow(') &&
    canvasContent.includes('computeLogicalWireFlow('),
  '29. CircuitCanvas.tsx passes directionField to computeAnalogWireFlow and computeLogicalWireFlow'
);

// -----------------------------------------------------------------------------
// TEST 6: Logical Wire Flow Direction Field
// -----------------------------------------------------------------------------
console.log('\n--- TEST 6: Logical Wire Flow Engine Compliance ---');

const logWire = makeWire('w_log_1', 'comp_vcc', 'out', 'comp_led', 'anode', { logicLevel: 1 });
const logDirField = new Map<string, 1 | -1>([['w_log_1', -1]]);
const logRes = computeLogicalWireFlow(
  logWire,
  makeComp('comp_vcc', 'builtin_vcc'),
  makeComp('comp_led', 'builtin_led'),
  logWire.state,
  undefined,
  logDirField
);

assert(logRes.hasFlow === true, '30. LOGICAL Mode: Wire with logic 1 has active blue flow');
assert(logRes.flowDirection === -1, '31. LOGICAL Mode: Direction field (-1) respected cleanly');

console.log('\n================================================================');
console.log(`  HOTFIX 7.16 RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
