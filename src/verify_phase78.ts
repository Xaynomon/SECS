import { evaluateSpiceCircuit } from './simulation/spice/SpiceEngine';
import { evaluateLogicalCircuit } from './simulation/logical/LogicalEngine';
import { CircuitComponent, CircuitWire } from './types/circuit';

console.log('=== SECS PHASE 7.8 UNIVERSAL COMPONENT PHYSICS VERIFICATION ===\n');

let allPassed = true;
function assert(desc: string, cond: boolean, details?: string) {
  if (cond) {
    console.log(`  ✅ PASS: ${desc}`);
  } else {
    console.error(`  ❌ FAIL: ${desc} ${details ? `(${details})` : ''}`);
    allPassed = false;
  }
}

function mkC(id: string, type: string, properties: Record<string, any> = {}): CircuitComponent {
  return {
    id,
    type,
    label: id,
    x: 0,
    y: 0,
    rotation: 0,
    mirrored: false,
    properties,
  };
}

function mkW(id: string, fromCompId: string, fromPinId: string, toCompId: string, toPinId: string): CircuitWire {
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

// ----------------------------------------------------
// TEST 1: Zener Diode 5.1V Reverse Clamping & Power
// ----------------------------------------------------
console.log('--- TEST 1: Zener Diode Reverse Regulation & Clamping ---');
{
  // 12V DC Source -> 470 Ohm Resistor -> Zener (Cathode to resistor, Anode to GND)
  const comps: CircuitComponent[] = [
    mkC('dc1', 'dc-source', { voltage: 12 }),
    mkC('gnd1', 'gnd', {}),
    mkC('r1', 'resistor', { resistance: 470 }),
    mkC('z1', 'zener-diode', { zenerVoltage: 5.1, maxPower: 0.5 }),
  ];
  const wires: CircuitWire[] = [
    mkW('w1', 'dc1', 'pos', 'r1', 'p1'),
    mkW('w2', 'dc1', 'neg', 'gnd1', 'gnd'),
    mkW('w3', 'r1', 'p2', 'z1', 'cathode'),
    mkW('w4', 'z1', 'anode', 'gnd1', 'gnd'),
  ];

  const res = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  const zRes = res.componentResults.get('z1');
  const vCathode = zRes?.pinVoltages['cathode'] ?? 0;
  const vAnode = zRes?.pinVoltages['anode'] ?? 0;

  assert('Zener cathode clamped near 5.1V', Math.abs(vCathode - 5.1) < 0.2, `vCathode=${vCathode.toFixed(3)}V`);
  assert('Zener anode is at 0V (ground)', Math.abs(vAnode) < 0.01, `vAnode=${vAnode.toFixed(3)}V`);
  assert('Zener current is ~14.6mA', Math.abs((zRes?.currentA ?? 0) - 0.0146) < 0.003, `current=${((zRes?.currentA ?? 0) * 1000).toFixed(2)}mA`);
  assert('Zener power is ~75mW (< 0.5W max)', (zRes?.powerW ?? 0) < 0.5 && (zRes?.powerW ?? 0) > 0.05, `power=${((zRes?.powerW ?? 0) * 1000).toFixed(1)}mW`);
  assert('Zener NOT burned out in normal regulation', zRes?.isBurned !== true && zRes?.isOverloaded !== true);
}

// ----------------------------------------------------
// TEST 2: LM7805 Voltage Regulator & Input Current Coupling
// ----------------------------------------------------
console.log('\n--- TEST 2: LM7805 Regulator & Input Current Coupling ---');
{
  // 12V DC Source -> LM7805 -> 100 Ohm load to GND
  const comps: CircuitComponent[] = [
    mkC('dc1', 'dc-source', { voltage: 12 }),
    mkC('gnd1', 'gnd', {}),
    mkC('reg1', 'builtin_reg_7805', {}),
    mkC('rload', 'resistor', { resistance: 100 }),
  ];
  const wires: CircuitWire[] = [
    mkW('w1', 'dc1', 'pos', 'reg1', 'in'),
    mkW('w2', 'dc1', 'neg', 'gnd1', 'gnd'),
    mkW('w3', 'reg1', 'gnd', 'gnd1', 'gnd'),
    mkW('w4', 'reg1', 'out', 'rload', 'p1'),
    mkW('w5', 'rload', 'p2', 'gnd1', 'gnd'),
  ];

  const res = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  const regRes = res.componentResults.get('reg1');
  const rRes = res.componentResults.get('rload');
  const vOut = regRes?.outputVoltage ?? regRes?.pinVoltages['out'] ?? 0;

  assert('LM7805 regulates output to ~5.0V', Math.abs(vOut - 5.0) < 0.1, `vOut=${vOut.toFixed(2)}V`);
  assert('Load resistor draws ~50mA', Math.abs((rRes?.currentA ?? 0) - 0.05) < 0.005, `iLoad=${((rRes?.currentA ?? 0) * 1000).toFixed(1)}mA`);
  assert('LM7805 draws load + quiescent current (~52mA)', Math.abs((regRes?.currentA ?? 0) - 0.052) < 0.005, `iIn=${((regRes?.currentA ?? 0) * 1000).toFixed(1)}mA`);
}

// ----------------------------------------------------
// TEST 3: DC-DC Buck-Boost Converter Power Conservation
// ----------------------------------------------------
console.log('\n--- TEST 3: DC-DC Converter Power Conservation ---');
{
  // 12V DC Source -> DC-DC (Target 5V) -> 50 Ohm load
  const comps: CircuitComponent[] = [
    mkC('dc1', 'dc-source', { voltage: 12 }),
    mkC('gnd1', 'gnd', {}),
    mkC('dcdc1', 'builtin_dcdc_converter', { targetVoltage: 5.0 }),
    mkC('rload', 'resistor', { resistance: 50 }),
  ];
  const wires: CircuitWire[] = [
    mkW('w1', 'dc1', 'pos', 'dcdc1', 'vin_plus'),
    mkW('w2', 'dc1', 'neg', 'gnd1', 'gnd'),
    mkW('w3', 'dcdc1', 'vin_minus', 'gnd1', 'gnd'),
    mkW('w4', 'dcdc1', 'vout_plus', 'rload', 'p1'),
    mkW('w5', 'dcdc1', 'vout_minus', 'gnd1', 'gnd'),
    mkW('w6', 'rload', 'p2', 'gnd1', 'gnd'),
  ];

  const res = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  const dcdcRes = res.componentResults.get('dcdc1');
  const vOut = dcdcRes?.outputVoltage ?? dcdcRes?.pinVoltages['vout_plus'] ?? 0;

  assert('DC-DC outputs 5.0V', Math.abs(vOut - 5.0) < 0.1, `vOut=${vOut.toFixed(2)}V`);
  assert('DC-DC input current ~50mA conserving Pin = Pout/0.9', (dcdcRes?.currentA ?? 0) > 0.04 && (dcdcRes?.currentA ?? 0) < 0.07, `iIn=${((dcdcRes?.currentA ?? 0) * 1000).toFixed(1)}mA`);
}

// ----------------------------------------------------
// TEST 4: Operational Amplifier (LM358)
// ----------------------------------------------------
console.log('\n--- TEST 4: Operational Amplifier (LM358) Closed-Loop Follower ---');
{
  // 5V DC -> Voltage Divider (2.5V) -> Op-Amp Voltage Follower (out tied to in_neg)
  const comps: CircuitComponent[] = [
    mkC('dc1', 'dc-source', { voltage: 5.0 }),
    mkC('gnd1', 'gnd', {}),
    mkC('r1', 'resistor', { resistance: 10000 }),
    mkC('r2', 'resistor', { resistance: 10000 }),
    mkC('op1', 'opamp', { openLoopGain: 10000 }),
  ];
  const wires: CircuitWire[] = [
    mkW('w1', 'dc1', 'pos', 'r1', 'p1'),
    mkW('w2', 'dc1', 'pos', 'op1', 'v_pos'),
    mkW('w3', 'dc1', 'neg', 'gnd1', 'gnd'),
    mkW('w4', 'r1', 'p2', 'r2', 'p1'),
    mkW('w5', 'r2', 'p2', 'gnd1', 'gnd'),
    mkW('w6', 'op1', 'v_neg', 'gnd1', 'gnd'),
    // Input to non-inverting terminal from divider midpoint (2.5V)
    mkW('w7', 'r1', 'p2', 'op1', 'in_pos'),
    // Feedback: out connected to in_neg (voltage follower)
    mkW('w8', 'op1', 'out', 'op1', 'in_neg'),
  ];

  const res = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  const opRes = res.componentResults.get('op1');
  const vOut = opRes?.pinVoltages['out'] ?? 0;
  const vPos = opRes?.pinVoltages['in_pos'] ?? 0;

  assert('Voltage divider midpoint is 2.5V', Math.abs(vPos - 2.5) < 0.05, `vPos=${vPos.toFixed(3)}V`);
  assert('Op-Amp follower output matches non-inverting input (2.5V)', Math.abs(vOut - 2.5) < 0.05, `vOut=${vOut.toFixed(3)}V`);
}

// ----------------------------------------------------
// TEST 5: Comparator (LM393)
// ----------------------------------------------------
console.log('\n--- TEST 5: Voltage Comparator (LM393) Dynamic Switching ---');
{
  // Comp 1: IN+ (3V) > IN- (2V) -> Out = 5V
  // Comp 2: IN+ (1V) < IN- (2V) -> Out = 0V
  const comps: CircuitComponent[] = [
    mkC('dc5', 'dc-source', { voltage: 5.0 }),
    mkC('dcRef', 'dc-source', { voltage: 2.0 }),
    mkC('dcHigh', 'dc-source', { voltage: 3.0 }),
    mkC('dcLow', 'dc-source', { voltage: 1.0 }),
    mkC('gnd1', 'gnd', {}),
    mkC('cmp1', 'builtin_comparator', {}),
    mkC('cmp2', 'builtin_comparator', {}),
  ];
  const wires: CircuitWire[] = [
    mkW('w0', 'dc5', 'neg', 'gnd1', 'gnd'),
    mkW('w1', 'dcRef', 'neg', 'gnd1', 'gnd'),
    mkW('w2', 'dcHigh', 'neg', 'gnd1', 'gnd'),
    mkW('w3', 'dcLow', 'neg', 'gnd1', 'gnd'),
    mkW('w4', 'cmp1', 'gnd', 'gnd1', 'gnd'),
    mkW('w5', 'cmp2', 'gnd', 'gnd1', 'gnd'),
    mkW('w6', 'dc5', 'pos', 'cmp1', 'vcc'),
    mkW('w7', 'dc5', 'pos', 'cmp2', 'vcc'),
    // cmp1: IN+ = 3V, IN- = 2V
    mkW('w8', 'dcHigh', 'pos', 'cmp1', 'in_plus'),
    mkW('w9', 'dcRef', 'pos', 'cmp1', 'in_minus'),
    // cmp2: IN+ = 1V, IN- = 2V
    mkW('w10', 'dcLow', 'pos', 'cmp2', 'in_plus'),
    mkW('w11', 'dcRef', 'pos', 'cmp2', 'in_minus'),
  ];

  const res = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  const cmp1Out = res.componentResults.get('cmp1')?.pinVoltages['out'] ?? 0;
  const cmp2Out = res.componentResults.get('cmp2')?.pinVoltages['out'] ?? 0;

  assert('Comparator 1 (3V > 2V) outputs 5.0V HIGH', Math.abs(cmp1Out - 5.0) < 0.2, `cmp1Out=${cmp1Out.toFixed(2)}V`);
  assert('Comparator 2 (1V < 2V) outputs 0.0V LOW', Math.abs(cmp2Out) < 0.2, `cmp2Out=${cmp2Out.toFixed(2)}V`);
}

// ----------------------------------------------------
// TEST 6: Relay Module (Coil Activation & Contacts)
// ----------------------------------------------------
console.log('\n--- TEST 6: Electromechanical Relay Module ---');
{
  // Test Active LOW Trigger:
  // Relay 1: VCC=5V, GND=0V, IN=0V -> Engaged (NO connected to COM)
  // Relay 2: VCC=5V, GND=0V, IN=5V -> Unengaged (NC connected to COM)
  const comps: CircuitComponent[] = [
    mkC('dc5', 'dc-source', { voltage: 5.0 }),
    mkC('gnd1', 'gnd', {}),
    mkC('rly1', 'relay', { triggerActive: 'LOW' }),
    mkC('rly2', 'relay', { triggerActive: 'LOW' }),
  ];
  const wires: CircuitWire[] = [
    mkW('w1', 'dc5', 'neg', 'gnd1', 'gnd'),
    // Relay 1: VCC=5V, GND=GND, IN=GND (Active LOW)
    mkW('w2', 'dc5', 'pos', 'rly1', 'vcc'),
    mkW('w3', 'rly1', 'gnd', 'gnd1', 'gnd'),
    mkW('w4', 'rly1', 'in', 'gnd1', 'gnd'),
    // Relay 2: VCC=5V, GND=GND, IN=5V (Inactive)
    mkW('w5', 'dc5', 'pos', 'rly2', 'vcc'),
    mkW('w6', 'rly2', 'gnd', 'gnd1', 'gnd'),
    mkW('w7', 'dc5', 'pos', 'rly2', 'in'),
  ];

  const res = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  const rly1Res = res.componentResults.get('rly1');
  const rly2Res = res.componentResults.get('rly2');

  assert('Relay 1 (IN=0V, active LOW) is ENGAGED', rly1Res?.isEngaged === true, `isEngaged=${rly1Res?.isEngaged}`);
  assert('Relay 2 (IN=5V, active LOW) is NOT engaged', rly2Res?.isEngaged === false, `isEngaged=${rly2Res?.isEngaged}`);
}

// ----------------------------------------------------
// TEST 7: Transistors & MOSFETs Switching
// ----------------------------------------------------
console.log('\n--- TEST 7: Transistor & MOSFET Switching Conduction ---');
{
  // NPN Transistor & N-MOSFET switching loads
  const comps: CircuitComponent[] = [
    mkC('dc10', 'dc-source', { voltage: 10.0 }),
    mkC('dc5', 'dc-source', { voltage: 5.0 }),
    mkC('gnd1', 'gnd', {}),
    mkC('rBase', 'resistor', { resistance: 1000 }),
    mkC('rCol', 'resistor', { resistance: 100 }),
    mkC('q1', 'transistor-npn', { gainHfe: 100 }),
    mkC('rDrain', 'resistor', { resistance: 50 }),
    mkC('m1', 'mosfet-n', { rdsOn: 0.5 }),
  ];
  const wires: CircuitWire[] = [
    mkW('w0', 'dc10', 'neg', 'gnd1', 'gnd'),
    mkW('w1', 'dc5', 'neg', 'gnd1', 'gnd'),
    // NPN: 5V -> 1k -> Base, 10V -> 100 -> Collector, Emitter -> GND
    mkW('w2', 'dc5', 'pos', 'rBase', 'p1'),
    mkW('w3', 'rBase', 'p2', 'q1', 'base'),
    mkW('w4', 'dc10', 'pos', 'rCol', 'p1'),
    mkW('w5', 'rCol', 'p2', 'q1', 'collector'),
    mkW('w6', 'q1', 'emitter', 'gnd1', 'gnd'),
    // NMOS: Gate -> 5V, 10V -> 50 -> Drain, Source -> GND
    mkW('w7', 'dc5', 'pos', 'm1', 'gate'),
    mkW('w8', 'dc10', 'pos', 'rDrain', 'p1'),
    mkW('w9', 'rDrain', 'p2', 'm1', 'drain'),
    mkW('w10', 'm1', 'source', 'gnd1', 'gnd'),
  ];

  const res = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  const qRes = res.componentResults.get('q1');
  const mRes = res.componentResults.get('m1');
  const vCol = qRes?.pinVoltages['collector'] ?? 0;
  const vDrain = mRes?.pinVoltages['drain'] ?? 0;

  assert('NPN BJT pulls collector low (saturated conduction, Vce < 1V)', vCol < 1.0, `vCol=${vCol.toFixed(2)}V`);
  assert('N-MOSFET conducts and pulls drain low (Vds < 0.2V)', vDrain < 0.2, `vDrain=${vDrain.toFixed(2)}V`);
}

// ----------------------------------------------------
// TEST 8: 555 Timer Configurable Frequency & Duty Cycle
// ----------------------------------------------------
console.log('\n--- TEST 8: 555 Timer Configurable Frequency & Duty Cycle ---');
{
  const comps: CircuitComponent[] = [
    mkC('dc5', 'dc-source', { voltage: 5.0 }),
    mkC('gnd1', 'gnd', {}),
    mkC('t555', 'ic-555', { frequency: 2.0, dutyCycle: 50 }),
  ];
  const wires: CircuitWire[] = [
    mkW('w1', 'dc5', 'neg', 'gnd1', 'gnd'),
    mkW('w2', 'dc5', 'pos', 't555', 'pin8_vcc'),
    mkW('w3', 't555', 'pin1_gnd', 'gnd1', 'gnd'),
  ];

  // At 2Hz, period is 500ms. Phase at 100ms should be HIGH (0.1*2 = 0.2 < 0.5)
  const resHigh = evaluateLogicalCircuit(comps, wires, 100);
  const outHigh = resHigh.pinStates.get('t555:pin3_out');

  // Phase at 350ms should be LOW (0.35*2 = 0.7 >= 0.5)
  const resLow = evaluateLogicalCircuit(comps, wires, 350);
  const outLow = resLow.pinStates.get('t555:pin3_out');

  assert('555 Timer produces HIGH at t=100ms', outHigh === 1, `outHigh=${outHigh}`);
  assert('555 Timer produces LOW at t=350ms', outLow === 0, `outLow=${outLow}`);
}

console.log('\n======================================================');
if (allPassed) {
  console.log('🎉 ALL PHASE 7.8 COMPONENT PHYSICS TESTS PASSED WITH 100% PARITY!');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED.');
  process.exit(1);
}
