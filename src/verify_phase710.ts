import { ComponentRegistry } from './registry/ComponentRegistry';
import { evaluateSpiceCircuit } from './simulation/spice/SpiceEngine';
import { CircuitComponent, CircuitWire } from './types/circuit';
import { routeSmartWireAStar } from './utils/orthogonalRouter';
import { computeWireFlowDirection } from './utils/circuitFlow';
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
  properties: Record<string, any> = {}
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
  };
}

console.log('=== SECS Hotfix 7.10 Verification Suite ===\n');

// ---------------------------------------------------------------------------
// TEST 1: Wire Auto-Router Same-Pin Sharing & Obstacle Avoidance
// ---------------------------------------------------------------------------
console.log('--- TEST 1: A* Router Same-Pin Sharing & Obstacle Avoidance ---');
{
  // VCC1 at (100, 100), RF1 at (100, 200) (size 80x80), SW1 at (260, 100) (size 60x60)
  const vcc1 = makeComp('vcc1', 'builtin_vcc', 100, 100, { voltage: 5.0 });
  const rf1 = makeComp('rf1', 'builtin_rf_radio', 100, 200, { rfChannel: 'CH 1 (433.0 MHz)' });
  const sw1 = makeComp('sw1', 'builtin_switch_spst', 260, 100, {});
  const comps = [vcc1, rf1, sw1];

  const pVcc = getPinAbsolutePosition(vcc1, 'vcc');
  const pSwCom = getPinAbsolutePosition(sw1, 'com') || getPinAbsolutePosition(sw1, 'p1');

  // Existing wire 1 from VCC1 to RF1(vcc)
  const wire1: CircuitWire = {
    ...makeWire('wire1', 'vcc1', 'vcc', 'rf1', 'vcc'),
    waypoints: [],
  };

  // Route wire 2 from VCC1 to SW1(com)
  const path2 = routeSmartWireAStar(pVcc, pSwCom, comps, [wire1]);
  assert(path2.length >= 2, 'Route from VCC1 to SW1 must produce valid orthogonal path');

  // Verify that wire2 does NOT detour downwards past RF1's bottom (y > 220)
  // Because RF1 is at y=200..280, a detour around the bottom of RF1 would have y > 260
  const maxPathY = Math.max(...path2.map((p) => p.y));
  assert(
    maxPathY < 200,
    `Wire 2 from VCC1 to SW1 must cleanly exit horizontally, not detour below RF1! maxPathY = ${maxPathY}`
  );

  // Verify path2 does not penetrate RF1's bounding box
  const rfDef = ComponentRegistry.get('builtin_rf_radio')!;
  for (const pt of path2) {
    const insideRf =
      pt.x > rf1.x && pt.x < rf1.x + rfDef.width && pt.y > rf1.y && pt.y < rf1.y + rfDef.height;
    assert(!insideRf, `Path point (${pt.x}, ${pt.y}) must not cut through RF1 body!`);
  }
  console.log('  [PASS] A* router cleanly routes multiple wires from same pin without detours');
}

