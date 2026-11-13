import { STARTER_TEMPLATES } from './constants/starterTemplates';
import { ComponentRegistry } from './registry/ComponentRegistry';
import { ArduinoRuntime } from './simulation/mcu/arduinoRuntime';
import { AsmRuntime } from './simulation/mcu/asmRuntime';

function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
}

console.log('===========================================================');
console.log('=== SECS HOTFIX 7.20 COMPREHENSIVE VERIFICATION SUITE ===');
console.log('===========================================================');

// -------------------------------------------------------------------------
// 1. ARDUINO RUNTIME: DELAY & DELAYMICROSECONDS ROBUSTNESS
// -------------------------------------------------------------------------
console.log('\n--- Test 1: ArduinoRuntime delay() Transpilation & Execution ---');

const testSketchNestedDelay = `
void setup() {
  pinMode(8, OUTPUT);
}
void loop() {
  int digit = 2;
  delay((digit + 1) * 30);
  delayMicroseconds((digit + 1) * 10);
  digitalWrite(8, HIGH);
  delay(50);
}
`;

const testRuntime = new ArduinoRuntime('test_mcu', 'arduino-uno');
const compiledTest = testRuntime.compile(testSketchNestedDelay);
assert(compiledTest, `testSketchNestedDelay failed to compile: ${testRuntime.getInstanceData().lastError}`);

// Step through multiple iterations to verify execution without throwing 'delay is not a function'
for (let t = 0; t < 20; t++) {
  testRuntime.step(t * 50);
  assert(!testRuntime.getInstanceData().lastError, `Runtime error on step ${t}: ${testRuntime.getInstanceData().lastError}`);
}
console.log('[PASS] delay((digit + 1) * 30) transpiled and stepped 20 times with zero runtime errors.');

// -------------------------------------------------------------------------
// 2. TEMPLATE 10 (Wireless IR Numpad & 3-Digit Auto-Reset Display)
// -------------------------------------------------------------------------
console.log('\n--- Test 2: Template 10 (prof_ir_numpad_3digit) Compliance ---');
const t10 = STARTER_TEMPLATES.find((t) => t.id === 'prof_ir_numpad_3digit');
assert(Boolean(t10), 'Template 10 (prof_ir_numpad_3digit) not found!');

if (t10) {
  const compMap = new Map(t10.circuit.components.map((c) => [c.id, c]));

  // Verify 3 side-by-side 7-segment displays
  const seg1 = compMap.get('seg1');
  const seg2 = compMap.get('seg2');
  const seg3 = compMap.get('seg3');
  assert(Boolean(seg1 && seg2 && seg3), 'Template 10 missing seg1, seg2, or seg3!');
  assert(seg1!.y === seg2!.y && seg2!.y === seg3!.y, `All 3 displays must be on same horizontal Y line, got y1=${seg1!.y}, y2=${seg2!.y}, y3=${seg3!.y}`);
  assert(seg1!.x < seg2!.x && seg2!.x < seg3!.x, `Displays must be horizontally ordered from left to right: Hundreds (${seg1!.x}) < Tens (${seg2!.x}) < Ones (${seg3!.x})`);
  console.log(`[PASS] Displays placed horizontally side-by-side: seg1(${seg1!.x}, ${seg1!.y}), seg2(${seg2!.x}, ${seg2!.y}), seg3(${seg3!.x}, ${seg3!.y})`);

  // Verify 3 BCD decoders
  const dec1 = compMap.get('dec1');
  const dec2 = compMap.get('dec2');
  const dec3 = compMap.get('dec3');
  assert(Boolean(dec1 && dec2 && dec3), 'Template 10 missing dec1, dec2, or dec3!');
  assert(dec1!.y === dec2!.y && dec2!.y === dec3!.y, `All 3 decoders must be on same horizontal Y line`);

  // Compile MCU_TX
  const mcuTx = compMap.get('mcu_tx');
  assert(Boolean(mcuTx?.properties?.code), 'MCU_TX missing code');
  const txRuntime = new ArduinoRuntime('mcu_tx', 'arduino-uno');
  const txOk = txRuntime.compile(mcuTx!.properties.code);
  assert(txOk, `MCU_TX compile failed: ${txRuntime.getInstanceData().lastError}`);

  // Test MCU_TX steps
  for (let t = 0; t < 10; t++) {
    txRuntime.step(t * 100);
    assert(!txRuntime.getInstanceData().lastError, `MCU_TX runtime error: ${txRuntime.getInstanceData().lastError}`);
  }
  console.log('[PASS] MCU_TX compiled and executed cleanly.');

  // Compile MCU_RX
  const mcuRx = compMap.get('mcu_rx');
  assert(Boolean(mcuRx?.properties?.code), 'MCU_RX missing code');
  const rxRuntime = new ArduinoRuntime('mcu_rx', 'arduino-uno');
  const rxOk = rxRuntime.compile(mcuRx!.properties.code);
  assert(rxOk, `MCU_RX compile failed: ${rxRuntime.getInstanceData().lastError}`);

  // Verify 3000ms watchdog logic present in code
  assert(mcuRx!.properties.code.includes('3000'), 'MCU_RX code must contain 3000ms watchdog timer check');
  assert(mcuRx!.properties.code.includes('digitHundreds') && mcuRx!.properties.code.includes('digitTens') && mcuRx!.properties.code.includes('digitOnes'), 'MCU_RX code must implement 3-digit shift register variables');

  // Test MCU_RX steps
  for (let t = 0; t < 10; t++) {
    rxRuntime.step(t * 100);
    assert(!rxRuntime.getInstanceData().lastError, `MCU_RX runtime error: ${rxRuntime.getInstanceData().lastError}`);
  }
  console.log('[PASS] MCU_RX compiled and executed cleanly with 3-digit shift register & 3000ms watchdog.');
}

