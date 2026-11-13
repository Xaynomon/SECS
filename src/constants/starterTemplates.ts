import { CircuitFileFormat } from '../types/circuit';

export interface StarterTemplate {
  id: string;
  title: string;
  category: 'Basic' | 'Intermediate' | 'High-Level' | 'Professional' | 'Basics' | 'Analog' | 'Sensors' | 'Microcontrollers';
  tier: 'Basic' | 'Intermediate' | 'High-Level' | 'Professional';
  badge: 'Basic' | 'Intermediate' | 'High-Level' | 'Professional';
  description: string;
  componentCount: number;
  circuit: CircuitFileFormat;
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  // =========================================================================
  // TIER 1: BASIC TEMPLATES (3 Circuits)
  // =========================================================================

  // -------------------------------------------------------------------------
  // Template 1: Basic 1 - Simple Switch & Current-Limited LED
  // -------------------------------------------------------------------------
  {
    id: 'basic_led_switch',
    title: 'Basic 1: Simple Switch & Current-Limited LED',
    category: 'Basic',
    tier: 'Basic',
    badge: 'Basic',
    description: "Fundamental DC series loop demonstrating Ohm's Law, manual switch control, and current limiting. 9V source powers a 5mm Red LED through a 330Ω resistor.",
    componentCount: 6,
    circuit: {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      name: 'Simple Switch & Current-Limited LED',
      viewport: { zoom: 1.0, panX: 100, panY: 60 },
      components: [
        {
          id: 'v1',
          type: 'dc-source',
          label: 'V1 (9V)',
          x: 200,
          y: 280,
          rotation: 0,
          mirrored: false,
          properties: { voltage: 9.0, internalResistance: 0.1 },
        },
        {
          id: 'sw1',
          type: 'toggle-switch',
          label: 'SW1',
          x: 360,
          y: 200,
          rotation: 0,
          mirrored: false,
          properties: { state: 'T1' },
        },
        {
          id: 'r1',
          type: 'resistor',
          label: 'R1 (330Ω)',
          x: 520,
          y: 200,
          rotation: 0,
          mirrored: false,
          properties: { resistance: 330, tolerance: 5 },
        },
        {
          id: 'led1',
          type: 'led-red',
          label: 'LED1',
          x: 680,
          y: 280,
          rotation: 0,
          mirrored: false,
          properties: { color: '#ef4444', forwardVoltage: 2.0 },
        },
        {
          id: 'gnd1',
          type: 'gnd',
          label: 'GND',
          x: 440,
          y: 420,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'note1',
          type: 'textbox',
          label: 'NOTE1',
          x: 200,
          y: 40,
          rotation: 0,
          mirrored: false,
          properties: {
            text: "Basic 1: Simple Switch & Current-Limited LED\n\n• Ohm's Law: I = (Vsource - Vled) / R1 = (9V - 2V) / 330Ω ≈ 21.2mA\n• Click Run (Space) to start simulation!\n• Click SW1 to open/close the circuit.\n• R1 prevents LED1 from thermal overload burnout in ANALOG mode.",
            fontSize: 'md',
            fontWeight: 'normal',
            bgStyle: 'sticky-yellow',
            borderStyle: 'solid',
            boxWidth: 380,
            boxHeight: 120,
          },
        },
      ],
      wires: [
        {
          id: 'w_v1_sw1',
          fromCompId: 'v1',
          fromPinId: 'pos',
          toCompId: 'sw1',
          toPinId: 'com',
          waypoints: [{ x: 320, y: 300 }, { x: 320, y: 240 }],
          color: '#ef4444',
        },
        {
          id: 'w_sw1_r1',
          fromCompId: 'sw1',
          fromPinId: 't1',
          toCompId: 'r1',
          toPinId: 'p1',
          waypoints: [],
          color: '#f97316',
        },
        {
          id: 'w_r1_led1',
          fromCompId: 'r1',
          fromPinId: 'p2',
          toCompId: 'led1',
          toPinId: 'anode',
          waypoints: [{ x: 640, y: 220 }, { x: 640, y: 300 }],
          color: '#eab308',
        },
        {
          id: 'w_led1_gnd',
          fromCompId: 'led1',
          fromPinId: 'cathode',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 760, y: 420 }],
          color: '#1e293b',
        },
        {
          id: 'w_v1_gnd',
          fromCompId: 'v1',
          fromPinId: 'neg',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 200, y: 420 }],
          color: '#1e293b',
        },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // Template 2: Basic 2 - Step-Down Converter & DC Motor Drive
  // -------------------------------------------------------------------------
  {
    id: 'basic_buck_motor',
    title: 'Basic 2: Step-Down Converter & DC Motor Drive',
    category: 'Basic',
    tier: 'Basic',
    badge: 'Basic',
    description: 'Stepping down a 12V supply to 6.0V using the Step-Down Buck Converter to safely power a DC Brushed Motor with a green power indicator LED.',
    componentCount: 8,
    circuit: {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      name: 'Step-Down Converter & DC Motor Drive',
      viewport: { zoom: 0.95, panX: 80, panY: 60 },
      components: [
        {
          id: 'v1',
          type: 'dc-source',
          label: 'V1 (12V)',
          x: 140,
          y: 260,
          rotation: 0,
          mirrored: false,
          properties: { voltage: 12.0, internalResistance: 0.1 },
        },
        {
          id: 'conv1',
          type: 'builtin_dcdc_converter',
          label: 'REG1 (Buck)',
          x: 340,
          y: 260,
          rotation: 0,
          mirrored: false,
          properties: { mode: 'buck', targetVoltage: 6.0, maxInputVoltage: 40.0 },
        },
        {
          id: 'sw1',
          type: 'toggle-switch',
          label: 'SW1',
          x: 540,
          y: 240,
          rotation: 0,
          mirrored: false,
          properties: { state: 'T1' },
        },
        {
          id: 'm1',
          type: 'builtin_dc_motor',
          label: 'MOT1',
          x: 720,
          y: 220,
          rotation: 0,
          mirrored: false,
          properties: { ratedVoltage: 6.0, maxRpm: 3000, windingResistance: 20 },
        },
        {
          id: 'r1',
          type: 'resistor',
          label: 'R1 (220Ω)',
          x: 700,
          y: 380,
          rotation: 0,
          mirrored: false,
          properties: { resistance: 220 },
        },
        {
          id: 'led1',
          type: 'led-green',
          label: 'LED1',
          x: 820,
          y: 380,
          rotation: 0,
          mirrored: false,
          properties: { color: '#22c55e' },
        },
        {
          id: 'gnd1',
          type: 'gnd',
          label: 'GND',
          x: 520,
          y: 480,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'note1',
          type: 'textbox',
          label: 'NOTE1',
          x: 140,
          y: 40,
          rotation: 0,
          mirrored: false,
          properties: {
            text: "Basic 2: Step-Down Converter & DC Motor Drive\n\n• REG1 steps down unregulated 12V input to a stabilized 6.0V output.\n• Click SW1 to toggle power to the motor.\n• Watch the rotor spin CW ↻ with live RPM readout and green power LED!",
            fontSize: 'md',
            fontWeight: 'normal',
            bgStyle: 'sticky-blue',
            borderStyle: 'solid',
            boxWidth: 380,
            boxHeight: 130,
          },
        },
      ],
      wires: [
        {
          id: 'w_v1_conv_p',
          fromCompId: 'v1',
          fromPinId: 'pos',
          toCompId: 'conv1',
          toPinId: 'vin_plus',
          waypoints: [],
          color: '#ef4444',
        },
        {
          id: 'w_v1_conv_m',
          fromCompId: 'v1',
          fromPinId: 'neg',
          toCompId: 'conv1',
          toPinId: 'vin_minus',
          waypoints: [{ x: 140, y: 320 }],
          color: '#1e293b',
        },
        {
          id: 'w_conv_vin_gnd',
          fromCompId: 'conv1',
          fromPinId: 'vin_minus',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 340, y: 480 }],
          color: '#1e293b',
        },
        {
          id: 'w_conv_vout_gnd',
          fromCompId: 'conv1',
          fromPinId: 'vout_minus',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 460, y: 480 }],
          color: '#1e293b',
        },
        {
          id: 'w_conv_sw',
          fromCompId: 'conv1',
          fromPinId: 'vout_plus',
          toCompId: 'sw1',
          toPinId: 'com',
          waypoints: [],
          color: '#f97316',
        },
        {
          id: 'w_sw_mot',
          fromCompId: 'sw1',
          fromPinId: 't1',
          toCompId: 'm1',
          toPinId: 'm_plus',
          waypoints: [{ x: 660, y: 260 }, { x: 660, y: 300 }],
          color: '#38bdf8',
        },
        {
          id: 'w_sw_r1',
          fromCompId: 'sw1',
          fromPinId: 't1',
          toCompId: 'r1',
          toPinId: 'p1',
          waypoints: [{ x: 660, y: 260 }, { x: 660, y: 400 }],
          color: '#38bdf8',
        },
        {
          id: 'w_mot_gnd',
          fromCompId: 'm1',
          fromPinId: 'm_minus',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 780, y: 340 }, { x: 540, y: 340 }],
          color: '#1e293b',
        },
        {
          id: 'w_r1_led',
          fromCompId: 'r1',
          fromPinId: 'p2',
          toCompId: 'led1',
          toPinId: 'anode',
          waypoints: [],
          color: '#22c55e',
        },
        {
          id: 'w_led_gnd',
          fromCompId: 'led1',
          fromPinId: 'cathode',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 900, y: 480 }],
          color: '#1e293b',
        },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // Template 3: Basic 3 - 1-Bit Binary Half-Adder (XOR + AND)
  // -------------------------------------------------------------------------
  {
    id: 'basic_half_adder',
    title: 'Basic 3: 1-Bit Binary Half-Adder (XOR + AND)',
    category: 'Basic',
    tier: 'Basic',
    badge: 'Basic',
    description: 'Fundamental digital arithmetic circuit. XOR and AND logic gates compute binary SUM (2^0) and CARRY (2^1) from two toggle switch inputs.',
    componentCount: 11,
    circuit: {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      name: '1-Bit Binary Half-Adder',
      viewport: { zoom: 0.95, panX: 80, panY: 60 },
      components: [
        {
          id: 'vcc1',
          type: 'vcc',
          label: 'VCC (+5V)',
          x: 140,
          y: 160,
          rotation: 0,
          mirrored: false,
          properties: { voltage: 5.0 },
        },
        {
          id: 'sw_a',
          type: 'toggle-switch',
          label: 'Input A (1)',
          x: 240,
          y: 160,
          rotation: 0,
          mirrored: false,
          properties: { state: 'T1' },
        },
        {
          id: 'sw_b',
          type: 'toggle-switch',
          label: 'Input B (0)',
          x: 240,
          y: 300,
          rotation: 0,
          mirrored: false,
          properties: { state: 'T2' },
        },
        {
          id: 'u_xor',
          type: 'gate-xor',
          label: 'SUM_XOR',
          x: 480,
          y: 140,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'u_and',
          type: 'gate-and',
          label: 'CARRY_AND',
          x: 480,
          y: 300,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'r_sum',
          type: 'resistor',
          label: 'R_SUM',
          x: 640,
          y: 160,
          rotation: 0,
          mirrored: false,
          properties: { resistance: 220 },
        },
        {
          id: 'led_sum',
          type: 'led-blue',
          label: 'SUM (2^0)',
          x: 780,
          y: 160,
          rotation: 0,
          mirrored: false,
          properties: { color: '#38bdf8' },
        },
        {
          id: 'r_carry',
          type: 'resistor',
          label: 'R_CARRY',
          x: 640,
          y: 320,
          rotation: 0,
          mirrored: false,
          properties: { resistance: 220 },
        },
        {
          id: 'led_carry',
          type: 'led-green',
          label: 'CARRY (2^1)',
          x: 780,
          y: 320,
          rotation: 0,
          mirrored: false,
          properties: { color: '#22c55e' },
        },
        {
          id: 'gnd1',
          type: 'gnd',
          label: 'GND',
          x: 840,
          y: 440,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'note1',
          type: 'textbox',
          label: 'NOTE1',
          x: 480,
          y: 20,
          rotation: 0,
          mirrored: false,
          properties: {
            text: "Basic 3: 1-Bit Binary Half-Adder\n\n• SUM = A ⊕ B (XOR Gate)\n• CARRY = A · B (AND Gate)\n• Toggle Input A and B switches to test truth table:\n  0+0=00, 0+1=01 (Sum), 1+0=01 (Sum), 1+1=10 (Carry=1, Sum=0)",
            fontSize: 'md',
            fontWeight: 'normal',
            bgStyle: 'sticky-yellow',
            borderStyle: 'solid',
            boxWidth: 380,
            boxHeight: 110,
          },
        },
      ],
      wires: [
        {
          id: 'w_vcc_a',
          fromCompId: 'vcc1',
          fromPinId: 'vcc',
          toCompId: 'sw_a',
          toPinId: 'com',
          waypoints: [],
          color: '#ef4444',
        },
        {
          id: 'w_vcc_b',
          fromCompId: 'vcc1',
          fromPinId: 'vcc',
          toCompId: 'sw_b',
          toPinId: 'com',
          waypoints: [{ x: 160, y: 340 }],
          color: '#ef4444',
        },
        {
          id: 'w_a_xor',
          fromCompId: 'sw_a',
          fromPinId: 't1',
          toCompId: 'u_xor',
          toPinId: 'in_a',
          waypoints: [{ x: 400, y: 180 }, { x: 400, y: 160 }],
          color: '#38bdf8',
        },
        {
          id: 'w_a_and',
          fromCompId: 'sw_a',
          fromPinId: 't1',
          toCompId: 'u_and',
          toPinId: 'in_a',
          waypoints: [{ x: 400, y: 180 }, { x: 400, y: 320 }],
          color: '#38bdf8',
        },
        {
          id: 'w_b_xor',
          fromCompId: 'sw_b',
          fromPinId: 't1',
          toCompId: 'u_xor',
          toPinId: 'in_b',
          waypoints: [{ x: 440, y: 320 }, { x: 440, y: 200 }],
          color: '#a855f7',
        },
        {
          id: 'w_b_and',
          fromCompId: 'sw_b',
          fromPinId: 't1',
          toCompId: 'u_and',
          toPinId: 'in_b',
          waypoints: [{ x: 440, y: 320 }, { x: 440, y: 360 }],
          color: '#a855f7',
        },
        {
          id: 'w_xor_r',
          fromCompId: 'u_xor',
          fromPinId: 'out',
          toCompId: 'r_sum',
          toPinId: 'p1',
          waypoints: [],
          color: '#38bdf8',
        },
        {
          id: 'w_r_led_sum',
          fromCompId: 'r_sum',
          fromPinId: 'p2',
          toCompId: 'led_sum',
          toPinId: 'anode',
          waypoints: [],
          color: '#38bdf8',
        },
        {
          id: 'w_and_r',
          fromCompId: 'u_and',
          fromPinId: 'out',
          toCompId: 'r_carry',
          toPinId: 'p1',
          waypoints: [],
          color: '#22c55e',
        },
        {
          id: 'w_r_led_carry',
          fromCompId: 'r_carry',
          fromPinId: 'p2',
          toCompId: 'led_carry',
          toPinId: 'anode',
          waypoints: [],
          color: '#22c55e',
        },
        {
          id: 'w_sum_gnd',
          fromCompId: 'led_sum',
          fromPinId: 'cathode',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 860, y: 440 }],
          color: '#1e293b',
        },
        {
          id: 'w_carry_gnd',
          fromCompId: 'led_carry',
          fromPinId: 'cathode',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 860, y: 440 }],
          color: '#1e293b',
        },
      ],
    },
  },

  // =========================================================================
  // TIER 2: INTERMEDIATE TEMPLATES (3 Circuits)
  // =========================================================================

  // -------------------------------------------------------------------------
  // Template 4: Intermediate 1 - Multi-Sensor Fire & Gas Hazard Alarm
  // -------------------------------------------------------------------------
  {
    id: 'inter_env_alarm',
    title: 'Intermediate 1: Multi-Sensor Fire & Gas Hazard Alarm',
    category: 'Intermediate',
    tier: 'Intermediate',
    badge: 'Intermediate',
    description: 'Hazard safety system combining TMP36 Temperature Sensor, MQ-2 Gas/Smoke detector, OR logic gate, Piezo Siren, and Red Hazard Warning LED.',
    componentCount: 9,
    circuit: {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      name: 'Multi-Sensor Hazard Alarm',
      viewport: { zoom: 0.95, panX: 80, panY: 60 },
      components: [
        {
          id: 'vcc1',
          type: 'vcc',
          label: 'VCC (+5V)',
          x: 120,
          y: 160,
          rotation: 0,
          mirrored: false,
          properties: { voltage: 5.0 },
        },
        {
          id: 'gnd1',
          type: 'gnd',
          label: 'GND',
          x: 120,
          y: 460,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'temp1',
          type: 'temp-sensor',
          label: 'TEMP1 (TMP36)',
          x: 220,
          y: 180,
          rotation: 0,
          mirrored: false,
          properties: { temperatureC: 25, threshold: 50 },
        },
        {
          id: 'gas1',
          type: 'builtin_gas_sensor',
          label: 'GAS1 (MQ-2)',
          x: 260,
          y: 320,
          rotation: 0,
          mirrored: false,
          properties: { ppm: 50, threshold: 400 },
        },
        {
          id: 'u_or',
          type: 'gate-or',
          label: 'ALARM_OR',
          x: 480,
          y: 240,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'bz1',
          type: 'buzzer',
          label: 'BZ1 (Siren)',
          x: 660,
          y: 220,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'r1',
          type: 'resistor',
          label: 'R1 (220Ω)',
          x: 660,
          y: 340,
          rotation: 0,
          mirrored: false,
          properties: { resistance: 220 },
        },
        {
          id: 'led1',
          type: 'led-red',
          label: 'LED1 (Hazard)',
          x: 780,
          y: 340,
          rotation: 0,
          mirrored: false,
          properties: { color: '#ef4444' },
        },
        {
          id: 'note1',
          type: 'textbox',
          label: 'NOTE1',
          x: 220,
          y: 40,
          rotation: 0,
          mirrored: false,
          properties: {
            text: "Intermediate 1: Multi-Sensor Hazard Alarm\n\n• Select TEMP1 -> Grab 🔥 Matchstick Cursor to heat above 50°C.\n• Select GAS1 -> Grab ☁️ Smoke Plume Cursor to increase PPM.\n• If either sensor trips, ALARM_OR activates BZ1 and the Hazard LED!",
            fontSize: 'md',
            fontWeight: 'normal',
            bgStyle: 'sticky-yellow',
            borderStyle: 'solid',
            boxWidth: 420,
            boxHeight: 120,
          },
        },
      ],
      wires: [
        {
          id: 'w_vcc_temp',
          fromCompId: 'vcc1',
          fromPinId: 'vcc',
          toCompId: 'temp1',
          toPinId: 'vcc',
          waypoints: [],
          color: '#ef4444',
        },
        {
          id: 'w_vcc_gas',
          fromCompId: 'vcc1',
          fromPinId: 'vcc',
          toCompId: 'gas1',
          toPinId: 'vcc',
          waypoints: [{ x: 180, y: 200 }, { x: 180, y: 400 }, { x: 220, y: 400 }],
          color: '#ef4444',
        },
        {
          id: 'w_gnd_temp',
          fromCompId: 'temp1',
          fromPinId: 'gnd',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 300, y: 240 }, { x: 140, y: 240 }],
          color: '#1e293b',
        },
        {
          id: 'w_gnd_gas',
          fromCompId: 'gas1',
          fromPinId: 'gnd',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 240, y: 460 }],
          color: '#1e293b',
        },
        {
          id: 'w_temp_or',
          fromCompId: 'temp1',
          fromPinId: 'vout',
          toCompId: 'u_or',
          toPinId: 'in_a',
          waypoints: [{ x: 260, y: 140 }, { x: 420, y: 140 }, { x: 420, y: 260 }],
          color: '#f97316',
        },
        {
          id: 'w_gas_or',
          fromCompId: 'gas1',
          fromPinId: 'do',
          toCompId: 'u_or',
          toPinId: 'in_b',
          waypoints: [{ x: 280, y: 300 }],
          color: '#eab308',
        },
        {
          id: 'w_or_buzzer',
          fromCompId: 'u_or',
          fromPinId: 'out',
          toCompId: 'bz1',
          toPinId: 'pos',
          waypoints: [{ x: 600, y: 280 }, { x: 600, y: 240 }],
          color: '#ef4444',
        },
        {
          id: 'w_or_r1',
          fromCompId: 'u_or',
          fromPinId: 'out',
          toCompId: 'r1',
          toPinId: 'p1',
          waypoints: [{ x: 600, y: 280 }, { x: 600, y: 360 }],
          color: '#ef4444',
        },
        {
          id: 'w_r1_led',
          fromCompId: 'r1',
          fromPinId: 'p2',
          toCompId: 'led1',
          toPinId: 'anode',
          waypoints: [],
          color: '#ef4444',
        },
        {
          id: 'w_buzzer_gnd',
          fromCompId: 'bz1',
          fromPinId: 'neg',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 740, y: 460 }],
          color: '#1e293b',
        },
        {
          id: 'w_led_gnd',
          fromCompId: 'led1',
          fromPinId: 'cathode',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 860, y: 460 }],
          color: '#1e293b',
        },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // Template 5: Intermediate 2 - 555 Pulse Clock & Motion-Activated Cooling
  // -------------------------------------------------------------------------
  {
    id: 'inter_555_motion_fan',
    title: 'Intermediate 2: 555 Pulse Clock & Motion-Activated Cooling',
    category: 'Intermediate',
    tier: 'Intermediate',
    badge: 'Intermediate',
    description: 'Dual automation circuit. 555 Timer IC outputs a 1Hz clock heartbeat while a PIR Motion Sensor (HC-SR501) and Accelerometer (ADXL335) combine to activate a DC Cooling Fan.',
    componentCount: 10,
    circuit: {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      name: '555 Pulse & Motion Cooling System',
      viewport: { zoom: 0.95, panX: 60, panY: 60 },
      components: [
        {
          id: 'vcc1',
          type: 'vcc',
          label: 'VCC (+5V)',
          x: 120,
          y: 160,
          rotation: 0,
          mirrored: false,
          properties: { voltage: 5.0 },
        },
        {
          id: 'gnd1',
          type: 'gnd',
          label: 'GND',
          x: 120,
          y: 480,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'u_555',
          type: 'ic-555',
          label: 'U1 (555 Timer)',
          x: 240,
          y: 160,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'r_clk',
          type: 'resistor',
          label: 'R1 (220Ω)',
          x: 380,
          y: 200,
          rotation: 0,
          mirrored: false,
          properties: { resistance: 220 },
        },
        {
          id: 'led_clk',
          type: 'led-yellow',
          label: 'LED_CLK',
          x: 520,
          y: 200,
          rotation: 0,
          mirrored: false,
          properties: { color: '#eab308' },
        },
        {
          id: 'pir1',
          type: 'builtin_motion_sensor',
          label: 'PIR1 (Motion)',
          x: 240,
          y: 340,
          rotation: 0,
          mirrored: false,
          properties: { motionDetected: false, holdTimeMs: 2000 },
        },
        {
          id: 'acc1',
          type: 'builtin_accelerometer',
          label: 'ACC1 (Tilt)',
          x: 400,
          y: 340,
          rotation: 0,
          mirrored: false,
          properties: { accelX: 0.0, accelY: 0.0, accelZ: 0.0, tiltThreshold: 0.5 },
        },
        {
          id: 'u_or',
          type: 'gate-or',
          label: 'FAN_OR',
          x: 580,
          y: 360,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'fan1',
          type: 'dc-fan',
          label: 'FAN1',
          x: 760,
          y: 360,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'note1',
          type: 'textbox',
          label: 'NOTE1',
          x: 360,
          y: 40,
          rotation: 0,
          mirrored: false,
          properties: {
            text: "Intermediate 2: 555 Pulse & Motion Cooling System\n\n• 555 Timer outputs a 1Hz clock pulse blinking LED_CLK.\n• Select PIR1 -> Grab 🚶 Moving Target Cursor to trigger motion.\n• Select ACC1 -> Adjust tilt angle (> 0.5g).\n• Either sensor triggers FAN_OR to spin the DC Cooling Fan!",
            fontSize: 'md',
            fontWeight: 'normal',
            bgStyle: 'sticky-cyan',
            borderStyle: 'solid',
            boxWidth: 440,
            boxHeight: 130,
          },
        },
      ],
      wires: [
        {
          id: 'w_vcc_555',
          fromCompId: 'vcc1',
          fromPinId: 'vcc',
          toCompId: 'u_555',
          toPinId: 'pin8_vcc',
          waypoints: [{ x: 180, y: 200 }, { x: 180, y: 140 }, { x: 320, y: 140 }],
          color: '#ef4444',
        },
        {
          id: 'w_gnd_555',
          fromCompId: 'u_555',
          fromPinId: 'pin1_gnd',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 200, y: 180 }, { x: 200, y: 480 }],
          color: '#1e293b',
        },
        {
          id: 'w_555_r',
          fromCompId: 'u_555',
          fromPinId: 'pin3_out',
          toCompId: 'r_clk',
          toPinId: 'p1',
          waypoints: [],
          color: '#eab308',
        },
        {
          id: 'w_r_led_clk',
          fromCompId: 'r_clk',
          fromPinId: 'p2',
          toCompId: 'led_clk',
          toPinId: 'anode',
          waypoints: [],
          color: '#eab308',
        },
        {
          id: 'w_led_clk_gnd',
          fromCompId: 'led_clk',
          fromPinId: 'cathode',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 600, y: 300 }, { x: 140, y: 300 }],
          color: '#1e293b',
        },
        {
          id: 'w_vcc_pir',
          fromCompId: 'vcc1',
          fromPinId: 'vcc',
          toCompId: 'pir1',
          toPinId: 'vcc',
          waypoints: [{ x: 160, y: 200 }, { x: 160, y: 440 }, { x: 260, y: 440 }],
          color: '#ef4444',
        },
        {
          id: 'w_gnd_pir',
          fromCompId: 'pir1',
          fromPinId: 'gnd',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 300, y: 460 }, { x: 140, y: 460 }],
          color: '#1e293b',
        },
        {
          id: 'w_vcc_acc',
          fromCompId: 'vcc1',
          fromPinId: 'vcc',
          toCompId: 'acc1',
          toPinId: 'vcc',
          waypoints: [{ x: 160, y: 440 }, { x: 420, y: 440 }],
          color: '#ef4444',
        },
        {
          id: 'w_gnd_acc',
          fromCompId: 'acc1',
          fromPinId: 'gnd',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 440, y: 480 }],
          color: '#1e293b',
        },
        {
          id: 'w_pir_or',
          fromCompId: 'pir1',
          fromPinId: 'out',
          toCompId: 'u_or',
          toPinId: 'in_a',
          waypoints: [{ x: 280, y: 380 }],
          color: '#38bdf8',
        },
        {
          id: 'w_acc_or',
          fromCompId: 'acc1',
          fromPinId: 'x',
          toCompId: 'u_or',
          toPinId: 'in_b',
          waypoints: [],
          color: '#a855f7',
        },
        {
          id: 'w_or_fan',
          fromCompId: 'u_or',
          fromPinId: 'out',
          toCompId: 'fan1',
          toPinId: 'pos',
          waypoints: [{ x: 700, y: 400 }, { x: 700, y: 380 }],
          color: '#22c55e',
        },
        {
          id: 'w_fan_gnd',
          fromCompId: 'fan1',
          fromPinId: 'neg',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 760, y: 480 }],
          color: '#1e293b',
        },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // Template 6: Intermediate 3 - Smart Greenhouse (Humidity + LDR + Servo Vent)
  // -------------------------------------------------------------------------
  {
    id: 'inter_smart_greenhouse',
    title: 'Intermediate 3: Smart Greenhouse (Humidity + LDR + Servo Vent)',
    category: 'Intermediate',
    tier: 'Intermediate',
    badge: 'Intermediate',
    description: 'Automated greenhouse climate controller. Senses humidity (DHT22) and sunlight (LDR) to open an SG90 Servo roof vent and display Misting vs Irrigation status LEDs.',
    componentCount: 12,
    circuit: {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      name: 'Smart Greenhouse Climate Controller',
      viewport: { zoom: 0.9, panX: 60, panY: 60 },
      components: [
        {
          id: 'vcc1',
          type: 'vcc',
          label: 'VCC (+5V)',
          x: 120,
          y: 160,
          rotation: 0,
          mirrored: false,
          properties: { voltage: 5.0 },
        },
        {
          id: 'gnd1',
          type: 'gnd',
          label: 'GND',
          x: 120,
          y: 460,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'hum1',
          type: 'builtin_humidity_sensor',
          label: 'HUM1 (DHT22)',
          x: 220,
          y: 180,
          rotation: 0,
          mirrored: false,
          properties: { humidity: 35, threshold: 60 },
        },
        {
          id: 'ldr1',
          type: 'light-sensor',
          label: 'LDR1 (Sunlight)',
          x: 220,
          y: 340,
          rotation: 0,
          mirrored: false,
          properties: { lux: 100, threshold: 500 },
        },
        {
          id: 'u_or',
          type: 'gate-or',
          label: 'VENT_OR',
          x: 460,
          y: 220,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'u_not',
          type: 'gate-not',
          label: 'DRY_NOT',
          x: 460,
          y: 360,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'servo1',
          type: 'builtin_servo_motor',
          label: 'SERVO1 (Vent)',
          x: 680,
          y: 200,
          rotation: 0,
          mirrored: false,
          properties: { targetAngle: 90, angle: 0 },
        },
        {
          id: 'r1',
          type: 'resistor',
          label: 'R1 (220Ω)',
          x: 680,
          y: 340,
          rotation: 0,
          mirrored: false,
          properties: { resistance: 220 },
        },
        {
          id: 'led_wet',
          type: 'led-blue',
          label: 'LED_MIST',
          x: 820,
          y: 340,
          rotation: 0,
          mirrored: false,
          properties: { color: '#38bdf8' },
        },
        {
          id: 'r2',
          type: 'resistor',
          label: 'R2 (220Ω)',
          x: 680,
          y: 440,
          rotation: 0,
          mirrored: false,
          properties: { resistance: 220 },
        },
        {
          id: 'led_dry',
          type: 'led-yellow',
          label: 'LED_IRRIGATE',
          x: 820,
          y: 440,
          rotation: 0,
          mirrored: false,
          properties: { color: '#eab308' },
        },
        {
          id: 'note1',
          type: 'textbox',
          label: 'NOTE1',
          x: 220,
          y: 40,
          rotation: 0,
          mirrored: false,
          properties: {
            text: "Intermediate 3: Smart Greenhouse Automation\n\n• Select HUM1 -> Grab 💧 Water Mister or 💨 Dry Air Cursor.\n• When Humidity >= 60% OR Sunlight is bright, VENT_OR opens the SG90 Servo roof vent!\n• DRY_NOT illuminates the yellow LED when ambient humidity is low.",
            fontSize: 'md',
            fontWeight: 'normal',
            bgStyle: 'sticky-green',
            borderStyle: 'solid',
            boxWidth: 440,
            boxHeight: 120,
          },
        },
      ],
      wires: [
        {
          id: 'w_vcc_hum',
          fromCompId: 'vcc1',
          fromPinId: 'vcc',
          toCompId: 'hum1',
          toPinId: 'vcc',
          waypoints: [{ x: 180, y: 200 }, { x: 180, y: 240 }, { x: 240, y: 240 }],
          color: '#ef4444',
        },
        {
          id: 'w_gnd_hum',
          fromCompId: 'hum1',
          fromPinId: 'gnd',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 280, y: 300 }, { x: 140, y: 300 }],
          color: '#1e293b',
        },
        {
          id: 'w_vcc_ldr',
          fromCompId: 'vcc1',
          fromPinId: 'vcc',
          toCompId: 'ldr1',
          toPinId: 'p1',
          waypoints: [{ x: 160, y: 200 }, { x: 160, y: 360 }],
          color: '#ef4444',
        },
        {
          id: 'w_hum_or',
          fromCompId: 'hum1',
          fromPinId: 'out',
          toCompId: 'u_or',
          toPinId: 'in_a',
          waypoints: [{ x: 260, y: 240 }],
          color: '#38bdf8',
        },
        {
          id: 'w_hum_not',
          fromCompId: 'hum1',
          fromPinId: 'out',
          toCompId: 'u_not',
          toPinId: 'in',
          waypoints: [{ x: 340, y: 260 }, { x: 340, y: 400 }],
          color: '#38bdf8',
        },
        {
          id: 'w_hum_wet',
          fromCompId: 'hum1',
          fromPinId: 'out',
          toCompId: 'r1',
          toPinId: 'p1',
          waypoints: [{ x: 340, y: 260 }, { x: 340, y: 360 }, { x: 640, y: 360 }],
          color: '#38bdf8',
        },
        {
          id: 'w_ldr_or',
          fromCompId: 'ldr1',
          fromPinId: 'p2',
          toCompId: 'u_or',
          toPinId: 'in_b',
          waypoints: [{ x: 380, y: 360 }, { x: 380, y: 280 }],
          color: '#eab308',
        },
        {
          id: 'w_or_servo',
          fromCompId: 'u_or',
          fromPinId: 'out',
          toCompId: 'servo1',
          toPinId: 'sig',
          waypoints: [{ x: 600, y: 260 }, { x: 600, y: 280 }],
          color: '#22c55e',
        },
        {
          id: 'w_vcc_servo',
          fromCompId: 'vcc1',
          fromPinId: 'vcc',
          toCompId: 'servo1',
          toPinId: 'vcc',
          waypoints: [{ x: 140, y: 140 }, { x: 720, y: 140 }],
          color: '#ef4444',
        },
        {
          id: 'w_gnd_servo',
          fromCompId: 'servo1',
          fromPinId: 'gnd',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 740, y: 300 }, { x: 740, y: 480 }, { x: 140, y: 480 }],
          color: '#1e293b',
        },
        {
          id: 'w_not_r2',
          fromCompId: 'u_not',
          fromPinId: 'out',
          toCompId: 'r2',
          toPinId: 'p1',
          waypoints: [{ x: 600, y: 400 }, { x: 600, y: 460 }],
          color: '#f97316',
        },
        {
          id: 'w_r1_wet',
          fromCompId: 'r1',
          fromPinId: 'p2',
          toCompId: 'led_wet',
          toPinId: 'anode',
          waypoints: [],
          color: '#38bdf8',
        },
        {
          id: 'w_r2_dry',
          fromCompId: 'r2',
          fromPinId: 'p2',
          toCompId: 'led_dry',
          toPinId: 'anode',
          waypoints: [],
          color: '#eab308',
        },
        {
          id: 'w_wet_gnd',
          fromCompId: 'led_wet',
          fromPinId: 'cathode',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 900, y: 480 }, { x: 140, y: 480 }],
          color: '#1e293b',
        },
        {
          id: 'w_dry_gnd',
          fromCompId: 'led_dry',
          fromPinId: 'cathode',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 900, y: 480 }],
          color: '#1e293b',
        },
      ],
    },
  },

  // =========================================================================
  // TIER 3: HIGH-LEVEL / ADVANCED TEMPLATES (3 Circuits)
  // =========================================================================

  // -------------------------------------------------------------------------
  // Template 7: High-Level 1 - Arduino Weather & Telemetry Station
  // -------------------------------------------------------------------------
  {
    id: 'adv_arduino_weather_station',
    title: 'High-Level 1: Arduino Weather & Telemetry Station (OLED + SD Logger)',
    category: 'High-Level',
    tier: 'High-Level',
    badge: 'High-Level',
    description: 'Full IoT weather station. Arduino Uno R3 samples Temperature and Humidity sensors, updates a 128x64 OLED graphic display, logs CSV records to a MicroSD card, and pulses a heartbeat LED.',
    componentCount: 8,
    circuit: {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      name: 'Arduino Weather & Telemetry Station',
      viewport: { zoom: 0.9, panX: 60, panY: 40 },
      components: [
        {
          id: 'mcu1',
          type: 'arduino-uno',
          label: 'MCU1 (Uno R3)',
          x: 380,
          y: 320,
          rotation: 0,
          mirrored: false,
          properties: {
            code: `// SECS Weather & Telemetry Station
void setup() {
  Serial.begin(9600);
  pinMode(8, OUTPUT);
  OLED.clear();
  OLED.println("SECS WEATHER OS");
  OLED.println("TEMP: 25.0 C");
  OLED.println("HUM:  35.0 %RH");
  OLED.println("SD LOG: ACTIVE");
  SD.println("time_ms,temp_c,hum_pct");
}

void loop() {
  int rawTemp = analogRead(A0);
  int rawHum = analogRead(A1);
  float tempC = (rawTemp * 5.0 / 1024.0 - 0.5) * 100.0;
  float humPct = (rawHum * 5.0 / 1024.0) / 5.0 * 100.0;

  digitalWrite(8, HIGH);
  Serial.print("TEMP: ");
  Serial.print(tempC);
  Serial.print(" C | HUM: ");
  Serial.print(humPct);
  Serial.println(" %");

  OLED.clear();
  OLED.println("SECS WEATHER OS");
  OLED.println("TEMP: " + String(tempC, 1) + " C");
  OLED.println("HUM:  " + String(humPct, 1) + " %RH");
  OLED.println("SD LOG: ACTIVE");

  SD.println(String(millis()) + "," + String(tempC, 1) + "," + String(humPct, 1));
  delay(300);
  digitalWrite(8, LOW);
  delay(300);
}
`,
          },
        },
        {
          id: 'temp1',
          type: 'temp-sensor',
          label: 'TEMP1',
          x: 640,
          y: 640,
          rotation: 0,
          mirrored: false,
          properties: { temperatureC: 25 },
        },
        {
          id: 'hum1',
          type: 'builtin_humidity_sensor',
          label: 'HUM1',
          x: 800,
          y: 620,
          rotation: 0,
          mirrored: false,
          properties: { humidity: 35 },
        },
        {
          id: 'oled1',
          type: 'builtin_oled_display',
          label: 'OLED1',
          x: 240,
          y: 120,
          rotation: 0,
          mirrored: false,
          properties: { displayText: "SECS WEATHER OS\nTEMP: 25.0 C\nHUM:  35.0 %RH\nSD LOG: ACTIVE" },
        },
        {
          id: 'sd1',
          type: 'builtin_sd_card',
          label: 'SD1',
          x: 620,
          y: 120,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'r1',
          type: 'resistor',
          label: 'R1 (220Ω)',
          x: 840,
          y: 280,
          rotation: 0,
          mirrored: false,
          properties: { resistance: 220 },
        },
        {
          id: 'led_beat',
          type: 'led-blue',
          label: 'LED_BEAT',
          x: 960,
          y: 280,
          rotation: 0,
          mirrored: false,
          properties: { color: '#38bdf8' },
        },
        {
          id: 'gnd1',
          type: 'gnd',
          label: 'GND',
          x: 440,
          y: 680,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'note1',
          type: 'textbox',
          label: 'NOTE1',
          x: 820,
          y: 60,
          rotation: 0,
          mirrored: false,
          properties: {
            text: "High-Level 1: Arduino Weather & Telemetry Station\n\n• Microcontroller samples TMP36 (A0) and DHT22 (A1).\n• Formats live telemetry onto the SSD1306 OLED Screen.\n• Appends real-time CSV records to the MicroSD Card logger.\n• Click '</> Code' in the top bar to inspect Serial output!",
            fontSize: 'md',
            fontWeight: 'normal',
            bgStyle: 'sticky-blue',
            borderStyle: 'solid',
            boxWidth: 420,
            boxHeight: 140,
          },
        },
      ],
      wires: [
        {
          id: 'w_uno_d8_r1',
          fromCompId: 'mcu1',
          fromPinId: 'd8',
          toCompId: 'r1',
          toPinId: 'p1',
          waypoints: [{ x: 580, y: 300 }, { x: 840, y: 300 }],
          color: '#38bdf8',
        },
        {
          id: 'w_r1_led',
          fromCompId: 'r1',
          fromPinId: 'p2',
          toCompId: 'led_beat',
          toPinId: 'anode',
          waypoints: [],
          color: '#38bdf8',
        },
        {
          id: 'w_led_gnd',
          fromCompId: 'led_beat',
          fromPinId: 'cathode',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 1040, y: 680 }],
          color: '#1e293b',
        },
        {
          id: 'w_uno_a0_temp',
          fromCompId: 'mcu1',
          fromPinId: 'a0',
          toCompId: 'temp1',
          toPinId: 'vout',
          waypoints: [{ x: 660, y: 600 }, { x: 680, y: 600 }],
          color: '#f97316',
        },
        {
          id: 'w_uno_a1_hum',
          fromCompId: 'mcu1',
          fromPinId: 'a1',
          toCompId: 'hum1',
          toPinId: 'out',
          waypoints: [{ x: 680, y: 580 }, { x: 840, y: 580 }],
          color: '#38bdf8',
        },
        {
          id: 'w_uno_5v_temp',
          fromCompId: 'mcu1',
          fromPinId: '5v',
          toCompId: 'temp1',
          toPinId: 'vcc',
          waypoints: [{ x: 520, y: 660 }],
          color: '#ef4444',
        },
        {
          id: 'w_uno_5v_hum',
          fromCompId: 'mcu1',
          fromPinId: '5v',
          toCompId: 'hum1',
          toPinId: 'vcc',
          waypoints: [{ x: 520, y: 660 }, { x: 780, y: 660 }, { x: 780, y: 700 }, { x: 820, y: 700 }],
          color: '#ef4444',
        },
        {
          id: 'w_temp_gnd',
          fromCompId: 'temp1',
          fromPinId: 'gnd',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 720, y: 680 }],
          color: '#1e293b',
        },
        {
          id: 'w_hum_gnd',
          fromCompId: 'hum1',
          fromPinId: 'gnd',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 860, y: 720 }, { x: 460, y: 720 }],
          color: '#1e293b',
        },
        {
          id: 'w_uno_gnd1',
          fromCompId: 'mcu1',
          fromPinId: 'gnd1',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 460, y: 320 }],
          color: '#1e293b',
        },
        {
          id: 'w_uno_sda_oled',
          fromCompId: 'mcu1',
          fromPinId: 'sda',
          toCompId: 'oled1',
          toPinId: 'sda',
          waypoints: [{ x: 420, y: 260 }, { x: 320, y: 260 }],
          color: '#22c55e',
        },
        {
          id: 'w_uno_scl_oled',
          fromCompId: 'mcu1',
          fromPinId: 'scl',
          toCompId: 'oled1',
          toPinId: 'sck',
          waypoints: [{ x: 400, y: 240 }, { x: 300, y: 240 }],
          color: '#eab308',
        },
        {
          id: 'w_uno_5v_oled',
          fromCompId: 'mcu1',
          fromPinId: '5v',
          toCompId: 'oled1',
          toPinId: 'vcc',
          waypoints: [{ x: 520, y: 560 }, { x: 220, y: 560 }],
          color: '#ef4444',
        },
        {
          id: 'w_oled_gnd',
          fromCompId: 'oled1',
          fromPinId: 'gnd',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 260, y: 680 }],
          color: '#1e293b',
        },
        {
          id: 'w_uno_d10_sd_cs',
          fromCompId: 'mcu1',
          fromPinId: 'd10',
          toCompId: 'sd1',
          toPinId: 'cs',
          waypoints: [{ x: 540, y: 260 }, { x: 740, y: 260 }],
          color: '#a855f7',
        },
        {
          id: 'w_uno_d11_sd_mosi',
          fromCompId: 'mcu1',
          fromPinId: 'd11',
          toCompId: 'sd1',
          toPinId: 'mosi',
          waypoints: [{ x: 520, y: 240 }, { x: 700, y: 240 }],
          color: '#38bdf8',
        },
        {
          id: 'w_uno_d12_sd_miso',
          fromCompId: 'mcu1',
          fromPinId: 'd12',
          toCompId: 'sd1',
          toPinId: 'miso',
          waypoints: [{ x: 500, y: 220 }, { x: 660, y: 220 }],
          color: '#f97316',
        },
        {
          id: 'w_uno_d13_sd_sck',
          fromCompId: 'mcu1',
          fromPinId: 'd13',
          toCompId: 'sd1',
          toPinId: 'sck',
          waypoints: [{ x: 480, y: 200 }, { x: 720, y: 200 }],
          color: '#eab308',
        },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // Template 8: High-Level 2 - ESP32 Smart Keypad Security Vault
  // -------------------------------------------------------------------------
  {
    id: 'adv_esp32_security_vault',
    title: 'High-Level 2: ESP32 Smart Keypad Security Vault (Numpad + LCD + Servo Lock)',
    category: 'High-Level',
    tier: 'High-Level',
    badge: 'High-Level',
    description: 'Commercial vault access system. ESP32 DevKit V1 samples a 4x4 matrix membrane keypad, drives a 16x2 character LCD, actuates an SG90 Servo deadbolt lock, beeps a siren, and toggles status LEDs.',
    componentCount: 11,
    circuit: {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      name: 'ESP32 Smart Keypad Security Vault',
      viewport: { zoom: 0.9, panX: 60, panY: 40 },
      components: [
        {
          id: 'esp1',
          type: 'esp32',
          label: 'ESP1 (DevKit V1)',
          x: 460,
          y: 300,
          rotation: 0,
          mirrored: false,
          properties: {
            code: `// ESP32 Interactive Keypad Security Vault
String pinBuffer = "";
bool isUnlocked = false;

void lockVault() {
  isUnlocked = false;
  pinBuffer = "";
  digitalWrite(5, HIGH); // Red LED (Locked)
  digitalWrite(2, LOW);  // Green LED (Unlocked)
  Servo.write(18, 0);    // Deadbolt locked (0 deg)
  digitalWrite(19, LOW); // Buzzer silent
  LCD.clear();
  LCD.setCursor(0, 0);
  LCD.print("VAULT: LOCKED   ");
  LCD.setCursor(0, 1);
  LCD.print("PRESS KEY TO OPN");
}

void unlockVault() {
  isUnlocked = true;
  digitalWrite(5, LOW);   // Red LED off
  digitalWrite(2, HIGH);  // Green LED on
  Servo.write(18, 90);    // Deadbolt retracted (90 deg)
  LCD.clear();
  LCD.setCursor(0, 0);
  LCD.print("ACCESS GRANTED! ");
  LCD.setCursor(0, 1);
  LCD.print("PRESS * TO LOCK ");
}

void setup() {
  Serial.begin(9600);
  pinMode(2, OUTPUT);   // Green LED (Unlocked)
  pinMode(5, OUTPUT);   // Red LED (Locked)
  pinMode(18, OUTPUT);  // Servo deadbolt
  pinMode(19, OUTPUT);  // Buzzer
  lockVault();
}

void loop() {
  char key = Keypad.getKey();
  if (key != '\\0' && key != ' ') {
    Serial.print("Keypad: ");
    Serial.println(key);

    if (key == '*' || key == 'C') {
      lockVault();
    } else if (key == '#' || key == 'A') {
      unlockVault();
      digitalWrite(19, HIGH);
      delay(200);
      digitalWrite(19, LOW);
    } else {
      if (!isUnlocked) {
        pinBuffer += key;
        LCD.setCursor(0, 1);
        String displayPin = "PIN: " + pinBuffer;
        LCD.print(displayPin);
        
        digitalWrite(19, HIGH);
        delay(30);
        digitalWrite(19, LOW);

        if (pinBuffer.length() >= 4) {
          delay(100);
          unlockVault();
          digitalWrite(19, HIGH);
          delay(200);
          digitalWrite(19, LOW);
        }
      }
    }
  }
  delay(100);
}
`,
          },
        },
        {
          id: 'pad1',
          type: 'builtin_numpad',
          label: 'PAD1 (Keypad)',
          x: 200,
          y: 300,
          rotation: 0,
          mirrored: false,
          properties: { activeKey: '' },
        },
        {
          id: 'lcd1',
          type: 'builtin_lcd_16x2',
          label: 'LCD1 (16x2)',
          x: 720,
          y: 160,
          rotation: 0,
          mirrored: false,
          properties: { row1Text: 'VAULT: LOCKED   ', row2Text: 'PRESS KEY TO OPN' },
        },
        {
          id: 'servo1',
          type: 'builtin_servo_motor',
          label: 'VAULT_LOCK',
          x: 720,
          y: 360,
          rotation: 0,
          mirrored: false,
          properties: { targetAngle: 90, angle: 0 },
        },
        {
          id: 'bz1',
          type: 'buzzer',
          label: 'BZ1 (Beep)',
          x: 720,
          y: 520,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'r_ok',
          type: 'resistor',
          label: 'R_OK',
          x: 200,
          y: 520,
          rotation: 0,
          mirrored: false,
          properties: { resistance: 220 },
        },
        {
          id: 'led_ok',
          type: 'led-green',
          label: 'UNLOCKED',
          x: 320,
          y: 520,
          rotation: 0,
          mirrored: false,
          properties: { color: '#22c55e' },
        },
        {
          id: 'r_lock',
          type: 'resistor',
          label: 'R_LOCK',
          x: 200,
          y: 620,
          rotation: 0,
          mirrored: false,
          properties: { resistance: 220 },
        },
        {
          id: 'led_lock',
          type: 'led-red',
          label: 'LOCKED',
          x: 320,
          y: 620,
          rotation: 0,
          mirrored: false,
          properties: { color: '#ef4444' },
        },
        {
          id: 'gnd1',
          type: 'gnd',
          label: 'GND',
          x: 580,
          y: 680,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'note1',
          type: 'textbox',
          label: 'NOTE1',
          x: 200,
          y: 80,
          rotation: 0,
          mirrored: false,
          properties: {
            text: "High-Level 2: ESP32 Smart Keypad Security Vault\n\n• Vault starts in a quiet, stable LOCKED state (Deadbolt 0°, Red LED ON).\n• Click Run, then click keys directly on the 4x4 Numpad to enter a 4-digit PIN (or press # / A to unlock)!\n• When unlocked, the SG90 deadbolt turns to 90°, Green LED illuminates, and buzzer chirps.\n• Press * or C on the Numpad to lock the vault again!",
            fontSize: 'md',
            fontWeight: 'normal',
            bgStyle: 'sticky-yellow',
            borderStyle: 'solid',
            boxWidth: 440,
            boxHeight: 140,
          },
        },
      ],
      wires: [
        {
          id: 'w_pad_esp_out',
          fromCompId: 'pad1',
          fromPinId: 'out',
          toCompId: 'esp1',
          toPinId: 'd15',
          waypoints: [{ x: 260, y: 460 }, { x: 380, y: 460 }, { x: 380, y: 360 }],
          color: '#38bdf8',
        },
        {
          id: 'w_esp_d2_rok',
          fromCompId: 'esp1',
          fromPinId: 'd2',
          toCompId: 'r_ok',
          toPinId: 'p1',
          waypoints: [{ x: 460, y: 380 }, { x: 420, y: 380 }, { x: 420, y: 500 }, { x: 160, y: 500 }, { x: 160, y: 540 }],
          color: '#22c55e',
        },
        {
          id: 'w_rok_ledok',
          fromCompId: 'r_ok',
          fromPinId: 'p2',
          toCompId: 'led_ok',
          toPinId: 'anode',
          waypoints: [],
          color: '#22c55e',
        },
        {
          id: 'w_ledok_gnd',
          fromCompId: 'led_ok',
          fromPinId: 'cathode',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 400, y: 680 }],
          color: '#1e293b',
        },
        {
          id: 'w_esp_d5_rlock',
          fromCompId: 'esp1',
          fromPinId: 'd5',
          toCompId: 'r_lock',
          toPinId: 'p1',
          waypoints: [{ x: 460, y: 460 }, { x: 440, y: 460 }, { x: 440, y: 600 }, { x: 160, y: 600 }, { x: 160, y: 640 }],
          color: '#ef4444',
        },
        {
          id: 'w_rlock_ledlock',
          fromCompId: 'r_lock',
          fromPinId: 'p2',
          toCompId: 'led_lock',
          toPinId: 'anode',
          waypoints: [],
          color: '#ef4444',
        },
        {
          id: 'w_ledlock_gnd',
          fromCompId: 'led_lock',
          fromPinId: 'cathode',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 400, y: 640 }, { x: 400, y: 680 }],
          color: '#1e293b',
        },
        {
          id: 'w_esp_d18_servo',
          fromCompId: 'esp1',
          fromPinId: 'd18',
          toCompId: 'servo1',
          toPinId: 'sig',
          waypoints: [{ x: 460, y: 480 }, { x: 420, y: 480 }, { x: 420, y: 440 }],
          color: '#22c55e',
        },
        {
          id: 'w_esp_d19_bz',
          fromCompId: 'esp1',
          fromPinId: 'd19',
          toCompId: 'bz1',
          toPinId: 'pos',
          waypoints: [{ x: 460, y: 500 }, { x: 440, y: 500 }, { x: 440, y: 540 }],
          color: '#f97316',
        },
        {
          id: 'w_bz_gnd',
          fromCompId: 'bz1',
          fromPinId: 'neg',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 800, y: 680 }],
          color: '#1e293b',
        },
        {
          id: 'w_esp_d21_sda',
          fromCompId: 'esp1',
          fromPinId: 'd21',
          toCompId: 'lcd1',
          toPinId: 'sda',
          waypoints: [{ x: 460, y: 520 }, { x: 680, y: 520 }, { x: 680, y: 240 }],
          color: '#38bdf8',
        },
        {
          id: 'w_esp_d22_scl',
          fromCompId: 'esp1',
          fromPinId: 'd22',
          toCompId: 'lcd1',
          toPinId: 'scl',
          waypoints: [{ x: 460, y: 580 }, { x: 700, y: 580 }, { x: 700, y: 240 }],
          color: '#eab308',
        },
        {
          id: 'w_esp_gnd',
          fromCompId: 'esp1',
          fromPinId: 'gnd1',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 440, y: 340 }, { x: 440, y: 680 }],
          color: '#1e293b',
        },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // Template 9: High-Level 3 - SECS-808 8-Bit Assembly CPU Binary Bus
  // -------------------------------------------------------------------------
  {
    id: 'adv_cpu808_alu_scanner',
    title: 'High-Level 3: SECS-808 8-Bit Assembly CPU Binary Bus & 7-Segment Decoder',
    category: 'High-Level',
    tier: 'High-Level',
    badge: 'High-Level',
    description: 'Computer architecture showcase. The SECS-808 8-Bit Programmable Assembly Microprocessor runs an ALU arithmetic loop, updates live registers (ACC, B, PC, Z, C), and drives a 4-bit parallel bus and 7-segment display.',
    componentCount: 13,
    circuit: {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      name: 'SECS-808 Assembly CPU Architecture Showcase',
      viewport: { zoom: 0.85, panX: 40, panY: 40 },
      components: [
        {
          id: 'cpu1',
          type: 'builtin_cpu_8bit',
          label: 'CPU1 (SECS-808)',
          x: 440,
          y: 340,
          rotation: 0,
          mirrored: false,
          properties: {
            clockHz: 5,
            code: `; SECS-808 8-Bit CPU Binary Counter & Bus Scanner
START:
  LDA 1
LOOP:
  OUT A
  WAIT 250
  ADD 1
  CMP 16
  JZ START
  JMP LOOP
`,
          },
        },
        {
          id: 'vcc1',
          type: 'vcc',
          label: 'VCC (+5V)',
          x: 140,
          y: 320,
          rotation: 0,
          mirrored: false,
          properties: { voltage: 5.0 },
        },
        {
          id: 'gnd1',
          type: 'gnd',
          label: 'GND',
          x: 140,
          y: 560,
          rotation: 0,
          mirrored: false,
          properties: {},
        },
        {
          id: 'sw0',
          type: 'toggle-switch',
          label: 'SW0 (Bit 0)',
          x: 240,
          y: 420,
          rotation: 0,
          mirrored: false,
          properties: { state: 'T1' },
        },
        {
          id: 'sw1',
          type: 'toggle-switch',
          label: 'SW1 (Bit 1)',
          x: 240,
          y: 500,
          rotation: 0,
          mirrored: false,
          properties: { state: 'T2' },
        },
        {
          id: 'r0',
          type: 'resistor',
          label: 'R0 (220Ω)',
          x: 640,
          y: 340,
          rotation: 0,
          mirrored: false,
          properties: { resistance: 220 },
        },
        {
          id: 'r1',
          type: 'resistor',
          label: 'R1 (220Ω)',
          x: 640,
          y: 400,
          rotation: 0,
          mirrored: false,
          properties: { resistance: 220 },
        },
        {
          id: 'r2',
          type: 'resistor',
          label: 'R2 (220Ω)',
          x: 640,
          y: 460,
          rotation: 0,
          mirrored: false,
          properties: { resistance: 220 },
        },
        {
          id: 'r3',
          type: 'resistor',
          label: 'R3 (220Ω)',
          x: 640,
          y: 520,
          rotation: 0,
          mirrored: false,
          properties: { resistance: 220 },
        },
        {
          id: 'led0',
          type: 'led-red',
          label: 'OUT0 (2^0)',
          x: 780,
          y: 340,
          rotation: 0,
          mirrored: false,
          properties: { color: '#ef4444' },
        },
        {
          id: 'led1',
          type: 'led-yellow',
          label: 'OUT1 (2^1)',
          x: 780,
          y: 400,
          rotation: 0,
          mirrored: false,
          properties: { color: '#eab308' },
        },
        {
          id: 'led2',
          type: 'led-green',
          label: 'OUT2 (2^2)',
          x: 780,
          y: 460,
          rotation: 0,
          mirrored: false,
          properties: { color: '#22c55e' },
        },
        {
          id: 'led3',
          type: 'led-blue',
          label: 'OUT3 (2^3)',
          x: 780,
          y: 520,
          rotation: 0,
          mirrored: false,
          properties: { color: '#38bdf8' },
        },
        {
          id: 'note1',
          type: 'textbox',
          label: 'NOTE1',
          x: 320,
          y: 60,
          rotation: 0,
          mirrored: false,
          properties: {
            text: "; SECS-808 8-Bit Assembly CPU Architecture Showcase\n\n• Microprocessor reads hardware inputs IN0/IN1, performs arithmetic/shifts, and updates live registers (ACC, B, PC, Z, C).\n• Drives 4-bit parallel bus (OUT0..OUT3) with real-time visual logic flow.\n• Click '</> Assembly IDE' in the Right Inspector to step instructions in real time!",
            fontSize: 'md',
            fontWeight: 'normal',
            bgStyle: 'sticky-purple',
            borderStyle: 'solid',
            boxWidth: 460,
            boxHeight: 140,
          },
        },
      ],
      wires: [
        {
          id: 'w_vcc_cpu',
          fromCompId: 'vcc1',
          fromPinId: 'vcc',
          toCompId: 'cpu1',
          toPinId: 'vcc',
          waypoints: [],
          color: '#ef4444',
        },
        {
          id: 'w_gnd_cpu',
          fromCompId: 'cpu1',
          fromPinId: 'gnd',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 380, y: 380 }, { x: 380, y: 560 }],
          color: '#1e293b',
        },
        {
          id: 'w_vcc_sw0',
          fromCompId: 'vcc1',
          fromPinId: 'vcc',
          toCompId: 'sw0',
          toPinId: 'com',
          waypoints: [{ x: 160, y: 460 }],
          color: '#ef4444',
        },
        {
          id: 'w_vcc_sw1',
          fromCompId: 'vcc1',
          fromPinId: 'vcc',
          toCompId: 'sw1',
          toPinId: 'com',
          waypoints: [{ x: 160, y: 540 }],
          color: '#ef4444',
        },
        {
          id: 'w_sw0_in0',
          fromCompId: 'sw0',
          fromPinId: 't1',
          toCompId: 'cpu1',
          toPinId: 'in0',
          waypoints: [],
          color: '#38bdf8',
        },
        {
          id: 'w_sw1_in1',
          fromCompId: 'sw1',
          fromPinId: 't1',
          toCompId: 'cpu1',
          toPinId: 'in1',
          waypoints: [{ x: 360, y: 520 }, { x: 360, y: 460 }],
          color: '#a855f7',
        },
        {
          id: 'w_cpu_out0_r0',
          fromCompId: 'cpu1',
          fromPinId: 'out0',
          toCompId: 'r0',
          toPinId: 'p1',
          waypoints: [],
          color: '#ef4444',
        },
        {
          id: 'w_r0_led0',
          fromCompId: 'r0',
          fromPinId: 'p2',
          toCompId: 'led0',
          toPinId: 'anode',
          waypoints: [],
          color: '#ef4444',
        },
        {
          id: 'w_cpu_out1_r1',
          fromCompId: 'cpu1',
          fromPinId: 'out1',
          toCompId: 'r1',
          toPinId: 'p1',
          waypoints: [{ x: 580, y: 380 }, { x: 580, y: 420 }],
          color: '#eab308',
        },
        {
          id: 'w_r1_led1',
          fromCompId: 'r1',
          fromPinId: 'p2',
          toCompId: 'led1',
          toPinId: 'anode',
          waypoints: [],
          color: '#eab308',
        },
        {
          id: 'w_cpu_out2_r2',
          fromCompId: 'cpu1',
          fromPinId: 'out2',
          toCompId: 'r2',
          toPinId: 'p1',
          waypoints: [{ x: 600, y: 400 }, { x: 600, y: 480 }],
          color: '#22c55e',
        },
        {
          id: 'w_r2_led2',
          fromCompId: 'r2',
          fromPinId: 'p2',
          toCompId: 'led2',
          toPinId: 'anode',
          waypoints: [],
          color: '#22c55e',
        },
        {
          id: 'w_cpu_out3_r3',
          fromCompId: 'cpu1',
          fromPinId: 'out3',
          toCompId: 'r3',
          toPinId: 'p1',
          waypoints: [{ x: 620, y: 420 }, { x: 620, y: 540 }],
          color: '#38bdf8',
        },
        {
          id: 'w_r3_led3',
          fromCompId: 'r3',
          fromPinId: 'p2',
          toCompId: 'led3',
          toPinId: 'anode',
          waypoints: [],
          color: '#38bdf8',
        },
        {
          id: 'w_led0_gnd',
          fromCompId: 'led0',
          fromPinId: 'cathode',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 900, y: 360 }, { x: 900, y: 640 }, { x: 160, y: 640 }],
          color: '#1e293b',
        },
        {
          id: 'w_led1_gnd',
          fromCompId: 'led1',
          fromPinId: 'cathode',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 900, y: 420 }],
          color: '#1e293b',
        },
        {
          id: 'w_led2_gnd',
          fromCompId: 'led2',
          fromPinId: 'cathode',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 900, y: 480 }],
          color: '#1e293b',
        },
        {
          id: 'w_led3_gnd',
          fromCompId: 'led3',
          fromPinId: 'cathode',
          toCompId: 'gnd1',
          toPinId: 'gnd',
          waypoints: [{ x: 900, y: 540 }],
          color: '#1e293b',
        },
      ],
    },
  },

  // =========================================================================
  // TIER 4: PROFESSIONAL TEMPLATES (3 Circuits)
  // =========================================================================

  // -------------------------------------------------------------------------
  // Template 10: Professional 1 - Wireless Infrared 3-Digit Numpad & Auto-Reset 7-Segment Receiver
  // -------------------------------------------------------------------------
  {
  id: 'prof_ir_numpad_3digit',
  title: 'Professional 1: Wireless Infrared 3-Digit Numpad & Auto-Reset 7-Segment Receiver',
  category: 'Professional',
  tier: 'Professional',
  badge: 'Professional',
  description: 'Dual-island optical telemetry system. Circuit 1 reads matrix keypad inputs and strobes an Infrared LED. Circuit 2 intercepts the optical 940nm beam via TSOP IR detector, shifts digits left across 3x side-by-side 7-segment displays (_ _ 1 -> _ 1 2 -> 1 2 3), and features a 3-second hardware auto-reset watchdog.',
  componentCount: 22,
  circuit: {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    name: 'Wireless Infrared 3-Digit Numpad & Auto-Reset 7-Segment Receiver',
    viewport: { zoom: 0.8, panX: 40, panY: 40 },
    components: [
      // --- TRANSMITTER ISLAND (Left side) ---
      {
        id: 'pad1',
        type: 'builtin_numpad',
        label: 'PAD1 (4x4 Keypad)',
        x: 160,
        y: 360,
        rotation: 0,
        mirrored: false,
        properties: { activeKey: '' },
      },
      {
        id: 'mcu_tx',
        type: 'arduino-uno',
        label: 'MCU_TX (Keypad Encoder)',
        x: 440,
        y: 360,
        rotation: 0,
        mirrored: false,
        properties: {
          code: `// SECS Wireless IR Transmitter - Keypad Encoder
const int PIN_IR_TX = 8;
const int PIN_LED_TX = 9;

void setup() {
  Serial.begin(9600);
  pinMode(PIN_IR_TX, OUTPUT);
  pinMode(PIN_LED_TX, OUTPUT);
  digitalWrite(PIN_IR_TX, LOW);
  digitalWrite(PIN_LED_TX, LOW);
  Serial.println("IR TRANSMITTER READY");
}

void loop() {
  char key = Keypad.getKey();
  if (key >= '0' && key <= '9') {
    int digit = key - '0';
    Serial.print("KEY PRESSED: ");
    Serial.println(key);
    
    // Illuminate TX indicator
    digitalWrite(PIN_LED_TX, HIGH);
    
    // Transmit optical pulse burst
    digitalWrite(PIN_IR_TX, HIGH);
    delay(180);
    digitalWrite(PIN_IR_TX, LOW);
    digitalWrite(PIN_LED_TX, LOW);
    
    // Debounce guard so 1 click = 1 single digit press
    delay(250);
  }
  delay(30);
}
`,
        },
      },
      {
        id: 'vcc1',
        type: 'vcc',
        label: 'VCC (+5V)',
        x: 80,
        y: 220,
        rotation: 0,
        mirrored: false,
        properties: { voltage: 5.0 },
      },
      {
        id: 'gnd1',
        type: 'gnd',
        label: 'GND',
        x: 80,
        y: 520,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'r_tx',
        type: 'resistor',
        label: 'R_TX (220Ω)',
        x: 640,
        y: 300,
        rotation: 0,
        mirrored: false,
        properties: { resistance: 220 },
      },
      {
        id: 'ir_tx1',
        type: 'builtin_ir_tx',
        label: 'IR_TX1 (940nm)',
        x: 760,
        y: 300,
        rotation: 0,
        mirrored: false,
        properties: { forwardVoltage: 1.4, ron: 10 },
      },
      {
        id: 'r_tx_led',
        type: 'resistor',
        label: 'R_LED (330Ω)',
        x: 640,
        y: 220,
        rotation: 0,
        mirrored: false,
        properties: { resistance: 330 },
      },
      {
        id: 'led_tx',
        type: 'led-green',
        label: 'TX_ACTIVE',
        x: 760,
        y: 220,
        rotation: 0,
        mirrored: false,
        properties: { color: '#22c55e' },
      },
      {
        id: 'note_tx',
        type: 'textbox',
        label: 'NOTE_TX',
        x: 160,
        y: 80,
        rotation: 0,
        mirrored: false,
        properties: {
          text: "TRANSMITTER ISLAND:\n• Click any number on PAD1 (0-9).\n• MCU_TX encodes the key, illuminates TX_ACTIVE, and pulses IR_TX1 (940nm).\n• Decoupled air gap transmits optical photons across the canvas.",
          fontSize: 'sm',
          fontWeight: 'normal',
          bgStyle: 'sticky-green',
          borderStyle: 'solid',
          boxWidth: 380,
          boxHeight: 120,
        },
      },

      // --- RECEIVER ISLAND (Right side, with 3x side-by-side displays) ---
      {
        id: 'ir_rx1',
        type: 'builtin_ir_rx',
        label: 'IR_RX1 (TSOP)',
        x: 980,
        y: 300,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'r_rx_led',
        type: 'resistor',
        label: 'R_RX (330Ω)',
        x: 1080,
        y: 220,
        rotation: 0,
        mirrored: false,
        properties: { resistance: 330 },
      },
      {
        id: 'led_rx',
        type: 'led-yellow',
        label: 'RX_ACTIVE',
        x: 1200,
        y: 220,
        rotation: 0,
        mirrored: false,
        properties: { color: '#eab308' },
      },
      {
        id: 'mcu_rx',
        type: 'arduino-uno',
        label: 'MCU_RX (Shift Reg & Driver)',
        x: 1140,
        y: 460,
        rotation: 0,
        mirrored: false,
        properties: {
          code: `// SECS Wireless IR Receiver & 3-Digit Shift Register
const int PIN_IR_IN = 11;
const int PIN_LED_RX = 12;

// BCD Pins for Hundreds Digit (dec1)
const int PIN_H0 = A2;
const int PIN_H1 = A3;
const int PIN_H2 = A4;
const int PIN_H3 = A5;

// BCD Pins for Tens Digit (dec2)
const int PIN_T0 = 6;
const int PIN_T1 = 7;
const int PIN_T2 = 8;
const int PIN_T3 = 9;

// BCD Pins for Ones Digit (dec3)
const int PIN_O0 = 2;
const int PIN_O1 = 3;
const int PIN_O2 = 4;
const int PIN_O3 = 5;

int digitHundreds = 0;
int digitTens = 0;
int digitOnes = 0;
unsigned long lastKeyTime = 0;

void refreshDisplays() {
  digitalWrite(PIN_H0, (digitHundreds & 1) ? HIGH : LOW);
  digitalWrite(PIN_H1, (digitHundreds & 2) ? HIGH : LOW);
  digitalWrite(PIN_H2, (digitHundreds & 4) ? HIGH : LOW);
  digitalWrite(PIN_H3, (digitHundreds & 8) ? HIGH : LOW);

  digitalWrite(PIN_T0, (digitTens & 1) ? HIGH : LOW);
  digitalWrite(PIN_T1, (digitTens & 2) ? HIGH : LOW);
  digitalWrite(PIN_T2, (digitTens & 4) ? HIGH : LOW);
  digitalWrite(PIN_T3, (digitTens & 8) ? HIGH : LOW);

  digitalWrite(PIN_O0, (digitOnes & 1) ? HIGH : LOW);
  digitalWrite(PIN_O1, (digitOnes & 2) ? HIGH : LOW);
  digitalWrite(PIN_O2, (digitOnes & 4) ? HIGH : LOW);
  digitalWrite(PIN_O3, (digitOnes & 8) ? HIGH : LOW);
}

void setup() {
  Serial.begin(9600);
  pinMode(PIN_IR_IN, INPUT);
  pinMode(PIN_LED_RX, OUTPUT);

  pinMode(PIN_H0, OUTPUT);
  pinMode(PIN_H1, OUTPUT);
  pinMode(PIN_H2, OUTPUT);
  pinMode(PIN_H3, OUTPUT);

  pinMode(PIN_T0, OUTPUT);
  pinMode(PIN_T1, OUTPUT);
  pinMode(PIN_T2, OUTPUT);
  pinMode(PIN_T3, OUTPUT);

  pinMode(PIN_O0, OUTPUT);
  pinMode(PIN_O1, OUTPUT);
  pinMode(PIN_O2, OUTPUT);
  pinMode(PIN_O3, OUTPUT);

  refreshDisplays();
  Serial.println("IR RECEIVER & 3-STAGE SHIFT REGISTER ONLINE");
}

void loop() {
  char key = Keypad.getKey();
  if (digitalRead(PIN_IR_IN) == HIGH || (key >= '0' && key <= '9')) {
    digitalWrite(PIN_LED_RX, HIGH);
    int newDigit = (key >= '0' && key <= '9') ? (key - '0') : 0;

    Serial.print("IR TELEMETRY RECEIVED -> DIGIT ");
    Serial.println(newDigit);

    // 3-Digit Shift Register behavior: _ _ 1 -> _ 1 2 -> 1 2 3
    digitHundreds = digitTens;
    digitTens = digitOnes;
    digitOnes = newDigit;
    refreshDisplays();
    lastKeyTime = millis();

    delay(200);
    digitalWrite(PIN_LED_RX, LOW);
    delay(100);
  }

  // 3-Second (3000ms) Watchdog Auto-Reset
  if (lastKeyTime > 0 && (millis() - lastKeyTime >= 3000)) {
    Serial.println("WATCHDOG: 3000ms IDLE TIMEOUT -> RESETTING DISPLAY");
    digitHundreds = 0;
    digitTens = 0;
    digitOnes = 0;
    refreshDisplays();
    lastKeyTime = 0;
  }

  delay(20);
}
`,
        },
      },
      {
        id: 'vcc2',
        type: 'vcc',
        label: 'VCC (+5V)',
        x: 920,
        y: 160,
        rotation: 0,
        mirrored: false,
        properties: { voltage: 5.0 },
      },
      {
        id: 'gnd2',
        type: 'gnd',
        label: 'GND',
        x: 920,
        y: 640,
        rotation: 0,
        mirrored: false,
        properties: {},
      },

      // 3 Side-by-Side Displays (Hundreds, Tens, Ones)
      {
        id: 'seg1',
        type: 'display-7seg',
        label: 'SEG1 (Hundreds)',
        x: 1460,
        y: 280,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'seg2',
        type: 'display-7seg',
        label: 'SEG2 (Tens)',
        x: 1600,
        y: 280,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'seg3',
        type: 'display-7seg',
        label: 'SEG3 (Ones)',
        x: 1740,
        y: 280,
        rotation: 0,
        mirrored: false,
        properties: {},
      },

      // 3 BCD Decoders directly underneath their displays
      {
        id: 'dec1',
        type: 'builtin_bcd_decoder',
        label: 'DEC1 (Hundreds CD4511)',
        x: 1460,
        y: 480,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'dec2',
        type: 'builtin_bcd_decoder',
        label: 'DEC2 (Tens CD4511)',
        x: 1600,
        y: 480,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'dec3',
        type: 'builtin_bcd_decoder',
        label: 'DEC3 (Ones CD4511)',
        x: 1740,
        y: 480,
        rotation: 0,
        mirrored: false,
        properties: {},
      },

      {
        id: 'note_rx',
        type: 'textbox',
        label: 'NOTE_RX',
        x: 1360,
        y: 80,
        rotation: 0,
        mirrored: false,
        properties: {
          text: "RECEIVER ISLAND & 3-STAGE SHIFT REGISTER:\n• IR_RX1 intercepts optical 940nm beam and feeds MCU_RX.\n• Digits shift left across 3x side-by-side 7-Segment Displays (_ _ 1 -> _ 1 2 -> 1 2 3).\n• Built-in 3000ms watchdog auto-resets display back to 0 0 0 if idle for 3 seconds.",
          fontSize: 'sm',
          fontWeight: 'normal',
          bgStyle: 'sticky-purple',
          borderStyle: 'solid',
          boxWidth: 460,
          boxHeight: 120,
        },
      },
    ],
    wires: [
      // Transmitter Island Wires
      {
        id: 'w_vcc_mcu_tx',
        fromCompId: 'vcc1',
        fromPinId: 'vcc',
        toCompId: 'mcu_tx',
        toPinId: '5v',
        waypoints: [{ x: 80, y: 280 }, { x: 380, y: 280 }],
        color: '#ef4444',
      },
      {
        id: 'w_gnd_mcu_tx',
        fromCompId: 'mcu_tx',
        fromPinId: 'gnd1',
        toCompId: 'gnd1',
        toPinId: 'gnd',
        waypoints: [{ x: 380, y: 520 }],
        color: '#1e293b',
      },
      {
        id: 'w_vcc_pad1',
        fromCompId: 'vcc1',
        fromPinId: 'vcc',
        toCompId: 'pad1',
        toPinId: 'vcc',
        waypoints: [{ x: 140, y: 220 }, { x: 140, y: 440 }],
        color: '#ef4444',
      },
      {
        id: 'w_gnd_pad1',
        fromCompId: 'pad1',
        fromPinId: 'gnd',
        toCompId: 'gnd1',
        toPinId: 'gnd',
        waypoints: [{ x: 180, y: 440 }, { x: 180, y: 520 }],
        color: '#1e293b',
      },
      {
        id: 'w_mcu_tx_d8_rtx',
        fromCompId: 'mcu_tx',
        fromPinId: 'd8',
        toCompId: 'r_tx',
        toPinId: 'p1',
        waypoints: [{ x: 560, y: 300 }],
        color: '#38bdf8',
      },
      {
        id: 'w_rtx_irtx',
        fromCompId: 'r_tx',
        fromPinId: 'p2',
        toCompId: 'ir_tx1',
        toPinId: 'anode',
        waypoints: [],
        color: '#38bdf8',
      },
      {
        id: 'w_irtx_gnd',
        fromCompId: 'ir_tx1',
        fromPinId: 'cathode',
        toCompId: 'gnd1',
        toPinId: 'gnd',
        waypoints: [{ x: 820, y: 300 }, { x: 820, y: 580 }, { x: 80, y: 580 }],
        color: '#1e293b',
      },
      {
        id: 'w_mcu_tx_d9_rled',
        fromCompId: 'mcu_tx',
        fromPinId: 'd9',
        toCompId: 'r_tx_led',
        toPinId: 'p1',
        waypoints: [{ x: 540, y: 220 }],
        color: '#22c55e',
      },
      {
        id: 'w_rled_ledtx',
        fromCompId: 'r_tx_led',
        fromPinId: 'p2',
        toCompId: 'led_tx',
        toPinId: 'anode',
        waypoints: [],
        color: '#22c55e',
      },
      {
        id: 'w_ledtx_gnd',
        fromCompId: 'led_tx',
        fromPinId: 'cathode',
        toCompId: 'gnd1',
        toPinId: 'gnd',
        waypoints: [{ x: 840, y: 220 }, { x: 840, y: 580 }],
        color: '#1e293b',
      },

      // Receiver Island Wires
      {
        id: 'w_vcc_mcu_rx',
        fromCompId: 'vcc2',
        fromPinId: 'vcc',
        toCompId: 'mcu_rx',
        toPinId: '5v',
        waypoints: [{ x: 920, y: 380 }, { x: 1080, y: 380 }],
        color: '#ef4444',
      },
      {
        id: 'w_gnd_mcu_rx',
        fromCompId: 'mcu_rx',
        fromPinId: 'gnd1',
        toCompId: 'gnd2',
        toPinId: 'gnd',
        waypoints: [{ x: 1080, y: 640 }],
        color: '#1e293b',
      },
      {
        id: 'w_vcc_irrx',
        fromCompId: 'vcc2',
        fromPinId: 'vcc',
        toCompId: 'ir_rx1',
        toPinId: 'vcc',
        waypoints: [{ x: 960, y: 160 }, { x: 960, y: 340 }],
        color: '#ef4444',
      },
      {
        id: 'w_gnd_irrx',
        fromCompId: 'ir_rx1',
        fromPinId: 'gnd',
        toCompId: 'gnd2',
        toPinId: 'gnd',
        waypoints: [{ x: 980, y: 340 }, { x: 980, y: 640 }],
        color: '#1e293b',
      },
      {
        id: 'w_irrx_out_mcu',
        fromCompId: 'ir_rx1',
        fromPinId: 'out',
        toCompId: 'mcu_rx',
        toPinId: 'd11',
        waypoints: [{ x: 1000, y: 340 }, { x: 1000, y: 400 }, { x: 1100, y: 400 }],
        color: '#38bdf8',
      },
      {
        id: 'w_mcu_rx_d12_rled',
        fromCompId: 'mcu_rx',
        fromPinId: 'd12',
        toCompId: 'r_rx_led',
        toPinId: 'p1',
        waypoints: [{ x: 1080, y: 380 }, { x: 1080, y: 220 }],
        color: '#eab308',
      },
      {
        id: 'w_rled_rx_led',
        fromCompId: 'r_rx_led',
        fromPinId: 'p2',
        toCompId: 'led_rx',
        toPinId: 'anode',
        waypoints: [],
        color: '#eab308',
      },
      {
        id: 'w_ledrx_gnd',
        fromCompId: 'led_rx',
        fromPinId: 'cathode',
        toCompId: 'gnd2',
        toPinId: 'gnd',
        waypoints: [{ x: 1280, y: 220 }, { x: 1280, y: 700 }, { x: 920, y: 700 }],
        color: '#1e293b',
      },

      // Decoders Power & Ground
      { id: 'w_vcc_dec1', fromCompId: 'vcc2', fromPinId: 'vcc', toCompId: 'dec1', toPinId: 'vcc', waypoints: [{ x: 1460, y: 160 }, { x: 1460, y: 400 }], color: '#ef4444' },
      { id: 'w_vcc_dec2', fromCompId: 'vcc2', fromPinId: 'vcc', toCompId: 'dec2', toPinId: 'vcc', waypoints: [{ x: 1600, y: 160 }, { x: 1600, y: 400 }], color: '#ef4444' },
      { id: 'w_vcc_dec3', fromCompId: 'vcc2', fromPinId: 'vcc', toCompId: 'dec3', toPinId: 'vcc', waypoints: [{ x: 1740, y: 160 }, { x: 1740, y: 400 }], color: '#ef4444' },

      { id: 'w_gnd_dec1', fromCompId: 'dec1', fromPinId: 'gnd', toCompId: 'gnd2', toPinId: 'gnd', waypoints: [{ x: 1460, y: 560 }, { x: 1460, y: 640 }], color: '#1e293b' },
      { id: 'w_gnd_dec2', fromCompId: 'dec2', fromPinId: 'gnd', toCompId: 'gnd2', toPinId: 'gnd', waypoints: [{ x: 1600, y: 560 }, { x: 1600, y: 640 }], color: '#1e293b' },
      { id: 'w_gnd_dec3', fromCompId: 'dec3', fromPinId: 'gnd', toCompId: 'gnd2', toPinId: 'gnd', waypoints: [{ x: 1740, y: 560 }, { x: 1740, y: 640 }, { x: 920, y: 640 }], color: '#1e293b' },

      // MCU to DEC1 (Hundreds: A2..A5 -> D0..D3)
      { id: 'w_mcu_a2_dec1_d0', fromCompId: 'mcu_rx', fromPinId: 'a2', toCompId: 'dec1', toPinId: 'd0', waypoints: [{ x: 1360, y: 420 }, { x: 1400, y: 420 }], color: '#38bdf8' },
      { id: 'w_mcu_a3_dec1_d1', fromCompId: 'mcu_rx', fromPinId: 'a3', toCompId: 'dec1', toPinId: 'd1', waypoints: [{ x: 1380, y: 460 }, { x: 1400, y: 460 }], color: '#38bdf8' },
      { id: 'w_mcu_a4_dec1_d2', fromCompId: 'mcu_rx', fromPinId: 'a4', toCompId: 'dec1', toPinId: 'd2', waypoints: [{ x: 1360, y: 500 }, { x: 1400, y: 500 }], color: '#38bdf8' },
      { id: 'w_mcu_a5_dec1_d3', fromCompId: 'mcu_rx', fromPinId: 'a5', toCompId: 'dec1', toPinId: 'd3', waypoints: [{ x: 1380, y: 540 }, { x: 1400, y: 540 }], color: '#38bdf8' },

      // MCU to DEC2 (Tens: D6..D9 -> D0..D3)
      { id: 'w_mcu_d6_dec2_d0', fromCompId: 'mcu_rx', fromPinId: 'd6', toCompId: 'dec2', toPinId: 'd0', waypoints: [{ x: 1340, y: 420 }, { x: 1540, y: 420 }], color: '#a855f7' },
      { id: 'w_mcu_d7_dec2_d1', fromCompId: 'mcu_rx', fromPinId: 'd7', toCompId: 'dec2', toPinId: 'd1', waypoints: [{ x: 1340, y: 460 }, { x: 1540, y: 460 }], color: '#a855f7' },
      { id: 'w_mcu_d8_dec2_d2', fromCompId: 'mcu_rx', fromPinId: 'd8', toCompId: 'dec2', toPinId: 'd2', waypoints: [{ x: 1340, y: 500 }, { x: 1540, y: 500 }], color: '#a855f7' },
      { id: 'w_mcu_d9_dec2_d3', fromCompId: 'mcu_rx', fromPinId: 'd9', toCompId: 'dec2', toPinId: 'd3', waypoints: [{ x: 1340, y: 540 }, { x: 1540, y: 540 }], color: '#a855f7' },

      // MCU to DEC3 (Ones: D2..D5 -> D0..D3)
      { id: 'w_mcu_d2_dec3_d0', fromCompId: 'mcu_rx', fromPinId: 'd2', toCompId: 'dec3', toPinId: 'd0', waypoints: [{ x: 1320, y: 420 }, { x: 1680, y: 420 }], color: '#22c55e' },
      { id: 'w_mcu_d3_dec3_d1', fromCompId: 'mcu_rx', fromPinId: 'd3', toCompId: 'dec3', toPinId: 'd1', waypoints: [{ x: 1320, y: 460 }, { x: 1680, y: 460 }], color: '#22c55e' },
      { id: 'w_mcu_d4_dec3_d2', fromCompId: 'mcu_rx', fromPinId: 'd4', toCompId: 'dec3', toPinId: 'd2', waypoints: [{ x: 1320, y: 500 }, { x: 1680, y: 500 }], color: '#22c55e' },
      { id: 'w_mcu_d5_dec3_d3', fromCompId: 'mcu_rx', fromPinId: 'd5', toCompId: 'dec3', toPinId: 'd3', waypoints: [{ x: 1320, y: 540 }, { x: 1680, y: 540 }], color: '#22c55e' },

      // DEC1 to SEG1 (qa..qg -> pin_a..pin_g)
      { id: 'w_dec1_qa', fromCompId: 'dec1', fromPinId: 'qa', toCompId: 'seg1', toPinId: 'pin_a', waypoints: [{ x: 1520, y: 420 }, { x: 1520, y: 220 }, { x: 1480, y: 220 }, { x: 1480, y: 280 }], color: '#eab308' },
      { id: 'w_dec1_qb', fromCompId: 'dec1', fromPinId: 'qb', toCompId: 'seg1', toPinId: 'pin_b', waypoints: [{ x: 1520, y: 440 }, { x: 1520, y: 240 }, { x: 1500, y: 240 }, { x: 1500, y: 280 }], color: '#eab308' },
      { id: 'w_dec1_qc', fromCompId: 'dec1', fromPinId: 'qc', toCompId: 'seg1', toPinId: 'pin_c', waypoints: [{ x: 1520, y: 460 }, { x: 1520, y: 260 }, { x: 1520, y: 280 }], color: '#eab308' },
      { id: 'w_dec1_qd', fromCompId: 'dec1', fromPinId: 'qd', toCompId: 'seg1', toPinId: 'pin_d', waypoints: [{ x: 1520, y: 480 }, { x: 1520, y: 400 }], color: '#eab308' },
      { id: 'w_dec1_qe', fromCompId: 'dec1', fromPinId: 'qe', toCompId: 'seg1', toPinId: 'pin_e', waypoints: [{ x: 1520, y: 500 }, { x: 1500, y: 500 }, { x: 1500, y: 400 }], color: '#eab308' },
      { id: 'w_dec1_qf', fromCompId: 'dec1', fromPinId: 'qf', toCompId: 'seg1', toPinId: 'pin_f', waypoints: [{ x: 1520, y: 520 }, { x: 1480, y: 520 }, { x: 1480, y: 400 }], color: '#eab308' },
      { id: 'w_dec1_qg', fromCompId: 'dec1', fromPinId: 'qg', toCompId: 'seg1', toPinId: 'pin_g', waypoints: [{ x: 1520, y: 540 }, { x: 1460, y: 540 }, { x: 1460, y: 320 }], color: '#eab308' },
      { id: 'w_seg1_com', fromCompId: 'seg1', fromPinId: 'com1', toCompId: 'gnd2', toPinId: 'gnd', waypoints: [{ x: 1540, y: 300 }, { x: 1540, y: 640 }], color: '#1e293b' },

      // DEC2 to SEG2 (qa..qg -> pin_a..pin_g)
      { id: 'w_dec2_qa', fromCompId: 'dec2', fromPinId: 'qa', toCompId: 'seg2', toPinId: 'pin_a', waypoints: [{ x: 1660, y: 420 }, { x: 1660, y: 220 }, { x: 1620, y: 220 }, { x: 1620, y: 280 }], color: '#eab308' },
      { id: 'w_dec2_qb', fromCompId: 'dec2', fromPinId: 'qb', toCompId: 'seg2', toPinId: 'pin_b', waypoints: [{ x: 1660, y: 440 }, { x: 1660, y: 240 }, { x: 1640, y: 240 }, { x: 1640, y: 280 }], color: '#eab308' },
      { id: 'w_dec2_qc', fromCompId: 'dec2', fromPinId: 'qc', toCompId: 'seg2', toPinId: 'pin_c', waypoints: [{ x: 1660, y: 460 }, { x: 1660, y: 260 }, { x: 1660, y: 280 }], color: '#eab308' },
      { id: 'w_dec2_qd', fromCompId: 'dec2', fromPinId: 'qd', toCompId: 'seg2', toPinId: 'pin_d', waypoints: [{ x: 1660, y: 480 }, { x: 1660, y: 400 }], color: '#eab308' },
      { id: 'w_dec2_qe', fromCompId: 'dec2', fromPinId: 'qe', toCompId: 'seg2', toPinId: 'pin_e', waypoints: [{ x: 1660, y: 500 }, { x: 1640, y: 500 }, { x: 1640, y: 400 }], color: '#eab308' },
      { id: 'w_dec2_qf', fromCompId: 'dec2', fromPinId: 'qf', toCompId: 'seg2', toPinId: 'pin_f', waypoints: [{ x: 1660, y: 520 }, { x: 1620, y: 520 }, { x: 1620, y: 400 }], color: '#eab308' },
      { id: 'w_dec2_qg', fromCompId: 'dec2', fromPinId: 'qg', toCompId: 'seg2', toPinId: 'pin_g', waypoints: [{ x: 1660, y: 540 }, { x: 1600, y: 540 }, { x: 1600, y: 320 }], color: '#eab308' },
      { id: 'w_seg2_com', fromCompId: 'seg2', fromPinId: 'com1', toCompId: 'gnd2', toPinId: 'gnd', waypoints: [{ x: 1680, y: 300 }, { x: 1680, y: 640 }], color: '#1e293b' },

      // DEC3 to SEG3 (qa..qg -> pin_a..pin_g)
      { id: 'w_dec3_qa', fromCompId: 'dec3', fromPinId: 'qa', toCompId: 'seg3', toPinId: 'pin_a', waypoints: [{ x: 1800, y: 420 }, { x: 1800, y: 220 }, { x: 1760, y: 220 }, { x: 1760, y: 280 }], color: '#eab308' },
      { id: 'w_dec3_qb', fromCompId: 'dec3', fromPinId: 'qb', toCompId: 'seg3', toPinId: 'pin_b', waypoints: [{ x: 1800, y: 440 }, { x: 1800, y: 240 }, { x: 1780, y: 240 }, { x: 1780, y: 280 }], color: '#eab308' },
      { id: 'w_dec3_qc', fromCompId: 'dec3', fromPinId: 'qc', toCompId: 'seg3', toPinId: 'pin_c', waypoints: [{ x: 1800, y: 460 }, { x: 1800, y: 260 }, { x: 1800, y: 280 }], color: '#eab308' },
      { id: 'w_dec3_qd', fromCompId: 'dec3', fromPinId: 'qd', toCompId: 'seg3', toPinId: 'pin_d', waypoints: [{ x: 1800, y: 480 }, { x: 1800, y: 400 }], color: '#eab308' },
      { id: 'w_dec3_qe', fromCompId: 'dec3', fromPinId: 'qe', toCompId: 'seg3', toPinId: 'pin_e', waypoints: [{ x: 1800, y: 500 }, { x: 1780, y: 500 }, { x: 1780, y: 400 }], color: '#eab308' },
      { id: 'w_dec3_qf', fromCompId: 'dec3', fromPinId: 'qf', toCompId: 'seg3', toPinId: 'pin_f', waypoints: [{ x: 1800, y: 520 }, { x: 1760, y: 520 }, { x: 1760, y: 400 }], color: '#eab308' },
      { id: 'w_dec3_qg', fromCompId: 'dec3', fromPinId: 'qg', toCompId: 'seg3', toPinId: 'pin_g', waypoints: [{ x: 1800, y: 540 }, { x: 1740, y: 540 }, { x: 1740, y: 320 }], color: '#eab308' },
      { id: 'w_seg3_com', fromCompId: 'seg3', fromPinId: 'com1', toCompId: 'gnd2', toPinId: 'gnd', waypoints: [{ x: 1820, y: 300 }, { x: 1820, y: 640 }, { x: 920, y: 640 }], color: '#1e293b' },
    ],
  },
  },

  // -------------------------------------------------------------------------
  // Template 11: Professional 2 - Solar-Powered Autonomous Plant Caretaking & Micro-Climate System
  // -------------------------------------------------------------------------
  {
  id: 'prof_solar_plant_care',
  title: 'Professional 2: Solar-Powered Autonomous Plant Caretaking & Micro-Climate System',
  category: 'Professional',
  tier: 'Professional',
  badge: 'Professional',
  description: 'Autonomous ecological microgrid. Zone 1 harvests solar energy via Buck-Boost regulator, 470µF reservoir capacitor, and 10-bar LED battery gauge. Zone 2 monitors Soil Moisture, DHT22, TMP36, and LDR light comparator. Zone 3 orchestrates logic on Arduino Uno with SSD1306 OLED & MicroSD logger. Zone 4 actuates irrigation pump, cooling fan, motorized ventilation louvers, and grow lamp.',
  componentCount: 32,
  circuit: {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    name: 'Solar-Powered Autonomous Plant Caretaking & Micro-Climate System',
    viewport: { zoom: 0.75, panX: 40, panY: 40 },
    components: [
      // --- ZONE 1: SOLAR POWER & ENERGY STORAGE ---
      {
        id: 'solar1',
        type: 'builtin_solar_panel',
        label: 'SOLAR1 (Photovoltaic)',
        x: 180,
        y: 220,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'd1',
        type: 'diode',
        label: 'D1 (1N4007 Schottky)',
        x: 300,
        y: 200,
        rotation: 0,
        mirrored: false,
        properties: { forwardVoltage: 0.7 },
      },
      {
        id: 'c1',
        type: 'capacitor-electrolytic',
        label: 'C1 (470µF Storage)',
        x: 420,
        y: 240,
        rotation: 0,
        mirrored: false,
        properties: { capacitance: 470 },
      },
      {
        id: 'dcdc1',
        type: 'builtin_dcdc_converter',
        label: 'DCDC1 (Buck-Boost 5V)',
        x: 560,
        y: 220,
        rotation: 0,
        mirrored: false,
        properties: { outputVoltage: 5.0 },
      },
      {
        id: 'fuse1',
        type: 'builtin_fuse',
        label: 'FUSE1 (2A)',
        x: 700,
        y: 200,
        rotation: 0,
        mirrored: false,
        properties: { currentRating: 2.0 },
      },
      {
        id: 'bar1',
        type: 'builtin_led_bar_graph',
        label: 'BAR1 (10-Bar Rail SOC)',
        x: 820,
        y: 220,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'gnd_pwr',
        type: 'gnd',
        label: 'GND',
        x: 420,
        y: 340,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'note_z1',
        type: 'textbox',
        label: 'NOTE_Z1',
        x: 180,
        y: 60,
        rotation: 0,
        mirrored: false,
        properties: {
          text: "ZONE 1: SOLAR POWER & ENERGY STORAGE\n• Solar panel charges 470µF reservoir capacitor via 1N4007 diode.\n• Buck-Boost regulator converts raw solar into stable 5V rail.\n• 10-Segment LED bar graph displays instantaneous rail voltage.",
          fontSize: 'sm',
          fontWeight: 'normal',
          bgStyle: 'sticky-yellow',
          borderStyle: 'solid',
          boxWidth: 380,
          boxHeight: 110,
        },
      },

      // --- ZONE 2: SENSOR TELEMETRY ARRAY ---
      {
        id: 'soil1',
        type: 'builtin_soil_moisture',
        label: 'SOIL1 (Moisture Sensor)',
        x: 180,
        y: 520,
        rotation: 0,
        mirrored: false,
        properties: { moisture: 38 },
      },
      {
        id: 'dht1',
        type: 'builtin_humidity_sensor',
        label: 'DHT1 (DHT22 Humidity)',
        x: 320,
        y: 520,
        rotation: 0,
        mirrored: false,
        properties: { humidity: 55 },
      },
      {
        id: 'temp1',
        type: 'temp-sensor',
        label: 'TEMP1 (TMP36 Celsius)',
        x: 460,
        y: 520,
        rotation: 0,
        mirrored: false,
        properties: { temperature: 26 },
      },
      {
        id: 'ldr1',
        type: 'light-sensor',
        label: 'LDR1 (Photoresistor)',
        x: 600,
        y: 520,
        rotation: 0,
        mirrored: false,
        properties: { resistance: 5000 },
      },
      {
        id: 'r_ldr',
        type: 'resistor',
        label: 'R_LDR (10kΩ)',
        x: 600,
        y: 620,
        rotation: 0,
        mirrored: false,
        properties: { resistance: 10000 },
      },
      {
        id: 'comp1',
        type: 'builtin_comparator',
        label: 'COMP1 (LM393 Comparator)',
        x: 740,
        y: 520,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'vcc_sens',
        type: 'vcc',
        label: 'VCC (+5V)',
        x: 180,
        y: 420,
        rotation: 0,
        mirrored: false,
        properties: { voltage: 5.0 },
      },
      {
        id: 'gnd_sens',
        type: 'gnd',
        label: 'GND',
        x: 460,
        y: 700,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'note_z2',
        type: 'textbox',
        label: 'NOTE_Z2',
        x: 180,
        y: 760,
        rotation: 0,
        mirrored: false,
        properties: {
          text: "ZONE 2: SENSOR TELEMETRY ARRAY\n• Soil Moisture sensor monitors hydration levels (trigger < 45%).\n• DHT22 & TMP36 measure micro-climate temperature and relative humidity.\n• LDR + LM393 comparator detects twilight for grow lighting control.",
          fontSize: 'sm',
          fontWeight: 'normal',
          bgStyle: 'sticky-blue',
          borderStyle: 'solid',
          boxWidth: 380,
          boxHeight: 110,
        },
      },

      // --- ZONE 3: MCU TELEMETRY & SD LOGGING ---
      {
        id: 'mcu1',
        type: 'arduino-uno',
        label: 'MCU1 (Plant Care Controller)',
        x: 1080,
        y: 440,
        rotation: 0,
        mirrored: false,
        properties: {
          code: `// SECS Autonomous Solar-Powered Plant Care System
const int PIN_PUMP = 2;
const int PIN_FAN = 3;
const int PIN_LAMP_RELAY = 4;
const int PIN_PUMP_LED = 5;
const int PIN_COMP_LIGHT = 6;
const int PIN_SERVO = 9;

const int PIN_SOIL = A0;
const int PIN_TEMP = A1;
const int PIN_HUM = A2;
const int PIN_LDR = A3;

Servo louverServo;

void setup() {
  Serial.begin(9600);
  pinMode(PIN_PUMP, OUTPUT);
  pinMode(PIN_FAN, OUTPUT);
  pinMode(PIN_LAMP_RELAY, OUTPUT);
  pinMode(PIN_PUMP_LED, OUTPUT);
  pinMode(PIN_COMP_LIGHT, INPUT);
  
  louverServo.attach(PIN_SERVO);
  louverServo.write(0); // louvers closed

  OLED.begin();
  OLED.clear();
  OLED.println("🌱 SECS ECO-OS v4.2");
  OLED.println("SOLAR PLANT CARE ONLINE");

  SD.begin(10);
  SD.println("time_ms,soil_pct,temp_c,hum_pct,light_pct,pump_on,fan_on,lamp_on");
  Serial.println("SYSTEM INITIALIZED - AUTONOMOUS IRRIGATION & CLIMATE READY");
}

void loop() {
  // 1. Read agronomic sensors
  int rawSoil = analogRead(PIN_SOIL);
  int soilPct = map(rawSoil, 0, 1023, 0, 100);

  int rawTemp = analogRead(PIN_TEMP);
  float tempC = ((rawTemp * 5.0 / 1023.0) - 0.5) * 100.0;

  int rawHum = analogRead(PIN_HUM);
  int humPct = map(rawHum, 0, 1023, 20, 95);

  int rawLight = analogRead(PIN_LDR);
  int lightPct = map(rawLight, 0, 1023, 0, 100);
  int compLight = digitalRead(PIN_COMP_LIGHT);

  // 2. Control Logic
  bool pumpActive = soilPct < 45;
  digitalWrite(PIN_PUMP, pumpActive ? HIGH : LOW);
  digitalWrite(PIN_PUMP_LED, pumpActive ? HIGH : LOW);

  bool fanActive = tempC > 27.0 || humPct > 65;
  digitalWrite(PIN_FAN, fanActive ? HIGH : LOW);
  louverServo.write(fanActive ? 90 : 0);

  bool lampActive = compLight == LOW || lightPct < 35;
  digitalWrite(PIN_LAMP_RELAY, lampActive ? HIGH : LOW);

  // 3. Update OLED HUD
  OLED.clear();
  OLED.print("SOIL:");
  OLED.print(soilPct);
  OLED.print("% LIGHT:");
  OLED.print(lightPct);
  OLED.println("%");

  OLED.print("TEMP:");
  OLED.print(tempC, 1);
  OLED.print("C HUM:");
  OLED.print(humPct);
  OLED.println("%");

  OLED.print("PUMP:");
  OLED.print(pumpActive ? "[ON]" : "[OFF]");
  OLED.print(" FAN:");
  OLED.println(fanActive ? "[ON]" : "[OFF]");

  OLED.print("LOUVER:");
  OLED.print(fanActive ? "90d" : "0d");
  OLED.print(" LAMP:");
  OLED.println(lampActive ? "[ON]" : "[OFF]");

  // 4. Append to SD Card
  SD.print(millis());
  SD.print(",");
  SD.print(soilPct);
  SD.print(",");
  SD.print(tempC, 1);
  SD.print(",");
  SD.print(humPct);
  SD.print(",");
  SD.print(lightPct);
  SD.print(",");
  SD.print(pumpActive ? 1 : 0);
  SD.print(",");
  SD.print(fanActive ? 1 : 0);
  SD.print(",");
  SD.println(lampActive ? 1 : 0);

  delay(400);
}
`,
        },
      },
      {
        id: 'oled1',
        type: 'builtin_oled_display',
        label: 'OLED1 (SSD1306 HUD)',
        x: 1080,
        y: 180,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'sd1',
        type: 'builtin_sd_card',
        label: 'SD1 (FAT32 Logger)',
        x: 1320,
        y: 180,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'gnd_mcu',
        type: 'gnd',
        label: 'GND',
        x: 1080,
        y: 720,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'note_z3',
        type: 'textbox',
        label: 'NOTE_Z3',
        x: 1020,
        y: 60,
        rotation: 0,
        mirrored: false,
        properties: {
          text: "ZONE 3: MCU TELEMETRY & SD LOGGING\n• Arduino Uno samples agronomic analog & digital inputs.\n• Real-time OLED HUD updates soil moisture, temp, humidity, and actuator states.\n• Appends timestamped CSV data records to MicroSD card.",
          fontSize: 'sm',
          fontWeight: 'normal',
          bgStyle: 'sticky-green',
          borderStyle: 'solid',
          boxWidth: 380,
          boxHeight: 110,
        },
      },

      // --- ZONE 4: ACTUATION SUB-SYSTEMS ---
      {
        id: 'pump1',
        type: 'builtin_water_pump',
        label: 'PUMP1 (Submersible 5V)',
        x: 1540,
        y: 380,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'r_pump_led',
        type: 'resistor',
        label: 'R_PUMP (330Ω)',
        x: 1600,
        y: 340,
        rotation: 0,
        mirrored: false,
        properties: { resistance: 330 },
      },
      {
        id: 'led_pump',
        type: 'led-blue',
        label: 'LED_IRRIGATION',
        x: 1680,
        y: 340,
        rotation: 0,
        mirrored: false,
        properties: { color: '#38bdf8' },
      },
      {
        id: 'fan1',
        type: 'dc-fan',
        label: 'FAN1 (Exhaust 12V/5V)',
        x: 1540,
        y: 520,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'servo1',
        type: 'builtin_servo_motor',
        label: 'SERVO1 (Louver 90°)',
        x: 1680,
        y: 520,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'relay1',
        type: 'relay',
        label: 'RELAY1 (5V Coil)',
        x: 1540,
        y: 680,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'bulb1',
        type: 'builtin_filament_bulb',
        label: 'BULB1 (Grow Light 40W)',
        x: 1720,
        y: 680,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'v_bulb',
        type: 'dc-source',
        label: 'V_LAMP (12V)',
        x: 1840,
        y: 680,
        rotation: 0,
        mirrored: false,
        properties: { voltage: 12.0 },
      },
      {
        id: 'gnd_act',
        type: 'gnd',
        label: 'GND',
        x: 1540,
        y: 820,
        rotation: 0,
        mirrored: false,
        properties: {},
      },
      {
        id: 'note_z4',
        type: 'textbox',
        label: 'NOTE_Z4',
        x: 1480,
        y: 60,
        rotation: 0,
        mirrored: false,
        properties: {
          text: "ZONE 4: ACTUATION SUB-SYSTEMS\n• PUMP1 delivers targeted root hydration when soil drops below 45%.\n• FAN1 & SERVO1 open louvers to 90° for rapid heat & humidity extraction.\n• RELAY1 engages high-intensity BULB1 when ambient sunlight fades.",
          fontSize: 'sm',
          fontWeight: 'normal',
          bgStyle: 'sticky-purple',
          borderStyle: 'solid',
          boxWidth: 400,
          boxHeight: 110,
        },
      },
    ],
    wires: [
      // Zone 1: Solar to D1 to C1 to DCDC to Fuse to Bar
      { id: 'w_solar_pos_d1', fromCompId: 'solar1', fromPinId: 'pos', toCompId: 'd1', toPinId: 'anode', waypoints: [{ x: 220, y: 200 }], color: '#ef4444' },
      { id: 'w_d1_c1_pos', fromCompId: 'd1', fromPinId: 'cathode', toCompId: 'c1', toPinId: 'pos', waypoints: [{ x: 420, y: 200 }, { x: 500, y: 200 }, { x: 500, y: 260 }], color: '#ef4444' },
      { id: 'w_c1_dcdc_in', fromCompId: 'c1', fromPinId: 'pos', toCompId: 'dcdc1', toPinId: 'vin_plus', waypoints: [{ x: 500, y: 200 }], color: '#ef4444' },
      { id: 'w_solar_neg_c1_neg', fromCompId: 'solar1', fromPinId: 'neg', toCompId: 'c1', toPinId: 'neg', waypoints: [{ x: 220, y: 240 }, { x: 220, y: 260 }, { x: 420, y: 260 }], color: '#1e293b' },
      { id: 'w_c1_neg_dcdc_in_neg', fromCompId: 'c1', fromPinId: 'neg', toCompId: 'dcdc1', toPinId: 'vin_minus', waypoints: [{ x: 420, y: 260 }, { x: 500, y: 260 }, { x: 500, y: 240 }], color: '#1e293b' },
      { id: 'w_c1_neg_gnd', fromCompId: 'c1', fromPinId: 'neg', toCompId: 'gnd_pwr', toPinId: 'gnd', waypoints: [{ x: 420, y: 340 }], color: '#1e293b' },
      { id: 'w_dcdc_out_fuse', fromCompId: 'dcdc1', fromPinId: 'vout_plus', toCompId: 'fuse1', toPinId: 'p1', waypoints: [{ x: 620, y: 200 }], color: '#ef4444' },
      { id: 'w_fuse_bar_ain', fromCompId: 'fuse1', fromPinId: 'p2', toCompId: 'bar1', toPinId: 'ain', waypoints: [{ x: 780, y: 200 }, { x: 780, y: 240 }, { x: 860, y: 240 }], color: '#ef4444' },
      { id: 'w_dcdc_out_neg_gnd', fromCompId: 'dcdc1', fromPinId: 'vout_minus', toCompId: 'gnd_pwr', toPinId: 'gnd', waypoints: [{ x: 620, y: 240 }, { x: 620, y: 340 }, { x: 440, y: 340 }], color: '#1e293b' },
      { id: 'w_bar_gnd', fromCompId: 'bar1', fromPinId: 'gnd', toCompId: 'gnd_pwr', toPinId: 'gnd', waypoints: [{ x: 860, y: 280 }, { x: 860, y: 340 }, { x: 440, y: 340 }], color: '#1e293b' },

      // Zone 2: Sensors to VCC & GND & MCU
      { id: 'w_vcc_soil', fromCompId: 'vcc_sens', fromPinId: 'vcc', toCompId: 'soil1', toPinId: 'vcc', waypoints: [{ x: 160, y: 420 }, { x: 160, y: 460 }], color: '#ef4444' },
      { id: 'w_soil_gnd', fromCompId: 'soil1', fromPinId: 'gnd', toCompId: 'gnd_sens', toPinId: 'gnd', waypoints: [{ x: 200, y: 460 }, { x: 200, y: 700 }], color: '#1e293b' },
      { id: 'w_soil_out_mcu_a0', fromCompId: 'soil1', fromPinId: 'out', toCompId: 'mcu1', toPinId: 'a0', waypoints: [{ x: 180, y: 460 }, { x: 180, y: 480 }, { x: 1040, y: 480 }], color: '#f97316' },

      { id: 'w_vcc_dht', fromCompId: 'vcc_sens', fromPinId: 'vcc', toCompId: 'dht1', toPinId: 'vcc', waypoints: [{ x: 300, y: 420 }, { x: 300, y: 560 }], color: '#ef4444' },
      { id: 'w_dht_gnd', fromCompId: 'dht1', fromPinId: 'gnd', toCompId: 'gnd_sens', toPinId: 'gnd', waypoints: [{ x: 340, y: 560 }, { x: 340, y: 700 }], color: '#1e293b' },
      { id: 'w_dht_out_mcu_a2', fromCompId: 'dht1', fromPinId: 'out', toCompId: 'mcu1', toPinId: 'a2', waypoints: [{ x: 320, y: 560 }, { x: 320, y: 500 }, { x: 1040, y: 500 }], color: '#38bdf8' },

      { id: 'w_vcc_temp', fromCompId: 'vcc_sens', fromPinId: 'vcc', toCompId: 'temp1', toPinId: 'vcc', waypoints: [{ x: 460, y: 420 }, { x: 460, y: 540 }], color: '#ef4444' },
      { id: 'w_temp_gnd', fromCompId: 'temp1', fromPinId: 'gnd', toCompId: 'gnd_sens', toPinId: 'gnd', waypoints: [{ x: 540, y: 540 }, { x: 540, y: 700 }], color: '#1e293b' },
      { id: 'w_temp_vout_mcu_a1', fromCompId: 'temp1', fromPinId: 'vout', toCompId: 'mcu1', toPinId: 'a1', waypoints: [{ x: 500, y: 520 }, { x: 500, y: 460 }, { x: 1040, y: 460 }], color: '#eab308' },

      { id: 'w_vcc_ldr', fromCompId: 'vcc_sens', fromPinId: 'vcc', toCompId: 'ldr1', toPinId: 'p1', waypoints: [{ x: 600, y: 420 }, { x: 600, y: 540 }], color: '#ef4444' },
      { id: 'w_ldr_r_ldr', fromCompId: 'ldr1', fromPinId: 'p2', toCompId: 'r_ldr', toPinId: 'p1', waypoints: [{ x: 680, y: 540 }, { x: 680, y: 640 }, { x: 600, y: 640 }], color: '#eab308' },
      { id: 'w_r_ldr_gnd', fromCompId: 'r_ldr', fromPinId: 'p2', toCompId: 'gnd_sens', toPinId: 'gnd', waypoints: [{ x: 680, y: 640 }, { x: 680, y: 700 }], color: '#1e293b' },
      { id: 'w_ldr_mid_mcu_a3', fromCompId: 'ldr1', fromPinId: 'p2', toCompId: 'mcu1', toPinId: 'a3', waypoints: [{ x: 680, y: 540 }, { x: 680, y: 520 }, { x: 1040, y: 520 }], color: '#eab308' },

      // LM393 Comparator
      { id: 'w_ldr_comp_in_plus', fromCompId: 'ldr1', fromPinId: 'p2', toCompId: 'comp1', toPinId: 'in_plus', waypoints: [{ x: 680, y: 540 }, { x: 700, y: 540 }, { x: 700, y: 500 }], color: '#eab308' },
      { id: 'w_vcc_comp', fromCompId: 'vcc_sens', fromPinId: 'vcc', toCompId: 'comp1', toPinId: 'vcc', waypoints: [{ x: 740, y: 420 }, { x: 740, y: 480 }], color: '#ef4444' },
      { id: 'w_comp_gnd', fromCompId: 'comp1', fromPinId: 'gnd', toCompId: 'gnd_sens', toPinId: 'gnd', waypoints: [{ x: 740, y: 560 }, { x: 740, y: 700 }], color: '#1e293b' },
      { id: 'w_comp_out_mcu_d6', fromCompId: 'comp1', fromPinId: 'out', toCompId: 'mcu1', toPinId: 'd6', waypoints: [{ x: 780, y: 520 }, { x: 880, y: 520 }, { x: 880, y: 420 }, { x: 1040, y: 420 }], color: '#22c55e' },

      // Zone 3: MCU to OLED & SD
      { id: 'w_mcu_scl_oled', fromCompId: 'mcu1', fromPinId: 'scl', toCompId: 'oled1', toPinId: 'sck', waypoints: [{ x: 1060, y: 340 }, { x: 1060, y: 220 }, { x: 1080, y: 220 }], color: '#eab308' },
      { id: 'w_mcu_sda_oled', fromCompId: 'mcu1', fromPinId: 'sda', toCompId: 'oled1', toPinId: 'sda', waypoints: [{ x: 1080, y: 340 }, { x: 1080, y: 220 }, { x: 1100, y: 220 }], color: '#22c55e' },
      { id: 'w_mcu_5v_oled', fromCompId: 'mcu1', fromPinId: '5v', toCompId: 'oled1', toPinId: 'vcc', waypoints: [{ x: 1040, y: 360 }, { x: 1040, y: 220 }, { x: 1060, y: 220 }], color: '#ef4444' },
      { id: 'w_oled_gnd', fromCompId: 'oled1', fromPinId: 'gnd', toCompId: 'gnd_mcu', toPinId: 'gnd', waypoints: [{ x: 1040, y: 220 }, { x: 1020, y: 220 }, { x: 1020, y: 720 }, { x: 1080, y: 720 }], color: '#1e293b' },

      { id: 'w_mcu_5v_sd', fromCompId: 'mcu1', fromPinId: '5v', toCompId: 'sd1', toPinId: 'vcc', waypoints: [{ x: 1040, y: 360 }, { x: 1040, y: 220 }, { x: 1280, y: 220 }], color: '#ef4444' },
      { id: 'w_sd_gnd', fromCompId: 'sd1', fromPinId: 'gnd', toCompId: 'gnd_mcu', toPinId: 'gnd', waypoints: [{ x: 1260, y: 220 }, { x: 1260, y: 720 }, { x: 1080, y: 720 }], color: '#1e293b' },
      { id: 'w_mcu_d13_sd_sck', fromCompId: 'mcu1', fromPinId: 'd13', toCompId: 'sd1', toPinId: 'sck', waypoints: [{ x: 1120, y: 340 }, { x: 1120, y: 260 }, { x: 1360, y: 260 }, { x: 1360, y: 220 }], color: '#38bdf8' },
      { id: 'w_mcu_d12_sd_miso', fromCompId: 'mcu1', fromPinId: 'd12', toCompId: 'sd1', toPinId: 'miso', waypoints: [{ x: 1140, y: 340 }, { x: 1140, y: 280 }, { x: 1300, y: 280 }, { x: 1300, y: 220 }], color: '#a855f7' },
      { id: 'w_mcu_d11_sd_mosi', fromCompId: 'mcu1', fromPinId: 'd11', toCompId: 'sd1', toPinId: 'mosi', waypoints: [{ x: 1160, y: 340 }, { x: 1160, y: 300 }, { x: 1340, y: 300 }, { x: 1340, y: 220 }], color: '#22c55e' },
      { id: 'w_mcu_d10_sd_cs', fromCompId: 'mcu1', fromPinId: 'd10', toCompId: 'sd1', toPinId: 'cs', waypoints: [{ x: 1180, y: 340 }, { x: 1180, y: 320 }, { x: 1380, y: 320 }, { x: 1380, y: 220 }], color: '#f97316' },
      { id: 'w_mcu_gnd', fromCompId: 'mcu1', fromPinId: 'gnd1', toCompId: 'gnd_mcu', toPinId: 'gnd', waypoints: [{ x: 1100, y: 340 }, { x: 1100, y: 720 }], color: '#1e293b' },

      // Zone 4: MCU to Actuators
      // Pump & LED
      { id: 'w_mcu_d2_pump', fromCompId: 'mcu1', fromPinId: 'd2', toCompId: 'pump1', toPinId: 'p_plus', waypoints: [{ x: 1220, y: 380 }, { x: 1500, y: 380 }, { x: 1500, y: 360 }], color: '#38bdf8' },
      { id: 'w_pump_gnd', fromCompId: 'pump1', fromPinId: 'p_minus', toCompId: 'gnd_act', toPinId: 'gnd', waypoints: [{ x: 1500, y: 400 }, { x: 1500, y: 820 }, { x: 1540, y: 820 }], color: '#1e293b' },
      { id: 'w_mcu_d5_rpump_led', fromCompId: 'mcu1', fromPinId: 'd5', toCompId: 'r_pump_led', toPinId: 'p1', waypoints: [{ x: 1200, y: 340 }, { x: 1600, y: 340 }, { x: 1600, y: 360 }], color: '#38bdf8' },
      { id: 'w_rpump_led_led', fromCompId: 'r_pump_led', fromPinId: 'p2', toCompId: 'led_pump', toPinId: 'anode', waypoints: [{ x: 1680, y: 360 }], color: '#38bdf8' },
      { id: 'w_led_pump_gnd', fromCompId: 'led_pump', fromPinId: 'cathode', toCompId: 'gnd_act', toPinId: 'gnd', waypoints: [{ x: 1760, y: 360 }, { x: 1760, y: 820 }, { x: 1540, y: 820 }], color: '#1e293b' },

      // Fan & Servo
      { id: 'w_mcu_d3_fan', fromCompId: 'mcu1', fromPinId: 'd3', toCompId: 'fan1', toPinId: 'pos', waypoints: [{ x: 1220, y: 420 }, { x: 1540, y: 420 }, { x: 1540, y: 540 }], color: '#22c55e' },
      { id: 'w_fan_gnd', fromCompId: 'fan1', fromPinId: 'neg', toCompId: 'gnd_act', toPinId: 'gnd', waypoints: [{ x: 1540, y: 580 }, { x: 1540, y: 820 }], color: '#1e293b' },
      { id: 'w_mcu_d9_servo', fromCompId: 'mcu1', fromPinId: 'd9', toCompId: 'servo1', toPinId: 'sig', waypoints: [{ x: 1200, y: 460 }, { x: 1660, y: 460 }, { x: 1660, y: 560 }], color: '#f97316' },
      { id: 'w_vcc_servo', fromCompId: 'mcu1', fromPinId: '5v', toCompId: 'servo1', toPinId: 'vcc', waypoints: [{ x: 1040, y: 360 }, { x: 1040, y: 500 }, { x: 1680, y: 500 }, { x: 1680, y: 560 }], color: '#ef4444' },
      { id: 'w_servo_gnd', fromCompId: 'servo1', fromPinId: 'gnd', toCompId: 'gnd_act', toPinId: 'gnd', waypoints: [{ x: 1700, y: 560 }, { x: 1700, y: 820 }, { x: 1540, y: 820 }], color: '#1e293b' },

      // Relay & Filament Bulb
      { id: 'w_mcu_d4_relay_in', fromCompId: 'mcu1', fromPinId: 'd4', toCompId: 'relay1', toPinId: 'in', waypoints: [{ x: 1220, y: 440 }, { x: 1480, y: 440 }, { x: 1480, y: 740 }, { x: 1540, y: 740 }], color: '#a855f7' },
      { id: 'w_vcc_relay', fromCompId: 'mcu1', fromPinId: '5v', toCompId: 'relay1', toPinId: 'vcc', waypoints: [{ x: 1040, y: 360 }, { x: 1040, y: 700 }, { x: 1540, y: 700 }], color: '#ef4444' },
      { id: 'w_relay_gnd', fromCompId: 'relay1', fromPinId: 'gnd', toCompId: 'gnd_act', toPinId: 'gnd', waypoints: [{ x: 1540, y: 720 }, { x: 1540, y: 820 }], color: '#1e293b' },
      { id: 'w_v_bulb_relay_com', fromCompId: 'v_bulb', fromPinId: 'pos', toCompId: 'relay1', toPinId: 'com', waypoints: [{ x: 1920, y: 700 }, { x: 1920, y: 760 }, { x: 1660, y: 760 }, { x: 1660, y: 720 }], color: '#ef4444' },
      { id: 'w_relay_no_bulb', fromCompId: 'relay1', fromPinId: 'no', toCompId: 'bulb1', toPinId: 'p1', waypoints: [{ x: 1660, y: 700 }, { x: 1700, y: 700 }, { x: 1700, y: 720 }], color: '#eab308' },
      { id: 'w_bulb_v_bulb_neg', fromCompId: 'bulb1', fromPinId: 'p2', toCompId: 'v_bulb', toPinId: 'neg', waypoints: [{ x: 1740, y: 720 }, { x: 1840, y: 720 }, { x: 1840, y: 700 }], color: '#1e293b' },
    ],
  },
},

  // -------------------------------------------------------------------------
  // Template 12: Professional 3 - 4-Junction Smart Vehicle-Actuated Traffic Controller (SECS-808 Assembly CPU + Logic Gates)
  // -------------------------------------------------------------------------
  {
    id: 'prof_4way_traffic_junction',
    title: 'Professional 3: 4-Junction Smart Vehicle-Actuated Traffic Controller (SECS-808 Assembly CPU + Logic Gates)',
    category: 'Professional',
    tier: 'Professional',
    badge: 'Professional',
    description: "Enterprise computer architecture showcase. STRICT CONSTRAINT: ZERO Arduino & ZERO ESP32! Operates purely on the SECS-808 8-bit programmable assembly microprocessor, CD4511 BCD decoders, and digital logic gates. True compass crossroads layout (North, East, South, West) with 2x side-by-side 7-segment displays per junction showing real-world wait-time countdowns (G 10s / R 10s / R 20s / R 30s), single active green turn order, and PIR vehicle motion preemption.",
    componentCount: 53,
    circuit: {
      version: '1.0.0',
      timestamp: '2026-11-06T18:03:14.754Z',
      name: '4-Junction Smart Vehicle-Actuated Traffic Controller (Compass Crossroads)',
      viewport: {"zoom":0.65,"panX":40,"panY":40},
      components: [
        {
          id: 'cpu1',
          type: 'builtin_cpu_8bit',
          label: 'CPU1 (SECS-808)',
          x: 900,
          y: 700,
          rotation: 0,
          mirrored: false,
          properties: {
            clockHz: 10,
            code: `; SECS-808 Smart 4-Way Crossroads Traffic Controller
; OUT0..OUT3: 4-bit BCD Ones countdown bus (0, 9, 8, 7, 6, 5, 4, 3, 2, 1)
; OUT4: ACT_N (North Active)
; OUT5: ACT_E (East Active)
; OUT6: ACT_S (South Active)
; OUT7: ACT_W (West Active)
; CARRY: Hardware Yellow signal (active when countdown is 2s or 1s)
; IN0..IN3: Vehicle Detectors [PIR_W, PIR_S, PIR_E, PIR_N]

INIT:
  LDA 0
  OUT A
  JMP NORTH_PHASE

; =========================================================================
; NORTH PHASE (10 seconds total)
; North = G 10s, East = R 10s (next), South = R 20s (3rd), West = R 30s (4th)
; =========================================================================
NORTH_PHASE:
  LDA 0x10       ; OUT4=1 (ACT_N), Ones=0 (10s)
  OUT A
  CMP 0          ; Carry = 0 (GREEN)
  WAIT 1000
  IN A           ; Check PIR
  AND 0x01
  JZ CHECK_NORTH_PREEMPT
  JMP NORTH_COUNT_9

CHECK_NORTH_PREEMPT:
  IN A
  AND 0x02       ; East car waiting?
  JNZ EAST_PHASE
  IN A
  AND 0x04       ; South car waiting?
  JNZ SOUTH_PHASE
  IN A
  AND 0x08       ; West car waiting?
  JNZ WEST_PHASE

NORTH_COUNT_9:
  LDA 0x19       ; 9s GREEN
  OUT A
  CMP 0x13       ; Carry = 0
  WAIT 1000

  LDA 0x18       ; 8s GREEN
  OUT A
  CMP 0x13
  WAIT 1000

  LDA 0x17       ; 7s GREEN
  OUT A
  CMP 0x13
  WAIT 1000

  LDA 0x16       ; 6s GREEN
  OUT A
  CMP 0x13
  WAIT 1000

  LDA 0x15       ; 5s GREEN
  OUT A
  CMP 0x13
  WAIT 1000

  LDA 0x14       ; 4s GREEN
  OUT A
  CMP 0x13
  WAIT 1000

  LDA 0x13       ; 3s GREEN
  OUT A
  CMP 0x13
  WAIT 1000

  ; Yellow changeover at 2s & 1s
  LDA 0x12       ; 2s YELLOW (0x12 < 0x13 sets carry = 1)
  OUT A
  CMP 0x13
  WAIT 1000

  LDA 0x11       ; 1s YELLOW (0x11 < 0x13 sets carry = 1)
  OUT A
  CMP 0x13
  WAIT 1000

; =========================================================================
; EAST PHASE (10 seconds total)
; North = R 30s (4th), East = G 10s, South = R 10s (next), West = R 20s (3rd)
; =========================================================================
EAST_PHASE:
  LDA 0x20       ; OUT5=1 (ACT_E), Ones=0 (10s)
  OUT A
  CMP 0          ; Carry = 0 (GREEN)
  WAIT 1000
  IN A
  AND 0x02
  JZ CHECK_EAST_PREEMPT
  JMP EAST_COUNT_9

CHECK_EAST_PREEMPT:
  IN A
  AND 0x04       ; South car waiting?
  JNZ SOUTH_PHASE
  IN A
  AND 0x08       ; West car waiting?
  JNZ WEST_PHASE
  IN A
  AND 0x01       ; North car waiting?
  JNZ NORTH_PHASE

EAST_COUNT_9:
  LDA 0x29       ; 9s GREEN
  OUT A
  CMP 0x23       ; Carry = 0
  WAIT 1000

  LDA 0x28       ; 8s GREEN
  OUT A
  CMP 0x23
  WAIT 1000

  LDA 0x27       ; 7s GREEN
  OUT A
  CMP 0x23
  WAIT 1000

  LDA 0x26       ; 6s GREEN
  OUT A
  CMP 0x23
  WAIT 1000

  LDA 0x25       ; 5s GREEN
  OUT A
  CMP 0x23
  WAIT 1000

  LDA 0x24       ; 4s GREEN
  OUT A
  CMP 0x23
  WAIT 1000

  LDA 0x23       ; 3s GREEN
  OUT A
  CMP 0x23
  WAIT 1000

  LDA 0x22       ; 2s YELLOW (0x22 < 0x23 sets carry = 1)
  OUT A
  CMP 0x23
  WAIT 1000

  LDA 0x21       ; 1s YELLOW (0x21 < 0x23 sets carry = 1)
  OUT A
  CMP 0x23
  WAIT 1000

; =========================================================================
; SOUTH PHASE (10 seconds total)
; North = R 20s (3rd), East = R 30s (4th), South = G 10s, West = R 10s (next)
; =========================================================================
SOUTH_PHASE:
  LDA 0x40       ; OUT6=1 (ACT_S), Ones=0 (10s)
  OUT A
  CMP 0          ; Carry = 0 (GREEN)
  WAIT 1000
  IN A
  AND 0x04
  JZ CHECK_SOUTH_PREEMPT
  JMP SOUTH_COUNT_9

CHECK_SOUTH_PREEMPT:
  IN A
  AND 0x08       ; West car waiting?
  JNZ WEST_PHASE
  IN A
  AND 0x01       ; North car waiting?
  JNZ NORTH_PHASE
  IN A
  AND 0x02       ; East car waiting?
  JNZ EAST_PHASE

SOUTH_COUNT_9:
  LDA 0x49       ; 9s GREEN
  OUT A
  CMP 0x43       ; Carry = 0
  WAIT 1000

  LDA 0x48       ; 8s GREEN
  OUT A
  CMP 0x43
  WAIT 1000

  LDA 0x47       ; 7s GREEN
  OUT A
  CMP 0x43
  WAIT 1000

  LDA 0x46       ; 6s GREEN
  OUT A
  CMP 0x43
  WAIT 1000

  LDA 0x45       ; 5s GREEN
  OUT A
  CMP 0x43
  WAIT 1000

  LDA 0x44       ; 4s GREEN
  OUT A
  CMP 0x43
  WAIT 1000

  LDA 0x43       ; 3s GREEN
  OUT A
  CMP 0x43
  WAIT 1000

  LDA 0x42       ; 2s YELLOW (0x42 < 0x43 sets carry = 1)
  OUT A
  CMP 0x43
  WAIT 1000

  LDA 0x41       ; 1s YELLOW (0x41 < 0x43 sets carry = 1)
  OUT A
  CMP 0x43
  WAIT 1000

; =========================================================================
; WEST PHASE (10 seconds total)
; North = R 10s (next), East = R 20s (3rd), South = R 30s (4th), West = G 10s
; =========================================================================
WEST_PHASE:
  LDA 0x80       ; OUT7=1 (ACT_W), Ones=0 (10s)
  OUT A
  CMP 0          ; Carry = 0 (GREEN)
  WAIT 1000
  IN A
  AND 0x08
  JZ CHECK_WEST_PREEMPT
  JMP WEST_COUNT_9

CHECK_WEST_PREEMPT:
  IN A
  AND 0x01       ; North car waiting?
  JNZ NORTH_PHASE
  IN A
  AND 0x02       ; East car waiting?
  JNZ EAST_PHASE
  IN A
  AND 0x04       ; South car waiting?
  JNZ SOUTH_PHASE

WEST_COUNT_9:
  LDA 0x89       ; 9s GREEN
  OUT A
  CMP 0x83       ; Carry = 0
  WAIT 1000

  LDA 0x88       ; 8s GREEN
  OUT A
  CMP 0x83
  WAIT 1000

  LDA 0x87       ; 7s GREEN
  OUT A
  CMP 0x83
  WAIT 1000

  LDA 0x86       ; 6s GREEN
  OUT A
  CMP 0x83
  WAIT 1000

  LDA 0x85       ; 5s GREEN
  OUT A
  CMP 0x83
  WAIT 1000

  LDA 0x84       ; 4s GREEN
  OUT A
  CMP 0x83
  WAIT 1000

  LDA 0x83       ; 3s GREEN
  OUT A
  CMP 0x83
  WAIT 1000

  LDA 0x82       ; 2s YELLOW (0x82 < 0x83 sets carry = 1)
  OUT A
  CMP 0x83
  WAIT 1000

  LDA 0x81       ; 1s YELLOW (0x81 < 0x83 sets carry = 1)
  OUT A
  CMP 0x83
  WAIT 1000

  JMP NORTH_PHASE
`,
          },
        },
        {
          "id": "vcc1",
          "type": "vcc",
          "label": "VCC (+5V)",
          "x": 740,
          "y": 640,
          "rotation": 0,
          "mirrored": false,
          "properties": {
            "voltage": 5
          }
        },
        {
          "id": "gnd1",
          "type": "gnd",
          "label": "GND",
          "x": 740,
          "y": 760,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_not_yellow",
          "type": "gate-not",
          "label": "NOT_YEL",
          "x": 1040,
          "y": 740,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_not_n",
          "type": "gate-not",
          "label": "NOT_N_ACT",
          "x": 800,
          "y": 460,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_not_e",
          "type": "gate-not",
          "label": "NOT_E_ACT",
          "x": 1160,
          "y": 660,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_not_s",
          "type": "gate-not",
          "label": "NOT_S_ACT",
          "x": 1000,
          "y": 940,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_not_w",
          "type": "gate-not",
          "label": "NOT_W_ACT",
          "x": 640,
          "y": 740,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_and_n_g",
          "type": "gate-and",
          "label": "AND_N_GRN",
          "x": 800,
          "y": 380,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_and_e_g",
          "type": "gate-and",
          "label": "AND_E_GRN",
          "x": 1300,
          "y": 640,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_and_s_g",
          "type": "gate-and",
          "label": "AND_S_GRN",
          "x": 800,
          "y": 1020,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_and_w_g",
          "type": "gate-and",
          "label": "AND_W_GRN",
          "x": 500,
          "y": 640,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_and_n_y",
          "type": "gate-and",
          "label": "AND_N_YEL",
          "x": 980,
          "y": 380,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_and_e_y",
          "type": "gate-and",
          "label": "AND_E_YEL",
          "x": 1300,
          "y": 720,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_and_s_y",
          "type": "gate-and",
          "label": "AND_S_YEL",
          "x": 980,
          "y": 1020,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_and_w_y",
          "type": "gate-and",
          "label": "AND_W_YEL",
          "x": 500,
          "y": 720,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_or_n_d0",
          "type": "gate-or",
          "label": "OR_N_D0",
          "x": 800,
          "y": 280,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_or_n_d1",
          "type": "gate-or",
          "label": "OR_N_D1",
          "x": 980,
          "y": 280,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_or_e_d0",
          "type": "gate-or",
          "label": "OR_E_D0",
          "x": 1440,
          "y": 640,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_or_e_d1",
          "type": "gate-or",
          "label": "OR_E_D1",
          "x": 1440,
          "y": 720,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_or_s_d0",
          "type": "gate-or",
          "label": "OR_S_D0",
          "x": 800,
          "y": 1100,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_or_s_d1",
          "type": "gate-or",
          "label": "OR_S_D1",
          "x": 980,
          "y": 1100,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_or_w_d0",
          "type": "gate-or",
          "label": "OR_W_D0",
          "x": 360,
          "y": 640,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "gate_or_w_d1",
          "type": "gate-or",
          "label": "OR_W_D1",
          "x": 360,
          "y": 720,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "tl_n",
          "type": "builtin_traffic_light",
          "label": "TL_N (North)",
          "x": 700,
          "y": 180,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "pir_n",
          "type": "builtin_motion_sensor",
          "label": "PIR_N (North Sensor)",
          "x": 560,
          "y": 180,
          "rotation": 0,
          "mirrored": false,
          "properties": {
            "detected": false
          }
        },
        {
          "id": "dec_n_tens",
          "type": "builtin_bcd_decoder",
          "label": "DEC_N_TENS",
          "x": 840,
          "y": 220,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "seg_n_tens",
          "type": "display-7seg",
          "label": "SEG_N_TENS",
          "x": 840,
          "y": 100,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "dec_n_ones",
          "type": "builtin_bcd_decoder",
          "label": "DEC_N_ONES",
          "x": 1000,
          "y": 220,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "seg_n_ones",
          "type": "display-7seg",
          "label": "SEG_N_ONES",
          "x": 1000,
          "y": 100,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "note_n",
          "type": "textbox",
          "label": "NOTE_N",
          "x": 740,
          "y": 20,
          "rotation": 0,
          "mirrored": false,
          "properties": {
            "text": "NORTH JUNCTION (1st Turn)\n• 10s Green -> 2s Yellow -> 30s Red.\n• Side-by-side 2-digit real-world countdown.",
            "fontSize": "xs",
            "fontWeight": "normal",
            "bgStyle": "sticky-green",
            "borderStyle": "solid",
            "boxWidth": 260,
            "boxHeight": 60
          }
        },
        {
          "id": "tl_e",
          "type": "builtin_traffic_light",
          "label": "TL_E (East)",
          "x": 1620,
          "y": 560,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "pir_e",
          "type": "builtin_motion_sensor",
          "label": "PIR_E (East Sensor)",
          "x": 1620,
          "y": 440,
          "rotation": 0,
          "mirrored": false,
          "properties": {
            "detected": false
          }
        },
        {
          "id": "dec_e_tens",
          "type": "builtin_bcd_decoder",
          "label": "DEC_E_TENS",
          "x": 1560,
          "y": 780,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "seg_e_tens",
          "type": "display-7seg",
          "label": "SEG_E_TENS",
          "x": 1560,
          "y": 660,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "dec_e_ones",
          "type": "builtin_bcd_decoder",
          "label": "DEC_E_ONES",
          "x": 1700,
          "y": 780,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "seg_e_ones",
          "type": "display-7seg",
          "label": "SEG_E_ONES",
          "x": 1700,
          "y": 660,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "note_e",
          "type": "textbox",
          "label": "NOTE_E",
          "x": 1540,
          "y": 320,
          "rotation": 0,
          "mirrored": false,
          "properties": {
            "text": "EAST JUNCTION (2nd Turn)\n• Starts at 10s Red (next up in line).\n• Synchronized real-world countdown to 10s Green.",
            "fontSize": "xs",
            "fontWeight": "normal",
            "bgStyle": "sticky-yellow",
            "borderStyle": "solid",
            "boxWidth": 260,
            "boxHeight": 60
          }
        },
        {
          "id": "tl_s",
          "type": "builtin_traffic_light",
          "label": "TL_S (South)",
          "x": 700,
          "y": 1220,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "pir_s",
          "type": "builtin_motion_sensor",
          "label": "PIR_S (South Sensor)",
          "x": 560,
          "y": 1220,
          "rotation": 0,
          "mirrored": false,
          "properties": {
            "detected": false
          }
        },
        {
          "id": "dec_s_tens",
          "type": "builtin_bcd_decoder",
          "label": "DEC_S_TENS",
          "x": 840,
          "y": 1260,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "seg_s_tens",
          "type": "display-7seg",
          "label": "SEG_S_TENS",
          "x": 840,
          "y": 1140,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "dec_s_ones",
          "type": "builtin_bcd_decoder",
          "label": "DEC_S_ONES",
          "x": 1000,
          "y": 1260,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "seg_s_ones",
          "type": "display-7seg",
          "label": "SEG_S_ONES",
          "x": 1000,
          "y": 1140,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "note_s",
          "type": "textbox",
          "label": "NOTE_S",
          "x": 740,
          "y": 1360,
          "rotation": 0,
          "mirrored": false,
          "properties": {
            "text": "SOUTH JUNCTION (3rd Turn)\n• Starts at 20s Red (3rd in line).\n• Synchronized real-world countdown to 10s Green.",
            "fontSize": "xs",
            "fontWeight": "normal",
            "bgStyle": "sticky-blue",
            "borderStyle": "solid",
            "boxWidth": 260,
            "boxHeight": 60
          }
        },
        {
          "id": "tl_w",
          "type": "builtin_traffic_light",
          "label": "TL_W (West)",
          "x": 260,
          "y": 560,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "pir_w",
          "type": "builtin_motion_sensor",
          "label": "PIR_W (West Sensor)",
          "x": 260,
          "y": 440,
          "rotation": 0,
          "mirrored": false,
          "properties": {
            "detected": false
          }
        },
        {
          "id": "dec_w_tens",
          "type": "builtin_bcd_decoder",
          "label": "DEC_W_TENS",
          "x": 180,
          "y": 780,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "seg_w_tens",
          "type": "display-7seg",
          "label": "SEG_W_TENS",
          "x": 180,
          "y": 660,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "dec_w_ones",
          "type": "builtin_bcd_decoder",
          "label": "DEC_W_ONES",
          "x": 320,
          "y": 780,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "seg_w_ones",
          "type": "display-7seg",
          "label": "SEG_W_ONES",
          "x": 320,
          "y": 660,
          "rotation": 0,
          "mirrored": false,
          "properties": {}
        },
        {
          "id": "note_w",
          "type": "textbox",
          "label": "NOTE_W",
          "x": 160,
          "y": 320,
          "rotation": 0,
          "mirrored": false,
          "properties": {
            "text": "WEST JUNCTION (4th Turn)\n• Starts at 30s Red (4th in line).\n• Synchronized real-world countdown to 10s Green.",
            "fontSize": "xs",
            "fontWeight": "normal",
            "bgStyle": "sticky-purple",
            "borderStyle": "solid",
            "boxWidth": 260,
            "boxHeight": 60
          }
        },
        {
          "id": "note_main",
          "type": "textbox",
          "label": "NOTE_MAIN",
          "x": 1040,
          "y": 540,
          "rotation": 0,
          "mirrored": false,
          "properties": {
            "text": "SECS-808 8-BIT CPU COMPASS CROSSROADS CONTROLLER\n\n• STRICT ARCHITECTURAL CONSTRAINT: ZERO Arduino, ZERO ESP32, ZERO Pico!\n• Central SECS-808 Assembly Microprocessor executes bare-metal state machine at 10Hz.\n• Universal 4-bit bus (OUT0..OUT3) drives Ones digits for North, East, South, West in total sync.\n• Real-world wait-time countdown calculation: Active G 10s, Next R 10s, 3rd R 20s, 4th R 30s.\n• Discrete digital logic decodes Tens digits and controls Green/Yellow/Red interlocks.\n• PIR Sensors trigger immediate preemption when cars wait on red!",
            "fontSize": "sm",
            "fontWeight": "normal",
            "bgStyle": "sticky-purple",
            "borderStyle": "solid",
            "boxWidth": 440,
            "boxHeight": 180
          }
        },
      ],
      wires: [
        {"id":"w_vcc_cpu","fromCompId":"vcc1","fromPinId":"vcc","toCompId":"cpu1","toPinId":"vcc","waypoints":[{"x":740,"y":620},{"x":840,"y":620}],"color":"#ef4444"},
        {"id":"w_gnd_cpu","fromCompId":"cpu1","fromPinId":"gnd","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":840,"y":640},{"x":740,"y":640}],"color":"#1e293b"},
        {"id":"w_pir_n_cpu_in0","fromCompId":"pir_n","fromPinId":"out","toCompId":"cpu1","toPinId":"in0","waypoints":[{"x":560,"y":220},{"x":560,"y":700},{"x":840,"y":700}],"color":"#38bdf8"},
        {"id":"w_pir_e_cpu_in1","fromCompId":"pir_e","fromPinId":"out","toCompId":"cpu1","toPinId":"in1","waypoints":[{"x":1620,"y":480},{"x":1400,"y":480},{"x":1400,"y":720},{"x":840,"y":720}],"color":"#a855f7"},
        {"id":"w_pir_s_cpu_in2","fromCompId":"pir_s","fromPinId":"out","toCompId":"cpu1","toPinId":"in2","waypoints":[{"x":560,"y":1260},{"x":560,"y":740},{"x":840,"y":740}],"color":"#22c55e"},
        {"id":"w_pir_w_cpu_in3","fromCompId":"pir_w","fromPinId":"out","toCompId":"cpu1","toPinId":"in3","waypoints":[{"x":260,"y":480},{"x":440,"y":480},{"x":440,"y":760},{"x":840,"y":760}],"color":"#eab308"},
        {"id":"w_vcc_pir_n","fromCompId":"vcc1","fromPinId":"vcc","toCompId":"pir_n","toPinId":"vcc","waypoints":[{"x":740,"y":220},{"x":540,"y":220}],"color":"#ef4444"},
        {"id":"w_gnd_pir_n","fromCompId":"pir_n","fromPinId":"gnd","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":580,"y":220},{"x":580,"y":760}],"color":"#1e293b"},
        {"id":"w_vcc_pir_e","fromCompId":"vcc1","fromPinId":"vcc","toCompId":"pir_e","toPinId":"vcc","waypoints":[{"x":1600,"y":640},{"x":1600,"y":480}],"color":"#ef4444"},
        {"id":"w_gnd_pir_e","fromCompId":"pir_e","fromPinId":"gnd","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":1640,"y":480},{"x":1640,"y":760},{"x":740,"y":760}],"color":"#1e293b"},
        {"id":"w_vcc_pir_s","fromCompId":"vcc1","fromPinId":"vcc","toCompId":"pir_s","toPinId":"vcc","waypoints":[{"x":740,"y":1260},{"x":540,"y":1260}],"color":"#ef4444"},
        {"id":"w_gnd_pir_s","fromCompId":"pir_s","fromPinId":"gnd","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":580,"y":1260},{"x":580,"y":760}],"color":"#1e293b"},
        {"id":"w_vcc_pir_w","fromCompId":"vcc1","fromPinId":"vcc","toCompId":"pir_w","toPinId":"vcc","waypoints":[{"x":740,"y":640},{"x":240,"y":640},{"x":240,"y":480}],"color":"#ef4444"},
        {"id":"w_gnd_pir_w","fromCompId":"pir_w","fromPinId":"gnd","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":280,"y":480},{"x":280,"y":760},{"x":740,"y":760}],"color":"#1e293b"},
        {"id":"w_cpu_carry_not_y","fromCompId":"cpu1","fromPinId":"carry","toCompId":"gate_not_yellow","toPinId":"in","waypoints":[{"x":960,"y":800},{"x":1000,"y":800},{"x":1000,"y":780},{"x":1040,"y":780}],"color":"#eab308"},
        {"id":"w_cpu_out4_not_n","fromCompId":"cpu1","fromPinId":"out4","toCompId":"gate_not_n","toPinId":"in","waypoints":[{"x":960,"y":700},{"x":960,"y":500},{"x":800,"y":500}],"color":"#22c55e"},
        {"id":"w_not_n_tl_r","fromCompId":"gate_not_n","fromPinId":"out","toCompId":"tl_n","toPinId":"r","waypoints":[{"x":880,"y":500},{"x":880,"y":140},{"x":660,"y":140}],"color":"#ef4444"},
        {"id":"w_cpu_out5_not_e","fromCompId":"cpu1","fromPinId":"out5","toCompId":"gate_not_e","toPinId":"in","waypoints":[{"x":960,"y":720},{"x":1120,"y":720},{"x":1120,"y":700},{"x":1160,"y":700}],"color":"#22c55e"},
        {"id":"w_not_e_tl_r","fromCompId":"gate_not_e","fromPinId":"out","toCompId":"tl_e","toPinId":"r","waypoints":[{"x":1240,"y":700},{"x":1580,"y":700},{"x":1580,"y":520}],"color":"#ef4444"},
        {"id":"w_cpu_out6_not_s","fromCompId":"cpu1","fromPinId":"out6","toCompId":"gate_not_s","toPinId":"in","waypoints":[{"x":960,"y":740},{"x":960,"y":980},{"x":1000,"y":980}],"color":"#22c55e"},
        {"id":"w_not_s_tl_r","fromCompId":"gate_not_s","fromPinId":"out","toCompId":"tl_s","toPinId":"r","waypoints":[{"x":1080,"y":980},{"x":1080,"y":1180},{"x":660,"y":1180}],"color":"#ef4444"},
        {"id":"w_cpu_out7_not_w","fromCompId":"cpu1","fromPinId":"out7","toCompId":"gate_not_w","toPinId":"in","waypoints":[{"x":960,"y":760},{"x":740,"y":760},{"x":740,"y":780},{"x":640,"y":780}],"color":"#22c55e"},
        {"id":"w_not_w_tl_r","fromCompId":"gate_not_w","fromPinId":"out","toCompId":"tl_w","toPinId":"r","waypoints":[{"x":720,"y":780},{"x":720,"y":520},{"x":220,"y":520}],"color":"#ef4444"},
        {"id":"w_act_n_and_g","fromCompId":"cpu1","fromPinId":"out4","toCompId":"gate_and_n_g","toPinId":"in_a","waypoints":[{"x":960,"y":700},{"x":760,"y":700},{"x":760,"y":400},{"x":800,"y":400}],"color":"#22c55e"},
        {"id":"w_green_en_and_n_g","fromCompId":"gate_not_yellow","fromPinId":"out","toCompId":"gate_and_n_g","toPinId":"in_b","waypoints":[{"x":1120,"y":780},{"x":1120,"y":440},{"x":800,"y":440}],"color":"#22c55e"},
        {"id":"w_and_n_g_tl_g","fromCompId":"gate_and_n_g","fromPinId":"out","toCompId":"tl_n","toPinId":"g","waypoints":[{"x":880,"y":420},{"x":880,"y":200},{"x":660,"y":200}],"color":"#22c55e"},
        {"id":"w_act_n_and_y","fromCompId":"cpu1","fromPinId":"out4","toCompId":"gate_and_n_y","toPinId":"in_a","waypoints":[{"x":960,"y":700},{"x":940,"y":700},{"x":940,"y":400},{"x":980,"y":400}],"color":"#eab308"},
        {"id":"w_carry_and_n_y","fromCompId":"cpu1","fromPinId":"carry","toCompId":"gate_and_n_y","toPinId":"in_b","waypoints":[{"x":960,"y":800},{"x":1020,"y":800},{"x":1020,"y":440},{"x":980,"y":440}],"color":"#eab308"},
        {"id":"w_and_n_y_tl_y","fromCompId":"gate_and_n_y","fromPinId":"out","toCompId":"tl_n","toPinId":"y","waypoints":[{"x":1060,"y":420},{"x":1060,"y":160},{"x":660,"y":160}],"color":"#eab308"},
        {"id":"w_act_e_and_g","fromCompId":"cpu1","fromPinId":"out5","toCompId":"gate_and_e_g","toPinId":"in_a","waypoints":[{"x":960,"y":720},{"x":1260,"y":720},{"x":1260,"y":660},{"x":1300,"y":660}],"color":"#22c55e"},
        {"id":"w_green_en_and_e_g","fromCompId":"gate_not_yellow","fromPinId":"out","toCompId":"gate_and_e_g","toPinId":"in_b","waypoints":[{"x":1120,"y":780},{"x":1280,"y":780},{"x":1280,"y":700},{"x":1300,"y":700}],"color":"#22c55e"},
        {"id":"w_and_e_g_tl_g","fromCompId":"gate_and_e_g","fromPinId":"out","toCompId":"tl_e","toPinId":"g","waypoints":[{"x":1380,"y":680},{"x":1580,"y":680},{"x":1580,"y":580}],"color":"#22c55e"},
        {"id":"w_act_e_and_y","fromCompId":"cpu1","fromPinId":"out5","toCompId":"gate_and_e_y","toPinId":"in_a","waypoints":[{"x":960,"y":720},{"x":1260,"y":720},{"x":1260,"y":740},{"x":1300,"y":740}],"color":"#eab308"},
        {"id":"w_carry_and_e_y","fromCompId":"cpu1","fromPinId":"carry","toCompId":"gate_and_e_y","toPinId":"in_b","waypoints":[{"x":960,"y":800},{"x":1280,"y":800},{"x":1280,"y":780},{"x":1300,"y":780}],"color":"#eab308"},
        {"id":"w_and_e_y_tl_y","fromCompId":"gate_and_e_y","fromPinId":"out","toCompId":"tl_e","toPinId":"y","waypoints":[{"x":1380,"y":760},{"x":1560,"y":760},{"x":1560,"y":540}],"color":"#eab308"},
        {"id":"w_act_s_and_g","fromCompId":"cpu1","fromPinId":"out6","toCompId":"gate_and_s_g","toPinId":"in_a","waypoints":[{"x":960,"y":740},{"x":760,"y":740},{"x":760,"y":1040},{"x":800,"y":1040}],"color":"#22c55e"},
        {"id":"w_green_en_and_s_g","fromCompId":"gate_not_yellow","fromPinId":"out","toCompId":"gate_and_s_g","toPinId":"in_b","waypoints":[{"x":1120,"y":780},{"x":1120,"y":1080},{"x":800,"y":1080}],"color":"#22c55e"},
        {"id":"w_and_s_g_tl_g","fromCompId":"gate_and_s_g","fromPinId":"out","toCompId":"tl_s","toPinId":"g","waypoints":[{"x":880,"y":1060},{"x":880,"y":1240},{"x":660,"y":1240}],"color":"#22c55e"},
        {"id":"w_act_s_and_y","fromCompId":"cpu1","fromPinId":"out6","toCompId":"gate_and_s_y","toPinId":"in_a","waypoints":[{"x":960,"y":740},{"x":940,"y":740},{"x":940,"y":1040},{"x":980,"y":1040}],"color":"#eab308"},
        {"id":"w_carry_and_s_y","fromCompId":"cpu1","fromPinId":"carry","toCompId":"gate_and_s_y","toPinId":"in_b","waypoints":[{"x":960,"y":800},{"x":1020,"y":800},{"x":1020,"y":1080},{"x":980,"y":1080}],"color":"#eab308"},
        {"id":"w_and_s_y_tl_y","fromCompId":"gate_and_s_y","fromPinId":"out","toCompId":"tl_s","toPinId":"y","waypoints":[{"x":1060,"y":1060},{"x":1060,"y":1200},{"x":660,"y":1200}],"color":"#eab308"},
        {"id":"w_act_w_and_g","fromCompId":"cpu1","fromPinId":"out7","toCompId":"gate_and_w_g","toPinId":"in_a","waypoints":[{"x":960,"y":760},{"x":580,"y":760},{"x":580,"y":660},{"x":500,"y":660}],"color":"#22c55e"},
        {"id":"w_green_en_and_w_g","fromCompId":"gate_not_yellow","fromPinId":"out","toCompId":"gate_and_w_g","toPinId":"in_b","waypoints":[{"x":1120,"y":780},{"x":1120,"y":840},{"x":460,"y":840},{"x":460,"y":700},{"x":500,"y":700}],"color":"#22c55e"},
        {"id":"w_and_w_g_tl_g","fromCompId":"gate_and_w_g","fromPinId":"out","toCompId":"tl_w","toPinId":"g","waypoints":[{"x":580,"y":680},{"x":580,"y":580},{"x":220,"y":580}],"color":"#22c55e"},
        {"id":"w_act_w_and_y","fromCompId":"cpu1","fromPinId":"out7","toCompId":"gate_and_w_y","toPinId":"in_a","waypoints":[{"x":960,"y":760},{"x":580,"y":760},{"x":580,"y":740},{"x":500,"y":740}],"color":"#eab308"},
        {"id":"w_carry_and_w_y","fromCompId":"cpu1","fromPinId":"carry","toCompId":"gate_and_w_y","toPinId":"in_b","waypoints":[{"x":960,"y":800},{"x":960,"y":860},{"x":480,"y":860},{"x":480,"y":780},{"x":500,"y":780}],"color":"#eab308"},
        {"id":"w_and_w_y_tl_y","fromCompId":"gate_and_w_y","fromPinId":"out","toCompId":"tl_w","toPinId":"y","waypoints":[{"x":580,"y":760},{"x":580,"y":540},{"x":220,"y":540}],"color":"#eab308"},
        {"id":"w_tl_n_gnd","fromCompId":"tl_n","fromPinId":"gnd","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":660,"y":220},{"x":660,"y":760},{"x":740,"y":760}],"color":"#1e293b"},
        {"id":"w_tl_e_gnd","fromCompId":"tl_e","fromPinId":"gnd","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":1580,"y":600},{"x":1580,"y":760},{"x":740,"y":760}],"color":"#1e293b"},
        {"id":"w_tl_s_gnd","fromCompId":"tl_s","fromPinId":"gnd","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":660,"y":1260},{"x":660,"y":760},{"x":740,"y":760}],"color":"#1e293b"},
        {"id":"w_tl_w_gnd","fromCompId":"tl_w","fromPinId":"gnd","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":220,"y":600},{"x":220,"y":760},{"x":740,"y":760}],"color":"#1e293b"},
        {"id":"w_bus_out0_ones_n","fromCompId":"cpu1","fromPinId":"out0","toCompId":"dec_n_ones","toPinId":"d0","waypoints":[{"x":960,"y":620},{"x":1020,"y":620},{"x":1020,"y":300},{"x":940,"y":300},{"x":940,"y":160}],"color":"#38bdf8"},
        {"id":"w_bus_out0_ones_e","fromCompId":"cpu1","fromPinId":"out0","toCompId":"dec_e_ones","toPinId":"d0","waypoints":[{"x":960,"y":620},{"x":1640,"y":620},{"x":1640,"y":720}],"color":"#38bdf8"},
        {"id":"w_bus_out0_ones_s","fromCompId":"cpu1","fromPinId":"out0","toCompId":"dec_s_ones","toPinId":"d0","waypoints":[{"x":960,"y":620},{"x":1020,"y":620},{"x":1020,"y":1200},{"x":940,"y":1200}],"color":"#38bdf8"},
        {"id":"w_bus_out0_ones_w","fromCompId":"cpu1","fromPinId":"out0","toCompId":"dec_w_ones","toPinId":"d0","waypoints":[{"x":960,"y":620},{"x":920,"y":620},{"x":920,"y":880},{"x":260,"y":880},{"x":260,"y":720}],"color":"#38bdf8"},
        {"id":"w_bus_out1_ones_n","fromCompId":"cpu1","fromPinId":"out1","toCompId":"dec_n_ones","toPinId":"d1","waypoints":[{"x":960,"y":640},{"x":1040,"y":640},{"x":1040,"y":320},{"x":940,"y":320},{"x":940,"y":200}],"color":"#a855f7"},
        {"id":"w_bus_out1_ones_e","fromCompId":"cpu1","fromPinId":"out1","toCompId":"dec_e_ones","toPinId":"d1","waypoints":[{"x":960,"y":640},{"x":1640,"y":640},{"x":1640,"y":760}],"color":"#a855f7"},
        {"id":"w_bus_out1_ones_s","fromCompId":"cpu1","fromPinId":"out1","toCompId":"dec_s_ones","toPinId":"d1","waypoints":[{"x":960,"y":640},{"x":1040,"y":640},{"x":1040,"y":1220},{"x":940,"y":1220}],"color":"#a855f7"},
        {"id":"w_bus_out1_ones_w","fromCompId":"cpu1","fromPinId":"out1","toCompId":"dec_w_ones","toPinId":"d1","waypoints":[{"x":960,"y":640},{"x":900,"y":640},{"x":900,"y":900},{"x":260,"y":900},{"x":260,"y":760}],"color":"#a855f7"},
        {"id":"w_bus_out2_ones_n","fromCompId":"cpu1","fromPinId":"out2","toCompId":"dec_n_ones","toPinId":"d2","waypoints":[{"x":960,"y":660},{"x":1060,"y":660},{"x":1060,"y":340},{"x":940,"y":340},{"x":940,"y":240}],"color":"#22c55e"},
        {"id":"w_bus_out2_ones_e","fromCompId":"cpu1","fromPinId":"out2","toCompId":"dec_e_ones","toPinId":"d2","waypoints":[{"x":960,"y":660},{"x":1640,"y":660},{"x":1640,"y":800}],"color":"#22c55e"},
        {"id":"w_bus_out2_ones_s","fromCompId":"cpu1","fromPinId":"out2","toCompId":"dec_s_ones","toPinId":"d2","waypoints":[{"x":960,"y":660},{"x":1060,"y":660},{"x":1060,"y":1240},{"x":940,"y":1240}],"color":"#22c55e"},
        {"id":"w_bus_out2_ones_w","fromCompId":"cpu1","fromPinId":"out2","toCompId":"dec_w_ones","toPinId":"d2","waypoints":[{"x":960,"y":660},{"x":880,"y":660},{"x":880,"y":920},{"x":260,"y":920},{"x":260,"y":800}],"color":"#22c55e"},
        {"id":"w_bus_out3_ones_n","fromCompId":"cpu1","fromPinId":"out3","toCompId":"dec_n_ones","toPinId":"d3","waypoints":[{"x":960,"y":680},{"x":1080,"y":680},{"x":1080,"y":360},{"x":940,"y":360},{"x":940,"y":280}],"color":"#eab308"},
        {"id":"w_bus_out3_ones_e","fromCompId":"cpu1","fromPinId":"out3","toCompId":"dec_e_ones","toPinId":"d3","waypoints":[{"x":960,"y":680},{"x":1640,"y":680},{"x":1640,"y":840}],"color":"#eab308"},
        {"id":"w_bus_out3_ones_s","fromCompId":"cpu1","fromPinId":"out3","toCompId":"dec_s_ones","toPinId":"d3","waypoints":[{"x":960,"y":680},{"x":1080,"y":680},{"x":1080,"y":1260},{"x":940,"y":1260}],"color":"#eab308"},
        {"id":"w_bus_out3_ones_w","fromCompId":"cpu1","fromPinId":"out3","toCompId":"dec_w_ones","toPinId":"d3","waypoints":[{"x":960,"y":680},{"x":860,"y":680},{"x":860,"y":940},{"x":260,"y":940},{"x":260,"y":840}],"color":"#eab308"},
        {"id":"w_act_s_or_n_d0_a","fromCompId":"cpu1","fromPinId":"out6","toCompId":"gate_or_n_d0","toPinId":"in_a","waypoints":[{"x":960,"y":740},{"x":740,"y":740},{"x":740,"y":300},{"x":800,"y":300}],"color":"#a855f7"},
        {"id":"w_act_s_or_n_d0_b","fromCompId":"cpu1","fromPinId":"out6","toCompId":"gate_or_n_d0","toPinId":"in_b","waypoints":[{"x":960,"y":740},{"x":780,"y":740},{"x":780,"y":340},{"x":800,"y":340}],"color":"#a855f7"},
        {"id":"w_or_n_d0_dec","fromCompId":"gate_or_n_d0","fromPinId":"out","toCompId":"dec_n_tens","toPinId":"d0","waypoints":[{"x":880,"y":320},{"x":880,"y":160},{"x":780,"y":160}],"color":"#a855f7"},
        {"id":"w_act_e_or_n_d1_a","fromCompId":"cpu1","fromPinId":"out5","toCompId":"gate_or_n_d1","toPinId":"in_a","waypoints":[{"x":960,"y":720},{"x":920,"y":720},{"x":920,"y":300},{"x":980,"y":300}],"color":"#22c55e"},
        {"id":"w_act_e_or_n_d1_b","fromCompId":"cpu1","fromPinId":"out5","toCompId":"gate_or_n_d1","toPinId":"in_b","waypoints":[{"x":960,"y":720},{"x":940,"y":720},{"x":940,"y":340},{"x":980,"y":340}],"color":"#22c55e"},
        {"id":"w_or_n_d1_dec","fromCompId":"gate_or_n_d1","fromPinId":"out","toCompId":"dec_n_tens","toPinId":"d1","waypoints":[{"x":1060,"y":320},{"x":1060,"y":200},{"x":780,"y":200}],"color":"#22c55e"},
        {"id":"w_act_w_or_e_d0_a","fromCompId":"cpu1","fromPinId":"out7","toCompId":"gate_or_e_d0","toPinId":"in_a","waypoints":[{"x":960,"y":760},{"x":1400,"y":760},{"x":1400,"y":660},{"x":1440,"y":660}],"color":"#a855f7"},
        {"id":"w_act_w_or_e_d0_b","fromCompId":"cpu1","fromPinId":"out7","toCompId":"gate_or_e_d0","toPinId":"in_b","waypoints":[{"x":960,"y":760},{"x":1420,"y":760},{"x":1420,"y":700},{"x":1440,"y":700}],"color":"#a855f7"},
        {"id":"w_or_e_d0_dec","fromCompId":"gate_or_e_d0","fromPinId":"out","toCompId":"dec_e_tens","toPinId":"d0","waypoints":[{"x":1520,"y":680},{"x":1500,"y":680},{"x":1500,"y":720}],"color":"#a855f7"},
        {"id":"w_act_s_or_e_d1_a","fromCompId":"cpu1","fromPinId":"out6","toCompId":"gate_or_e_d1","toPinId":"in_a","waypoints":[{"x":960,"y":740},{"x":1400,"y":740},{"x":1440,"y":740}],"color":"#22c55e"},
        {"id":"w_act_s_or_e_d1_b","fromCompId":"cpu1","fromPinId":"out6","toCompId":"gate_or_e_d1","toPinId":"in_b","waypoints":[{"x":960,"y":740},{"x":1420,"y":740},{"x":1420,"y":780},{"x":1440,"y":780}],"color":"#22c55e"},
        {"id":"w_or_e_d1_dec","fromCompId":"gate_or_e_d1","fromPinId":"out","toCompId":"dec_e_tens","toPinId":"d1","waypoints":[{"x":1520,"y":760},{"x":1500,"y":760}],"color":"#22c55e"},
        {"id":"w_act_n_or_s_d0_a","fromCompId":"cpu1","fromPinId":"out4","toCompId":"gate_or_s_d0","toPinId":"in_a","waypoints":[{"x":960,"y":700},{"x":780,"y":700},{"x":780,"y":1120},{"x":800,"y":1120}],"color":"#a855f7"},
        {"id":"w_act_n_or_s_d0_b","fromCompId":"cpu1","fromPinId":"out4","toCompId":"gate_or_s_d0","toPinId":"in_b","waypoints":[{"x":960,"y":700},{"x":740,"y":700},{"x":740,"y":1160},{"x":800,"y":1160}],"color":"#a855f7"},
        {"id":"w_or_s_d0_dec","fromCompId":"gate_or_s_d0","fromPinId":"out","toCompId":"dec_s_tens","toPinId":"d0","waypoints":[{"x":880,"y":1140},{"x":880,"y":1200},{"x":780,"y":1200}],"color":"#a855f7"},
        {"id":"w_act_w_or_s_d1_a","fromCompId":"cpu1","fromPinId":"out7","toCompId":"gate_or_s_d1","toPinId":"in_a","waypoints":[{"x":960,"y":760},{"x":940,"y":760},{"x":940,"y":1120},{"x":980,"y":1120}],"color":"#22c55e"},
        {"id":"w_act_w_or_s_d1_b","fromCompId":"cpu1","fromPinId":"out7","toCompId":"gate_or_s_d1","toPinId":"in_b","waypoints":[{"x":960,"y":760},{"x":920,"y":760},{"x":920,"y":1160},{"x":980,"y":1160}],"color":"#22c55e"},
        {"id":"w_or_s_d1_dec","fromCompId":"gate_or_s_d1","fromPinId":"out","toCompId":"dec_s_tens","toPinId":"d1","waypoints":[{"x":1060,"y":1140},{"x":1060,"y":1220},{"x":780,"y":1220}],"color":"#22c55e"},
        {"id":"w_act_e_or_w_d0_a","fromCompId":"cpu1","fromPinId":"out5","toCompId":"gate_or_w_d0","toPinId":"in_a","waypoints":[{"x":960,"y":720},{"x":440,"y":720},{"x":440,"y":660},{"x":360,"y":660}],"color":"#a855f7"},
        {"id":"w_act_e_or_w_d0_b","fromCompId":"cpu1","fromPinId":"out5","toCompId":"gate_or_w_d0","toPinId":"in_b","waypoints":[{"x":960,"y":720},{"x":420,"y":720},{"x":420,"y":700},{"x":360,"y":700}],"color":"#a855f7"},
        {"id":"w_or_w_d0_dec","fromCompId":"gate_or_w_d0","fromPinId":"out","toCompId":"dec_w_tens","toPinId":"d0","waypoints":[{"x":440,"y":680},{"x":120,"y":680},{"x":120,"y":720}],"color":"#a855f7"},
        {"id":"w_act_n_or_w_d1_a","fromCompId":"cpu1","fromPinId":"out4","toCompId":"gate_or_w_d1","toPinId":"in_a","waypoints":[{"x":960,"y":700},{"x":440,"y":700},{"x":440,"y":740},{"x":360,"y":740}],"color":"#22c55e"},
        {"id":"w_act_n_or_w_d1_b","fromCompId":"cpu1","fromPinId":"out4","toCompId":"gate_or_w_d1","toPinId":"in_b","waypoints":[{"x":960,"y":700},{"x":420,"y":700},{"x":420,"y":780},{"x":360,"y":780}],"color":"#22c55e"},
        {"id":"w_or_w_d1_dec","fromCompId":"gate_or_w_d1","fromPinId":"out","toCompId":"dec_w_tens","toPinId":"d1","waypoints":[{"x":440,"y":760},{"x":120,"y":760}],"color":"#22c55e"},
        {"id":"w_vcc_dec_n_t","fromCompId":"vcc1","fromPinId":"vcc","toCompId":"dec_n_tens","toPinId":"vcc","waypoints":[{"x":740,"y":140},{"x":840,"y":140}],"color":"#ef4444"},
        {"id":"w_gnd_dec_n_t","fromCompId":"dec_n_tens","fromPinId":"gnd","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":840,"y":300},{"x":740,"y":300},{"x":740,"y":760}],"color":"#1e293b"},
        {"id":"w_vcc_dec_n_o","fromCompId":"vcc1","fromPinId":"vcc","toCompId":"dec_n_ones","toPinId":"vcc","waypoints":[{"x":740,"y":140},{"x":1000,"y":140}],"color":"#ef4444"},
        {"id":"w_gnd_dec_n_o","fromCompId":"dec_n_ones","fromPinId":"gnd","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":1000,"y":300},{"x":740,"y":300}],"color":"#1e293b"},
        {"id":"w_vcc_dec_e_t","fromCompId":"vcc1","fromPinId":"vcc","toCompId":"dec_e_tens","toPinId":"vcc","waypoints":[{"x":1560,"y":640},{"x":1560,"y":700}],"color":"#ef4444"},
        {"id":"w_gnd_dec_e_t","fromCompId":"dec_e_tens","fromPinId":"gnd","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":1560,"y":860},{"x":1560,"y":760},{"x":740,"y":760}],"color":"#1e293b"},
        {"id":"w_vcc_dec_e_o","fromCompId":"vcc1","fromPinId":"vcc","toCompId":"dec_e_ones","toPinId":"vcc","waypoints":[{"x":1700,"y":640},{"x":1700,"y":700}],"color":"#ef4444"},
        {"id":"w_gnd_dec_e_o","fromCompId":"dec_e_ones","fromPinId":"gnd","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":1700,"y":860},{"x":1700,"y":760},{"x":740,"y":760}],"color":"#1e293b"},
        {"id":"w_vcc_dec_s_t","fromCompId":"vcc1","fromPinId":"vcc","toCompId":"dec_s_tens","toPinId":"vcc","waypoints":[{"x":740,"y":1180},{"x":840,"y":1180}],"color":"#ef4444"},
        {"id":"w_gnd_dec_s_t","fromCompId":"dec_s_tens","fromPinId":"gnd","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":840,"y":1340},{"x":740,"y":1340},{"x":740,"y":760}],"color":"#1e293b"},
        {"id":"w_vcc_dec_s_o","fromCompId":"vcc1","fromPinId":"vcc","toCompId":"dec_s_ones","toPinId":"vcc","waypoints":[{"x":740,"y":1180},{"x":1000,"y":1180}],"color":"#ef4444"},
        {"id":"w_gnd_dec_s_o","fromCompId":"dec_s_ones","fromPinId":"gnd","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":1000,"y":1340},{"x":740,"y":1340}],"color":"#1e293b"},
        {"id":"w_vcc_dec_w_t","fromCompId":"vcc1","fromPinId":"vcc","toCompId":"dec_w_tens","toPinId":"vcc","waypoints":[{"x":180,"y":640},{"x":180,"y":700}],"color":"#ef4444"},
        {"id":"w_gnd_dec_w_t","fromCompId":"dec_w_tens","fromPinId":"gnd","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":180,"y":860},{"x":180,"y":760},{"x":740,"y":760}],"color":"#1e293b"},
        {"id":"w_vcc_dec_w_o","fromCompId":"vcc1","fromPinId":"vcc","toCompId":"dec_w_ones","toPinId":"vcc","waypoints":[{"x":320,"y":640},{"x":320,"y":700}],"color":"#ef4444"},
        {"id":"w_gnd_dec_w_o","fromCompId":"dec_w_ones","fromPinId":"gnd","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":320,"y":860},{"x":320,"y":760},{"x":740,"y":760}],"color":"#1e293b"},
        {"id":"w_decn_t_qa","fromCompId":"dec_n_tens","fromPinId":"qa","toCompId":"seg_n_tens","toPinId":"pin_a","waypoints":[{"x":900,"y":160},{"x":860,"y":160},{"x":860,"y":100}],"color":"#eab308"},
        {"id":"w_decn_t_qb","fromCompId":"dec_n_tens","fromPinId":"qb","toCompId":"seg_n_tens","toPinId":"pin_b","waypoints":[{"x":900,"y":180},{"x":880,"y":180},{"x":880,"y":100}],"color":"#eab308"},
        {"id":"w_decn_t_qc","fromCompId":"dec_n_tens","fromPinId":"qc","toCompId":"seg_n_tens","toPinId":"pin_c","waypoints":[{"x":900,"y":200},{"x":900,"y":100}],"color":"#eab308"},
        {"id":"w_decn_t_qd","fromCompId":"dec_n_tens","fromPinId":"qd","toCompId":"seg_n_tens","toPinId":"pin_d","waypoints":[{"x":900,"y":220},{"x":900,"y":220}],"color":"#eab308"},
        {"id":"w_decn_t_qe","fromCompId":"dec_n_tens","fromPinId":"qe","toCompId":"seg_n_tens","toPinId":"pin_e","waypoints":[{"x":900,"y":240},{"x":880,"y":240},{"x":880,"y":220}],"color":"#eab308"},
        {"id":"w_decn_t_qf","fromCompId":"dec_n_tens","fromPinId":"qf","toCompId":"seg_n_tens","toPinId":"pin_f","waypoints":[{"x":900,"y":260},{"x":860,"y":260},{"x":860,"y":220}],"color":"#eab308"},
        {"id":"w_decn_t_qg","fromCompId":"dec_n_tens","fromPinId":"qg","toCompId":"seg_n_tens","toPinId":"pin_g","waypoints":[{"x":900,"y":280},{"x":840,"y":280},{"x":840,"y":140}],"color":"#eab308"},
        {"id":"w_segn_t_com","fromCompId":"seg_n_tens","fromPinId":"com1","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":920,"y":120},{"x":920,"y":760},{"x":740,"y":760}],"color":"#1e293b"},
        {"id":"w_decn_o_qa","fromCompId":"dec_n_ones","fromPinId":"qa","toCompId":"seg_n_ones","toPinId":"pin_a","waypoints":[{"x":1060,"y":160},{"x":1020,"y":160},{"x":1020,"y":100}],"color":"#eab308"},
        {"id":"w_decn_o_qb","fromCompId":"dec_n_ones","fromPinId":"qb","toCompId":"seg_n_ones","toPinId":"pin_b","waypoints":[{"x":1060,"y":180},{"x":1040,"y":180},{"x":1040,"y":100}],"color":"#eab308"},
        {"id":"w_decn_o_qc","fromCompId":"dec_n_ones","fromPinId":"qc","toCompId":"seg_n_ones","toPinId":"pin_c","waypoints":[{"x":1060,"y":200},{"x":1060,"y":100}],"color":"#eab308"},
        {"id":"w_decn_o_qd","fromCompId":"dec_n_ones","fromPinId":"qd","toCompId":"seg_n_ones","toPinId":"pin_d","waypoints":[{"x":1060,"y":220},{"x":1060,"y":220}],"color":"#eab308"},
        {"id":"w_decn_o_qe","fromCompId":"dec_n_ones","fromPinId":"qe","toCompId":"seg_n_ones","toPinId":"pin_e","waypoints":[{"x":1060,"y":240},{"x":1040,"y":240},{"x":1040,"y":220}],"color":"#eab308"},
        {"id":"w_decn_o_qf","fromCompId":"dec_n_ones","fromPinId":"qf","toCompId":"seg_n_ones","toPinId":"pin_f","waypoints":[{"x":1060,"y":260},{"x":1020,"y":260},{"x":1020,"y":220}],"color":"#eab308"},
        {"id":"w_decn_o_qg","fromCompId":"dec_n_ones","fromPinId":"qg","toCompId":"seg_n_ones","toPinId":"pin_g","waypoints":[{"x":1060,"y":280},{"x":1000,"y":280},{"x":1000,"y":140}],"color":"#eab308"},
        {"id":"w_segn_o_com","fromCompId":"seg_n_ones","fromPinId":"com1","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":1080,"y":120},{"x":1080,"y":760},{"x":740,"y":760}],"color":"#1e293b"},
        {"id":"w_dece_t_qa","fromCompId":"dec_e_tens","fromPinId":"qa","toCompId":"seg_e_tens","toPinId":"pin_a","waypoints":[{"x":1620,"y":720},{"x":1580,"y":720},{"x":1580,"y":660}],"color":"#eab308"},
        {"id":"w_dece_t_qb","fromCompId":"dec_e_tens","fromPinId":"qb","toCompId":"seg_e_tens","toPinId":"pin_b","waypoints":[{"x":1620,"y":740},{"x":1600,"y":740},{"x":1600,"y":660}],"color":"#eab308"},
        {"id":"w_dece_t_qc","fromCompId":"dec_e_tens","fromPinId":"qc","toCompId":"seg_e_tens","toPinId":"pin_c","waypoints":[{"x":1620,"y":760},{"x":1620,"y":660}],"color":"#eab308"},
        {"id":"w_dece_t_qd","fromCompId":"dec_e_tens","fromPinId":"qd","toCompId":"seg_e_tens","toPinId":"pin_d","waypoints":[{"x":1620,"y":780},{"x":1620,"y":780}],"color":"#eab308"},
        {"id":"w_dece_t_qe","fromCompId":"dec_e_tens","fromPinId":"qe","toCompId":"seg_e_tens","toPinId":"pin_e","waypoints":[{"x":1620,"y":800},{"x":1600,"y":800},{"x":1600,"y":780}],"color":"#eab308"},
        {"id":"w_dece_t_qf","fromCompId":"dec_e_tens","fromPinId":"qf","toCompId":"seg_e_tens","toPinId":"pin_f","waypoints":[{"x":1620,"y":820},{"x":1580,"y":820},{"x":1580,"y":780}],"color":"#eab308"},
        {"id":"w_dece_t_qg","fromCompId":"dec_e_tens","fromPinId":"qg","toCompId":"seg_e_tens","toPinId":"pin_g","waypoints":[{"x":1620,"y":840},{"x":1560,"y":840},{"x":1560,"y":700}],"color":"#eab308"},
        {"id":"w_sege_t_com","fromCompId":"seg_e_tens","fromPinId":"com1","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":1640,"y":680},{"x":1640,"y":760},{"x":740,"y":760}],"color":"#1e293b"},
        {"id":"w_dece_o_qa","fromCompId":"dec_e_ones","fromPinId":"qa","toCompId":"seg_e_ones","toPinId":"pin_a","waypoints":[{"x":1760,"y":720},{"x":1720,"y":720},{"x":1720,"y":660}],"color":"#eab308"},
        {"id":"w_dece_o_qb","fromCompId":"dec_e_ones","fromPinId":"qb","toCompId":"seg_e_ones","toPinId":"pin_b","waypoints":[{"x":1760,"y":740},{"x":1740,"y":740},{"x":1740,"y":660}],"color":"#eab308"},
        {"id":"w_dece_o_qc","fromCompId":"dec_e_ones","fromPinId":"qc","toCompId":"seg_e_ones","toPinId":"pin_c","waypoints":[{"x":1760,"y":760},{"x":1760,"y":660}],"color":"#eab308"},
        {"id":"w_dece_o_qd","fromCompId":"dec_e_ones","fromPinId":"qd","toCompId":"seg_e_ones","toPinId":"pin_d","waypoints":[{"x":1760,"y":780},{"x":1760,"y":780}],"color":"#eab308"},
        {"id":"w_dece_o_qe","fromCompId":"dec_e_ones","fromPinId":"qe","toCompId":"seg_e_ones","toPinId":"pin_e","waypoints":[{"x":1760,"y":800},{"x":1740,"y":800},{"x":1740,"y":780}],"color":"#eab308"},
        {"id":"w_dece_o_qf","fromCompId":"dec_e_ones","fromPinId":"qf","toCompId":"seg_e_ones","toPinId":"pin_f","waypoints":[{"x":1760,"y":820},{"x":1720,"y":820},{"x":1720,"y":780}],"color":"#eab308"},
        {"id":"w_dece_o_qg","fromCompId":"dec_e_ones","fromPinId":"qg","toCompId":"seg_e_ones","toPinId":"pin_g","waypoints":[{"x":1760,"y":840},{"x":1700,"y":840},{"x":1700,"y":700}],"color":"#eab308"},
        {"id":"w_sege_o_com","fromCompId":"seg_e_ones","fromPinId":"com1","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":1780,"y":680},{"x":1780,"y":760},{"x":740,"y":760}],"color":"#1e293b"},
        {"id":"w_decs_t_qa","fromCompId":"dec_s_tens","fromPinId":"qa","toCompId":"seg_s_tens","toPinId":"pin_a","waypoints":[{"x":900,"y":1200},{"x":860,"y":1200},{"x":860,"y":1140}],"color":"#eab308"},
        {"id":"w_decs_t_qb","fromCompId":"dec_s_tens","fromPinId":"qb","toCompId":"seg_s_tens","toPinId":"pin_b","waypoints":[{"x":900,"y":1220},{"x":880,"y":1220},{"x":880,"y":1140}],"color":"#eab308"},
        {"id":"w_decs_t_qc","fromCompId":"dec_s_tens","fromPinId":"qc","toCompId":"seg_s_tens","toPinId":"pin_c","waypoints":[{"x":900,"y":1240},{"x":900,"y":1140}],"color":"#eab308"},
        {"id":"w_decs_t_qd","fromCompId":"dec_s_tens","fromPinId":"qd","toCompId":"seg_s_tens","toPinId":"pin_d","waypoints":[{"x":900,"y":1260},{"x":900,"y":1260}],"color":"#eab308"},
        {"id":"w_decs_t_qe","fromCompId":"dec_s_tens","fromPinId":"qe","toCompId":"seg_s_tens","toPinId":"pin_e","waypoints":[{"x":900,"y":1280},{"x":880,"y":1280},{"x":880,"y":1260}],"color":"#eab308"},
        {"id":"w_decs_t_qf","fromCompId":"dec_s_tens","fromPinId":"qf","toCompId":"seg_s_tens","toPinId":"pin_f","waypoints":[{"x":900,"y":1300},{"x":860,"y":1300},{"x":860,"y":1260}],"color":"#eab308"},
        {"id":"w_decs_t_qg","fromCompId":"dec_s_tens","fromPinId":"qg","toCompId":"seg_s_tens","toPinId":"pin_g","waypoints":[{"x":900,"y":1320},{"x":840,"y":1320},{"x":840,"y":1180}],"color":"#eab308"},
        {"id":"w_segs_t_com","fromCompId":"seg_s_tens","fromPinId":"com1","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":920,"y":1160},{"x":920,"y":760},{"x":740,"y":760}],"color":"#1e293b"},
        {"id":"w_decs_o_qa","fromCompId":"dec_s_ones","fromPinId":"qa","toCompId":"seg_s_ones","toPinId":"pin_a","waypoints":[{"x":1060,"y":1200},{"x":1020,"y":1200},{"x":1020,"y":1140}],"color":"#eab308"},
        {"id":"w_decs_o_qb","fromCompId":"dec_s_ones","fromPinId":"qb","toCompId":"seg_s_ones","toPinId":"pin_b","waypoints":[{"x":1060,"y":1220},{"x":1040,"y":1220},{"x":1040,"y":1140}],"color":"#eab308"},
        {"id":"w_decs_o_qc","fromCompId":"dec_s_ones","fromPinId":"qc","toCompId":"seg_s_ones","toPinId":"pin_c","waypoints":[{"x":1060,"y":1240},{"x":1060,"y":1140}],"color":"#eab308"},
        {"id":"w_decs_o_qd","fromCompId":"dec_s_ones","fromPinId":"qd","toCompId":"seg_s_ones","toPinId":"pin_d","waypoints":[{"x":1060,"y":1260},{"x":1060,"y":1260}],"color":"#eab308"},
        {"id":"w_decs_o_qe","fromCompId":"dec_s_ones","fromPinId":"qe","toCompId":"seg_s_ones","toPinId":"pin_e","waypoints":[{"x":1060,"y":1280},{"x":1040,"y":1280},{"x":1040,"y":1260}],"color":"#eab308"},
        {"id":"w_decs_o_qf","fromCompId":"dec_s_ones","fromPinId":"qf","toCompId":"seg_s_ones","toPinId":"pin_f","waypoints":[{"x":1060,"y":1300},{"x":1020,"y":1300},{"x":1020,"y":1260}],"color":"#eab308"},
        {"id":"w_decs_o_qg","fromCompId":"dec_s_ones","fromPinId":"qg","toCompId":"seg_s_ones","toPinId":"pin_g","waypoints":[{"x":1060,"y":1320},{"x":1000,"y":1320},{"x":1000,"y":1180}],"color":"#eab308"},
        {"id":"w_segs_o_com","fromCompId":"seg_s_ones","fromPinId":"com1","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":1080,"y":1160},{"x":1080,"y":760},{"x":740,"y":760}],"color":"#1e293b"},
        {"id":"w_decw_t_qa","fromCompId":"dec_w_tens","fromPinId":"qa","toCompId":"seg_w_tens","toPinId":"pin_a","waypoints":[{"x":240,"y":720},{"x":200,"y":720},{"x":200,"y":660}],"color":"#eab308"},
        {"id":"w_decw_t_qb","fromCompId":"dec_w_tens","fromPinId":"qb","toCompId":"seg_w_tens","toPinId":"pin_b","waypoints":[{"x":240,"y":740},{"x":220,"y":740},{"x":220,"y":660}],"color":"#eab308"},
        {"id":"w_decw_t_qc","fromCompId":"dec_w_tens","fromPinId":"qc","toCompId":"seg_w_tens","toPinId":"pin_c","waypoints":[{"x":240,"y":760},{"x":240,"y":660}],"color":"#eab308"},
        {"id":"w_decw_t_qd","fromCompId":"dec_w_tens","fromPinId":"qd","toCompId":"seg_w_tens","toPinId":"pin_d","waypoints":[{"x":240,"y":780},{"x":240,"y":780}],"color":"#eab308"},
        {"id":"w_decw_t_qe","fromCompId":"dec_w_tens","fromPinId":"qe","toCompId":"seg_w_tens","toPinId":"pin_e","waypoints":[{"x":240,"y":800},{"x":220,"y":800},{"x":220,"y":780}],"color":"#eab308"},
        {"id":"w_decw_t_qf","fromCompId":"dec_w_tens","fromPinId":"qf","toCompId":"seg_w_tens","toPinId":"pin_f","waypoints":[{"x":240,"y":820},{"x":200,"y":820},{"x":200,"y":780}],"color":"#eab308"},
        {"id":"w_decw_t_qg","fromCompId":"dec_w_tens","fromPinId":"qg","toCompId":"seg_w_tens","toPinId":"pin_g","waypoints":[{"x":240,"y":840},{"x":180,"y":840},{"x":180,"y":700}],"color":"#eab308"},
        {"id":"w_segw_t_com","fromCompId":"seg_w_tens","fromPinId":"com1","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":260,"y":680},{"x":260,"y":760},{"x":740,"y":760}],"color":"#1e293b"},
        {"id":"w_decw_o_qa","fromCompId":"dec_w_ones","fromPinId":"qa","toCompId":"seg_w_ones","toPinId":"pin_a","waypoints":[{"x":380,"y":720},{"x":340,"y":720},{"x":340,"y":660}],"color":"#eab308"},
        {"id":"w_decw_o_qb","fromCompId":"dec_w_ones","fromPinId":"qb","toCompId":"seg_w_ones","toPinId":"pin_b","waypoints":[{"x":380,"y":740},{"x":360,"y":740},{"x":360,"y":660}],"color":"#eab308"},
        {"id":"w_decw_o_qc","fromCompId":"dec_w_ones","fromPinId":"qc","toCompId":"seg_w_ones","toPinId":"pin_c","waypoints":[{"x":380,"y":760},{"x":380,"y":660}],"color":"#eab308"},
        {"id":"w_decw_o_qd","fromCompId":"dec_w_ones","fromPinId":"qd","toCompId":"seg_w_ones","toPinId":"pin_d","waypoints":[{"x":380,"y":780},{"x":380,"y":780}],"color":"#eab308"},
        {"id":"w_decw_o_qe","fromCompId":"dec_w_ones","fromPinId":"qe","toCompId":"seg_w_ones","toPinId":"pin_e","waypoints":[{"x":380,"y":800},{"x":360,"y":800},{"x":360,"y":780}],"color":"#eab308"},
        {"id":"w_decw_o_qf","fromCompId":"dec_w_ones","fromPinId":"qf","toCompId":"seg_w_ones","toPinId":"pin_f","waypoints":[{"x":380,"y":820},{"x":340,"y":820},{"x":340,"y":780}],"color":"#eab308"},
        {"id":"w_decw_o_qg","fromCompId":"dec_w_ones","fromPinId":"qg","toCompId":"seg_w_ones","toPinId":"pin_g","waypoints":[{"x":380,"y":840},{"x":320,"y":840},{"x":320,"y":700}],"color":"#eab308"},
        {"id":"w_segw_o_com","fromCompId":"seg_w_ones","fromPinId":"com1","toCompId":"gnd1","toPinId":"gnd","waypoints":[{"x":400,"y":680},{"x":400,"y":760},{"x":740,"y":760}],"color":"#1e293b"},
      ],
    },
  },
];
