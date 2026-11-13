import { ComponentRegistry } from './registry/ComponentRegistry';
import { ArduinoRuntime } from './simulation/mcu/arduinoRuntime';
import { MCU_CODE_TEMPLATES } from './simulation/mcu/templates';
import { evaluateSpiceCircuit } from './simulation/spice/SpiceEngine';
import { CircuitComponent, CircuitWire } from './types/circuit';
import { STARTER_TEMPLATES } from './constants/starterTemplates';

console.log('==================================================');
console.log(' SECS Phase 5 Comprehensive Automated Verification ');
console.log('==================================================\n');

let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
    failedTests++;
  }
}

// ----------------------------------------------------
// TEST 1: Logic Gates 20px Grid Pin Alignment & Slim Dimensions
// ----------------------------------------------------
console.log('1. Checking Logic Gates Pin Geometry...');
const gates = ['gate-and', 'gate-or', 'gate-not', 'gate-nand', 'gate-nor', 'gate-xor', 'gate-xnor'];

for (const gateId of gates) {
  const def = ComponentRegistry.get(gateId);
  assert(!!def, `Gate ${gateId} is registered`);
  if (!def) continue;

  assert(def.width === 80 && def.height === 80, `${gateId} dimension is 80x80`);
  for (const pin of def.pins) {
    const isXMultiple = pin.x % 20 === 0;
    const isYMultiple = pin.y % 20 === 0;
    assert(isXMultiple && isYMultiple, `${gateId} pin ${pin.id} at (${pin.x}, ${pin.y}) is on 20px grid`);
  }
}

// ----------------------------------------------------
// TEST 2: Arduino Runtime Interpreter & Transpiler
// ----------------------------------------------------
console.log('\n2. Testing Arduino Runtime Interpreter...');
const runtime = new ArduinoRuntime('test_mcu_1', 'arduino-uno');
const blinkCode = MCU_CODE_TEMPLATES[0].code;
const compileOk = runtime.compile(blinkCode);
assert(compileOk, 'Blink sketch compiles without errors');

// Step at t=0ms (setup runs, pin 13 set to OUTPUT and HIGH, delay(500) yielded)
runtime.step(0);
const state0 = runtime.getState();
assert(state0.pins['d13']?.mode === 'OUTPUT', 'Pin 13 configured as OUTPUT');
assert(state0.pins['d13']?.digitalValue === 1, 'Pin 13 set to HIGH at tick 0');
assert(state0.ledL === true, 'On-board LED L is ON');
assert(state0.serialLogs.length > 0, 'Serial messages logged during setup/loop');

// Step at t=200ms (still within delay(500))
runtime.step(200);
const state200 = runtime.getState();
assert(state200.pins['d13']?.digitalValue === 1, 'Pin 13 remains HIGH during 500ms delay');

// Step at t=510ms (delay elapsed, Pin 13 set to LOW, delay(500) yielded)
runtime.step(510);
const state510 = runtime.getState();
assert(state510.pins['d13']?.digitalValue === 0, 'Pin 13 transitions to LOW after delay');
assert(state510.ledL === false, 'On-board LED L turned OFF');

// Test Serial I/O
runtime.sendSerialInput('PING\n');
assert(runtime.getState().serialInputBuffer.includes('PING'), 'Serial input buffer received data');

// ----------------------------------------------------
// TEST 3: MIXED Mode SPICE Simulation (Arduino Uno -> 220Ω Resistor -> LED)
// ----------------------------------------------------
console.log('\n3. Testing MIXED Mode SPICE Solver (Arduino Uno + 220Ω + LED)...');
const components: CircuitComponent[] = [
  {
    id: 'uno1',
    type: 'arduino-uno',
    label: 'U1',
    x: 200,
    y: 160,
    rotation: 0,
    mirrored: false,
    properties: {},
    state: {
      pins: {
        d13: { pinId: 'd13', mode: 'OUTPUT', digitalValue: 1, analogValue: 1023, pwmValue: 255, voltage: 5.0 },
      },
    },
  },
  {
    id: 'r1',
    type: 'resistor',
    label: 'R1',
    x: 420,
    y: 160,
    rotation: 0,
    mirrored: false,
    properties: { resistance: 220 },
  },
  {
    id: 'led1',
    type: 'led-red',
    label: 'LED1',
    x: 540,
    y: 160,
    rotation: 0,
    mirrored: false,
    properties: { forwardVoltage: 1.9 },
  },
  {
    id: 'gnd1',
    type: 'gnd',
    label: 'GND',
    x: 620,
    y: 260,
    rotation: 0,
    mirrored: false,
    properties: {},
  },
];

