import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Binary,
  X,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  RotateCcw,
  Target,
  ZoomIn,
  ZoomOut,
  Check,
  Activity,
  Table as TableIcon,
  Calculator,
  Download,
  Sparkles,
} from 'lucide-react';
import { useCircuitStore } from '../../store/useCircuitStore';
import {
  getProbeLogicLevel,
  getProbeTargetDisplay,
  evaluateAutomatedTruthTable,
} from '../../utils/instrumentSignals';
import {
  solveBooleanFunction,
  TruthTableRow,
  BooleanSolverResult,
} from '../../utils/booleanSolver';

export const LogicAnalyzer: React.FC = () => {
  const {
    theme,
    showLogicAnalyzer,
    toggleInstrument,
    logicAnalyzer,
    setLogicChannelConfig,
    setLogicTimeScale,
    toggleLogicPaused,
    setLogicCursors,
    detachProbe,
    setActiveProbePicker,
    activeProbePicker,
    components,
    wires,
  } = useCircuitStore();

  const isDark = theme === 'dark';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const waveformContainerRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  // Pro Suite View Modes: 'waveform' | 'binary' | 'kmap'
  const [viewMode, setViewMode] = useState<'waveform' | 'binary' | 'kmap'>('waveform');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Dynamic container dimensions for pixel-perfect row alignment in Windowed & Fullscreen modes
  const [containerDims, setContainerDims] = useState({ width: 480, height: 280 });

  // Zoom and Scroll State
  const [zoomFactor, setZoomFactor] = useState(1.0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Draggable HUD window position state (used when not fullscreen)
  const [position, setPosition] = useState({ x: 240, y: 120 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });

  // Time-series digital sample buffer
  // Format: { t: number, levels: Record<string, 0 | 1 | 'Z' | 'X'> }
  const sampleBufferRef = useRef<Array<{ t: number; levels: Record<string, 0 | 1 | 'Z' | 'X'> }>>([]);
  const edgeCountsRef = useRef<Record<string, number>>({});
  const lastLevelsRef = useRef<Record<string, 0 | 1 | 'Z' | 'X'>>({});

  // Inline editing of channel name
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Table View Filter
  const [tableFilterTransitionsOnly, setTableFilterTransitionsOnly] = useState(true);

  // K-Map & Truth Table Configuration State
  const [kmapNumInputs, setKmapNumInputs] = useState<2 | 3 | 4>(2);
  const [kmapInputChannels, setKmapInputChannels] = useState<string[]>(['D0', 'D1', 'D2', 'D3']);
  const [kmapOutputChannel, setKmapOutputChannel] = useState<string>('D2');
  const liveObservedMapRef = useRef<Record<number, { output: 0 | 1; count: number }>>({});

  // Drag handlers for floating window mode
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isFullscreen) return;
    if ((e.target as HTMLElement).closest('button, select, input, canvas, table')) return;
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
      if (!isDragging || isFullscreen) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const newX = Math.max(10, Math.min(window.innerWidth - 640, dragStartRef.current.posX + dx));
      const newY = Math.max(60, Math.min(window.innerHeight - 80, dragStartRef.current.posY + dy));
      if (containerRef.current) {
        containerRef.current.style.left = `${newX}px`;
        containerRef.current.style.top = `${newY}px`;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDragging) return;
      setIsDragging(false);
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const finalX = Math.max(10, Math.min(window.innerWidth - 640, dragStartRef.current.posX + dx));
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
  }, [isDragging, isFullscreen]);

  // Observe waveform container resize in Windowed & Fullscreen modes
  useEffect(() => {
    if (!showLogicAnalyzer || viewMode !== 'waveform') return;
    const updateDims = () => {
      const wfEl = waveformContainerRef.current;
      const cwEl = canvasWrapperRef.current;
      if (wfEl && cwEl) {
        setContainerDims({
          width: Math.max(460, Math.floor(cwEl.clientWidth)),
          height: Math.max(200, Math.floor(wfEl.clientHeight)),
        });
      }
    };
    updateDims();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateDims);
      if (waveformContainerRef.current) ro.observe(waveformContainerRef.current);
      if (canvasWrapperRef.current) ro.observe(canvasWrapperRef.current);
    }
    window.addEventListener('resize', updateDims);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateDims);
    };
  }, [showLogicAnalyzer, viewMode, isFullscreen, logicAnalyzer.channels]);

  // Sample loop on animationFrame
  useEffect(() => {
    if (!showLogicAnalyzer) return;

    let animId: number;
    let lastSampleTime = performance.now();

    const sampleLoop = (now: number) => {
      if (!logicAnalyzer.isPaused) {
        const dt = now - lastSampleTime;
        if (dt >= 15) {
          lastSampleTime = now;
          const levels: Record<string, 0 | 1 | 'Z' | 'X'> = {};

          logicAnalyzer.channels.forEach((ch) => {
            if (ch.enabled) {
              const lvl = getProbeLogicLevel(ch.target, components, wires);
              levels[ch.id] = lvl;

              // Check for rising edge
              const prev = lastLevelsRef.current[ch.id];
              if ((prev === 0 || prev === 'Z') && lvl === 1) {
                edgeCountsRef.current[ch.id] = (edgeCountsRef.current[ch.id] || 0) + 1;
              }
              lastLevelsRef.current[ch.id] = lvl;
            }
          });

          const buf = sampleBufferRef.current;
          buf.push({ t: now, levels });

          if (buf.length > 1000) {
            buf.shift();
          }

          // Update Live Observed Truth Table for K-Map Tab
          const inputsValid = kmapInputChannels.slice(0, kmapNumInputs).every(
            (chId) => levels[chId] === 0 || levels[chId] === 1
          );
          const outVal = levels[kmapOutputChannel];

          if (inputsValid && (outVal === 0 || outVal === 1)) {
            let minterm = 0;
            for (let i = 0; i < kmapNumInputs; i++) {
              const chId = kmapInputChannels[i];
              if (levels[chId] === 1) {
                minterm |= 1 << (kmapNumInputs - 1 - i);
              }
            }
            const prevObs = liveObservedMapRef.current[minterm];
            liveObservedMapRef.current[minterm] = {
              output: outVal as 0 | 1,
              count: (prevObs?.count || 0) + 1,
            };
          }
        }
      }

      if (viewMode === 'waveform') {
        drawCanvas();
      }
      animId = requestAnimationFrame(sampleLoop);
    };

    animId = requestAnimationFrame(sampleLoop);
    return () => cancelAnimationFrame(animId);
  }, [
    showLogicAnalyzer,
    logicAnalyzer,
    components,
    wires,
    viewMode,
    zoomFactor,
    scrollLeft,
    isFullscreen,
    kmapNumInputs,
    kmapInputChannels,
    kmapOutputChannel,
  ]);

  const handleClearBuffer = () => {
    sampleBufferRef.current = [];
    edgeCountsRef.current = {};
    liveObservedMapRef.current = {};
  };

  // Zoom controls
  const handleZoomIn = () => setZoomFactor((z) => Math.min(8.0, +(z * 1.5).toFixed(2)));
  const handleZoomOut = () => setZoomFactor((z) => Math.max(0.25, +(z / 1.5).toFixed(2)));
  const handleZoomFit = () => {
    setZoomFactor(1.0);
    setScrollLeft(0);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      if (e.deltaY < 0) handleZoomIn();
      else handleZoomOut();
    } else {
      setScrollLeft((sl) => Math.max(0, sl + e.deltaX + (e.shiftKey ? e.deltaY : 0)));
    }
  };

  // Render Saleae-inspired Timing Diagram Canvas
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Background
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, width, height);

    const activeChannels = logicAnalyzer.channels.filter((ch) => ch.enabled);
    if (activeChannels.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px sans-serif';
      ctx.fillText('No channels enabled. Enable at least one channel below.', 20, 40);
      return;
    }

    const topMargin = 24; // Exact shared header offset with Left Channel Sidebar
    const channelHeight = (height - topMargin) / activeChannels.length;

    // Draw Time Axis along the top
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, topMargin);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, topMargin);
    ctx.lineTo(width, topMargin);
    ctx.stroke();

    // Time markings
    const pxPerDiv = 50 * zoomFactor;
    const msPerDiv = logicAnalyzer.timeScaleMsPerDiv;
    ctx.fillStyle = '#64748b';
    ctx.font = '9px monospace';

    const startX = -(scrollLeft % pxPerDiv);
    for (let x = startX; x < width; x += pxPerDiv) {
      if (x < 0) continue;
      ctx.beginPath();
      ctx.moveTo(x, topMargin - 4);
      ctx.lineTo(x, topMargin);
      ctx.stroke();

      const timeVal = Math.round(((x + scrollLeft) / (50 * zoomFactor)) * msPerDiv);
      ctx.fillText(`${timeVal}ms`, x + 3, topMargin - 7);

      // Light vertical grid line down the canvas
      ctx.strokeStyle = '#131b2b';
      ctx.beginPath();
      ctx.moveTo(x, topMargin);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Render channels
    const buf = sampleBufferRef.current;

    activeChannels.forEach((ch, idx) => {
      const chTop = topMargin + idx * channelHeight;
      const chBottom = chTop + channelHeight;
      const highY = chTop + 5;
      const lowY = chBottom - 6;
      const midY = (highY + lowY) / 2;

      // Channel row background separator
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, chBottom);
      ctx.lineTo(width, chBottom);
      ctx.stroke();

      // Channel track line (low baseline)
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(0, lowY);
      ctx.lineTo(width, lowY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Waveform Transitions
      if (buf.length > 1) {
        ctx.strokeStyle = ch.color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'miter';
        ctx.beginPath();

        const count = buf.length;
        const baseDx = width / Math.max(count - 1, 1);
        const dx = baseDx * zoomFactor;

        let pulseStartIdx = 0;
        let currentPulseLvl: 0 | 1 | 'Z' | 'X' = buf[0]?.levels[ch.id] ?? 'Z';

        for (let i = 0; i < count; i++) {
          const sample = buf[i];
          const lvl = sample.levels[ch.id] ?? 'Z';
          const x = i * dx - scrollLeft;

          let targetY = lowY;
          if (lvl === 1) targetY = highY;
          else if (lvl === 0) targetY = lowY;
          else if (lvl === 'Z') targetY = midY;

          if (i === 0) {
            ctx.moveTo(x, targetY);
          } else {
            const prevLvl = buf[i - 1].levels[ch.id] ?? 'Z';
            let prevY = lowY;
            if (prevLvl === 1) prevY = highY;
            else if (prevLvl === 0) prevY = lowY;
            else if (prevLvl === 'Z') prevY = midY;

            if (prevY !== targetY) {
              // Pulse ended: render pulse bit label if zoomed in
              if (zoomFactor >= 1.2) {
                const pulseX1 = pulseStartIdx * dx - scrollLeft;
                const pulseX2 = x;
                const pulseW = pulseX2 - pulseX1;
                if (pulseW > 18 && (currentPulseLvl === 1 || currentPulseLvl === 0)) {
                  ctx.save();
                  ctx.fillStyle = currentPulseLvl === 1 ? '#4ade80' : '#94a3b8';
                  ctx.font = 'bold 8.5px monospace';
                  ctx.fillText(String(currentPulseLvl), (pulseX1 + pulseX2) / 2 - 3, (highY + lowY) / 2 + 3);
                  ctx.restore();
                }
              }
              pulseStartIdx = i;
              currentPulseLvl = lvl;

              ctx.lineTo(x, prevY);
              ctx.lineTo(x, targetY);
            } else {
              ctx.lineTo(x, targetY);
            }
          }
        }
        ctx.stroke();
      } else {
        // Idle line
        ctx.strokeStyle = ch.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, lowY);
        ctx.lineTo(width, lowY);
        ctx.stroke();
      }
    });

    // Measurement Cursors T1 and T2
    if (logicAnalyzer.cursorT1 !== null) {
      const x1 = Math.min(width, Math.max(0, logicAnalyzer.cursorT1 * zoomFactor - scrollLeft));
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, height);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('T1', x1 + 3, 14);
    }

    if (logicAnalyzer.cursorT2 !== null) {
      const x2 = Math.min(width, Math.max(0, logicAnalyzer.cursorT2 * zoomFactor - scrollLeft));
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(x2, 0);
      ctx.lineTo(x2, height);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('T2', x2 + 3, 14);
    }
  };

  // Canvas Click to set T1 / T2 cursors
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const unscaledX = (rawX + scrollLeft) / zoomFactor;

    if (logicAnalyzer.cursorT1 === null || (logicAnalyzer.cursorT1 !== null && logicAnalyzer.cursorT2 !== null)) {
      setLogicCursors(unscaledX, null);
    } else {
      setLogicCursors(logicAnalyzer.cursorT1, unscaledX);
    }
  };

  // -------------------------------------------------------------
  // TAB 2: BINARY / HEX STATE TABLE CALCULATIONS
  // -------------------------------------------------------------
  const activeChannels = useMemo(
    () => logicAnalyzer.channels.filter((ch) => ch.enabled),
    [logicAnalyzer.channels]
  );

  const tableRows = useMemo(() => {
    const buf = sampleBufferRef.current;
    if (buf.length === 0) return [];
    const firstT = buf[0].t;

    const rows: Array<{
      timeMs: string;
      bits: Record<string, 0 | 1 | 'Z' | 'X'>;
      binaryStr: string;
      hexStr: string;
      decStr: string;
    }> = [];

    let prevLevels: Record<string, any> = {};

    for (let i = 0; i < buf.length; i++) {
      const sample = buf[i];
      const levels = sample.levels;

      // Filter: only include when an enabled channel changed
      if (tableFilterTransitionsOnly && i > 0) {
        let changed = false;
        for (const ch of activeChannels) {
          if (levels[ch.id] !== prevLevels[ch.id]) {
            changed = true;
            break;
          }
        }
        if (!changed) continue;
      }
      prevLevels = levels;

      // Construct combined bus value
      // Active channels in natural order D0, D1, D2...
      const bitArr: (0 | 1 | 'Z' | 'X')[] = [];
      let isAllNumeric = true;
      let decVal = 0;

      activeChannels.forEach((ch, idx) => {
        const bit = levels[ch.id] ?? 'Z';
        bitArr.push(bit);
        if (bit === 1) {
          decVal += 1 << idx;
        } else if (bit !== 0) {
          isAllNumeric = false;
        }
      });

      const binaryStr = bitArr
        .slice()
        .reverse()
        .map((b) => (b === 1 ? '1' : b === 0 ? '0' : 'Z'))
        .join('');

      const hexStr = isAllNumeric
        ? `0x${decVal.toString(16).toUpperCase().padStart(Math.ceil(activeChannels.length / 4), '0')}`
        : '0x--';

      const decStr = isAllNumeric ? `${decVal}` : '--';

      rows.push({
        timeMs: ((sample.t - firstT)).toFixed(1),
        bits: levels,
        binaryStr: `0b${binaryStr}`,
        hexStr,
        decStr,
      });
    }

    return rows.slice(-150); // Keep last 150 transition entries for speed
  }, [sampleBufferRef.current.length, activeChannels, tableFilterTransitionsOnly]);

  const handleExportCsv = () => {
    if (tableRows.length === 0) return;
    const header = ['Time(ms)', ...activeChannels.map((c) => c.name || c.id), 'Bus_Binary', 'Bus_Hex', 'Bus_Dec'].join(',');
    const lines = tableRows.map((r) => {
      const bits = activeChannels.map((c) => r.bits[c.id] ?? 'Z').join(',');
      return `${r.timeMs},${bits},${r.binaryStr},${r.hexStr},${r.decStr}`;
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [header, ...lines].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'secs_logic_analyzer_capture.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // -------------------------------------------------------------
  // TAB 3: K-MAP & TRUTH TABLE BOOLEAN SOLVER CALCULATIONS
  // -------------------------------------------------------------
  const varNames = ['A', 'B', 'C', 'D'].slice(0, kmapNumInputs);
  const numRows = 1 << kmapNumInputs;

  // Instant Automated 2^N Circuit Combinational Evaluator
  const automatedTruthMap = useMemo(() => {
    const inputTargets = kmapInputChannels
      .slice(0, kmapNumInputs)
      .map((chId) => logicAnalyzer.channels.find((c) => c.id === chId)?.target ?? null);
    const outputTarget =
      logicAnalyzer.channels.find((c) => c.id === kmapOutputChannel)?.target ?? null;
    return evaluateAutomatedTruthTable(components, wires, inputTargets, outputTarget);
  }, [
    kmapNumInputs,
    kmapInputChannels,
    kmapOutputChannel,
    logicAnalyzer.channels,
    components.length,
    wires.length,
  ]);

  const truthTableData: TruthTableRow[] = useMemo(() => {
    const list: TruthTableRow[] = [];
    for (let m = 0; m < numRows; m++) {
      const inputs: number[] = [];
      for (let i = 0; i < kmapNumInputs; i++) {
        inputs.push((m >> (kmapNumInputs - 1 - i)) & 1);
      }

      // 100% Auto-detected circuit truth evaluation with live observed fallback
      const autoVal = automatedTruthMap[m];
      const observed = liveObservedMapRef.current[m];
      const output: 0 | 1 | 'X' =
        autoVal !== undefined
          ? autoVal
          : observed
          ? observed.output
          : 'X';

      list.push({
        index: m,
        inputs,
        output,
        observedCount: observed?.count ?? (autoVal !== undefined ? 1 : undefined),
      });
    }
    return list;
  }, [kmapNumInputs, automatedTruthMap, liveObservedMapRef.current]);

  const booleanSolution: BooleanSolverResult = useMemo(() => {
    return solveBooleanFunction(truthTableData, varNames);
  }, [truthTableData, varNames]);

  if (!showLogicAnalyzer) return null;

  // Calculate cursor delta-t and frequency
  let deltaT_ms: number | null = null;
  let freqHz: number | null = null;
  if (logicAnalyzer.cursorT1 !== null && logicAnalyzer.cursorT2 !== null) {
    const pxDiff = Math.abs(logicAnalyzer.cursorT2 - logicAnalyzer.cursorT1);
    const msPerPx = logicAnalyzer.timeScaleMsPerDiv / (50 * zoomFactor);
    deltaT_ms = pxDiff * msPerPx;
    if (deltaT_ms > 0.001) {
      freqHz = 1000 / deltaT_ms;
    }
  }

  // Shared dynamic row height between Left Channel Sidebar & Right Waveform Canvas
  const topMargin = 24;
  const numActiveChannels = Math.max(1, activeChannels.length);
  const rowHeight = isFullscreen
    ? Math.max(32, Math.floor((Math.max(320, containerDims.height) - topMargin) / numActiveChannels))
    : 32;
  const totalCanvasHeight = topMargin + numActiveChannels * rowHeight;
  const totalCanvasWidth = Math.max(460, containerDims.width);

  // Window geometry styling
  const windowClasses = isFullscreen
    ? 'fixed inset-4 z-50 rounded-2xl border shadow-2xl overflow-hidden flex flex-col select-none'
    : 'fixed z-40 w-[680px] rounded-2xl border shadow-2xl overflow-hidden select-none';

  const windowStyles = isFullscreen
    ? {}
    : { left: `${position.x}px`, top: `${position.y}px` };

  return (
    <div
      ref={containerRef}
      style={windowStyles}
      className={`${windowClasses} ${
        isDark
          ? 'bg-slate-900 border-purple-500/40 text-slate-100 shadow-purple-950/30'
          : 'bg-white border-purple-400 text-slate-800 shadow-purple-500/20'
      }`}
    >
      {/* 1. CLEAN SINGLE-LINE NON-WRAPPING HEADER TOOLBAR */}
      <div
        onMouseDown={handleMouseDown}
        className={`flex items-center justify-between gap-2 px-3 py-2 overflow-hidden w-full cursor-move border-b shrink-0 whitespace-nowrap ${
          isDark
            ? 'bg-slate-950 border-purple-500/30 text-white'
            : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white border-purple-600'
        }`}
      >
        {/* Left: Instrument Title */}
        <div className="flex items-center gap-1.5 shrink min-w-0">
          <Binary className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="font-bold text-xs tracking-wide truncate">
            Logic Analyzer
          </span>
        </div>

        {/* Center: Clean Segmented View Tabs */}
        <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded-lg border border-white/10 shrink-0">
          <button
            onClick={() => setViewMode('waveform')}
            className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold flex items-center gap-1 transition whitespace-nowrap ${
              viewMode === 'waveform'
                ? 'bg-purple-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3 h-3" />
            Waveform
          </button>
          <button
            onClick={() => setViewMode('binary')}
            className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold flex items-center gap-1 transition whitespace-nowrap ${
              viewMode === 'binary'
                ? 'bg-purple-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TableIcon className="w-3 h-3" />
            Binary / Hex
          </button>
          <button
            onClick={() => setViewMode('kmap')}
            className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold flex items-center gap-1 transition whitespace-nowrap ${
              viewMode === 'kmap'
                ? 'bg-purple-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calculator className="w-3 h-3" />
            K-Map & SOP
          </button>
        </div>

        {/* Right: Pause/Run, Clear/Reset, Fullscreen (⛶), Close (×) */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          <button
            onClick={toggleLogicPaused}
            className={`py-1 px-2 rounded transition flex items-center gap-1 text-[10px] font-bold ${
              logicAnalyzer.isPaused
                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                : 'bg-purple-500 text-white hover:bg-purple-400'
            }`}
          >
            {logicAnalyzer.isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            {logicAnalyzer.isPaused ? 'RUN' : 'PAUSE'}
          </button>

          <button
            onClick={handleClearBuffer}
            className="p-1 rounded hover:bg-black/20 text-current transition"
            title="Clear / Reset Waveform Buffer"
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
            onClick={() => toggleInstrument('logicAnalyzer')}
            className="p-1 rounded hover:bg-red-500 hover:text-white transition shrink-0"
            title="Close Logic Analyzer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className={`p-3 space-y-2.5 ${isFullscreen ? 'flex-1 overflow-y-auto flex flex-col' : ''}`}>
          {/* ========================================================= */}
          {/* TAB 1: WAVEFORM TIMING DIAGRAM VIEW                      */}
          {/* ========================================================= */}
          {viewMode === 'waveform' && (
            <div className={`space-y-2.5 ${isFullscreen ? 'flex-1 flex flex-col' : ''}`}>
              {/* Timing Diagram Graph & Channel Headers (Unified Dynamic Row Height) */}
              <div
                ref={waveformContainerRef}
                className={`flex rounded-xl border border-slate-800 bg-[#0a0d14] overflow-hidden shadow-inner ${
                  isFullscreen ? 'flex-1 min-h-[360px]' : ''
                }`}
              >
                {/* Left Channel Headers Strip */}
                <div className="w-44 bg-[#080b11] border-r border-slate-800 shrink-0 flex flex-col font-mono text-[10px]">
                  {/* Top Header Spacer Aligned with 24px Time Axis */}
                  <div
                    style={{ height: `${topMargin}px` }}
                    className="px-2.5 flex items-center justify-between bg-[#111827] border-b border-[#1f2937] text-[9px] text-slate-400 font-bold uppercase tracking-wider box-border shrink-0"
                  >
                    <span>CH / Signal</span>
                    <span>Lvl / Edges</span>
                  </div>

                  {activeChannels.map((ch) => {
                      const currentLvl = lastLevelsRef.current[ch.id] ?? 'Z';
                      const edgeCount = edgeCountsRef.current[ch.id] || 0;
                      const isEditing = editingChannelId === ch.id;

                      return (
                        <div
                          key={ch.id}
                          style={{ height: `${rowHeight}px` }}
                          className="px-2.5 flex items-center justify-between border-b border-slate-800/80 box-border group hover:bg-slate-800/40 shrink-0"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: ch.color }}
                            />
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  className="w-16 bg-slate-900 border border-slate-700 px-1 py-0.5 rounded text-[9px] text-white"
                                  autoFocus
                                />
                                <button
                                  onClick={() => {
                                    setLogicChannelConfig(ch.id, { name: editingName });
                                    setEditingChannelId(null);
                                  }}
                                  className="text-emerald-400"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <span
                                onClick={() => {
                                  setEditingChannelId(ch.id);
                                  setEditingName(ch.name);
                                }}
                                className="font-bold truncate cursor-pointer hover:underline"
                                style={{ color: ch.color }}
                                title="Click to rename"
                              >
                                {ch.name}
                              </span>
                            )}
                          </div>

                          {/* State & Edge Count Badge */}
                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className={`px-1 rounded text-[9px] font-bold ${
                                currentLvl === 1
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : currentLvl === 0
                                  ? 'bg-slate-800 text-slate-400'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {currentLvl}
                            </span>
                            <span className="text-[8px] text-slate-500" title="Rising Edges">
                              {edgeCount}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Right Timing Canvas Container */}
                <div
                  ref={canvasWrapperRef}
                  onWheel={handleWheel}
                  className="flex-1 relative cursor-crosshair overflow-x-auto bg-[#0a0d14]"
                >
                  <canvas
                    ref={canvasRef}
                    width={totalCanvasWidth}
                    height={totalCanvasHeight}
                    style={{ width: `${totalCanvasWidth}px`, height: `${totalCanvasHeight}px` }}
                    onClick={handleCanvasClick}
                    className="block"
                  />
                </div>
              </div>

              {/* Probe Assignment Carousel & Channel Chips */}
              <div className="flex flex-wrap gap-1.5 items-center">
                {logicAnalyzer.channels.map((ch) => {
                  const isPicked = activeProbePicker?.channelId === ch.id;
                  return (
                    <div
                      key={ch.id}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-medium transition ${
                        ch.enabled
                          ? isDark
                            ? 'bg-slate-950/70 border-slate-800'
                            : 'bg-slate-100 border-slate-300'
                          : 'opacity-40 bg-transparent border-dashed'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={ch.enabled}
                        onChange={(e) => setLogicChannelConfig(ch.id, { enabled: e.target.checked })}
                        className="rounded"
                        style={{ accentColor: ch.color }}
                      />
                      <span className="font-bold font-mono" style={{ color: ch.color }}>
                        {ch.id}
                      </span>

                      {ch.enabled && (
                        <>
                          <button
                            onClick={() =>
                              setActiveProbePicker(
                                isPicked
                                  ? null
                                  : {
                                      instrument: 'logicAnalyzer',
                                      channelId: ch.id,
                                      color: ch.color,
                                      title: `Logic Analyzer ${ch.id} (${ch.name})`,
                                    }
                              )
                            }
                            className={`px-1 py-0.5 rounded text-[9px] flex items-center gap-0.5 font-bold transition ${
                              isPicked
                                ? 'bg-white text-slate-950 animate-pulse'
                                : 'hover:bg-slate-800 text-slate-400'
                            }`}
                            title="Click to pick target on canvas"
                          >
                            <Target className="w-2.5 h-2.5" />
                            {ch.target ? getProbeTargetDisplay(ch.target) : 'Clip'}
                          </button>

                          {ch.target && (
                            <button
                              onClick={() => detachProbe('logicAnalyzer', ch.id)}
                              className="hover:text-red-400 text-slate-500"
                              title="Detach probe"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Zoom Controls & Cursor Measurement Bar */}
              <div
                className={`p-2 rounded-xl border flex items-center justify-between text-xs shrink-0 ${
                  isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                {/* Horizontal Time Zoom Controls */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Zoom:</span>
                  <button
                    onClick={handleZoomIn}
                    className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
                    title="Zoom In Time Scale"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-[10px] font-bold text-purple-400 px-1">
                    {zoomFactor.toFixed(1)}x
                  </span>
                  <button
                    onClick={handleZoomOut}
                    className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
                    title="Zoom Out Time Scale"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleZoomFit}
                    className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px] font-bold hover:bg-slate-700"
                  >
                    Fit
                  </button>

                  <div className="h-3 w-px bg-slate-700 mx-1" />

                  {/* Division Scale */}
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Scale:</span>
                  <button
                    onClick={() => setLogicTimeScale(Math.max(5, logicAnalyzer.timeScaleMsPerDiv - 5))}
                    className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px] font-bold hover:bg-slate-700"
                  >
                    -
                  </button>
                  <span className="font-mono text-[10px] font-bold text-purple-400">
                    {logicAnalyzer.timeScaleMsPerDiv} ms/div
                  </span>
                  <button
                    onClick={() => setLogicTimeScale(Math.min(200, logicAnalyzer.timeScaleMsPerDiv + 5))}
                    className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px] font-bold hover:bg-slate-700"
                  >
                    +
                  </button>
                </div>

                {/* Measurement Cursors Readout */}
                <div className="flex items-center gap-3 font-mono text-[10px]">
                  {deltaT_ms !== null ? (
                    <>
                      <span className="text-cyan-400 font-bold">
                        Δt: {deltaT_ms.toFixed(2)} ms
                      </span>
                      <span className="text-amber-400 font-bold">
                        f: {freqHz && freqHz >= 1000 ? `${(freqHz / 1000).toFixed(2)} kHz` : `${freqHz?.toFixed(1) || 0} Hz`}
                      </span>
                      <button
                        onClick={() => setLogicCursors(null, null)}
                        className="text-slate-500 hover:text-slate-300 text-[9px] underline"
                      >
                        Clear Cursors
                      </button>
                    </>
                  ) : (
                    <span className="text-slate-500 text-[10px] italic">
                      Click graph to set T1 / T2 cursors
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: BINARY / HEX STATE TABLE & BUS DECODER VIEW        */}
          {/* ========================================================= */}
          {viewMode === 'binary' && (
            <div className={`space-y-2.5 ${isFullscreen ? 'flex-1 flex flex-col' : ''}`}>
              {/* Table Toolbar */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-slate-300">
                    <input
                      type="checkbox"
                      checked={tableFilterTransitionsOnly}
                      onChange={(e) => setTableFilterTransitionsOnly(e.target.checked)}
                      className="rounded"
                    />
                    <span>Transitions Only</span>
                  </label>
                  <span className="text-slate-500 text-[10px]">
                    ({tableRows.length} events logged)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCsv}
                    className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] flex items-center gap-1 transition"
                  >
                    <Download className="w-3 h-3" />
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div
                className={`rounded-xl border border-slate-800 bg-[#080b11] overflow-auto shadow-inner ${
                  isFullscreen ? 'flex-1 min-h-[400px]' : 'max-h-72'
                }`}
              >
                <table className="w-full text-left font-mono text-[10px] border-collapse">
                  <thead className="bg-[#0f172a] text-slate-300 sticky top-0 z-10 border-b border-slate-800 shadow-sm">
                    <tr>
                      <th className="p-2 border-r border-slate-800 w-20">Time</th>
                      {activeChannels.map((ch) => (
                        <th
                          key={ch.id}
                          className="p-2 border-r border-slate-800 text-center w-14"
                          style={{ color: ch.color }}
                        >
                          {ch.id}
                        </th>
                      ))}
                      <th className="p-2 border-r border-slate-800 text-center text-cyan-400">Bus (Binary)</th>
                      <th className="p-2 border-r border-slate-800 text-center text-amber-400 w-24">Bus (Hex)</th>
                      <th className="p-2 text-center text-emerald-400 w-20">Decimal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {tableRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={activeChannels.length + 4}
                          className="p-6 text-center text-slate-500 italic"
                        >
                          No digital state transitions captured yet. Start simulation or pulse inputs.
                        </td>
                      </tr>
                    ) : (
                      tableRows.map((row, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="p-2 text-slate-400 border-r border-slate-800/60">
                            {row.timeMs} ms
                          </td>
                          {activeChannels.map((ch) => {
                            const val = row.bits[ch.id] ?? 'Z';
                            return (
                              <td
                                key={ch.id}
                                className="p-2 text-center border-r border-slate-800/60"
                              >
                                <span
                                  className={`px-1.5 py-0.5 rounded font-bold ${
                                    val === 1
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : val === 0
                                      ? 'bg-slate-800 text-slate-400'
                                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  }`}
                                >
                                  {val}
                                </span>
                              </td>
                            );
                          })}
                          <td className="p-2 text-center font-bold text-cyan-300 border-r border-slate-800/60">
                            {row.binaryStr}
                          </td>
                          <td className="p-2 text-center font-bold text-amber-300 border-r border-slate-800/60">
                            {row.hexStr}
                          </td>
                          <td className="p-2 text-center font-bold text-emerald-300">
                            {row.decStr}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: K-MAP & TRUTH TABLE BOOLEAN SOLVER VIEW            */}
          {/* ========================================================= */}
          {viewMode === 'kmap' && (
            <div className={`space-y-3 ${isFullscreen ? 'flex-1 flex flex-col' : ''}`}>
              {/* Channel Variable Mapping Toolbar */}
              <div
                className={`p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
                  isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                {/* Inputs Count Selection */}
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[11px] text-slate-300">Inputs:</span>
                  <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-slate-700">
                    {([2, 3, 4] as const).map((n) => (
                      <button
                        key={n}
                        onClick={() => setKmapNumInputs(n)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                          kmapNumInputs === n
                            ? 'bg-purple-600 text-white shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {n} Vars ({1 << n})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input Probe Selectors */}
                <div className="flex items-center gap-2 flex-wrap">
                  {varNames.map((v, i) => (
                    <div key={v} className="flex items-center gap-1">
                      <span className="font-bold text-purple-400 font-mono text-[11px]">{v}:</span>
                      <select
                        value={kmapInputChannels[i]}
                        onChange={(e) => {
                          const next = [...kmapInputChannels];
                          next[i] = e.target.value;
                          setKmapInputChannels(next);
                        }}
                        className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-200"
                      >
                        {logicAnalyzer.channels.map((ch) => (
                          <option key={ch.id} value={ch.id}>
                            {ch.id} ({ch.name})
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}

                  {/* Output Probe Selector */}
                  <div className="flex items-center gap-1 pl-2 border-l border-slate-700">
                    <span className="font-bold text-emerald-400 font-mono text-[11px]">Output Y:</span>
                    <select
                      value={kmapOutputChannel}
                      onChange={(e) => setKmapOutputChannel(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-emerald-300"
                    >
                      {logicAnalyzer.channels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.id} ({ch.name})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Main Content Area: Truth Table (Left) + K-Map Grid & Equation (Right) */}
              <div className={`grid grid-cols-1 md:grid-cols-12 gap-3 ${isFullscreen ? 'flex-1' : ''}`}>
                {/* Left: Interactive Observed Truth Table */}
                <div
                  className={`md:col-span-5 rounded-xl border border-slate-800 bg-[#080b11] p-2.5 flex flex-col ${
                    isFullscreen ? 'h-full' : 'max-h-72'
                  }`}
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-xs">
                    <span className="font-bold text-[11px] text-slate-300 flex items-center gap-1">
                      <TableIcon className="w-3.5 h-3.5 text-purple-400" />
                      Observed Truth Table
                    </span>
                    <span className="text-[9px] text-purple-400 font-medium">Auto-detected from circuit</span>
                  </div>

                  <div className="overflow-y-auto flex-1 mt-1">
                    <table className="w-full font-mono text-[10px] border-collapse">
                      <thead className="text-slate-400 bg-slate-900/60 sticky top-0">
                        <tr>
                          <th className="p-1 text-center w-8">#</th>
                          {varNames.map((v) => (
                            <th key={v} className="p-1 text-center text-purple-400">
                              {v}
                            </th>
                          ))}
                          <th className="p-1 text-center text-emerald-400 font-bold">Y</th>
                          <th className="p-1 text-right text-slate-500 text-[8.5px]">Hits</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {truthTableData.map((row) => (
                          <tr key={row.index} className="hover:bg-slate-800/30">
                            <td className="p-1 text-center text-slate-500 text-[9px]">{row.index}</td>
                            {row.inputs.map((inBit, i) => (
                              <td key={i} className="p-1 text-center text-slate-300">
                                {inBit}
                              </td>
                            ))}
                            <td className="p-1 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded font-black select-none ${
                                  row.output === 1
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                    : row.output === 0
                                    ? 'bg-slate-800 text-slate-400 border border-slate-700/50'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}
                              >
                                {row.output}
                              </span>
                            </td>
                            <td className="p-1 text-right text-slate-500 text-[8.5px]">
                              {row.observedCount ? `×${row.observedCount}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right: K-Map Grid & Minimal SOP Boolean Equation */}
                <div className="md:col-span-7 flex flex-col gap-3">
                  {/* Minimal Sum-of-Products (SOP) Output Card */}
                  <div className="p-3 rounded-xl border border-purple-500/40 bg-gradient-to-r from-purple-950/30 via-slate-900 to-indigo-950/30 shadow-lg">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-[10px] uppercase font-bold text-purple-400 flex items-center gap-1 tracking-wider">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        Minimal Sum-of-Products (SOP) Equation
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                        {booleanSolution.logicGates}
                      </span>
                    </div>

                    <div className="font-mono text-base font-black text-cyan-300 py-1">
                      {booleanSolution.sop}
                    </div>

                    {/* Prime Implicants Legend */}
                    {booleanSolution.primeImplicants.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-purple-500/20">
                        {booleanSolution.primeImplicants.map((pi, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold flex items-center gap-1"
                            style={{
                              backgroundColor: `${pi.color}20`,
                              borderColor: `${pi.color}60`,
                              borderWidth: 1,
                              color: pi.color,
                            }}
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: pi.color }}
                            />
                            Group: {pi.term} [m({pi.minterms.join(', ')})]
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Gray-Code Karnaugh Map Grid */}
                  <div className="p-3 rounded-xl border border-slate-800 bg-[#080b11] flex-1 flex flex-col justify-center items-center">
                    <div className="text-center font-bold text-xs text-slate-300 pb-2 flex items-center gap-1">
                      <span>Karnaugh Map</span>
                      <span className="text-purple-400 font-mono">
                        ({booleanSolution.kmapGrid.rowVars.join('')} \ {booleanSolution.kmapGrid.colVars.join('')})
                      </span>
                    </div>

                    <div className="inline-block border border-slate-800 rounded-lg overflow-hidden bg-slate-950 p-2 shadow-inner">
                      <table className="border-collapse font-mono text-xs">
                        <thead>
                          <tr>
                            <th className="p-1 text-slate-500 text-[10px] border-b border-r border-slate-800">
                              {booleanSolution.kmapGrid.rowVars.join('')}\{booleanSolution.kmapGrid.colVars.join('')}
                            </th>
                            {booleanSolution.kmapGrid.colHeaders.map((colH) => (
                              <th
                                key={colH}
                                className="p-2 text-center text-purple-400 font-bold border-b border-slate-800 w-12"
                              >
                                {colH}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {booleanSolution.kmapGrid.cells.map((row, rIdx) => (
                            <tr key={rIdx}>
                              <th className="p-2 text-center text-purple-400 font-bold border-r border-slate-800">
                                {booleanSolution.kmapGrid.rowHeaders[rIdx]}
                              </th>
                              {row.map((cell) => {
                                const hasColor = cell.implicantColors.length > 0;
                                const primaryColor = cell.implicantColors[0];

                                return (
                                  <td
                                    key={cell.col}
                                    className="p-1 border border-slate-800/80 text-center select-none"
                                  >
                                    <div
                                      className="relative w-10 h-10 flex flex-col items-center justify-center rounded-md font-bold text-sm transition"
                                      style={{
                                        backgroundColor: hasColor
                                          ? `${primaryColor}25`
                                          : cell.value === 1
                                          ? '#10b98115'
                                          : '#0f172a',
                                        borderColor: hasColor ? primaryColor : '#334155',
                                        borderWidth: hasColor ? 2 : 1,
                                        color: cell.value === 1 ? '#4ade80' : cell.value === 0 ? '#94a3b8' : '#fbbf24',
                                      }}
                                    >
                                      <span className="text-[7.5px] text-slate-500 absolute top-0.5 right-1">
                                        {cell.minterm}
                                      </span>
                                      <span>{cell.value}</span>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
    </div>
  );
};
