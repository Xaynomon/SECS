export interface SpiceNode {
  id: number; // 0 = GND
  name: string;
}

export interface SpiceComponentResult {
  componentId: string;
  voltageDropV: number;
  currentA: number;
  powerW: number;
  isOverloaded: boolean;
  isBurned: boolean;
  overloadReason?: string;
  brightness?: number; // 0.0 to 1.0 for LEDs
  rpm?: number; // for fan & DC motor
  direction?: 'CW' | 'CCW' | 'IDLE';
  servoAngle?: number;
  sdActivity?: boolean;
  isSounding?: boolean; // for buzzer
  outputVoltage?: number; // for logic gates & 555
  logicOutput?: 0 | 1 | 'Z' | 'X'; // for logic gates & 555
  isBlown?: boolean; // for protective fuse
  isEngaged?: boolean; // for electromechanical relay module
  inputCurrentA?: number; // for power converters & regulators
  outputCurrentA?: number; // for power converters & regulators
  resistance?: number; // for dynamic loads & fuse
  redLit?: boolean;
  yellowLit?: boolean;
  greenLit?: boolean;
  flowRateLpm?: number;
  isTransmitting?: boolean;
  isReceiving?: boolean;
  isEmitting?: boolean;
  isReceivingIr?: boolean;
  pinVoltages: Record<string, number>;
  [key: string]: any;
}

export interface SpiceSimulationResult {
  nodeVoltages: Map<number, number>; // node id -> voltage in Volts
  netVoltages: Map<string, number>; // net id -> voltage in Volts
  wireVoltages: Map<string, number>; // wire id -> voltage in Volts
  wireCurrents: Map<string, number>; // wire id -> current in Amperes
  componentResults: Map<string, SpiceComponentResult>;
  timeStepSec: number;
}
