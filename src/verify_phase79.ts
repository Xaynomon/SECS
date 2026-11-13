import { ComponentRegistry } from './registry/ComponentRegistry';
import { evaluateLogicalCircuit } from './simulation/logical/LogicalEngine';
import { evaluateSpiceCircuit } from './simulation/spice/SpiceEngine';
import { CircuitComponent, CircuitWire } from './types/circuit';

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

console.log('=== SECS Phase 7.9 Verification Suite ===\n');

// ---------------------------------------------------------------------------
// 1. Verify 20px Grid Pin Alignment & Registry Metadata for all 11 new IDs
// ---------------------------------------------------------------------------
const phase79Ids = [
  'builtin_soil_moisture',
  'builtin_traffic_light',
  'builtin_water_pump',
  'builtin_filament_bulb',
  'builtin_rf_radio',
  'builtin_ir_tx',
  'builtin_ir_rx',
  'builtin_hall_sensor',
  'builtin_vibration_sensor',
  'builtin_solenoid',
  'builtin_speaker',
];

for (const id of phase79Ids) {
  const def = ComponentRegistry.get(id);
  assert(!!def, `Component ${id} must be registered in ComponentRegistry`);
  assert(def!.origin === 'center', `${id} must use center origin`);
  assert(
    def!.width % 20 === 0 && def!.height % 20 === 0,
    `${id} dimensions (${def!.width}x${def!.height}) must be multiples of 20px`
  );
  for (const pin of def!.pins) {
    assert(
      pin.x % 20 === 0 && pin.y % 20 === 0,
      `${id} pin ${pin.id} (${pin.x}, ${pin.y}) must be an exact multiple of 20px`
    );
  }
}
console.log('[PASS] 1. All 11 Phase 7.9 components registered with strict 20px grid pin alignment');

// ---------------------------------------------------------------------------
// 2. Soil Moisture Sensor (`builtin_soil_moisture`)
// ---------------------------------------------------------------------------
{
  const comps: CircuitComponent[] = [
    makeComp('dc1', 'dc-source', 0, 0, { voltage: 5.0 }),
    makeComp('gnd', 'gnd', 0, 100, {}),
    makeComp('soil', 'builtin_soil_moisture', 100, 0, {
      moisture: 20,
      threshold: 50,
      triggerOnDry: false,
      maxVoltage: 6.5,
    }),
    makeComp('led', 'led', 200, 0, { color: 'green', forwardVoltage: 2.0 }),
    makeComp('r1', 'resistor', 200, 60, { resistance: 220 }),
  ];
  const wires: CircuitWire[] = [
    makeWire('w0', 'dc1', 'neg', 'gnd', 'gnd'),
    makeWire('w1', 'dc1', 'pos', 'soil', 'vcc'),
    makeWire('w2', 'gnd', 'gnd', 'soil', 'gnd'),
    makeWire('w3', 'soil', 'out', 'led', 'anode'),
    makeWire('w4', 'led', 'cathode', 'r1', 'p1'),
    makeWire('w5', 'r1', 'p2', 'gnd', 'gnd'),
  ];

  // Baseline dry (20% < 50%): OUT = 0 / 0V
  const logDry = evaluateLogicalCircuit(comps, wires);
  assert(logDry.componentStates.get('led')?.lit === false, 'Soil dry (20%): LED should be OFF in Logical mode');
  const spiceDry = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  assert(
    Math.abs(spiceDry.componentResults.get('soil')?.outputVoltage ?? 99) < 0.2,
    `Soil dry (20%): Analog OUT should be ~0V, got ${spiceDry.componentResults.get('soil')?.outputVoltage}`
  );

  // Wet (80% >= 50%): OUT = 1 / 5V
  comps[2].properties.moisture = 80;
  const logWet = evaluateLogicalCircuit(comps, wires);
  assert(logWet.componentStates.get('led')?.lit === true, 'Soil wet (80%): LED should be ON in Logical mode');
  const spiceWet = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  assert(
    (spiceWet.componentResults.get('soil')?.outputVoltage ?? 0) > 4.5,
    `Soil wet (80%): Analog OUT should be ~5V, got ${spiceWet.componentResults.get('soil')?.outputVoltage}`
  );

  // Invert Mode (triggerOnDry = true, moisture = 20% <= 50%): OUT = 1 / 5V
  comps[2].properties.moisture = 20;
  comps[2].properties.triggerOnDry = true;
  const logDryTrig = evaluateLogicalCircuit(comps, wires);
  assert(logDryTrig.componentStates.get('led')?.lit === true, 'Soil triggerOnDry (20%): LED should be ON');
  const spiceDryTrig = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  assert(
    (spiceDryTrig.componentResults.get('soil')?.outputVoltage ?? 0) > 4.5,
    `Soil triggerOnDry (20%): Analog OUT should be ~5V`
  );

  // Overvoltage burnout (> 6.5V)
  comps[0].properties.voltage = 12.0;
  const spiceOver = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  assert(spiceOver.componentResults.get('soil')?.isBurned === true, 'Soil sensor should burn out at 12V (> 6.5V)');
}
console.log('[PASS] 2. Soil Moisture Sensor (`builtin_soil_moisture`) verified in Logical & Analog modes');

