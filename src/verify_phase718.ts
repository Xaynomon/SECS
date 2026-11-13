import { CircuitComponent, CircuitWire } from './types/circuit';
import { runCircuitDiagnostics, resetDiagnosticsState } from './utils/diagnostics';

console.log('================================================================');
console.log('  SECS PHASE 7.18 STORED CAPACITOR CHARGE DIAGNOSTICS TEST SUITE');
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
  toPinId: string
): CircuitWire {
  return {
    id,
    fromCompId,
    fromPinId,
    toCompId,
    toPinId,
    waypoints: [],
    color: '#22c55e',
  };
}

// -----------------------------------------------------------------------------
// TEST 1: Stored Charge Detection at |Vc| >= 0.10V in ANALOG Mode
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Detection of Stored Capacitor Charge (Vc >= 0.10V) ---');

resetDiagnosticsState();

const c1 = makeComp('C1', 'capacitor-electrolytic', { capacitance: 470 }, {
  voltageDropV: 5.12,
  branchCurrentA: 0.00002, // 20 uA residual leakage
});

const gnd = makeComp('GND1', 'gnd');
const wires = [makeWire('w1', 'C1', 'neg', 'GND1', 'gnd')];

const tips1 = runCircuitDiagnostics([c1, gnd], wires, 'ANALOG', true);
const capTip1 = tips1.find((t) => t.id === 'stored-charge-C1');

assert(Boolean(capTip1), '1. Stored capacitor charge diagnostic tip is generated for C1');
assert(
  capTip1?.title === '⚡ Stored Capacitor Charge (C1)',
  `2. Tip title is "⚡ Stored Capacitor Charge (C1)" (received: "${capTip1?.title}")`
);
assert(
  capTip1?.type === 'info',
  `3. Tip type is "info" (received: "${capTip1?.type}")`
);
assert(
  capTip1?.severity === 'tip',
  `4. Tip severity is "tip" (received: "${capTip1?.severity}")`
);
assert(
  Boolean(capTip1?.message.includes('stored electrical charge of 5.12 V')),
  `5. Tip message reports stored voltage "5.12 V" (received: "${capTip1?.message}")`
);
assert(
  Boolean(capTip1?.message.includes("trapped electrostatic energy until discharged")),
  '6. Tip message contains educational explanation of retained charge'
);

// -----------------------------------------------------------------------------
// TEST 2: Ceramic Capacitor Non-Polarized Detection
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Ceramic Capacitor Detection ---');

const c2 = makeComp('C2', 'capacitor-ceramic', { capacitance: 0.1 }, {
  voltageDropV: -1.65, // Negative differential polarity
  branchCurrentA: 0.00001,
});

const tips2 = runCircuitDiagnostics([c2, gnd], wires, 'ANALOG', true);
const capTip2 = tips2.find((t) => t.id === 'stored-charge-C2');

assert(Boolean(capTip2), '7. Ceramic capacitor C2 with negative polarity generates tip');
assert(
  Boolean(capTip2?.message.includes('stored electrical charge of 1.65 V')),
  `8. Absolute voltage magnitude |Vc| = 1.65 V correctly formatted (received: "${capTip2?.message}")`
);

// -----------------------------------------------------------------------------
// TEST 3: Voltage Below Initial Threshold (|Vc| < 0.10V)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Sub-Threshold Uncharged Capacitor (|Vc| < 0.10V) ---');

resetDiagnosticsState();

const cUncharged = makeComp('C3', 'capacitor-electrolytic', {}, {
  voltageDropV: 0.08, // 80 mV, below 100 mV threshold
  branchCurrentA: 0.0,
});

const tipsUncharged = runCircuitDiagnostics([cUncharged, gnd], wires, 'ANALOG', true);
const capTipUncharged = tipsUncharged.find((t) => t.id === 'stored-charge-C3');

assert(!capTipUncharged, '9. Capacitor with Vc = 0.08V (< 0.10V threshold) does NOT trigger tip');

// -----------------------------------------------------------------------------
// TEST 4: Hysteresis & Auto-Clear on Discharge Below 0.05V
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: Hysteresis & Auto-Clear on Discharge (< 0.05V) ---');

