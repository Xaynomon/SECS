import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  Target,
  RefreshCw,
} from 'lucide-react';
import { useCircuitStore } from '../../store/useCircuitStore';
import { ProbeTarget } from '../../types/instruments';
import {
  getProbeVoltage,
  getProbeCurrent,
  getProbedResistance,
  getProbeTargetDisplay,
} from '../../utils/instrumentSignals';
import { setContinuityBeep } from '../../utils/soundEngine';

export const Multimeter: React.FC = () => {
  const {
    theme,
    showMultimeter,
    toggleInstrument,
    multimeter,
    setMultimeterMode,
    toggleMultimeterHold,
    resetMultimeterMinMax,
    attachProbe,
    detachProbe,
    setActiveProbePicker,
    activeProbePicker,
    components,
    wires,
    simulationStatus,
    simulationMode,
    isSoundEnabled,
  } = useCircuitStore();

  const isDark = theme === 'dark';

  // Draggable HUD window position state
  const [position, setPosition] = useState({ x: 380, y: 72 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  // Live sampled measurement state
  const [displayValue, setDisplayValue] = useState<string>('0.000');
  const [displayUnit, setDisplayUnit] = useState<string>('V');
  const [isContinuityBeep, setIsContinuityBeep] = useState(false);
  const [acHistory, setAcHistory] = useState<number[]>([]);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag via header
    if ((e.target as HTMLElement).closest('button, select, input')) return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const newX = Math.max(10, Math.min(window.innerWidth - 320, dragStartRef.current.posX + dx));
      const newY = Math.max(60, Math.min(window.innerHeight - 80, dragStartRef.current.posY + dy));
      if (windowRef.current) {
        windowRef.current.style.left = `${newX}px`;
        windowRef.current.style.top = `${newY}px`;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDragging) return;
      setIsDragging(false);
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const finalX = Math.max(10, Math.min(window.innerWidth - 320, dragStartRef.current.posX + dx));
      const finalY = Math.max(60, Math.min(window.innerHeight - 80, dragStartRef.current.posY + dy));
      setPosition({ x: finalX, y: finalY });
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Synchronize continuity tester 2000Hz WebAudio beep with soundEngine
  useEffect(() => {
    const shouldBeep =
      showMultimeter &&
      simulationStatus === 'running' &&
      multimeter.mode === 'CONT' &&
      isContinuityBeep;
    setContinuityBeep(shouldBeep, isSoundEnabled);
  }, [showMultimeter, simulationStatus, multimeter.mode, isContinuityBeep, isSoundEnabled]);

  useEffect(() => {
    return () => {
      setContinuityBeep(false, false);
    };
  }, []);

  // Compute live reading on tick / changes
  useEffect(() => {
    if (!showMultimeter || multimeter.isHold) return;

    const vRed = getProbeVoltage(multimeter.redProbe, components, wires, simulationMode);
    const vBlack = multimeter.blackProbe
      ? getProbeVoltage(multimeter.blackProbe, components, wires, simulationMode)
      : 0.0; // Black probe defaults to 0V / GND

    let rawVal = 0;
    let unit = 'V';
    let isBeep = false;

    switch (multimeter.mode) {
      case 'DC_V': {
        rawVal = vRed - vBlack;
        if (Math.abs(rawVal) < 1.0 && Math.abs(rawVal) > 0.0001) {
          rawVal = rawVal * 1000;
          unit = 'mV';
        } else {
          unit = 'V';
        }
        setDisplayValue(rawVal >= 0 ? `+${rawVal.toFixed(3)}` : rawVal.toFixed(3));
        setDisplayUnit(unit);
        setIsContinuityBeep(false);
        break;
      }

      case 'AC_V': {
        const diff = Math.abs(vRed - vBlack);
        // Track recent samples to compute true RMS
        setAcHistory((prev) => {
          const next = [...prev.slice(-20), diff];
          return next;
        });

        const samples = acHistory.length > 0 ? acHistory : [diff];
        const sumSq = samples.reduce((acc, v) => acc + v * v, 0);
        const rms = Math.sqrt(sumSq / samples.length);

        if (rms < 1.0 && rms > 0.001) {
          setDisplayValue((rms * 1000).toFixed(2));
          setDisplayUnit('mV~');
        } else {
          setDisplayValue(rms.toFixed(3));
          setDisplayUnit('V~');
        }
        setIsContinuityBeep(false);
        rawVal = rms;
        break;
      }

      case 'DC_A': {
        // Measure branch current
        const iRed = getProbeCurrent(multimeter.redProbe, components, wires);
        const iBlack = getProbeCurrent(multimeter.blackProbe, components, wires);
        rawVal = Math.max(iRed, iBlack);

        if (rawVal < 0.001) {
          setDisplayValue((rawVal * 1e6).toFixed(1));
          setDisplayUnit('μA');
        } else if (rawVal < 1.0) {
          setDisplayValue((rawVal * 1000).toFixed(2));
          setDisplayUnit('mA');
        } else {
          setDisplayValue(rawVal.toFixed(3));
          setDisplayUnit('A');
        }
        setIsContinuityBeep(false);
        break;
      }

      case 'RES': {
        const { resistance } = getProbedResistance(
          multimeter.redProbe,
          multimeter.blackProbe,
          components,
          wires
        );

        if (resistance === null || resistance > 10e6) {
          setDisplayValue('O.L');
          setDisplayUnit('MΩ');
        } else if (resistance >= 1e6) {
          setDisplayValue((resistance / 1e6).toFixed(3));
          setDisplayUnit('MΩ');
        } else if (resistance >= 1e3) {
          setDisplayValue((resistance / 1e3).toFixed(2));
          setDisplayUnit('kΩ');
        } else {
          setDisplayValue(resistance.toFixed(1));
          setDisplayUnit('Ω');
        }
        setIsContinuityBeep(false);
        break;
      }

      case 'CONT': {
        const { resistance, isContinuity, diodeVf } = getProbedResistance(
          multimeter.redProbe,
          multimeter.blackProbe,
          components,
          wires
        );

        if (diodeVf !== undefined) {
          setDisplayValue(diodeVf.toFixed(3));
          setDisplayUnit('V (Diode)');
          isBeep = true;
        } else if (isContinuity && resistance !== null) {
          setDisplayValue(resistance.toFixed(1));
          setDisplayUnit('Ω');
          isBeep = true;
        } else {
          setDisplayValue('O.L');
          setDisplayUnit('');
          isBeep = false;
        }
        setIsContinuityBeep(isBeep);
        break;
      }
    }

    // Min / Max Tracking
    if (displayValue !== 'O.L') {
      const numVal = parseFloat(displayValue);
      if (!isNaN(numVal)) {
        if (multimeter.minVal === null || numVal < multimeter.minVal) {
          useCircuitStore.setState((state) => ({
            multimeter: { ...state.multimeter, minVal: numVal },
          }));
        }
        if (multimeter.maxVal === null || numVal > multimeter.maxVal) {
          useCircuitStore.setState((state) => ({
            multimeter: { ...state.multimeter, maxVal: numVal },
          }));
        }
      }
    }
  }, [
    showMultimeter,
    multimeter.mode,
    multimeter.redProbe,
    multimeter.blackProbe,
    multimeter.isHold,
    components,
    wires,
    simulationStatus,
    simulationMode,
  ]);

  if (!showMultimeter) return null;

  // Build selectable pin/wire targets for dropdown
  const allSelectableTargets: Array<{ label: string; target: ProbeTarget }> = [];
  components.forEach((c) => {
    // Add component pins
    if (c.type !== 'textbox') {
      // Pick first 8 pins or significant pins
      const pinIds = c.type === 'arduino-uno' || c.type === 'esp32' || c.type === 'pico'
        ? ['D13', 'D2', '3V3', '5V', 'GND', 'A0']
        : ['pos', 'neg', 'p1', 'p2', 'anode', 'cathode', 'out', 'in', 'vcc', 'gnd'];

      pinIds.forEach((pid) => {
        allSelectableTargets.push({
          label: `${c.label || c.id} - Pin ${pid}`,
          target: { type: 'pin', compId: c.id, pinId: pid, label: `${c.label || c.id}:${pid}` },
        });
      });
    }
  });

  wires.forEach((w, idx) => {
    allSelectableTargets.push({
      label: `Wire #${idx + 1} (${w.color})`,
      target: { type: 'wire', wireId: w.id, label: `Wire #${idx + 1}` },
    });
  });

  return (
    <div
      ref={windowRef}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className={`fixed z-40 w-80 rounded-2xl border shadow-2xl overflow-hidden select-none ${
        isDark
          ? 'bg-slate-900 border-amber-500/40 text-slate-100 shadow-amber-950/20'
          : 'bg-white border-amber-400 text-slate-800 shadow-amber-500/10'
      }`}
    >
      {/* 1. FLUKE-INSPIRED HEADER BAR */}
      <div
        onMouseDown={handleMouseDown}
        className={`px-3.5 py-2.5 flex items-center justify-between cursor-move border-b ${
          isDark
            ? 'bg-gradient-to-r from-amber-600/30 to-amber-700/20 border-amber-500/30'
            : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-amber-600'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-sm">
            F
          </div>
          <span className="font-bold text-xs tracking-wide">
            Digital Multimeter (DMM-87V)
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleInstrument('multimeter')}
            className="p-1 rounded hover:bg-red-500 hover:text-white transition"
            title="Close Multimeter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3.5 space-y-3.5">
          {/* 2. HIGH-CONTRAST 7-SEGMENT BACKLIT LCD SCREEN */}
          <div className="bg-[#031317] border-2 border-[#093540] rounded-xl p-3 shadow-inner relative overflow-hidden font-mono">
            {/* Ambient LCD Phosphor Backlight Glow */}
            <div className="absolute inset-0 bg-cyan-500/5 pointer-events-none" />

            {/* Top Status Indicators Row */}
            <div className="flex items-center justify-between text-[10px] font-semibold text-cyan-400/80 mb-1">
              <div className="flex items-center gap-2">
                <span>AUTO</span>
                <span>{multimeter.mode.replace('_', ' ')}</span>
                {multimeter.isHold && (
                  <span className="px-1 py-0.2 bg-amber-500/20 text-amber-400 rounded text-[9px] border border-amber-500/30 font-bold">
                    HOLD
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isContinuityBeep ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-bold animate-pulse">
                    <Volume2 className="w-3 h-3" /> BEEP!
                  </span>
                ) : (
                  <span className="text-slate-600">
                    <VolumeX className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>

            {/* Main Numeric 7-Segment Value Readout */}
            <div className="flex items-baseline justify-between my-1">
              <span className="text-3xl font-extrabold tracking-wider text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
                {displayValue}
              </span>
              <span className="text-lg font-bold text-cyan-400 ml-2">
                {displayUnit}
              </span>
            </div>

            {/* Min / Max Telemetry Bar */}
            <div className="flex items-center justify-between text-[10px] text-cyan-500/70 border-t border-[#093540] pt-1.5 mt-1">
              <span>MIN: {multimeter.minVal !== null ? multimeter.minVal.toFixed(2) : '--'}</span>
              <span>MAX: {multimeter.maxVal !== null ? multimeter.maxVal.toFixed(2) : '--'}</span>
              <button
                onClick={resetMultimeterMinMax}
                className="hover:text-cyan-300 transition flex items-center gap-0.5 text-[9px]"
                title="Reset Min/Max"
              >
                <RefreshCw className="w-2.5 h-2.5" /> Reset
              </button>
            </div>
          </div>

          {/* 3. MEASUREMENT MODE SELECTOR (Fluke Rotary Dial / Mode Buttons) */}
          <div className="grid grid-cols-5 gap-1 text-[11px] font-bold text-center select-none">
            {(
              [
                { mode: 'DC_V', label: 'V⎓', sub: 'DC Volts' },
                { mode: 'AC_V', label: 'V~', sub: 'AC RMS' },
                { mode: 'DC_A', label: 'A⎓', sub: 'Current' },
                { mode: 'RES', label: 'Ω', sub: 'Resistance' },
                { mode: 'CONT', label: '🔊 / ⇥', sub: 'Continuity' },
              ] as const
            ).map((item) => {
              const active = multimeter.mode === item.mode;
              return (
                <button
                  key={item.mode}
                  onClick={() => setMultimeterMode(item.mode)}
                  className={`py-1.5 px-1 rounded-lg border transition-all flex flex-col items-center justify-center ${
                    active
                      ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md shadow-amber-500/20 font-black scale-[1.02]'
                      : isDark
                      ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-300'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  }`}
                  title={item.sub}
                >
                  <span className="text-xs leading-none">{item.label}</span>
                  <span className="text-[8px] opacity-75 mt-0.5">{item.mode.split('_')[0]}</span>
                </button>
              );
            })}
          </div>

          {/* 4. PROBE TERMINAL ASSIGNMENTS (V+ RED PROBE & COM BLACK PROBE) */}
          <div
            className={`p-2.5 rounded-xl border space-y-2 text-xs ${
              isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between font-semibold text-[11px]">
              <span className="text-slate-400 uppercase tracking-wider text-[10px]">
                Probe Connections
              </span>
              <button
                onClick={toggleMultimeterHold}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition flex items-center gap-1 ${
                  multimeter.isHold
                    ? 'bg-amber-500 text-slate-950 border-amber-600'
                    : isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {multimeter.isHold ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                HOLD
              </button>
            </div>

            {/* Red Probe (V+ / mA / Ω) */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
                <span className="font-bold text-red-500 text-[11px]">V+ (Red):</span>
              </div>

              <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
                <span
                  className="font-mono text-[10px] truncate max-w-[110px] text-slate-400"
                  title={getProbeTargetDisplay(multimeter.redProbe)}
                >
                  {getProbeTargetDisplay(multimeter.redProbe)}
                </span>

                <button
                  onClick={() =>
                    setActiveProbePicker(
                      activeProbePicker?.channelId === 'red'
                        ? null
                        : {
                            instrument: 'multimeter',
                            channelId: 'red',
                            color: '#ef4444',
                            title: 'Red Probe (V+ / Ω)',
                          }
                    )
                  }
                  className={`p-1 rounded border text-[10px] font-semibold flex items-center gap-1 transition ${
                    activeProbePicker?.channelId === 'red'
                      ? 'bg-red-500 text-white border-red-600 animate-pulse'
                      : isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-red-400 border-slate-700'
                      : 'bg-white hover:bg-slate-100 text-red-600 border-slate-300'
                  }`}
                  title="Click to pick target pin/wire on canvas"
                >
                  <Target className="w-3 h-3" />
                  Clip
                </button>

                {multimeter.redProbe && (
                  <button
                    onClick={() => detachProbe('multimeter', 'red')}
                    className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition"
                    title="Detach Red Probe"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Black Probe (COM / -) */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-black shadow-sm" />
                <span className="font-bold text-slate-400 text-[11px]">COM (Black):</span>
              </div>

              <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
                <span
                  className="font-mono text-[10px] truncate max-w-[110px] text-slate-400"
                  title={
                    multimeter.blackProbe
                      ? getProbeTargetDisplay(multimeter.blackProbe)
                      : 'Default GND (0V)'
                  }
                >
                  {multimeter.blackProbe
                    ? getProbeTargetDisplay(multimeter.blackProbe)
                    : 'GND (0V Auto)'}
                </span>

                <button
                  onClick={() =>
                    setActiveProbePicker(
                      activeProbePicker?.channelId === 'black'
                        ? null
                        : {
                            instrument: 'multimeter',
                            channelId: 'black',
                            color: '#64748b',
                            title: 'Black Probe (COM / 0V)',
                          }
                    )
                  }
                  className={`p-1 rounded border text-[10px] font-semibold flex items-center gap-1 transition ${
                    activeProbePicker?.channelId === 'black'
                      ? 'bg-slate-600 text-white border-slate-700 animate-pulse'
                      : isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                  title="Click to pick target pin/wire on canvas"
                >
                  <Target className="w-3 h-3" />
                  Clip
                </button>

                {multimeter.blackProbe && (
                  <button
                    onClick={() => detachProbe('multimeter', 'black')}
                    className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition"
                    title="Reset to Default GND (0V)"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Dropdown Select (Alternative to canvas click) */}
            {allSelectableTargets.length > 0 && (
              <div className="pt-1.5 border-t border-slate-800/40">
                <select
                  aria-label="Quick Probe Target"
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const found = allSelectableTargets.find((t) => t.label === e.target.value);
                    if (found) {
                      attachProbe('multimeter', 'red', found.target);
                    }
                  }}
                  className={`w-full py-1 px-1.5 rounded text-[10px] font-medium border ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-slate-300'
                      : 'bg-white border-slate-300 text-slate-700'
                  }`}
                >
                  <option value="">🎯 Quick-Connect Red Probe to...</option>
                  {allSelectableTargets.map((item) => (
                    <option key={item.label} value={item.label}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
    </div>
  );
};
