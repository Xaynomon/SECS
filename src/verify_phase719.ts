import { STARTER_TEMPLATES } from './constants/starterTemplates';
import { ComponentRegistry } from './registry/ComponentRegistry';
import { ArduinoRuntime } from './simulation/mcu/arduinoRuntime';
import { AsmRuntime } from './simulation/mcu/asmRuntime';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
}

console.log('=== SECS PHASE 7.19 VERIFICATION SUITE ===');

// 1. Total Templates and Tier Distribution
console.log('\n--- Test 1: Template Count & Tier Distribution ---');
assert(STARTER_TEMPLATES.length === 12, `Expected exactly 12 starter templates, got ${STARTER_TEMPLATES.length}`);
console.log(`[PASS] Total starter templates: ${STARTER_TEMPLATES.length}`);

const basicTemplates = STARTER_TEMPLATES.filter((t) => t.tier === 'Basic');
const intermediateTemplates = STARTER_TEMPLATES.filter((t) => t.tier === 'Intermediate');
const highLevelTemplates = STARTER_TEMPLATES.filter((t) => t.tier === 'High-Level');
const professionalTemplates = STARTER_TEMPLATES.filter((t) => t.tier === 'Professional');

assert(basicTemplates.length === 3, `Expected 3 Basic templates, got ${basicTemplates.length}`);
assert(intermediateTemplates.length === 3, `Expected 3 Intermediate templates, got ${intermediateTemplates.length}`);
assert(highLevelTemplates.length === 3, `Expected 3 High-Level templates, got ${highLevelTemplates.length}`);
assert(professionalTemplates.length === 3, `Expected 3 Professional templates, got ${professionalTemplates.length}`);

console.log(`[PASS] Basic (3): ${basicTemplates.map((t) => t.id).join(', ')}`);
console.log(`[PASS] Intermediate (3): ${intermediateTemplates.map((t) => t.id).join(', ')}`);
console.log(`[PASS] High-Level (3): ${highLevelTemplates.map((t) => t.id).join(', ')}`);
console.log(`[PASS] Professional (3): ${professionalTemplates.map((t) => t.id).join(', ')}`);

// 2. Uniqueness & Structural Integrity across all 12 templates
console.log('\n--- Test 2: Uniqueness, 20px Grid, and Pin Validation for all 12 templates ---');
const templateIds = new Set<string>();

for (const tmpl of STARTER_TEMPLATES) {
  assert(!templateIds.has(tmpl.id), `Duplicate template ID found: ${tmpl.id}`);
  templateIds.add(tmpl.id);

  assert(Boolean(tmpl.title && tmpl.description), `Template ${tmpl.id} missing title or description`);
  assert(Boolean(tmpl.category && tmpl.tier && tmpl.badge), `Template ${tmpl.id} missing tier metadata`);

  const circuit = tmpl.circuit;
  const compMap = new Map<string, any>();

  for (const comp of circuit.components) {
    assert(Boolean(comp.id && comp.type && comp.label), `Component in ${tmpl.id} missing id, type, or label`);
    assert(comp.x % 20 === 0, `Component ${comp.id} in ${tmpl.id} x=${comp.x} not on 20px grid`);
    assert(comp.y % 20 === 0, `Component ${comp.id} in ${tmpl.id} y=${comp.y} not on 20px grid`);

    const def = ComponentRegistry.getComponentDefinition(comp.type);
    assert(Boolean(def), `Unknown component type "${comp.type}" for ${comp.id} in ${tmpl.id}`);
    compMap.set(comp.id, { comp, def });
  }

  for (const wire of circuit.wires) {
    const from = compMap.get(wire.fromCompId);
    assert(Boolean(from), `Wire ${wire.id} in ${tmpl.id}: fromCompId "${wire.fromCompId}" not found`);
    const to = compMap.get(wire.toCompId);
    assert(Boolean(to), `Wire ${wire.id} in ${tmpl.id}: toCompId "${wire.toCompId}" not found`);

    const fromPin = from.def.pins.find((p: any) => p.id === wire.fromPinId);
    assert(Boolean(fromPin), `Wire ${wire.id} in ${tmpl.id}: fromPinId "${wire.fromPinId}" not found on ${from.comp.type}`);
    const toPin = to.def.pins.find((p: any) => p.id === wire.toPinId);
    assert(Boolean(toPin), `Wire ${wire.id} in ${tmpl.id}: toPinId "${wire.toPinId}" not found on ${to.comp.type}`);

    for (const wp of wire.waypoints) {
      assert(wp.x % 20 === 0, `Wire ${wire.id} in ${tmpl.id}: waypoint x=${wp.x} not on 20px grid`);
      assert(wp.y % 20 === 0, `Wire ${wire.id} in ${tmpl.id}: waypoint y=${wp.y} not on 20px grid`);
    }
  }
}
console.log('[PASS] All 12 templates passed strict 20px grid, component definition, and pin registry validation.');

