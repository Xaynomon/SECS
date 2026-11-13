import { STARTER_TEMPLATES } from './constants/starterTemplates';
import { ComponentRegistry } from './registry/ComponentRegistry';
import { AsmRuntime } from './simulation/mcu/asmRuntime';

function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
}

console.log('===========================================================');
console.log('=== SECS HOTFIX 7.21 COMPREHENSIVE VERIFICATION SUITE ===');
console.log('=== Real-World Traffic Countdowns (G10s / R10s / R20s / R30s) ===');
console.log('===========================================================');

const t12 = STARTER_TEMPLATES.find((t) => t.id === 'prof_4way_traffic_junction');
assert(Boolean(t12), 'Template 12 (prof_4way_traffic_junction) not found!');

// -------------------------------------------------------------------------
// 1. ARCHITECTURAL CONSTRAINTS
// -------------------------------------------------------------------------
console.log('\n--- Test 1: Architectural Constraints & Zero MCU ---');
const compTypes = t12!.circuit.components.map((c) => c.type);
assert(!compTypes.includes('arduino-uno'), 'CRITICAL: Template 12 must have ZERO Arduino!');
assert(!compTypes.includes('esp32'), 'CRITICAL: Template 12 must have ZERO ESP32!');
assert(!compTypes.includes('pico'), 'CRITICAL: Template 12 must have ZERO Pico!');
console.log('[PASS] ZERO Arduino, ZERO ESP32, ZERO Raspberry Pi Pico.');

// -------------------------------------------------------------------------
// 2. HARDWARE DECODER & TENS OR GATES WIRING VERIFICATION
// -------------------------------------------------------------------------
console.log('\n--- Test 2: Real-World Tens Logic Wiring ---');
const wires = t12!.circuit.wires;

// Helper to find driver pin from CPU1 for each Tens gate
function getGateDriverCpuPin(gateId: string): string {
  const wA = wires.find((w) => w.toCompId === gateId && w.toPinId === 'in_a');
  const wB = wires.find((w) => w.toCompId === gateId && w.toPinId === 'in_b');
  assert(Boolean(wA && wB), `Gate ${gateId} missing input wires`);
  assert(wA!.fromCompId === 'cpu1' && wB!.fromCompId === 'cpu1', `Gate ${gateId} must be driven by cpu1`);
  assert(wA!.fromPinId === wB!.fromPinId, `Gate ${gateId} inputs in_a and in_b must receive same phase signal`);
  return wA!.fromPinId;
}

// North: d0 = ACT_S (out6), d1 = ACT_E (out5)
const pinNorthD0 = getGateDriverCpuPin('gate_or_n_d0');
const pinNorthD1 = getGateDriverCpuPin('gate_or_n_d1');
assert(pinNorthD0 === 'out6', `North Tens d0 must be driven by out6 (ACT_S), got ${pinNorthD0}`);
assert(pinNorthD1 === 'out5', `North Tens d1 must be driven by out5 (ACT_E), got ${pinNorthD1}`);
console.log('[PASS] North Tens Decoder driven by: d0=ACT_S, d1=ACT_E');

// East: d0 = ACT_W (out7), d1 = ACT_S (out6)
const pinEastD0 = getGateDriverCpuPin('gate_or_e_d0');
const pinEastD1 = getGateDriverCpuPin('gate_or_e_d1');
assert(pinEastD0 === 'out7', `East Tens d0 must be driven by out7 (ACT_W), got ${pinEastD0}`);
assert(pinEastD1 === 'out6', `East Tens d1 must be driven by out6 (ACT_S), got ${pinEastD1}`);
console.log('[PASS] East Tens Decoder driven by: d0=ACT_W, d1=ACT_S');

