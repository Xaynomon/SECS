import { ComponentRegistry } from '../registry/ComponentRegistry';
import { ComponentDefinition } from '../types/componentRegistry';

export const COMPONENT_CATEGORIES = [
  { id: 'power', label: 'Power & Sources', icon: 'Zap' },
  { id: 'passives', label: 'Passives', icon: 'Layers' },
  { id: 'semiconductors', label: 'Semiconductors', icon: 'Cpu' },
  { id: 'logic', label: 'Logic Gates', icon: 'Binary' },
  { id: 'mcu', label: 'Microcontrollers', icon: 'Microchip' },
  { id: 'sensors', label: 'Sensors (Inputs)', icon: 'Activity' },
  { id: 'outputs', label: 'Actuators & Outputs', icon: 'Lightbulb' },
  { id: 'instruments', label: 'Virtual Instruments', icon: 'Gauge' },
  { id: 'annotations', label: 'Annotations & Notes', icon: 'Type' },
] as const;

// Create proxy dictionary to support legacy COMPONENT_DEFINITIONS[id] access
export const COMPONENT_DEFINITIONS: Record<string, ComponentDefinition> = new Proxy(
  {} as Record<string, ComponentDefinition>,
  {
    get(_target, prop: string) {
      if (prop === 'then' || typeof prop === 'symbol') return undefined;
      return ComponentRegistry.get(prop);
    },
    ownKeys() {
      return ComponentRegistry.getAllComponents().map((c) => c.id);
    },
    getOwnPropertyDescriptor(_target, prop: string) {
      const val = ComponentRegistry.get(prop);
      if (val) {
        return { configurable: true, enumerable: true, value: val, writable: false };
      }
      return undefined;
    },
    has(_target, prop: string) {
      return !!ComponentRegistry.get(prop);
    },
  }
);