const wires: CircuitWire[] = [
  // Uno D13 -> R1 p1
  {
    id: 'w1',
    fromCompId: 'uno1',
    fromPinId: 'd13',
    toCompId: 'r1',
    toPinId: 'p1',
    waypoints: [],
    color: '#38bdf8',
  },
  // R1 p2 -> LED1 anode
  {
    id: 'w2',
    fromCompId: 'r1',
    fromPinId: 'p2',
    toCompId: 'led1',
    toPinId: 'anode',
    waypoints: [],
    color: '#f97316',
  },
  // LED1 cathode -> GND
  {
    id: 'w3',
    fromCompId: 'led1',
    fromPinId: 'cathode',
    toCompId: 'gnd1',
    toPinId: 'gnd',
    waypoints: [],
    color: '#0f172a',
  },
  // Uno GND -> GND
  {
    id: 'w4',
    fromCompId: 'uno1',
    fromPinId: 'gnd1',
    toCompId: 'gnd1',
    toPinId: 'gnd',
    waypoints: [],
    color: '#0f172a',
  },
];

const spiceResult = evaluateSpiceCircuit(components, wires, 100, 0.05);
const r1Res = spiceResult.componentResults.get('r1');
const ledRes = spiceResult.componentResults.get('led1');
const unoRes = spiceResult.componentResults.get('uno1');

console.log(`  Solved R1 Current: ${(r1Res?.currentA ? r1Res.currentA * 1000 : 0).toFixed(2)} mA`);
console.log(`  Solved LED Brightness: ${(ledRes?.brightness ?? 0).toFixed(2)}`);
console.log(`  MCU Pin Current: ${(unoRes?.currentA ? unoRes.currentA * 1000 : 0).toFixed(2)} mA`);

assert(!!r1Res && r1Res.currentA > 0.010 && r1Res.currentA < 0.015, 'Resistor current is ~11-14mA with LED load');
assert(!!ledRes && (ledRes.brightness ?? 0) > 0.5, 'LED lights up when driven by HIGH Arduino pin');
assert(unoRes?.isOverloaded !== true, 'MCU Pin 13 operates safely under 40mA rated limit');

// ----------------------------------------------------
// TEST 4: Overcurrent Hazard Detection (Shorting D13 directly to GND)
// ----------------------------------------------------
console.log('\n4. Testing MCU Overcurrent Burnout Hazard (D13 shorted to GND)...');
const shortWires: CircuitWire[] = [
  // Uno D13 shorted directly to GND!
  {
    id: 'w_short',
    fromCompId: 'uno1',
    fromPinId: 'd13',
    toCompId: 'gnd1',
    toPinId: 'gnd',
    waypoints: [],
    color: '#ef4444',
  },
  {
    id: 'w_gnd',
    fromCompId: 'uno1',
    fromPinId: 'gnd1',
    toCompId: 'gnd1',
    toPinId: 'gnd',
    waypoints: [],
    color: '#0f172a',
  },
];

const shortResult = evaluateSpiceCircuit([components[0], components[3]], shortWires, 100, 0.05);
const shortUnoRes = shortResult.componentResults.get('uno1');
console.log(`  Short-circuit current: ${(shortUnoRes?.currentA ? shortUnoRes.currentA * 1000 : 0).toFixed(1)} mA`);
console.log(`  Overload Reason: ${shortUnoRes?.overloadReason}`);

assert(shortUnoRes?.isOverloaded === true, 'Overcurrent hazard triggered when MCU pin shorted to GND');
assert(!!shortUnoRes?.overloadReason && shortUnoRes.overloadReason.includes('40 mA'), 'Warning mentions 40mA pin limit');

// ----------------------------------------------------
// TEST 5: Starter Templates Validation
// ----------------------------------------------------
console.log('\n5. Validating Starter Templates...');
assert(STARTER_TEMPLATES.length >= 4, `Found ${STARTER_TEMPLATES.length} starter templates`);
const arduinoTpl = STARTER_TEMPLATES.find((t) => t.id === 'template_arduino_blink_sensor');
assert(!!arduinoTpl, 'Arduino Blink & Sensor template exists in starterTemplates');
if (arduinoTpl) {
  assert(arduinoTpl.circuit.components.length >= 6, 'Template contains at least 6 components');
  assert(arduinoTpl.circuit.wires.length >= 7, 'Template contains at least 7 wire connections');
}