// ---------------------------------------------------------------------------
// TEST 2: RF Radio (builtin_rf_radio) TX Open vs Driven in ANALOG Mode
// ---------------------------------------------------------------------------
console.log('\n--- TEST 2: RF Radio TX Open vs Driven in ANALOG Mode ---');
{
  // Left Island: VCC1 (5V), GND1, RF1 on CH 1
  // Right Island: VCC2 (5V), GND2, RF2 on CH 1, LED + Resistor connected to RF2(rx)
  const comps: CircuitComponent[] = [
    makeComp('vcc1', 'builtin_vcc', 0, 0, { voltage: 5.0 }),
    makeComp('gnd1', 'builtin_gnd', 0, 100, {}),
    makeComp('rf1', 'builtin_rf_radio', 100, 0, { rfChannel: 'CH 1 (433.0 MHz)' }),
    makeComp('vcc2', 'builtin_vcc', 300, 0, { voltage: 5.0 }),
    makeComp('gnd2', 'builtin_gnd', 300, 100, {}),
    makeComp('rf2', 'builtin_rf_radio', 400, 0, { rfChannel: 'CH 1 (433.0 MHz)' }),
    makeComp('led1', 'builtin_led', 520, 0, { color: 'red', forwardVoltage: 2.0 }),
    makeComp('r_led', 'builtin_resistor', 520, 60, { resistance: 220 }),
  ];

  // Base power wires: RF1 and RF2 powered, but RF1's TX pin is OPEN (disconnected)!
  const wiresOpenTx: CircuitWire[] = [
    makeWire('w1', 'vcc1', 'vcc', 'rf1', 'vcc'),
    makeWire('w2', 'gnd1', 'gnd', 'rf1', 'gnd'),
    makeWire('w3', 'vcc2', 'vcc', 'rf2', 'vcc'),
    makeWire('w4', 'gnd2', 'gnd', 'rf2', 'gnd'),
    makeWire('w5', 'rf2', 'rx', 'led1', 'anode'),
    makeWire('w6', 'led1', 'cathode', 'r_led', 'p1'),
    makeWire('w7', 'r_led', 'p2', 'gnd2', 'gnd'),
  ];

  // Part A: Open TX -> RF1 must NOT transmit, RF2(rx) must output 0.0V, LED must be OFF
  const spiceOpen = evaluateSpiceCircuit(comps, wiresOpenTx, 0, 0.001);
  const rf1Open = spiceOpen.componentResults.get('rf1');
  const rf2Open = spiceOpen.componentResults.get('rf2');
  const ledOpen = spiceOpen.componentResults.get('led1');

  assert(rf1Open?.isTransmitting === false, 'RF1 with open TX must NOT transmit in Analog mode');
  assert(
    Math.abs(rf2Open?.outputVoltage ?? 99) < 0.2,
    `RF2(rx) with no active transmitter must be ~0.0V, got ${rf2Open?.outputVoltage}`
  );
  assert(rf2Open?.isReceiving === false, 'RF2 must NOT be receiving when RF1 TX is open');
  assert((ledOpen?.brightness ?? 0) === 0, 'LED driven by RF2(rx) must stay 100% OFF when TX is open');

  // Part B: Connect RF1(tx) to VCC1 -> Now RF1 MUST transmit, RF2(rx) MUST output 5.0V, LED turns ON
  const wiresDrivenTx: CircuitWire[] = [
    ...wiresOpenTx,
    makeWire('w_tx_drive', 'vcc1', 'vcc', 'rf1', 'tx'),
  ];
  const spiceDriven = evaluateSpiceCircuit(comps, wiresDrivenTx, 0, 0.001);
  const rf1Driven = spiceDriven.componentResults.get('rf1');
  const rf2Driven = spiceDriven.componentResults.get('rf2');
  const ledDriven = spiceDriven.componentResults.get('led1');

  assert(rf1Driven?.isTransmitting === true, 'RF1 with driven TX must transmit in Analog mode');
  assert(rf2Driven?.isReceiving === true, 'RF2 must be receiving in Analog mode when RF1 transmits');
  assert((rf2Driven?.outputVoltage ?? 0) > 4.5, 'RF2(rx) must output ~5.0V when receiving');
  assert((ledDriven?.brightness ?? 0) > 0, 'LED driven by RF2(rx) must glow when receiving');
  console.log('  [PASS] RF Radio TX open vs driven behavior strictly validated in Analog mode');
}