// ---------------------------------------------------------------------------
// 3. Traffic Light LED Module (`builtin_traffic_light`)
// ---------------------------------------------------------------------------
{
  const comps: CircuitComponent[] = [
    makeComp('dc1', 'dc-source', 0, 0, { voltage: 5.0 }),
    makeComp('gnd', 'gnd', 0, 100, {}),
    makeComp('tl', 'builtin_traffic_light', 100, 0, { maxVoltage: 12.0 }),
  ];
  const wiresRG: CircuitWire[] = [
    makeWire('w0', 'dc1', 'neg', 'gnd', 'gnd'),
    makeWire('w_r', 'dc1', 'pos', 'tl', 'r'),
    makeWire('w_g', 'dc1', 'pos', 'tl', 'g'),
    makeWire('w_gnd', 'tl', 'gnd', 'gnd', 'gnd'),
  ];

  const logTL = evaluateLogicalCircuit(comps, wiresRG);
  assert(logTL.componentStates.get('tl')?.redLit === true, 'Traffic Light Red should be lit in Logical');
  assert(logTL.componentStates.get('tl')?.yellowLit === false, 'Traffic Light Yellow should be OFF in Logical');
  assert(logTL.componentStates.get('tl')?.greenLit === true, 'Traffic Light Green should be lit in Logical');

  const spiceTL = evaluateSpiceCircuit(comps, wiresRG, 0, 0.001);
  assert(spiceTL.componentResults.get('tl')?.redLit === true, 'Traffic Light Red should be lit in Analog');
  assert(spiceTL.componentResults.get('tl')?.yellowLit === false, 'Traffic Light Yellow should be OFF in Analog');
  assert(spiceTL.componentResults.get('tl')?.greenLit === true, 'Traffic Light Green should be lit in Analog');
  // Each lit lamp draws (5V - 2V) / 150Ω = 20mA -> 2 lamps = 40mA
  assert(
    Math.abs((spiceTL.componentResults.get('tl')?.currentA ?? 0) - 0.04) < 0.005,
    `Traffic Light current with 2 lamps at 5V should be ~40mA, got ${spiceTL.componentResults.get('tl')?.currentA}`
  );

  // Without GND connected, lamps must not light
  const logNoGnd = evaluateLogicalCircuit(comps, [wiresRG[0], wiresRG[1], wiresRG[2]]);
  assert(logNoGnd.componentStates.get('tl')?.redLit === false, 'Traffic Light without GND must be OFF in Logical');

  // Overvoltage burnout (> 12V)
  comps[0].properties.voltage = 18.0;
  const spiceTLBurn = evaluateSpiceCircuit(comps, wiresRG, 0, 0.001);
  assert(spiceTLBurn.componentResults.get('tl')?.isBurned === true, 'Traffic Light should burn out at 18V (> 12V)');
}
console.log('[PASS] 3. Traffic Light LED Module (`builtin_traffic_light`) verified in Logical & Analog modes');