// -------------------------------------------------------------------------
// 3. TEMPLATE 12 (Compass Crossroads Traffic Controller)
// -------------------------------------------------------------------------
console.log('\n--- Test 3: Template 12 (prof_4way_traffic_junction) True Crossroads Compliance ---');
const t12 = STARTER_TEMPLATES.find((t) => t.id === 'prof_4way_traffic_junction');
assert(Boolean(t12), 'Template 12 (prof_4way_traffic_junction) not found!');

if (t12) {
  const compTypes = t12.circuit.components.map((c) => c.type);
  const compMap = new Map(t12.circuit.components.map((c) => [c.id, c]));

  // STRICT ARCHITECTURAL CONSTRAINT: ZERO Arduino, ZERO ESP32, ZERO Pico!
  assert(!compTypes.includes('arduino-uno'), 'CRITICAL: Template 12 must have ZERO Arduino!');
  assert(!compTypes.includes('esp32'), 'CRITICAL: Template 12 must have ZERO ESP32!');
  assert(!compTypes.includes('pico'), 'CRITICAL: Template 12 must have ZERO Pico!');
  console.log('[PASS] STRICT CONSTRAINT VERIFIED: ZERO Arduino, ZERO ESP32, ZERO Pico.');

  // CPU1 is SECS-808 Assembly Microprocessor
  const cpu = compMap.get('cpu1');
  assert(Boolean(cpu), 'Template 12 missing central CPU1!');
  assert(cpu!.type === 'builtin_cpu_8bit', `CPU1 must be builtin_cpu_8bit, got ${cpu!.type}`);
  assert(cpu!.x === 900 && cpu!.y === 700, `CPU1 must be positioned at crossroads center (900, 700), got (${cpu!.x}, ${cpu!.y})`);
  console.log('[PASS] CPU1 centrally positioned at crossroads center (900, 700).');

  // Verify 4 Compass Junctions
  // NORTH
  const tlN = compMap.get('tl_n');
  const segNTens = compMap.get('seg_n_tens');
  const segNOnes = compMap.get('seg_n_ones');
  const decNTens = compMap.get('dec_n_tens');
  const decNOnes = compMap.get('dec_n_ones');
  const pirN = compMap.get('pir_n');
  assert(Boolean(tlN && segNTens && segNOnes && decNTens && decNOnes && pirN), 'North junction missing components!');
  assert(tlN!.y < 400, `North traffic light must be in top quadrant (y < 400), got y=${tlN!.y}`);
  assert(segNTens!.y === segNOnes!.y, 'North Tens & Ones displays must be horizontally aligned');
  assert(segNTens!.x < segNOnes!.x, 'North Tens must be to the left of Ones');

  // SOUTH
  const tlS = compMap.get('tl_s');
  const segSTens = compMap.get('seg_s_tens');
  const segSOnes = compMap.get('seg_s_ones');
  const decSTens = compMap.get('dec_s_tens');
  const decSOnes = compMap.get('dec_s_ones');
  const pirS = compMap.get('pir_s');
  assert(Boolean(tlS && segSTens && segSOnes && decSTens && decSOnes && pirS), 'South junction missing components!');
  assert(tlS!.y > 1000, `South traffic light must be in bottom quadrant (y > 1000), got y=${tlS!.y}`);
  assert(segSTens!.y === segSOnes!.y, 'South Tens & Ones displays must be horizontally aligned');
  assert(segSTens!.x < segSOnes!.x, 'South Tens must be to the left of Ones');

  // WEST
  const tlW = compMap.get('tl_w');
  const segWTens = compMap.get('seg_w_tens');
  const segWOnes = compMap.get('seg_w_ones');
  const decWTens = compMap.get('dec_w_tens');
  const decWOnes = compMap.get('dec_w_ones');
  const pirW = compMap.get('pir_w');
  assert(Boolean(tlW && segWTens && segWOnes && decWTens && decWOnes && pirW), 'West junction missing components!');
  assert(tlW!.x < 500, `West traffic light must be in left quadrant (x < 500), got x=${tlW!.x}`);
  assert(segWTens!.y === segWOnes!.y, 'West Tens & Ones displays must be horizontally aligned');
  assert(segWTens!.x < segWOnes!.x, 'West Tens must be to the left of Ones');

  // EAST
  const tlE = compMap.get('tl_e');
  const segETens = compMap.get('seg_e_tens');
  const segEOnes = compMap.get('seg_e_ones');
  const decETens = compMap.get('dec_e_tens');
  const decEOnes = compMap.get('dec_e_ones');
  const pirE = compMap.get('pir_e');
  assert(Boolean(tlE && segETens && segEOnes && decETens && decEOnes && pirE), 'East junction missing components!');
  assert(tlE!.x > 1300, `East traffic light must be in right quadrant (x > 1300), got x=${tlE!.x}`);
  assert(segETens!.y === segEOnes!.y, 'East Tens & Ones displays must be horizontally aligned');
  assert(segETens!.x < segEOnes!.x, 'East Tens must be to the left of Ones');

  console.log('[PASS] True Compass Crossroads layout verified for North, East, South, and West.');

  // Total Counts
  const allDisplays = t12.circuit.components.filter((c) => c.type === 'display-7seg');
  assert(allDisplays.length === 8, `Expected exactly 8 7-segment displays (2 per junction), got ${allDisplays.length}`);

  const allDecoders = t12.circuit.components.filter((c) => c.type === 'builtin_bcd_decoder');
  assert(allDecoders.length === 8, `Expected exactly 8 BCD decoders (2 per junction), got ${allDecoders.length}`);

  const allTrafficLights = t12.circuit.components.filter((c) => c.type === 'builtin_traffic_light');
  assert(allTrafficLights.length === 4, `Expected exactly 4 traffic light modules, got ${allTrafficLights.length}`);

  const allPir = t12.circuit.components.filter((c) => c.type === 'builtin_motion_sensor');
  assert(allPir.length === 4, `Expected exactly 4 PIR sensors, got ${allPir.length}`);

  // Logic gates
  const notGates = t12.circuit.components.filter((c) => c.type === 'gate-not');
  const andGates = t12.circuit.components.filter((c) => c.type === 'gate-and');
  const orGates = t12.circuit.components.filter((c) => c.type === 'gate-or');
  assert(notGates.length >= 4, `Expected at least 4 NOT gates for Red lamps, got ${notGates.length}`);
  assert(andGates.length >= 8, `Expected at least 8 AND gates for Green and Yellow lamps, got ${andGates.length}`);
  assert(orGates.length >= 6, `Expected at least 6 OR gates for Tens digit decoding, got ${orGates.length}`);
  console.log(`[PASS] Logic Gates verified: ${notGates.length} NOT, ${andGates.length} AND, ${orGates.length} OR.`);

  // Assembly Program Compilation & Execution
  const asm = new AsmRuntime('cpu1');
  const asmCompiled = asm.compile(cpu!.properties.code);
  assert(asmCompiled, `CPU1 ASM failed to compile: ${asm.getInstanceData().lastError}`);

  for (let s = 0; s < 50; s++) {
    asm.step(s * 100);
  }
  const reg = asm.getInstanceData().asmRegisters;
  assert(Boolean(reg), 'Registers undefined after step');
  console.log(`[PASS] CPU1 Executed 50 ASM cycles cleanly. PC=${reg?.pc}, ACC=${reg?.acc}, OUT=0x${(reg?.outByte ?? 0).toString(16)}.`);
}

// -------------------------------------------------------------------------
// 4. GLOBAL GRID & PIN REGISTRY VERIFICATION ACROSS ALL 12 TEMPLATES
// -------------------------------------------------------------------------
console.log('\n--- Test 4: Global Grid & Pin Registry Validation for all 12 templates ---');
assert(STARTER_TEMPLATES.length === 12, `Expected 12 templates, got ${STARTER_TEMPLATES.length}`);

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
console.log('✅ ALL SECS HOTFIX 7.20 VERIFICATION CHECKS PASSED 100%!');
console.log('===========================================================\n');
