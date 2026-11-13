import { evaluateSpiceCircuit } from './simulation/spice/SpiceEngine';
import { CircuitComponent, CircuitWire } from './types/circuit';
import { routeSmartWireAStar } from './utils/orthogonalRouter';
import {
  computeWireFlowDirection,
  getClosedLoopWireIds,
} from './utils/circuitFlow';
import { getPinAbsolutePosition } from './utils/geometry';

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

console.log('=== SECS Hotfix 7.11 Verification Suite ===\n');

// ---------------------------------------------------------------------------
// TEST 1: Auto-Router Direct L-Path / Z-Path Corridor (AC Source to Bridge Rectifier)
// ---------------------------------------------------------------------------
console.log('--- TEST 1: Auto-Router Direct Corridor Routing Without Detours ---');
{
  // AC1 at (100, 100), BR1 at (200, 140)
  const ac1 = makeComp('ac1', 'ac-source', 100, 100, { amplitude: 12, frequency: 60 });
  const br1 = makeComp('br1', 'builtin_bridge_rectifier', 220, 140, {});
  const comps = [ac1, br1];

  const pAcLine = getPinAbsolutePosition(ac1, 'pos') || getPinAbsolutePosition(ac1, 'p1');
  const pBrAc1 = getPinAbsolutePosition(br1, 'ac1');

  // Route wire from AC1 line to BR1 AC1 input
  const path = routeSmartWireAStar(pAcLine, pBrAc1, comps, []);
  assert(path.length >= 2, 'Route from AC1 to BR1 must produce valid orthogonal path');

  // Verify that the route does NOT detour around AC1's left (x < 80) or top (y < 80)
  const minX = Math.min(...path.map((p) => p.x));
  const minY = Math.min(...path.map((p) => p.y));

  assert(
    minX >= pAcLine.x - 20,
    `Wire must not detour to the far left of AC1! minX = ${minX}, pAcLine.x = ${pAcLine.x}`
  );
  assert(
    minY >= pAcLine.y - 20,
    `Wire must not detour above AC1! minY = ${minY}, pAcLine.y = ${pAcLine.y}`
  );

  // Verify that the number of bends is minimal (1 or 2 bends, i.e. path.length <= 4)
  assert(
    path.length <= 4,
    `Direct corridor routing should take 1 or 2 bends, got ${path.length - 1} segments (${path.length} points)!`
  );

  console.log(`  [PASS] Direct corridor routing selected clean ${path.length - 2}-bend path:`, JSON.stringify(path));
}

// ---------------------------------------------------------------------------
// TEST 2: Universal Voltage-OR-Current Closed Loop (VCC -> SW1 -> R1 -> IR_TX1 -> GND1)
// ---------------------------------------------------------------------------
console.log('\n--- TEST 2: Universal Closed Loop Continuity (Closed Switch) ---');
{
  const vcc1 = makeComp('vcc1', 'builtin_vcc', 100, 100, { voltage: 5.0 });
  const sw1 = makeComp('sw1', 'builtin_spst_switch', 200, 100, { closed: true }, { closed: true });
  const r1 = makeComp('r1', 'builtin_resistor', 300, 100, { resistance: 220 });
  const ir1 = makeComp('ir1', 'builtin_ir_tx', 400, 100, { forwardVoltage: 1.4 });
  const gnd1 = makeComp('gnd1', 'builtin_gnd', 500, 100, {});

  const w1 = makeWire('w1', 'vcc1', 'vcc', 'sw1', 'p1');
  const w2 = makeWire('w2', 'sw1', 'p2', 'r1', 'p1');
  const w3 = makeWire('w3', 'r1', 'p2', 'ir1', 'anode');
  const w4 = makeWire('w4', 'ir1', 'cathode', 'gnd1', 'gnd');

  const components = [vcc1, sw1, r1, ir1, gnd1];
  const wires = [w1, w2, w3, w4];

  // 1. Evaluate closed-loop topological reachability
  const closedIds = getClosedLoopWireIds(components, wires);

  assert(closedIds.has('w1'), 'Wire w1 (VCC -> SW1) must be in closed loop');
  assert(closedIds.has('w2'), 'Wire w2 (SW1 -> R1) must be in closed loop');
  assert(closedIds.has('w3'), 'Wire w3 (R1 -> IR_TX1) must be in closed loop');
  assert(closedIds.has('w4'), 'Wire w4 (IR_TX1 -> GND1) must be in closed loop');
  assert(closedIds.size === 4, `All 4 wires in the loop must be active, got ${closedIds.size}`);

  // 2. Evaluate SPICE simulation
  const result = evaluateSpiceCircuit(components, wires, 0);

  // Check loop current
  const irResult = result.componentResults.get('ir1')!;
  assert(irResult.currentA > 0.01, `IR transmitter current should be > 10mA, got ${irResult.currentA * 1000}mA`);

  // Check all wire currents in SPICE engine
  assert((result.wireCurrents.get('w1') ?? 0) > 0.005, 'w1 should have > 5mA branch current');
  assert((result.wireCurrents.get('w2') ?? 0) > 0.005, 'w2 should have > 5mA branch current');
  assert((result.wireCurrents.get('w3') ?? 0) > 0.005, 'w3 should have > 5mA branch current');
  assert((result.wireCurrents.get('w4') ?? 0) > 0.005, 'w4 should have > 5mA branch current');

  // 3. Verify physical flow direction on all 4 wires: flows from VCC to GND
  const dir1 = computeWireFlowDirection(w1, vcc1, sw1, 'ANALOG', undefined, undefined, wires, components);
  const dir2 = computeWireFlowDirection(w2, sw1, r1, 'ANALOG', undefined, undefined, wires, components);
  const dir3 = computeWireFlowDirection(w3, r1, ir1, 'ANALOG', undefined, undefined, wires, components);
  const dir4 = computeWireFlowDirection(w4, ir1, gnd1, 'ANALOG', undefined, undefined, wires, components);

  assert(dir1 === 1, `w1 flow direction must be forward (+1), got ${dir1}`);
  assert(dir2 === 1, `w2 flow direction must be forward (+1), got ${dir2}`);
  assert(dir3 === 1, `w3 flow direction must be forward (+1), got ${dir3}`);
  assert(dir4 === 1, `w4 flow direction must be forward (+1), got ${dir4}`);

  console.log('  [PASS] 100% of wires in closed loop evaluate closed loop & animate forward flow');
}

