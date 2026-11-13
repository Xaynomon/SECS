import { McuPinState, SerialLogEntry } from './types';

export interface AsmInstruction {
  op: string;
  arg1?: string;
  arg2?: string;
  line: number;
  raw: string;
}

export interface JunctionCountdownState {
  currentSeconds: number;
  tensValue: number;
  onesValue: number;
}

export interface AsmRegisters {
  acc: number;       // 8-bit Accumulator A (0..255)
  regB: number;      // 8-bit Register B (0..255)
  pc: number;        // Program Counter (instruction index)
  zeroFlag: 0 | 1;   // Z flag
  carryFlag: 0 | 1;  // C flag
  outByte: number;   // 8-bit output latch (OUT0..OUT7)
  inNibble: number;  // 4-bit input state (IN0..IN3)
  halted: boolean;
  currentLine: number;
  currentMnemonic: string;
  junctionCountdowns?: Record<'n' | 'e' | 's' | 'w', JunctionCountdownState>;
}

export interface AsmTemplate {
  id: string;
  name: string;
  description: string;
  code: string;
}

export const ASM_CODE_TEMPLATES: AsmTemplate[] = [
  {
    id: 'asm_counter',
    name: 'Binary Counter on OUT0..OUT7',
    description: 'Counts from 0x00 to 0xFF and outputs the 8-bit binary pattern to OUT0..OUT7.',
    code: `; SECS-808 8-Bit Assembly: Binary Counter
; Outputs an incrementing 8-bit binary value onto OUT0..OUT7

LDA 0          ; Initialize Accumulator A = 0

loop:
  OUT A        ; Drive A onto OUT0..OUT7 pins
  INC A        ; A = A + 1 (sets Z/C flags)
  JMP loop     ; Repeat forever
`,
  },
  {
    id: 'asm_knight_rider',
    name: 'Knight Rider LED Scanner',
    description: 'Shifts a single active bit back and forth across OUT0..OUT7.',
    code: `; SECS-808 8-Bit Assembly: Knight Rider Scanner
; Sweeps a single HIGH bit left and right across OUT0..OUT7

start:
  LDA 1        ; Start with bit 0 (0x01)

scan_left:
  OUT A        ; Output active bit to OUT0..OUT7
  CMP 128      ; Reached bit 7 (0x80)?
  JZ scan_right
  SHL A        ; Shift bit left
  JMP scan_left

scan_right:
  OUT A        ; Output active bit to OUT0..OUT7
  CMP 1        ; Back at bit 0 (0x01)?
  JZ scan_left
  SHR A        ; Shift bit right
  JMP scan_right
`,
  },
  {
    id: 'asm_io_adder',
    name: 'Read IN0..IN3 & Add to OUT',
    description: 'Reads the 4-bit input nibble on IN0..IN3, adds a constant offset, and writes to OUT0..OUT7.',
    code: `; SECS-808 8-Bit Assembly: Hardware Input Adder
; Reads 4-bit binary state of IN0..IN3 into A, adds B, and outputs to OUT0..OUT7

LDB 1          ; Load offset 1 into Register B

main_loop:
  IN A         ; Read 4-bit state of IN0..IN3 into A
  ADD B        ; A = A + B (sets Carry & Zero flags)
  OUT A        ; Write result to OUT0..OUT7
  JMP main_loop
`,
  },
];

function parseImmediate(token: string | undefined): number {
  if (!token) return 0;
  const s = token.trim();
  if (/^0x[0-9a-f]+$/i.test(s)) return parseInt(s, 16) & 0xff;
  if (/^\$[0-9a-f]+$/i.test(s)) return parseInt(s.slice(1), 16) & 0xff;
  if (/^[0-9a-f]+h$/i.test(s)) return parseInt(s.slice(0, -1), 16) & 0xff;
  if (/^0b[01]+$/i.test(s)) return parseInt(s.slice(2), 2) & 0xff;
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n & 0xff;
}

export class AsmRuntime {
  private componentId: string;
  private code: string = '';
  private instructions: AsmInstruction[] = [];
  private labels: Map<string, number> = new Map();

