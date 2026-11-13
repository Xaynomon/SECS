import fs from 'fs';
import path from 'path';
import { CircuitComponent, CircuitWire } from './types/circuit';
import {
  computePinRanks,
  computeFlowDirectionField,
  computeAnalogWireFlow,
  resetWireFlowEngineState,
} from './simulation/wireFlowEngine';

console.log('================================================================');
console.log('  SECS HOTFIX 7.17 DRAWING-ORDER INVARIANCE & PIN RANK TEST SUITE');
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
// TEST 1: Pin Rank Verification on AC -> BR1 -> C1 -> R2 -> LED1 Topology
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Deterministic Pin Rank Computation ---');

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
  // DC Return Rail
  makeWire('w_dc_ret1', 'LED1', 'cathode', 'C1', 'neg'),
  makeWire('w_dc_ret2', 'C1', 'neg', 'BR1', 'dc_minus'),
];

const pinRanks = computePinRanks(components, wires);

const rankBrDcPlus = pinRanks.get('BR1:dc_plus')!;
const rankC1Pos = pinRanks.get('C1:pos')!;
const rankR2P1 = pinRanks.get('R2:p1')!;

assert(
  rankBrDcPlus === 0,
  `1. Supply Rail Driver: BR1:dc_plus has rank 0 (received: ${rankBrDcPlus})`
);
assert(
  rankC1Pos === 1,
  `2. Supply Rail Hop 1: C1:pos has rank 1 (received: ${rankC1Pos})`
);
assert(
  rankR2P1 === 2,
  `3. Supply Rail Hop 2: R2:p1 has rank 2 (received: ${rankR2P1})`
);
assert(
  rankBrDcPlus < rankC1Pos && rankC1Pos < rankR2P1,
  '4. Supply Rail Order: BR1:dc_plus (0) -> C1:pos (1) -> R2:p1 (2) flows outward from driver'
);

const rankBrDcMinus = pinRanks.get('BR1:dc_minus')!;
const rankC1Neg = pinRanks.get('C1:neg')!;
const rankLedCathode = pinRanks.get('LED1:cathode')!;

assert(
  rankBrDcMinus === 0,
  `5. Return Sink: BR1:dc_minus has rank 0 (received: ${rankBrDcMinus})`
);
assert(
  rankC1Neg === -1,
  `6. Return Hop 1: C1:neg has rank -1 (received: ${rankC1Neg})`
);
assert(
  rankLedCathode === -2,
  `7. Return Hop 2: LED1:cathode has rank -2 (received: ${rankLedCathode})`
);
assert(
  rankLedCathode < rankC1Neg && rankC1Neg < rankBrDcMinus,
  '8. Return Rail Order: LED1:cathode (-2) -> C1:neg (-1) -> BR1:dc_minus (0) flows toward return sink'
);

// -----------------------------------------------------------------------------
// TEST 2: Drawing-Order Invariance on C1 (+) <-> R2 (Pin 1)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Drawing-Order Invariance on C1 (+) <-> R2 (Pin 1) ---');

// Case A: Drawn from C1 (+) to R2 (p1)
const wiresCaseA = [
  ...wires.filter((w) => w.id !== 'w_dc_pos2'),
  makeWire('w_test_pos', 'C1', 'pos', 'R2', 'p1'),
];
const dirMapCaseA = computeFlowDirectionField(components, wiresCaseA);
const dirCaseA = dirMapCaseA.get('w_test_pos')!;

// Simulated wire geometry points from C1:pos to R2:p1
const pointsCaseA = [
  { x: 100, y: 100 },
  { x: 100, y: 150 },
  { x: 200, y: 150 },
];
const shouldReverseA = dirCaseA === -1;
const orderedPointsA = shouldReverseA ? [...pointsCaseA].reverse() : pointsCaseA;

