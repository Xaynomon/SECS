export interface McuTemplate {
  id: string;
  name: string;
  description: string;
  targetMcu: 'all' | 'arduino-uno' | 'esp32';
  code: string;
}

export const MCU_CODE_TEMPLATES: McuTemplate[] = [
  {
    id: 'blink',
    name: 'Blink (Pin 13 / LED)',
    description: 'Classic starter program: toggles digital pin 13 ON and OFF every 500ms.',
    targetMcu: 'all',
    code: `// Arduino Blink - SECS Interactive Circuit Simulator
// Toggles the on-board LED (Pin 13) every 500ms

const int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
  Serial.println("Arduino Uno R3 initialized.");
  Serial.println("Blinking on-board LED (Pin 13)...");
}

void loop() {
  digitalWrite(ledPin, HIGH);
  Serial.println("LED State: HIGH (ON)");
  delay(500);

  digitalWrite(ledPin, LOW);
  Serial.println("LED State: LOW (OFF)");
  delay(500);
}
`,
  },
  {
    id: 'button-led',
    name: 'Pushbutton Read -> LED Write',
    description: 'Reads digital input on Pin 2 with internal pull-up and controls LED on Pin 13.',
    targetMcu: 'all',
    code: `// Button Read -> LED Controller
// Connect momentary pushbutton between Pin 2 and GND.
// Internal INPUT_PULLUP keeps Pin 2 HIGH until button is pressed.

const int buttonPin = 2;
const int ledPin = 13;

void setup() {
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
  Serial.println("Pushbutton controller active. Press button to light LED.");
}

void loop() {
  int buttonState = digitalRead(buttonPin);

  if (buttonState == LOW) {
    // Button is actively pressed down to GND
    digitalWrite(ledPin, HIGH);
    Serial.println("Button PRESSED -> LED ON");
  } else {
    digitalWrite(ledPin, LOW);
  }

  delay(50);
}
`,
  },
  {
    id: 'analog-pwm',
    name: 'Analog Read (A0) -> PWM Brightness (Pin 9)',
    description: 'Reads 10-bit analog voltage from A0 (e.g. LDR / Potentiometer) and maps to 8-bit PWM on Pin 9.',
    targetMcu: 'all',
    code: `// Analog Sensor (LDR / Pot) to PWM Dimmer
// Connect LDR or Potentiometer wiper to Pin A0.
// Connect external LED + 220Ω resistor to PWM Pin 9.

const int sensorPin = A0;
const int pwmPin = 9;

void setup() {
  pinMode(pwmPin, OUTPUT);
  Serial.begin(9600);
  Serial.println("Analog to PWM Dimmer initialized.");
}

void loop() {
  // Read 10-bit ADC value (0 to 1023 -> 0.0V to 5.0V)
  int sensorValue = analogRead(sensorPin);

  // Map 10-bit sensor range to 8-bit PWM output (0 to 255)
  int pwmValue = map(sensorValue, 0, 1023, 0, 255);
  analogWrite(pwmPin, pwmValue);

  Serial.print("Sensor ADC: ");
  Serial.print(sensorValue);
  Serial.print(" | PWM Out: ");
  Serial.println(pwmValue);

  delay(100);
}
`,
  },
  {
    id: 'serial-telemetry',
    name: 'Serial Counter & Telemetry',
    description: 'Transmits uptime telemetry, counter values, and echoes back interactive serial input.',
    targetMcu: 'all',
    code: `// Serial Counter & Two-Way Telemetry
// Transmits system ticks and echoes user input sent through the Serial Monitor.

int tickCount = 0;

void setup() {
  Serial.begin(9600);
  Serial.println("======================================");
  Serial.println(" SECS Microcontroller Telemetry Ready ");
  Serial.println(" Send commands via Serial Monitor     ");
  Serial.println("======================================");
}

void loop() {
  tickCount++;
  unsigned long uptime = millis();

  Serial.print("Tick #");
  Serial.print(tickCount);
  Serial.print(" | Sim Uptime: ");
  Serial.print(uptime);
  Serial.println(" ms");

  // Check if user has entered commands in the Serial Monitor input box
  if (Serial.available()) {
    String cmd = Serial.readString();
    Serial.print(">> Command received: [");
    Serial.print(cmd);
    Serial.println("]");
  }

  delay(1000);
}
`,
  },
];
