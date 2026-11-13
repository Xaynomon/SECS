import { McuInstanceData, McuPeripheralState, McuPinMode, McuPinState, McuType, SerialLogEntry } from './types';

export interface RuntimeContext {
  mcuId: string;
  mcuType: McuType;
  simClockMs: number;
  pins: Record<string, McuPinState>;
  ledL: boolean;
  ledOn: boolean;
  ledTx: boolean;
  ledRx: boolean;
  serialLogs: SerialLogEntry[];
  serialInputBuffer: string;
}

export interface StepResult {
  pins: Record<string, McuPinState>;
  ledL: boolean;
  ledOn: boolean;
  ledTx: boolean;
  ledRx: boolean;
  serialLogs: SerialLogEntry[];
  serialInputBuffer: string;
  error?: string;
  peripheralState?: McuPeripheralState;
}

/**
 * Normalizes pin identifiers across Arduino and ESP32:
 * 13, "13", "D13", "d13" -> "d13"
 * 0, "A0", "a0" -> "a0"
 * "GPIO2", "g2", "2" -> "g2"
 */
export function normalizePin(pin: any, mcuType: McuType = 'arduino-uno'): string {
  if (pin === null || pin === undefined) return 'd13';
  let str = String(pin).trim().toLowerCase().replace(/^~/, '');

  if (str === 'vin' || str === '5v' || str === '3v3' || str.startsWith('gnd')) {
    return str;
  }

  if (mcuType === 'pico') {
    if (/^\d+$/.test(str)) return `gp${str}`;
    if (str.startsWith('gpio')) return `gp${str.substring(4)}`;
    if (str.startsWith('g') && !str.startsWith('gp') && /^\d+$/.test(str.substring(1))) return `gp${str.substring(1)}`;
    if (str.startsWith('gp')) return str;
    return str;
  }

  // Analog pins: a0..a5
  if (/^a\d+$/i.test(str)) {
    return str.toLowerCase();
  }

  // Pure numbers (e.g. 13, 12, 2)
  if (/^\d+$/.test(str)) {
    return `d${str}`;
  }

  // "pin 13", "gpio13", "d13"
  const m = str.match(/^(?:pin|gpio|d)?(\d+)$/i);
  if (m) {
    return `d${m[1]}`;
  }

  return str;
}

/**
 * Transpiles Arduino C++ code to JavaScript generator functions
 */