assert(
  dirCaseA === 1,
  '9. Case A (drawn C1:pos -> R2:p1): flowDirection is 1 (shouldReverse = false)'
);
assert(
  orderedPointsA[0].x === 100 && orderedPointsA[0].y === 100,
  '10. Case A: orderedPoints starts at C1:pos (100, 100)'
);
assert(
  orderedPointsA[2].x === 200 && orderedPointsA[2].y === 150,
  '11. Case A: orderedPoints ends at R2:p1 (200, 150)'
);

// Case B: Drawn from R2 (p1) to C1 (+) [REVERSED DRAWING]
const wiresCaseB = [
  ...wires.filter((w) => w.id !== 'w_dc_pos2'),
  makeWire('w_test_pos', 'R2', 'p1', 'C1', 'pos'),
];
const dirMapCaseB = computeFlowDirectionField(components, wiresCaseB);
const dirCaseB = dirMapCaseB.get('w_test_pos')!;

// Simulated wire geometry points from R2:p1 to C1:pos
const pointsCaseB = [
  { x: 200, y: 150 },
  { x: 100, y: 150 },
  { x: 100, y: 100 },
];
const shouldReverseB = dirCaseB === -1;
const orderedPointsB = shouldReverseB ? [...pointsCaseB].reverse() : pointsCaseB;

assert(
  dirCaseB === -1,
  '12. Case B (drawn R2:p1 -> C1:pos): flowDirection is -1 (shouldReverse = true)'
);
assert(
  orderedPointsB[0].x === 100 && orderedPointsB[0].y === 100,
  '13. Case B: orderedPoints starts at C1:pos (100, 100) after reversing'
);
assert(
  orderedPointsB[2].x === 200 && orderedPointsB[2].y === 150,
  '14. Case B: orderedPoints ends at R2:p1 (200, 150) after reversing'
);

assert(
  JSON.stringify(orderedPointsA) === JSON.stringify(orderedPointsB),
  '15. CRITICAL: orderedPoints for C1 <-> R2 is 100% IDENTICAL regardless of drawing order'
);

// -----------------------------------------------------------------------------
// TEST 3: Drawing-Order Invariance on C1 (-) <-> LED1 (Cathode)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Drawing-Order Invariance on C1 (-) <-> LED1 (Cathode) ---');

// Case C: Drawn from LED1 (Cathode) to C1 (-)
const wiresCaseC = [
  ...wires.filter((w) => w.id !== 'w_dc_ret1'),
  makeWire('w_test_ret', 'LED1', 'cathode', 'C1', 'neg'),
];
const dirMapCaseC = computeFlowDirectionField(components, wiresCaseC);
const dirCaseC = dirMapCaseC.get('w_test_ret')!;

const pointsCaseC = [
  { x: 300, y: 250 },
  { x: 200, y: 250 },
  { x: 100, y: 250 },
];
const shouldReverseC = dirCaseC === -1;
const orderedPointsC = shouldReverseC ? [...pointsCaseC].reverse() : pointsCaseC;

assert(
  dirCaseC === 1,
  '16. Case C (drawn LED1:cathode -> C1:neg): flowDirection is 1 (shouldReverse = false)'
);
assert(
  orderedPointsC[0].x === 300 && orderedPointsC[0].y === 250,
  '17. Case C: orderedPoints starts at LED1:cathode (300, 250)'
);
assert(
  orderedPointsC[2].x === 100 && orderedPointsC[2].y === 250,
  '18. Case C: orderedPoints ends at C1:neg (100, 250)'
);

// Case D: Drawn from C1 (-) to LED1 (Cathode) [REVERSED DRAWING]
const wiresCaseD = [
  ...wires.filter((w) => w.id !== 'w_dc_ret1'),
  makeWire('w_test_ret', 'C1', 'neg', 'LED1', 'cathode'),
];
const dirMapCaseD = computeFlowDirectionField(components, wiresCaseD);
const dirCaseD = dirMapCaseD.get('w_test_ret')!;

