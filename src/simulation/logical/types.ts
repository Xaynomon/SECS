export type LogicLevel = 0 | 1 | 'Z' | 'X';

export interface NetPinRef {
  compId: string;
  pinId: string;
}

export interface ElectricalNet {
  id: string;
  pins: NetPinRef[];
  wireIds: string[];
  level: LogicLevel;
  contention: boolean;
  driverCount: number;
  driverValues: (0 | 1)[];
  hasHighPath?: boolean;
  hasGroundReturn?: boolean;
  isActiveFlow?: boolean;
}

export interface ComponentSimulationState {
  // Output and visual states
  lit?: boolean;
  brightness?: number; // 0 to 100
  isRunning?: boolean; // For DC fan & DC motor
  angularVelocity?: number;
  rpm?: number;
  direction?: 'CW' | 'CCW' | 'IDLE' | 'BRAKE';
  motorDirection?: 'CW' | 'CCW' | 'IDLE' | 'BRAKE';
  servoAngle?: number;
  sdActivity?: boolean;
  isSounding?: boolean; // For Buzzer
  segments?: Record<string, boolean>; // For 7-segment display: { a, b, c, d, e, f, g, dp }
  outputVoltage?: number;
  logicOutput?: LogicLevel;
  isEngaged?: boolean; // For Relay
  pinSignals?: Record<string, LogicLevel>;
  isOverloaded?: boolean;
  isBurned?: boolean;
  overloadReason?: string;
  hasSeriesResistor?: boolean;

  // Phase 7.4 Expansion State Fields
  outputBits?: number;
  shiftBits?: number;
  count?: number;
  q?: LogicLevel;
  nq?: LogicLevel;
  sw1?: boolean;
  sw2?: boolean;
  sw3?: boolean;
  sw4?: boolean;
  isBlown?: boolean;
  isConducting?: boolean;
  isCoupled?: boolean;
  lux?: number;
  joyX?: number;
  joyY?: number;
  isPressed?: boolean;
  litCount?: number;
  angle?: number;
  stepCount?: number;
  prevClk?: LogicLevel;
  prevLatch?: LogicLevel;
  pinVoltages?: Record<string, number>;

  // Phase 7.9 Expansion State Fields
  redLit?: boolean;
  yellowLit?: boolean;
  greenLit?: boolean;
  flowRateLpm?: number;
  isTransmitting?: boolean;
  isReceiving?: boolean;
  isEmitting?: boolean;
  isReceivingIr?: boolean;
  [key: string]: any;
}

export interface LogicalSimulationResult {
  netStates: Map<string, LogicLevel>;
  wireStates: Map<string, LogicLevel>;
  pinStates: Map<string, LogicLevel>; // key: `${compId}:${pinId}`
  componentStates: Map<string, ComponentSimulationState>;
  contentionErrors: Array<{ netId: string; message: string; compIds: string[] }>;
  activeFlowWires?: Set<string>;
}
