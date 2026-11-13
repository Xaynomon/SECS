export interface WireColorOption {
  name: string;
  value: string;
  bgClass: string;
  borderClass: string;
}

export const WIRE_COLORS: WireColorOption[] = [
  { name: 'Red (+VCC / Power)', value: '#ef4444', bgClass: 'bg-red-500', borderClass: 'border-red-500' },
  { name: 'Black (GND / Return)', value: '#0f172a', bgClass: 'bg-slate-900', borderClass: 'border-slate-600' },
  { name: 'Blue (Signals / Analog)', value: '#3b82f6', bgClass: 'bg-blue-500', borderClass: 'border-blue-500' },
  { name: 'Green (Ground / Logic)', value: '#22c55e', bgClass: 'bg-green-500', borderClass: 'border-green-500' },
  { name: 'Yellow (Clock / I2C SCL)', value: '#eab308', bgClass: 'bg-yellow-500', borderClass: 'border-yellow-500' },
  { name: 'Orange (I2C SDA / PWM)', value: '#f97316', bgClass: 'bg-orange-500', borderClass: 'border-orange-500' },
  { name: 'Purple (SPI / Control)', value: '#a855f7', bgClass: 'bg-purple-500', borderClass: 'border-purple-500' },
  { name: 'White (Auxiliary)', value: '#f8fafc', bgClass: 'bg-white', borderClass: 'border-slate-300' },
  { name: 'Brown (Reference)', value: '#854d0e', bgClass: 'bg-amber-800', borderClass: 'border-amber-700' },
];

export const DEFAULT_WIRE_COLOR = '#22c55e'; // Circuit green