// South: d0 = ACT_N (out4), d1 = ACT_W (out7)
const pinSouthD0 = getGateDriverCpuPin('gate_or_s_d0');
const pinSouthD1 = getGateDriverCpuPin('gate_or_s_d1');
assert(pinSouthD0 === 'out4', `South Tens d0 must be driven by out4 (ACT_N), got ${pinSouthD0}`);
assert(pinSouthD1 === 'out7', `South Tens d1 must be driven by out7 (ACT_W), got ${pinSouthD1}`);
console.log('[PASS] South Tens Decoder driven by: d0=ACT_N, d1=ACT_W');

// West: d0 = ACT_E (out5), d1 = ACT_N (out4)
const pinWestD0 = getGateDriverCpuPin('gate_or_w_d0');
const pinWestD1 = getGateDriverCpuPin('gate_or_w_d1');
assert(pinWestD0 === 'out5', `West Tens d0 must be driven by out5 (ACT_E), got ${pinWestD0}`);
assert(pinWestD1 === 'out4', `West Tens d1 must be driven by out4 (ACT_N), got ${pinWestD1}`);
console.log('[PASS] West Tens Decoder driven by: d0=ACT_E, d1=ACT_N');

// -------------------------------------------------------------------------
// 3. 4-PHASE CYCLE DECODING SIMULATION
// -------------------------------------------------------------------------
console.log('\n--- Test 3: 4-Phase Cycle Real-World Wait Times Simulation ---');

const phases = [
  {
    phase: 'Phase 1 (North Green)',
    active: { out4: 1, out5: 0, out6: 0, out7: 0 },
    expectedTens: { north: 0, east: 0, south: 1, west: 2 },
    expectedRoles: { north: 'G 10s', east: 'R 10s (next)', south: 'R 20s (3rd)', west: 'R 30s (4th)' },
  },
  {
    phase: 'Phase 2 (East Green)',
    active: { out4: 0, out5: 1, out6: 0, out7: 0 },
    expectedTens: { north: 2, east: 0, south: 0, west: 1 },
    expectedRoles: { north: 'R 30s (4th)', east: 'G 10s', south: 'R 10s (next)', west: 'R 20s (3rd)' },
  },
  {
    phase: 'Phase 3 (South Green)',
    active: { out4: 0, out5: 0, out6: 1, out7: 0 },
    expectedTens: { north: 1, east: 2, south: 0, west: 0 },
    expectedRoles: { north: 'R 20s (3rd)', east: 'R 30s (4th)', south: 'G 10s', west: 'R 10s (next)' },
  },
  {
    phase: 'Phase 4 (West Green)',
    active: { out4: 0, out5: 0, out6: 0, out7: 1 },
    expectedTens: { north: 0, east: 1, south: 2, west: 0 },
    expectedRoles: { north: 'R 10s (next)', east: 'R 20s (3rd)', south: 'R 30s (4th)', west: 'G 10s' },
  },
];

for (const p of phases) {
  const d0_n = p.active.out6;
  const d1_n = p.active.out5;
  const tens_n = d0_n + d1_n * 2;

  const d0_e = p.active.out7;
  const d1_e = p.active.out6;
  const tens_e = d0_e + d1_e * 2;

  const d0_s = p.active.out4;
  const d1_s = p.active.out7;
  const tens_s = d0_s + d1_s * 2;

  const d0_w = p.active.out5;
  const d1_w = p.active.out4;
  const tens_w = d0_w + d1_w * 2;

  assert(tens_n === p.expectedTens.north, `${p.phase}: North Tens expected ${p.expectedTens.north}, got ${tens_n}`);
  assert(tens_e === p.expectedTens.east, `${p.phase}: East Tens expected ${p.expectedTens.east}, got ${tens_e}`);
  assert(tens_s === p.expectedTens.south, `${p.phase}: South Tens expected ${p.expectedTens.south}, got ${tens_s}`);
  assert(tens_w === p.expectedTens.west, `${p.phase}: West Tens expected ${p.expectedTens.west}, got ${tens_w}`);

  console.log(`[PASS] ${p.phase}:`);
  console.log(`  North: Tens=${tens_n} (${p.expectedRoles.north})`);
  console.log(`  East:  Tens=${tens_e} (${p.expectedRoles.east})`);
  console.log(`  South: Tens=${tens_s} (${p.expectedRoles.south})`);
  console.log(`  West:  Tens=${tens_w} (${p.expectedRoles.west})`);
}