// ---------------------------------------------------------------------------
// TEST 3: Infrared Transmitter (builtin_ir_tx) & Series Current in ANALOG Mode
// ---------------------------------------------------------------------------
console.log('\n--- TEST 3: Infrared Transmitter Series Current in ANALOG Mode ---');
{
  const comps: CircuitComponent[] = [
    makeComp('vcc1', 'builtin_vcc', 0, 0, { voltage: 5.0 }),
    makeComp('r1', 'builtin_resistor', 100, 0, { resistance: 220 }),
    makeComp('ir_tx', 'builtin_ir_tx', 200, 0, { forwardVoltage: 1.4 }),
    makeComp('gnd1', 'builtin_gnd', 300, 0, {}),
  ];
  const wires: CircuitWire[] = [
    makeWire('w_vcc_r', 'vcc1', 'vcc', 'r1', 'p1'),
    makeWire('w_r_ir', 'r1', 'p2', 'ir_tx', 'anode'),
    makeWire('w_ir_gnd', 'ir_tx', 'cathode', 'gnd1', 'gnd'),
  ];

  const spiceRes = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  const rRes = spiceRes.componentResults.get('r1');
  const irRes = spiceRes.componentResults.get('ir_tx');

  // Series circuit: I = (5.0V - 1.4V) / (220Ω + 10Ω) ≈ 0.01565A = 15.65mA
  const expectedI = (5.0 - 1.4) / (220 + 10);
  assert(
    Math.abs((rRes?.currentA ?? 0) - expectedI) < 0.003,
    `Resistor current should be ~15.65mA, got ${((rRes?.currentA ?? 0) * 1000).toFixed(2)}mA`
  );
  assert(
    Math.abs((irRes?.currentA ?? 0) - expectedI) < 0.003,
    `IR TX current should be ~15.65mA, got ${((irRes?.currentA ?? 0) * 1000).toFixed(2)}mA`
  );

  // Wire currents across all 3 wires must be ~15.65mA (> 0.01A)
  const iW1 = spiceRes.wireCurrents.get('w_vcc_r') ?? 0;
  const iW2 = spiceRes.wireCurrents.get('w_r_ir') ?? 0;
  const iW3 = spiceRes.wireCurrents.get('w_ir_gnd') ?? 0;

  assert(
    Math.abs(iW1 - expectedI) < 0.003,
    `Wire VCC1->R1 must show active current (~15.65mA), got ${(iW1 * 1000).toFixed(2)}mA`
  );
  assert(
    Math.abs(iW2 - expectedI) < 0.003,
    `Wire R1->IR_TX must show active current (~15.65mA), got ${(iW2 * 1000).toFixed(2)}mA`
  );
  assert(
    Math.abs(iW3 - expectedI) < 0.003,
    `Wire IR_TX->GND must show active current (~15.65mA), got ${(iW3 * 1000).toFixed(2)}mA`
  );
  console.log('  [PASS] IR Transmitter & Resistor MNA branch current computes ~15.65mA on all loop wires');
}

