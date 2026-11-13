export type ComponentCategory =
  | 'power'
  | 'passives'
  | 'semiconductors'
  | 'logic'
  | 'mcu'
  | 'sensors'
  | 'actuators'
  | 'outputs'
  | 'annotations'
  | 'instruments';

export type PinType = 'input' | 'output' | 'bidirectional' | 'power' | 'ground' | 'passive';

export interface PinDefinition {
  id: string;
  name: string;
  label?: string; // friendly silkscreen label alias
  x: number; // Local offset relative to component origin
  y: number; // Local offset relative to component origin
  type: PinType;
  description?: string;
  defaultSignal?: number;
}

export type PropertyFieldType = 'number' | 'text' | 'select' | 'boolean' | 'color';

export interface PropertySchemaItem {
  key: string;
  label: string;
  type: PropertyFieldType;
  unit?: string;
  options?: { label: string; value: string | number }[];
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

export interface ComponentDefinition {
  type: string;
  name: string;
  category: ComponentCategory;
  description: string;
  tags: string[];
  width: number;
  height: number;
  origin?: 'center' | 'top-left';
  pins: PinDefinition[];
  defaultProperties: Record<string, any>;
  propertySchema: PropertySchemaItem[];
  defaultDesignator: string; // e.g. "R", "C", "V", "U", "LED"
}

export interface CircuitComponent {
  id: string;
  type: string;
  label: string;
  x: number; // World coordinate (snapped to 20px grid)
  y: number; // World coordinate (snapped to 20px grid)
  rotation: number; // 0, 90, 180, 270
  mirrored: boolean; // Flip horizontal
  properties: Record<string, any>;
  state?: Record<string, any>;
}

export interface WireWaypoint {
  x: number;
  y: number;
}

export type LogicLevel = 0 | 1 | 'Z' | 'X';

export interface CircuitWire {
  id: string;
  fromCompId: string;
  fromPinId: string;
  toCompId: string;
  toPinId: string;
  waypoints: WireWaypoint[];
  color: string;
  state?: {
    voltage?: number;
    current?: number;
    logicLevel?: LogicLevel | null;
    flowDirection?: 1 | -1 | 0;
  };
}

export interface DrawingWireState {
  fromCompId: string;
  fromPinId: string;
  startPos: { x: number; y: number };
  currentPos: { x: number; y: number };
  waypoints: WireWaypoint[];
  color: string;
}

export interface ViewportTransform {
  zoom: number; // 0.25 to 4.0
  panX: number;
  panY: number;
}

export type SimulationMode = 'LOGICAL' | 'ANALOG';
export type SimulationStatus = 'stopped' | 'running' | 'paused';

export interface DiagnosticTip {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  componentId?: string;
  severity?: 'critical' | 'warning' | 'tip';
  actionLabel?: string;
  peakValue?: string;
}

export interface CircuitFileFormat {
  version: string;
  timestamp: string;
  name: string;
  theme?: 'dark' | 'light';
  canvasTransform?: ViewportTransform;
  viewport: ViewportTransform;
  components: CircuitComponent[];
  wires: CircuitWire[];
}
