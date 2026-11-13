import {
  ComponentDefinition,
  ComponentRegistryCategory,
  PinDirection,
} from '../types/componentRegistry';

class ComponentRegistryClass {
  private registry: Map<string, ComponentDefinition> = new Map();
  private aliasMap: Map<string, string> = new Map();

  constructor() {
    this.registerBuiltinComponents();
  }

  /**
   * Registers a new component definition into the registry
   */
  public registerComponent(def: ComponentDefinition): void {
    def.type = def.id;
    if (def.pins) {
      def.pins.forEach((pin) => {
        if (!pin.name) pin.name = pin.label;
        if (!pin.type) pin.type = pin.direction;
      });
    }
    this.registry.set(def.id, def);

    // Also register stripped or prefixed aliases for convenience
    // (e.g. 'builtin_resistor' <-> 'resistor')
    if (def.id.startsWith('builtin_')) {
      const shortId = def.id.replace('builtin_', '');
      this.aliasMap.set(shortId, def.id);
      this.aliasMap.set(shortId.replace(/_/g, '-'), def.id);
    } else {
      this.aliasMap.set(`builtin_${def.id}`, def.id);
      this.aliasMap.set(`builtin_${def.id.replace(/-/g, '_')}`, def.id);
    }
  }

  /**
   * Retrieves a component definition by ID or alias
   */
  public getComponentDefinition(id: string): ComponentDefinition | undefined {
    if (this.registry.has(id)) {
      return this.registry.get(id);
    }
    const aliased = this.aliasMap.get(id);
    if (aliased && this.registry.has(aliased)) {
      return this.registry.get(aliased);
    }
    return undefined;
  }

  /**
   * Alias method for shorthand access
   */
  public get(id: string): ComponentDefinition | undefined {
    return this.getComponentDefinition(id);
  }

  /**
   * Returns all registered component definitions
   */
  public getAllComponents(): ComponentDefinition[] {
    return Array.from(this.registry.values());
  }

  /**
   * Filters registered components by category
   */
  public filterByCategory(category: ComponentRegistryCategory | 'actuators'): ComponentDefinition[] {
    // Normalize legacy 'actuators' to 'outputs'
    const targetCategory = category === 'actuators' ? 'outputs' : category;
    return this.getAllComponents().filter((c) => c.category === targetCategory);
  }

  /**
   * Real-time search across names, tags, descriptions, and IDs
   */
  public searchComponents(query: string): ComponentDefinition[] {
    if (!query.trim()) return this.getAllComponents();
    const q = query.toLowerCase().trim();
    return this.getAllComponents().filter((c) => {
      const matchName = c.name.toLowerCase().includes(q);
      const matchDesc = c.description.toLowerCase().includes(q);
      const matchTags = c.tags ? c.tags.some((t) => t.toLowerCase().includes(q)) : false;
      const matchCat = c.category.toLowerCase().includes(q);
      const matchId = c.id.toLowerCase().includes(q);
      return matchName || matchDesc || matchTags || matchCat || matchId;
    });
  }

  /**
   * Populates the registry with all built-in components and simulation model metadata
   */
  private registerBuiltinComponents(): void {
    // ==========================================
    // 1. POWER & SOURCES
    // ==========================================
    this.registerComponent({
      id: 'dc-source',
      name: 'DC Battery / Source',
      category: 'power',
      description: 'Direct current voltage power source / battery pack',
      tags: ['battery', 'voltage', 'dc', 'power', 'vcc', 'cell'],
      width: 80,
      height: 40,
      defaultDesignator: 'V',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'spice',
        defaultSpiceParams: { V: 9, Rser: 0.1 },
      },
      pins: [
        { id: 'pos', label: '+', x: 80, y: 20, direction: 'output', description: 'Positive Terminal (+)' },
        { id: 'neg', label: '-', x: 0, y: 20, direction: 'passive', description: 'Negative Terminal (-)' },
      ],
      defaultProperties: { voltage: 9, internalResistance: 0.1 },
      propertySchema: [
        { key: 'voltage', label: 'Voltage', type: 'number', unit: 'V', min: 0.1, max: 240, step: 0.5 },
        { key: 'internalResistance', label: 'Internal R', type: 'number', unit: 'Ω', min: 0, max: 100, step: 0.05 },
      ],
    });