  private registers: AsmRegisters = {
    acc: 0,
    regB: 0,
    pc: 0,
    zeroFlag: 1,
    carryFlag: 0,
    outByte: 0,
    inNibble: 0,
    halted: false,
    currentLine: 1,
    currentMnemonic: 'NOP',
  };

  private pins: Record<string, McuPinState> = {};
  private serialLogs: SerialLogEntry[] = [];
  private lastError: string | undefined = undefined;
  private suspendUntilClockMs: number = 0;
  private lastAutoStepClockMs: number = 0;
  private prevClkPinLevel: 0 | 1 = 0;
  private clkConnected: boolean = false;
  private clockHz: number = 5;

  constructor(componentId: string) {
    this.componentId = componentId;
    this.reset();
  }

  public reset(): void {
    this.registers = {
      acc: 0,
      regB: 0,
      pc: 0,
      zeroFlag: 1,
      carryFlag: 0,
      outByte: 0,
      inNibble: 0,
      halted: false,
      currentLine: this.instructions[0]?.line ?? 1,
      currentMnemonic: this.instructions[0]?.raw ?? 'NOP',
    };
    this.suspendUntilClockMs = 0;
    this.lastAutoStepClockMs = 0;
    this.prevClkPinLevel = 0;
    this.lastError = undefined;
    this.initPins();
    this.syncOutputPins();
  }

  private initPins(): void {
    const inputPins = ['vcc', 'gnd', 'clk', 'rst', 'in0', 'in1', 'in2', 'in3', 'irq'];
    const outputPins = ['rw', 'out0', 'out1', 'out2', 'out3', 'out4', 'out5', 'out6', 'out7', 'zero', 'carry'];

    this.pins = {};
    for (const p of inputPins) {
      this.pins[p] = {
        pinId: p,
        mode: 'INPUT',
        digitalValue: 0,
        analogValue: 0,
        pwmValue: 0,
        voltage: p === 'vcc' ? 5.0 : 0.0,
      };
    }
    for (const p of outputPins) {
      this.pins[p] = {
        pinId: p,
        mode: 'OUTPUT',
        digitalValue: 0,
        value: 0,
        analogValue: 0,
        pwmValue: 0,
        voltage: 0.0,
      };
    }
  }

  private syncOutputPins(rwPulse: boolean = false): void {
    for (let i = 0; i < 8; i++) {
      const bit: 0 | 1 = ((this.registers.outByte >> i) & 1) === 1 ? 1 : 0;
      const pid = `out${i}`;
      this.pins[pid] = {
        pinId: pid,
        mode: 'OUTPUT',
        digitalValue: bit,
        value: bit,
        analogValue: bit ? 1023 : 0,
        pwmValue: bit ? 255 : 0,
        voltage: bit ? 5.0 : 0.0,
      };
    }

    this.pins['zero'] = {
      pinId: 'zero',
      mode: 'OUTPUT',
      digitalValue: this.registers.zeroFlag,
      value: this.registers.zeroFlag,
      analogValue: this.registers.zeroFlag ? 1023 : 0,
      pwmValue: this.registers.zeroFlag ? 255 : 0,
      voltage: this.registers.zeroFlag ? 5.0 : 0.0,
    };

    this.pins['carry'] = {
      pinId: 'carry',
      mode: 'OUTPUT',
      digitalValue: this.registers.carryFlag,
      value: this.registers.carryFlag,
      analogValue: this.registers.carryFlag ? 1023 : 0,
      pwmValue: this.registers.carryFlag ? 255 : 0,
      voltage: this.registers.carryFlag ? 5.0 : 0.0,
    };

    const rwBit: 0 | 1 = rwPulse ? 1 : 0;
    this.pins['rw'] = {
      pinId: 'rw',
      mode: 'OUTPUT',
      digitalValue: rwBit,
      value: rwBit,
      analogValue: rwBit ? 1023 : 0,
      pwmValue: rwBit ? 255 : 0,
      voltage: rwBit ? 5.0 : 0.0,
    };

    // Atomic 4-way junction countdown computation (synchronizes tens & ones on same tick)
    const phaseMask = (this.registers.outByte >> 4) & 0x0f;
    if (phaseMask === 1 || phaseMask === 2 || phaseMask === 4 || phaseMask === 8) {
      const activePhase = phaseMask === 1 ? 0 : phaseMask === 2 ? 1 : phaseMask === 4 ? 2 : 3;
      const rawOnes = this.registers.outByte & 0x0f;
      const phaseSecondsRemaining = rawOnes === 0 ? 10 : rawOnes;
      const keys: Array<'n' | 'e' | 's' | 'w'> = ['n', 'e', 's', 'w'];
      const countdowns = {} as Record<'n' | 'e' | 's' | 'w', JunctionCountdownState>;
      keys.forEach((k, jIdx) => {
        const slot = (jIdx - activePhase + 4) % 4;
        const slotOffset = slot === 0 ? 0 : slot === 1 ? 0 : slot === 2 ? 10 : 20;
        const totalSecondsRemaining = slotOffset + phaseSecondsRemaining;
        const currentSeconds = Math.max(0, Math.round(totalSecondsRemaining));
        const tensValue = Math.floor(currentSeconds / 10);
        const onesValue = currentSeconds % 10;
        countdowns[k] = { currentSeconds, tensValue, onesValue };
      });
      this.registers.junctionCountdowns = countdowns;
    } else {
      this.registers.junctionCountdowns = undefined;
    }
  }