// ---------------------------------------------------------------------------
// 4. Submersible DC Water Pump (`builtin_water_pump`)
// ---------------------------------------------------------------------------
{
  const comps: CircuitComponent[] = [
    makeComp('dc1', 'dc-source', 0, 0, { voltage: 6.0 }),
    makeComp('gnd', 'gnd', 0, 100, {}),
    makeComp('pump', 'builtin_water_pump', 100, 0, { resistance: 25, maxVoltage: 16.0 }),
  ];
  const wires: CircuitWire[] = [
    makeWire('w0', 'dc1', 'neg', 'gnd', 'gnd'),
    makeWire('w1', 'dc1', 'pos', 'pump', 'p_plus'),
    makeWire('w2', 'pump', 'p_minus', 'gnd', 'gnd'),
  ];

  const logPump = evaluateLogicalCircuit(comps, wires);
  assert(logPump.componentStates.get('pump')?.isRunning === true, 'Water pump should run in Logical mode');
  assert((logPump.componentStates.get('pump')?.flowRateLpm ?? 0) > 0, 'Water pump should have positive flowRateLpm');

  const spicePump = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  assert(
    (spicePump.componentResults.get('pump')?.flowRateLpm ?? 0) > 0 &&
      (spicePump.componentResults.get('pump')?.rpm ?? 0) > 0,
    'Water pump should run at 6V in Analog mode'
  );
  // I = 6V / 25Ω = 0.24A
  assert(
    Math.abs((spicePump.componentResults.get('pump')?.currentA ?? 0) - 0.24) < 0.01,
    `Water pump current at 6V should be 0.24A, got ${spicePump.componentResults.get('pump')?.currentA}`
  );
  assert(
    Math.abs((spicePump.componentResults.get('pump')?.flowRateLpm ?? 0) - 1.5) < 0.1,
    `Water pump flow rate at 6V should be 1.5 L/min, got ${spicePump.componentResults.get('pump')?.flowRateLpm}`
  );

  // Burnout at 20V (> 16V)
  comps[0].properties.voltage = 20.0;
  const spicePumpBurn = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  assert(spicePumpBurn.componentResults.get('pump')?.isBurned === true, 'Water pump should burn out at 20V (> 16V)');
}
console.log('[PASS] 4. Submersible DC Water Pump (`builtin_water_pump`) verified in Logical & Analog modes');

// ---------------------------------------------------------------------------
// 5. Incandescent Filament Bulb (`builtin_filament_bulb`)
// ---------------------------------------------------------------------------
{
  const comps: CircuitComponent[] = [
    makeComp('dc1', 'dc-source', 0, 0, { voltage: 12.0 }),
    makeComp('gnd', 'gnd', 0, 100, {}),
    makeComp('bulb', 'builtin_filament_bulb', 100, 0, { resistance: 24, maxVoltage: 15.0, maxPower: 8.0 }),
  ];
  // Reverse polarity test (p2 to VCC, p1 to GND — non-polarized so it must still glow!)
  const wiresRev: CircuitWire[] = [
    makeWire('w0', 'dc1', 'neg', 'gnd', 'gnd'),
    makeWire('w1', 'dc1', 'pos', 'bulb', 'p2'),
    makeWire('w2', 'bulb', 'p1', 'gnd', 'gnd'),
  ];

  const logBulb = evaluateLogicalCircuit(comps, wiresRev);
  assert(logBulb.componentStates.get('bulb')?.lit === true, 'Filament bulb must light in either polarity in Logical');

  const spiceBulb = evaluateSpiceCircuit(comps, wiresRev, 0, 0.001);
  assert((spiceBulb.componentResults.get('bulb')?.brightness ?? 0) > 0, 'Filament bulb must glow at 12V in Analog');
  // P = 12^2 / 24 = 6.0W
  assert(
    Math.abs((spiceBulb.componentResults.get('bulb')?.powerW ?? 0) - 6.0) < 0.1,
    `Filament bulb power at 12V should be 6.0W, got ${spiceBulb.componentResults.get('bulb')?.powerW}`
  );

  // Burnout at 18V (> 15V and P = 13.5W > 8W)
  comps[0].properties.voltage = 18.0;
  const spiceBulbBurn = evaluateSpiceCircuit(comps, wiresRev, 0, 0.001);
  assert(spiceBulbBurn.componentResults.get('bulb')?.isBurned === true, 'Filament bulb must snap/burn out at 18V');
}
console.log('[PASS] 5. Incandescent Filament Bulb (`builtin_filament_bulb`) verified in Logical & Analog modes');

