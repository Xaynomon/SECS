import React, { useRef, useEffect } from 'react';
import {
  Thermometer,
  Sun,
  Sliders,
  Flame,
  RotateCw,
  FlipHorizontal,
  Trash2,
  X,
  Code,
} from 'lucide-react';
import { CircuitComponent } from '../../types/circuit';
import { useCircuitStore } from '../../store/useCircuitStore';

interface SensorContextHUDProps {
  component: CircuitComponent;
  screenPos: { x: number; y: number };
  onClose: () => void;
}

export const SensorContextHUD: React.FC<SensorContextHUDProps> = ({
  component,
  screenPos,
  onClose,
}) => {
  const {
    theme,
    updateComponentProperty,
    rotateComponent,
    flipComponentHorizontal,
    deleteSelected,
    selectComponent,
    openCodeEditor,
  } = useCircuitStore();

  const isDark = theme === 'dark';
  const hudRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (hudRef.current && !hudRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Keep HUD within viewport bounds
  const hudX = Math.min(window.innerWidth - 320, Math.max(16, screenPos.x + 10));
  const hudY = Math.min(window.innerHeight - 340, Math.max(70, screenPos.y - 40));

  // ------------------------------------------------------------------
  // 1. TEMPERATURE SENSOR SIMULATOR (TMP36)
  // ------------------------------------------------------------------
  if (component.type === 'temp-sensor') {
    const temp = component.properties?.temperatureC ?? 25;
    const threshold = component.properties?.threshold ?? 50;
    const isAboveThreshold = temp >= threshold;
    const vout = Math.max(0, Math.min(5, (temp + 50) * 0.01 + 0.5)).toFixed(2);

    const handleTempChange = (newTemp: number) => {
      const clamped = Math.max(-40, Math.min(125, Math.round(newTemp)));
      updateComponentProperty(component.id, 'temperatureC', clamped);
    };

    // Calculate matchstick distance based on temperature: -40°C = far right, 125°C = closest
    const matchstickPct = Math.round(((temp - -40) / (125 - -40)) * 100);

    return (
      <div
        ref={hudRef}
        style={{ left: hudX, top: hudY }}
        className={`fixed z-50 w-72 rounded-2xl border shadow-2xl p-4 backdrop-blur-md select-none transition-all animate-in fade-in zoom-in-95 ${
          isDark
            ? 'bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-sky-950/40'
            : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300'
        }`}
      >
        {/* HUD Header */}
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400">
              <Thermometer className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold leading-none">Heat Simulator</div>
              <div className="text-[10px] text-slate-400">TMP36 Sensor Probe</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Visual Draggable Matchstick Scene */}
        <div
          className={`relative h-20 rounded-xl border p-2 mb-3 overflow-hidden flex items-center justify-between ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'
          }`}
        >
          {/* Sensor Probe Icon (Left) */}
          <div className="flex flex-col items-center z-10">
            <div
              className={`p-2 rounded-lg border transition ${
                isAboveThreshold
                  ? 'bg-rose-500/20 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/30'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <Thermometer className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-mono mt-1 font-bold">TMP36</span>
          </div>

          {/* Draggable Matchstick Flame (Right / Positioned by temperature) */}
          <div
            className="absolute top-1/2 -translate-y-1/2 flex items-center transition-all duration-75 cursor-ew-resize"
            style={{ left: `${Math.max(25, Math.min(78, 80 - matchstickPct * 0.55))}%` }}
          >
            {/* Animated Flame */}
            <div className="relative">
              <Flame className="w-6 h-6 text-amber-500 fill-amber-400 animate-pulse drop-shadow-[0_0_8px_#f59e0b]" />
            </div>
            {/* Wooden Matchstick Shaft */}
            <div className="w-16 h-2 bg-amber-800 rounded-r-sm border border-amber-950 shadow" />
          </div>
        </div>

        {/* Temperature Slider & Numeric Input */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-semibold text-slate-400">Ambient Temperature</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="-40"
                max="125"
                value={temp}
                onChange={(e) => handleTempChange(parseFloat(e.target.value) || 0)}
                className={`w-14 text-center py-0.5 rounded border text-xs font-mono font-bold focus:outline-none focus:border-rose-500 ${
                  isDark
                    ? 'bg-slate-950 border-slate-700 text-rose-400'
                    : 'bg-white border-slate-300 text-rose-600'
                }`}
              />
              <span className="font-bold text-xs text-rose-500">°C</span>
            </div>
          </div>

          <input
            type="range"
            min="-40"
            max="125"
            step="1"
            value={temp}
            onChange={(e) => handleTempChange(parseFloat(e.target.value))}
            className="w-full accent-rose-500 cursor-pointer"
          />
          <div className="flex justify-between text-[9px] font-mono text-slate-500">
            <span>-40°C (Ice)</span>
            <span>25°C (Room)</span>
            <span>125°C (Hot)</span>
          </div>
        </div>

        {/* Live Electrical Feedback Badge */}
        <div
          className={`p-2 rounded-xl border flex items-center justify-between text-xs font-mono mb-1 ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div>
            <span className="text-[10px] text-slate-400 block">VOUT Analog</span>
            <span className="font-bold text-sky-400">{vout} V</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block">Logic Level</span>
            <span
              className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                isAboveThreshold
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isAboveThreshold ? 'HIGH (1)' : 'LOW (0)'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 2. LIGHT SENSOR SIMULATOR (LDR Photoresistor)
  // ------------------------------------------------------------------
  if (component.type === 'light-sensor') {
    const lux = component.properties?.lux ?? 500;
    const isConducting = lux >= 500;
    // Approximated resistance: 500k / (lux^0.7)
    const resistanceOhms = Math.max(100, Math.round(500000 / Math.pow(Math.max(1, lux), 0.7)));
    const resistanceStr =
      resistanceOhms >= 1000 ? `${(resistanceOhms / 1000).toFixed(1)} kΩ` : `${resistanceOhms} Ω`;

    const handleLuxChange = (newLux: number) => {
      const clamped = Math.max(1, Math.min(1000, Math.round(newLux)));
      updateComponentProperty(component.id, 'lux', clamped);
    };

    return (
      <div
        ref={hudRef}
        style={{ left: hudX, top: hudY }}
        className={`fixed z-50 w-72 rounded-2xl border shadow-2xl p-4 backdrop-blur-md select-none transition-all animate-in fade-in zoom-in-95 ${
          isDark
            ? 'bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-sky-950/40'
            : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300'
        }`}
      >
        {/* HUD Header */}
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
              <Sun className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold leading-none">Light Stimulator</div>
              <div className="text-[10px] text-slate-400">LDR Photoresistor</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Visual Flashlight / Ambient Beam Scene */}
        <div
          className={`relative h-20 rounded-xl border p-2 mb-3 overflow-hidden flex items-center justify-between ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'
          }`}
        >
          {/* LDR Sensor Cell (Left) */}
          <div className="flex flex-col items-center z-10">
            <div
              className={`p-2 rounded-lg border transition ${
                isConducting
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/30'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <Sun className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-mono mt-1 font-bold">LDR</span>
          </div>

          {/* Light Cone radiating onto cell */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-150"
            style={{
              background: `radial-gradient(ellipse at 80% 50%, rgba(251, 191, 36, ${Math.max(
                0.1,
                lux / 1000
              )}) 0%, transparent 70%)`,
            }}
          />

          {/* Flashlight Bulb Graphic (Right) */}
          <div className="flex flex-col items-center z-10 pr-2">
            <div
              className="w-8 h-8 rounded-full border border-amber-400/50 flex items-center justify-center transition"
              style={{
                backgroundColor: `rgba(251, 191, 36, ${Math.max(0.2, lux / 1000)})`,
                boxShadow: `0 0 ${Math.round((lux / 1000) * 20)}px #f59e0b`,
              }}
            >
              <Sun className="w-4 h-4 text-amber-950" />
            </div>
            <span className="text-[9px] font-mono mt-1 font-bold">Flashlight</span>
          </div>
        </div>

        {/* Brightness Lux Slider & Input */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-semibold text-slate-400">Ambient Illuminance</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="1000"
                value={lux}
                onChange={(e) => handleLuxChange(parseFloat(e.target.value) || 0)}
                className={`w-16 text-center py-0.5 rounded border text-xs font-mono font-bold focus:outline-none focus:border-amber-500 ${
                  isDark
                    ? 'bg-slate-950 border-slate-700 text-amber-400'
                    : 'bg-white border-slate-300 text-amber-600'
                }`}
              />
              <span className="font-bold text-xs text-amber-500">lux</span>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="1000"
            step="10"
            value={lux}
            onChange={(e) => handleLuxChange(parseFloat(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="flex justify-between text-[9px] font-mono text-slate-500">
            <span>0 lux (Darkness)</span>
            <span>500 lux (Office)</span>
            <span>1000 lux (Sun)</span>
          </div>
        </div>

        {/* Live Resistance & Conduction Feedback */}
        <div
          className={`p-2 rounded-xl border flex items-center justify-between text-xs font-mono mb-1 ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div>
            <span className="text-[10px] text-slate-400 block">Photo Resistance</span>
            <span className="font-bold text-amber-400">{resistanceStr}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block">Logical Conduction</span>
            <span
              className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                isConducting
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isConducting ? 'CONDUCTING' : 'ISOLATING'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 3. POTENTIOMETER ROTARY TRIMMER SIMULATOR
  // ------------------------------------------------------------------
  if (component.type === 'potentiometer') {
    const position = component.properties?.position ?? 50;
    const maxR = component.properties?.maxResistance ?? 10000;

    const r1 = Math.round((position / 100) * maxR);
    const r2 = maxR - r1;

    const handlePosChange = (newPos: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(newPos)));
      updateComponentProperty(component.id, 'position', clamped);
    };

    // Wiper angle (-135° to +135°)
    const wiperAngle = (position / 100) * 270 - 135;

    return (
      <div
        ref={hudRef}
        style={{ left: hudX, top: hudY }}
        className={`fixed z-50 w-72 rounded-2xl border shadow-2xl p-4 backdrop-blur-md select-none transition-all animate-in fade-in zoom-in-95 ${
          isDark
            ? 'bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-sky-950/40'
            : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300'
        }`}
      >
        {/* HUD Header */}
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold leading-none">Rotary Wiper HUD</div>
              <div className="text-[10px] text-slate-400">Potentiometer / Trimmer</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Interactive Rotary Dial Graphic */}
        <div
          className={`h-24 rounded-xl border p-2 mb-3 flex items-center justify-center relative ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'
          }`}
        >
          <div className="relative w-16 h-16 rounded-full border-2 border-sky-500/40 bg-slate-900 flex items-center justify-center shadow-lg">
            {/* Wiper Pointer */}
            <div
              className="absolute w-1 h-6 bg-sky-400 rounded-full origin-bottom"
              style={{
                transform: `rotate(${wiperAngle}deg) translateY(-8px)`,
                boxShadow: '0 0 6px #38bdf8',
              }}
            />
            {/* Center Cap */}
            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center z-10">
              <div className="w-2 h-2 rounded-full bg-sky-400" />
            </div>
          </div>

          <div className="absolute right-4 text-right font-mono">
            <span className="text-[10px] text-slate-400 block">Wiper Ratio</span>
            <span className="text-base font-black text-sky-400">{position}%</span>
          </div>
        </div>

        {/* Position Slider */}
        <div className="space-y-2 mb-3">
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={position}
            onChange={(e) => handlePosChange(parseFloat(e.target.value))}
            className="w-full accent-sky-500 cursor-pointer"
          />
          <div className="flex justify-between text-[9px] font-mono text-slate-500">
            <span>0% (Pin 1)</span>
            <span>50% (Center)</span>
            <span>100% (Pin 2)</span>
          </div>
        </div>

        {/* Dual Resistance Readout */}
        <div
          className={`p-2 rounded-xl border grid grid-cols-2 gap-2 text-xs font-mono ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div>
            <span className="text-[10px] text-slate-400 block">T1 to Wiper</span>
            <span className="font-bold text-slate-200">
              {r1 >= 1000 ? `${(r1 / 1000).toFixed(1)} kΩ` : `${r1} Ω`}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block">Wiper to T2</span>
            <span className="font-bold text-slate-200">
              {r2 >= 1000 ? `${(r2 / 1000).toFixed(1)} kΩ` : `${r2} Ω`}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 4. GENERIC COMPONENT RIGHT-CLICK CONTEXT MENU
  // ------------------------------------------------------------------
  return (
    <div
      ref={hudRef}
      style={{ left: hudX, top: hudY }}
      className={`fixed z-50 w-56 rounded-2xl border shadow-2xl p-2.5 backdrop-blur-md select-none transition-all animate-in fade-in zoom-in-95 ${
        isDark
          ? 'bg-slate-900/95 border-slate-700/80 text-slate-200 shadow-sky-950/40'
          : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300'
      }`}
    >
      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-700/40 px-1">
        <span className="text-xs font-bold truncate max-w-[150px]">{component.label}</span>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-slate-800 text-slate-400">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1 text-xs">
        {(component.type === 'arduino-uno' ||
          component.type === 'esp32' ||
          component.type === 'pico' ||
          component.type === 'builtin_cpu_8bit' ||
          component.type === 'cpu-8bit') && (
          <button
            onClick={() => {
              openCodeEditor(component.id);
              onClose();
            }}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-teal-400 font-semibold transition ${
              isDark ? 'hover:bg-teal-950/60' : 'hover:bg-teal-50 text-teal-600'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>
              {component.type === 'builtin_cpu_8bit' || component.type === 'cpu-8bit'
                ? '</> Assembly IDE & Registers'
                : '</> Edit Code & Serial'}
            </span>
          </button>
        )}

        <button
          onClick={() => {
            rotateComponent(component.id, 90);
            onClose();
          }}
          className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition ${
            isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          <RotateCw className="w-3.5 h-3.5 text-sky-400" />
          <span>Rotate 90° (R)</span>
        </button>

        <button
          onClick={() => {
            flipComponentHorizontal(component.id);
            onClose();
          }}
          className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition ${
            isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          <FlipHorizontal className="w-3.5 h-3.5 text-sky-400" />
          <span>Flip Horizontal (F)</span>
        </button>

        <div className={`h-[1px] my-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

        <button
          onClick={() => {
            selectComponent(component.id);
            deleteSelected();
            onClose();
          }}
          className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-rose-400 transition ${
            isDark ? 'hover:bg-rose-500/10' : 'hover:bg-rose-50 text-rose-600'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Component</span>
        </button>
      </div>
    </div>
  );
};
