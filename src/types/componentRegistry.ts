export type PinDirection =
  | 'input'
  | 'output'
  | 'bidirectional'
  | 'passive'
  | 'power'
  | 'ground';
export type SimulationModelType = 'logical' | 'spice' | 'subcircuit' | 'script';

export interface ComponentPinDefinition {
  id: string;
  label: string;
  name?: string; // alias for label
  x: number; // offset relative to component origin
  y: number;
  direction: PinDirection;
  type?: PinDirection; // alias for direction
  defaultSignal?: number; // for logic mode (0 or 1)
  description?: string;
}

export type ComponentRegistryCategory =
  | 'power'
  | 'passives'
  | 'semiconductors'
  | 'logic'
  | 'mcu'
  | 'sensors'
  | 'outputs'
  | 'custom'
  | 'annotations'
  | 'instruments';

export interface PropertySchemaItem {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select' | 'boolean' | 'color';
  unit?: string;
  options?: { label: string; value: string | number }[];
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

export interface ComponentDefinition {
  id: string; // e.g. 'resistor', 'builtin_resistor', 'builtin_arduino_uno', 'custom_4bit_counter'
  type?: string; // alias for id to maintain backwards compatibility
  name: string;
  category: ComponentRegistryCategory;
  description: string;
  tags?: string[];
  width: number;
  height: number;
  origin?: 'center' | 'top-left'; // default 'top-left'
  pins: ComponentPinDefinition[];
  renderType: 'svg_template' | 'composite_shapes';
  simulationModel: {
    type: SimulationModelType;
    defaultSpiceParams?: Record<string, number | string>;
    logicFunction?: string; // logical evaluation expression or function key
    subcircuitData?: any;   // reserved for compiled subcircuits
    scriptCode?: string;     // reserved for future programmable components
  };
  defaultProperties: Record<string, any>; // e.g. resistance, voltage, label
  propertySchema?: PropertySchemaItem[];
  defaultDesignator?: string;
  isCustom?: boolean;      // flag for future user-imported components
}