// ---------------------------------------------------------------------------
// 6. Wireless RF Radio + Antenna (`builtin_rf_radio`)
// ---------------------------------------------------------------------------
{
  const comps: CircuitComponent[] = [
    makeComp('dc1', 'dc-source', 0, 0, { voltage: 5.0 }),
    makeComp('gnd', 'gnd', 0, 200, {}),
    // Transmitter on CH 1
    makeComp('rf_tx', 'builtin_rf_radio', 100, 0, { rfChannel: 'CH 1 (433.0 MHz)', maxVoltage: 6.0 }),
    // Receiver A on CH 1 (matching channel)
    makeComp('rf_rx1', 'builtin_rf_radio', 400, 0, { rfChannel: 'CH 1 (433.0 MHz)', maxVoltage: 6.0 }),
    // Receiver B on CH 2 (different channel)
    makeComp('rf_rx2', 'builtin_rf_radio', 400, 160, { rfChannel: 'CH 2 (433.4 MHz)', maxVoltage: 6.0 }),
    makeComp('led1', 'led', 520, 0, { color: 'green', forwardVoltage: 2.0 }),
    makeComp('r1', 'resistor', 520, 60, { resistance: 220 }),
    makeComp('led2', 'led', 520, 160, { color: 'red', forwardVoltage: 2.0 }),
    makeComp('r2', 'resistor', 520, 220, { resistance: 220 }),
  ];
  const wires: CircuitWire[] = [
    makeWire('w0', 'dc1', 'neg', 'gnd', 'gnd'),
    // Power all 3 radios
    makeWire('w_v1', 'dc1', 'pos', 'rf_tx', 'vcc'),
    makeWire('w_g1', 'gnd', 'gnd', 'rf_tx', 'gnd'),
    makeWire('w_v2', 'dc1', 'pos', 'rf_rx1', 'vcc'),
    makeWire('w_g2', 'gnd', 'gnd', 'rf_rx1', 'gnd'),
    makeWire('w_v3', 'dc1', 'pos', 'rf_rx2', 'vcc'),
    makeWire('w_g3', 'gnd', 'gnd', 'rf_rx2', 'gnd'),
    // Tie TX pin of rf_tx HIGH
    makeWire('w_tx_high', 'dc1', 'pos', 'rf_tx', 'tx'),
    // Connect LED1 to rf_rx1 RX
    makeWire('w_rx1_led', 'rf_rx1', 'rx', 'led1', 'anode'),
    makeWire('w_led1_r', 'led1', 'cathode', 'r1', 'p1'),
    makeWire('w_r1_gnd', 'r1', 'p2', 'gnd', 'gnd'),
    // Connect LED2 to rf_rx2 RX
    makeWire('w_rx2_led', 'rf_rx2', 'rx', 'led2', 'anode'),
    makeWire('w_led2_r', 'led2', 'cathode', 'r2', 'p1'),
    makeWire('w_r2_gnd', 'r2', 'p2', 'gnd', 'gnd'),
  ];

  const logRF = evaluateLogicalCircuit(comps, wires);
  assert(logRF.componentStates.get('rf_tx')?.isTransmitting === true, 'RF TX should be transmitting in Logical');
  assert(logRF.componentStates.get('rf_rx1')?.isReceiving === true, 'RF RX1 (CH 1) should be receiving in Logical');
  assert(logRF.componentStates.get('rf_rx2')?.isReceiving === false, 'RF RX2 (CH 2) should NOT receive CH 1 in Logical');
  assert(logRF.componentStates.get('led1')?.lit === true, 'LED1 driven by wireless RF RX1 should be ON in Logical');
  assert(logRF.componentStates.get('led2')?.lit === false, 'LED2 on RF RX2 (CH 2) should be OFF in Logical');

  const spiceRF = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  assert(spiceRF.componentResults.get('rf_tx')?.isTransmitting === true, 'RF TX should be transmitting in Analog');
  assert(spiceRF.componentResults.get('rf_rx1')?.isReceiving === true, 'RF RX1 (CH 1) should be receiving in Analog');
  assert(spiceRF.componentResults.get('rf_rx2')?.isReceiving === false, 'RF RX2 (CH 2) should NOT receive CH 1 in Analog');
  assert((spiceRF.componentResults.get('led1')?.brightness ?? 0) > 0, 'LED1 driven by wireless RF RX1 should glow in Analog');
  assert((spiceRF.componentResults.get('led2')?.brightness ?? 0) === 0, 'LED2 on RF RX2 (CH 2) should stay OFF in Analog');
}
console.log('[PASS] 6. Wireless RF Radio + Antenna (`builtin_rf_radio`) verified across canvas in Logical & Analog modes');