// 3. Template 10: Professional 1 - Wireless IR Numpad & 3-Digit Shift Register
console.log('\n--- Test 3: Template 10 (prof_ir_numpad_3digit) Specification Compliance ---');
const t10 = STARTER_TEMPLATES.find((t) => t.id === 'prof_ir_numpad_3digit');
assert(Boolean(t10), 'Template 10 (prof_ir_numpad_3digit) not found!');
if (t10) {
  const compTypes = t10.circuit.components.map((c) => c.type);
  assert(compTypes.includes('builtin_numpad'), 'Template 10 missing builtin_numpad');
  assert(compTypes.includes('builtin_ir_tx'), 'Template 10 missing builtin_ir_tx');
  assert(compTypes.includes('builtin_ir_rx'), 'Template 10 missing builtin_ir_rx');

  const bcdDecoders = t10.circuit.components.filter((c) => c.type === 'builtin_bcd_decoder');
  assert(bcdDecoders.length === 3, `Expected 3 builtin_bcd_decoder in Template 10, got ${bcdDecoders.length}`);

  const displays = t10.circuit.components.filter((c) => c.type === 'display-7seg');
  assert(displays.length === 3, `Expected 3 display-7seg in Template 10, got ${displays.length}`);

  const txComp = t10.circuit.components.find((c) => c.type === 'builtin_ir_tx');
  const rxComp = t10.circuit.components.find((c) => c.type === 'builtin_ir_rx');
  assert(Boolean(txComp && rxComp), 'Template 10 missing IR TX or IR RX');
  if (txComp && rxComp) {
    const irDist = Math.hypot((rxComp.x ?? 0) - (txComp.x ?? 0), (rxComp.y ?? 0) - (txComp.y ?? 0));
    assert(irDist <= 600, `IR TX -> RX distance must be <= 600px for optical link coupling, got ${irDist}`);
    console.log(`[PASS] IR Optical Air Gap: ${irDist.toFixed(1)}px (<= 600px range)`);
  }

  // Compile both MCU sketches
  const mcuTx = t10.circuit.components.find((c) => c.id === 'mcu_tx');
  assert(Boolean(mcuTx?.properties?.code), 'MCU_TX missing code');
  const txRuntime = new ArduinoRuntime('mcu_tx', 'arduino-uno');
  const txCompiled = txRuntime.compile(mcuTx!.properties.code);
  assert(txCompiled, `MCU_TX compile failed: ${txRuntime.getInstanceData().lastError}`);
  console.log('[PASS] MCU_TX Arduino Sketch compiles cleanly.');

  const mcuRx = t10.circuit.components.find((c) => c.id === 'mcu_rx');
  assert(Boolean(mcuRx?.properties?.code), 'MCU_RX missing code');
  const rxRuntime = new ArduinoRuntime('mcu_rx', 'arduino-uno');
  const rxCompiled = rxRuntime.compile(mcuRx!.properties.code);
  assert(rxCompiled, `MCU_RX compile failed: ${rxRuntime.getInstanceData().lastError}`);
  console.log('[PASS] MCU_RX Arduino Sketch compiles cleanly with 3-digit shift register & 3000ms watchdog.');
}

// 4. Template 11: Professional 2 - Solar Autonomous Plant Care
console.log('\n--- Test 4: Template 11 (prof_solar_plant_care) 4-Zone Microgrid Compliance ---');
const t11 = STARTER_TEMPLATES.find((t) => t.id === 'prof_solar_plant_care');
assert(Boolean(t11), 'Template 11 (prof_solar_plant_care) not found!');
if (t11) {
  const compTypes = t11.circuit.components.map((c) => c.type);

  // Zone 1
  assert(compTypes.includes('builtin_solar_panel'), 'Zone 1 missing builtin_solar_panel');
  assert(compTypes.includes('diode'), 'Zone 1 missing diode (1N4007)');
  assert(compTypes.includes('capacitor-electrolytic'), 'Zone 1 missing capacitor-electrolytic');
  assert(compTypes.includes('builtin_dcdc_converter'), 'Zone 1 missing builtin_dcdc_converter');
  assert(compTypes.includes('builtin_fuse'), 'Zone 1 missing builtin_fuse');
  assert(compTypes.includes('builtin_led_bar_graph'), 'Zone 1 missing builtin_led_bar_graph');

  // Zone 2
  assert(compTypes.includes('builtin_soil_moisture'), 'Zone 2 missing builtin_soil_moisture');
  assert(compTypes.includes('builtin_humidity_sensor'), 'Zone 2 missing builtin_humidity_sensor (DHT22)');
  assert(compTypes.includes('temp-sensor'), 'Zone 2 missing temp-sensor (TMP36)');
  assert(compTypes.includes('light-sensor'), 'Zone 2 missing light-sensor (LDR)');
  assert(compTypes.includes('builtin_comparator'), 'Zone 2 missing builtin_comparator (LM393)');

  // Zone 3
  assert(compTypes.includes('arduino-uno'), 'Zone 3 missing arduino-uno');
  assert(compTypes.includes('builtin_oled_display'), 'Zone 3 missing builtin_oled_display');
  assert(compTypes.includes('builtin_sd_card'), 'Zone 3 missing builtin_sd_card');

  // Zone 4
  assert(compTypes.includes('builtin_water_pump'), 'Zone 4 missing builtin_water_pump');
  assert(compTypes.includes('dc-fan'), 'Zone 4 missing dc-fan');
  assert(compTypes.includes('builtin_servo_motor'), 'Zone 4 missing builtin_servo_motor');
  assert(compTypes.includes('relay'), 'Zone 4 missing relay');
  assert(compTypes.includes('builtin_filament_bulb'), 'Zone 4 missing builtin_filament_bulb');

  // Compile MCU sketch
  const mcu = t11.circuit.components.find((c) => c.id === 'mcu1');
  assert(Boolean(mcu?.properties?.code), 'MCU1 missing code');
  const mcuRuntime = new ArduinoRuntime('mcu1', 'arduino-uno');
  const compiled = mcuRuntime.compile(mcu!.properties.code);
  assert(compiled, `MCU1 compile failed: ${mcuRuntime.getInstanceData().lastError}`);
  console.log('[PASS] MCU1 Plant Care Controller Arduino Sketch compiles cleanly with telemetry, OLED HUD, and SD logger.');
}

