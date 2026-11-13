export interface ProbeTarget {
  type: 'pin' | 'wire';
  compId?: string;
  pinId?: string;
  wireId?: string;
  label?: string; // e.g. "R1 : pin 1", "MCU1 : D13", "Wire #4"
}

export type MultimeterMode = 'DC_V' | 'AC_V' | 'DC_A' | 'RES' | 'CONT';

export interface MultimeterState {
  redProbe: ProbeTarget | null;
  blackProbe: ProbeTarget | null; // Defaults to GND (0V) if null
  mode: MultimeterMode;
  isHold: boolean;
  heldValue: number | null;
  heldUnit: string;
  minVal: number | null;
  maxVal: number | null;
}

export type ScopeTriggerSource = 'ch1' | 'ch2';
export type ScopeTriggerMode = 'auto' | 'normal' | 'single';
export type ScopeTriggerEdge = 'rising' | 'falling';

export interface ScopeChannelConfig {
  id: 'ch1' | 'ch2';
  name: string;
  enabled: boolean;
  color: string;
  target: ProbeTarget | null;
  voltsPerDiv: number; // 0.5, 1, 2, 5, 10
  offsetDiv: number; // vertical shift in divisions (-4 to +4)
  coupling: 'DC' | 'AC' | 'GND';
}

export interface ScopeTelemetry {
  vMax: number;
  vMin: number;
  vPp: number;
  vAvg: number;
  vRms: number;
  frequencyHz: number;
  periodMs: number;
  dutyCyclePct: number;
}

export interface OscilloscopeState {
  ch1: ScopeChannelConfig;
  ch2: ScopeChannelConfig;
  timebaseMsPerDiv: number; // 1, 10, 50, 100, 500, 1000
  trigger: {
    source: ScopeTriggerSource;
    mode: ScopeTriggerMode;
    edge: ScopeTriggerEdge;
    levelV: number;
  };
  isPaused: boolean;
}

export interface LogicChannelConfig {
  id: string; // 'D0'..'D7'
  name: string; // custom label (e.g. "CLK", "DATA", "LED_OUT")
  color: string;
  enabled: boolean;
  target: ProbeTarget | null;
}

export interface LogicAnalyzerState {
  channels: LogicChannelConfig[];
  timeScaleMsPerDiv: number; // e.g. 10, 50, 100
  isPaused: boolean;
  cursorT1: number | null; // time in ms
  cursorT2: number | null; // time in ms
}

export interface ActiveProbePicker {
  instrument: 'multimeter' | 'oscilloscope' | 'logicAnalyzer';
  channelId: string; // 'red' | 'black' | 'ch1' | 'ch2' | 'D0'..'D7'
  color: string;
  title: string;
}