// ---------------------------------------------------------------------------
// 7. Infrared TX (`builtin_ir_tx`) & RX (`builtin_ir_rx`)
// ---------------------------------------------------------------------------
{
  const comps: CircuitComponent[] = [
    makeComp('dc1', 'dc-source', 0, 0, { voltage: 5.0 }),
    makeComp('gnd', 'gnd', 0, 200, {}),
    makeComp('r_tx', 'resistor', 80, 0, { resistance: 220 }),
    makeComp('ir_tx', 'builtin_ir_tx', 180, 0, { forwardVoltage: 1.4, maxCurrent: 0.05 }),
    makeComp('ir_rx', 'builtin_ir_rx', 340, 0, { irDetected: false, maxVoltage: 6.0 }),
    makeComp('led', 'led', 460, 0, { color: 'green', forwardVoltage: 2.0 }),
    makeComp('r_led', 'resistor', 460, 60, { resistance: 220 }),
  ];
  const wires: CircuitWire[] = [
    makeWire('w0', 'dc1', 'neg', 'gnd', 'gnd'),
    // Drive IR TX through 220Ω series resistor
    makeWire('w1', 'dc1', 'pos', 'r_tx', 'p1'),
    makeWire('w2', 'r_tx', 'p2', 'ir_tx', 'anode'),
    makeWire('w3', 'ir_tx', 'cathode', 'gnd', 'gnd'),
    // Power IR RX and connect its OUT to an indicator LED
    makeWire('w4', 'dc1', 'pos', 'ir_rx', 'vcc'),
    makeWire('w5', 'gnd', 'gnd', 'ir_rx', 'gnd'),
    makeWire('w6', 'ir_rx', 'out', 'led', 'anode'),
    makeWire('w7', 'led', 'cathode', 'r_led', 'p1'),
    makeWire('w8', 'r_led', 'p2', 'gnd', 'gnd'),
  ];

  const logIR = evaluateLogicalCircuit(comps, wires);
  assert(logIR.componentStates.get('ir_tx')?.isEmitting === true, 'IR TX should emit in Logical mode');
  assert(logIR.componentStates.get('ir_rx')?.isReceivingIr === true, 'IR RX should detect IR TX beam in Logical mode');
  assert(logIR.componentStates.get('led')?.lit === true, 'LED driven by IR RX should light in Logical mode');

  const spiceIR = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  assert(spiceIR.componentResults.get('ir_tx')?.isEmitting === true, 'IR TX should emit in Analog mode (~15.6mA)');
  assert(spiceIR.componentResults.get('ir_rx')?.isReceivingIr === true, 'IR RX should detect IR TX beam in Analog mode');
  assert((spiceIR.componentResults.get('led')?.brightness ?? 0) > 0, 'LED driven by IR RX should glow in Analog mode');

  // Verify IR TX burns out if connected directly to 5V without resistor (I = (5 - 1.4)/10 = 360mA > 50mA)
  const wiresDirect: CircuitWire[] = [
    makeWire('w0', 'dc1', 'neg', 'gnd', 'gnd'),
    makeWire('w_direct', 'dc1', 'pos', 'ir_tx', 'anode'),
    makeWire('w3', 'ir_tx', 'cathode', 'gnd', 'gnd'),
  ];
  const spiceIRBurn = evaluateSpiceCircuit(comps, wiresDirect, 0, 0.001);
  assert(
    spiceIRBurn.componentResults.get('ir_tx')?.isBurned === true,
    'IR TX should burn out when wired directly to 5V without a current-limiting resistor'
  );
}
console.log('[PASS] 7. Infrared TX (`builtin_ir_tx`) & RX (`builtin_ir_rx`) wireless optical link verified');