// ---------------------------------------------------------------------------
// TEST 4: Wire Flow Direction 3-Tier Hierarchy (Rule A, Rule B, Rule C)
// ---------------------------------------------------------------------------
console.log('\n--- TEST 4: Topological Wire Flow Direction Hierarchy ---');
{
  const vcc = makeComp('vcc1', 'builtin_vcc', 0, 0, { voltage: 5.0 });
  const gnd = makeComp('gnd1', 'builtin_gnd', 0, 100, {});
  const rf1 = makeComp('rf1', 'builtin_rf_radio', 100, 0, {});
  const sw1 = makeComp('sw1', 'builtin_switch_spst', 200, 0, {});
  const led1 = makeComp('led1', 'builtin_led', 100, 100, {});
  const allComps = [vcc, gnd, rf1, sw1, led1];

  // Rule A1: VCC as sourcePin -> flow is FORWARD (+1)
  const wVccFwd = makeWire('w_vf', 'vcc1', 'vcc', 'rf1', 'vcc');
  const dirVccFwd = computeWireFlowDirection(wVccFwd, vcc, rf1, 'ANALOG', 5.0, 5.0, [wVccFwd], allComps);
  assert(dirVccFwd === 1, `Wire drawn VCC1 -> RF1 must flow FORWARD (+1), got ${dirVccFwd}`);

  // Rule A2: VCC as targetPin -> flow is REVERSED (-1)
  const wVccRev = makeWire('w_vr', 'rf1', 'vcc', 'vcc1', 'vcc');
  const dirVccRev = computeWireFlowDirection(wVccRev, rf1, vcc, 'ANALOG', 5.0, 5.0, [wVccRev], allComps);
  assert(dirVccRev === -1, `Wire drawn RF1 -> VCC1 must flow REVERSED (-1), got ${dirVccRev}`);

  // Rule A3: GND as targetPin -> current flows into GND, flow is FORWARD (+1)
  const wGndFwd = makeWire('w_gf', 'rf1', 'gnd', 'gnd1', 'gnd');
  const dirGndFwd = computeWireFlowDirection(wGndFwd, rf1, gnd, 'ANALOG', 0.0, 0.0, [wGndFwd], allComps);
  assert(dirGndFwd === 1, `Wire drawn RF1 -> GND1 must flow FORWARD (+1), got ${dirGndFwd}`);

  // Rule A4: GND as sourcePin -> current flows into GND, flow is REVERSED (-1)
  const wGndRev = makeWire('w_gr', 'gnd1', 'gnd', 'rf1', 'gnd');
  const dirGndRev = computeWireFlowDirection(wGndRev, gnd, rf1, 'ANALOG', 0.0, 0.0, [wGndRev], allComps);
  assert(dirGndRev === -1, `Wire drawn GND1 -> RF1 must flow REVERSED (-1), got ${dirGndRev}`);

  // Rule B1: Chained Supply Net: VCC -> RF1 -> SW1
  // Wire 2: RF1(vcc) -> SW1(p1). Both are at 5.0V.
  // BFS hop from VCC: RF1 is 1 hop, SW1 is 2 hops. Flow must travel away from VCC: RF1 -> SW1 (+1)
  const wChain1 = makeWire('w_c1', 'vcc1', 'vcc', 'rf1', 'vcc');
  const wChain2 = makeWire('w_c2', 'rf1', 'vcc', 'sw1', 'p1');
  const chainedSupplyWires = [wChain1, wChain2];
  const dirChain2 = computeWireFlowDirection(wChain2, rf1, sw1, 'ANALOG', 5.0, 5.0, chainedSupplyWires, allComps);
  assert(dirChain2 === 1, `Chained supply wire RF1(vcc) -> SW1(p1) must flow away from VCC (+1), got ${dirChain2}`);

  // If drawn SW1(p1) -> RF1(vcc), flow must be REVERSED (-1) to still flow away from VCC
  const wChain2Rev = makeWire('w_c2r', 'sw1', 'p1', 'rf1', 'vcc');
  const dirChain2Rev = computeWireFlowDirection(wChain2Rev, sw1, rf1, 'ANALOG', 5.0, 5.0, [wChain1, wChain2Rev], allComps);
  assert(dirChain2Rev === -1, `Chained supply wire SW1(p1) -> RF1(vcc) must flow away from VCC (-1), got ${dirChain2Rev}`);

  // Rule B2: Chained Ground Net: LED1(cathode) -> RF1(gnd) -> GND1(gnd)
  // Wire 1: LED1(cathode) -> RF1(gnd). Both at 0.0V.
  // BFS hop to GND1: RF1 is 1 hop, LED1 is 2 hops. Flow must travel toward GND1: LED1 -> RF1 (+1)
  const wGndChain1 = makeWire('w_gc1', 'led1', 'cathode', 'rf1', 'gnd');
  const wGndChain2 = makeWire('w_gc2', 'rf1', 'gnd', 'gnd1', 'gnd');
  const chainedGndWires = [wGndChain1, wGndChain2];
  const dirGndChain1 = computeWireFlowDirection(wGndChain1, led1, rf1, 'ANALOG', 0.0, 0.0, chainedGndWires, allComps);
  assert(dirGndChain1 === 1, `Chained ground wire LED1 -> RF1 must flow toward GND (+1), got ${dirGndChain1}`);

  // Rule C: Voltage Drop across different nodes (e.g. 5V -> 2V)
  const wDrop = makeWire('w_drop', 'rf1', 'tx', 'led1', 'anode');
  const dirDrop = computeWireFlowDirection(wDrop, rf1, led1, 'ANALOG', 5.0, 2.0);
  assert(dirDrop === 1, `Voltage drop 5V -> 2V must flow from high to low (+1), got ${dirDrop}`);

  console.log('  [PASS] 3-tier wire flow direction hierarchy strictly adheres to physical directionality');
}

console.log('\nALL HOTFIX 7.10 TESTS PASSED SUCCESSFULLY!');