// ---------------------------------------------------------------------------
// TEST 3: Open Switch Stops Electricity Flow Immediately (Zero Ghost Flow)
// ---------------------------------------------------------------------------
console.log('\n--- TEST 3: Open Switch Breaks Loop & Halts Flow Immediately ---');
{
  const vcc1 = makeComp('vcc1', 'builtin_vcc', 100, 100, { voltage: 5.0 });
  // SW1 is OPEN (closed = false)
  const sw1 = makeComp('sw1', 'builtin_spst_switch', 200, 100, { closed: false }, { closed: false });
  const r1 = makeComp('r1', 'builtin_resistor', 300, 100, { resistance: 220 });
  const ir1 = makeComp('ir1', 'builtin_ir_tx', 400, 100, { forwardVoltage: 1.4 });
  const gnd1 = makeComp('gnd1', 'builtin_gnd', 500, 100, {});

  const w1 = makeWire('w1', 'vcc1', 'vcc', 'sw1', 'p1');
  const w2 = makeWire('w2', 'sw1', 'p2', 'r1', 'p1');
  const w3 = makeWire('w3', 'r1', 'p2', 'ir1', 'anode');
  const w4 = makeWire('w4', 'ir1', 'cathode', 'gnd1', 'gnd');

  const components = [vcc1, sw1, r1, ir1, gnd1];
  const wires = [w1, w2, w3, w4];

  // 1. Evaluate closed-loop topological reachability
  const closedIds = getClosedLoopWireIds(components, wires);

  // w1 connects to VCC, but cannot reach GND because SW1 is open
  assert(!closedIds.has('w1'), 'Dead-end wire w1 must NOT be in closed loop when switch is open');
  assert(!closedIds.has('w2'), 'Downstream wire w2 must NOT be in closed loop when switch is open');
  assert(!closedIds.has('w3'), 'Downstream wire w3 must NOT be in closed loop when switch is open');
  assert(!closedIds.has('w4'), 'Return wire w4 must NOT be in closed loop when switch is open');
  assert(closedIds.size === 0, `Zero wires should be in closed loop when switch is open, got ${closedIds.size}`);

  // 2. Evaluate SPICE simulation
  const result = evaluateSpiceCircuit(components, wires, 0);
  const irResult = result.componentResults.get('ir1')!;
  assert(irResult.currentA < 0.0001, `IR transmitter current must be negligible (< 0.1mA) when switch is open, got ${irResult.currentA}`);

  // Wire currents must all be negligible (< 0.1mA)
  assert((result.wireCurrents.get('w1') ?? 0) < 0.0001, 'w1 wire current must be < 0.1mA');
  assert((result.wireCurrents.get('w2') ?? 0) < 0.0001, 'w2 wire current must be < 0.1mA');
  assert((result.wireCurrents.get('w3') ?? 0) < 0.0001, 'w3 wire current must be < 0.1mA');
  assert((result.wireCurrents.get('w4') ?? 0) < 0.0001, 'w4 wire current must be < 0.1mA');

  console.log('  [PASS] Open switch halts flow and deactivates closed-loop state across all wires');
}