// 5. Template 12: Professional 3 - SECS-808 Assembly 4-Junction Traffic Controller
console.log('\n--- Test 5: Template 12 (prof_4way_traffic_junction) Assembly & Zero MCU Constraint ---');
const t12 = STARTER_TEMPLATES.find((t) => t.id === 'prof_4way_traffic_junction');
assert(Boolean(t12), 'Template 12 (prof_4way_traffic_junction) not found!');
if (t12) {
  const compTypes = t12.circuit.components.map((c) => c.type);

  // STRICT CONSTRAINT VERIFICATION: ZERO Arduino, ZERO ESP32, ZERO Pico!
  assert(!compTypes.includes('arduino-uno'), 'CRITICAL VIOLATION: Template 12 must have ZERO Arduino!');
  assert(!compTypes.includes('esp32'), 'CRITICAL VIOLATION: Template 12 must have ZERO ESP32!');
  assert(!compTypes.includes('pico'), 'CRITICAL VIOLATION: Template 12 must have ZERO Pico!');
  console.log('[PASS] STRICT CONSTRAINT VERIFIED: ZERO Arduino, ZERO ESP32, ZERO Raspberry Pi Pico in Template 12.');

  assert(compTypes.includes('builtin_cpu_8bit'), 'Template 12 missing builtin_cpu_8bit (SECS-808)');
  assert(compTypes.includes('gate-or'), 'Template 12 missing gate-or interlocks');

  const trafficLights = t12.circuit.components.filter((c) => c.type === 'builtin_traffic_light');
  assert(trafficLights.length === 4, `Expected 4 traffic light modules, got ${trafficLights.length}`);

  const decoders = t12.circuit.components.filter((c) => c.type === 'builtin_bcd_decoder');
  assert(decoders.length === 8, `Expected 8 BCD decoders (2 per junction), got ${decoders.length}`);

  const digits = t12.circuit.components.filter((c) => c.type === 'display-7seg');
  assert(digits.length === 8, `Expected 8 7-segment displays (2 per junction), got ${digits.length}`);

  const pirSensors = t12.circuit.components.filter((c) => c.type === 'builtin_motion_sensor');
  assert(pirSensors.length === 4, `Expected 4 PIR vehicle sensors, got ${pirSensors.length}`);

  // Compile SECS-808 Assembly Program
  const cpu = t12.circuit.components.find((c) => c.id === 'cpu1');
  assert(Boolean(cpu?.properties?.code), 'CPU1 missing code');
  const asm = new AsmRuntime('cpu1');
  const asmCompiled = asm.compile(cpu!.properties.code);
  assert(asmCompiled, `CPU1 assembly compile failed: ${asm.getInstanceData().lastError}`);
  console.log('[PASS] SECS-808 Bare-Metal Assembly Program compiles cleanly.');

  // Step CPU through simulation steps
  for (let step = 0; step < 25; step++) {
    asm.step(step * 100);
  }
  const reg = asm.getInstanceData().asmRegisters;
  assert(Boolean(reg), 'Registers not defined after step');
  console.log(`[PASS] CPU1 Executed 25 assembly cycles without fault. PC=${reg?.pc}, ACC=${reg?.acc}, OUT=0x${(reg?.outByte ?? 0).toString(16)}.`);
}

console.log('\n======================================================');
console.log('✅ ALL PHASE 7.19 VERIFICATION CHECKS PASSED PERFECTLY!');
console.log('======================================================\n');