    this.registerComponent({
      id: 'ac-source',
      name: 'AC Voltage Source',
      category: 'power',
      description: 'Alternating current generator supporting Sine, Square, Triangle, and Sawtooth waveforms',
      tags: ['ac', 'sine', 'square', 'triangle', 'sawtooth', 'generator', 'power', 'source', 'function'],
      width: 80,
      height: 40,
      defaultDesignator: 'AC',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'spice',
        defaultSpiceParams: { Vpeak: 12, Freq: 10, Phase: 0, waveform: 'sine', dutyCycle: 50, offset: 0 },
      },
      pins: [
        { id: 'pos', label: '~ Line', x: 80, y: 20, direction: 'output' },
        { id: 'neg', label: '~ Neutral', x: 0, y: 20, direction: 'passive' },
      ],
      defaultProperties: { waveform: 'sine', amplitude: 12, frequency: 10, phase: 0, dutyCycle: 50, offset: 0 },
      propertySchema: [
        {
          key: 'waveform',
          label: 'Waveform',
          type: 'select',
          options: [
            { label: 'Sine Wave (~)', value: 'sine' },
            { label: 'Square Wave (⎍)', value: 'square' },
            { label: 'Triangle Wave (⋀)', value: 'triangle' },
            { label: 'Sawtooth Wave (⊿)', value: 'sawtooth' },
          ],
        },
        { key: 'amplitude', label: 'Peak Voltage (Vpk)', type: 'number', unit: 'V', min: 0.1, max: 240, step: 0.5 },
        { key: 'frequency', label: 'Frequency', type: 'number', unit: 'Hz', min: 0.1, max: 1000000, step: 1 },
        { key: 'offset', label: 'DC Offset', type: 'number', unit: 'V', min: -50, max: 50, step: 0.5 },
        { key: 'dutyCycle', label: 'Duty Cycle', type: 'number', unit: '%', min: 1, max: 99, step: 5 },
      ],
    });

    this.registerComponent({
      id: 'vcc',
      name: 'VCC Power Rail',
      category: 'power',
      description: 'Constant DC positive power rail (+5V / +3.3V)',
      tags: ['vcc', 'power', 'rail', '5v', '3.3v', 'high'],
      width: 40,
      height: 40,
      defaultDesignator: 'VCC',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'logical',
        defaultSpiceParams: { V: 5.0 },
      },
      pins: [{ id: 'vcc', label: 'VCC', x: 20, y: 40, direction: 'output' }],
      defaultProperties: { voltage: 5.0 },
      propertySchema: [
        {
          key: 'voltage',
          label: 'Rail Voltage',
          type: 'select',
          unit: 'V',
          options: [
            { label: '+3.3V (Logic)', value: 3.3 },
            { label: '+5.0V (Standard)', value: 5.0 },
            { label: '+12.0V (Power)', value: 12.0 },
            { label: '+24.0V (Industrial)', value: 24.0 },
          ],
        },
      ],
    });

    this.registerComponent({
      id: 'gnd',
      name: 'Ground (GND)',
      category: 'power',
      description: 'Common 0V circuit reference return',
      tags: ['gnd', 'ground', 'earth', '0v', 'return'],
      width: 40,
      height: 40,
      defaultDesignator: 'GND',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'spice',
        defaultSpiceParams: { V: 0 },
      },
      pins: [{ id: 'gnd', label: 'GND', x: 20, y: 0, direction: 'passive' }],
      defaultProperties: {},
      propertySchema: [],
    });

    this.registerComponent({
      id: 'coin-cell',
      name: 'Coin Cell (CR2032)',
      category: 'power',
      description: '3.0V Lithium CR2032 button battery',
      tags: ['battery', 'coin', 'cr2032', '3v', 'cell'],
      width: 80,
      height: 40,
      defaultDesignator: 'BT',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'spice',
        defaultSpiceParams: { V: 3.0, Rser: 15 },
      },
      pins: [
        { id: 'pos', label: '+', x: 80, y: 20, direction: 'output' },
        { id: 'neg', label: '-', x: 0, y: 20, direction: 'passive' },
      ],
      defaultProperties: { voltage: 3.0, capacityMah: 220 },
      propertySchema: [
        { key: 'voltage', label: 'Cell Voltage', type: 'number', unit: 'V', min: 1.5, max: 3.6, step: 0.1 },
      ],
    });

    // ==========================================
    // 2. PASSIVES
    // ==========================================
    this.registerComponent({
      id: 'resistor',
      name: 'Resistor',
      category: 'passives',
      description: 'Current limiting and voltage dividing passive element with 4 color bands',
      tags: ['resistor', 'resistance', 'ohm', 'passive', 'load'],
      width: 80,
      height: 40,
      defaultDesignator: 'R',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'spice',
        defaultSpiceParams: { R: 1000 },
      },
      pins: [
        { id: 'p1', label: 'Pin 1', x: 0, y: 20, direction: 'passive' },
        { id: 'p2', label: 'Pin 2', x: 80, y: 20, direction: 'passive' },
      ],
      defaultProperties: { resistance: 1000, unit: 'Ω', tolerance: 5, powerRating: 0.25 },
      propertySchema: [
        { key: 'resistance', label: 'Resistance', type: 'number', unit: 'Ω', min: 0.1, max: 10000000, step: 10 },
        {
          key: 'tolerance',
          label: 'Tolerance',
          type: 'select',
          options: [
            { label: '±1% (Brown)', value: 1 },
            { label: '±2% (Red)', value: 2 },
            { label: '±5% (Gold)', value: 5 },
            { label: '±10% (Silver)', value: 10 },
          ],
        },
      ],
    });

    this.registerComponent({
      id: 'capacitor-ceramic',
      name: 'Ceramic Capacitor',
      category: 'passives',
      description: 'Non-polarized high frequency decoupling capacitor',
      tags: ['capacitor', 'cap', 'ceramic', 'decoupling', 'filter'],
      width: 80,
      height: 40,
      defaultDesignator: 'C',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'spice',
        defaultSpiceParams: { C: 100e-9 },
      },
      pins: [
        { id: 'p1', label: 'Pin 1', x: 0, y: 20, direction: 'passive' },
        { id: 'p2', label: 'Pin 2', x: 80, y: 20, direction: 'passive' },
      ],
      defaultProperties: { capacitance: 100, unit: 'nF', maxVoltage: 50 },
      propertySchema: [
        { key: 'capacitance', label: 'Capacitance', type: 'number', unit: 'nF', min: 0.001, max: 100000, step: 10 },
      ],
    });

    this.registerComponent({
      id: 'capacitor-electrolytic',
      name: 'Electrolytic Capacitor',
      category: 'passives',
      description: 'Polarized bulk storage and smoothing capacitor',
      tags: ['capacitor', 'electrolytic', 'polarized', 'bulk', 'filter'],
      width: 80,
      height: 40,
      defaultDesignator: 'C',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'spice',
        defaultSpiceParams: { C: 10e-6 },
      },
      pins: [
        { id: 'pos', label: '+', x: 80, y: 20, direction: 'passive', description: 'Anode (+)' },
        { id: 'neg', label: '-', x: 0, y: 20, direction: 'passive', description: 'Cathode (-)' },
      ],
      defaultProperties: { capacitance: 10, unit: 'µF', maxVoltage: 25 },
      propertySchema: [
        { key: 'capacitance', label: 'Capacitance', type: 'number', unit: 'µF', min: 0.1, max: 10000, step: 1 },
      ],
    });

    this.registerComponent({
      id: 'inductor',
      name: 'Inductor / Choke',
      category: 'passives',
      description: 'Magnetic energy storage choke for filtering and resonance',
      tags: ['inductor', 'coil', 'choke', 'henry', 'magnetic'],
      width: 80,
      height: 40,
      defaultDesignator: 'L',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'spice',
        defaultSpiceParams: { L: 10e-3, Dcr: 0.5 },
      },
      pins: [
        { id: 'p1', label: 'Pin 1', x: 0, y: 20, direction: 'passive' },
        { id: 'p2', label: 'Pin 2', x: 80, y: 20, direction: 'passive' },
      ],
      defaultProperties: { inductance: 10, unit: 'mH', dcr: 0.5 },
      propertySchema: [
        { key: 'inductance', label: 'Inductance', type: 'number', unit: 'mH', min: 0.001, max: 1000, step: 1 },
      ],
    });

    this.registerComponent({
      id: 'potentiometer',
      name: 'Potentiometer',
      category: 'passives',
      description: '3-Terminal variable resistor with adjustable wiper dial',
      tags: ['pot', 'variable', 'resistor', 'trimmer', 'wiper', 'analog'],
      width: 80,
      height: 80,
      defaultDesignator: 'RV',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'spice',
        defaultSpiceParams: { Rtot: 10000, Pos: 0.5 },
      },
      pins: [
        { id: 't1', label: 'Pin 1 (CCW)', x: 0, y: 40, direction: 'passive' },
        { id: 'wiper', label: 'Wiper', x: 40, y: 0, direction: 'passive' },
        { id: 't2', label: 'Pin 2 (CW)', x: 80, y: 40, direction: 'passive' },
      ],
      defaultProperties: { maxResistance: 10000, position: 50, taper: 'linear' },
      propertySchema: [
        { key: 'maxResistance', label: 'Total Resistance', type: 'number', unit: 'Ω', min: 100, max: 1000000, step: 500 },
        { key: 'position', label: 'Wiper Position', type: 'number', unit: '%', min: 0, max: 100, step: 1 },
      ],
    });

    // ==========================================
    // 3. SEMICONDUCTORS
    // ==========================================
    this.registerComponent({
      id: 'diode',
      name: 'Diode (1N4007 / 1N4148)',
      category: 'semiconductors',
      description: 'PN junction semiconductor diode for rectification',
      tags: ['diode', 'rectifier', '1n4007', '1n4148', 'semiconductor'],
      width: 80,
      height: 40,
      defaultDesignator: 'D',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'spice',
        defaultSpiceParams: { Is: 1e-14, N: 1.0, Vf: 0.7 },
      },
      pins: [
        { id: 'anode', label: 'Anode (+)', x: 0, y: 20, direction: 'passive' },
        { id: 'cathode', label: 'Cathode (-)', x: 80, y: 20, direction: 'passive' },
      ],
      defaultProperties: { forwardVoltage: 0.7, maxCurrent: 1.0 },
      propertySchema: [
        { key: 'forwardVoltage', label: 'Forward Drop Vf', type: 'number', unit: 'V', min: 0.2, max: 2.5, step: 0.05 },
      ],
    });

    this.registerComponent({
      id: 'zener-diode',
      name: 'Zener Diode',
      category: 'semiconductors',
      description: 'Voltage regulator diode with controlled reverse breakdown',
      tags: ['zener', 'diode', 'regulator', 'breakdown', 'reference'],
      width: 80,
      height: 40,
      defaultDesignator: 'ZD',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'spice',
        defaultSpiceParams: { Vz: 5.1 },
      },
      pins: [
        { id: 'anode', label: 'Anode (+)', x: 0, y: 20, direction: 'passive' },
        { id: 'cathode', label: 'Cathode (-)', x: 80, y: 20, direction: 'passive' },
      ],
      defaultProperties: { zenerVoltage: 5.1, powerLimit: 0.5 },
      propertySchema: [
        { key: 'zenerVoltage', label: 'Zener Breakdown Vz', type: 'number', unit: 'V', min: 2.4, max: 36, step: 0.1 },
      ],
    });

    this.registerComponent({
      id: 'transistor-npn',
      name: 'NPN Transistor (2N2222)',
      category: 'semiconductors',
      description: 'Bipolar junction transistor for switching and amplification',
      tags: ['npn', 'bjt', 'transistor', '2n2222', 'switch', 'amplifier'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'Q',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'spice',
        defaultSpiceParams: { Bf: 100, Vaf: 100 },
      },
      pins: [
        { id: 'base', label: 'Base (B)', x: -40, y: 0, direction: 'input' },
        { id: 'collector', label: 'Collector (C)', x: 0, y: -40, direction: 'passive' },
        { id: 'emitter', label: 'Emitter (E)', x: 0, y: 40, direction: 'passive' },
      ],
      defaultProperties: { gainHfe: 100, vceSat: 0.2 },
      propertySchema: [
        { key: 'gainHfe', label: 'DC Current Gain (hFE)', type: 'number', min: 10, max: 800, step: 10 },
      ],
    });

    this.registerComponent({
      id: 'mosfet-n',
      name: 'N-Channel MOSFET',
      category: 'semiconductors',
      description: 'Voltage-controlled switch with ultra-low ON resistance',
      tags: ['mosfet', 'n-channel', 'fet', 'transistor', 'power', 'switch'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'M',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'spice',
        defaultSpiceParams: { Vto: 2.5, RdsOn: 0.05 },
      },
      pins: [
        { id: 'gate', label: 'Gate (G)', x: -40, y: 0, direction: 'input' },
        { id: 'drain', label: 'Drain (D)', x: 0, y: -40, direction: 'passive' },
        { id: 'source', label: 'Source (S)', x: 0, y: 40, direction: 'passive' },
      ],
      defaultProperties: { vth: 2.5, rdsOn: 0.05 },
      propertySchema: [
        { key: 'vth', label: 'Threshold Vth', type: 'number', unit: 'V', min: 1.0, max: 5.0, step: 0.1 },
      ],
    });

    this.registerComponent({
      id: 'opamp',
      name: 'Operational Amplifier (LM358)',
      category: 'semiconductors',
      description: 'High gain differential operational amplifier',
      tags: ['opamp', 'amplifier', 'lm358', 'comparator', 'analog'],
      width: 80,
      height: 80,
      defaultDesignator: 'U',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'spice',
        defaultSpiceParams: { Aol: 100000, Slew: 0.5 },
      },
      pins: [
        { id: 'in_neg', label: 'IN- (Inverting)', x: 0, y: 20, direction: 'input' },
        { id: 'in_pos', label: 'IN+ (Non-Inverting)', x: 0, y: 60, direction: 'input' },
        { id: 'out', label: 'OUT', x: 80, y: 40, direction: 'output' },
        { id: 'v_pos', label: 'VCC (+)', x: 40, y: 0, direction: 'passive' },
        { id: 'v_neg', label: 'GND / VEE (-)', x: 40, y: 80, direction: 'passive' },
      ],
      defaultProperties: { openLoopGain: 100000, slewRate: 0.5 },
      propertySchema: [
        { key: 'openLoopGain', label: 'Open Loop Gain', type: 'number', min: 1000, max: 1000000, step: 10000 },
      ],
    });

    // ==========================================
    // 4. LOGIC GATES
    // ==========================================
    this.registerComponent({
      id: 'gate-and',
      name: 'AND Gate',
      category: 'logic',
      description: 'Digital 2-input AND logic gate (Y = A · B)',
      tags: ['and', 'logic', 'gate', 'boolean', 'digital', '7408'],
      width: 80,
      height: 80,
      defaultDesignator: 'U',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'logical',
        logicFunction: 'A && B',
      },
      pins: [
        { id: 'in_a', label: 'Input A', x: 0, y: 20, direction: 'input' },
        { id: 'in_b', label: 'Input B', x: 0, y: 60, direction: 'input' },
        { id: 'out', label: 'Output Y', x: 80, y: 40, direction: 'output' },
      ],
      defaultProperties: { propagationDelayNs: 10 },
    });

    this.registerComponent({
      id: 'gate-or',
      name: 'OR Gate',
      category: 'logic',
      description: 'Digital 2-input OR logic gate (Y = A + B)',
      tags: ['or', 'logic', 'gate', 'boolean', 'digital', '7432'],
      width: 80,
      height: 80,
      defaultDesignator: 'U',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'logical',
        logicFunction: 'A || B',
      },
      pins: [
        { id: 'in_a', label: 'Input A', x: 0, y: 20, direction: 'input' },
        { id: 'in_b', label: 'Input B', x: 0, y: 60, direction: 'input' },
        { id: 'out', label: 'Output Y', x: 80, y: 40, direction: 'output' },
      ],
      defaultProperties: { propagationDelayNs: 10 },
    });

    this.registerComponent({
      id: 'gate-not',
      name: 'NOT Gate (Inverter)',
      category: 'logic',
      description: 'Digital single input inverter (Y = ¬A)',
      tags: ['not', 'inverter', 'logic', 'gate', 'boolean', '7404'],
      width: 80,
      height: 80,
      defaultDesignator: 'U',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'logical',
        logicFunction: '!A',
      },
      pins: [
        { id: 'in', label: 'Input A', x: 0, y: 40, direction: 'input' },
        { id: 'out', label: 'Output Y', x: 80, y: 40, direction: 'output' },
      ],
      defaultProperties: { propagationDelayNs: 8 },
    });

    this.registerComponent({
      id: 'gate-nand',
      name: 'NAND Gate',
      category: 'logic',
      description: 'Digital 2-input NAND logic gate (Y = ¬(A · B))',
      tags: ['nand', 'universal', 'logic', 'gate', '7400'],
      width: 80,
      height: 80,
      defaultDesignator: 'U',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'logical',
        logicFunction: '!(A && B)',
      },
      pins: [
        { id: 'in_a', label: 'Input A', x: 0, y: 20, direction: 'input' },
        { id: 'in_b', label: 'Input B', x: 0, y: 60, direction: 'input' },
        { id: 'out', label: 'Output Y', x: 80, y: 40, direction: 'output' },
      ],
      defaultProperties: { propagationDelayNs: 10 },
    });

    this.registerComponent({
      id: 'gate-nor',
      name: 'NOR Gate',
      category: 'logic',
      description: 'Digital 2-input NOR logic gate (Y = ¬(A + B))',
      tags: ['nor', 'universal', 'logic', 'gate', '7402'],
      width: 80,
      height: 80,
      defaultDesignator: 'U',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'logical',
        logicFunction: '!(A || B)',
      },
      pins: [
        { id: 'in_a', label: 'Input A', x: 0, y: 20, direction: 'input' },
        { id: 'in_b', label: 'Input B', x: 0, y: 60, direction: 'input' },
        { id: 'out', label: 'Output Y', x: 80, y: 40, direction: 'output' },
      ],
      defaultProperties: { propagationDelayNs: 10 },
    });

    this.registerComponent({
      id: 'gate-xor',
      name: 'XOR Gate',
      category: 'logic',
      description: 'Digital 2-input Exclusive-OR logic gate (Y = A ⊕ B)',
      tags: ['xor', 'parity', 'adder', 'logic', 'gate', '7486'],
      width: 80,
      height: 80,
      defaultDesignator: 'U',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'logical',
        logicFunction: 'A !== B',
      },
      pins: [
        { id: 'in_a', label: 'Input A', x: 0, y: 20, direction: 'input' },
        { id: 'in_b', label: 'Input B', x: 0, y: 60, direction: 'input' },
        { id: 'out', label: 'Output Y', x: 80, y: 40, direction: 'output' },
      ],
      defaultProperties: { propagationDelayNs: 12 },
    });

    this.registerComponent({
      id: 'gate-xnor',
      name: 'XNOR Gate',
      category: 'logic',
      description: 'Digital 2-input Exclusive-NOR logic gate (Y = ¬(A ⊕ B))',
      tags: ['xnor', 'equivalence', 'parity', 'logic', 'gate', '74266'],
      width: 80,
      height: 80,
      defaultDesignator: 'U',
      renderType: 'composite_shapes',
      simulationModel: {
        type: 'logical',
        logicFunction: 'A === B',
      },
      pins: [
        { id: 'in_a', label: 'Input A', x: 0, y: 20, direction: 'input' },
        { id: 'in_b', label: 'Input B', x: 0, y: 60, direction: 'input' },
        { id: 'out', label: 'Output Y', x: 80, y: 40, direction: 'output' },
      ],
      defaultProperties: { propagationDelayNs: 12 },
    });

    this.registerComponent({
      id: 'display-7seg',
      name: '7-Segment Display',
      category: 'logic',
      description: 'Standard 7-segment LED numeric display with decimal point',
      tags: ['display', '7seg', 'led', 'counter', 'digits'],
      width: 80,
      height: 120,
      defaultDesignator: 'DISP',
      renderType: 'composite_shapes',
      simulationModel: { type: 'logical' },
      pins: [
        { id: 'pin_a', label: 'A', x: 20, y: 0, direction: 'input' },
        { id: 'pin_b', label: 'B', x: 40, y: 0, direction: 'input' },
        { id: 'pin_c', label: 'C', x: 60, y: 0, direction: 'input' },
        { id: 'com1', label: 'COM', x: 80, y: 20, direction: 'passive' },
        { id: 'pin_d', label: 'D', x: 60, y: 120, direction: 'input' },
        { id: 'pin_e', label: 'E', x: 40, y: 120, direction: 'input' },
        { id: 'pin_f', label: 'F', x: 20, y: 120, direction: 'input' },
        { id: 'pin_g', label: 'G', x: 0, y: 40, direction: 'input' },
        { id: 'pin_dp', label: 'DP', x: 0, y: 80, direction: 'input' },
      ],
      defaultProperties: { type: 'common-cathode', color: '#ef4444' },
    });

    this.registerComponent({
      id: 'ic-555',
      name: '555 Precision Timer IC',
      category: 'logic',
      description: 'Precision timer IC for astable oscillators and monostable pulses',
      tags: ['555', 'timer', 'oscillator', 'pulse', 'clock', 'pwm', 'ne555'],
      width: 80,
      height: 120,
      defaultDesignator: 'IC',
      renderType: 'composite_shapes',
      simulationModel: { type: 'subcircuit' },
      pins: [
        { id: 'pin1_gnd', label: '1: GND', x: 0, y: 20, direction: 'passive' },
        { id: 'pin2_trig', label: '2: TRIG', x: 0, y: 40, direction: 'input' },
        { id: 'pin3_out', label: '3: OUT', x: 0, y: 60, direction: 'output' },
        { id: 'pin4_rst', label: '4: RESET', x: 0, y: 80, direction: 'input' },
        { id: 'pin8_vcc', label: '8: VCC', x: 80, y: 20, direction: 'passive' },
        { id: 'pin7_disch', label: '7: DISCH', x: 80, y: 40, direction: 'passive' },
        { id: 'pin6_thres', label: '6: THRES', x: 80, y: 60, direction: 'input' },
        { id: 'pin5_ctrl', label: '5: CTRL', x: 80, y: 80, direction: 'passive' },
      ],
      defaultProperties: {},
    });

    // ==========================================
    // 5. MICROCONTROLLERS
    // ==========================================
    this.registerComponent({
      id: 'arduino-uno',
      name: 'Arduino Uno R3',
      category: 'mcu',
      description: 'ATmega328P 8-bit MCU board with authentic header layout (32 pins centered at 0,0 on 20px grid)',
      tags: ['arduino', 'uno', 'atmega328p', 'mcu', 'microcontroller', 'embedded'],
      width: 400,
      height: 200,
      origin: 'center',
      defaultDesignator: 'MCU',
      renderType: 'composite_shapes',
      simulationModel: { type: 'script', scriptCode: 'void setup() {} void loop() {}' },
      pins: [
        // Top Edge Header (y = -100, 18 pins total, spaced every 20px)
        // Left Upper Header (10 pins at y = -100):
        { id: 'scl', label: 'SCL', x: -180, y: -100, direction: 'bidirectional' },
        { id: 'sda', label: 'SDA', x: -160, y: -100, direction: 'bidirectional' },
        { id: 'aref', label: 'AREF', x: -140, y: -100, direction: 'input' },
        { id: 'gnd1', label: 'GND', x: -120, y: -100, direction: 'passive' },
        { id: 'd13', label: '13', x: -100, y: -100, direction: 'bidirectional' },
        { id: 'd12', label: '12', x: -80, y: -100, direction: 'bidirectional' },
        { id: 'd11', label: '~11', x: -60, y: -100, direction: 'bidirectional' },
        { id: 'd10', label: '~10', x: -40, y: -100, direction: 'bidirectional' },
        { id: 'd9', label: '~9', x: -20, y: -100, direction: 'bidirectional' },
        { id: 'd8', label: '8', x: 0, y: -100, direction: 'bidirectional' },
        // Right Upper Header (8 pins at y = -100, after a 40px gap):
        { id: 'd7', label: '7', x: 40, y: -100, direction: 'bidirectional' },
        { id: 'd6', label: '~6', x: 60, y: -100, direction: 'bidirectional' },
        { id: 'd5', label: '~5', x: 80, y: -100, direction: 'bidirectional' },
        { id: 'd4', label: '4', x: 100, y: -100, direction: 'bidirectional' },
        { id: 'd3', label: '~3', x: 120, y: -100, direction: 'bidirectional' },
        { id: 'd2', label: '2', x: 140, y: -100, direction: 'bidirectional' },
        { id: 'd1', label: 'TX1', x: 160, y: -100, direction: 'bidirectional' },
        { id: 'd0', label: 'RX0', x: 180, y: -100, direction: 'bidirectional' },

        // Bottom Edge Header (y = +100, 14 pins total, spaced every 20px)
        // Left Lower Power Header (8 pins at y = +100):
        { id: 'nc', label: 'NC', x: -140, y: 100, direction: 'passive' },
        { id: 'ioref', label: 'IOR', x: -120, y: 100, direction: 'output' },
        { id: 'reset', label: 'RST', x: -100, y: 100, direction: 'input' },
        { id: '3v3', label: '3V3', x: -80, y: 100, direction: 'output' },
        { id: '5v', label: '5V', x: -60, y: 100, direction: 'output' },
        { id: 'gnd2', label: 'GND', x: -40, y: 100, direction: 'passive' },
        { id: 'gnd3', label: 'GND', x: -20, y: 100, direction: 'passive' },
        { id: 'vin', label: 'VIN', x: 0, y: 100, direction: 'input' },
        // Right Lower Analog Header (6 pins at y = +100, after an 80px gap):
        { id: 'a0', label: 'A0', x: 80, y: 100, direction: 'input' },
        { id: 'a1', label: 'A1', x: 100, y: 100, direction: 'input' },
        { id: 'a2', label: 'A2', x: 120, y: 100, direction: 'input' },
        { id: 'a3', label: 'A3', x: 140, y: 100, direction: 'input' },
        { id: 'a4', label: 'A4', x: 160, y: 100, direction: 'input' },
        { id: 'a5', label: 'A5', x: 180, y: 100, direction: 'input' },
      ],
      defaultProperties: { clockFreqMhz: 16, firmware: 'blink.ino' },
    });

    this.registerComponent({
      id: 'esp32',
      name: 'ESP32 DevKit V1',
      category: 'mcu',
      description: 'Dual-core Xtensa LX6 30-pin board with WiFi and Bluetooth (centered at 0,0 on 20px grid)',
      tags: ['esp32', 'wifi', 'bluetooth', 'iot', 'mcu', 'espressif'],
      width: 120,
      height: 320,
      origin: 'center',
      defaultDesignator: 'ESP',
      renderType: 'composite_shapes',
      simulationModel: { type: 'script' },
      pins: [
        // Left Pin Row (15 pins along x = -60, y = -140 + i * 20)
        { id: '3v3', label: '3V3', x: -60, y: -140, direction: 'output' },
        { id: 'gnd1', label: 'GND', x: -60, y: -120, direction: 'passive' },
        { id: 'd15', label: 'D15', x: -60, y: -100, direction: 'bidirectional' },
        { id: 'd2', label: 'D2', x: -60, y: -80, direction: 'bidirectional' },
        { id: 'd4', label: 'D4', x: -60, y: -60, direction: 'bidirectional' },
        { id: 'rx2', label: 'RX2', x: -60, y: -40, direction: 'input' },
        { id: 'tx2', label: 'TX2', x: -60, y: -20, direction: 'output' },
        { id: 'd5', label: 'D5', x: -60, y: 0, direction: 'bidirectional' },
        { id: 'd18', label: 'D18', x: -60, y: 20, direction: 'bidirectional' },
        { id: 'd19', label: 'D19', x: -60, y: 40, direction: 'bidirectional' },
        { id: 'd21', label: 'D21', x: -60, y: 60, direction: 'bidirectional' },
        { id: 'rx0', label: 'RX0', x: -60, y: 80, direction: 'input' },
        { id: 'tx0', label: 'TX0', x: -60, y: 100, direction: 'output' },
        { id: 'd22', label: 'D22', x: -60, y: 120, direction: 'bidirectional' },
        { id: 'd23', label: 'D23', x: -60, y: 140, direction: 'bidirectional' },

        // Right Pin Row (15 pins along x = +60, y = -140 + i * 20)
        { id: 'vin', label: 'VIN', x: 60, y: -140, direction: 'input' },
        { id: 'gnd2', label: 'GND', x: 60, y: -120, direction: 'passive' },
        { id: 'd13', label: 'D13', x: 60, y: -100, direction: 'bidirectional' },
        { id: 'd12', label: 'D12', x: 60, y: -80, direction: 'bidirectional' },
        { id: 'd14', label: 'D14', x: 60, y: -60, direction: 'bidirectional' },
        { id: 'd27', label: 'D27', x: 60, y: -40, direction: 'bidirectional' },
        { id: 'd26', label: 'D26', x: 60, y: -20, direction: 'bidirectional' },
        { id: 'd25', label: 'D25', x: 60, y: 0, direction: 'bidirectional' },
        { id: 'd33', label: 'D33', x: 60, y: 20, direction: 'bidirectional' },
        { id: 'd32', label: 'D32', x: 60, y: 40, direction: 'bidirectional' },
        { id: 'd35', label: 'D35', x: 60, y: 60, direction: 'input' },
        { id: 'd34', label: 'D34', x: 60, y: 80, direction: 'input' },
        { id: 'vn', label: 'VN', x: 60, y: 100, direction: 'input' },
        { id: 'vp', label: 'VP', x: 60, y: 120, direction: 'input' },
        { id: 'en', label: 'EN', x: 60, y: 140, direction: 'input' },
      ],
      defaultProperties: { clockFreqMhz: 240 },
    });

    this.registerComponent({
      id: 'pico',
      name: 'Raspberry Pi Pico',
      category: 'mcu',
      description: 'RP2040 Dual ARM Cortex-M0+ MCU board with authentic 40-pin layout (centered at 0,0 on 20px grid pitch)',
      tags: ['pico', 'rp2040', 'raspberry', 'arm', 'mcu', 'embedded'],
      width: 120,
      height: 420,
      origin: 'center',
      defaultDesignator: 'PICO',
      renderType: 'composite_shapes',
      simulationModel: { type: 'script' },
      pins: [
        // Left Pin Row (20 pins along x = -60, y = -190 + i * 20)
        { id: 'gp0', label: 'GP0', x: -60, y: -190, direction: 'bidirectional' },
        { id: 'gp1', label: 'GP1', x: -60, y: -170, direction: 'bidirectional' },
        { id: 'gnd1', label: 'GND', x: -60, y: -150, direction: 'passive' },
        { id: 'gp2', label: 'GP2', x: -60, y: -130, direction: 'bidirectional' },
        { id: 'gp3', label: 'GP3', x: -60, y: -110, direction: 'bidirectional' },
        { id: 'gp4', label: 'GP4', x: -60, y: -90, direction: 'bidirectional' },
        { id: 'gp5', label: 'GP5', x: -60, y: -70, direction: 'bidirectional' },
        { id: 'gnd2', label: 'GND', x: -60, y: -50, direction: 'passive' },
        { id: 'gp6', label: 'GP6', x: -60, y: -30, direction: 'bidirectional' },
        { id: 'gp7', label: 'GP7', x: -60, y: -10, direction: 'bidirectional' },
        { id: 'gp8', label: 'GP8', x: -60, y: 10, direction: 'bidirectional' },
        { id: 'gp9', label: 'GP9', x: -60, y: 30, direction: 'bidirectional' },
        { id: 'gnd3', label: 'GND', x: -60, y: 50, direction: 'passive' },
        { id: 'gp10', label: 'GP10', x: -60, y: 70, direction: 'bidirectional' },
        { id: 'gp11', label: 'GP11', x: -60, y: 90, direction: 'bidirectional' },
        { id: 'gp12', label: 'GP12', x: -60, y: 110, direction: 'bidirectional' },
        { id: 'gp13', label: 'GP13', x: -60, y: 130, direction: 'bidirectional' },
        { id: 'gnd4', label: 'GND', x: -60, y: 150, direction: 'passive' },
        { id: 'gp14', label: 'GP14', x: -60, y: 170, direction: 'bidirectional' },
        { id: 'gp15', label: 'GP15', x: -60, y: 190, direction: 'bidirectional' },

        // Right Pin Row (20 pins along x = +60, y = -190 + i * 20)
        { id: 'vbus', label: 'VBUS', x: 60, y: -190, direction: 'input' },
        { id: 'vsys', label: 'VSYS', x: 60, y: -170, direction: 'input' },
        { id: 'gnd5', label: 'GND', x: 60, y: -150, direction: 'passive' },
        { id: '3v3_en', label: '3V3_EN', x: 60, y: -130, direction: 'input' },
        { id: '3v3', label: '3V3', x: 60, y: -110, direction: 'output' },
        { id: 'vref', label: 'VREF', x: 60, y: -90, direction: 'input' },
        { id: 'gp28', label: 'GP28', x: 60, y: -70, direction: 'bidirectional' },
        { id: 'gnd6', label: 'GND', x: 60, y: -50, direction: 'passive' },
        { id: 'gp27', label: 'GP27', x: 60, y: -30, direction: 'bidirectional' },
        { id: 'gp26', label: 'GP26', x: 60, y: -10, direction: 'bidirectional' },
        { id: 'run', label: 'RUN', x: 60, y: 10, direction: 'input' },
        { id: 'gp22', label: 'GP22', x: 60, y: 30, direction: 'bidirectional' },
        { id: 'gnd7', label: 'GND', x: 60, y: 50, direction: 'passive' },
        { id: 'gp21', label: 'GP21', x: 60, y: 70, direction: 'bidirectional' },
        { id: 'gp20', label: 'GP20', x: 60, y: 90, direction: 'bidirectional' },
        { id: 'gp19', label: 'GP19', x: 60, y: 110, direction: 'bidirectional' },
        { id: 'gp18', label: 'GP18', x: 60, y: 130, direction: 'bidirectional' },
        { id: 'gnd8', label: 'GND', x: 60, y: 150, direction: 'passive' },
        { id: 'gp17', label: 'GP17', x: 60, y: 170, direction: 'bidirectional' },
        { id: 'gp16', label: 'GP16', x: 60, y: 190, direction: 'bidirectional' },
      ],
      defaultProperties: { clockFreqMhz: 133 },
    });

    // ==========================================
    // 6. SENSORS (Interactive Inputs)
    // ==========================================
    this.registerComponent({
      id: 'pushbutton',
      name: 'Pushbutton (Tactile Switch)',
      category: 'sensors',
      description: 'Momentary normally open push-to-make tactile button',
      tags: ['button', 'push', 'switch', 'tactile', 'input', 'momentary'],
      width: 80,
      height: 40,
      defaultDesignator: 'SW',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'p1', label: 'Terminal 1', x: 0, y: 20, direction: 'passive' },
        { id: 'p2', label: 'Terminal 2', x: 80, y: 20, direction: 'passive' },
      ],
      defaultProperties: { isPressed: false },
      propertySchema: [{ key: 'isPressed', label: 'Pressed State', type: 'boolean' }],
    });

    this.registerComponent({
      id: 'toggle-switch',
      name: 'Toggle Switch (SPDT)',
      category: 'sensors',
      description: 'Single pole double throw latching toggle switch',
      tags: ['switch', 'toggle', 'spdt', 'input', 'latch'],
      width: 80,
      height: 80,
      defaultDesignator: 'SW',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'com', label: 'Common (COM)', x: 0, y: 40, direction: 'passive' },
        { id: 't1', label: 'Throw 1 (NO)', x: 80, y: 20, direction: 'passive' },
        { id: 't2', label: 'Throw 2 (NC)', x: 80, y: 60, direction: 'passive' },
      ],
      defaultProperties: { state: 'T1' },
      propertySchema: [
        {
          key: 'state',
          label: 'Position',
          type: 'select',
          options: [
            { label: 'Position 1 (Up)', value: 'T1' },
            { label: 'Position 2 (Down)', value: 'T2' },
          ],
        },
      ],
    });

    this.registerComponent({
      id: 'temp-sensor',
      name: 'Temperature Sensor (TMP36)',
      category: 'sensors',
      description: 'Analog linear temperature sensor (10mV/°C, 500mV @ 0°C)',
      tags: ['temp', 'temperature', 'tmp36', 'ntc', 'sensor', 'analog'],
      width: 80,
      height: 40,
      defaultDesignator: 'TMP',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'vcc', label: 'VCC', x: 0, y: 20, direction: 'passive' },
        { id: 'vout', label: 'VOUT', x: 40, y: 0, direction: 'output' },
        { id: 'gnd', label: 'GND', x: 80, y: 20, direction: 'passive' },
      ],
      defaultProperties: { temperatureC: 25 },
      propertySchema: [
        { key: 'temperatureC', label: 'Temperature', type: 'number', unit: '°C', min: -40, max: 125, step: 1 },
      ],
    });

    this.registerComponent({
      id: 'light-sensor',
      name: 'Light Sensor (LDR Photoresistor)',
      category: 'sensors',
      description: 'Cadmium-sulfide photoresistor whose resistance decreases with light',
      tags: ['ldr', 'light', 'photoresistor', 'lux', 'sensor'],
      width: 80,
      height: 40,
      defaultDesignator: 'LDR',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'p1', label: 'Terminal 1', x: 0, y: 20, direction: 'passive' },
        { id: 'p2', label: 'Terminal 2', x: 80, y: 20, direction: 'passive' },
      ],
      defaultProperties: { lux: 100, threshold: 500 },
      propertySchema: [
        { key: 'lux', label: 'Ambient Lux', type: 'number', unit: 'lx', min: 1, max: 50000, step: 50 },
        { key: 'threshold', label: 'Trigger Lux Threshold', type: 'number', unit: 'lx', min: 10, max: 10000, step: 50 },
      ],
    });

    this.registerComponent({
      id: 'ultrasonic',
      name: 'Ultrasonic Distance Sensor (HC-SR04)',
      category: 'sensors',
      description: 'Sonar distance measuring module (2cm to 400cm)',
      tags: ['ultrasonic', 'sonar', 'distance', 'hcsr04', 'range', 'sensor'],
      width: 100,
      height: 60,
      defaultDesignator: 'SONAR',
      renderType: 'composite_shapes',
      simulationModel: { type: 'script' },
      pins: [
        { id: 'vcc', label: 'VCC (+5V)', x: 20, y: 60, direction: 'passive' },
        { id: 'trig', label: 'TRIG', x: 40, y: 60, direction: 'input' },
        { id: 'echo', label: 'ECHO', x: 60, y: 60, direction: 'output' },
        { id: 'gnd', label: 'GND', x: 80, y: 60, direction: 'passive' },
      ],
      defaultProperties: { distanceCm: 50 },
      propertySchema: [
        { key: 'distanceCm', label: 'Object Distance', type: 'number', unit: 'cm', min: 2, max: 400, step: 1 },
      ],
    });

    // ==========================================
    // 7. OUTPUTS & ACTUATORS
    // ==========================================
    const createLedDef = (colorName: string, hex: string, id: string) => ({
      id,
      name: `LED (${colorName} 5mm)`,
      category: 'outputs' as ComponentRegistryCategory,
      description: `Standard 5mm high-efficiency ${colorName.toLowerCase()} light emitting diode`,
      tags: ['led', 'light', colorName.toLowerCase(), 'diode', 'indicator', 'output'],
      width: 80,
      height: 40,
      defaultDesignator: 'LED',
      renderType: 'composite_shapes' as const,
      simulationModel: {
        type: 'spice' as const,
        defaultSpiceParams: { Vf: 2.0, IfMax: 0.02 },
      },
      pins: [
        { id: 'anode', label: 'Anode (+)', x: 0, y: 20, direction: 'passive' as PinDirection },
        { id: 'cathode', label: 'Cathode (-)', x: 80, y: 20, direction: 'passive' as PinDirection },
      ],
      defaultProperties: { color: hex, forwardVoltage: 2.0, maxCurrentMa: 20, lit: true, brightness: 100 },
      propertySchema: [
        { key: 'forwardVoltage', label: 'Vf', type: 'number' as const, unit: 'V', min: 1.6, max: 3.5, step: 0.1 },
      ],
    });

    this.registerComponent(createLedDef('Red', '#ef4444', 'led-red'));
    this.registerComponent(createLedDef('Green', '#22c55e', 'led-green'));
    this.registerComponent(createLedDef('Blue', '#3b82f6', 'led-blue'));
    this.registerComponent(createLedDef('Yellow', '#eab308', 'led-yellow'));

    this.registerComponent({
      id: 'led-rgb',
      name: 'RGB LED (Common Cathode)',
      category: 'outputs',
      description: '4-Pin multi-color red-green-blue LED package',
      tags: ['rgb', 'led', 'color', 'light', 'neopixel', 'output'],
      width: 80,
      height: 80,
      defaultDesignator: 'RGB',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'r', label: 'Red Anode', x: 20, y: 80, direction: 'passive' },
        { id: 'cathode', label: 'Common Cathode (GND)', x: 40, y: 80, direction: 'passive' },
        { id: 'g', label: 'Green Anode', x: 60, y: 80, direction: 'passive' },
        { id: 'b', label: 'Blue Anode', x: 80, y: 40, direction: 'passive' },
      ],
      defaultProperties: { colorHex: '#9333ea' },
      propertySchema: [{ key: 'colorHex', label: 'Preview Color', type: 'color' }],
    });

    this.registerComponent({
      id: 'dc-fan',
      name: 'DC Cooling Fan (12V)',
      category: 'outputs',
      description: 'Brushless DC motor cooling fan with rotating impeller',
      tags: ['fan', 'motor', 'dc', 'cooling', 'rpm', 'actuator'],
      width: 80,
      height: 80,
      defaultDesignator: 'FAN',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'pos', label: '+ (12V)', x: 0, y: 20, direction: 'input' },
        { id: 'neg', label: '- (GND)', x: 0, y: 60, direction: 'passive' },
      ],
      defaultProperties: { nominalRpm: 2500, voltage: 12, isRunning: true },
      propertySchema: [
        { key: 'voltage', label: 'Rated Voltage', type: 'number', unit: 'V', min: 5, max: 24, step: 1 },
      ],
    });

    this.registerComponent({
      id: 'buzzer',
      name: 'Piezo Buzzer',
      category: 'outputs',
      description: 'Piezoelectric audio sounder / transducer',
      tags: ['buzzer', 'audio', 'sound', 'beeper', 'speaker', 'piezo'],
      width: 80,
      height: 40,
      defaultDesignator: 'BZ',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'pos', label: '+', x: 0, y: 20, direction: 'passive' },
        { id: 'neg', label: '-', x: 80, y: 20, direction: 'passive' },
      ],
      defaultProperties: { frequencyHz: 2700, splDb: 85 },
      propertySchema: [
        { key: 'frequencyHz', label: 'Resonant Frequency', type: 'number', unit: 'Hz', min: 500, max: 10000, step: 100 },
      ],
    });

    this.registerComponent({
      id: 'relay',
      name: 'Electromechanical Relay Module (5V)',
      category: 'outputs',
      description: 'Single-channel relay with optocoupler isolation (COM, NO, NC)',
      tags: ['relay', 'switch', 'optocoupler', 'high-power', 'actuator', 'spdt'],
      width: 120,
      height: 80,
      defaultDesignator: 'RLY',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'vcc', label: 'VCC (+5V)', x: 0, y: 20, direction: 'passive' },
        { id: 'gnd', label: 'GND', x: 0, y: 40, direction: 'passive' },
        { id: 'in', label: 'IN (Trigger)', x: 0, y: 60, direction: 'input' },
        { id: 'no', label: 'Normally Open (NO)', x: 120, y: 20, direction: 'passive' },
        { id: 'com', label: 'Common (COM)', x: 120, y: 40, direction: 'passive' },
        { id: 'nc', label: 'Normally Closed (NC)', x: 120, y: 60, direction: 'passive' },
      ],
      defaultProperties: { triggerActive: 'LOW', isEngaged: false },
      propertySchema: [{ key: 'isEngaged', label: 'Contact Engaged', type: 'boolean' }],
    });

    // ==========================================
    // 8. ANNOTATIONS (Text Box / Notes)
    // ==========================================
    this.registerComponent({
      id: 'textbox',
      name: 'Text Note / Annotation',
      category: 'annotations',
      description: 'Resizable schematic text note for documentation and labels',
      tags: ['text', 'label', 'note', 'comment', 'annotation', 'sticky'],
      width: 160,
      height: 80,
      defaultDesignator: 'NOTE',
      renderType: 'composite_shapes',
      simulationModel: { type: 'logical' },
      pins: [], // Zero pins: ignored by simulation and wires
      defaultProperties: {
        text: 'Add note here...',
        fontSize: 'md', // sm (12px), md (14px), lg (18px), xl (24px)
        fontWeight: 'normal', // normal, bold
        fontStyle: 'normal', // normal, italic
        color: '#e2e8f0',
        bgStyle: 'sticky-yellow', // transparent, sticky-yellow, sticky-blue, sticky-green, card
        borderStyle: 'dashed', // none, dashed, solid
        boxWidth: 160,
        boxHeight: 80,
      },
    });

    // ==========================================
    // 9. VIRTUAL BENCH INSTRUMENTS
    // ==========================================
    this.registerComponent({
      id: 'multimeter',
      name: 'Digital Multimeter',
      category: 'instruments',
      description: 'Fluke-inspired digital multimeter with DC/AC Volts, Current, Resistance & Continuity',
      tags: ['multimeter', 'dmm', 'voltmeter', 'ammeter', 'ohmmeter', 'tester', 'fluke', 'instrument'],
      width: 80,
      height: 120,
      defaultDesignator: 'DMM',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'v_plus', label: 'VΩmA', x: 20, y: 120, direction: 'passive' },
        { id: 'com', label: 'COM', x: 60, y: 120, direction: 'passive' },
      ],
      defaultProperties: { mode: 'DC_V' },
    });

    this.registerComponent({
      id: 'oscilloscope',
      name: 'Digital Oscilloscope',
      category: 'instruments',
      description: 'Dual-channel digital storage oscilloscope with real-time waveform display',
      tags: ['oscilloscope', 'scope', 'dso', 'waveform', 'signal', 'rigol', 'keysight', 'instrument'],
      width: 140,
      height: 100,
      defaultDesignator: 'OSC',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'ch1', label: 'CH1', x: 20, y: 100, direction: 'passive' },
        { id: 'ch1_gnd', label: 'GND1', x: 40, y: 100, direction: 'passive' },
        { id: 'ch2', label: 'CH2', x: 100, y: 100, direction: 'passive' },
        { id: 'ch2_gnd', label: 'GND2', x: 120, y: 100, direction: 'passive' },
      ],
      defaultProperties: { timebase: 10, vDiv1: 1, vDiv2: 1 },
    });

    this.registerComponent({
      id: 'logic-analyzer',
      name: '8-Channel Logic Analyzer',
      category: 'instruments',
      description: '8-Channel digital protocol & timing analyzer (D0-D7)',
      tags: ['logic', 'analyzer', 'timing', 'digital', 'saleae', 'protocol', 'd0-d7', 'instrument'],
      width: 80,
      height: 200,
      defaultDesignator: 'LA',
      renderType: 'composite_shapes',
      simulationModel: { type: 'logical' },
      pins: [
        { id: 'd0', label: 'D0', x: 80, y: 20, direction: 'input' },
        { id: 'd1', label: 'D1', x: 80, y: 40, direction: 'input' },
        { id: 'd2', label: 'D2', x: 80, y: 60, direction: 'input' },
        { id: 'd3', label: 'D3', x: 80, y: 80, direction: 'input' },
        { id: 'd4', label: 'D4', x: 80, y: 100, direction: 'input' },
        { id: 'd5', label: 'D5', x: 80, y: 120, direction: 'input' },
        { id: 'd6', label: 'D6', x: 80, y: 140, direction: 'input' },
        { id: 'd7', label: 'D7', x: 80, y: 160, direction: 'input' },
        { id: 'gnd', label: 'GND', x: 80, y: 180, direction: 'passive' },
      ],
      defaultProperties: { timeScale: 20 },
    });

    // ==========================================
    // 10. PHASE 7.1 COMPONENT EXPANSION PACK (12 NEW COMPONENTS)
    // ==========================================

    // 1. Humidity Sensor (DHT22 / Capacitive RH Sensor)
    this.registerComponent({
      id: 'builtin_humidity_sensor',
      name: 'Humidity Sensor (DHT22)',
      category: 'sensors',
      description: 'Capacitive relative humidity sensor module (0-100% RH) with digital threshold and analog proportional output',
      tags: ['humidity', 'dht22', 'dht11', 'moisture', 'rh', 'water', 'weather', 'sensor'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'DHT',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'vcc', label: 'VCC', x: -20, y: 40, direction: 'power' },
        { id: 'out', label: 'OUT', x: 0, y: 40, direction: 'output' },
        { id: 'gnd', label: 'GND', x: 20, y: 40, direction: 'ground' },
      ],
      defaultProperties: { humidity: 35, threshold: 60, maxVoltage: 6.5 },
      propertySchema: [
        { key: 'humidity', label: 'Relative Humidity', type: 'number', unit: '% RH', min: 0, max: 100, step: 1 },
        { key: 'threshold', label: 'Digital HIGH Threshold', type: 'number', unit: '% RH', min: 5, max: 95, step: 5 },
      ],
    });

    // 2. DC Brushed Motor
    this.registerComponent({
      id: 'builtin_dc_motor',
      name: 'DC Brushed Motor',
      category: 'outputs',
      description: 'Reversible hobby DC brushed motor with CW/CCW polarity detection and proportional RPM encoder wheel',
      tags: ['motor', 'dc', 'brushed', 'rotor', 'rpm', 'actuator', 'cw', 'ccw'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'MOT',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'm_plus', label: 'M+', x: -20, y: 40, direction: 'passive' },
        { id: 'm_minus', label: 'M-', x: 20, y: 40, direction: 'passive' },
      ],
      defaultProperties: { ratedVoltage: 6, windingResistance: 20, maxVoltage: 18 },
      propertySchema: [
        { key: 'ratedVoltage', label: 'Rated Voltage', type: 'number', unit: 'V', min: 3, max: 12, step: 1 },
        { key: 'windingResistance', label: 'Winding Resistance', type: 'number', unit: 'Ω', min: 5, max: 100, step: 5 },
      ],
    });

    // 3. Servo Motor (SG90 Micro Servo)
    this.registerComponent({
      id: 'builtin_servo_motor',
      name: 'Servo Motor (SG90)',
      category: 'outputs',
      description: '180-degree micro positional servo motor controlled by PWM, MCU Servo.write(angle), or analog voltage',
      tags: ['servo', 'sg90', 'motor', 'pwm', 'angle', 'actuator', 'robotics'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'SRV',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'sig', label: 'SIG', x: -20, y: 40, direction: 'input' },
        { id: 'vcc', label: 'VCC', x: 0, y: 40, direction: 'power' },
        { id: 'gnd', label: 'GND', x: 20, y: 40, direction: 'ground' },
      ],
      defaultProperties: { targetAngle: 90, angle: 0, maxVoltage: 7.5 },
      propertySchema: [
        { key: 'targetAngle', label: 'Target Angle (HIGH)', type: 'number', unit: '°', min: 0, max: 180, step: 5 },
      ],
    });

    // 4. PIR Motion Sensor (HC-SR501)
    this.registerComponent({
      id: 'builtin_motion_sensor',
      name: 'PIR Motion Sensor (HC-SR501)',
      category: 'sensors',
      description: 'Pyroelectric infrared motion detector with Fresnel dome lens and configurable trigger hold time',
      tags: ['pir', 'motion', 'infrared', 'hcsr501', 'security', 'presence', 'sensor'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'PIR',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'vcc', label: 'VCC', x: -20, y: 40, direction: 'power' },
        { id: 'out', label: 'OUT', x: 0, y: 40, direction: 'output' },
        { id: 'gnd', label: 'GND', x: 20, y: 40, direction: 'ground' },
      ],
      defaultProperties: { motionDetected: false, holdTimeMs: 1500 },
      propertySchema: [
        { key: 'motionDetected', label: 'Motion Triggered', type: 'boolean' },
        { key: 'holdTimeMs', label: 'Hold Delay Time', type: 'number', unit: 'ms', min: 200, max: 10000, step: 100 },
      ],
    });

    // 5. Gas / Smoke Sensor (MQ-2)
    this.registerComponent({
      id: 'builtin_gas_sensor',
      name: 'Gas / Smoke Sensor (MQ-2)',
      category: 'sensors',
      description: 'Combustible gas & smoke concentration detector (50-2000 PPM) with Digital (DO) and Analog (AO) outputs',
      tags: ['gas', 'smoke', 'mq2', 'ppm', 'lpg', 'methane', 'alarm', 'sensor'],
      width: 100,
      height: 80,
      origin: 'center',
      defaultDesignator: 'GAS',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'vcc', label: 'VCC', x: -40, y: 40, direction: 'power' },
        { id: 'gnd', label: 'GND', x: -20, y: 40, direction: 'ground' },
        { id: 'do', label: 'DO', x: 20, y: 40, direction: 'output' },
        { id: 'ao', label: 'AO', x: 40, y: 40, direction: 'output' },
      ],
      defaultProperties: { ppm: 50, threshold: 400, maxVoltage: 6.5 },
      propertySchema: [
        { key: 'ppm', label: 'Gas Concentration', type: 'number', unit: 'ppm', min: 50, max: 2000, step: 25 },
        { key: 'threshold', label: 'DO Alarm Threshold', type: 'number', unit: 'ppm', min: 100, max: 1800, step: 50 },
      ],
    });

    // 6. 3-Axis Accelerometer (ADXL335 / GY-61)
    this.registerComponent({
      id: 'builtin_accelerometer',
      name: '3-Axis Accelerometer (ADXL335)',
      category: 'sensors',
      description: 'MEMS 3-axis tilt and acceleration breakout board (-3g to +3g) with X, Y, Z analog/digital outputs',
      tags: ['accelerometer', 'adxl335', 'gy61', 'tilt', 'imu', 'gravity', 'xyz', 'sensor'],
      width: 120,
      height: 80,
      origin: 'center',
      defaultDesignator: 'ACC',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'vcc', label: 'VCC', x: -40, y: 40, direction: 'power' },
        { id: 'gnd', label: 'GND', x: -20, y: 40, direction: 'ground' },
        { id: 'x', label: 'X', x: 0, y: 40, direction: 'output' },
        { id: 'y', label: 'Y', x: 20, y: 40, direction: 'output' },
        { id: 'z', label: 'Z', x: 40, y: 40, direction: 'output' },
      ],
      defaultProperties: { accelX: 0.0, accelY: 0.0, accelZ: 0.0, tiltThreshold: 0.5, maxVoltage: 6.0 },
      propertySchema: [
        { key: 'accelX', label: 'X-Axis Accel', type: 'number', unit: 'g', min: -3.0, max: 3.0, step: 0.1 },
        { key: 'accelY', label: 'Y-Axis Accel', type: 'number', unit: 'g', min: -3.0, max: 3.0, step: 0.1 },
        { key: 'accelZ', label: 'Z-Axis Accel', type: 'number', unit: 'g', min: -3.0, max: 3.0, step: 0.1 },
        { key: 'tiltThreshold', label: 'Logic HIGH Threshold', type: 'number', unit: 'g', min: 0.1, max: 2.5, step: 0.1 },
      ],
    });

    // 7. Basic 8-Bit Programmable Assembly Microprocessor (SECS-808 CPU)
    this.registerComponent({
      id: 'builtin_cpu_8bit',
      name: '8-Bit Assembly CPU (SECS-808)',
      category: 'mcu',
      description: '20-Pin ceramic DIP 8-bit microprocessor programmable in Assembly language with live ACC, B, PC, Z & C registers',
      tags: ['cpu', '8bit', 'assembly', 'asm', 'microprocessor', 'dip20', 'secs808', 'mcu', 'alu'],
      width: 120,
      height: 220,
      origin: 'center',
      defaultDesignator: 'CPU',
      renderType: 'composite_shapes',
      simulationModel: { type: 'script' },
      pins: [
        // Left Column (x = -60, 10 pins from y = -80 to y = +100)
        { id: 'vcc', label: 'VCC', x: -60, y: -80, direction: 'power' },
        { id: 'gnd', label: 'GND', x: -60, y: -60, direction: 'ground' },
        { id: 'clk', label: 'CLK', x: -60, y: -40, direction: 'input' },
        { id: 'rst', label: 'RST', x: -60, y: -20, direction: 'input' },
        { id: 'in0', label: 'IN0', x: -60, y: 0, direction: 'input' },
        { id: 'in1', label: 'IN1', x: -60, y: 20, direction: 'input' },
        { id: 'in2', label: 'IN2', x: -60, y: 40, direction: 'input' },
        { id: 'in3', label: 'IN3', x: -60, y: 60, direction: 'input' },
        { id: 'irq', label: 'IRQ', x: -60, y: 80, direction: 'input' },
        { id: 'rw', label: 'RW', x: -60, y: 100, direction: 'output' },
        // Right Column (x = +60, 10 pins from y = -80 to y = +100)
        { id: 'out0', label: 'OUT0', x: 60, y: -80, direction: 'output' },
        { id: 'out1', label: 'OUT1', x: 60, y: -60, direction: 'output' },
        { id: 'out2', label: 'OUT2', x: 60, y: -40, direction: 'output' },
        { id: 'out3', label: 'OUT3', x: 60, y: -20, direction: 'output' },
        { id: 'out4', label: 'OUT4', x: 60, y: 0, direction: 'output' },
        { id: 'out5', label: 'OUT5', x: 60, y: 20, direction: 'output' },
        { id: 'out6', label: 'OUT6', x: 60, y: 40, direction: 'output' },
        { id: 'out7', label: 'OUT7', x: 60, y: 60, direction: 'output' },
        { id: 'zero', label: 'ZERO', x: 60, y: 80, direction: 'output' },
        { id: 'carry', label: 'CARRY', x: 60, y: 100, direction: 'output' },
      ],
      defaultProperties: { clockHz: 5 },
      propertySchema: [
        { key: 'clockHz', label: 'Internal Auto-Clock', type: 'number', unit: 'Hz', min: 1, max: 50, step: 1 },
      ],
    });

    // 8. OLED Graphic Display (SSD1306 128x64 / 128x32)
    this.registerComponent({
      id: 'builtin_oled_display',
      name: 'OLED Graphic Display (SSD1306)',
      category: 'outputs',
      description: 'I2C/SPI monochrome graphic OLED display module supporting 128x64 and 128x32 screen sizes and MCU OLED.println()',
      tags: ['oled', 'display', 'screen', 'ssd1306', '128x64', '128x32', 'i2c', 'output'],
      width: 120,
      height: 100,
      origin: 'center',
      defaultDesignator: 'OLED',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'gnd', label: 'GND', x: -40, y: 40, direction: 'ground' },
        { id: 'vcc', label: 'VCC', x: -20, y: 40, direction: 'power' },
        { id: 'sck', label: 'SCK', x: 0, y: 40, direction: 'input' },
        { id: 'sda', label: 'SDA', x: 20, y: 40, direction: 'bidirectional' },
        { id: 'dc', label: 'DC', x: 40, y: 40, direction: 'input' },
      ],
      defaultProperties: {
        screenSize: '128x64',
        pixelColor: '#38bdf8',
        displayText: 'SECS OLED\nREADY!',
        maxVoltage: 6.0,
      },
      propertySchema: [
        {
          key: 'screenSize',
          label: 'Screen Size',
          type: 'select',
          options: [
            { label: '0.96" (128x64)', value: '128x64' },
            { label: '0.91" (128x32)', value: '128x32' },
            { label: '1.3" Large (128x64)', value: '128x64-large' },
          ],
        },
        {
          key: 'pixelColor',
          label: 'Pixel Color',
          type: 'select',
          options: [
            { label: 'Cyan (#38bdf8)', value: '#38bdf8' },
            { label: 'White (#f8fafc)', value: '#f8fafc' },
            { label: 'Yellow/Blue Top-Bar', value: 'yellow-blue' },
          ],
        },
      ],
    });

    // 9. 16x2 Character LCD Display (HD44780)
    this.registerComponent({
      id: 'builtin_lcd_16x2',
      name: '16x2 Character LCD (HD44780)',
      category: 'outputs',
      description: 'Backlit 16-column by 2-row alphanumeric LCD display module supporting I2C, 4-bit parallel, and MCU LCD.print()',
      tags: ['lcd', '16x2', 'hd44780', 'display', 'character', 'screen', 'output'],
      width: 160,
      height: 80,
      origin: 'center',
      defaultDesignator: 'LCD',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'gnd', label: 'GND', x: -60, y: 40, direction: 'ground' },
        { id: 'vcc', label: 'VCC', x: -40, y: 40, direction: 'power' },
        { id: 'sda', label: 'SDA', x: -20, y: 40, direction: 'bidirectional' },
        { id: 'scl', label: 'SCL', x: 0, y: 40, direction: 'input' },
        { id: 'd4', label: 'D4', x: 20, y: 40, direction: 'input' },
        { id: 'd5', label: 'D5', x: 40, y: 40, direction: 'input' },
        { id: 'd6', label: 'D6', x: 60, y: 40, direction: 'input' },
      ],
      defaultProperties: {
        row1Text: 'SECS 16x2 LCD',
        row2Text: 'SYSTEM READY',
        backlightColor: 'green',
        maxVoltage: 6.5,
      },
      propertySchema: [
        {
          key: 'backlightColor',
          label: 'Backlight Theme',
          type: 'select',
          options: [
            { label: 'Classic Green-Yellow', value: 'green' },
            { label: 'Cool Blue-White', value: 'blue' },
          ],
        },
      ],
    });

    // 10. MicroSD Card Reader Module
    this.registerComponent({
      id: 'builtin_sd_card',
      name: 'MicroSD Card Reader Module',
      category: 'outputs',
      description: 'SPI MicroSD flash storage breakout board with interactive virtual file system, log.csv telemetry & PC file download',
      tags: ['sd', 'microsd', 'storage', 'card', 'spi', 'file', 'logger', 'data'],
      width: 120,
      height: 80,
      origin: 'center',
      defaultDesignator: 'SD',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'gnd', label: 'GND', x: -60, y: 40, direction: 'ground' },
        { id: 'vcc', label: 'VCC', x: -40, y: 40, direction: 'power' },
        { id: 'miso', label: 'MISO', x: -20, y: 40, direction: 'output' },
        { id: 'mosi', label: 'MOSI', x: 20, y: 40, direction: 'input' },
        { id: 'sck', label: 'SCK', x: 40, y: 40, direction: 'input' },
        { id: 'cs', label: 'CS', x: 60, y: 40, direction: 'input' },
      ],
      defaultProperties: {
        activeFile: 'log.csv',
        files: {
          'data.txt': 'SECS Virtual MicroSD Card\nHardware Status: READY\n',
          'log.csv': 'timestamp_ms,channel,value\n0,BOOT,OK\n',
        },
        maxVoltage: 6.5,
      },
      propertySchema: [],
    });

    // 11. Step-Up / Step-Down DC-DC Converter (Buck/Boost Module)
    this.registerComponent({
      id: 'builtin_dcdc_converter',
      name: 'DC-DC Buck/Boost Converter',
      category: 'power',
      description: 'Adjustable Step-Up (Boost) and Step-Down (Buck) DC-DC voltage regulator module with live 7-segment LED voltmeter',
      tags: ['dcdc', 'buck', 'boost', 'converter', 'regulator', 'step-up', 'step-down', 'power'],
      width: 120,
      height: 80,
      origin: 'center',
      defaultDesignator: 'REG',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'vin_plus', label: 'VIN+', x: -60, y: -20, direction: 'input' },
        { id: 'vin_minus', label: 'VIN-', x: -60, y: 20, direction: 'ground' },
        { id: 'vout_plus', label: 'VOUT+', x: 60, y: -20, direction: 'output' },
        { id: 'vout_minus', label: 'VOUT-', x: 60, y: 20, direction: 'ground' },
      ],
      defaultProperties: {
        mode: 'auto',
        targetVoltage: 12.0,
        maxInputVoltage: 40.0,
      },
      propertySchema: [
        {
          key: 'mode',
          label: 'Converter Topology',
          type: 'select',
          options: [
            { label: 'Auto Buck-Boost', value: 'auto' },
            { label: 'Step-Down (Buck)', value: 'buck' },
            { label: 'Step-Up (Boost)', value: 'boost' },
          ],
        },
        { key: 'targetVoltage', label: 'Target Output Voltage', type: 'number', unit: 'V', min: 1.2, max: 36.0, step: 0.5 },
      ],
    });

    // 12. 4x4 Matrix Membrane Numpad
    this.registerComponent({
      id: 'builtin_numpad',
      name: '4x4 Matrix Membrane Numpad',
      category: 'sensors',
      description: '16-Key interactive membrane matrix keypad (0-9, A-D, *, #) with Row/Col pins, active OUT signal, and MCU Keypad.getKey()',
      tags: ['numpad', 'keypad', 'matrix', '4x4', 'buttons', 'membrane', 'input', 'sensor'],
      width: 120,
      height: 160,
      origin: 'center',
      defaultDesignator: 'KEY',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        // Left Edge (x = -60): R1..R4
        { id: 'r1', label: 'R1', x: -60, y: -40, direction: 'passive' },
        { id: 'r2', label: 'R2', x: -60, y: -20, direction: 'passive' },
        { id: 'r3', label: 'R3', x: -60, y: 20, direction: 'passive' },
        { id: 'r4', label: 'R4', x: -60, y: 40, direction: 'passive' },
        // Right Edge (x = +60): C1..C4
        { id: 'c1', label: 'C1', x: 60, y: -40, direction: 'passive' },
        { id: 'c2', label: 'C2', x: 60, y: -20, direction: 'passive' },
        { id: 'c3', label: 'C3', x: 60, y: 20, direction: 'passive' },
        { id: 'c4', label: 'C4', x: 60, y: 40, direction: 'passive' },
        // Bottom Edge (y = +80): VCC, OUT, GND
        { id: 'vcc', label: 'VCC', x: -20, y: 80, direction: 'power' },
        { id: 'out', label: 'OUT', x: 0, y: 80, direction: 'output' },
        { id: 'gnd', label: 'GND', x: 20, y: 80, direction: 'ground' },
      ],
      defaultProperties: { activeKey: '' },
      propertySchema: [],
    });

    // =========================================================================
    // PHASE 7.4 EXPANSION PACK (16 COMPONENT FAMILIES / 19 BUILTIN TYPES)
    // =========================================================================

    // 1. Voltage Comparator IC (LM393)
    this.registerComponent({
      id: 'builtin_comparator',
      name: 'Voltage Comparator (LM393)',
      category: 'semiconductors',
      description: 'High-speed dual voltage comparator IC with internal reference threshold and open-collector output',
      tags: ['comparator', 'lm393', 'threshold', 'voltage', 'opamp', 'analog', 'semiconductor'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'CMP',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'in_plus', label: 'IN+', x: -40, y: -20, direction: 'input' },
        { id: 'in_minus', label: 'IN-', x: -40, y: 20, direction: 'input' },
        { id: 'vcc', label: 'VCC', x: 0, y: -40, direction: 'power' },
        { id: 'gnd', label: 'GND', x: 0, y: 40, direction: 'ground' },
        { id: 'out', label: 'OUT', x: 40, y: 0, direction: 'output' },
      ],
      defaultProperties: { thresholdVoltage: 2.5, maxVoltage: 36.0 },
      propertySchema: [
        { key: 'thresholdVoltage', label: 'Reference Threshold (if IN- open)', type: 'number', unit: 'V', min: 0.1, max: 24.0, step: 0.1 },
      ],
    });

    // 2. 8-Bit Shift Register (74HC595 SIPO)
    this.registerComponent({
      id: 'builtin_shift_register',
      name: '8-Bit Shift Register (74HC595)',
      category: 'logic',
      description: '8-bit Serial-In Parallel-Out (SIPO) shift register with output storage register and 3-state outputs',
      tags: ['shift', 'register', '74hc595', 'sipo', 'serial', 'parallel', 'latch', 'logic'],
      width: 120,
      height: 180,
      origin: 'center',
      defaultDesignator: 'SR',
      renderType: 'composite_shapes',
      simulationModel: { type: 'logical' },
      pins: [
        { id: 'data', label: 'DATA', x: -60, y: -60, direction: 'input' },
        { id: 'clk', label: 'CLK', x: -60, y: -20, direction: 'input' },
        { id: 'latch', label: 'LATCH', x: -60, y: 20, direction: 'input' },
        { id: 'rst', label: 'RST', x: -60, y: 60, direction: 'input' },
        { id: 'vcc', label: 'VCC', x: -20, y: -80, direction: 'power' },
        { id: 'gnd', label: 'GND', x: -20, y: 80, direction: 'ground' },
        { id: 'q0', label: 'Q0', x: 60, y: -60, direction: 'output' },
        { id: 'q1', label: 'Q1', x: 60, y: -40, direction: 'output' },
        { id: 'q2', label: 'Q2', x: 60, y: -20, direction: 'output' },
        { id: 'q3', label: 'Q3', x: 60, y: 0, direction: 'output' },
        { id: 'q4', label: 'Q4', x: 60, y: 20, direction: 'output' },
        { id: 'q5', label: 'Q5', x: 60, y: 40, direction: 'output' },
        { id: 'q6', label: 'Q6', x: 60, y: 60, direction: 'output' },
        { id: 'q7', label: 'Q7', x: 60, y: 80, direction: 'output' },
      ],
      defaultProperties: { autoLatch: true, shiftBits: 0, outputBits: 0 },
      propertySchema: [
        { key: 'autoLatch', label: 'Auto-Latch on Clock', type: 'boolean' },
      ],
    });

    // 3. BCD to 7-Segment Decoder (CD4511)
    this.registerComponent({
      id: 'builtin_bcd_decoder',
      name: 'BCD to 7-Segment Decoder (CD4511)',
      category: 'logic',
      description: 'CMOS BCD-to-7-segment latch decoder and high-current LED display driver',
      tags: ['bcd', 'decoder', 'cd4511', '7segment', 'display', 'driver', 'logic'],
      width: 120,
      height: 160,
      origin: 'center',
      defaultDesignator: 'BCD',
      renderType: 'composite_shapes',
      simulationModel: { type: 'logical' },
      pins: [
        { id: 'd0', label: 'D0 (A)', x: -60, y: -60, direction: 'input' },
        { id: 'd1', label: 'D1 (B)', x: -60, y: -20, direction: 'input' },
        { id: 'd2', label: 'D2 (C)', x: -60, y: 20, direction: 'input' },
        { id: 'd3', label: 'D3 (D)', x: -60, y: 60, direction: 'input' },
        { id: 'vcc', label: 'VCC', x: 0, y: -80, direction: 'power' },
        { id: 'gnd', label: 'GND', x: 0, y: 80, direction: 'ground' },
        { id: 'qa', label: 'a', x: 60, y: -60, direction: 'output' },
        { id: 'qb', label: 'b', x: 60, y: -40, direction: 'output' },
        { id: 'qc', label: 'c', x: 60, y: -20, direction: 'output' },
        { id: 'qd', label: 'd', x: 60, y: 0, direction: 'output' },
        { id: 'qe', label: 'e', x: 60, y: 20, direction: 'output' },
        { id: 'qf', label: 'f', x: 60, y: 40, direction: 'output' },
        { id: 'qg', label: 'g', x: 60, y: 60, direction: 'output' },
      ],
      defaultProperties: {},
      propertySchema: [],
    });

    // 4. 4-to-1 Digital Multiplexer (74HC153)
    this.registerComponent({
      id: 'builtin_mux_4to1',
      name: '4-to-1 Multiplexer (74HC153)',
      category: 'logic',
      description: '4-Line to 1-Line digital data selector / multiplexer with binary address selection inputs',
      tags: ['mux', 'multiplexer', '74hc153', 'selector', 'switch', 'data', 'logic'],
      width: 80,
      height: 160,
      origin: 'center',
      defaultDesignator: 'MUX',
      renderType: 'composite_shapes',
      simulationModel: { type: 'logical' },
      pins: [
        { id: 'i0', label: 'I0', x: -40, y: -60, direction: 'input' },
        { id: 'i1', label: 'I1', x: -40, y: -20, direction: 'input' },
        { id: 'i2', label: 'I2', x: -40, y: 20, direction: 'input' },
        { id: 'i3', label: 'I3', x: -40, y: 60, direction: 'input' },
        { id: 's0', label: 'S0', x: -20, y: 80, direction: 'input' },
        { id: 's1', label: 'S1', x: 20, y: 80, direction: 'input' },
        { id: 'y', label: 'Y', x: 40, y: 0, direction: 'output' },
      ],
      defaultProperties: {},
      propertySchema: [],
    });

    // 5A. D Flip-Flop (74HC74)
    this.registerComponent({
      id: 'builtin_d_flipflop',
      name: 'D Flip-Flop (74HC74)',
      category: 'logic',
      description: 'Dual positive-edge-triggered D-type flip-flop with asynchronous Set and Reset inputs',
      tags: ['flipflop', 'dff', '74hc74', 'sequential', 'clock', 'edge', 'register', 'logic'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'DFF',
      renderType: 'composite_shapes',
      simulationModel: { type: 'logical' },
      pins: [
        { id: 'd', label: 'D', x: -40, y: -20, direction: 'input' },
        { id: 'clk', label: 'CLK', x: -40, y: 20, direction: 'input' },
        { id: 'set', label: 'SET', x: 0, y: -40, direction: 'input' },
        { id: 'rst', label: 'RST', x: 0, y: 40, direction: 'input' },
        { id: 'q', label: 'Q', x: 40, y: -20, direction: 'output' },
        { id: 'nq', label: '!Q', x: 40, y: 20, direction: 'output' },
      ],
      defaultProperties: { q: 0 },
      propertySchema: [],
    });

    // 5B. JK Flip-Flop (74HC73)
    this.registerComponent({
      id: 'builtin_jk_flipflop',
      name: 'JK Flip-Flop (74HC73)',
      category: 'logic',
      description: 'Dual JK flip-flop with Set, Reset, and toggle state capability on positive clock edges',
      tags: ['flipflop', 'jk', '74hc73', 'toggle', 'counter', 'sequential', 'logic'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'JKFF',
      renderType: 'composite_shapes',
      simulationModel: { type: 'logical' },
      pins: [
        { id: 'j', label: 'J', x: -40, y: -20, direction: 'input' },
        { id: 'clk', label: 'CLK', x: -40, y: 0, direction: 'input' },
        { id: 'k', label: 'K', x: -40, y: 20, direction: 'input' },
        { id: 'rst', label: 'RST', x: 0, y: 40, direction: 'input' },
        { id: 'q', label: 'Q', x: 40, y: -20, direction: 'output' },
        { id: 'nq', label: '!Q', x: 40, y: 20, direction: 'output' },
      ],
      defaultProperties: { q: 0 },
      propertySchema: [],
    });

    // 6. 4-Bit Binary Counter IC (74HC161)
    this.registerComponent({
      id: 'builtin_counter_4bit',
      name: '4-Bit Binary Counter (74HC161)',
      category: 'logic',
      description: 'Synchronous 4-bit binary presettable counter with async reset and active-high count enable',
      tags: ['counter', 'binary', '4bit', '74hc161', 'clock', 'divider', 'logic'],
      width: 80,
      height: 160,
      origin: 'center',
      defaultDesignator: 'CNT',
      renderType: 'composite_shapes',
      simulationModel: { type: 'logical' },
      pins: [
        { id: 'clk', label: 'CLK', x: -40, y: -40, direction: 'input' },
        { id: 'en', label: 'EN', x: -40, y: 0, direction: 'input' },
        { id: 'rst', label: 'RST', x: -40, y: 40, direction: 'input' },
        { id: 'q0', label: 'Q0', x: 40, y: -60, direction: 'output' },
        { id: 'q1', label: 'Q1', x: 40, y: -20, direction: 'output' },
        { id: 'q2', label: 'Q2', x: 40, y: 20, direction: 'output' },
        { id: 'q3', label: 'Q3', x: 40, y: 60, direction: 'output' },
      ],
      defaultProperties: { count: 0 },
      propertySchema: [],
    });

    // 7. 4-Bit DIP Switch Bank
    this.registerComponent({
      id: 'builtin_dip_switch_4',
      name: '4-Bit DIP Switch Bank',
      category: 'sensors',
      description: '4-Channel SPST slide switch array with on-canvas toggle and optional internal pull-up resistors',
      tags: ['dip', 'switch', 'bank', 'spst', 'slideswitch', 'input', 'sensors'],
      width: 80,
      height: 160,
      origin: 'center',
      defaultDesignator: 'SW',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'in1', label: 'IN1', x: -40, y: -60, direction: 'passive' },
        { id: 'in2', label: 'IN2', x: -40, y: -20, direction: 'passive' },
        { id: 'in3', label: 'IN3', x: -40, y: 20, direction: 'passive' },
        { id: 'in4', label: 'IN4', x: -40, y: 60, direction: 'passive' },
        { id: 'out1', label: 'OUT1', x: 40, y: -60, direction: 'passive' },
        { id: 'out2', label: 'OUT2', x: 40, y: -20, direction: 'passive' },
        { id: 'out3', label: 'OUT3', x: 40, y: 20, direction: 'passive' },
        { id: 'out4', label: 'OUT4', x: 40, y: 60, direction: 'passive' },
      ],
      defaultProperties: { sw1: false, sw2: false, sw3: false, sw4: false, internalPullup: false },
      propertySchema: [
        { key: 'sw1', label: 'Channel 1 State', type: 'boolean' },
        { key: 'sw2', label: 'Channel 2 State', type: 'boolean' },
        { key: 'sw3', label: 'Channel 3 State', type: 'boolean' },
        { key: 'sw4', label: 'Channel 4 State', type: 'boolean' },
        { key: 'internalPullup', label: 'Internal 5V Pull-Up', type: 'boolean' },
      ],
    });

    // 8. Protective Fuse / Resettable Polyfuse
    this.registerComponent({
      id: 'builtin_fuse',
      name: 'Protective Fuse (Glass / PTC)',
      category: 'passives',
      description: 'Overcurrent protection device that blows open when current exceeds rating to safeguard downstream components',
      tags: ['fuse', 'polyfuse', 'ptc', 'protection', 'safety', 'glass', 'passives'],
      width: 80,
      height: 40,
      origin: 'center',
      defaultDesignator: 'F',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'p1', label: 'P1', x: -40, y: 0, direction: 'passive' },
        { id: 'p2', label: 'P2', x: 40, y: 0, direction: 'passive' },
      ],
      defaultProperties: { maxCurrent: 0.1, fuseType: 'glass', isBlown: false },
      propertySchema: [
        { key: 'maxCurrent', label: 'Current Rating (I_max)', type: 'number', unit: 'A', min: 0.02, max: 5.0, step: 0.02 },
        {
          key: 'fuseType',
          label: 'Fuse Mechanism',
          type: 'select',
          options: [
            { label: 'Fast-Blow Glass Tube', value: 'glass' },
            { label: 'Auto-Resettable Polyfuse (PTC)', value: 'polyfuse' },
          ],
        },
        { key: 'isBlown', label: 'Blown State', type: 'boolean' },
      ],
    });

    // 9. H-Bridge Dual Motor Driver (L298N Module)
    this.registerComponent({
      id: 'builtin_hbridge',
      name: 'H-Bridge Motor Driver (L298N)',
      category: 'outputs',
      description: 'High-voltage high-current dual full-bridge motor driver module for bidirectional DC and stepper motor control',
      tags: ['hbridge', 'l298n', 'motor', 'driver', 'pwm', 'bidirectional', 'actuator', 'outputs'],
      width: 120,
      height: 120,
      origin: 'center',
      defaultDesignator: 'DRV',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'ena', label: 'ENA', x: -60, y: -40, direction: 'input' },
        { id: 'in1', label: 'IN1', x: -60, y: 0, direction: 'input' },
        { id: 'in2', label: 'IN2', x: -60, y: 40, direction: 'input' },
        { id: 'vcc', label: 'VCC', x: -20, y: 60, direction: 'power' },
        { id: 'gnd', label: 'GND', x: 20, y: 60, direction: 'ground' },
        { id: 'out1', label: 'OUT1', x: 60, y: -20, direction: 'output' },
        { id: 'out2', label: 'OUT2', x: 60, y: 20, direction: 'output' },
      ],
      defaultProperties: { maxVoltage: 46.0 },
      propertySchema: [],
    });

    // 10A. PNP Transistor (2N3906)
    this.registerComponent({
      id: 'builtin_pnp',
      name: 'PNP Transistor (2N3906)',
      category: 'semiconductors',
      description: 'General-purpose high-side PNP silicon epitaxial planar bipolar transistor',
      tags: ['transistor', 'pnp', '2n3906', 'bjt', 'switch', 'amplifier', 'semiconductors'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'Q',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'base', label: 'Base', x: -40, y: 0, direction: 'input' },
        { id: 'emitter', label: 'Emitter', x: 0, y: -40, direction: 'passive' },
        { id: 'collector', label: 'Collector', x: 0, y: 40, direction: 'passive' },
      ],
      defaultProperties: { beta: 100, maxVoltage: 40.0, maxPower: 0.625 },
      propertySchema: [
        { key: 'beta', label: 'DC Current Gain (hFE)', type: 'number', min: 10, max: 800, step: 10 },
      ],
    });

    // 10B. P-Channel MOSFET
    this.registerComponent({
      id: 'builtin_pmos',
      name: 'P-Channel MOSFET',
      category: 'semiconductors',
      description: 'Enhancement-mode P-channel power MOSFET for low-loss high-side load switching',
      tags: ['mosfet', 'pmos', 'p-channel', 'fet', 'switch', 'transistor', 'semiconductors'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'Q',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'gate', label: 'Gate', x: -40, y: 0, direction: 'input' },
        { id: 'source', label: 'Source', x: 0, y: -40, direction: 'passive' },
        { id: 'drain', label: 'Drain', x: 0, y: 40, direction: 'passive' },
      ],
      defaultProperties: { vth: -2.0, rdsOn: 0.05, maxVoltage: 30.0 },
      propertySchema: [
        { key: 'vth', label: 'Threshold Voltage (Vth)', type: 'number', unit: 'V', min: -5.0, max: -0.5, step: 0.1 },
      ],
    });

    // 11A. Full-Wave Bridge Rectifier
    this.registerComponent({
      id: 'builtin_bridge_rectifier',
      name: 'Full-Wave Bridge Rectifier',
      category: 'semiconductors',
      description: 'Monolithic 4-diode full-wave AC-to-DC rectifier bridge package',
      tags: ['rectifier', 'bridge', 'diodes', 'ac-dc', 'power', 'semiconductors'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'BR',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'ac1', label: 'AC1 (~)', x: -40, y: -20, direction: 'passive' },
        { id: 'ac2', label: 'AC2 (~)', x: -40, y: 20, direction: 'passive' },
        { id: 'dc_plus', label: 'DC+ (+)', x: 40, y: -20, direction: 'output' },
        { id: 'dc_minus', label: 'DC- (-)', x: 40, y: 20, direction: 'output' },
      ],
      defaultProperties: { vf: 0.7, maxVoltage: 200 },
      propertySchema: [],
    });

    // 11B. 5V Linear Regulator (LM7805)
    this.registerComponent({
      id: 'builtin_reg_7805',
      name: '5V Linear Regulator (LM7805)',
      category: 'power',
      description: 'Positive 3-terminal voltage regulator delivering a fixed +5.0V output with thermal overload protection',
      tags: ['regulator', 'lm7805', '7805', '5v', 'linear', 'ldo', 'power'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'REG',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'in', label: 'IN', x: -40, y: 0, direction: 'power' },
        { id: 'gnd', label: 'GND', x: 0, y: 40, direction: 'ground' },
        { id: 'out', label: 'OUT', x: 40, y: 0, direction: 'power' },
      ],
      defaultProperties: { fixedVoltage: 5.0, maxVoltage: 35.0 },
      propertySchema: [],
    });

    // 12. Optocoupler Isolator (PC817)
    this.registerComponent({
      id: 'builtin_optocoupler',
      name: 'Optocoupler Isolator (PC817)',
      category: 'semiconductors',
      description: '4-pin galvanic isolator pairing an infrared GaAs LED with an NPN phototransistor',
      tags: ['optocoupler', 'pc817', 'optodiode', 'isolation', 'galvanic', 'semiconductors'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'OPTO',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'anode', label: 'Anode', x: -40, y: -20, direction: 'passive' },
        { id: 'cathode', label: 'Cathode', x: -40, y: 20, direction: 'passive' },
        { id: 'collector', label: 'Collector', x: 40, y: -20, direction: 'passive' },
        { id: 'emitter', label: 'Emitter', x: 40, y: 20, direction: 'passive' },
      ],
      defaultProperties: { ctr: 1.0, vf: 1.2 },
      propertySchema: [],
    });

    // 13. Solar Panel Photovoltaic Cell
    this.registerComponent({
      id: 'builtin_solar_panel',
      name: 'Solar Panel Photovoltaic Cell',
      category: 'power',
      description: 'Monocrystalline photovoltaic solar panel generating clean DC voltage in response to ambient lux & lightbulb cursor',
      tags: ['solar', 'panel', 'pv', 'photovoltaic', 'green', 'energy', 'lux', 'power'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'SOL',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'pos', label: 'POS (+)', x: 40, y: -20, direction: 'power' },
        { id: 'neg', label: 'NEG (-)', x: 40, y: 20, direction: 'ground' },
      ],
      defaultProperties: { lux: 100, maxVoltage: 6.0, ratedPower: 1.0 },
      propertySchema: [
        { key: 'lux', label: 'Solar Irradiance', type: 'number', unit: 'lx', min: 0, max: 2000, step: 25 },
        { key: 'maxVoltage', label: 'Open-Circuit Voltage (Voc)', type: 'number', unit: 'V', min: 3.0, max: 24.0, step: 0.5 },
      ],
    });

    // 14. 2-Axis Analog Joystick Module (KY-023)
    this.registerComponent({
      id: 'builtin_joystick',
      name: '2-Axis Analog Joystick (KY-023)',
      category: 'sensors',
      description: 'Dual-potentiometer 2-axis gimbal thumbstick with integrated push-to-click momentary tactile switch',
      tags: ['joystick', 'ky023', 'thumbstick', 'analog', 'x-y', 'gimbal', 'controller', 'sensors'],
      width: 120,
      height: 120,
      origin: 'center',
      defaultDesignator: 'JOY',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'gnd', label: 'GND', x: -40, y: 60, direction: 'ground' },
        { id: 'vcc', label: 'VCC', x: -20, y: 60, direction: 'power' },
        { id: 'vrx', label: 'VRX', x: 0, y: 60, direction: 'output' },
        { id: 'vry', label: 'VRY', x: 20, y: 60, direction: 'output' },
        { id: 'sw', label: 'SW', x: 40, y: 60, direction: 'output' },
      ],
      defaultProperties: { joyX: 0, joyY: 0, isPressed: false, springReturn: true },
      propertySchema: [
        { key: 'joyX', label: 'X Position', type: 'number', unit: '%', min: -100, max: 100, step: 5 },
        { key: 'joyY', label: 'Y Position', type: 'number', unit: '%', min: -100, max: 100, step: 5 },
        { key: 'isPressed', label: 'Center Switch (SW)', type: 'boolean' },
        { key: 'springReturn', label: 'Auto Spring-to-Center', type: 'boolean' },
      ],
    });

    // 15. 10-Segment LED Bar Graph
    this.registerComponent({
      id: 'builtin_led_bar_graph',
      name: '10-Segment LED Bar Graph',
      category: 'outputs',
      description: '10-Segment multi-color LED bar display with individual digital segment pins and auto-sensing 0-5V analog VU meter pin',
      tags: ['bar', 'graph', 'led', 'display', 'vu', 'meter', 'level', 'outputs'],
      width: 80,
      height: 160,
      origin: 'center',
      defaultDesignator: 'BAR',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'b1', label: 'B1', x: -40, y: -60, direction: 'passive' },
        { id: 'b2', label: 'B2', x: -40, y: -40, direction: 'passive' },
        { id: 'b3', label: 'B3', x: -40, y: -20, direction: 'passive' },
        { id: 'b4', label: 'B4', x: -40, y: 0, direction: 'passive' },
        { id: 'b5', label: 'B5', x: -40, y: 20, direction: 'passive' },
        { id: 'b6', label: 'B6', x: -40, y: 40, direction: 'passive' },
        { id: 'b7', label: 'B7', x: -40, y: 60, direction: 'passive' },
        { id: 'b8', label: 'B8', x: 40, y: -60, direction: 'passive' },
        { id: 'b9', label: 'B9', x: 40, y: -40, direction: 'passive' },
        { id: 'b10', label: 'B10', x: 40, y: -20, direction: 'passive' },
        { id: 'ain', label: 'AIN', x: 40, y: 20, direction: 'input' },
        { id: 'gnd', label: 'GND', x: 40, y: 60, direction: 'ground' },
      ],
      defaultProperties: { litCount: 0 },
      propertySchema: [],
    });

    // 16. Bipolar Stepper Motor (NEMA-17)
    this.registerComponent({
      id: 'builtin_stepper_motor',
      name: 'Bipolar Stepper Motor (NEMA-17)',
      category: 'outputs',
      description: '2-Phase 4-wire bipolar hybrid stepper motor with 1.8° step angle and live angular position telemetry',
      tags: ['stepper', 'motor', 'nema17', 'bipolar', 'steps', 'angle', 'actuator', 'outputs'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'STP',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'a_plus', label: 'A+', x: -40, y: -20, direction: 'passive' },
        { id: 'a_minus', label: 'A-', x: -40, y: 20, direction: 'passive' },
        { id: 'b_plus', label: 'B+', x: 40, y: -20, direction: 'passive' },
        { id: 'b_minus', label: 'B-', x: 40, y: 20, direction: 'passive' },
      ],
      defaultProperties: { angle: 0, stepDeg: 1.8, stepCount: 0 },
      propertySchema: [
        { key: 'stepDeg', label: 'Step Angle', type: 'number', unit: '°', min: 0.9, max: 15.0, step: 0.9 },
      ],
    });

    // ==========================================
    // PHASE 7.9: 10-COMPONENT EXPANSION PACK
    // ==========================================

    // 1. Soil Moisture Sensor
    this.registerComponent({
      id: 'builtin_soil_moisture',
      name: 'Soil Moisture Sensor',
      category: 'sensors',
      description: 'Two-prong gold-plated conductive soil moisture fork probe with threshold comparator & dry/wet trigger invert',
      tags: ['soil', 'moisture', 'water', 'plant', 'irrigation', 'humidity', 'probe', 'sensors'],
      width: 80,
      height: 120,
      origin: 'center',
      defaultDesignator: 'SOIL',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'vcc', label: 'VCC', x: -20, y: -60, direction: 'power' },
        { id: 'out', label: 'OUT', x: 0, y: -60, direction: 'output' },
        { id: 'gnd', label: 'GND', x: 20, y: -60, direction: 'ground' },
      ],
      defaultProperties: { moisture: 20, threshold: 50, triggerOnDry: false, maxVoltage: 6.5 },
      propertySchema: [
        { key: 'moisture', label: 'Soil Moisture', type: 'number', unit: '%', min: 0, max: 100, step: 5 },
        { key: 'threshold', label: 'Trigger Threshold', type: 'number', unit: '%', min: 5, max: 95, step: 5 },
        { key: 'triggerOnDry', label: 'Trigger on Dry (< Threshold)', type: 'boolean' },
      ],
    });

    // 2. Traffic Light LED Module
    this.registerComponent({
      id: 'builtin_traffic_light',
      name: 'Traffic Light LED Module',
      category: 'outputs',
      description: '3-Lamp Red / Yellow / Green common-cathode traffic signal indicator module with integrated 150Ω current-limiting resistors',
      tags: ['traffic', 'light', 'signal', 'red', 'yellow', 'green', 'led', 'outputs'],
      width: 80,
      height: 120,
      origin: 'center',
      defaultDesignator: 'TL',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'r', label: 'RED', x: -40, y: -40, direction: 'input' },
        { id: 'y', label: 'YEL', x: -40, y: -20, direction: 'input' },
        { id: 'g', label: 'GRN', x: -40, y: 20, direction: 'input' },
        { id: 'gnd', label: 'GND', x: -40, y: 40, direction: 'ground' },
      ],
      defaultProperties: { maxVoltage: 12.0 },
      propertySchema: [
        { key: 'maxVoltage', label: 'Max Input Voltage', type: 'number', unit: 'V', min: 5.0, max: 24.0, step: 1.0 },
      ],
    });

    // 3. Submersible DC Water Pump
    this.registerComponent({
      id: 'builtin_water_pump',
      name: 'Submersible DC Water Pump',
      category: 'outputs',
      description: 'Centrifugal submersible 3V–12V DC water pump with rotating impeller and animated water jet output',
      tags: ['water', 'pump', 'motor', 'irrigation', 'fluid', 'impeller', 'actuator', 'outputs'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'PUMP',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'p_plus', label: 'P+', x: -40, y: -20, direction: 'passive' },
        { id: 'p_minus', label: 'P-', x: -40, y: 20, direction: 'passive' },
      ],
      defaultProperties: { resistance: 25, maxVoltage: 16.0 },
      propertySchema: [
        { key: 'resistance', label: 'Winding Resistance', type: 'number', unit: 'Ω', min: 5, max: 200, step: 5 },
        { key: 'maxVoltage', label: 'Max Voltage Rating', type: 'number', unit: 'V', min: 6, max: 36, step: 1 },
      ],
    });

    // 4. Incandescent Tungsten Filament Bulb
    this.registerComponent({
      id: 'builtin_filament_bulb',
      name: 'Incandescent Filament Bulb',
      category: 'outputs',
      description: 'Non-polarized 12V / 6W Edison glass globe with tungsten coil filament that glows proportionally to thermal power dissipation',
      tags: ['bulb', 'lamp', 'incandescent', 'filament', 'tungsten', 'light', 'edison', 'outputs'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'LP',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'p1', label: 'P1', x: -20, y: 40, direction: 'passive' },
        { id: 'p2', label: 'P2', x: 20, y: 40, direction: 'passive' },
      ],
      defaultProperties: { resistance: 24, maxVoltage: 15.0, maxPower: 8.0 },
      propertySchema: [
        { key: 'resistance', label: 'Filament Resistance', type: 'number', unit: 'Ω', min: 2, max: 500, step: 2 },
        { key: 'maxVoltage', label: 'Max Voltage Rating', type: 'number', unit: 'V', min: 3, max: 240, step: 1 },
        { key: 'maxPower', label: 'Max Power Rating', type: 'number', unit: 'W', min: 1, max: 100, step: 0.5 },
      ],
    });

    // 5. Wireless RF Radio Transceiver + Antenna (433MHz Wireless Link)
    this.registerComponent({
      id: 'builtin_rf_radio',
      name: 'Wireless RF Radio + Antenna',
      category: 'mcu',
      description: '433MHz / 2.4GHz wireless RF transceiver with whip antenna that bridges TX-to-RX signals across matching RF channels without wires',
      tags: ['rf', 'radio', 'wireless', 'antenna', '433mhz', 'transceiver', 'transmitter', 'receiver', 'mcu', 'sensors', 'outputs'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'RF',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'vcc', label: 'VCC', x: -40, y: -20, direction: 'power' },
        { id: 'gnd', label: 'GND', x: -40, y: 20, direction: 'ground' },
        { id: 'tx', label: 'TX', x: 40, y: -20, direction: 'input' },
        { id: 'rx', label: 'RX', x: 40, y: 20, direction: 'output' },
      ],
      defaultProperties: { rfChannel: 'CH 1 (433.0 MHz)', maxVoltage: 6.5 },
      propertySchema: [
        {
          key: 'rfChannel',
          label: 'RF Channel',
          type: 'select',
          options: [
            { label: 'CH 1 (433.0 MHz)', value: 'CH 1 (433.0 MHz)' },
            { label: 'CH 2 (433.4 MHz)', value: 'CH 2 (433.4 MHz)' },
            { label: 'CH 3 (868 MHz)', value: 'CH 3 (868 MHz)' },
            { label: 'CH 4 (2.4 GHz)', value: 'CH 4 (2.4 GHz)' },
          ],
        },
      ],
    });

    // 6A. Infrared (IR) Transmitter
    this.registerComponent({
      id: 'builtin_ir_tx',
      name: 'Infrared (IR) Transmitter',
      category: 'outputs',
      description: '940nm GaAs Infrared emitter LED shooting modulated IR beam cones to trigger any IR Receiver on canvas',
      tags: ['ir', 'infrared', 'transmitter', 'emitter', 'led', 'remote', 'outputs', 'sensors'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'IR_TX',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'anode', label: 'ANODE', x: -40, y: 0, direction: 'input' },
        { id: 'cathode', label: 'CATHODE', x: 40, y: 0, direction: 'ground' },
      ],
      defaultProperties: { forwardVoltage: 1.4, maxCurrent: 0.05 },
      propertySchema: [
        { key: 'forwardVoltage', label: 'Forward Voltage (Vf)', type: 'number', unit: 'V', min: 1.0, max: 2.0, step: 0.1 },
      ],
    });

    // 6B. Infrared (IR) Receiver Module (TSOP38238)
    this.registerComponent({
      id: 'builtin_ir_rx',
      name: 'Infrared (IR) Receiver (TSOP38238)',
      category: 'sensors',
      description: '38kHz Infrared receiver module triggered wirelessly by any active IR Transmitter LED on canvas or by the IR Remote cursor',
      tags: ['ir', 'infrared', 'receiver', 'tsop38238', 'remote', 'optical', 'sensors'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'IR_RX',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'vcc', label: 'VCC', x: -20, y: 40, direction: 'power' },
        { id: 'gnd', label: 'GND', x: 0, y: 40, direction: 'ground' },
        { id: 'out', label: 'OUT', x: 20, y: 40, direction: 'output' },
      ],
      defaultProperties: { irDetected: false, maxVoltage: 6.5 },
      propertySchema: [
        { key: 'irDetected', label: 'IR Signal Detected', type: 'boolean' },
      ],
    });

    // 7. Hall-Effect Magnetic Sensor (A3144)
    this.registerComponent({
      id: 'builtin_hall_sensor',
      name: 'Hall-Effect Magnetic Sensor (A3144)',
      category: 'sensors',
      description: 'Solid-state magnetic flux sensor responding to the interactive Bar Magnet cursor with live mT Gauss readout',
      tags: ['hall', 'magnetic', 'magnet', 'a3144', 'gauss', 'flux', 'proximity', 'sensors'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'HALL',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'vcc', label: 'VCC', x: -20, y: 40, direction: 'power' },
        { id: 'gnd', label: 'GND', x: 0, y: 40, direction: 'ground' },
        { id: 'out', label: 'OUT', x: 20, y: 40, direction: 'output' },
      ],
      defaultProperties: { magneticField: 0, threshold: 30, maxVoltage: 24.0 },
      propertySchema: [
        { key: 'magneticField', label: 'Magnetic Flux Density', type: 'number', unit: 'mT', min: 0, max: 100, step: 5 },
        { key: 'threshold', label: 'Trigger Threshold', type: 'number', unit: 'mT', min: 5, max: 95, step: 5 },
      ],
    });

    // 8. Vibration / Knock Sensor (SW-420)
    this.registerComponent({
      id: 'builtin_vibration_sensor',
      name: 'Vibration / Knock Sensor (SW-420)',
      category: 'sensors',
      description: 'Piezo/spring-tube vibration and knock detector triggered by the Hammer cursor or direct on-canvas Tap button',
      tags: ['vibration', 'knock', 'shock', 'sw420', 'shake', 'seismic', 'tap', 'sensors'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'VIB',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'vcc', label: 'VCC', x: -20, y: 40, direction: 'power' },
        { id: 'gnd', label: 'GND', x: 0, y: 40, direction: 'ground' },
        { id: 'out', label: 'OUT', x: 20, y: 40, direction: 'output' },
      ],
      defaultProperties: { vibrationDetected: false, pulseDurationMs: 1000, maxVoltage: 6.5 },
      propertySchema: [
        { key: 'vibrationDetected', label: 'Vibration Active', type: 'boolean' },
        { key: 'pulseDurationMs', label: 'Pulse Hold Duration', type: 'number', unit: 'ms', min: 200, max: 5000, step: 100 },
      ],
    });

    // 9. Linear Push-Pull Solenoid Actuator
    this.registerComponent({
      id: 'builtin_solenoid',
      name: 'Linear Push-Pull Solenoid',
      category: 'outputs',
      description: 'Electromagnetic open-frame solenoid coil with spring-return chrome plunger rod that strikes outward by 18px when energized',
      tags: ['solenoid', 'actuator', 'plunger', 'linear', 'coil', 'lock', 'strike', 'outputs'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'SOL_A',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 's_plus', label: 'S+', x: -40, y: -20, direction: 'passive' },
        { id: 's_minus', label: 'S-', x: -40, y: 20, direction: 'passive' },
      ],
      defaultProperties: { resistance: 20, maxVoltage: 18.0 },
      propertySchema: [
        { key: 'resistance', label: 'Coil Resistance', type: 'number', unit: 'Ω', min: 5, max: 100, step: 5 },
        { key: 'maxVoltage', label: 'Max Voltage Rating', type: 'number', unit: 'V', min: 6, max: 36, step: 1 },
      ],
    });

    // 10. 8Ω Dynamic Audio Speaker
    this.registerComponent({
      id: 'builtin_speaker',
      name: '8Ω Dynamic Audio Speaker',
      category: 'outputs',
      description: '8Ω moving-coil woofer cone with acoustic wave animation and optional WebAudio tone synthesis',
      tags: ['speaker', 'audio', 'woofer', 'sound', '8ohm', 'acoustic', 'voicecoil', 'outputs'],
      width: 80,
      height: 80,
      origin: 'center',
      defaultDesignator: 'SPK',
      renderType: 'composite_shapes',
      simulationModel: { type: 'spice' },
      pins: [
        { id: 'sp_plus', label: 'SP+', x: -20, y: 40, direction: 'passive' },
        { id: 'sp_minus', label: 'SP-', x: 20, y: 40, direction: 'passive' },
      ],
      defaultProperties: { resistance: 8, maxPower: 2.0, maxVoltage: 12.0, audioEnabled: false, toneFrequency: 440 },
      propertySchema: [
        { key: 'resistance', label: 'Voice Coil Impedance', type: 'number', unit: 'Ω', min: 4, max: 64, step: 4 },
        { key: 'maxPower', label: 'Max Power Rating', type: 'number', unit: 'W', min: 0.5, max: 20.0, step: 0.5 },
        { key: 'audioEnabled', label: '🔊 Enable WebAudio Sound', type: 'boolean' },
        { key: 'toneFrequency', label: 'Base Tone Frequency', type: 'number', unit: 'Hz', min: 100, max: 4000, step: 20 },
      ],
    });
  }
}

// Export singleton instance
export const ComponentRegistry = new ComponentRegistryClass();
