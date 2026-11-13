import { CircuitComponent, ComponentDefinition, PinDefinition } from '../types/circuit';
import { ComponentRegistry } from '../registry/ComponentRegistry';

export const GRID_SIZE = 20;

export function snapToGrid(value: number, gridSize = GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

export function snapPointToGrid(x: number, y: number, gridSize = GRID_SIZE): { x: number; y: number } {
  return {
    x: snapToGrid(x, gridSize),
    y: snapToGrid(y, gridSize),
  };
}

export function getComponentCenter(
  activeDef: {
    width: number;
    height: number;
    origin?: 'center' | 'top-left';
    pins?: Array<{ x: number; y: number }>;
  },
  compType?: string
): { cx: number; cy: number } {
  const isCentered =
    activeDef.origin === 'center' ||
    compType === 'arduino-uno' ||
    compType === 'esp32' ||
    compType === 'pico';
  if (isCentered && activeDef.pins && activeDef.pins.length > 0) {
    const allPinsOn20Grid = activeDef.pins.every((p) => p.x % 20 === 0 && p.y % 20 === 0);
    if (allPinsOn20Grid) {
      return {
        cx: snapToGrid(activeDef.width / 2, 20),
        cy: snapToGrid(activeDef.height / 2, 20),
      };
    }
  }
  return {
    cx: activeDef.width / 2,
    cy: activeDef.height / 2,
  };
}

/**
 * Calculates absolute world position of a pin on a component,
 * taking into account component (x, y), rotation (0, 90, 180, 270), and mirroring.
 *
 * Single Source of Truth: Always prefers the active definition in ComponentRegistry
 * to automatically migrate any stale pin coordinates on canvas instances.
 */
export function getPinAbsolutePosition(
  comp: CircuitComponent,
  pinId: string,
  compDef?: { width: number; height: number; origin?: 'center' | 'top-left'; pins: Array<{ id: string; x: number; y: number; [key: string]: any }> } | any
): { x: number; y: number } {
  const registryDef = ComponentRegistry.getComponentDefinition(comp.type);
  const activeDef = registryDef || compDef;
  if (!activeDef) {
    return { x: comp.x, y: comp.y };
  }

  const pin = activeDef.pins?.find(
    (p: any) => p.id.toLowerCase() === pinId.toLowerCase()
  );
  if (!pin) {
    return { x: comp.x, y: comp.y };
  }

  const { cx, cy } = getComponentCenter(activeDef, comp.type);
  const isCentered =
    activeDef.origin === 'center' ||
    comp.type === 'arduino-uno' ||
    comp.type === 'esp32' ||
    comp.type === 'pico';

  // Local offset from center
  let dx = isCentered ? pin.x : pin.x - cx;
  let dy = isCentered ? pin.y : pin.y - cy;

  // Horizontal mirror
  if (comp.mirrored) {
    dx = -dx;
  }

  // Rotation around center
  const rad = ((comp.rotation % 360) + 360) % 360;
  let rx = dx;
  let ry = dy;

  if (rad === 90) {
    rx = -dy;
    ry = dx;
  } else if (rad === 180) {
    rx = -dx;
    ry = -dy;
  } else if (rad === 270) {
    rx = dy;
    ry = -dx;
  }

  return {
    x: Math.round(comp.x + cx + rx),
    y: Math.round(comp.y + cy + ry),
  };
}

/**
 * Returns all pin absolute positions for a component
 */
export function getAllComponentPinPositions(
  comp: CircuitComponent,
  compDef: ComponentDefinition
): { pin: PinDefinition; pos: { x: number; y: number } }[] {
  return compDef.pins.map((pin) => ({
    pin,
    pos: getPinAbsolutePosition(comp, pin.id, compDef),
  }));
}

export interface RotatedBoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Calculates local bounding box of component after rotation around its center (cx, cy).
 * minX, maxX, minY, maxY are relative to component top-left (comp.x, comp.y).
 */
export function getRotatedBoundingBox(
  width: number,
  height: number,
  rotation: number
): RotatedBoundingBox {
  const cx = width / 2;
  const cy = height / 2;
  const rad = ((rotation % 360) + 360) % 360;

  if (rad === 90 || rad === 270) {
    return {
      minX: Math.round(cx - height / 2),
      maxX: Math.round(cx + height / 2),
      minY: Math.round(cy - width / 2),
      maxY: Math.round(cy + width / 2),
      width: height,
      height: width,
    };
  }

  return {
    minX: 0,
    maxX: width,
    minY: 0,
    maxY: height,
    width,
    height,
  };
}

/**
 * Returns a human-friendly primary electrical parameter string for upright display.
 */
export function getComponentValueString(comp: CircuitComponent): string | null {
  const p = comp.properties;
  if (!p) return null;

  switch (comp.type) {
    case 'resistor': {
      const val = p.resistance ?? 1000;
      return val >= 1000000
        ? `${val / 1000000}MΩ`
        : val >= 1000
        ? `${val / 1000}kΩ`
        : `${val}Ω`;
    }
    case 'capacitor-ceramic':
      return `${p.capacitance ?? 100}nF`;
    case 'capacitor-electrolytic':
      return `${p.capacitance ?? 10}µF`;
    case 'inductor':
      return `${p.inductance ?? 10}mH`;
    case 'potentiometer':
      return `${(p.maxResistance ?? 10000) / 1000}kΩ (${p.position ?? 50}%)`;
    case 'dc-source':
      return `${p.voltage ?? 9}V`;
    case 'ac-source':
      return `${p.amplitude ?? 12}V~`;
    case 'vcc':
      return `+${p.voltage ?? 5}V`;
    case 'coin-cell':
      return `${p.voltage ?? 3}V`;
    case 'zener-diode':
      return `${p.zenerVoltage ?? 5.1}V`;
    case 'temp-sensor':
      return `${p.temperatureC ?? 25}°C`;
    case 'light-sensor':
      return `${p.lux ?? 500} lx`;
    case 'ultrasonic':
      return `${p.distanceCm ?? 50}cm`;
    case 'dc-fan':
      return `${p.voltage ?? 12}V`;
    case 'builtin_humidity_sensor':
    case 'humidity-sensor':
    case 'humidity_sensor':
      return `${p.humidity ?? 45}% RH`;
    case 'builtin_dc_motor':
    case 'dc-motor':
    case 'dc_motor':
      return comp.state?.rpm ? `${comp.state.rpm} RPM (${comp.state.direction || 'CW'})` : `${p.ratedVoltage ?? 6}V DC`;
    case 'builtin_servo_motor':
    case 'servo-motor':
    case 'servo_motor':
      return `${comp.state?.servoAngle ?? p.angle ?? p.targetAngle ?? 90}°`;
    case 'builtin_motion_sensor':
    case 'motion-sensor':
    case 'motion_sensor':
      return p.motionDetected ? 'MOTION (1)' : 'IDLE (0)';
    case 'builtin_gas_sensor':
    case 'gas-sensor':
    case 'gas_sensor':
      return `${p.ppm ?? 50} ppm`;
    case 'builtin_accelerometer':
    case 'accelerometer':
      return `${(p.accelX ?? 0).toFixed(1)}g, ${(p.accelY ?? 0).toFixed(1)}g`;
    case 'builtin_dcdc_converter':
    case 'dcdc-converter':
    case 'dcdc_converter':
      return `${(p.targetVoltage ?? 12).toFixed(1)}V (${(p.mode || 'auto').toUpperCase()})`;
    case 'builtin_numpad':
    case 'numpad':
      return p.activeKey ? `Key [${p.activeKey}]` : '4x4 Matrix';
    case 'builtin_comparator':
      return `${(p.thresholdVoltage ?? 2.5).toFixed(1)}V Ref`;
    case 'builtin_shift_register':
      return `Bits: ${(p.outputBits ?? comp.state?.outputBits ?? 0).toString(2).padStart(8, '0')}`;
    case 'builtin_bcd_decoder':
      return 'BCD -> 7Seg';
    case 'builtin_mux_4to1':
      return '4:1 MUX';
    case 'builtin_d_flipflop':
      return `Q: ${comp.state?.q ?? p.q ?? 0}`;
    case 'builtin_jk_flipflop':
      return `Q: ${comp.state?.q ?? p.q ?? 0}`;
    case 'builtin_counter_4bit':
      return `CNT: ${comp.state?.count ?? p.count ?? 0}`;
    case 'builtin_dip_switch_4': {
      const b1 = p.sw1 ? '1' : '0';
      const b2 = p.sw2 ? '1' : '0';
      const b3 = p.sw3 ? '1' : '0';
      const b4 = p.sw4 ? '1' : '0';
      return `DIP: [${b1}${b2}${b3}${b4}]`;
    }
    case 'builtin_fuse':
      return (p.isBlown || comp.state?.isBlown) ? '⚡ BLOWN' : `${(p.maxCurrent ?? 0.1) * 1000}mA Fuse`;
    case 'builtin_hbridge':
      return 'L298N Dual H-Bridge';
    case 'builtin_pnp':
      return 'PNP (2N3906)';
    case 'builtin_pmos':
      return 'P-MOSFET';
    case 'builtin_bridge_rectifier':
      return 'Bridge Rectifier';
    case 'builtin_reg_7805':
      return '+5.0V Reg';
    case 'builtin_optocoupler':
      return 'PC817 Opto';
    case 'builtin_solar_panel':
      return `${(comp.state?.outputVoltage ?? 0.5 + ((p.lux ?? 100) / 1000) * ((p.maxVoltage ?? 6.0) - 0.5)).toFixed(1)}V (${p.lux ?? 100} lx)`;
    case 'builtin_joystick':
      return `X:${p.joyX ?? 0}% Y:${p.joyY ?? 0}%`;
    case 'builtin_led_bar_graph':
      return `${comp.state?.litCount ?? p.litCount ?? 0}/10 Bars`;
    case 'builtin_stepper_motor':
      return `${comp.state?.angle ?? p.angle ?? 0}°`;
    case 'builtin_soil_moisture':
      return `${p.moisture ?? 20}% Moisture`;
    case 'builtin_traffic_light':
      return 'R / Y / G Signal';
    case 'builtin_water_pump':
      return comp.state?.isRunning ? `${(comp.state?.flowRateLpm ?? 2.5).toFixed(1)} L/min` : `${p.resistance ?? 25}Ω Pump`;
    case 'builtin_filament_bulb':
      return `${p.resistance ?? 24}Ω (${p.maxPower ?? 8}W)`;
    case 'builtin_rf_radio':
      return String(p.rfChannel || 'CH 1 (433.0 MHz)');
    case 'builtin_ir_tx':
      return comp.state?.isEmitting ? 'IR TX: EMITTING' : '940nm IR LED';
    case 'builtin_ir_rx':
      return (comp.state?.isReceivingIr || p.irDetected) ? 'IR RX: DETECTED' : '38kHz IR RX';
    case 'builtin_hall_sensor':
      return `${p.magneticField ?? 0} mT`;
    case 'builtin_vibration_sensor':
      return (p.vibrationDetected || comp.state?.lit) ? 'SHOCK (1)' : 'CALM (0)';
    case 'builtin_solenoid':
      return comp.state?.isEngaged ? 'ACTUATED ➡️' : 'RETRACTED';
    case 'builtin_speaker':
      return `${p.resistance ?? 8}Ω (${p.maxPower ?? 2}W)`;
    default:
      return null;
  }
}