const pointsCaseD = [
  { x: 100, y: 250 },
  { x: 200, y: 250 },
  { x: 300, y: 250 },
];
const shouldReverseD = dirCaseD === -1;
const orderedPointsD = shouldReverseD ? [...pointsCaseD].reverse() : pointsCaseD;

assert(
  dirCaseD === -1,
  '19. Case D (drawn C1:neg -> LED1:cathode): flowDirection is -1 (shouldReverse = true)'
);
assert(
  orderedPointsD[0].x === 300 && orderedPointsD[0].y === 250,
  '20. Case D: orderedPoints starts at LED1:cathode (300, 250) after reversing'
);
assert(
  orderedPointsD[2].x === 100 && orderedPointsD[2].y === 250,
  '21. Case D: orderedPoints ends at C1:neg (100, 250) after reversing'
);

assert(
  JSON.stringify(orderedPointsC) === JSON.stringify(orderedPointsD),
  '22. CRITICAL: orderedPoints for LED1 <-> C1 is 100% IDENTICAL regardless of drawing order'
);

// -----------------------------------------------------------------------------
// TEST 4: computeAnalogWireFlow Symmetry (Zero Endpoint Asymmetry)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: computeAnalogWireFlow Endpoint Symmetry ---');

resetWireFlowEngineState();

const forwardWire = makeWire('w_sym', 'C1', 'pos', 'R2', 'p1');
const backwardWire = makeWire('w_sym', 'R2', 'p1', 'C1', 'pos');

const c1Comp = components[2];
const r2Comp = components[3];

const resFwd = computeAnalogWireFlow(
  forwardWire,
  c1Comp,
  r2Comp,
  10.35,
  0.012,
  components,
  wires,
  true,
  new Set(['C1:pos', 'R2:p1']),
  dirMapCaseA,
  1000
);

const resBwd = computeAnalogWireFlow(
  backwardWire,
  r2Comp,
  c1Comp,
  10.35,
  0.012,
  components,
  wires,
  true,
  new Set(['C1:pos', 'R2:p1']),
  dirMapCaseB,
  1000
);

assert(
  resFwd.hasFlow === resBwd.hasFlow && resFwd.hasFlow === true,
  '23. hasFlow is 100% symmetric with respect to fromComp/toComp swapping'
);
assert(
  resFwd.effectiveVoltage === resBwd.effectiveVoltage,
  '24. effectiveVoltage is 100% symmetric'
);
assert(
  resFwd.effectiveCurrent === resBwd.effectiveCurrent,
  '25. effectiveCurrent is 100% symmetric'
);
assert(
  resFwd.flowColor === resBwd.flowColor,
  '26. flowColor is 100% symmetric'
);

// -----------------------------------------------------------------------------
// TEST 5: CircuitCanvas.tsx Code Inspection
// -----------------------------------------------------------------------------
console.log('\n--- TEST 5: CircuitCanvas.tsx Pipeline Verification ---');

const canvasPath = path.join(process.cwd(), 'src', 'components', 'canvas', 'CircuitCanvas.tsx');
const canvasContent = fs.readFileSync(canvasPath, 'utf-8');

assert(
  canvasContent.includes('const shouldReversePath = directionField.get(wire.id) === -1;'),
  '27. CircuitCanvas.tsx uses directionField.get(wire.id) === -1 for shouldReversePath'
);
assert(
  canvasContent.includes('const orderedPoints = shouldReversePath ? [...points].reverse() : points;'),
  '28. CircuitCanvas.tsx constructs orderedPoints via reverse when shouldReversePath is true'
);
assert(
  canvasContent.includes('const flowPathD = pointsToSvgPath(orderedPoints, 4);'),
  '29. CircuitCanvas.tsx constructs flowPathD from orderedPoints'
);

console.log('\n================================================================');
console.log(`  HOTFIX 7.17 RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
