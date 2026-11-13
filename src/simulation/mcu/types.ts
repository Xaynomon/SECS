export type McuType = 'arduino-uno' | 'esp32' | 'pico' | 'builtin_cpu_8bit' | 'cpu-8bit';

export type McuPinMode = 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP';

export interface McuPinState {
  pinId: string;
  mode: McuPinMode;
  digitalValue: 0 | 1;
  analogValue: number; // 0 - 1023 (10-bit ADC)
  pwmValue: number;    // 0 - 255
  voltage: number;     // 0.0 - 5.0V
  value?: 0 | 1 | number;
  servoAngle?: number; // 0 - 180 degrees
}

export interface SerialLogEntry {
  id: string;
  timestampMs: number;
  text: string;
  type: 'output' | 'input' | 'system' | 'error';
}

export type McuStatus = 'idle' | 'running' | 'paused' | 'error';

export interface McuPeripheralState {
  oledLines?: string[];
  oledProgressBar?: number | null;
  oledUpdated?: boolean;
  lcdRows?: [string, string];
  lcdCursorCol?: number;
  lcdCursorRow?: number;
  lcdUpdated?: boolean;
  sdPendingWrites?: Array<{ filename: string; text: string; append: boolean }>;
  servoAnglesByPin?: Record<string, number>;
  defaultServoAngle?: number;
}

export interface McuInstanceData {
  componentId: string;
  type: McuType;
  code: string;
  status: McuStatus;
  pins: Record<string, McuPinState>;
  ledL: boolean;
  ledOn: boolean;
  ledTx: boolean;
  ledRx: boolean;
  serialLogs: SerialLogEntry[];
  serialInputBuffer: string;
  lastError?: string;
  runtimeClockMs: number;
  asmRegisters?: {
    acc: number;
    regB: number;
    pc: number;
    zeroFlag: 0 | 1;
    carryFlag: 0 | 1;
    outByte: number;
    inNibble: number;
    halted: boolean;
    currentLine: number;
    currentMnemonic: string;
  };
  peripheralState?: McuPeripheralState;
}