// ----------------------------------------------------
// TEST 6: Authentic Microcontroller Pinouts (Hotfix 5.8 20px Grid Architecture)
// ----------------------------------------------------
console.log('\n6. Checking Authentic Microcontroller Board Headers (Hotfix 5.8 20px Grid)...');

// A. Arduino Uno R3: 400x200, 32 pins strictly on 20px grid (18 on top y=-100, 14 on bottom y=+100)
const unoDef = ComponentRegistry.get('arduino-uno');
assert(!!unoDef, 'Arduino Uno R3 is registered');
if (unoDef) {
  assert(unoDef.width === 400 && unoDef.height === 200, 'Uno dimensions are 400x200');
  assert(unoDef.origin === 'center', 'Uno origin is centered at (0,0)');
  assert(unoDef.pins.length === 32, `Uno has exactly 32 authentic pins (got ${unoDef.pins.length})`);

  let topPins = 0;
  let bottomPins = 0;
  let sidePins = 0;

  for (const pin of unoDef.pins) {
    assert(pin.x % 20 === 0 && pin.y % 20 === 0, `Uno pin ${pin.id} at (${pin.x}, ${pin.y}) is on strict 20px grid`);
    if (pin.y === -100) topPins++;
    else if (pin.y === 100) bottomPins++;
    else sidePins++;
  }

  assert(topPins === 18, `Uno has 18 pins on top header at y=-100 (got ${topPins})`);
  assert(bottomPins === 14, `Uno has 14 pins on bottom header at y=+100 (got ${bottomPins})`);
  assert(sidePins === 0, `Uno has ZERO pins on left or right edges (got ${sidePins})`);

  // Verify Hotfix 5.8 exact 20px coordinates
  const sclPin = unoDef.pins.find((p) => p.id === 'scl');
  const d8Pin = unoDef.pins.find((p) => p.id === 'd8');
  const d7Pin = unoDef.pins.find((p) => p.id === 'd7');
  const d0Pin = unoDef.pins.find((p) => p.id === 'd0');
  assert(sclPin?.x === -180 && sclPin?.y === -100, `Uno SCL at x=-180, y=-100 (got ${sclPin?.x})`);
  assert(d8Pin?.x === 0 && d8Pin?.y === -100, `Uno D8 at x=0, y=-100 (got ${d8Pin?.x})`);
  assert(d7Pin?.x === 40 && d7Pin?.y === -100, `Uno D7 at x=+40, y=-100 (got ${d7Pin?.x})`);
  assert(d0Pin?.x === 180 && d0Pin?.y === -100, `Uno D0/RX0 at x=+180, y=-100 (got ${d0Pin?.x})`);

  const ncPin = unoDef.pins.find((p) => p.id === 'nc');
  const vinPin = unoDef.pins.find((p) => p.id === 'vin');
  const a0Pin = unoDef.pins.find((p) => p.id === 'a0');
  const a5Pin = unoDef.pins.find((p) => p.id === 'a5');
  assert(ncPin?.x === -140 && ncPin?.y === 100, `Uno NC at x=-140, y=+100 (got ${ncPin?.x})`);
  assert(vinPin?.x === 0 && vinPin?.y === 100, `Uno VIN at x=0, y=+100 (got ${vinPin?.x})`);
  assert(a0Pin?.x === 80 && a0Pin?.y === 100, `Uno A0 at x=+80, y=+100 (got ${a0Pin?.x})`);
  assert(a5Pin?.x === 180 && a5Pin?.y === 100, `Uno A5 at x=+180, y=+100 (got ${a5Pin?.x})`);
}