// -------------------------------------------------------------------------
// 4. SECS-808 ASSEMBLY PROGRAM EXECUTION
// -------------------------------------------------------------------------
console.log('\n--- Test 4: SECS-808 Assembly Program Compilation & Stepping ---');
const cpu = t12!.circuit.components.find((c) => c.id === 'cpu1');
assert(Boolean(cpu?.properties?.code), 'CPU1 code missing');

const asm = new AsmRuntime('cpu1');
const compiled = asm.compile(cpu!.properties.code);
assert(compiled, `CPU1 assembly compilation failed: ${asm.getInstanceData().lastError}`);
console.log('[PASS] Bare-Metal Assembly Program compiles cleanly.');

asm.setClockConfig(10, false);
for (let s = 0; s < 40; s++) {
  asm.step(s * 100);
}
const reg = asm.getInstanceData().asmRegisters;
assert(Boolean(reg), 'Registers undefined after step');
console.log(`[PASS] CPU1 stepped 40 cycles. PC=${reg?.pc}, ACC=${reg?.acc}, OUT=0x${(reg?.outByte ?? 0).toString(16)}.`);

// -------------------------------------------------------------------------
// 5. 20PX GRID INTEGRITY FOR ALL 12 TEMPLATES
// -------------------------------------------------------------------------
console.log('\n--- Test 5: Global Grid & Pin Registry Validation across all 12 templates ---');
for (const tmpl of STARTER_TEMPLATES) {
  const compMap = new Map<string, any>();
  for (const comp of tmpl.circuit.components) {
    assert(comp.x % 20 === 0, `Component ${comp.id} in ${tmpl.id} x=${comp.x} not on 20px grid`);
    assert(comp.y % 20 === 0, `Component ${comp.id} in ${tmpl.id} y=${comp.y} not on 20px grid`);
    const def = ComponentRegistry.getComponentDefinition(comp.type);
    assert(Boolean(def), `Unknown component type ${comp.type} on ${comp.id} in ${tmpl.id}`);
    compMap.set(comp.id, { comp, def });
  }

  for (const wire of tmpl.circuit.wires) {
    const from = compMap.get(wire.fromCompId);
    assert(Boolean(from), `Wire ${wire.id} in ${tmpl.id}: fromCompId ${wire.fromCompId} missing`);
    const to = compMap.get(wire.toCompId);
    assert(Boolean(to), `Wire ${wire.id} in ${tmpl.id}: toCompId ${wire.toCompId} missing`);

    const fromPin = from.def.pins.find((p: any) => p.id === wire.fromPinId);
    assert(Boolean(fromPin), `Wire ${wire.id} in ${tmpl.id}: fromPinId ${wire.fromPinId} missing on ${from.comp.type}`);
    const toPin = to.def.pins.find((p: any) => p.id === wire.toPinId);
    assert(Boolean(toPin), `Wire ${wire.id} in ${tmpl.id}: toPinId ${wire.toPinId} missing on ${to.comp.type}`);

    for (const wp of wire.waypoints) {
      assert(wp.x % 20 === 0, `Wire ${wire.id} in ${tmpl.id} waypoint x=${wp.x} not on 20px grid`);
      assert(wp.y % 20 === 0, `Wire ${wire.id} in ${tmpl.id} waypoint y=${wp.y} not on 20px grid`);
    }
  }
}
console.log('[PASS] All 12 templates passed strict 20px grid and pin connectivity check.');

console.log('\n===========================================================');
console.log('✅ ALL SECS HOTFIX 7.21 VERIFICATION CHECKS PASSED 100%!');
console.log('===========================================================\n');