export function transpileArduinoCode(cppCode: string): string {
  let code = cppCode;

  // 1. Remove carriage returns
  code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Handle #define FOO BAR -> const FOO = BAR;
  code = code.replace(/^[ \t]*#define[ \t]+([A-Za-z0-9_]+)[ \t]+([^\n]+)$/gm, 'const $1 = $2;');

  // 3. Comment out #include statements
  code = code.replace(/^[ \t]*#include[ \t]+[^\n]+$/gm, '// (header included automatically)');

  // 4. Convert C++ variable declarations
  // const type name = val -> const name = val
  const typeKeywords = 'int|float|double|long|unsigned\\s+long|unsigned\\s+int|char|byte|boolean|bool|String|short|word|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|size_t';
  
  const constTypeRegex = new RegExp(`\\bconst\\s+(?:${typeKeywords})\\s+`, 'g');
  code = code.replace(constTypeRegex, 'const ');

  const varTypeRegex = new RegExp(`\\b(?:${typeKeywords})\\s+([A-Za-z0-9_]+)(\\s*[\\[=;,])`, 'g');
  code = code.replace(varTypeRegex, 'let $1$2');

  // Support Servo instance declarations: "Servo myServo;" -> "const myServo = Servo.createInstance();"
  code = code.replace(/\bServo\s+([A-Za-z0-9_]+)\s*;/g, 'const $1 = Servo.createInstance();');

  // 5. Convert void setup() and void loop() to generator functions
  code = code.replace(/\bvoid\s+setup\s*\(\s*\)/g, 'function* setup()');
  code = code.replace(/\bvoid\s+loop\s*\(\s*\)/g, 'function* loop()');

  // Also convert other void/type functions if any
  code = code.replace(/\bvoid\s+([A-Za-z0-9_]+)\s*\(/g, 'function $1(');

  // 6. Convert delay(ms) and delayMicroseconds(us) with balanced parenthesis parsing
  const replaceBalancedCalls = (
    src: string,
    functionName: string,
    replacer: (inner: string) => string
  ): string => {
    const pattern = new RegExp(`\\b${functionName}\\s*\\(`, 'g');
    let result = '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(src)) !== null) {
      const startIdx = match.index;
      const parenStart = startIdx + match[0].length;
      let depth = 1;
      let endIdx = parenStart;

      while (endIdx < src.length && depth > 0) {
        if (src[endIdx] === '(') depth++;
        else if (src[endIdx] === ')') depth--;
        endIdx++;
      }

      if (depth === 0) {
        const inner = src.substring(parenStart, endIdx - 1);
        let afterParen = endIdx;
        while (afterParen < src.length && /\s/.test(src[afterParen])) {
          afterParen++;
        }
        let trailingSemicolon = false;
        if (src[afterParen] === ';') {
          trailingSemicolon = true;
          afterParen++;
        }

        result += src.substring(lastIndex, startIdx);
        result += replacer(inner) + (trailingSemicolon ? ';' : '');
        lastIndex = afterParen;
        pattern.lastIndex = afterParen;
      } else {
        result += src.substring(lastIndex, parenStart);
        lastIndex = parenStart;
      }
    }

    result += src.substring(lastIndex);
    return result;
  };

  code = replaceBalancedCalls(code, 'delay', (inner) => `yield { op: "delay", ms: (${inner}) }`);
  code = replaceBalancedCalls(code, 'delayMicroseconds', (inner) => `yield { op: "delay", ms: (${inner}) / 1000 }`);

  // 7. Wrap into exportable module function
  return `
return (function(context) {
  const {
    pinMode, digitalWrite, digitalRead, analogRead, analogWrite,
    delay, delayMicroseconds, millis, micros, Serial, OLED, LCD, SD, Servo, Keypad,
    map, constrain, min, max, abs, sq, sqrt,
    HIGH, LOW, INPUT, OUTPUT, INPUT_PULLUP, LED_BUILTIN,
    A0, A1, A2, A3, A4, A5,
    D0, D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, D12, D13
  } = context;

  ${code}

  return {
    setup: typeof setup === 'function' ? setup : (function*() {}),
    loop: typeof loop === 'function' ? loop : (function*() {})
  };
});
`;
}

export class ArduinoRuntime {
  private componentId: string;
  private mcuType: McuType;
  private code: string = '';
  private compiledProgram: any = null;

  private setupGen: Generator<any, any, any> | null = null;
  private loopGen: Generator<any, any, any> | null = null;
  private isSetupDone: boolean = false;
  private suspendUntilClockMs: number = 0;

  // Runtime State
  private pins: Record<string, McuPinState> = {};
  private ledL: boolean = false;
  private ledOn: boolean = true;
  private ledTx: boolean = false;
  private ledRx: boolean = false;
  private txPulseEndTime: number = 0;
  private rxPulseEndTime: number = 0;

  private serialLogs: SerialLogEntry[] = [];
  private serialInputBuffer: string = '';
  private lastError: string | undefined = undefined;

  // Peripheral State (OLED, LCD, SD, Servo, Keypad)
  private oledLines: string[] = [];
  private oledCurrentLine: string = '';
  private oledProgressBar: number | null = null;
  private oledUpdated: boolean = false;

  private lcdRows: [string, string] = ['', ''];
  private lcdCursorCol: number = 0;
  private lcdCursorRow: number = 0;
  private lcdUpdated: boolean = false;

  private sdPendingWrites: Array<{ filename: string; text: string; append: boolean }> = [];
  private servoAnglesByPin: Record<string, number> = {};
  private defaultServoAngle: number | undefined = undefined;
  private activeKeypadKey: string = '';

  constructor(componentId: string, mcuType: McuType = 'arduino-uno') {
    this.componentId = componentId;
    this.mcuType = mcuType;
    this.reset();
  }

  public reset(): void {
    this.setupGen = null;
    this.loopGen = null;
    this.isSetupDone = false;
    this.suspendUntilClockMs = 0;
    this.lastError = undefined;
    this.ledL = false;
    this.ledOn = true;
    this.ledTx = false;
    this.ledRx = false;
    this.txPulseEndTime = 0;
    this.rxPulseEndTime = 0;
    this.pins = {};
    this.oledLines = [];
    this.oledCurrentLine = '';
    this.oledProgressBar = null;
    this.oledUpdated = false;
    this.lcdRows = ['', ''];
    this.lcdCursorCol = 0;
    this.lcdCursorRow = 0;
    this.lcdUpdated = false;
    this.sdPendingWrites = [];
    this.servoAnglesByPin = {};
    this.defaultServoAngle = undefined;

    // Initialize default pins
    const defaultPins = this.mcuType === 'esp32'
      ? [
          '3v3', 'gnd_l', 'd15', 'd2', 'd4', 'rx2', 'tx2', 'd5', 'd18', 'd19', 'd21', 'rx0', 'tx0', 'd22', 'd23',
          'vin', 'gnd_r', 'd13', 'd12', 'd14', 'd27', 'd26', 'd25', 'd33', 'd32', 'd35', 'd34', 'vn', 'vp', 'en'
        ]
      : ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10', 'd11', 'd12', 'd13', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'scl', 'sda', 'aref', 'ioref', 'reset', '5v', '3v3', 'vin', 'gnd1', 'gnd2', 'gnd3'];

    for (const p of defaultPins) {
      this.pins[p] = {
        pinId: p,
        mode: 'INPUT',
        digitalValue: 0,
        analogValue: 0,
        pwmValue: 0,
        voltage: 0.0,
      };
    }

    if (this.code) {
      this.compile(this.code);
    }
  }

  public compile(code: string): boolean {
    this.code = code;
    this.lastError = undefined;

    try {
      const transpiled = transpileArduinoCode(code);
      const factory = new Function(transpiled)();
      this.compiledProgram = factory;
      this.setupGen = null;
      this.loopGen = null;
      this.isSetupDone = false;
      this.suspendUntilClockMs = 0;
      return true;
    } catch (err: any) {
      this.lastError = `Compile Error: ${err?.message || err}`;
      this.addLog('system', `[Compiler] ${this.lastError}`);
      this.compiledProgram = null;
      return false;
    }
  }

  public sendSerialInput(text: string): void {
    this.serialInputBuffer += text;
    this.ledRx = true;
    this.rxPulseEndTime = Date.now() + 150;
    this.addLog('input', text);
  }

  public clearSerialLogs(): void {
    this.serialLogs = [];
  }

  private addLog(type: 'output' | 'input' | 'system' | 'error', text: string): void {
    const entry: SerialLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestampMs: Date.now(),
      text,
      type,
    };
    this.serialLogs.push(entry);
    // Keep last 500 lines
    if (this.serialLogs.length > 500) {
      this.serialLogs.splice(0, this.serialLogs.length - 500);
    }
  }

  /**
   * Updates pin input voltages/states received from SPICE/Logical simulation
   */
  public updateInputs(pinVoltages: Record<string, number>): void {
    for (const [pinId, v] of Object.entries(pinVoltages)) {
      const norm = normalizePin(pinId, this.mcuType);
      const pin = this.pins[norm];
      if (pin) {
        if (pin.mode === 'INPUT' || pin.mode === 'INPUT_PULLUP') {
          pin.voltage = v;
          pin.digitalValue = v >= 2.5 ? 1 : 0;
          pin.analogValue = Math.min(1023, Math.max(0, Math.round((v / 5.0) * 1023)));
        }
      }
    }
  }

  /**
   * Advances the microcontroller execution by one simulation step
   */
  public step(simClockMs: number): StepResult {
    // Pulse LEDs check
    const now = Date.now();
    if (this.ledTx && now >= this.txPulseEndTime) this.ledTx = false;
    if (this.ledRx && now >= this.rxPulseEndTime) this.ledRx = false;

    if (!this.compiledProgram) {
      return this.getState();
    }

    if (simClockMs < this.suspendUntilClockMs) {
      // Still in delay()
      return this.getState();
    }

    // Build context object to execute user code
    const vcc = this.mcuType === 'esp32' ? 3.3 : 5.0;

    const context = {
      HIGH: 1,
      LOW: 0,
      INPUT: 'INPUT',
      OUTPUT: 'OUTPUT',
      INPUT_PULLUP: 'INPUT_PULLUP',
      LED_BUILTIN: 13,

      A0: 'a0', A1: 'a1', A2: 'a2', A3: 'a3', A4: 'a4', A5: 'a5',
      D0: 'd0', D1: 'd1', D2: 'd2', D3: 'd3', D4: 'd4', D5: 'd5',
      D6: 'd6', D7: 'd7', D8: 'd8', D9: 'd9', D10: 'd10', D11: 'd11',
      D12: 'd12', D13: 'd13',

      pinMode: (pin: any, mode: McuPinMode) => {
        const p = normalizePin(pin, this.mcuType);
        if (!this.pins[p]) {
          this.pins[p] = { pinId: p, mode, digitalValue: 0, analogValue: 0, pwmValue: 0, voltage: 0 };
        } else {
          this.pins[p].mode = mode;
        }
        if (mode === 'INPUT_PULLUP' && this.pins[p].voltage === 0) {
          this.pins[p].voltage = vcc;
          this.pins[p].digitalValue = 1;
        }
      },

      digitalWrite: (pin: any, val: any) => {
        const p = normalizePin(pin, this.mcuType);
        const bit: 0 | 1 =
          val === 1 || val === 'HIGH' || val === true || (typeof val === 'number' && val > 0) ? 1 : 0;
        if (!this.pins[p]) {
          this.pins[p] = { pinId: p, mode: 'OUTPUT', digitalValue: bit, value: bit, analogValue: bit ? 1023 : 0, pwmValue: bit ? 255 : 0, voltage: bit ? vcc : 0 };
        } else {
          this.pins[p].mode = 'OUTPUT';
          this.pins[p].digitalValue = bit;
          this.pins[p].value = bit;
          this.pins[p].pwmValue = bit ? 255 : 0;
          this.pins[p].voltage = bit ? vcc : 0.0;
        }

        // On-board LED indicator
        if (p === 'd13' || (this.mcuType === 'esp32' && (p === 'g2' || p === 'g25'))) {
          this.ledL = bit === 1;
        }
      },

      digitalRead: (pin: any): number => {
        const p = normalizePin(pin, this.mcuType);
        const pinState = this.pins[p];
        if (!pinState) return 0;
        if (pinState.mode === 'INPUT_PULLUP' && pinState.voltage === undefined) {
          return 1;
        }
        return pinState.digitalValue !== undefined ? pinState.digitalValue : ((pinState as any).value ?? 0);
      },

      analogRead: (pin: any): number => {
        const p = normalizePin(pin, this.mcuType);
        const pinState = this.pins[p];
        if (!pinState) return 0;
        return pinState.analogValue;
      },

      analogWrite: (pin: any, val: number) => {
        const p = normalizePin(pin, this.mcuType);
        const pwm = Math.max(0, Math.min(255, Math.round(Number(val) || 0)));
        const v = (pwm / 255.0) * vcc;
        const bitVal = pwm > 127 ? 1 : 0;
        if (!this.pins[p]) {
          this.pins[p] = { pinId: p, mode: 'OUTPUT', digitalValue: bitVal, value: bitVal, analogValue: Math.round((pwm / 255) * 1023), pwmValue: pwm, voltage: v };
        } else {
          this.pins[p].mode = 'OUTPUT';
          this.pins[p].pwmValue = pwm;
          this.pins[p].voltage = v;
          this.pins[p].digitalValue = bitVal;
          this.pins[p].value = bitVal;
        }
        if (p === 'd13') {
          this.ledL = pwm > 20;
        }
      },

      delay: (ms: any) => {
        const d = Math.max(0, Number(ms) || 0);
        this.suspendUntilClockMs = Math.max(this.suspendUntilClockMs, simClockMs + d);
      },
      delayMicroseconds: (us: any) => {
        const d = Math.max(0, (Number(us) || 0) / 1000);
        this.suspendUntilClockMs = Math.max(this.suspendUntilClockMs, simClockMs + d);
      },

      millis: () => Math.round(simClockMs),
      micros: () => Math.round(simClockMs * 1000),

      String: (val: any, decimals?: number) => {
        if (typeof val === 'number' && typeof decimals === 'number') return val.toFixed(decimals);
        return String(val ?? '');
      },
      round: Math.round,
      floor: Math.floor,
      ceil: Math.ceil,

      map: (x: number, in_min: number, in_max: number, out_min: number, out_max: number) => {
        if (in_max === in_min) return out_min;
        return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
      },
      constrain: (x: number, a: number, b: number) => Math.max(a, Math.min(b, x)),
      min: Math.min,
      max: Math.max,
      abs: Math.abs,
      sq: (x: number) => x * x,
      sqrt: Math.sqrt,

      Serial: {
        begin: (_baud: number) => {
          // Serial initialized
        },
        print: (msg: any) => {
          const str = String(msg ?? '');
          this.addLog('output', str);
          this.ledTx = true;
          this.txPulseEndTime = Date.now() + 150;
        },
        println: (msg: any) => {
          const str = String(msg ?? '');
          this.addLog('output', str);
          this.ledTx = true;
          this.txPulseEndTime = Date.now() + 150;
        },
        available: () => this.serialInputBuffer.length,
        read: () => {
          if (!this.serialInputBuffer.length) return -1;
          const char = this.serialInputBuffer.charCodeAt(0);
          this.serialInputBuffer = this.serialInputBuffer.slice(1);
          this.ledRx = true;
          this.rxPulseEndTime = Date.now() + 150;
          return char;
        },
        readString: () => {
          const s = this.serialInputBuffer;
          this.serialInputBuffer = '';
          this.ledRx = true;
          this.rxPulseEndTime = Date.now() + 150;
          return s;
        },
        readStringUntil: (terminator: string) => {
          const idx = this.serialInputBuffer.indexOf(terminator);
          if (idx === -1) {
            const s = this.serialInputBuffer;
            this.serialInputBuffer = '';
            return s;
          }
          const s = this.serialInputBuffer.substring(0, idx);
          this.serialInputBuffer = this.serialInputBuffer.substring(idx + 1);
          return s;
        },
      },

      OLED: {
        begin: () => {
          this.oledUpdated = true;
        },
        clear: () => {
          this.oledLines = [];
          this.oledCurrentLine = '';
          this.oledProgressBar = null;
          this.oledUpdated = true;
        },
        print: (msg: any) => {
          this.oledCurrentLine += String(msg ?? '');
          this.oledUpdated = true;
        },
        println: (msg: any) => {
          const full = this.oledCurrentLine + String(msg ?? '');
          this.oledCurrentLine = '';
          const parts = full.split('\n');
          for (const part of parts) {
            this.oledLines.push(part);
          }
          if (this.oledLines.length > 4) {
            this.oledLines = this.oledLines.slice(this.oledLines.length - 4);
          }
          this.oledUpdated = true;
        },
        setCursor: (_x: number, _y: number) => {},
        drawProgressBar: (val: number) => {
          this.oledProgressBar = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
          this.oledUpdated = true;
        },
        display: () => {
          this.oledUpdated = true;
        },
      },

      LCD: {
        begin: (_cols?: number, _rows?: number) => {
          this.lcdUpdated = true;
        },
        clear: () => {
          this.lcdRows = ['', ''];
          this.lcdCursorCol = 0;
          this.lcdCursorRow = 0;
          this.lcdUpdated = true;
        },
        setCursor: (col: number, row: number) => {
          this.lcdCursorCol = Math.max(0, Math.min(15, Math.round(Number(col) || 0)));
          this.lcdCursorRow = Math.max(0, Math.min(1, Math.round(Number(row) || 0)));
        },
        print: (msg: any) => {
          const str = String(msg ?? '');
          const r = this.lcdCursorRow === 1 ? 1 : 0;
          const existing = this.lcdRows[r].padEnd(this.lcdCursorCol, ' ');
          const prefix = existing.slice(0, this.lcdCursorCol);
          const suffix = existing.slice(this.lcdCursorCol + str.length);
          this.lcdRows[r] = (prefix + str + suffix).slice(0, 16);
          this.lcdCursorCol = Math.min(16, this.lcdCursorCol + str.length);
          this.lcdUpdated = true;
        },
        println: (msg: any) => {
          const str = String(msg ?? '');
          const r = this.lcdCursorRow === 1 ? 1 : 0;
          this.lcdRows[r] = str.slice(0, 16);
          this.lcdCursorRow = r === 0 ? 1 : 0;
          this.lcdCursorCol = 0;
          this.lcdUpdated = true;
        },
      },

      SD: {
        begin: (_csPin?: any) => true,
        print: (arg1: any, arg2?: any) => {
          const hasFile = arg2 !== undefined;
          this.sdPendingWrites.push({
            filename: hasFile ? String(arg1 || 'log.csv') : 'log.csv',
            text: String((hasFile ? arg2 : arg1) ?? ''),
            append: true,
          });
        },
        println: (arg1: any, arg2?: any) => {
          const hasFile = arg2 !== undefined;
          this.sdPendingWrites.push({
            filename: hasFile ? String(arg1 || 'log.csv') : 'log.csv',
            text: `${String((hasFile ? arg2 : arg1) ?? '')}\n`,
            append: true,
          });
        },
        writeFile: (filename: string, content: any) => {
          this.sdPendingWrites.push({
            filename: String(filename || 'data.txt'),
            text: String(content ?? ''),
            append: false,
          });
        },
      },

      Servo: {
        write: (pinOrAngle: any, maybeAngle?: number) => {
          if (maybeAngle !== undefined) {
            const p = normalizePin(pinOrAngle, this.mcuType);
            const deg = Math.max(0, Math.min(180, Math.round(Number(maybeAngle) || 0)));
            this.servoAnglesByPin[p] = deg;
            this.defaultServoAngle = deg;
            const v = (deg / 180) * vcc;
            if (!this.pins[p]) {
              this.pins[p] = { pinId: p, mode: 'OUTPUT', digitalValue: deg > 0 ? 1 : 0, value: deg > 0 ? 1 : 0, analogValue: Math.round((deg / 180) * 1023), pwmValue: Math.round((deg / 180) * 255), voltage: v, servoAngle: deg };
            } else {
              this.pins[p].mode = 'OUTPUT';
              this.pins[p].servoAngle = deg;
              this.pins[p].voltage = v;
              this.pins[p].digitalValue = deg > 0 ? 1 : 0;
              this.pins[p].value = deg > 0 ? 1 : 0;
            }
          } else {
            const deg = Math.max(0, Math.min(180, Math.round(Number(pinOrAngle) || 0)));
            this.defaultServoAngle = deg;
            for (const p of Object.keys(this.servoAnglesByPin)) {
              this.servoAnglesByPin[p] = deg;
              if (this.pins[p]) {
                this.pins[p].servoAngle = deg;
                this.pins[p].voltage = (deg / 180) * vcc;
                this.pins[p].digitalValue = deg > 0 ? 1 : 0;
              }
            }
          }
        },
        createInstance: () => {
          let attachedPin = 'd9';
          return {
            attach: (pin: any) => {
              attachedPin = normalizePin(pin, this.mcuType);
              if (this.servoAnglesByPin[attachedPin] === undefined) {
                this.servoAnglesByPin[attachedPin] = 90;
              }
            },
            write: (angle: number) => {
              const deg = Math.max(0, Math.min(180, Math.round(Number(angle) || 0)));
              this.servoAnglesByPin[attachedPin] = deg;
              this.defaultServoAngle = deg;
              const v = (deg / 180) * vcc;
              if (!this.pins[attachedPin]) {
                this.pins[attachedPin] = {
                  pinId: attachedPin,
                  mode: 'OUTPUT',
                  digitalValue: deg > 0 ? 1 : 0,
                  value: deg > 0 ? 1 : 0,
                  analogValue: Math.round((deg / 180) * 1023),
                  pwmValue: Math.round((deg / 180) * 255),
                  voltage: v,
                  servoAngle: deg,
                };
              } else {
                this.pins[attachedPin].mode = 'OUTPUT';
                this.pins[attachedPin].servoAngle = deg;
                this.pins[attachedPin].voltage = v;
                this.pins[attachedPin].digitalValue = deg > 0 ? 1 : 0;
                this.pins[attachedPin].value = deg > 0 ? 1 : 0;
              }
            },
            read: () => this.servoAnglesByPin[attachedPin] ?? 90,
          };
        },
      },

      Keypad: {
        getKey: () => {
          const k = this.activeKeypadKey;
          return k && k.length > 0 ? k.charAt(0) : '\0';
        },
      },
    };

    try {
      let program = this.compiledProgram;
      if (typeof program === 'function') {
        program = program(context);
        this.compiledProgram = program;
      }

      // 1. Run setup() once
      if (!this.isSetupDone) {
        if (!this.setupGen) {
          this.setupGen = program.setup();
        }
        let steps = 0;
        while (steps++ < 1000) {
          const res = this.setupGen!.next();
          if (res.done) {
            this.isSetupDone = true;
            this.setupGen = null;
            break;
          }
          if (res.value && res.value.op === 'delay') {
            this.suspendUntilClockMs = simClockMs + (Number(res.value.ms) || 0);
            return this.getState();
          }
        }
        if (!this.isSetupDone) {
          return this.getState();
        }
      }

      // 2. Run loop() repeatedly
      let loopSteps = 0;
      while (loopSteps++ < 500) {
        if (!this.loopGen) {
          this.loopGen = program.loop();
        }
        if (!this.loopGen) break;
        const res = this.loopGen.next();
        if (res.done) {
          this.loopGen = null; // Next iteration will instantiate a fresh loop()
          // If loop finishes without any delay, we don't spin indefinitely in one tick
          if (loopSteps > 50) {
            this.suspendUntilClockMs = simClockMs + 10;
            break;
          }
          continue;
        }
        if (res.value && res.value.op === 'delay') {
          const delayMs = Math.max(1, Number(res.value.ms) || 0);
          this.suspendUntilClockMs = simClockMs + delayMs;
          break;
        }
      }
    } catch (err: any) {
      this.lastError = `Runtime Exception: ${err?.message || err}`;
      this.addLog('error', `[Runtime Error] ${this.lastError}`);
    }

    return this.getState();
  }

  public setActiveKeypadKey(key: string): void {
    this.activeKeypadKey = key || '';
  }

  public consumeSdWrites(): Array<{ filename: string; text: string; append: boolean }> {
    const writes = [...this.sdPendingWrites];
    this.sdPendingWrites = [];
    return writes;
  }

  private getPeripheralState(): McuPeripheralState {
    const lines = [...this.oledLines];
    if (this.oledCurrentLine) {
      lines.push(this.oledCurrentLine);
    }
    return {
      oledLines: lines,
      oledProgressBar: this.oledProgressBar,
      oledUpdated: this.oledUpdated,
      lcdRows: [this.lcdRows[0], this.lcdRows[1]],
      lcdCursorCol: this.lcdCursorCol,
      lcdCursorRow: this.lcdCursorRow,
      lcdUpdated: this.lcdUpdated,
      sdPendingWrites: [...this.sdPendingWrites],
      servoAnglesByPin: { ...this.servoAnglesByPin },
      defaultServoAngle: this.defaultServoAngle,
    };
  }

  public getState(): StepResult {
    return {
      pins: { ...this.pins },
      ledL: this.ledL,
      ledOn: this.ledOn,
      ledTx: this.ledTx,
      ledRx: this.ledRx,
      serialLogs: [...this.serialLogs],
      serialInputBuffer: this.serialInputBuffer,
      error: this.lastError,
      peripheralState: this.getPeripheralState(),
    };
  }

  public getInstanceData(): McuInstanceData {
    return {
      componentId: this.componentId,
      type: this.mcuType,
      code: this.code,
      status: this.lastError ? 'error' : this.compiledProgram ? 'running' : 'idle',
      pins: { ...this.pins },
      ledL: this.ledL,
      ledOn: this.ledOn,
      ledTx: this.ledTx,
      ledRx: this.ledRx,
      serialLogs: [...this.serialLogs],
      serialInputBuffer: this.serialInputBuffer,
      lastError: this.lastError,
      runtimeClockMs: this.suspendUntilClockMs,
      peripheralState: this.getPeripheralState(),
    };
  }
}