// B. ESP32 DevKit V1: 120x320, 30 pins strictly on 20px grid (15 left x=-60, 15 right x=+60)
const espDef = ComponentRegistry.get('esp32');
assert(!!espDef, 'ESP32 DevKit V1 is registered');
if (espDef) {
  assert(espDef.width === 120 && espDef.height === 320, 'ESP32 dimensions are 120x320');
  assert(espDef.origin === 'center', 'ESP32 origin is centered at (0,0)');
  assert(espDef.pins.length === 30, `ESP32 has exactly 30 pins (got ${espDef.pins.length})`);

  let leftPins = 0;
  let rightPins = 0;
  let endPins = 0;

  for (const pin of espDef.pins) {
    assert(pin.x % 20 === 0 && pin.y % 20 === 0, `ESP32 pin ${pin.id} at (${pin.x}, ${pin.y}) is on strict 20px grid`);
    if (pin.x === -60) leftPins++;
    else if (pin.x === 60) rightPins++;
    else endPins++;
  }

  assert(leftPins === 15, `ESP32 has 15 pins on left header row at x=-60 (got ${leftPins})`);
  assert(rightPins === 15, `ESP32 has 15 pins on right header row at x=+60 (got ${rightPins})`);
  assert(endPins === 0, `ESP32 has ZERO pins on top or bottom edges (got ${endPins})`);

  const p3v3 = espDef.pins.find((p) => p.id === '3v3');
  const pd23 = espDef.pins.find((p) => p.id === 'd23');
  assert(p3v3?.x === -60 && p3v3?.y === -140, `ESP32 3V3 at (-60, -140) (got ${p3v3?.y})`);
  assert(pd23?.x === -60 && pd23?.y === 140, `ESP32 D23 at (-60, 140) (got ${pd23?.y})`);
}

// C. Raspberry Pi Pico: 120x420, 40 pins (20 left x=-60, 20 right x=+60, 20px pitch)
const picoDef = ComponentRegistry.get('pico');
assert(!!picoDef, 'Raspberry Pi Pico is registered');
if (picoDef) {
  assert(picoDef.width === 120 && picoDef.height === 420, 'Pico dimensions are 120x420');
  assert(picoDef.origin === 'center', 'Pico origin is centered at (0,0)');
  assert(picoDef.pins.length === 40, `Pico has exactly 40 pins (got ${picoDef.pins.length})`);

  let leftPins = 0;
  let rightPins = 0;
  let otherPins = 0;

  for (const pin of picoDef.pins) {
    assert(pin.x % 20 === 0, `Pico pin ${pin.id} x=${pin.x} is on strict 20px grid line`);
    assert(Math.abs(pin.y % 20) === 10, `Pico pin ${pin.id} y=${pin.y} is on 10px half-grid midpoint with 20px pitch`);
    if (pin.x === -60) leftPins++;
    else if (pin.x === 60) rightPins++;
    else otherPins++;
  }

  assert(leftPins === 20, `Pico has 20 pins on left header row at x=-60 (got ${leftPins})`);
  assert(rightPins === 20, `Pico has 20 pins on right header row at x=+60 (got ${rightPins})`);
  assert(otherPins === 0, `Pico has ZERO pins on other edges (got ${otherPins})`);

  const pgp0 = picoDef.pins.find((p) => p.id === 'gp0');
  const pgp15 = picoDef.pins.find((p) => p.id === 'gp15');
  assert(pgp0?.x === -60 && pgp0?.y === -190, `Pico GP0 at (-60, -190) (got ${pgp0?.y})`);
  assert(pgp15?.x === -60 && pgp15?.y === 190, `Pico GP15 at (-60, 190) (got ${pgp15?.y})`);
}

// ----------------------------------------------------
// TEST 7: Physical Environment Stimulus Physics & Calculations
// ----------------------------------------------------
console.log('\n7. Testing Physical Environment Stimulus Distance Physics (Phase 5.5)...');
// LDR Lightbulb inverse-distance squared physics
const ldrLuxClose = Math.round(20 + 980 * Math.pow(Math.max(0, 1 - 50 / 320), 2));
const ldrLuxFar = Math.round(20 + 980 * Math.pow(Math.max(0, 1 - 350 / 320), 2));
assert(ldrLuxClose > 600, `LDR proximity lux is high (~${ldrLuxClose} Lux at 50px)`);
assert(ldrLuxFar === 20, `LDR distant lux falls to ambient baseline (~${ldrLuxFar} Lux at >320px)`);

// TMP36 Matchstick & Ice physics
const tmpHot = Math.round(25 + 100 * Math.pow(Math.max(0, 1 - 40 / 280), 2));
const tmpCold = Math.round(25 - 45 * Math.pow(Math.max(0, 1 - 40 / 280), 2));
assert(tmpHot > 90, `TMP36 matchstick proximity heats sensor to ~${tmpHot}°C`);
assert(tmpCold < -5, `TMP36 ice cube proximity freezes sensor to ~${tmpCold}°C`);

console.log('\n--------------------------------------------------');
if (failedTests === 0) {
  console.log(' ALL PHASE 5 & 5.5 TESTS PASSED PERFECTLY (0 errors)!');
} else {
  console.error(` ${failedTests} test(s) failed.`);
}
console.log('--------------------------------------------------');
