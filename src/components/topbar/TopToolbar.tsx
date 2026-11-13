import React, { useRef, useState } from 'react';
import {
  Zap,
  Play,
  Pause,
  Square,
  StepForward,
  Undo2,
  Redo2,
  RotateCw,
  FlipHorizontal,
  Trash2,
  FolderOpen,
  Save,
  FilePlus,
  Download,
  Sun,
  Moon,
  Gauge,
  Activity,
  Binary,
  Lightbulb,
  ChevronDown,
  Type,
  Shapes,
  Circle,
  Triangle,
  Diamond,
  Volume2,
  VolumeX,
  Check,
  Loader2,
  Cloud,
} from 'lucide-react';
import { useCircuitStore } from '../../store/useCircuitStore';
import { WIRE_COLORS } from '../../constants/wireColors';
import { exportBomCsv, exportCircuitPng, exportCircuitSvg } from '../../utils/exportUtils';
import { saveProjectToFile, validateCircuitFile } from '../../utils/fileIo';
import { SimulationMode } from '../../types/circuit';

export const TopToolbar: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showWireColorMenu, setShowWireColorMenu] = useState(false);
  const [showShapeMenu, setShowShapeMenu] = useState(false);

  const {
    openDashboard,
    currentProjectName,
    setCurrentProjectName,
    autoSaveStatus,
    saveCurrentProjectToDb,
    addTextBox,
    addShape,
    theme,
    toggleTheme,
    isSoundEnabled,
    toggleSound,
    canUndo,
    canRedo,
    undo,
    redo,
    selectedComponentId,
    selectedWireId,
    rotateComponent,
    flipComponentHorizontal,
    deleteSelected,
    simulationMode,
    setSimulationMode,
    simulationStatus,
    setSimulationStatus,
    simulationSpeed,
    setSimulationSpeed,
    stepSimulation,
    resetSimulation,
    activeWireColor,
    setActiveWireColor,
    showMultimeter,
    showOscilloscope,
    showLogicAnalyzer,
    showSmartTips,
    toggleInstrument,
    newCircuit,
    loadCircuit,
    exportCircuitJson,
    components,
    wires,
    openCodeEditor,
    isCodeEditorOpen,
  } = useCircuitStore();

  const isDark = theme === 'dark';

  const handleReturnToDashboard = async () => {
    if (components.length > 0 || wires.length > 0) {
      await saveCurrentProjectToDb();
    }
    openDashboard();
  };

  const handleSave = async () => {
    const data = exportCircuitJson();
    await saveProjectToFile(data);
    await saveCurrentProjectToDb();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const result = validateCircuitFile(json);
        if (result.isValid && result.data) {
          loadCircuit(result.data);
        } else {
          alert(`Corrupted or invalid .secs project file:\n${result.error || 'Unknown format error'}`);
        }
      } catch (err: any) {
        alert(`Failed to parse file as JSON: ${err?.message || err}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const iconBtnClass = `p-1.5 rounded transition ${
    isDark
      ? 'hover:bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent'
      : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent'
  }`;

  return (
    <header
      className={`h-14 border-b flex items-center justify-between px-3 shrink-0 select-none z-30 shadow-sm transition-colors ${
        isDark
          ? 'border-slate-800 bg-slate-900 text-slate-100'
          : 'border-slate-200 bg-white text-slate-800'
      }`}
    >
      {/* SECTION 1: BRANDING & FILE MENU */}
      <div className="flex items-center gap-2">
        {/* Clickable SECS Logo & App Title -> Return to Dashboard */}
        <div
          onClick={handleReturnToDashboard}
          className={`group flex items-center gap-2 mr-1 pr-3 border-r cursor-pointer transition select-none ${
            isDark ? 'border-slate-800 hover:opacity-90' : 'border-slate-200 hover:opacity-90'
          }`}
          title="Return to Dashboard (Auto-saves draft)"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
            <Zap className="w-5 h-5 fill-slate-950 stroke-none" />
          </div>
          <div>
            <div
              className={`font-extrabold text-sm tracking-wider flex items-center gap-1.5 transition ${
                isDark ? 'text-white group-hover:text-sky-300' : 'text-slate-900 group-hover:text-sky-600'
              }`}
            >
              SECS
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-500 border border-sky-400/30">
                Phase 2.6
              </span>
            </div>
            <div
              className={`text-[9px] leading-none transition ${
                isDark ? 'text-slate-400 group-hover:text-slate-300' : 'text-slate-500 group-hover:text-slate-700'
              }`}
            >
              &larr; Dashboard
            </div>
          </div>
        </div>

        {/* Project Title Input & Auto-Save Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 mr-1">
          <input
            type="text"
            value={currentProjectName}
            onChange={(e) => setCurrentProjectName(e.target.value)}
            onBlur={() => saveCurrentProjectToDb()}
            className={`px-2 py-1 text-xs font-semibold rounded-lg border border-transparent hover:border-slate-700 focus:border-sky-500 focus:outline-none transition max-w-[140px] truncate ${
              isDark ? 'bg-transparent text-slate-200' : 'bg-transparent text-slate-800'
            }`}
            title="Click to rename project (auto-saved)"
          />

          {/* Subtle Auto-Save Status Badge */}
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border transition-all ${
              autoSaveStatus === 'saving'
                ? 'border-sky-500/30 bg-sky-500/10 text-sky-400'
                : autoSaveStatus === 'saved'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : isDark
                ? 'border-slate-800 text-slate-500'
                : 'border-slate-200 text-slate-400'
            }`}
            title="Project changes are saved automatically in real-time"
          >
            {autoSaveStatus === 'saving' && (
              <>
                <Loader2 className="w-2.5 h-2.5 animate-spin text-sky-400" />
                <span>Saving...</span>
              </>
            )}
            {autoSaveStatus === 'saved' && (
              <>
                <Check className="w-2.5 h-2.5 text-emerald-400" />
                <span>Saved</span>
              </>
            )}
            {autoSaveStatus === 'idle' && (
              <>
                <Cloud className="w-2.5 h-2.5 opacity-60" />
                <span>Auto-save</span>
              </>
            )}
          </div>
        </div>

        {/* Consolidated File Dropdown Menu */}
        <div className="relative">
          <button
            onClick={() => setShowFileMenu(!showFileMenu)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
              showFileMenu
                ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                : isDark
                ? 'text-slate-200 hover:text-white hover:bg-slate-800 border-slate-700/80 bg-slate-800/40'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 border-slate-300 bg-white shadow-sm'
            }`}
          >
            <span>File</span>
            <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform ${showFileMenu ? 'rotate-180' : ''}`} />
          </button>

          {showFileMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowFileMenu(false)}
              />
              <div
                className={`absolute left-0 mt-1.5 w-56 border rounded-xl shadow-2xl py-1.5 z-50 text-xs backdrop-blur-md transition-colors ${
                  isDark
                    ? 'bg-slate-900/95 border-slate-700/80 text-slate-200'
                    : 'bg-white/95 border-slate-200 text-slate-800'
                }`}
              >
                <button
                  onClick={() => {
                    setShowFileMenu(false);
                    newCircuit();
                  }}
                  className={`w-full text-left px-3 py-1.5 flex items-center gap-2.5 transition ${
                    isDark ? 'hover:bg-slate-800 hover:text-sky-300' : 'hover:bg-slate-100 hover:text-sky-600'
                  }`}
                >
                  <FilePlus className="w-3.5 h-3.5 text-sky-500" />
                  <span>New Circuit</span>
                </button>

                <button
                  onClick={() => {
                    setShowFileMenu(false);
                    handleSave();
                  }}
                  className={`w-full text-left px-3 py-1.5 flex items-center gap-2.5 transition ${
                    isDark ? 'hover:bg-slate-800 hover:text-emerald-300' : 'hover:bg-slate-100 hover:text-emerald-600'
                  }`}
                >
                  <Save className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Save Project (.secs)</span>
                </button>

                <button
                  onClick={() => {
                    setShowFileMenu(false);
                    fileInputRef.current?.click();
                  }}
                  className={`w-full text-left px-3 py-1.5 flex items-center gap-2.5 transition ${
                    isDark ? 'hover:bg-slate-800 hover:text-amber-300' : 'hover:bg-slate-100 hover:text-amber-600'
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                  <span>Load Project (.secs)</span>
                </button>

                <div
                  className={`h-[1px] my-1 ${
                    isDark ? 'bg-slate-800' : 'bg-slate-200'
                  }`}
                />

                <button
                  onClick={() => {
                    setShowFileMenu(false);
                    exportCircuitPng(components, wires, theme, currentProjectName);
                  }}
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition ${
                    isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Download className="w-3.5 h-3.5 text-purple-400" />
                    <span>Export as PNG</span>
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">.png</span>
                </button>

                <button
                  onClick={() => {
                    setShowFileMenu(false);
                    exportCircuitSvg(components, wires, theme);
                  }}
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition ${
                    isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>Export as SVG</span>
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">.svg</span>
                </button>

                <button
                  onClick={() => {
                    setShowFileMenu(false);
                    exportBomCsv(components);
                  }}
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition ${
                    isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Export BOM (CSV)</span>
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">.csv</span>
                </button>
              </div>
            </>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".secs,.json"
            className="hidden"
          />
        </div>
      </div>

      {/* SECTION 2: EDIT CONTROLS */}
      <div
        className={`flex items-center gap-1 border-x px-3 ${
          isDark ? 'border-slate-800' : 'border-slate-200'
        }`}
      >
        <button
          onClick={undo}
          disabled={!canUndo}
          className={iconBtnClass}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        <button
          onClick={redo}
          disabled={!canRedo}
          className={iconBtnClass}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className={`w-[1px] h-4 mx-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

        <button
          onClick={() => selectedComponentId && rotateComponent(selectedComponentId, 90)}
          disabled={!selectedComponentId}
          className={iconBtnClass}
          title="Rotate 90° (R)"
        >
          <RotateCw className="w-4 h-4" />
        </button>

        <button
          onClick={() => selectedComponentId && flipComponentHorizontal(selectedComponentId)}
          disabled={!selectedComponentId}
          className={iconBtnClass}
          title="Flip Horizontal (F)"
        >
          <FlipHorizontal className="w-4 h-4" />
        </button>

        <button
          onClick={deleteSelected}
          disabled={!selectedComponentId && !selectedWireId}
          className={`p-1.5 rounded transition disabled:opacity-30 disabled:hover:bg-transparent ${
            isDark
              ? 'hover:bg-red-500/20 text-red-400 hover:text-red-300'
              : 'hover:bg-red-50 text-red-600 hover:text-red-700'
          }`}
          title="Delete Selected (Del)"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <div className={`w-[1px] h-4 mx-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

        {/* Text Annotation Tool */}
        <button
          onClick={() => addTextBox()}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition ${
            isDark
              ? 'text-sky-400 hover:text-sky-300 hover:bg-sky-500/10'
              : 'text-sky-600 hover:text-sky-700 hover:bg-sky-50'
          }`}
          title="Add Text Note / Annotation (T)"
        >
          <Type className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Text Note</span>
        </button>

        {/* Add Shape Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowShapeMenu((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
              isDark
                ? 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10'
                : 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50'
            }`}
            title="Add Diagram Shape"
          >
            <Shapes className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Add Shape</span>
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>

          {showShapeMenu && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowShapeMenu(false)}
              />
              <div
                className={`absolute left-0 top-full mt-1.5 w-44 rounded-lg border shadow-xl py-1 z-40 ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-slate-200'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                {[
                  { id: 'rectangle', label: 'Rectangle', Icon: Square },
                  { id: 'rounded', label: 'Rounded Box', Icon: Shapes },
                  { id: 'circle', label: 'Circle / Ellipse', Icon: Circle },
                  { id: 'triangle', label: 'Triangle', Icon: Triangle },
                  { id: 'diamond', label: 'Diamond', Icon: Diamond },
                ].map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => {
                      addShape(id);
                      setShowShapeMenu(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition ${
                      isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* SECTION 3: SIMULATION MODE & PLAYBACK */}
      <div className="flex items-center gap-3">
        {/* Three-Mode Selector: LOGICAL vs ANALOG vs OFF (disables wire flow animation) */}
        <div
          className={`flex items-center p-0.5 rounded-lg border text-[11px] transition-colors ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          {(['LOGICAL', 'ANALOG', 'OFF'] as SimulationMode[]).map((mode) => {
            const isActive = simulationMode === mode;
            const activeStyle =
              mode === 'LOGICAL'
                ? 'bg-blue-600 text-white font-bold shadow'
                : mode === 'ANALOG'
                ? 'bg-amber-600 text-white font-bold shadow'
                : isDark
                ? 'bg-slate-700 text-white font-bold shadow'
                : 'bg-slate-600 text-white font-bold shadow';
            const cycleOrder: SimulationMode[] = ['LOGICAL', 'ANALOG', 'OFF'];
            const nextInCycle = cycleOrder[(cycleOrder.indexOf(mode) + 1) % cycleOrder.length];
            return (
              <button
                key={mode}
                onClick={() => setSimulationMode(isActive ? nextInCycle : mode)}
                className={`px-2.5 py-1 rounded font-medium transition ${
                  isActive
                    ? activeStyle
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={
                  mode === 'OFF'
                    ? 'Wire Flow Animation: OFF (Static Wires)'
                    : `Simulation Engine: ${mode} Mode`
                }
              >
                {mode}
              </button>
            );
          })}
        </div>

        {/* Playback Controls */}
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors ${
            isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          {simulationStatus !== 'running' ? (
            <button
              onClick={() => setSimulationStatus('running')}
              className="p-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition shadow shadow-emerald-500/20"
              title="Run Simulation"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={() => setSimulationStatus('paused')}
              className="p-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition shadow shadow-amber-500/20"
              title="Pause Simulation"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
            </button>
          )}

          <button
            onClick={resetSimulation}
            className={`p-1.5 rounded-md transition ${
              isDark
                ? 'hover:bg-rose-500/20 text-rose-400 hover:text-rose-300'
                : 'hover:bg-rose-100 text-rose-600 hover:text-rose-700'
            }`}
            title="Stop & Reset Simulation"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          <button
            onClick={stepSimulation}
            disabled={simulationStatus === 'running'}
            className={iconBtnClass}
            title="Step Forward (Single Tick)"
          >
            <StepForward className="w-3.5 h-3.5" />
          </button>

          {/* Speed Selector */}
          <select
            value={simulationSpeed}
            onChange={(e) => setSimulationSpeed(parseFloat(e.target.value))}
            className={`border rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none transition ${
              isDark
                ? 'bg-slate-900 border-slate-700/80 text-slate-200'
                : 'bg-white border-slate-300 text-slate-800'
            }`}
            title="Simulation Speed"
          >
            <option value="0.1">0.1x</option>
            <option value="0.5">0.5x</option>
            <option value="1">1.0x</option>
            <option value="2">2.0x</option>
          </select>

          {/* Status Badge */}
          <div
            className={`flex items-center gap-1.5 ml-1 pl-2 border-l text-[10px] font-mono ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                simulationStatus === 'running'
                  ? 'bg-emerald-500 animate-pulse'
                  : simulationStatus === 'paused'
                  ? 'bg-amber-500'
                  : isDark
                  ? 'bg-slate-600'
                  : 'bg-slate-400'
              }`}
            />
            <span
              className={`capitalize hidden xl:inline ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {simulationStatus === 'running' ? '60 FPS' : simulationStatus}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 4: WIRE COLOR DROPDOWN, CODE EDITOR, INSTRUMENT TOGGLES & THEME */}
      <div className="flex items-center gap-2">
        {/* Microcontroller Code Studio Toggle */}
        <button
          onClick={() => openCodeEditor()}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition shadow-sm ${
            isCodeEditorOpen
              ? 'bg-teal-500/20 text-teal-400 border-teal-500/50 ring-1 ring-teal-500/30'
              : isDark
              ? 'bg-slate-950/80 hover:bg-slate-800 border-slate-800 text-teal-300 hover:text-teal-200'
              : 'bg-teal-50 hover:bg-teal-100 border-teal-200 text-teal-700'
          }`}
          title="Microcontroller IDE & Serial Monitor"
        >
          <span className="font-mono font-bold text-teal-400">&lt;/&gt;</span>
          <span className="hidden lg:inline font-semibold">Code</span>
        </button>

        {/* Compact Wire Color Dropdown Button */}
        <div className="relative">
          <button
            onClick={() => setShowWireColorMenu(!showWireColorMenu)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
              showWireColorMenu
                ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                : isDark
                ? 'bg-slate-950/80 hover:bg-slate-800 border-slate-800 text-slate-200'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
            }`}
            title="Select Wire Color"
          >
            <span
              className="w-3.5 h-3.5 rounded-full border border-black/30 shadow-sm shrink-0"
              style={{ backgroundColor: activeWireColor }}
            />
            <span className="hidden sm:inline">Wire</span>
            <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${showWireColorMenu ? 'rotate-180' : ''}`} />
          </button>

          {showWireColorMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowWireColorMenu(false)}
              />
              <div
                className={`absolute right-0 mt-1.5 w-52 border rounded-xl shadow-2xl p-2.5 z-50 text-xs backdrop-blur-md transition-colors ${
                  isDark
                    ? 'bg-slate-900/95 border-slate-700/80 text-slate-200'
                    : 'bg-white/95 border-slate-200 text-slate-800'
                }`}
              >
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2 px-1">
                  Wire Color Palette
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {WIRE_COLORS.map((swatch) => {
                    const isSelected = activeWireColor === swatch.value;
                    return (
                      <button
                        key={swatch.value}
                        onClick={() => {
                          setActiveWireColor(swatch.value);
                          setShowWireColorMenu(false);
                        }}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[11px] font-medium transition ${
                          isSelected
                            ? 'border-sky-500 ring-2 ring-sky-500/30'
                            : isDark
                            ? 'border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-300'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                        }`}
                        title={swatch.name}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: swatch.value }}
                        />
                        <span className="truncate text-[10px]">
                          {swatch.name.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bench Instrument Launchers */}
        <div
          className={`flex items-center gap-1 border-l pl-2 ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <button
            onClick={() => toggleInstrument('multimeter')}
            className={`p-1.5 rounded transition ${
              showMultimeter
                ? 'bg-sky-500/20 text-sky-500 border border-sky-500/30'
                : isDark
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Toggle Multimeter"
          >
            <Gauge className="w-4 h-4" />
          </button>

          <button
            onClick={() => toggleInstrument('oscilloscope')}
            className={`p-1.5 rounded transition ${
              showOscilloscope
                ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                : isDark
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Toggle Oscilloscope"
          >
            <Activity className="w-4 h-4" />
          </button>

          <button
            onClick={() => toggleInstrument('logicAnalyzer')}
            className={`p-1.5 rounded transition ${
              showLogicAnalyzer
                ? 'bg-purple-500/20 text-purple-500 border border-purple-500/30'
                : isDark
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Toggle Logic Analyzer"
          >
            <Binary className="w-4 h-4" />
          </button>

          <button
            onClick={() => toggleInstrument('smartTips')}
            className={`p-1.5 rounded transition ${
              showSmartTips
                ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                : isDark
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Toggle Smart Tips & Diagnostics"
          >
            <Lightbulb className="w-4 h-4" />
          </button>
        </div>

        {/* Sound Mute / Unmute Toggle */}
        <button
          onClick={toggleSound}
          className={`p-1.5 rounded-lg border transition ml-1 ${
            isSoundEnabled
              ? isDark
                ? 'border-slate-800 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300'
                : 'border-slate-200 hover:bg-slate-100 text-emerald-600 hover:text-emerald-700'
              : isDark
              ? 'border-slate-800 hover:bg-slate-800 text-rose-400 hover:text-rose-300'
              : 'border-slate-200 hover:bg-slate-100 text-rose-500 hover:text-rose-600'
          }`}
          title={isSoundEnabled ? 'Sound Enabled (Click to Mute)' : 'Sound Muted (Click to Unmute)'}
        >
          {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`p-1.5 rounded-lg border transition ml-1 ${
            isDark
              ? 'border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-amber-400'
              : 'border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-amber-500'
          }`}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} Theme`}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
