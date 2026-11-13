import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  X,
  Play,
  Pause,
  RotateCcw,
  Target,
  Maximize2,
  Minimize2,
  Wand2,
  Sliders,
  Radio,
  Plus,
  Minus,
} from 'lucide-react';
import { useCircuitStore, scopeSampleBuffer, clearScopeSampleBuffer } from '../../store/useCircuitStore';
import { ProbeTarget, ScopeTelemetry } from '../../types/instruments';
import {
  computeSignalTelemetry,
  getProbeTargetDisplay,
  getProbeVoltage,
} from '../../utils/instrumentSignals';

export const Oscilloscope: React.FC = () => {
  const {
    theme,
    showOscilloscope,
    toggleInstrument,
    oscilloscope,
    setScopeChannelConfig,
    setScopeTimebase,
    setScopeTrigger,
    toggleScopePaused,
    detachProbe,
    setActiveProbePicker,
    activeProbePicker,
    components,
    wires,
    simulationMode,
  } = useCircuitStore();

  const isDark = theme === 'dark';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 520, height: 180 });

  // Display Mode: YT (Time Domain), XY (Lissajous), MATH (Channel Math)
  const [displayMode, setDisplayMode] = useState<'YT' | 'XY' | 'MATH'>('YT');
  const [mathOp, setMathOp] = useState<'ADD' | 'SUB'>('SUB');

  // Interactive Measurement Cursors
  const [cursorMode, setCursorMode] = useState<'OFF' | 'TIME' | 'VOLT' | 'BOTH'>('OFF');
  const [cursorT1, setCursorT1] = useState(0.3); // normalized 0..1 (X axis)
  const [cursorT2, setCursorT2] = useState(0.7); // normalized 0..1 (X axis)
  const [cursorV1, setCursorV1] = useState(0.35); // normalized 0..1 (Y axis from top)
  const [cursorV2, setCursorV2] = useState(0.65); // normalized 0..1 (Y axis from top)
  const activeCursorDragRef = useRef<'T1' | 'T2' | 'V1' | 'V2' | null>(null);

  // In-scope Calibrator / Test Signal Source
  const [calibratorSignal, setCalibratorSignal] = useState<'1KHZ_SQR' | '1KHZ_SINE' | '500HZ_TRI' | '200HZ_SAW'>('1KHZ_SQR');

  // Trigger Lock Mode: Stationary Trigger Lock vs Continuous Smooth Rolling Display
  const [triggerLockMode, setTriggerLockMode] = useState<'trig' | 'roll'>('trig');

  // Draggable HUD window position state
  const [position, setPosition] = useState({ x: 260, y: 72 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });

  // Time-series sample buffers
  // Stored as { t: simClockMs, v1: number, v2: number }
  const sampleBufferRef = useRef<Array<{ t: number; v1: number; v2: number }>>([]);
  const [telemetryCH1, setTelemetryCH1] = useState<ScopeTelemetry>({
    vMax: 0,
    vMin: 0,
    vPp: 0,
    vAvg: 0,
    vRms: 0,
    frequencyHz: 0,
    periodMs: 0,
    dutyCyclePct: 0,
  });
  const [telemetryCH2, setTelemetryCH2] = useState<ScopeTelemetry>({
    vMax: 0,
    vMin: 0,
    vPp: 0,
    vAvg: 0,
    vRms: 0,
    frequencyHz: 0,
    periodMs: 0,
    dutyCyclePct: 0,
  });

  // Track container dimensions dynamically
  useEffect(() => {
    if (!showOscilloscope) return;
    const updateSize = () => {
      if (canvasContainerRef.current) {
        const rect = canvasContainerRef.current.getBoundingClientRect();
        if (rect.width > 20 && rect.height > 20) {
          setCanvasDimensions({
            width: Math.floor(rect.width),
            height: Math.floor(rect.height),
          });
        }
      }
    };
    updateSize();
    const timer = setTimeout(updateSize, 50);
    window.addEventListener('resize', updateSize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateSize);
    };
  }, [showOscilloscope, isFullscreen]);

  // Drag handlers for window
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isFullscreen) return;
    if ((e.target as HTMLElement).closest('button, select, input, canvas')) return;
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
      const newX = Math.max(10, Math.min(window.innerWidth - 500, dragStartRef.current.posX + dx));
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
      const finalX = Math.max(10, Math.min(window.innerWidth - 500, dragStartRef.current.posX + dx));
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

  // Canvas Cursors Mouse Interactions
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (cursorMode === 'OFF') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const x1Px = cursorT1 * rect.width;
    const x2Px = cursorT2 * rect.width;
    const y1Px = cursorV1 * rect.height;
    const y2Px = cursorV2 * rect.height;

    // Check hit within 10px
    if (cursorMode === 'TIME' || cursorMode === 'BOTH') {
      if (Math.abs(x - x1Px) <= 10) {
        activeCursorDragRef.current = 'T1';
        return;
      }
      if (Math.abs(x - x2Px) <= 10) {
        activeCursorDragRef.current = 'T2';
        return;
      }
    }

    if (cursorMode === 'VOLT' || cursorMode === 'BOTH') {
      if (Math.abs(y - y1Px) <= 10) {
        activeCursorDragRef.current = 'V1';
        return;
      }
      if (Math.abs(y - y2Px) <= 10) {
        activeCursorDragRef.current = 'V2';
        return;
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!activeCursorDragRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const normX = Math.max(0.02, Math.min(0.98, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0.02, Math.min(0.98, (e.clientY - rect.top) / rect.height));

    if (activeCursorDragRef.current === 'T1') setCursorT1(normX);
    else if (activeCursorDragRef.current === 'T2') setCursorT2(normX);
    else if (activeCursorDragRef.current === 'V1') setCursorV1(normY);
    else if (activeCursorDragRef.current === 'V2') setCursorV2(normY);
  };

  const handleCanvasMouseUp = () => {
    activeCursorDragRef.current = null;
  };

  // Sample collection loop on animationFrame
  useEffect(() => {
    if (!showOscilloscope) return;

    let animId: number;
    let lastSampleTime = performance.now();

    const sampleLoop = (now: number) => {
      if (!oscilloscope.isPaused) {
        if (scopeSampleBuffer.length > 0) {
          // Sync directly from high-resolution SPICE sub-stepped sample buffer (up to 32,000 samples)
          sampleBufferRef.current = scopeSampleBuffer.slice(-32000);
        } else {
          const dt = now - lastSampleTime;
          if (dt >= 10) {
            lastSampleTime = now;
            const v1 = getProbeVoltage(oscilloscope.ch1.target, components, wires, simulationMode);
            const v2 = getProbeVoltage(oscilloscope.ch2.target, components, wires, simulationMode);

            // Append sample
            const buf = sampleBufferRef.current;
            buf.push({ t: now, v1, v2 });

            if (buf.length > 32000) {
              buf.shift();
            }
          }
        }
      }

      // Draw canvas
      drawCanvas();
      animId = requestAnimationFrame(sampleLoop);
    };

    animId = requestAnimationFrame(sampleLoop);
    return () => cancelAnimationFrame(animId);
  }, [
    showOscilloscope,
    oscilloscope,
    components,
    wires,
    simulationMode,
    displayMode,
    mathOp,
    cursorMode,
    cursorT1,
    cursorT2,
    cursorV1,
    cursorV2,
    canvasDimensions,
    triggerLockMode,
  ]);

  // Periodic Telemetry calculation (every 150ms)
  useEffect(() => {
    if (!showOscilloscope) return;
    const interval = setInterval(() => {
      const buf = sampleBufferRef.current;
      if (buf.length >= 5) {
        if (oscilloscope.ch1.enabled) {
          const ch1Data = buf.map((p) => ({ t: p.t, v: p.v1 }));
          setTelemetryCH1(computeSignalTelemetry(ch1Data, oscilloscope.timebaseMsPerDiv));
        }
        if (oscilloscope.ch2.enabled) {
          const ch2Data = buf.map((p) => ({ t: p.t, v: p.v2 }));
          setTelemetryCH2(computeSignalTelemetry(ch2Data, oscilloscope.timebaseMsPerDiv));
        }
      }
    }, 150);
    return () => clearInterval(interval);
  }, [showOscilloscope, oscilloscope.ch1.enabled, oscilloscope.ch2.enabled, oscilloscope.timebaseMsPerDiv]);

  // Clear buffer action
  const handleClearBuffer = () => {
    clearScopeSampleBuffer();
    sampleBufferRef.current = [];
  };

  // AUTOSET action: auto-configures optimal volts/div, 0V offset, timebase, and stationary trigger lock
  const handleAutoset = () => {
    // 1. Gather recent samples from buffer
    const buf = sampleBufferRef.current.length > 0 ? sampleBufferRef.current : scopeSampleBuffer;
    let ch1Min = Infinity, ch1Max = -Infinity;
    let ch2Min = Infinity, ch2Max = -Infinity;

    if (buf.length > 0) {
      // Analyze recent samples (up to last 4000 samples for high accuracy)
      const recent = buf.slice(-4000);
      for (const p of recent) {
        if (p.v1 < ch1Min) ch1Min = p.v1;
        if (p.v1 > ch1Max) ch1Max = p.v1;
        if (p.v2 < ch2Min) ch2Min = p.v2;
        if (p.v2 > ch2Max) ch2Max = p.v2;
      }
    }

    // Fallbacks from telemetry if buffer was empty
    if (!isFinite(ch1Min) || !isFinite(ch1Max)) {
      ch1Min = telemetryCH1.vMin ?? 0;
      ch1Max = telemetryCH1.vMax ?? 0;
    }
    if (!isFinite(ch2Min) || !isFinite(ch2Max)) {
      ch2Min = telemetryCH2.vMin ?? 0;
      ch2Max = telemetryCH2.vMax ?? 0;
    }

    // Compute fresh telemetry on the buffer for high frequency accuracy
    let telem1 = telemetryCH1;
    let telem2 = telemetryCH2;
    if (buf.length >= 10) {
      if (oscilloscope.ch1.enabled) {
        telem1 = computeSignalTelemetry(buf.map((p) => ({ t: p.t, v: p.v1 })), oscilloscope.timebaseMsPerDiv);
      }
      if (oscilloscope.ch2.enabled) {
        telem2 = computeSignalTelemetry(buf.map((p) => ({ t: p.t, v: p.v2 })), oscilloscope.timebaseMsPerDiv);
      }
    }

    // 2. Rule 2: Compute Optimal Volts/Div per Channel (No Clipping!)
    // Snap UP to next available standard option [0.5, 1, 2, 5, 10]
    const pickOptimalVDiv = (vMin: number, vMax: number): number => {
      const peakAbsV = Math.max(Math.abs(vMax), Math.abs(vMin), 0.5);
      const idealVDiv = peakAbsV / 3.0;
      const vDivOptions = [0.5, 1.0, 2.0, 5.0, 10.0];
      for (const opt of vDivOptions) {
        if (opt >= idealVDiv) {
          return opt;
        }
      }
      return 10.0;
    };

    const vDiv1 = pickOptimalVDiv(ch1Min, ch1Max);
    const vDiv2 = pickOptimalVDiv(ch2Min, ch2Max);

    // Rule 1: Reset Vertical Offsets to 0 and Coupling to 'DC'
    if (oscilloscope.ch1.enabled) {
      setScopeChannelConfig('ch1', {
        voltsPerDiv: vDiv1,
        offsetDiv: 0,
        coupling: 'DC',
      });
    }
    if (oscilloscope.ch2.enabled) {
      setScopeChannelConfig('ch2', {
        voltsPerDiv: vDiv2,
        offsetDiv: 0,
        coupling: 'DC',
      });
    }

    // 3. Rule 3: Compute Optimal Time/Div (Show ~3 to 5 Clean Wave Cycles)
    const ch1Vpp = Math.max(0, ch1Max - ch1Min);
    const ch2Vpp = Math.max(0, ch2Max - ch2Min);

    const ch1HasAc = ch1Vpp > 0.5 && telem1.frequencyHz > 0.5;
    const ch2HasAc = ch2Vpp > 0.5 && telem2.frequencyHz > 0.5;

    let dominantTelem = telem1;
    let dominantChan: 'ch1' | 'ch2' = 'ch1';
    let dominantMin = ch1Min;
    let dominantMax = ch1Max;

    if (oscilloscope.ch2.enabled && ch2HasAc && (!ch1HasAc || ch2Vpp > ch1Vpp)) {
      dominantTelem = telem2;
      dominantChan = 'ch2';
      dominantMin = ch2Min;
      dominantMax = ch2Max;
    } else if (oscilloscope.ch1.enabled && ch1HasAc) {
      dominantTelem = telem1;
      dominantChan = 'ch1';
      dominantMin = ch1Min;
      dominantMax = ch1Max;
    } else if (oscilloscope.ch2.enabled && telem2.frequencyHz > 0.5 && telem1.frequencyHz <= 0.5) {
      dominantTelem = telem2;
      dominantChan = 'ch2';
      dominantMin = ch2Min;
      dominantMax = ch2Max;
    } else if (oscilloscope.ch1.enabled && telem1.frequencyHz > 0.5) {
      dominantTelem = telem1;
      dominantChan = 'ch1';
      dominantMin = ch1Min;
      dominantMax = ch1Max;
    } else if (oscilloscope.ch2.enabled && ch2Vpp > ch1Vpp) {
      dominantTelem = telem2;
      dominantChan = 'ch2';
      dominantMin = ch2Min;
      dominantMax = ch2Max;
    }

    const freqHz = dominantTelem.frequencyHz ?? 0;
    if (freqHz > 0.5) {
      const periodMs = 1000 / freqHz;
      // Target showing 4 complete cycles across 10 divisions
      const idealTimePerDivMs = (4 * periodMs) / 10;
      const standardTimebases = [1, 5, 10, 20, 50, 100, 500, 1000];

      let closestTb = standardTimebases[0];
      let minDiff = Math.abs(closestTb - idealTimePerDivMs);
      for (const tb of standardTimebases) {
        const diff = Math.abs(tb - idealTimePerDivMs);
        if (diff < minDiff) {
          minDiff = diff;
          closestTb = tb;
        }
      }
      setScopeTimebase(closestTb);
    } else {
      setScopeTimebase(10);
    }

    // 4. Rule 4: Auto-Select Optimal Trigger Source & Trigger Level
    setTriggerLockMode('trig'); // Stationary lock!
    const midV = (dominantMax + dominantMin) / 2;
    setScopeTrigger({
      source: dominantChan,
      levelV: Number(midV.toFixed(2)),
      mode: 'auto',
      edge: 'rising',
    });
  };

  // Render Oscilloscope Phosphor Canvas
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // High-DPI Anti-Aliasing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Phosphor CRT Background
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, width, height);

    // 2. Graticule Grid (10 horizontal divs, 8 vertical divs)
    const numDivX = 10;
    const numDivY = 8;
    const divWidth = width / numDivX;
    const divHeight = height / numDivY;
    const totalSpanMs = Math.max(1, 10 * oscilloscope.timebaseMsPerDiv);

    ctx.strokeStyle = '#162238';
    ctx.lineWidth = 1;

    for (let x = 1; x < numDivX; x++) {
      ctx.beginPath();
      ctx.moveTo(x * divWidth, 0);
      ctx.lineTo(x * divWidth, height);
      ctx.stroke();
    }

    for (let y = 1; y < numDivY; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * divHeight);
      ctx.lineTo(width, y * divHeight);
      ctx.stroke();
    }

    // Dotted Center Axis Crosshairs
    ctx.strokeStyle = '#273c60';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 4]);

    // Center Horizontal Axis (0V baseline)
    const midY = height / 2;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    // Center Vertical Axis
    const midX = width / 2;
    ctx.beginPath();
    ctx.moveTo(midX, 0);
    ctx.lineTo(midX, height);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    const buf = sampleBufferRef.current;

    // Helper to evaluate coupled voltage (DC, AC, GND)
    const getCoupledVoltage = (raw: number, chConfig: typeof oscilloscope.ch1, vAvg: number) => {
      if (chConfig.coupling === 'GND') return 0;
      if (chConfig.coupling === 'AC') return raw - vAvg;
      return raw;
    };

    // ==========================================
    // TIMEBASE WINDOW & TRIGGER SYNCHRONIZATION
    // ==========================================
    const trigger = oscilloscope.trigger;
    const trigChan = trigger.source === 'ch2' ? oscilloscope.ch2 : oscilloscope.ch1;
    const getTrigVal = (p: { t: number; v1: number; v2: number }) => (trigger.source === 'ch2' ? p.v2 : p.v1);
    const isRising = trigger.edge === 'rising';

    let effectiveTrigLevel = trigger.levelV;
    if (trigger.mode === 'auto') {
      const telem = trigger.source === 'ch2' ? telemetryCH2 : telemetryCH1;
      if (telem.vPp > 0.05) {
        if (effectiveTrigLevel < telem.vMin || effectiveTrigLevel > telem.vMax) {
          effectiveTrigLevel = (telem.vMax + telem.vMin) / 2;
        }
      }
    }

    // 3. Trigger Level Indicator Line (YT & MATH mode)
    if (displayMode !== 'XY') {
      const trigLevelV = effectiveTrigLevel;
      const trigSource = oscilloscope.trigger.source;
      const trigConfig = trigSource === 'ch1' ? oscilloscope.ch1 : oscilloscope.ch2;
      const trigPxPerV = divHeight / trigConfig.voltsPerDiv;
      const trigY = midY - (trigLevelV + trigConfig.offsetDiv * trigConfig.voltsPerDiv) * trigPxPerV;

      ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, trigY);
      ctx.lineTo(width, trigY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Trigger Marker "T"
      ctx.fillStyle = '#ef4444';
      ctx.font = '9px monospace';
      ctx.fillText(`T: ${trigLevelV.toFixed(1)}V`, width - 56, Math.max(12, Math.min(height - 4, trigY - 3)));
    }

    let tStart = 0;
    let tEnd = 0;
    let isStationaryTrig = false;

    if (buf.length > 1) {
      const tLatest = buf[buf.length - 1].t;
      const tEarliest = buf[0].t;
      const hasFullWindow = (tLatest - tEarliest) >= totalSpanMs;

      let trigIdx = -1;

      if (triggerLockMode === 'trig' && hasFullWindow && trigChan.enabled) {
        // Find latest sample that has at least totalSpanMs in front of it
        let maxSearchIdx = buf.length - 1;
        while (maxSearchIdx > 0 && (tLatest - buf[maxSearchIdx].t) < totalSpanMs) {
          maxSearchIdx--;
        }

        // Search backwards from maxSearchIdx down to 1 for the most recent trigger crossing
        for (let i = maxSearchIdx; i >= 1; i--) {
          const vPrev = getTrigVal(buf[i - 1]);
          const vCurr = getTrigVal(buf[i]);
          const matched = isRising
            ? (vPrev < effectiveTrigLevel && vCurr >= effectiveTrigLevel)
            : (vPrev > effectiveTrigLevel && vCurr <= effectiveTrigLevel);
          if (matched) {
            trigIdx = i;
            break;
          }
        }
      }

      if (triggerLockMode === 'trig' && trigIdx !== -1 && trigChan.enabled) {
        // Stationary lock: Trigger crossing locked at x = 0 (tStart)
        // Since buf[trigIdx].t <= tLatest - totalSpanMs, [tStart, tEnd] has 100% full sample coverage!
        tStart = buf[trigIdx].t;
        tEnd = tStart + totalSpanMs;
        isStationaryTrig = true;
      } else {
        // Roll mode or Auto fallback: smooth continuous scrolling
        tEnd = tLatest;
        tStart = Math.max(tEarliest, tEnd - totalSpanMs);
      }
    }


    // ==========================================
    // MODE 1: XY (LISSAJOUS) MODE
    // ==========================================
    if (displayMode === 'XY') {
      if (buf.length > 2) {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 8;

        const pxPerDivX = divWidth;
        const pxPerDivY = divHeight;
        const pxPerVx = pxPerDivX / oscilloscope.ch1.voltsPerDiv;
        const pxPerVy = pxPerDivY / oscilloscope.ch2.voltsPerDiv;

        let startIdx = 0;
        while (startIdx < buf.length && buf[startIdx].t < tStart) {
          startIdx++;
        }
        let endIdx = buf.length - 1;
        while (endIdx >= 0 && buf[endIdx].t > tEnd) {
          endIdx--;
        }
        const fromIdx = Math.max(0, startIdx - 1);
        const toIdx = Math.min(buf.length - 1, endIdx + 1);

        ctx.beginPath();
        let first = true;
        for (let i = fromIdx; i <= toIdx; i++) {
          const s = buf[i];
          const vx = getCoupledVoltage(s.v1, oscilloscope.ch1, telemetryCH1.vAvg);
          const vy = getCoupledVoltage(s.v2, oscilloscope.ch2, telemetryCH2.vAvg);

          const x = midX + vx * pxPerVx + oscilloscope.ch1.offsetDiv * pxPerDivX;
          const y = midY - vy * pxPerVy - oscilloscope.ch2.offsetDiv * pxPerDivY;

          if (first) {
            ctx.moveTo(x, y);
            first = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    } else {
      // ==========================================
      // MODE 2 & 3: YT & MATH MODES
      // ==========================================
      if (buf.length > 1) {
        const drawChannelWaveform = (
          chConfig: typeof oscilloscope.ch1,
          getVal: (p: { t: number; v1: number; v2: number }) => number,
          vAvg: number
        ) => {
          if (!chConfig.enabled) return;

          ctx.strokeStyle = chConfig.color;
          ctx.lineWidth = 2;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.shadowColor = chConfig.color;
          ctx.shadowBlur = 6;

          ctx.beginPath();
          const pxPerDiv = divHeight;
          const pxPerVolt = pxPerDiv / chConfig.voltsPerDiv;
          const baselineY = midY - chConfig.offsetDiv * pxPerDiv;

          let startIdx = 0;
          while (startIdx < buf.length && buf[startIdx].t < tStart) {
            startIdx++;
          }
          let endIdx = buf.length - 1;
          while (endIdx >= 0 && buf[endIdx].t > tEnd) {
            endIdx--;
          }

          const fromIdx = Math.max(0, startIdx - 1);
          const toIdx = Math.min(buf.length - 1, endIdx + 1);

          let first = true;
          for (let i = fromIdx; i <= toIdx; i++) {
            const p = buf[i];
            const rawV = getVal(p);
            const volt = getCoupledVoltage(rawV, chConfig, vAvg);
            const x = ((p.t - tStart) / totalSpanMs) * width;
            const y = baselineY - volt * pxPerVolt;

            if (first) {
              ctx.moveTo(x, y);
              first = false;
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
          ctx.shadowBlur = 0; // reset
        };

        // Draw CH2 first, then CH1
        drawChannelWaveform(oscilloscope.ch2, (p) => p.v2, telemetryCH2.vAvg);
        drawChannelWaveform(oscilloscope.ch1, (p) => p.v1, telemetryCH1.vAvg);

        // Draw MATH waveform if in MATH mode
        if (displayMode === 'MATH') {
          ctx.strokeStyle = '#ec4899';
          ctx.lineWidth = 2.5;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.shadowColor = '#ec4899';
          ctx.shadowBlur = 8;

          ctx.beginPath();
          const pxPerDiv = divHeight;
          const mathVDiv = oscilloscope.ch1.voltsPerDiv;
          const pxPerVolt = pxPerDiv / mathVDiv;

          let startIdx = 0;
          while (startIdx < buf.length && buf[startIdx].t < tStart) {
            startIdx++;
          }
          let endIdx = buf.length - 1;
          while (endIdx >= 0 && buf[endIdx].t > tEnd) {
            endIdx--;
          }

          const fromIdx = Math.max(0, startIdx - 1);
          const toIdx = Math.min(buf.length - 1, endIdx + 1);

          let first = true;
          for (let i = fromIdx; i <= toIdx; i++) {
            const p = buf[i];
            const v1 = getCoupledVoltage(p.v1, oscilloscope.ch1, telemetryCH1.vAvg);
            const v2 = getCoupledVoltage(p.v2, oscilloscope.ch2, telemetryCH2.vAvg);
            const vMath = mathOp === 'ADD' ? v1 + v2 : v1 - v2;
            const x = ((p.t - tStart) / totalSpanMs) * width;
            const y = midY - vMath * pxPerVolt;

            if (first) {
              ctx.moveTo(x, y);
              first = false;
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      } else {
        // Idle Flat Baselines when empty
        const drawFlat = (chConfig: typeof oscilloscope.ch1) => {
          if (!chConfig.enabled) return;
          const baselineY = midY - chConfig.offsetDiv * divHeight;
          ctx.strokeStyle = chConfig.color;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.moveTo(0, baselineY);
          ctx.lineTo(width, baselineY);
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        };
        drawFlat(oscilloscope.ch1);
        drawFlat(oscilloscope.ch2);
      }
    }

    // ==========================================
    // 4. INTERACTIVE MEASUREMENT CURSORS
    // ==========================================
    if (cursorMode === 'TIME' || cursorMode === 'BOTH') {
      const x1 = cursorT1 * width;
      const x2 = cursorT2 * width;

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);

      // T1 Cursor
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, height);
      ctx.stroke();

      // T2 Cursor
      ctx.beginPath();
      ctx.moveTo(x2, 0);
      ctx.lineTo(x2, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Cursors Badges
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`T1: ${(cursorT1 * totalSpanMs).toFixed(1)}ms`, Math.max(4, x1 - 18), 12);
      ctx.fillText(`T2: ${(cursorT2 * totalSpanMs).toFixed(1)}ms`, Math.max(4, x2 - 18), 24);
    }

    if (cursorMode === 'VOLT' || cursorMode === 'BOTH') {
      const y1 = cursorV1 * height;
      const y2 = cursorV2 * height;

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);

      // V1 Cursor
      ctx.beginPath();
      ctx.moveTo(0, y1);
      ctx.lineTo(width, y1);
      ctx.stroke();

      // V2 Cursor
      ctx.beginPath();
      ctx.moveTo(0, y2);
      ctx.lineTo(width, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      const vPerDiv = oscilloscope.ch1.voltsPerDiv;
      const calcV1 = ((midY - y1) / divHeight - oscilloscope.ch1.offsetDiv) * vPerDiv;
      const calcV2 = ((midY - y2) / divHeight - oscilloscope.ch1.offsetDiv) * vPerDiv;

      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`V1: ${calcV1.toFixed(2)}V`, width - 58, Math.max(12, y1 - 3));
      ctx.fillText(`V2: ${calcV2.toFixed(2)}V`, width - 58, Math.max(24, y2 - 3));
    }

    // 5. On-Screen Scale & Mode Overlays
    // Top-Left: CH1 (Yellow #facc15)
    ctx.textAlign = 'left';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#facc15';
    ctx.fillText(
      `CH1: ${oscilloscope.ch1.voltsPerDiv}V/div (${oscilloscope.ch1.coupling})`,
      12,
      18
    );

    // Top-Left Line 2: MATH Mode (Pink/Magenta #f472b6) or XY Mode (#22c55e)
    if (displayMode === 'MATH') {
      ctx.fillStyle = '#f472b6';
      ctx.fillText(
        `MATH: ${mathOp} (${oscilloscope.ch1.voltsPerDiv}V/div)`,
        12,
        34
      );
    } else if (displayMode === 'XY') {
      ctx.fillStyle = '#22c55e';
      ctx.fillText('XY: CH1 (X) vs CH2 (Y)', 12, 34);
    }

    // Top-Center: Trigger / Pause Status Badge
    ctx.textAlign = 'center';
    ctx.font = 'bold 10px monospace';
    if (oscilloscope.isPaused) {
      ctx.fillStyle = '#ef4444';
      ctx.fillText('🔴 STOP', width / 2, 18);
    } else if (isStationaryTrig) {
      ctx.fillStyle = '#22c55e';
      ctx.fillText('🟢 TRIG\'D', width / 2, 18);
    } else if (triggerLockMode === 'roll') {
      ctx.fillStyle = '#06b6d4';
      ctx.fillText('🌊 ROLL', width / 2, 18);
    } else {
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('⏳ AUTO', width / 2, 18);
    }

    // Top-Right: CH2 (Cyan #38bdf8), Right-Aligned
    ctx.textAlign = 'right';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(
      `CH2: ${oscilloscope.ch2.voltsPerDiv}V/div (${oscilloscope.ch2.coupling})`,
      width - 12,
      18
    );

    // Bottom-Center: Timebase & Trigger Mode
    ctx.textAlign = 'center';
    ctx.font = '10px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(
      `TB: ${oscilloscope.timebaseMsPerDiv}ms/div | ${oscilloscope.trigger.mode.toUpperCase()}`,
      width / 2,
      height - 8
    );
    ctx.textAlign = 'left';
  };

  if (!showOscilloscope) return null;

  // Build target options for quick dropdown
  const allSelectableTargets: Array<{ label: string; target: ProbeTarget }> = [
    { label: 'CAL: 1kHz 5V Square', target: { type: 'pin', compId: '__CALIBRATOR__', pinId: 'CAL_1KHZ', label: 'CAL: 1kHz Sqr' } },
    { label: 'CAL: 1kHz 5V Sine', target: { type: 'pin', compId: '__CALIBRATOR__', pinId: 'CAL_SINE', label: 'CAL: 1kHz Sine' } },
    { label: 'CAL: 500Hz 5V Triangle', target: { type: 'pin', compId: '__CALIBRATOR__', pinId: 'CAL_TRIANGLE', label: 'CAL: 500Hz Tri' } },
    { label: 'CAL: 200Hz 5V Sawtooth', target: { type: 'pin', compId: '__CALIBRATOR__', pinId: 'CAL_SAWTOOTH', label: 'CAL: 200Hz Saw' } },
  ];

  components.forEach((c) => {
    if (c.type !== 'textbox') {
      const pinIds = c.type === 'arduino-uno' || c.type === 'esp32' || c.type === 'pico'
        ? ['D13', 'D12', 'D2', '3V3', '5V', 'GND', 'A0', 'TX', 'RX']
        : ['pos', 'neg', 'p1', 'p2', 'anode', 'cathode', 'out', 'in'];

      pinIds.forEach((pid) => {
        allSelectableTargets.push({
          label: `${c.label || c.id} : Pin ${pid}`,
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

  // Calculate live cursor deltas
  const totalSpanMs = 10 * oscilloscope.timebaseMsPerDiv;
  const deltaTMs = Math.abs((cursorT2 - cursorT1) * totalSpanMs);
  const cursorFreqHz = deltaTMs > 0.001 ? (1000 / deltaTMs) : 0;

  const divH = canvasDimensions.height / 8;
  const midY = canvasDimensions.height / 2;
  const vPerDiv = oscilloscope.ch1.voltsPerDiv;
  const v1Cur = ((midY - cursorV1 * canvasDimensions.height) / divH - oscilloscope.ch1.offsetDiv) * vPerDiv;
  const v2Cur = ((midY - cursorV2 * canvasDimensions.height) / divH - oscilloscope.ch1.offsetDiv) * vPerDiv;
  const deltaVVal = Math.abs(v2Cur - v1Cur);

  return (
    <div
      ref={windowRef}
      style={
        isFullscreen
          ? { left: '2.5vw', top: '4vh', width: '95vw', height: '92vh' }
          : { left: `${position.x}px`, top: `${position.y}px`, width: '560px' }
      }
      className={`fixed z-40 rounded-2xl border shadow-2xl overflow-hidden select-none flex flex-col ${
        isDark
          ? 'bg-slate-900 border-emerald-500/40 text-slate-100 shadow-emerald-950/20'
          : 'bg-white border-emerald-400 text-slate-800 shadow-emerald-500/10'
      }`}
    >
      {/* 1. OSCILLOSCOPE HEADER BAR */}
      <div
        onMouseDown={handleMouseDown}
        className={`px-3 py-2 flex items-center justify-between gap-2 overflow-hidden w-full cursor-move border-b shrink-0 whitespace-nowrap ${
          isDark
            ? 'bg-gradient-to-r from-emerald-700/40 via-slate-900 to-teal-800/30 border-emerald-500/30'
            : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white border-emerald-600'
        }`}
      >
        {/* Title */}
        <div className="flex items-center gap-1.5 shrink min-w-0">
          <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-bold text-xs tracking-wide truncate">
            Oscilloscope (DSO-2000X)
          </span>
        </div>

        {/* Display Mode Tabs (YT, XY, MATH) */}
        <div className="flex items-center gap-0.5 bg-black/30 p-0.5 rounded-lg border border-white/10 shrink-0">
          {(['YT', 'XY', 'MATH'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setDisplayMode(m)}
              className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold transition whitespace-nowrap ${
                displayMode === m
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Action Buttons: Run/Stop, AUTOSET, Clear, Fullscreen (⛶), Close (×) */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          <button
            onClick={toggleScopePaused}
            className={`py-1 px-2 rounded transition flex items-center gap-1 text-[10px] font-bold ${
              oscilloscope.isPaused
                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
            }`}
          >
            {oscilloscope.isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            {oscilloscope.isPaused ? 'RUN' : 'STOP'}
          </button>

          <button
            onClick={handleAutoset}
            className="py-1 px-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1 text-[10px] font-bold shadow-sm"
            title="Auto-scale Voltage & Timebase"
          >
            <Wand2 className="w-3 h-3" />
            AUTOSET
          </button>

          <button
            onClick={handleClearBuffer}
            className="p-1 rounded hover:bg-black/20 text-current transition shrink-0"
            title="Clear Buffer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 rounded hover:bg-black/20 text-current transition shrink-0"
            title={isFullscreen ? 'Restore Window Size' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => toggleInstrument('oscilloscope')}
            className="p-1 rounded hover:bg-red-500 hover:text-white transition shrink-0"
            title="Close Oscilloscope"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className={`p-3 space-y-2.5 overflow-y-auto ${isFullscreen ? 'flex-1 flex flex-col' : ''}`}>
        {/* 2. REAL-TIME HTML5 PHOSPHOR CANVAS */}
        <div
          ref={canvasContainerRef}
          className={`w-full rounded-xl border-2 border-slate-800 bg-[#060a12] relative overflow-hidden shadow-inner ${
            isFullscreen ? 'flex-1 min-h-[360px]' : 'h-48'
          }`}
        >
          <canvas
            ref={canvasRef}
            width={canvasDimensions.width}
            height={canvasDimensions.height}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className={`w-full h-full block ${cursorMode !== 'OFF' ? 'cursor-crosshair' : 'cursor-default'}`}
          />
        </div>

        {/* 3. PRO SUITE CONTROLS: CURSORS & TEST CALIBRATOR BAR */}
        <div
          className={`p-2 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-[10px] ${
            isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-100/90 border-slate-200'
          }`}
        >
          {/* Cursors Switcher */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-400 flex items-center gap-1">
              <Sliders className="w-3 h-3 text-emerald-400" />
              CURSORS:
            </span>
            <div className="flex items-center bg-black/30 p-0.5 rounded border border-white/10">
              {(['OFF', 'TIME', 'VOLT', 'BOTH'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setCursorMode(mode)}
                  className={`px-1.5 py-0.5 rounded font-bold transition ${
                    cursorMode === mode
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Test Signal Calibrator Source */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-400 flex items-center gap-1">
              <Radio className="w-3 h-3 text-cyan-400" />
              CAL OUT:
            </span>
            <select
              value={calibratorSignal}
              onChange={(e) => setCalibratorSignal(e.target.value as any)}
              className={`py-0.5 px-1 rounded text-[10px] font-mono border ${
                isDark ? 'bg-slate-900 border-slate-700 text-cyan-300' : 'bg-white border-slate-300 text-cyan-700'
              }`}
            >
              <option value="1KHZ_SQR">1 kHz Square (5V)</option>
              <option value="1KHZ_SINE">1 kHz Sine (5V)</option>
              <option value="500HZ_TRI">500 Hz Triangle (5V)</option>
              <option value="200HZ_SAW">200 Hz Sawtooth (5V)</option>
            </select>

            <button
              onClick={() => {
                const pinMap: Record<string, string> = {
                  '1KHZ_SQR': 'CAL_1KHZ',
                  '1KHZ_SINE': 'CAL_SINE',
                  '500HZ_TRI': 'CAL_TRIANGLE',
                  '200HZ_SAW': 'CAL_SAWTOOTH',
                };
                setScopeChannelConfig('ch1', {
                  target: {
                    type: 'pin',
                    compId: '__CALIBRATOR__',
                    pinId: pinMap[calibratorSignal],
                    label: `CAL (${calibratorSignal})`,
                  },
                });
              }}
              className="px-1.5 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition"
              title="Clip Channel 1 to Calibrator Out"
            >
              Clip CH1
            </button>
          </div>

          {/* Math Mode Operator Switcher (if in MATH mode) */}
          {displayMode === 'MATH' && (
            <div className="flex items-center gap-1">
              <span className="font-bold text-pink-400">MATH OP:</span>
              <button
                onClick={() => setMathOp(mathOp === 'ADD' ? 'SUB' : 'ADD')}
                className="px-2 py-0.5 rounded bg-pink-500/20 border border-pink-500/40 text-pink-300 font-bold flex items-center gap-1"
              >
                {mathOp === 'ADD' ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                {mathOp === 'ADD' ? 'CH1 + CH2' : 'CH1 - CH2'}
              </button>
            </div>
          )}
        </div>

        {/* Live Cursors Readout Bar (if cursors active) */}
        {cursorMode !== 'OFF' && (
          <div
            className={`px-2.5 py-1.5 rounded-xl border font-mono text-[9.5px] flex items-center justify-between gap-2 ${
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-100 border-slate-300'
            }`}
          >
            {(cursorMode === 'TIME' || cursorMode === 'BOTH') && (
              <div className="flex items-center gap-2 text-cyan-400">
                <span>ΔT: <strong className="text-white">{deltaTMs.toFixed(2)} ms</strong></span>
                <span>1/ΔT: <strong className="text-white">{cursorFreqHz.toFixed(1)} Hz</strong></span>
              </div>
            )}
            {(cursorMode === 'VOLT' || cursorMode === 'BOTH') && (
              <div className="flex items-center gap-2 text-amber-400">
                <span>V1: {v1Cur.toFixed(2)}V</span>
                <span>V2: {v2Cur.toFixed(2)}V</span>
                <span>ΔV: <strong className="text-white">{deltaVVal.toFixed(2)} V</strong></span>
              </div>
            )}
          </div>
        )}

        {/* 4. CHANNEL CONTROLS & PROBES BAR */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Channel 1 Controls (Yellow) */}
          <div
            className={`p-2 rounded-xl border space-y-1.5 ${
              isDark ? 'bg-slate-950/60 border-yellow-500/30' : 'bg-yellow-50/50 border-yellow-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 font-bold text-yellow-500 text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={oscilloscope.ch1.enabled}
                  onChange={(e) => setScopeChannelConfig('ch1', { enabled: e.target.checked })}
                  className="accent-yellow-500 rounded"
                />
                Channel 1 (CH1)
              </label>

              {/* Probe Clip Button */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    setActiveProbePicker(
                      activeProbePicker?.channelId === 'ch1'
                        ? null
                        : {
                            instrument: 'oscilloscope',
                            channelId: 'ch1',
                            color: '#facc15',
                            title: 'Oscilloscope CH1 (Yellow)',
                          }
                    )
                  }
                  className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold flex items-center gap-1 transition ${
                    activeProbePicker?.channelId === 'ch1'
                      ? 'bg-yellow-500 text-slate-950 border-yellow-600 animate-pulse'
                      : isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-yellow-400 border-slate-700'
                      : 'bg-white hover:bg-slate-100 text-yellow-600 border-slate-300'
                  }`}
                >
                  <Target className="w-3 h-3" />
                  Clip
                </button>

                {oscilloscope.ch1.target && (
                  <button
                    onClick={() => detachProbe('oscilloscope', 'ch1')}
                    className="p-0.5 rounded text-slate-400 hover:text-red-500 transition"
                    title="Detach CH1 Probe"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Node Target Display */}
            <div className="text-[10px] font-mono text-slate-400 truncate">
              Probe: <span className="text-yellow-400 font-semibold">{getProbeTargetDisplay(oscilloscope.ch1.target)}</span>
            </div>

            {/* Coupling Switches (DC | AC | GND) */}
            <div className="flex items-center justify-between gap-1 text-[10px]">
              <span className="text-slate-400">Coupling:</span>
              <div className="flex items-center bg-black/30 p-0.5 rounded border border-white/10">
                {(['DC', 'AC', 'GND'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setScopeChannelConfig('ch1', { coupling: c })}
                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold transition ${
                      oscilloscope.ch1.coupling === c
                        ? 'bg-yellow-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* V/Div & Offset Sliders */}
            <div className="flex items-center justify-between gap-1 text-[10px]">
              <div className="flex items-center gap-1">
                <span className="text-slate-400">V/Div:</span>
                <select
                  value={oscilloscope.ch1.voltsPerDiv}
                  onChange={(e) => setScopeChannelConfig('ch1', { voltsPerDiv: parseFloat(e.target.value) })}
                  className={`py-0.5 px-1 rounded border text-[10px] ${
                    isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'
                  }`}
                >
                  {[0.5, 1.0, 2.0, 5.0, 10.0].map((v) => (
                    <option key={v} value={v}>
                      {v} V
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-slate-400">Offset:</span>
                <input
                  type="range"
                  min="-3"
                  max="3"
                  step="0.5"
                  value={oscilloscope.ch1.offsetDiv}
                  onChange={(e) => setScopeChannelConfig('ch1', { offsetDiv: parseFloat(e.target.value) })}
                  className="w-16 accent-yellow-500"
                />
              </div>
            </div>
          </div>

          {/* Channel 2 Controls (Cyan) */}
          <div
            className={`p-2 rounded-xl border space-y-1.5 ${
              isDark ? 'bg-slate-950/60 border-cyan-500/30' : 'bg-cyan-50/50 border-cyan-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 font-bold text-cyan-400 text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={oscilloscope.ch2.enabled}
                  onChange={(e) => setScopeChannelConfig('ch2', { enabled: e.target.checked })}
                  className="accent-cyan-500 rounded"
                />
                Channel 2 (CH2)
              </label>

              {/* Probe Clip Button */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    setActiveProbePicker(
                      activeProbePicker?.channelId === 'ch2'
                        ? null
                        : {
                            instrument: 'oscilloscope',
                            channelId: 'ch2',
                            color: '#38bdf8',
                            title: 'Oscilloscope CH2 (Cyan)',
                          }
                    )
                  }
                  className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold flex items-center gap-1 transition ${
                    activeProbePicker?.channelId === 'ch2'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-600 animate-pulse'
                      : isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border-slate-700'
                      : 'bg-white hover:bg-slate-100 text-cyan-600 border-slate-300'
                  }`}
                >
                  <Target className="w-3 h-3" />
                  Clip
                </button>

                {oscilloscope.ch2.target && (
                  <button
                    onClick={() => detachProbe('oscilloscope', 'ch2')}
                    className="p-0.5 rounded text-slate-400 hover:text-red-500 transition"
                    title="Detach CH2 Probe"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Node Target Display */}
            <div className="text-[10px] font-mono text-slate-400 truncate">
              Probe: <span className="text-cyan-400 font-semibold">{getProbeTargetDisplay(oscilloscope.ch2.target)}</span>
            </div>

            {/* Coupling Switches (DC | AC | GND) */}
            <div className="flex items-center justify-between gap-1 text-[10px]">
              <span className="text-slate-400">Coupling:</span>
              <div className="flex items-center bg-black/30 p-0.5 rounded border border-white/10">
                {(['DC', 'AC', 'GND'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setScopeChannelConfig('ch2', { coupling: c })}
                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold transition ${
                      oscilloscope.ch2.coupling === c
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* V/Div & Offset Sliders */}
            <div className="flex items-center justify-between gap-1 text-[10px]">
              <div className="flex items-center gap-1">
                <span className="text-slate-400">V/Div:</span>
                <select
                  value={oscilloscope.ch2.voltsPerDiv}
                  onChange={(e) => setScopeChannelConfig('ch2', { voltsPerDiv: parseFloat(e.target.value) })}
                  className={`py-0.5 px-1 rounded border text-[10px] ${
                    isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'
                  }`}
                >
                  {[0.5, 1.0, 2.0, 5.0, 10.0].map((v) => (
                    <option key={v} value={v}>
                      {v} V
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-slate-400">Offset:</span>
                <input
                  type="range"
                  min="-3"
                  max="3"
                  step="0.5"
                  value={oscilloscope.ch2.offsetDiv}
                  onChange={(e) => setScopeChannelConfig('ch2', { offsetDiv: parseFloat(e.target.value) })}
                  className="w-16 accent-cyan-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 5. TIMEBASE & TRIGGER CONTROL BAR */}
        <div
          className={`p-2 rounded-xl border flex items-center justify-between text-[11px] gap-2 ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          {/* Timebase (Time/Div) */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-400 text-[10px]">TIME/DIV:</span>
            <select
              value={oscilloscope.timebaseMsPerDiv}
              onChange={(e) => setScopeTimebase(parseFloat(e.target.value))}
              className={`py-1 px-1.5 rounded text-[10px] font-mono font-bold border ${
                isDark ? 'bg-slate-900 border-slate-700 text-emerald-400' : 'bg-white border-slate-300 text-emerald-700'
              }`}
            >
              {[1, 5, 10, 20, 50, 100, 500, 1000].map((ms) => (
                <option key={ms} value={ms}>
                  {ms >= 1000 ? `${ms / 1000}s/div` : `${ms}ms/div`}
                </option>
              ))}
            </select>
          </div>

          {/* Trigger Source & Edge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[10px]">Trig:</span>
              <select
                value={oscilloscope.trigger.source}
                onChange={(e) => setScopeTrigger({ source: e.target.value as any })}
                className={`py-0.5 px-1 rounded text-[10px] font-bold border ${
                  isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'
                }`}
              >
                <option value="ch1">CH1</option>
                <option value="ch2">CH2</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setScopeTrigger({
                    edge: oscilloscope.trigger.edge === 'rising' ? 'falling' : 'rising',
                  })
                }
                className={`px-1.5 py-0.5 rounded text-[10px] border font-bold ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'
                }`}
                title="Toggle Trigger Edge"
              >
                {oscilloscope.trigger.edge === 'rising' ? '↗ Rise' : '↘ Fall'}
              </button>
            </div>

            {/* Trigger Mode: Stationary Lock vs Continuous Roll */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTriggerLockMode((m) => (m === 'trig' ? 'roll' : 'trig'))}
                className={`px-1.5 py-0.5 rounded text-[10px] border font-bold transition flex items-center gap-1 ${
                  triggerLockMode === 'trig'
                    ? isDark
                      ? 'bg-emerald-950/70 border-emerald-500/70 text-emerald-400'
                      : 'bg-emerald-100 border-emerald-500 text-emerald-700'
                    : isDark
                      ? 'bg-cyan-950/70 border-cyan-500/70 text-cyan-400'
                      : 'bg-cyan-100 border-cyan-500 text-cyan-700'
                }`}
                title="Toggle between Stationary Triggered Lock (TRIG'D) and Continuous Smooth Scrolling (ROLL)"
              >
                {triggerLockMode === 'trig' ? '🔒 TRIG\'D' : '🌊 ROLL'}
              </button>
            </div>

            {/* Trigger Level */}
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[10px]">Level:</span>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.2"
                value={oscilloscope.trigger.levelV}
                onChange={(e) => setScopeTrigger({ levelV: parseFloat(e.target.value) })}
                className="w-14 accent-red-500"
              />
            </div>
          </div>
        </div>

        {/* 6. LIVE AUTOMATED MEASUREMENTS TELEMETRY BAR */}
        <div
          className={`p-2 rounded-xl border font-mono text-[10px] space-y-1 ${
            isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-100/80 border-slate-200'
          }`}
        >
          {oscilloscope.ch1.enabled && (
            <div className="flex items-center justify-between text-yellow-400">
              <span className="font-bold">CH1</span>
              <span>Vpp: {telemetryCH1.vPp}V</span>
              <span>Vrms: {telemetryCH1.vRms}V</span>
              <span>Freq: {telemetryCH1.frequencyHz} Hz</span>
              <span>Period: {telemetryCH1.periodMs} ms</span>
              <span>Duty: {telemetryCH1.dutyCyclePct}%</span>
            </div>
          )}
          {oscilloscope.ch2.enabled && (
            <div className="flex items-center justify-between text-cyan-400">
              <span className="font-bold">CH2</span>
              <span>Vpp: {telemetryCH2.vPp}V</span>
              <span>Vrms: {telemetryCH2.vRms}V</span>
              <span>Freq: {telemetryCH2.frequencyHz} Hz</span>
              <span>Period: {telemetryCH2.periodMs} ms</span>
              <span>Duty: {telemetryCH2.dutyCyclePct}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