  public compile(asmCode: string): boolean {
    this.code = asmCode;
    this.instructions = [];
    this.labels.clear();
    this.lastError = undefined;

    const lines = asmCode.replace(/\r\n/g, '\n').split('\n');
    const validOps = new Set([
      'MOV', 'LDA', 'LDB', 'ADD', 'SUB', 'INC', 'DEC',
      'AND', 'OR', 'XOR', 'NOT', 'SHL', 'SHR', 'CMP',
      'JMP', 'JZ', 'JE', 'JNZ', 'JNE', 'JC', 'JNC',
      'IN', 'OUT', 'SET', 'CLR', 'WAIT', 'NOP', 'HLT',
    ]);

    for (let idx = 0; idx < lines.length; idx++) {
      const lineNum = idx + 1;
      // Strip comments (; or //)
      let clean = lines[idx].split(';')[0].split('//')[0].trim();
      if (!clean) continue;

      // Extract label if present (e.g. "loop:" or "loop: OUT A")
      const colonIdx = clean.indexOf(':');
      if (colonIdx !== -1) {
        const labelName = clean.slice(0, colonIdx).trim().toLowerCase();
        if (labelName) {
          this.labels.set(labelName, this.instructions.length);
        }
        clean = clean.slice(colonIdx + 1).trim();
        if (!clean) continue;
      }

      // Parse mnemonic and up to 2 operands
      const match = clean.match(/^([A-Za-z]+)(?:\s+(.*))?$/);
      if (!match) {
        this.lastError = `Line ${lineNum}: Syntax error near "${clean}"`;
        this.addLog('error', this.lastError);
        return false;
      }

      const op = match[1].toUpperCase();
      if (!validOps.has(op)) {
        this.lastError = `Line ${lineNum}: Unknown instruction "${op}"`;
        this.addLog('error', this.lastError);
        return false;
      }

      const rest = (match[2] || '').trim();
      let arg1: string | undefined;
      let arg2: string | undefined;
      if (rest) {
        const parts = rest.split(',').map((s) => s.trim()).filter(Boolean);
        arg1 = parts[0];
        arg2 = parts[1];
      }

      this.instructions.push({
        op,
        arg1,
        arg2,
        line: lineNum,
        raw: clean,
      });
    }

    this.reset();
    this.addLog('system', `[ASM] Assembled ${this.instructions.length} instruction(s) cleanly.`);
    return true;
  }

  public setClockConfig(clockHz: number, clkConnected: boolean): void {
    this.clockHz = Math.max(0.5, Math.min(100, clockHz || 5));
    this.clkConnected = clkConnected;
  }

