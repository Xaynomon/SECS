import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Trash2,
  Send,
  Cpu,
  Terminal,
  Maximize2,
  Minimize2,
  Check,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { useCircuitStore } from '../../store/useCircuitStore';
import { MCU_CODE_TEMPLATES } from '../../simulation/mcu/templates';
import { ASM_CODE_TEMPLATES } from '../../simulation/mcu/asmRuntime';
import { McuManager } from '../../simulation/mcu/McuManager';

export const McuCodeEditorModal: React.FC = () => {
  const {
    isCodeEditorOpen,
    activeMcuId,
    components,
    closeCodeEditor,
    updateMcuCode,
    sendSerialInput,
    clearSerialLogs,
    runSimulationCycle,
  } = useCircuitStore();

  // Find all MCU & Assembly CPU components on the canvas
  const mcuComponents = components.filter(
    (c) =>
      c.type === 'arduino-uno' ||
      c.type === 'esp32' ||
      c.type === 'pico' ||
      c.type === 'builtin_cpu_8bit' ||
      c.type === 'cpu-8bit'
  );

  // Selected MCU component
  const currentMcu = mcuComponents.find((c) => c.id === activeMcuId) || mcuComponents[0];
  const isAsmCpu =
    currentMcu?.type === 'builtin_cpu_8bit' || currentMcu?.type === 'cpu-8bit';
  const activeTemplates = isAsmCpu ? ASM_CODE_TEMPLATES : MCU_CODE_TEMPLATES;

  const [code, setCode] = useState<string>('');
  const [inputText, setInputText] = useState<string>('');
  const [viewMode, setViewMode] = useState<'split' | 'code' | 'serial'>('split');
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Draggable HUD window position state (compact 560x420 window)
  const [position, setPosition] = useState({
    x: typeof window !== 'undefined' ? Math.max(10, window.innerWidth - 590) : 300,
    y: 72,
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  const serialBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Drag handlers for window header
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return;
    if ((e.target as HTMLElement).closest('button, select, input, textarea, a')) return;
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
      if (!isDragging || isMaximized) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const newX = Math.max(10, Math.min(window.innerWidth - 300, dragStartRef.current.posX + dx));
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
      const finalX = Math.max(10, Math.min(window.innerWidth - 300, dragStartRef.current.posX + dx));
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
  }, [isDragging, isMaximized]);

  // Sync code when currentMcu changes or modal opens
  useEffect(() => {
    if (currentMcu) {
      const defaultCode = isAsmCpu ? ASM_CODE_TEMPLATES[0].code : MCU_CODE_TEMPLATES[0].code;
      const existingCode = currentMcu.properties?.code || defaultCode;
      setCode(existingCode);
      setUploadStatus('idle');
      setStatusMessage('');
    }
  }, [currentMcu?.id, isCodeEditorOpen, isAsmCpu]);

  // Real-time MCU state and logs
  const mcuManager = McuManager.getInstance();
  const runtime =
    currentMcu && !isAsmCpu ? mcuManager.getRuntime(currentMcu.id) : undefined;
  const asmRuntime =
    currentMcu && isAsmCpu ? mcuManager.getAsmRuntime(currentMcu.id) : undefined;
  const instanceData = isAsmCpu
    ? asmRuntime?.getInstanceData()
    : runtime?.getInstanceData();
  const serialLogs = instanceData?.serialLogs || [];
  const asmRegs =
    isAsmCpu && asmRuntime
      ? asmRuntime.getRegisters()
      : currentMcu?.properties?.asmRegisters || {
          acc: 0,
          regB: 0,
          pc: 0,
          zeroFlag: 0,
          carryFlag: 0,
          currentMnemonic: 'NOP',
        };

  // Auto-scroll serial monitor
  useEffect(() => {
    if (autoScroll && serialBottomRef.current) {
      serialBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [serialLogs.length, autoScroll]);

  if (!isCodeEditorOpen || !currentMcu) {
    return null;
  }

  const handleTemplateSelect = (templateId: string) => {
    const tmpl = activeTemplates.find((t) => t.id === templateId);
    if (tmpl) {
      setCode(tmpl.code);
      if (currentMcu) {
        updateMcuCode(currentMcu.id, tmpl.code);
      }
      setUploadStatus('idle');
      setStatusMessage(`Template loaded: ${tmpl.name}`);
    }
  };

  const handleUploadAndRun = () => {
    if (!currentMcu) return;
    const ok = updateMcuCode(currentMcu.id, code);
    if (ok) {
      setUploadStatus('success');
      setStatusMessage(
        isAsmCpu
          ? 'Assembly program assembled & loaded into SECS-808 ROM!'
          : 'Sketch uploaded successfully. Program running!'
      );
      setTimeout(() => setUploadStatus('idle'), 3000);
    } else {
      setUploadStatus('error');
      setStatusMessage(instanceData?.lastError || 'Compilation failed');
    }
  };

  const handleSingleStepAsm = () => {
    if (!currentMcu || !isAsmCpu) return;
    const rt = mcuManager.getOrCreateAsmRuntime(currentMcu);
    rt.executeOneInstruction(0);
    runSimulationCycle(20);
  };

  const handleSendSerial = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !currentMcu) return;
    sendSerialInput(currentMcu.id, inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab key inserts 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;

      target.value = val.substring(0, start) + '  ' + val.substring(end);
      target.selectionStart = target.selectionEnd = start + 2;
      setCode(target.value);
    }
  };

  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div
      ref={windowRef}
      style={
        isMaximized
          ? { left: '2.5vw', top: '4vh', width: '95vw', height: '90vh' }
          : { left: `${position.x}px`, top: `${position.y}px`, width: '560px', height: '420px' }
      }
      className="fixed z-50 flex flex-col bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden select-none"
    >
      {/* Top Header */}
      <div
        onMouseDown={handleMouseDown}
        className={`flex items-center justify-between px-3 py-2 bg-slate-950 border-b border-slate-800 text-slate-200 select-none shrink-0 ${
          isMaximized ? '' : 'cursor-move'
        }`}
      >
        <div className="flex items-center gap-2 shrink min-w-0">
          <Cpu className={`w-4 h-4 shrink-0 ${isAsmCpu ? 'text-indigo-400' : 'text-teal-400'}`} />
          <span className="font-semibold text-xs tracking-wide text-white truncate">
            {isAsmCpu ? 'SECS-808 Assembly' : 'MCU Studio'}
          </span>

          {/* MCU Target Selector */}
          {mcuComponents.length > 1 ? (
            <select
              value={currentMcu.id}
              onChange={(e) => useCircuitStore.getState().openCodeEditor(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-teal-300 text-[11px] rounded px-1.5 py-0.5 font-mono outline-none focus:border-teal-500 shrink-0"
            >
              {mcuComponents.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} (
                  {m.type === 'builtin_cpu_8bit' || m.type === 'cpu-8bit'
                    ? 'CPU-8'
                    : m.type === 'esp32'
                    ? 'ESP32'
                    : m.type === 'pico'
                    ? 'Pico'
                    : 'Uno'}
                  )
                </option>
              ))}
            </select>
          ) : (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border shrink-0 ${
                isAsmCpu
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-800/60'
                  : 'bg-teal-950 text-teal-300 border-teal-800/60'
              }`}
            >
              {currentMcu.label}
            </span>
          )}
        </div>

        {/* Center / Right Actions: Template, Step, Upload, View Mode Cycle, Maximize, Close */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {/* Examples Template Selector */}
          <select
            onChange={(e) => handleTemplateSelect(e.target.value)}
            defaultValue=""
            className="bg-slate-800 border border-slate-700 text-slate-200 text-[10.5px] rounded px-1.5 py-0.5 outline-none focus:border-teal-500 hover:bg-slate-750 cursor-pointer max-w-[100px] truncate shrink-0"
            title="Load Example Code Template"
          >
            <option value="" disabled>
              Templates...
            </option>
            {activeTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {isAsmCpu && (
            <button
              onClick={handleSingleStepAsm}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-mono font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors shrink-0"
              title="Execute 1 Assembly Instruction Step"
            >
              <span>Step</span>
            </button>
          )}

          {/* Upload & Run Button */}
          <button
            onClick={handleUploadAndRun}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium transition-colors shadow-sm shrink-0 ${
              uploadStatus === 'success'
                ? 'bg-emerald-600 text-white'
                : uploadStatus === 'error'
                ? 'bg-rose-600 text-white'
                : isAsmCpu
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-teal-600 hover:bg-teal-500 text-white'
            }`}
            title={isAsmCpu ? 'Assemble and load into SECS-808 CPU' : 'Compile sketch and load into MCU'}
          >
            {uploadStatus === 'success' ? (
              <>
                <Check className="w-3 h-3" />
                <span>{isAsmCpu ? 'Assembled' : 'Uploaded'}</span>
              </>
            ) : uploadStatus === 'error' ? (
              <>
                <AlertCircle className="w-3 h-3" />
                <span>Failed</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Run</span>
              </>
            )}
          </button>

          {/* Single Cycling View Mode Button */}
          <button
            onClick={() => {
              if (viewMode === 'code') setViewMode('split');
              else if (viewMode === 'split') setViewMode('serial');
              else setViewMode('code');
            }}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-750 text-teal-300 border border-slate-700 text-[10.5px] font-semibold shrink-0 transition-colors flex items-center gap-1"
            title="Cycle View: Code -> Split -> Serial"
          >
            <span className="text-slate-400 text-[9.5px]">View:</span>
            <span className="capitalize text-white">
              {viewMode === 'code' ? 'Code' : viewMode === 'split' ? 'Split' : (isAsmCpu ? 'Trace' : 'Serial')}
            </span>
          </button>

          {/* Maximize / Enlarge Toggle */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors shrink-0"
            title={isMaximized ? 'Restore Compact Window' : 'Enlarge / Fullscreen (⛶)'}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Close Button */}
          <button
            onClick={closeCodeEditor}
            className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors shrink-0"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

        {/* LIVE CPU REGISTER BAR (Only for SECS-808 8-Bit Assembly Microprocessor) */}
        {isAsmCpu && (
          <div className="px-4 py-2 bg-indigo-950/50 border-b border-indigo-800/60 flex flex-wrap items-center justify-between gap-3 font-mono text-xs select-none">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold">ACC:</span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-amber-500/40 text-amber-300 font-bold">
                  0x{((asmRegs.acc ?? 0) & 0xff).toString(16).toUpperCase().padStart(2, '0')}
                </span>
                <span className="text-slate-400 text-[11px]">
                  ({((asmRegs.acc ?? 0) & 0xff).toString(2).padStart(8, '0')}b / {(asmRegs.acc ?? 0) & 0xff})
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold">REG B:</span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-sky-500/40 text-sky-300 font-bold">
                  0x{((asmRegs.regB ?? 0) & 0xff).toString(16).toUpperCase().padStart(2, '0')}
                </span>
                <span className="text-slate-400 text-[11px]">
                  ({(asmRegs.regB ?? 0) & 0xff})
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold">PC:</span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-emerald-500/40 text-emerald-300 font-bold">
                  Line {asmRegs.pc ?? 0}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold">Flags:</span>
                <span
                  className={`px-1.5 py-0.5 rounded border text-[11px] font-bold ${
                    asmRegs.zeroFlag
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-slate-500'
                  }`}
                >
                  Z = {asmRegs.zeroFlag ? 1 : 0}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded border text-[11px] font-bold ${
                    asmRegs.carryFlag
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-900 border-slate-700 text-slate-500'
                  }`}
                >
                  C = {asmRegs.carryFlag ? 1 : 0}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px]">Current Instruction:</span>
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 font-bold">
                {asmRegs.currentMnemonic || 'NOP'}
              </span>
            </div>
          </div>
        )}

        {/* Status notification banner if any */}
        {statusMessage && (
          <div
            className={`px-4 py-1 text-xs flex items-center justify-between font-mono ${
              uploadStatus === 'error'
                ? 'bg-rose-950/80 border-b border-rose-800 text-rose-300'
                : 'bg-teal-950/80 border-b border-teal-800 text-teal-300'
            }`}
          >
            <span>{statusMessage}</span>
            <button onClick={() => setStatusMessage('')} className="text-slate-400 hover:text-white">
              ×
            </button>
          </div>
        )}

        {/* Central Workspace (Code Editor & Serial Monitor) */}
        <div className="flex-1 flex overflow-hidden">
          {/* 1. Code Editor Pane */}
          {(viewMode === 'code' || viewMode === 'split') && (
            <div
              className={`flex flex-col h-full overflow-hidden bg-slate-900 border-r border-slate-800 ${
                viewMode === 'split' ? 'w-1/2' : 'w-full'
              }`}
            >
              {/* Editor Bar */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950/60 border-b border-slate-800 text-xs text-slate-400 select-none">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono font-semibold ${
                      isAsmCpu ? 'text-indigo-400' : 'text-teal-400'
                    }`}
                  >
                    {isAsmCpu ? 'program.asm' : 'sketch.ino'}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>{isAsmCpu ? 'SECS-808 8-Bit Assembly' : 'C++ / Arduino'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>Lines: {lineCount}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(code)}
                    className="flex items-center gap-1 hover:text-slate-200 transition-colors"
                    title="Copy code"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </button>
                </div>
              </div>

              {/* Textarea with Line Numbers */}
              <div className="flex-1 flex overflow-hidden relative font-mono text-xs sm:text-sm">
                {/* Line number gutter */}
                <div className="w-12 py-3 bg-slate-950/80 select-none text-right pr-3 text-slate-600 font-mono border-r border-slate-800/80 overflow-hidden">
                  {lineNumbers.map((num) => {
                    const isPcLine = isAsmCpu && asmRegs.pc === num;
                    return (
                      <div
                        key={num}
                        className={`leading-6 text-[11px] ${
                          isPcLine
                            ? 'text-emerald-400 font-bold bg-emerald-500/15 -mr-3 pr-3'
                            : ''
                        }`}
                      >
                        {isPcLine ? `▶${num}` : num}
                      </div>
                    );
                  })}
                </div>

                {/* Editor Textarea */}
                <textarea
                  ref={textareaRef}
                  value={code}
                  onChange={(e) => {
                    const newCode = e.target.value;
                    setCode(newCode);
                    if (currentMcu) {
                      updateMcuCode(currentMcu.id, newCode);
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  spellCheck={false}
                  placeholder="// Enter Arduino C++ sketch here..."
                  className="flex-1 h-full p-3 bg-slate-900 text-slate-100 font-mono leading-6 resize-none outline-none overflow-auto whitespace-pre tab-[2] selection:bg-teal-800 selection:text-white"
                />
              </div>
            </div>
          )}

          {/* 2. Serial Monitor Pane */}
          {(viewMode === 'serial' || viewMode === 'split') && (
            <div
              className={`flex flex-col h-full overflow-hidden bg-slate-950 ${
                viewMode === 'split' ? 'w-1/2' : 'w-full'
              }`}
            >
              {/* Serial Toolbar */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400 select-none">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-slate-200">Serial Monitor</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-emerald-300 font-mono border border-slate-700">
                    9600 baud
                  </span>
                  {/* On-board TX / RX indicators */}
                  <span
                    className={`inline-block w-2 h-2 rounded-full transition-colors ${
                      instanceData?.ledTx ? 'bg-amber-400 ring-2 ring-amber-400/40' : 'bg-slate-700'
                    }`}
                    title="TX Status"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">TX</span>
                  <span
                    className={`inline-block w-2 h-2 rounded-full transition-colors ${
                      instanceData?.ledRx ? 'bg-amber-400 ring-2 ring-amber-400/40' : 'bg-slate-700'
                    }`}
                    title="RX Status"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">RX</span>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200">
                    <input
                      type="checkbox"
                      checked={autoScroll}
                      onChange={(e) => setAutoScroll(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-teal-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                    />
                    <span>Autoscroll</span>
                  </label>

                  <button
                    onClick={() => currentMcu && clearSerialLogs(currentMcu.id)}
                    className="flex items-center gap-1 hover:text-rose-400 transition-colors"
                    title="Clear console output"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* Terminal Logs Window */}
              <div className="flex-1 p-3 overflow-y-auto font-mono text-xs space-y-1 bg-black/40">
                {serialLogs.length === 0 ? (
                  <div className="text-slate-600 italic select-none py-4 text-center">
                    Serial Monitor connected. Output will appear here when sketch runs...
                  </div>
                ) : (
                  serialLogs.map((log) => {
                    let color = 'text-slate-300';
                    let prefix = '';
                    if (log.type === 'input') {
                      color = 'text-cyan-400 font-semibold';
                      prefix = '>> ';
                    } else if (log.type === 'system') {
                      color = 'text-amber-400/90';
                      prefix = '[SYS] ';
                    } else if (log.type === 'error') {
                      color = 'text-rose-400 font-bold';
                      prefix = '[ERR] ';
                    } else {
                      color = 'text-emerald-300';
                    }

                    return (
                      <div key={log.id} className={`leading-5 whitespace-pre-wrap break-all ${color}`}>
                        <span className="text-slate-600 select-none mr-2">
                          [{((log.timestampMs % 100000) / 1000).toFixed(2)}s]
                        </span>
                        <span>{prefix}{log.text}</span>
                      </div>
                    );
                  })
                )}
                <div ref={serialBottomRef} />
              </div>

              {/* Bottom Interactive Command Bar */}
              <form
                onSubmit={handleSendSerial}
                className="flex items-center gap-2 p-2 bg-slate-900 border-t border-slate-800"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Send text or command to MCU Serial (e.g. 'help', 'ON', 'OFF')..."
                  className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white placeholder-slate-500 font-mono outline-none focus:border-teal-500"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:hover:bg-teal-600 text-white rounded text-xs font-medium transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
  );
};
