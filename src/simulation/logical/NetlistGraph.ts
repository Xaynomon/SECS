import { CircuitComponent, CircuitWire } from '../../types/circuit';
import { ElectricalNet, NetPinRef } from './types';

/**
 * Universally identifies whether a component pin is a Ground Reference pin (0V / Logic 0).
 * Matches all GND, VSS, COM (excluding SPDT switch/relay moving contact poles), and negative supply terminals.
 */
export function isUniversalGroundPin(
  compType: string,
  pinId: string,
  pinLabel?: string
): boolean {
  const idNorm = (pinId || '').trim().toLowerCase();
  const labelNorm = (pinLabel || '').trim().toLowerCase();

  // SPDT switches, relays, and 7-segment displays use 'com'/'com1' for their common load terminal
  if (
    (compType === 'toggle-switch' || compType === 'relay' || compType === 'builtin_relay' || compType === 'display-7seg') &&
    (idNorm === 'com' || idNorm === 'com1')
  ) {
    return false;
  }

  // Relay coil 'gnd' and Traffic Light common-cathode 'gnd' are load return terminals that must be wired to ground
  if (
    (compType === 'relay' ||
      compType === 'builtin_relay' ||
      compType === 'builtin_traffic_light' ||
      compType === 'traffic-light') &&
    idNorm === 'gnd'
  ) {
    return false;
  }

  // Dedicated ground component
  if (compType === 'gnd') {
    return true;
  }

  // DC-DC converter negative terminals act as ground reference when connected
  if (
    (compType === 'builtin_dcdc_converter' || compType === 'dcdc-converter') &&
    (idNorm === 'vin_minus' || idNorm === 'vout_minus')
  ) {
    return true;
  }

  // Negative terminal of DC / Battery / AC sources acts as 0V reference
  if (
    compType === 'dc-source' ||
    compType === 'battery-9v' ||
    compType === 'coin-cell' ||
    compType === 'ac-source'
  ) {
    if (idNorm === 'neg' || idNorm === '-' || idNorm === 'p2' || idNorm === '~ neutral') {
      return true;
    }
  }

  // Any pin whose ID starts with, ends with, or equals GND, VSS, or COM
  if (
    idNorm === 'gnd' ||
    idNorm.startsWith('gnd') ||
    idNorm.endsWith('_gnd') ||
    idNorm.includes('gnd') ||
    idNorm === 'vss' ||
    idNorm.startsWith('vss') ||
    idNorm === 'com' ||
    idNorm.startsWith('com')
  ) {
    return true;
  }

  // Any pin whose label starts with or equals GND, VSS, or COM
  if (
    labelNorm === 'gnd' ||
    labelNorm.startsWith('gnd') ||
    labelNorm.includes(': gnd') ||
    labelNorm === 'vss' ||
    labelNorm.startsWith('vss') ||
    labelNorm === 'com' ||
    labelNorm.startsWith('com')
  ) {
    return true;
  }

  return false;
}

/**
 * Universally identifies MCU and IC constant DC power supply output pins (5V -> 5.0V, 3V3 -> 3.3V).
 */
export function isUniversalSupplyPin(
  compType: string,
  pinId: string,
  pinLabel?: string
): { isSupply: boolean; voltage: number } {
  const idNorm = (pinId || '').trim().toLowerCase();
  const labelNorm = (pinLabel || '').trim().toLowerCase();

  if (compType === 'arduino-uno' || compType === 'esp32' || compType === 'pico') {
    if (
      idNorm === '5v' ||
      idNorm === 'vbus' ||
      idNorm === 'vsys' ||
      idNorm === 'ioref' ||
      labelNorm === '5v' ||
      labelNorm === 'vbus' ||
      labelNorm === 'vsys'
    ) {
      return { isSupply: true, voltage: 5.0 };
    }
    if (
      idNorm === '3v3' ||
      idNorm === '3.3v' ||
      idNorm === 'p3v3' ||
      idNorm === 'vref' ||
      labelNorm === '3v3' ||
      labelNorm === '3.3v'
    ) {
      return { isSupply: true, voltage: 3.3 };
    }
  }

  return { isSupply: false, voltage: 0 };
}

class UnionFind {
  private parent: Map<string, string> = new Map();

  find(item: string): string {
    if (!this.parent.has(item)) {
      this.parent.set(item, item);
      return item;
    }
    const p = this.parent.get(item)!;
    if (p === item) return item;
    const root = this.find(p);
    this.parent.set(item, root);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      this.parent.set(rootA, rootB);
    }
  }

  getAllRoots(): Map<string, string[]> {
    const groups: Map<string, string[]> = new Map();
    for (const key of this.parent.keys()) {
      const root = this.find(key);
      if (!groups.has(root)) {
        groups.set(root, []);
      }
      groups.get(root)!.push(key);
    }
    return groups;
  }
}

/**
 * Builds discrete electrical Nets from circuit components and wires
 */