// ---------------------------------------------------------------------------
// TEST 4: Dead-End Stubs and Floating Branches Do Not Animate Flow
// ---------------------------------------------------------------------------
console.log('\n--- TEST 4: Dead-End Stubs and Unconnected Branches ---');
{
  const vcc1 = makeComp('vcc1', 'builtin_vcc', 100, 100, { voltage: 5.0 });
  const sw1 = makeComp('sw1', 'builtin_spst_switch', 200, 100, { closed: true }, { closed: true });
  const r1 = makeComp('r1', 'builtin_resistor', 300, 100, { resistance: 220 });
  const gnd1 = makeComp('gnd1', 'builtin_gnd', 400, 100, {});

  // Dead-end dangling open switch
  const swDead = makeComp('swDead', 'builtin_spst_switch', 200, 200, { closed: false }, { closed: false });

  // Main active loop
  const w1 = makeWire('w1', 'vcc1', 'vcc', 'sw1', 'p1');
  const w2 = makeWire('w2', 'sw1', 'p2', 'r1', 'p1');
  const w3 = makeWire('w3', 'r1', 'p2', 'gnd1', 'gnd');

  // Dead-end branch from VCC1 to open swDead
  const wDead = makeWire('wDead', 'vcc1', 'vcc', 'swDead', 'p1');

  const components = [vcc1, sw1, r1, gnd1, swDead];
  const wires = [w1, w2, w3, wDead];

  const closedIds = getClosedLoopWireIds(components, wires);
  assert(closedIds.has('w1'), 'Main loop w1 must be active');
  assert(closedIds.has('w2'), 'Main loop w2 must be active');
  assert(closedIds.has('w3'), 'Main loop w3 must be active');
  assert(!closedIds.has('wDead'), 'Dead-end branch wDead must NOT be marked in closed loop');

  console.log('  [PASS] Dead-end branch correctly excluded from closed loop');
}

// ---------------------------------------------------------------------------
// TEST 5: Bridge Rectifier Full AC & DC Loops
// ---------------------------------------------------------------------------
console.log('\n--- TEST 5: Bridge Rectifier AC and Rectified DC Loop Reachability ---');
{
  const ac1 = makeComp('ac1', 'ac-source', 100, 100, { amplitude: 12, frequency: 60 });
  const br1 = makeComp('br1', 'builtin_bridge_rectifier', 250, 100, {});
  const c1 = makeComp('c1', 'capacitor-electrolytic', 350, 100, { capacitance: 100 });
  const rLoad = makeComp('rLoad', 'builtin_resistor', 450, 100, { resistance: 1000 });

  // AC loop
  const wAc1 = makeWire('wAc1', 'ac1', 'pos', 'br1', 'ac1');
  const wAc2 = makeWire('wAc2', 'ac1', 'neg', 'br1', 'ac2');

  // Rectified DC loop
  const wDcPlus = makeWire('wDcPlus', 'br1', 'dc_plus', 'c1', 'pos');
  const wDcCapToLoad = makeWire('wDcCapToLoad', 'c1', 'pos', 'rLoad', 'p1');
  const wDcMinus = makeWire('wDcMinus', 'rLoad', 'p2', 'br1', 'dc_minus');
  const wCapMinus = makeWire('wCapMinus', 'c1', 'neg', 'br1', 'dc_minus');

  const components = [ac1, br1, c1, rLoad];
  const wires = [wAc1, wAc2, wDcPlus, wDcCapToLoad, wDcMinus, wCapMinus];

  const closedIds = getClosedLoopWireIds(components, wires);
  assert(closedIds.has('wAc1'), 'AC1 line wire must be in closed loop');
  assert(closedIds.has('wAc2'), 'AC2 neutral wire must be in closed loop');
  assert(closedIds.has('wDcPlus'), 'DC+ supply wire must be in closed loop');
  assert(closedIds.has('wDcCapToLoad'), 'DC load wire must be in closed loop');
  assert(closedIds.has('wDcMinus'), 'DC- return wire must be in closed loop');
  assert(closedIds.has('wCapMinus'), 'Capacitor return wire must be in closed loop');

  console.log('  [PASS] Bridge rectifier AC and rectified DC loops both participate in closed loop flow');
}

console.log('\n======================================================');
console.log('🎉 ALL HOTFIX 7.11 TESTS PASSED SUCCESSFULLY!');
console.log('======================================================');