  public updateInputs(pinVoltages: Record<string, number>, pinLogicLevels?: Record<string, 0 | 1 | 'Z' | 'X'>): void {
    const readBit = (pinId: string): 0 | 1 => {
      if (pinLogicLevels && pinLogicLevels[pinId] !== undefined) {
        return pinLogicLevels[pinId] === 1 ? 1 : 0;
      }
      const v = pinVoltages[pinId] ?? 0;
      return v >= 2.0 ? 1 : 0;
    };

    const in0 = readBit('in0');
    const in1 = readBit('in1');
    const in2 = readBit('in2');
    const in3 = readBit('in3');
    this.registers.inNibble = (in0 | (in1 << 1) | (in2 << 2) | (in3 << 3)) & 0x0f;

    for (const pid of ['in0', 'in1', 'in2', 'in3', 'clk', 'rst', 'irq']) {
      const bit = readBit(pid);
      if (this.pins[pid]) {
        this.pins[pid].digitalValue = bit;
        this.pins[pid].voltage = pinVoltages[pid] ?? (bit ? 5.0 : 0.0);
      }
    }
  }

  public step(simClockMs: number): void {
    // Check RST pin (Active HIGH reset)
    if (this.pins['rst']?.digitalValue === 1) {
      this.reset();
      return;
    }

    if (this.registers.halted || this.instructions.length === 0) {
      this.syncOutputPins(false);
      return;
    }

    if (simClockMs < this.suspendUntilClockMs) {
      return;
    }

    // Check IRQ pin: if HIGH and label "irq" exists, jump to irq handler
    if (this.pins['irq']?.digitalValue === 1 && this.labels.has('irq')) {
      this.registers.pc = this.labels.get('irq')!;
    }

    if (this.clkConnected) {
      const clkNow: 0 | 1 = this.pins['clk']?.digitalValue === 1 ? 1 : 0;
      const risingEdge = this.prevClkPinLevel === 0 && clkNow === 1;
      this.prevClkPinLevel = clkNow;
      if (risingEdge) {
        this.executeOneInstruction(simClockMs);
      }
    } else {
      const usesWait = this.instructions.some((ins) => ins.op === 'WAIT');
      if (usesWait) {
        // Execute setup/branch/OUT burst atomically up to the next WAIT instruction
        // so display digits and light outputs latch on the exact same tick.
        this.lastAutoStepClockMs = simClockMs;
        for (let burst = 0; burst < 24; burst++) {
          if (this.registers.halted || simClockMs < this.suspendUntilClockMs) break;
          this.executeOneInstruction(simClockMs);
        }
      } else {
        const periodMs = 1000 / Math.max(0.5, this.clockHz);
        if (simClockMs === 0 || simClockMs - this.lastAutoStepClockMs >= periodMs) {
          this.lastAutoStepClockMs = simClockMs;
          this.executeOneInstruction(simClockMs);
        }
      }
    }
  }

