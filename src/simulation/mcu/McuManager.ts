import { CircuitComponent, CircuitWire } from '../../types/circuit';
import { ArduinoRuntime } from './arduinoRuntime';
import { AsmRuntime, ASM_CODE_TEMPLATES } from './asmRuntime';
import { MCU_CODE_TEMPLATES } from './templates';
import { McuInstanceData, McuType } from './types';

export function isMcuComponentType(type: string): boolean {
  return (
    type === 'arduino-uno' ||
    type === 'esp32' ||
    type === 'pico' ||
    type === 'builtin_cpu_8bit' ||
    type === 'cpu-8bit' ||
    type === 'cpu_8bit'
  );
}

export function isAsmCpuComponentType(type: string): boolean {
  return type === 'builtin_cpu_8bit' || type === 'cpu-8bit' || type === 'cpu_8bit';
}

export class McuManager {
  private static instance: McuManager;
  private runtimes: Map<string, ArduinoRuntime> = new Map();
  private asmRuntimes: Map<string, AsmRuntime> = new Map();

  private constructor() {}

  public static getInstance(): McuManager {
    if (!McuManager.instance) {
      McuManager.instance = new McuManager();
    }
    return McuManager.instance;
  }

  public getOrCreateRuntime(component: CircuitComponent): ArduinoRuntime {
    let runtime = this.runtimes.get(component.id);
    const mcuType: McuType =
      component.type === 'esp32'
        ? 'esp32'
        : component.type === 'pico'
        ? 'pico'
        : 'arduino-uno';

    if (!runtime) {
      runtime = new ArduinoRuntime(component.id, mcuType);
      const code = component.properties?.code || MCU_CODE_TEMPLATES[0].code;
      runtime.compile(code);
      this.runtimes.set(component.id, runtime);
    }
    return runtime;
  }

  public getOrCreateAsmRuntime(component: CircuitComponent): AsmRuntime {
    let runtime = this.asmRuntimes.get(component.id);
    if (!runtime) {
      runtime = new AsmRuntime(component.id);
      const code = component.properties?.code || ASM_CODE_TEMPLATES[0].code;
      runtime.compile(code);
      this.asmRuntimes.set(component.id, runtime);
    }
    return runtime;
  }

  public getRuntime(componentId: string): ArduinoRuntime | undefined {
    return this.runtimes.get(componentId);
  }

  public getAsmRuntime(componentId: string): AsmRuntime | undefined {
    return this.asmRuntimes.get(componentId);
  }

  public removeRuntime(componentId: string): void {
    this.runtimes.delete(componentId);
    this.asmRuntimes.delete(componentId);
  }

  public resetAll(): void {
    for (const runtime of this.runtimes.values()) {
      runtime.reset();
    }
    for (const asm of this.asmRuntimes.values()) {
      asm.reset();
    }
  }

  public clear(): void {
    this.runtimes.clear();
    this.asmRuntimes.clear();
  }

  /**
   * Syncs active canvas MCUs and cleans up stale runtimes
   */
  public syncComponents(components: CircuitComponent[]): void {
    const activeIds = new Set(
      components.filter((c) => isMcuComponentType(c.type)).map((c) => c.id)
    );

    for (const id of Array.from(this.runtimes.keys())) {
      if (!activeIds.has(id)) {
        this.runtimes.delete(id);
      }
    }
    for (const id of Array.from(this.asmRuntimes.keys())) {
      if (!activeIds.has(id)) {
        this.asmRuntimes.delete(id);
      }
    }
  }

  /**
   * Steps all active MCUs & Assembly CPUs with the current simulation clock
   */
  public stepAll(
    simClockMs: number,
    components: CircuitComponent[],
    pinVoltagesByComp: Map<string, Record<string, number>>,
    wires?: CircuitWire[]
  ): Map<string, McuInstanceData> {
    this.syncComponents(components);
    const results = new Map<string, McuInstanceData>();

    const mcuComps = components.filter((c) => isMcuComponentType(c.type));

    // Find active keypad key across canvas numpads (if any)
    const activeKeypadComp = components.find(
      (c) => (c.type === 'builtin_numpad' || c.type === 'numpad') && c.properties?.activeKey
    );
    const activeKeypadKey = activeKeypadComp?.properties?.activeKey || '';

    for (const comp of mcuComps) {
      if (isAsmCpuComponentType(comp.type)) {
        const asmRuntime = this.getOrCreateAsmRuntime(comp);
        const currentCode = comp.properties?.code || ASM_CODE_TEMPLATES[0].code;
        const instanceData = asmRuntime.getInstanceData();
        if (instanceData.code !== currentCode) {
          asmRuntime.compile(currentCode);
        }

        const clkConnected = Boolean(
          wires?.some(
            (w) =>
              (w.fromCompId === comp.id && w.fromPinId.toLowerCase() === 'clk') ||
              (w.toCompId === comp.id && w.toPinId.toLowerCase() === 'clk')
          )
        );
        const clockHz = typeof comp.properties?.clockHz === 'number' ? comp.properties.clockHz : 5;
        asmRuntime.setClockConfig(clockHz, clkConnected);

        const voltages = pinVoltagesByComp.get(comp.id) || {};
        const pinSignals = comp.state?.pinSignals as Record<string, 0 | 1 | 'Z' | 'X'> | undefined;
        asmRuntime.updateInputs(voltages, pinSignals);

        asmRuntime.step(simClockMs);
        results.set(comp.id, asmRuntime.getInstanceData());
      } else {
        const runtime = this.getOrCreateRuntime(comp);
        runtime.setActiveKeypadKey(activeKeypadKey);

        // Check if code was updated in component properties
        const currentCode = comp.properties?.code || MCU_CODE_TEMPLATES[0].code;
        const instanceData = runtime.getInstanceData();
        if (instanceData.code !== currentCode) {
          runtime.compile(currentCode);
        }

        // Feed input voltages
        const voltages = pinVoltagesByComp.get(comp.id);
        if (voltages) {
          runtime.updateInputs(voltages);
        }

        // Step runtime
        runtime.step(simClockMs);
        const nextInstanceData = runtime.getInstanceData();
        runtime.consumeSdWrites();
        results.set(comp.id, nextInstanceData);
      }
    }

    return results;
  }

  public sendSerialInput(componentId: string, text: string): void {
    const runtime = this.runtimes.get(componentId);
    if (runtime) {
      runtime.sendSerialInput(text);
    }
  }

  public clearSerialLogs(componentId: string): void {
    const runtime = this.runtimes.get(componentId);
    if (runtime) {
      runtime.clearSerialLogs();
    }
    const asm = this.asmRuntimes.get(componentId);
    if (asm) {
      asm.clearSerialLogs();
    }
  }

  public updateCode(componentId: string, code: string, mcuType: McuType = 'arduino-uno'): boolean {
    if (mcuType === 'builtin_cpu_8bit' || mcuType === 'cpu-8bit') {
      let asm = this.asmRuntimes.get(componentId);
      if (!asm) {
        asm = new AsmRuntime(componentId);
        this.asmRuntimes.set(componentId, asm);
      }
      return asm.compile(code);
    }

    let runtime = this.runtimes.get(componentId);
    if (!runtime) {
      runtime = new ArduinoRuntime(componentId, mcuType);
      this.runtimes.set(componentId, runtime);
    }
    return runtime.compile(code);
  }
}