// ---------------------------------------------------------------------------
// 8. Hall-Effect Magnetic Sensor (`builtin_hall_sensor`) & Vibration Sensor (`builtin_vibration_sensor`)
// ---------------------------------------------------------------------------
{
  const comps: CircuitComponent[] = [
    makeComp('dc1', 'dc-source', 0, 0, { voltage: 5.0 }),
    makeComp('gnd', 'gnd', 0, 100, {}),
    makeComp('hall', 'builtin_hall_sensor', 100, 0, { magneticField: 0, threshold: 30, maxVoltage: 24.0 }),
    makeComp('vib', 'builtin_vibration_sensor', 200, 0, {
      vibrationDetected: false,
      sensitivity: 50,
      maxVoltage: 12.0,
    }),
  ];
  const wires: CircuitWire[] = [
    makeWire('w0', 'dc1', 'neg', 'gnd', 'gnd'),
    makeWire('w1', 'dc1', 'pos', 'hall', 'vcc'),
    makeWire('w2', 'gnd', 'gnd', 'hall', 'gnd'),
    makeWire('w3', 'dc1', 'pos', 'vib', 'vcc'),
    makeWire('w4', 'gnd', 'gnd', 'vib', 'gnd'),
  ];

  // Untriggered baseline
  const spiceBase = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  assert(Math.abs(spiceBase.componentResults.get('hall')?.outputVoltage ?? 99) < 0.2, 'Hall baseline OUT should be ~0V');
  assert(Math.abs(spiceBase.componentResults.get('vib')?.outputVoltage ?? 99) < 0.2, 'Vibration baseline OUT should be ~0V');

  // Triggered (magneticField = 75 mT >= 30 mT; vibrationDetected = true)
  comps[2].properties.magneticField = 75;
  comps[3].properties.vibrationDetected = true;
  const spiceTrig = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  assert((spiceTrig.componentResults.get('hall')?.outputVoltage ?? 0) > 4.8, 'Hall triggered OUT should be ~5.0V');
  assert((spiceTrig.componentResults.get('vib')?.outputVoltage ?? 0) > 4.8, 'Vibration triggered OUT should be ~5.0V');
}
console.log('[PASS] 8. Hall-Effect (`builtin_hall_sensor`) & Vibration (`builtin_vibration_sensor`) sensors verified');