  public executeOneInstruction(simClockMs: number = 0): void {
    if (this.instructions.length === 0 || this.registers.halted) return;

    if (this.registers.pc < 0 || this.registers.pc >= this.instructions.length) {
      this.registers.pc = 0;
    }

    const instr = this.instructions[this.registers.pc];
    this.registers.currentLine = instr.line;
    this.registers.currentMnemonic = instr.raw;

    const resolveVal = (token: string | undefined): number => {
      if (!token) return 0;
      const u = token.toUpperCase();
      if (u === 'A' || u === 'ACC') return this.registers.acc;
      if (u === 'B' || u === 'REGB') return this.registers.regB;
      return parseImmediate(token);
    };

    let nextPc = this.registers.pc + 1;
    let rwPulse = false;

    switch (instr.op) {
      case 'NOP':
        break;

      case 'HLT':
        this.registers.halted = true;
        nextPc = this.registers.pc;
        break;

      case 'LDA': {
        this.registers.acc = resolveVal(instr.arg1);
        this.registers.zeroFlag = this.registers.acc === 0 ? 1 : 0;
        break;
      }

      case 'LDB': {
        this.registers.regB = resolveVal(instr.arg1);
        this.registers.zeroFlag = this.registers.regB === 0 ? 1 : 0;
        break;
      }

      case 'MOV': {
        const dst = (instr.arg1 || 'A').toUpperCase();
        const val = resolveVal(instr.arg2);
        if (dst === 'B' || dst === 'REGB') {
          this.registers.regB = val;
          this.registers.zeroFlag = val === 0 ? 1 : 0;
        } else {
          this.registers.acc = val;
          this.registers.zeroFlag = val === 0 ? 1 : 0;
        }
        break;
      }

      case 'ADD': {
        const opnd = instr.arg2 !== undefined ? resolveVal(instr.arg2) : resolveVal(instr.arg1);
        const sum = this.registers.acc + opnd;
        this.registers.carryFlag = sum > 255 ? 1 : 0;
        this.registers.acc = sum & 0xff;
        this.registers.zeroFlag = this.registers.acc === 0 ? 1 : 0;
        break;
      }

      case 'SUB': {
        const opnd = instr.arg2 !== undefined ? resolveVal(instr.arg2) : resolveVal(instr.arg1);
        const diff = this.registers.acc - opnd;
        this.registers.carryFlag = diff < 0 ? 1 : 0;
        this.registers.acc = diff & 0xff;
        this.registers.zeroFlag = this.registers.acc === 0 ? 1 : 0;
        break;
      }

      case 'INC': {
        const target = (instr.arg1 || 'A').toUpperCase();
        if (target === 'B' || target === 'REGB') {
          const res = this.registers.regB + 1;
          this.registers.carryFlag = res > 255 ? 1 : 0;
          this.registers.regB = res & 0xff;
          this.registers.zeroFlag = this.registers.regB === 0 ? 1 : 0;
        } else {
          const res = this.registers.acc + 1;
          this.registers.carryFlag = res > 255 ? 1 : 0;
          this.registers.acc = res & 0xff;
          this.registers.zeroFlag = this.registers.acc === 0 ? 1 : 0;
        }
        break;
      }

      case 'DEC': {
        const target = (instr.arg1 || 'A').toUpperCase();
        if (target === 'B' || target === 'REGB') {
          const res = this.registers.regB - 1;
          this.registers.carryFlag = res < 0 ? 1 : 0;
          this.registers.regB = res & 0xff;
          this.registers.zeroFlag = this.registers.regB === 0 ? 1 : 0;
        } else {
          const res = this.registers.acc - 1;
          this.registers.carryFlag = res < 0 ? 1 : 0;
          this.registers.acc = res & 0xff;
          this.registers.zeroFlag = this.registers.acc === 0 ? 1 : 0;
        }
        break;
      }

      case 'AND': {
        const opnd = instr.arg2 !== undefined ? resolveVal(instr.arg2) : resolveVal(instr.arg1);
        this.registers.acc = (this.registers.acc & opnd) & 0xff;
        this.registers.carryFlag = 0;
        this.registers.zeroFlag = this.registers.acc === 0 ? 1 : 0;
        break;
      }

      case 'OR': {
        const opnd = instr.arg2 !== undefined ? resolveVal(instr.arg2) : resolveVal(instr.arg1);
        this.registers.acc = (this.registers.acc | opnd) & 0xff;
        this.registers.carryFlag = 0;
        this.registers.zeroFlag = this.registers.acc === 0 ? 1 : 0;
        break;
      }

      case 'XOR': {
        const opnd = instr.arg2 !== undefined ? resolveVal(instr.arg2) : resolveVal(instr.arg1);
        this.registers.acc = (this.registers.acc ^ opnd) & 0xff;
        this.registers.carryFlag = 0;
        this.registers.zeroFlag = this.registers.acc === 0 ? 1 : 0;
        break;
      }

      case 'NOT': {
        this.registers.acc = (~this.registers.acc) & 0xff;
        this.registers.carryFlag = 0;
        this.registers.zeroFlag = this.registers.acc === 0 ? 1 : 0;
        break;
      }

      case 'SHL': {
        this.registers.carryFlag = ((this.registers.acc >> 7) & 1) as 0 | 1;
        this.registers.acc = (this.registers.acc << 1) & 0xff;
        this.registers.zeroFlag = this.registers.acc === 0 ? 1 : 0;
        break;
      }

      case 'SHR': {
        this.registers.carryFlag = (this.registers.acc & 1) as 0 | 1;
        this.registers.acc = (this.registers.acc >> 1) & 0xff;
        this.registers.zeroFlag = this.registers.acc === 0 ? 1 : 0;
        break;
      }

      case 'CMP': {
        const opnd = instr.arg2 !== undefined ? resolveVal(instr.arg2) : resolveVal(instr.arg1);
        this.registers.zeroFlag = this.registers.acc === opnd ? 1 : 0;
        this.registers.carryFlag = this.registers.acc < opnd ? 1 : 0;
        break;
      }

      case 'JMP': {
        const lbl = (instr.arg1 || '').toLowerCase();
        if (this.labels.has(lbl)) {
          nextPc = this.labels.get(lbl)!;
        }
        break;
      }

      case 'JZ':
      case 'JE': {
        const lbl = (instr.arg1 || '').toLowerCase();
        if (this.registers.zeroFlag === 1 && this.labels.has(lbl)) {
          nextPc = this.labels.get(lbl)!;
        }
        break;
      }

      case 'JNZ':
      case 'JNE': {
        const lbl = (instr.arg1 || '').toLowerCase();
        if (this.registers.zeroFlag === 0 && this.labels.has(lbl)) {
          nextPc = this.labels.get(lbl)!;
        }
        break;
      }

      case 'JC': {
        const lbl = (instr.arg1 || '').toLowerCase();
        if (this.registers.carryFlag === 1 && this.labels.has(lbl)) {
          nextPc = this.labels.get(lbl)!;
        }
        break;
      }

      case 'JNC': {
        const lbl = (instr.arg1 || '').toLowerCase();
        if (this.registers.carryFlag === 0 && this.labels.has(lbl)) {
          nextPc = this.labels.get(lbl)!;
        }
        break;
      }

      case 'IN': {
        this.registers.acc = this.registers.inNibble & 0x0f;
        this.registers.zeroFlag = this.registers.acc === 0 ? 1 : 0;
        break;
      }

      case 'OUT': {
        const val = instr.arg1 ? resolveVal(instr.arg1) : this.registers.acc;
        this.registers.outByte = val & 0xff;
        rwPulse = true;
        break;
      }

      case 'SET': {
        const bitIdx = Math.max(0, Math.min(7, parseImmediate(instr.arg1)));
        this.registers.outByte = (this.registers.outByte | (1 << bitIdx)) & 0xff;
        rwPulse = true;
        break;
      }

      case 'CLR': {
        const bitIdx = Math.max(0, Math.min(7, parseImmediate(instr.arg1)));
        this.registers.outByte = (this.registers.outByte & ~(1 << bitIdx)) & 0xff;
        rwPulse = true;
        break;
      }

      case 'WAIT': {
        const ms = Math.max(0, parseInt(instr.arg1 || '100', 10) || 100);
        this.suspendUntilClockMs = simClockMs + ms;
        break;
      }
    }

    if (nextPc >= this.instructions.length) {
      nextPc = 0;
    }
    this.registers.pc = nextPc;
    this.syncOutputPins(rwPulse);
  }

  private addLog(type: 'output' | 'input' | 'system' | 'error', text: string): void {
    this.serialLogs.push({
      id: `asm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestampMs: Date.now(),
      text,
      type,
    });
    if (this.serialLogs.length > 200) {
      this.serialLogs.splice(0, this.serialLogs.length - 200);
    }
  }

  public clearSerialLogs(): void {
    this.serialLogs = [];
  }

  public getRegisters(): AsmRegisters {
    return { ...this.registers };
  }

  public getInstanceData() {
    return {
      componentId: this.componentId,
      type: 'builtin_cpu_8bit' as const,
      code: this.code,
      status: this.lastError ? ('error' as const) : this.registers.halted ? ('paused' as const) : ('running' as const),
      pins: this.pins,
      ledL: (this.registers.outByte & 1) === 1,
      ledOn: true,
      ledTx: false,
      ledRx: false,
      serialLogs: this.serialLogs,
      serialInputBuffer: '',
      lastError: this.lastError,
      runtimeClockMs: 0,
      asmRegisters: { ...this.registers },
    };
  }
}