export function buildNetlistNets(
  components: CircuitComponent[],
  wires: CircuitWire[]
): {
  nets: ElectricalNet[];
  pinToNetMap: Map<string, ElectricalNet>;
  wireToNetMap: Map<string, ElectricalNet>;
} {
  const uf = new UnionFind();
  const compIdSet = new Set(components.map((c) => c.id));

  // 1. Register internal conducting channels for switches & relays
  for (const comp of components) {
    if (comp.type === 'toggle-switch') {
      const state = comp.properties?.state ?? 'T1';
      const comKey = `${comp.id}:com`;
      if (state === 'T1') {
        uf.union(comKey, `${comp.id}:t1`);
      } else if (state === 'T2') {
        uf.union(comKey, `${comp.id}:t2`);
      }
    } else if (comp.type === 'pushbutton') {
      if (comp.properties?.isPressed) {
        uf.union(`${comp.id}:p1`, `${comp.id}:p2`);
      }
    } else if (comp.type === 'relay' || comp.type === 'builtin_relay') {
      const isEngaged = comp.state?.isEngaged ?? comp.properties?.isEngaged;
      if (isEngaged) {
        uf.union(`${comp.id}:com`, `${comp.id}:no`);
      } else {
        uf.union(`${comp.id}:com`, `${comp.id}:nc`);
      }
    } else if (comp.type === 'builtin_dcdc_converter' || comp.type === 'dcdc-converter') {
      // Common ground return between VIN- and VOUT-
      uf.union(`${comp.id}:vin_minus`, `${comp.id}:vout_minus`);
    } else if (comp.type === 'builtin_numpad' || comp.type === 'numpad') {
      const activeKey = String(
        comp.properties?.activeKey ??
          comp.properties?.pressedKey ??
          comp.state?.activeKey ??
          comp.state?.pressedKey ??
          ''
      )
        .trim()
        .toUpperCase();
      const keyMatrix: Record<string, [string, string]> = {
        '1': ['r1', 'c1'], '2': ['r1', 'c2'], '3': ['r1', 'c3'], 'A': ['r1', 'c4'],
        '4': ['r2', 'c1'], '5': ['r2', 'c2'], '6': ['r2', 'c3'], 'B': ['r2', 'c4'],
        '7': ['r3', 'c1'], '8': ['r3', 'c2'], '9': ['r3', 'c3'], 'C': ['r3', 'c4'],
        '*': ['r4', 'c1'], '0': ['r4', 'c2'], '#': ['r4', 'c3'], 'D': ['r4', 'c4'],
      };
      const pair = keyMatrix[activeKey];
      if (pair) {
        uf.union(`${comp.id}:${pair[0]}`, `${comp.id}:${pair[1]}`);
      }
    }
  }

  // 2. Connect pins via placed Wires (only for wires whose both endpoint components exist)
  for (const wire of wires) {
    if (!compIdSet.has(wire.fromCompId) || !compIdSet.has(wire.toCompId)) continue;
    const fromKey = `${wire.fromCompId}:${wire.fromPinId}`;
    const toKey = `${wire.toCompId}:${wire.toPinId}`;
    uf.union(fromKey, toKey);
  }

  // 3. Group pins into Nets
  const groups = uf.getAllRoots();
  const nets: ElectricalNet[] = [];
  const pinToNetMap: Map<string, ElectricalNet> = new Map();
  const wireToNetMap: Map<string, ElectricalNet> = new Map();

  let netIndex = 0;
  for (const [_root, pinKeys] of groups.entries()) {
    const netId = `net_${netIndex++}`;
    const pins: NetPinRef[] = [];

    for (const key of pinKeys) {
      const [compId, pinId] = key.split(':');
      pins.push({ compId, pinId });
    }

    const net: ElectricalNet = {
      id: netId,
      pins,
      wireIds: [],
      level: 'Z',
      contention: false,
      driverCount: 0,
      driverValues: [],
      hasHighPath: false,
      hasGroundReturn: false,
      isActiveFlow: false,
    };

    nets.push(net);

    for (const key of pinKeys) {
      pinToNetMap.set(key, net);
      const [cId, pId] = key.split(':');
      if (cId && pId) {
        pinToNetMap.set(`${cId}:${pId.toLowerCase()}`, net);
        pinToNetMap.set(`${cId}:${pId.toUpperCase()}`, net);
      }
    }
  }

  // 4. Map wires to their respective Net
  for (const wire of wires) {
    if (!compIdSet.has(wire.fromCompId) || !compIdSet.has(wire.toCompId)) continue;
    const fromKey = `${wire.fromCompId}:${wire.fromPinId}`;
    const net = pinToNetMap.get(fromKey) || pinToNetMap.get(`${wire.fromCompId}:${wire.fromPinId.toLowerCase()}`);
    if (net) {
      net.wireIds.push(wire.id);
      wireToNetMap.set(wire.id, net);
    }
  }

  return { nets, pinToNetMap, wireToNetMap };
}