// ---------------------------------------------------------------------------
// 9. Linear Push-Pull Solenoid (`builtin_solenoid`)
// ---------------------------------------------------------------------------
{
  const comps: CircuitComponent[] = [
    makeComp('dc1', 'dc-source', 0, 0, { voltage: 12.0 }),
    makeComp('gnd', 'gnd', 0, 100, {}),
    makeComp('sol', 'builtin_solenoid', 100, 0, { resistance: 20, maxVoltage: 18.0 }),
  ];
  const wires: CircuitWire[] = [
    makeWire('w0', 'dc1', 'neg', 'gnd', 'gnd'),
    makeWire('w1', 'dc1', 'pos', 'sol', 's_plus'),
    makeWire('w2', 'sol', 's_minus', 'gnd', 'gnd'),
  ];

  const logSol = evaluateLogicalCircuit(comps, wires);
  assert(logSol.componentStates.get('sol')?.isEngaged === true, 'Solenoid should actuate in Logical mode');

  const spiceSol = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  assert(spiceSol.componentResults.get('sol')?.isEngaged === true, 'Solenoid should actuate at 12V in Analog mode');
  // I = 12V / 20Ω = 0.60A
  assert(
    Math.abs((spiceSol.componentResults.get('sol')?.currentA ?? 0) - 0.6) < 0.01,
    `Solenoid current at 12V should be 0.60A, got ${spiceSol.componentResults.get('sol')?.currentA}`
  );

  // Burnout at 24V (> 18V)
  comps[0].properties.voltage = 24.0;
  const spiceSolBurn = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  assert(spiceSolBurn.componentResults.get('sol')?.isBurned === true, 'Solenoid should burn out at 24V (> 18V)');
}
console.log('[PASS] 9. Linear Push-Pull Solenoid (`builtin_solenoid`) verified in Logical & Analog modes');

// ---------------------------------------------------------------------------
// 10. 8Ω Dynamic Audio Speaker (`builtin_speaker`)
// ---------------------------------------------------------------------------
{
  const comps: CircuitComponent[] = [
    makeComp('dc1', 'dc-source', 0, 0, { voltage: 2.0 }),
    makeComp('gnd', 'gnd', 0, 100, {}),
    makeComp('spk', 'builtin_speaker', 100, 0, {
      resistance: 8,
      maxPower: 2.0,
      maxVoltage: 12.0,
      audioEnabled: false,
    }),
  ];
  const wires: CircuitWire[] = [
    makeWire('w0', 'dc1', 'neg', 'gnd', 'gnd'),
    makeWire('w1', 'dc1', 'pos', 'spk', 'sp_plus'),
    makeWire('w2', 'spk', 'sp_minus', 'gnd', 'gnd'),
  ];

  const logSpk = evaluateLogicalCircuit(comps, wires);
  assert(logSpk.componentStates.get('spk')?.isSounding === true, 'Speaker should sound in Logical mode');

  // At 2.0V across 8Ω: I = 0.25A, P = 0.50W <= 2.0W -> sounds safely!
  const spiceSpk = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  assert(spiceSpk.componentResults.get('spk')?.isSounding === true, 'Speaker should sound at 2.0V (0.5W) in Analog mode');
  assert(spiceSpk.componentResults.get('spk')?.isBurned === false, 'Speaker should NOT burn out at 0.5W');

  // At 9.0V direct across 8Ω: P = 81 / 8 = 10.125W > 2.0W -> Voice coil burns out!
  comps[0].properties.voltage = 9.0;
  const spiceSpkBurn = evaluateSpiceCircuit(comps, wires, 0, 0.001);
  assert(
    spiceSpkBurn.componentResults.get('spk')?.isBurned === true,
    '8Ω Speaker should burn out when connected directly to 9V (10.1W > 2.0W maxPower)'
  );
}
console.log('[PASS] 10. 8Ω Dynamic Audio Speaker (`builtin_speaker`) verified in Logical & Analog modes');

console.log('\nALL PHASE 7.9 TESTS PASSED SUCCESSFULLY!');