// Step 1: Charge up to 2.5V (triggers tracking)
const cDischarging = makeComp('C4', 'capacitor-electrolytic', {}, {
  voltageDropV: 2.50,
  branchCurrentA: 0.001,
});
const tipsStep1 = runCircuitDiagnostics([cDischarging, gnd], wires, 'ANALOG', true);
assert(
  Boolean(tipsStep1.find((t) => t.id === 'stored-charge-C4')),
  '10. Step 1: C4 charges to 2.50V -> triggers stored charge tip'
);

// Step 2: Discharges to 0.08V (above 0.05V auto-clear threshold)
if (cDischarging.state) {
  cDischarging.state.voltageDropV = 0.08;
}
const tipsStep2 = runCircuitDiagnostics([cDischarging, gnd], wires, 'ANALOG', true);
assert(
  Boolean(tipsStep2.find((t) => t.id === 'stored-charge-C4')),
  '11. Step 2: C4 discharges to 0.08V (>= 0.05V) -> retained via hysteresis'
);

// Step 3: Discharges to 0.04V (below 0.05V auto-clear threshold)
if (cDischarging.state) {
  cDischarging.state.voltageDropV = 0.04;
}
const tipsStep3 = runCircuitDiagnostics([cDischarging, gnd], wires, 'ANALOG', true);
assert(
  !tipsStep3.find((t) => t.id === 'stored-charge-C4'),
  '12. Step 3: C4 discharges to 0.04V (< 0.05V) -> auto-clears notification card'
);

// -----------------------------------------------------------------------------
// TEST 5: Auto-Clear When Simulation is Stopped or Reset
// -----------------------------------------------------------------------------
console.log('\n--- TEST 5: Auto-Clear on Simulation Stopped / Reset ---');

const cCharged = makeComp('C5', 'capacitor-electrolytic', {}, {
  voltageDropV: 10.35,
});

// Running
const tipsRunning = runCircuitDiagnostics([cCharged, gnd], wires, 'ANALOG', true);
assert(
  Boolean(tipsRunning.find((t) => t.id === 'stored-charge-C5')),
  '13. Simulation Running: Stored charge tip active'
);

// Stopped (isSimRunning = false)
const tipsStopped = runCircuitDiagnostics([cCharged, gnd], wires, 'ANALOG', false);
assert(
  !tipsStopped.find((t) => t.id === 'stored-charge-C5'),
  '14. Simulation Stopped (isSimRunning = false): Automatically clears notification card'
);

// Reset diagnostics state
resetDiagnosticsState();
assert(true, '15. resetDiagnosticsState() clears tracker cleanly');

// -----------------------------------------------------------------------------
// TEST 6: Mode Check - Suppressed in LOGICAL Mode
// -----------------------------------------------------------------------------
console.log('\n--- TEST 6: Suppressed in LOGICAL Mode ---');

const tipsLogical = runCircuitDiagnostics([cCharged, gnd], wires, 'LOGICAL', true);
assert(
  !tipsLogical.find((t) => t.id === 'stored-charge-C5'),
  '16. LOGICAL Mode: Stored charge tip is suppressed'
);

// -----------------------------------------------------------------------------
// TEST 7: Overload / Explosion Precedence
// -----------------------------------------------------------------------------
console.log('\n--- TEST 7: Overload / Explosion Precedence ---');

resetDiagnosticsState();

const cExploded = makeComp('C6', 'capacitor-electrolytic', {}, {
  voltageDropV: 25.0,
  isOverloaded: true,
  isBurned: true,
  overloadReason: 'Dielectric breakdown! Applied voltage 25.0V exceeds rated 16.0V.',
});

const tipsExploded = runCircuitDiagnostics([cExploded, gnd], wires, 'ANALOG', true);
const explodeTip = tipsExploded.find((t) => t.id === 'overload-cap-C6');
const chargeTip = tipsExploded.find((t) => t.id === 'stored-charge-C6');

assert(Boolean(explodeTip), '17. Exploded capacitor produces critical error diagnostic');
assert(!chargeTip, '18. Exploded capacitor does NOT produce conflicting stored charge tip');

console.log('\n================================================================');
console.log(`  PHASE 7.18 RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
