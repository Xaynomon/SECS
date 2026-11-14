import { create } from 'zustand';
import {
  CircuitComponent,
  CircuitFileFormat,
  CircuitWire,
  DiagnosticTip,
  DrawingWireState,
  SimulationMode,
  SimulationStatus,
  ViewportTransform,
  WireWaypoint,
} from '../types/circuit';
import { COMPONENT_DEFINITIONS } from '../constants/componentLibrary';
import { ComponentRegistry } from '../registry/ComponentRegistry';
import { DEFAULT_WIRE_COLOR } from '../constants/wireColors';
import { getPinAbsolutePosition, snapToGrid } from '../utils/geometry';
import {
  extractInteriorWaypoints,
  routeSmartWireAStar,
  autoRouteAllWires,
} from '../utils/orthogonalRouter';
import { getProject, SavedProject, saveProject } from '../utils/indexedDb';
import { evaluateLogicalCircuit } from '../simulation/logical/LogicalEngine';
import { evaluateSpiceCircuit, resetSpiceEngineState } from '../simulation/spice/SpiceEngine';
import { McuManager } from '../simulation/mcu/McuManager';
import { runCircuitDiagnostics, resetDiagnosticsState } from '../utils/diagnostics';
import {
  ActiveProbePicker,
  LogicAnalyzerState,
  LogicChannelConfig,
  MultimeterMode,
  MultimeterState,
  OscilloscopeState,
  ProbeTarget,
  ScopeChannelConfig,
} from '../types/instruments';
import {
  computeWireFlowDirection,
  getRectifierDcReferenceOffset,
  resetCircuitFlowCache,
} from '../utils/circuitFlow';
import { resetWireFlowEngineState } from '../simulation/wireFlowEngine';
import { stopAllSounds, syncCircuitSound } from '../utils/soundEngine';

export interface ScopeSample {
  t: number;
  v1: number;
  v2: number;
}
export const scopeSampleBuffer: ScopeSample[] = [];
export function clearScopeSampleBuffer() {
  scopeSampleBuffer.length = 0;
}

interface HistorySnapshot {
  components: CircuitComponent[];
  wires: CircuitWire[];
}

const MAX_HISTORY = 30;

interface CircuitStoreState {
  // Navigation View
  currentView: 'editor' | 'dashboard';
  setView: (view: 'editor' | 'dashboard') => void;
  openDashboard: () => void;
  openEditor: () => void;

  // Project Metadata
  currentProjectId: string | null;
  currentProjectName: string;
  autoSaveStatus: 'idle' | 'saving' | 'saved';
  setAutoSaveStatus: (status: 'idle' | 'saving' | 'saved') => void;
  triggerAutoSave: () => void;
  setCurrentProjectId: (id: string | null) => void;
  setCurrentProjectName: (name: string) => void;
  saveCurrentProjectToDb: () => Promise<void>;
  loadProjectFromDb: (id: string) => Promise<void>;

  // Theme
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;

  // Audio / Sound
  isSoundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  toggleSound: () => void;

  // Viewport
  viewport: ViewportTransform;
  setViewport: (transform: Partial<ViewportTransform>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  resetViewport: () => void;

  // Circuit Data
  components: CircuitComponent[];
  wires: CircuitWire[];
  selectedComponentId: string | null;
  selectedComponentIds: string[];
  highlightedComponentId: string | null;
  selectedWireId: string | null;

  // Clipboard & Selection
  clipboard: { components: CircuitComponent[]; wires: CircuitWire[] } | null;
  pasteCount: number;
  selectAll: () => void;
  copySelected: () => void;
  pasteSelected: () => void;

  // Wire Drawing
  activeWireColor: string;
  setActiveWireColor: (color: string) => void;
  drawingWire: DrawingWireState | null;

  // Simulation
  simulationMode: SimulationMode;
  simulationStatus: SimulationStatus;
  simulationSpeed: number;
  simClockMs: number;
  simFps: number;

  // UI Panels
  showMultimeter: boolean;
  showOscilloscope: boolean;
  showLogicAnalyzer: boolean;
  showSmartTips: boolean;
  latchedDiagnostics: Record<string, DiagnosticTip>;
  dismissDiagnostic: (tipId: string) => void;
  clearLatchedDiagnostics: () => void;

  // Virtual Bench Instruments & Probes
  multimeter: MultimeterState;
  oscilloscope: OscilloscopeState;
  logicAnalyzer: LogicAnalyzerState;
  activeProbePicker: ActiveProbePicker | null;

  setMultimeterMode: (mode: MultimeterMode) => void;
  toggleMultimeterHold: () => void;
  resetMultimeterMinMax: () => void;
  attachProbe: (
    instrument: 'multimeter' | 'oscilloscope' | 'logicAnalyzer',
    channelId: string,
    target: ProbeTarget | null
  ) => void;
  detachProbe: (
    instrument: 'multimeter' | 'oscilloscope' | 'logicAnalyzer',
    channelId: string
  ) => void;
  detachAllProbesAtTarget: (target: ProbeTarget) => void;
  setActiveProbePicker: (picker: ActiveProbePicker | null) => void;
  setScopeChannelConfig: (channel: 'ch1' | 'ch2', config: Partial<ScopeChannelConfig>) => void;
  setScopeTimebase: (timebaseMsPerDiv: number) => void;
  setScopeTrigger: (trigger: Partial<OscilloscopeState['trigger']>) => void;
  toggleScopePaused: () => void;
  setLogicChannelConfig: (channelId: string, config: Partial<LogicChannelConfig>) => void;
  setLogicTimeScale: (scale: number) => void;
  toggleLogicPaused: () => void;
  setLogicCursors: (t1: number | null, t2: number | null) => void;

  // History (Undo / Redo)
  historyPast: HistorySnapshot[];
  historyFuture: HistorySnapshot[];
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  addComponent: (type: string, x?: number, y?: number) => string;
  removeComponent: (id: string) => void;
  addTextBox: (x?: number, y?: number) => string;
  addShape: (shapeType?: string, x?: number, y?: number) => string;
  updateComponentPos: (id: string, x: number, y: number) => void;
  moveComponent: (id: string, x: number, y: number) => void;
  commitComponentMove: (preDragSnapshot?: { components: CircuitComponent[]; wires: CircuitWire[] }) => void;
  rotateComponent: (id: string, deltaAngle?: number) => void;
  flipComponentHorizontal: (id: string) => void;
  updateComponentProperty: (id: string, key: string, value: any) => void;
  updateComponentLabel: (id: string, label: string) => void;
  deleteSelected: () => void;
  selectComponent: (id: string | null, isMulti?: boolean) => void;
  selectComponents: (ids: string[]) => void;
  setHighlightedComponent: (id: string | null) => void;
  moveSelectedComponents: (deltaX: number, deltaY: number) => void;
  rotateSelectedComponents: (deltaAngle?: number) => void;
  selectWire: (id: string | null) => void;

  // Wire Actions
  addWire: (
    fromCompId: string,
    fromPinId: string,
    toCompId: string,
    toPinId: string,
    color?: string
  ) => string;
  removeWire: (wireId: string) => void;
  startDrawingWire: (compId: string, pinId: string, startPos: { x: number; y: number }) => void;
  updateDrawingWirePos: (currentPos: { x: number; y: number }) => void;
  addWireWaypoint: (point: WireWaypoint) => void;
  completeDrawingWire: (toCompId: string, toPinId: string) => boolean;
  cancelDrawingWire: () => void;
  updateWireColor: (wireId: string, color: string) => void;
  updateWireWaypoints: (wireId: string, waypoints: WireWaypoint[]) => void;
  resetWireWaypoints: (wireId: string) => void;

  // Simulation Actions
  setSimulationMode: (mode: SimulationMode) => void;
  setSimulationStatus: (status: SimulationStatus) => void;
  setSimulationSpeed: (speed: number) => void;
  runSimulationCycle: (deltaTimeMs?: number) => void;
  stepSimulation: () => void;
  resetSimulation: () => void;
  toggleInteractiveComponent: (id: string) => void;

  // Instrument Toggles
  toggleInstrument: (instrument: 'multimeter' | 'oscilloscope' | 'logicAnalyzer' | 'smartTips') => void;

  // Stimulus Tools
  activeStimulusTool:
    | 'none'
    | 'lightbulb'
    | 'matchstick'
    | 'ice'
    | 'ultrasonic_target'
    | 'water_mister'
    | 'dry_air'
    | 'motion_target'
    | 'smoke_plume'
    | 'tilt_manipulator'
    | 'watering_can'
    | 'ir_remote'
    | 'bar_magnet'
    | 'hammer_tap';
  stimulusIntensity: number;
  setStimulusTool: (
    tool:
      | 'none'
      | 'lightbulb'
      | 'matchstick'
      | 'ice'
      | 'ultrasonic_target'
      | 'water_mister'
      | 'dry_air'
      | 'motion_target'
      | 'smoke_plume'
      | 'tilt_manipulator'
      | 'watering_can'
      | 'ir_remote'
      | 'bar_magnet'
      | 'hammer_tap',
    intensity?: number
  ) => void;
  setStimulusIntensity: (intensity: number) => void;

  // Microcontroller & Code Editor
  isCodeEditorOpen: boolean;
  activeMcuId: string | null;
  openCodeEditor: (componentId?: string) => void;
  closeCodeEditor: () => void;
  setActiveMcuId: (id: string) => void;
  updateMcuCode: (componentId: string, code: string) => boolean;
  sendSerialInput: (componentId: string, text: string) => void;
  clearSerialLogs: (componentId: string) => void;

  // File I/O
  newCircuit: () => void;
  loadCircuit: (data: CircuitFileFormat) => void;
  exportCircuitJson: () => CircuitFileFormat;
  loadSampleCircuit: () => void;

  // Undo / Redo
  undo: () => void;
  redo: () => void;
}

function getInitialTheme(): 'dark' | 'light' {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('secs_theme') || localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
  }
  return 'dark';
}

function getInitialSoundEnabled(): boolean {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('secs_sound_enabled');
    if (saved === 'false' || saved === '0') return false;
    if (saved === 'true' || saved === '1') return true;
  }
  return true;
}

function saveHistorySnapshot(
  components: CircuitComponent[],
  wires: CircuitWire[],
  past: HistorySnapshot[]
): HistorySnapshot[] {
  const snapshot: HistorySnapshot = {
    components: JSON.parse(JSON.stringify(components)),
    wires: JSON.parse(JSON.stringify(wires)),
  };
  const updated = [...past, snapshot];
  if (updated.length > MAX_HISTORY) {
    return updated.slice(updated.length - MAX_HISTORY);
  }
  return updated;
}

function clearLatchedBurnoutOnComps(components: CircuitComponent[]): CircuitComponent[] {
  return components.map((c) =>
    c.state
      ? {
          ...c,
          state: {
            ...c.state,
            isBurned: false,
            isOverloaded: false,
            overloadReason: undefined,
            lit: false,
            brightness: 0,
            isRunning: false,
            rpm: 0,
            isSounding: false,
            outputVoltage: undefined,
            logicOutput: undefined,
            output: undefined,
            branchCurrentA: 0,
            voltageDropV: 0,
            powerW: 0,
          },
        }
      : c
  );
}

let autoSaveTimer: any = null;
let lastAddComponentCall: { type: string; x?: number; y?: number; timestamp: number; id: string } | null = null;

export const useCircuitStore = create<CircuitStoreState>((set, get) => {
  const initialTheme = getInitialTheme();
  const initialSoundEnabled = getInitialSoundEnabled();
  if (typeof document !== 'undefined') {
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  return {
    // Navigation View
    currentView: 'dashboard',
    setView: (view) => set({ currentView: view }),
    openDashboard: () => {
      stopAllSounds();
      set({ currentView: 'dashboard' });
    },
    openEditor: () => set({ currentView: 'editor' }),

    // Project Metadata & Real-time Auto-Save
    currentProjectId: null,
    currentProjectName: 'Untitled Circuit',
    autoSaveStatus: 'idle',
    setAutoSaveStatus: (status) => set({ autoSaveStatus: status }),
    triggerAutoSave: () => {
      set({ autoSaveStatus: 'saving' });
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(async () => {
        try {
          await get().saveCurrentProjectToDb();
          set({ autoSaveStatus: 'saved' });
        } catch (err) {
          console.warn('Auto-save error:', err);
          set({ autoSaveStatus: 'idle' });
        }
      }, 400);
    },
    setCurrentProjectId: (id) => set({ currentProjectId: id }),
    setCurrentProjectName: (name) => {
      set({ currentProjectName: name });
      get().triggerAutoSave();
    },
    saveCurrentProjectToDb: async () => {
      const state = get();
      const id = state.currentProjectId || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      let createdAt = now;
      if (state.currentProjectId) {
        const existing = await getProject(state.currentProjectId);
        if (existing?.createdAt) {
          createdAt = existing.createdAt;
        }
      }
      const data = state.exportCircuitJson();
      data.name = state.currentProjectName;

      const savedProject: SavedProject = {
        id,
        name: state.currentProjectName,
        updatedAt: now,
        createdAt,
        componentCount: state.components.length,
        wireCount: state.wires.length,
        data,
      };
      await saveProject(savedProject);
      set({ currentProjectId: id });
    },
    loadProjectFromDb: async (id: string) => {
      const proj = await getProject(id);
      if (!proj) return;
      get().loadCircuit(proj.data);
      set({
        currentProjectId: proj.id,
        currentProjectName: proj.name,
        currentView: 'editor',
        autoSaveStatus: 'saved',
      });
    },

    // Theme
    theme: initialTheme,
    setTheme: (theme) => {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('secs_theme', theme);
        localStorage.setItem('theme', theme);
      }
      if (typeof document !== 'undefined') {
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      set({ theme });
    },
    toggleTheme: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark';
      get().setTheme(next);
    },

    // Audio / Sound
    isSoundEnabled: initialSoundEnabled,
    setSoundEnabled: (enabled) => {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('secs_sound_enabled', enabled ? 'true' : 'false');
      }
      set({ isSoundEnabled: enabled });
      syncCircuitSound(get().components, get().simulationStatus === 'running', enabled);
    },
    toggleSound: () => {
      const next = !get().isSoundEnabled;
      get().setSoundEnabled(next);
    },

    // Viewport
    viewport: { zoom: 1.0, panX: 100, panY: 100 },
    setViewport: (transform) =>
      set((state) => ({ viewport: { ...state.viewport, ...transform } })),
    zoomIn: () =>
      set((state) => ({
        viewport: { ...state.viewport, zoom: Math.min(4.0, +(state.viewport.zoom + 0.15).toFixed(2)) },
      })),
    zoomOut: () =>
      set((state) => ({
        viewport: { ...state.viewport, zoom: Math.max(0.25, +(state.viewport.zoom - 0.15).toFixed(2)) },
      })),
    zoomToFit: () => {
      const { components } = get();
      if (components.length === 0) {
        set({ viewport: { zoom: 1.0, panX: 100, panY: 100 } });
        return;
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const c of components) {
        minX = Math.min(minX, c.x);
        minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x + 100);
        maxY = Math.max(maxY, c.y + 100);
      }
      const width = maxX - minX;
      const height = maxY - minY;
      const canvasWidth = window.innerWidth - 600; // estimated bounds
      const canvasHeight = window.innerHeight - 150;
      const zoom = Math.min(2.0, Math.max(0.4, Math.min(canvasWidth / (width + 100), canvasHeight / (height + 100))));
      const panX = Math.round((canvasWidth - width * zoom) / 2 - minX * zoom + 150);
      const panY = Math.round((canvasHeight - height * zoom) / 2 - minY * zoom + 50);
      set({ viewport: { zoom, panX, panY } });
    },
    resetViewport: () => set({ viewport: { zoom: 1.0, panX: 100, panY: 100 } }),

    // Circuit Data
    components: [],
    wires: [],
    selectedComponentId: null,
    selectedComponentIds: [],
    highlightedComponentId: null,
    selectedWireId: null,

    // Clipboard & Selection
    clipboard: null,
    pasteCount: 0,

    // Wire Drawing
    activeWireColor: DEFAULT_WIRE_COLOR,
    setActiveWireColor: (color) => {
      set({ activeWireColor: color });
      // If a wire is currently selected, update its color as well
      const { selectedWireId } = get();
      if (selectedWireId) {
        get().updateWireColor(selectedWireId, color);
      }
    },
    drawingWire: null,

    // Simulation
    simulationMode: 'ANALOG',
    simulationStatus: 'stopped',
    simulationSpeed: 1.0,
    simClockMs: 0,
    simFps: 60,

    // UI Panels
    showMultimeter: false,
    showOscilloscope: false,
    showLogicAnalyzer: false,
    showSmartTips: true,
    latchedDiagnostics: {},
    isCodeEditorOpen: false,
    activeMcuId: null,

    // Virtual Bench Instruments & Probes
    multimeter: {
      redProbe: null,
      blackProbe: null,
      mode: 'DC_V',
      isHold: false,
      heldValue: null,
      heldUnit: 'V',
      minVal: null,
      maxVal: null,
    },
    oscilloscope: {
      ch1: {
        id: 'ch1',
        name: 'CH1',
        enabled: true,
        color: '#facc15',
        target: null,
        voltsPerDiv: 1.0,
        offsetDiv: 0,
        coupling: 'DC',
      },
      ch2: {
        id: 'ch2',
        name: 'CH2',
        enabled: true,
        color: '#38bdf8',
        target: null,
        voltsPerDiv: 1.0,
        offsetDiv: 0,
        coupling: 'DC',
      },
      timebaseMsPerDiv: 10,
      trigger: {
        source: 'ch1',
        mode: 'auto',
        edge: 'rising',
        levelV: 1.5,
      },
      isPaused: false,
    },
    logicAnalyzer: {
      channels: [
        { id: 'D0', name: 'D0 (CLK)', color: '#38bdf8', enabled: true, target: null },
        { id: 'D1', name: 'D1 (DATA)', color: '#a855f7', enabled: true, target: null },
        { id: 'D2', name: 'D2 (CS)', color: '#f59e0b', enabled: true, target: null },
        { id: 'D3', name: 'D3 (PWM)', color: '#10b981', enabled: true, target: null },
        { id: 'D4', name: 'D4 (RX)', color: '#ec4899', enabled: true, target: null },
        { id: 'D5', name: 'D5 (TX)', color: '#06b6d4', enabled: true, target: null },
        { id: 'D6', name: 'D6 (LED)', color: '#f97316', enabled: true, target: null },
        { id: 'D7', name: 'D7 (BTN)', color: '#84cc16', enabled: true, target: null },
      ],
      timeScaleMsPerDiv: 20,
      isPaused: false,
      cursorT1: null,
      cursorT2: null,
    },
    activeProbePicker: null,

    // Stimulus Tools
    activeStimulusTool: 'none',
    stimulusIntensity: 1000,
    setStimulusTool: (tool, intensity) => {
      let nextIntensity = get().stimulusIntensity;
      if (intensity !== undefined) {
        nextIntensity = intensity;
      } else {
        if (tool === 'lightbulb') nextIntensity = 1000;
        else if (tool === 'matchstick') nextIntensity = 125;
        else if (tool === 'ice') nextIntensity = -20;
        else if (tool === 'ultrasonic_target') nextIntensity = 50;
        else if (tool === 'water_mister') nextIntensity = 95;
        else if (tool === 'dry_air') nextIntensity = 15;
        else if (tool === 'motion_target') nextIntensity = 1;
        else if (tool === 'smoke_plume') nextIntensity = 1200;
        else if (tool === 'tilt_manipulator') nextIntensity = 2.0;
      }
      set({ activeStimulusTool: tool, stimulusIntensity: nextIntensity });
    },
    setStimulusIntensity: (intensity) => set({ stimulusIntensity: intensity }),

    // History
    historyPast: [],
    historyFuture: [],
    canUndo: false,
    canRedo: false,

    // Actions
    addComponent: (type, x, y) => {
      const def = ComponentRegistry.get(type) || COMPONENT_DEFINITIONS[type];
      if (!def) return '';

      // Hard Deduplication Guard: Ignore duplicate calls within 150ms for identical type & coords
      const now = Date.now();
      if (
        lastAddComponentCall &&
        now - lastAddComponentCall.timestamp < 150 &&
        lastAddComponentCall.type === type &&
        (
          (x !== undefined && y !== undefined && Math.abs(x - (lastAddComponentCall.x ?? 0)) < 2 && Math.abs(y - (lastAddComponentCall.y ?? 0)) < 2) ||
          (x === undefined && y === undefined && lastAddComponentCall.x === undefined && lastAddComponentCall.y === undefined)
        )
      ) {
        return lastAddComponentCall.id;
      }

      const { components, wires, historyPast, viewport } = get();
      const newPast = saveHistorySnapshot(components, wires, historyPast);

      // Calculate strictly unique sequential designator (e.g. R1, R2... U1, U2, U3...)
      const prefix = def.defaultDesignator || 'U';
      const existingNumbers = new Set<number>();
      for (const c of components) {
        if (c.label && c.label.startsWith(prefix)) {
          const suffix = c.label.substring(prefix.length);
          const num = parseInt(suffix, 10);
          if (!isNaN(num) && num > 0) {
            existingNumbers.add(num);
          }
        }
      }
      let nextNum = 1;
      while (existingNumbers.has(nextNum)) {
        nextNum++;
      }
      const label = `${prefix}${nextNum}`;

      const id = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      // If x or y is not specified (e.g. sidebar click-to-place fallback), place in viewport center
      const rawX = x !== undefined ? x : -viewport.panX / viewport.zoom + 360 / viewport.zoom;
      const rawY = y !== undefined ? y : -viewport.panY / viewport.zoom + 260 / viewport.zoom;
      const snappedX = snapToGrid(rawX);
      const snappedY = snapToGrid(rawY);

      const newComponent: CircuitComponent = {
        id,
        type,
        label,
        x: snappedX,
        y: snappedY,
        rotation: 0,
        mirrored: false,
        properties: JSON.parse(JSON.stringify(def.defaultProperties)),
        state: {},
      };

      set({
        components: [...clearLatchedBurnoutOnComps(components), newComponent],
        latchedDiagnostics: {},
        selectedComponentId: id,
        selectedWireId: null,
        historyPast: newPast,
        historyFuture: [],
        canUndo: true,
        canRedo: false,
      });

      if (get().simulationStatus === 'running') {
        get().runSimulationCycle(0);
      }

      lastAddComponentCall = { type, x, y, timestamp: now, id };
      return id;
    },

    removeComponent: (id) => {
      const { components, wires, historyPast, simulationStatus, simClockMs } = get();
      const hadActiveSim =
        simulationStatus === 'running' ||
        simClockMs > 0 ||
        components.some((c) => c.state?.isBurned || c.state?.isOverloaded);
      const newPast = saveHistorySnapshot(components, wires, historyPast);
      const nextComponents = clearLatchedBurnoutOnComps(components.filter((c) => c.id !== id));
      const nextWires = wires.filter((w) => w.fromCompId !== id && w.toCompId !== id);

      set({
        components: nextComponents,
        wires: nextWires,
        latchedDiagnostics: {},
        selectedComponentId: get().selectedComponentId === id ? null : get().selectedComponentId,
        selectedComponentIds: get().selectedComponentIds.filter((cid) => cid !== id),
        historyPast: newPast,
        historyFuture: [],
        canUndo: true,
        canRedo: false,
      });

      if (hadActiveSim) {
        get().runSimulationCycle(0);
      }
    },

    addTextBox: (x, y) => {
      const { viewport } = get();
      const targetX = x !== undefined ? x : snapToGrid(-viewport.panX / viewport.zoom + 200);
      const targetY = y !== undefined ? y : snapToGrid(-viewport.panY / viewport.zoom + 160);
      return get().addComponent('textbox', targetX, targetY);
    },

    addShape: (shapeType = 'rectangle', x, y) => {
      const { viewport } = get();
      const targetX = x !== undefined ? x : snapToGrid(-viewport.panX / viewport.zoom + 220);
      const targetY = y !== undefined ? y : snapToGrid(-viewport.panY / viewport.zoom + 180);
      const id = get().addComponent('shape', targetX, targetY);
      if (id && shapeType) {
        set((state) => ({
          components: state.components.map((c) =>
            c.id === id
              ? {
                  ...c,
                  properties: {
                    ...c.properties,
                    shapeType,
                  },
                }
              : c
          ),
        }));
      }
      return id;
    },

    updateComponentPos: (id, x, y) => {
      const { components } = get();
      const snappedX = snapToGrid(x);
      const snappedY = snapToGrid(y);

      set({
        components: components.map((c) =>
          c.id === id ? { ...c, x: snappedX, y: snappedY } : c
        ),
      });
    },

    moveComponent: (id, x, y) => {
      get().updateComponentPos(id, x, y);
    },

    commitComponentMove: (preDragSnapshot) => {
      const { components, wires, historyPast } = get();
      const snapshotComps = preDragSnapshot ? preDragSnapshot.components : components;
      const snapshotWires = preDragSnapshot ? preDragSnapshot.wires : wires;
      const newPast = saveHistorySnapshot(snapshotComps, snapshotWires, historyPast);
      set({
        historyPast: newPast,
        historyFuture: [],
        canUndo: true,
        canRedo: false,
      });
    },

    rotateComponent: (id, deltaAngle = 90) => {
      const { components, wires, historyPast, selectedComponentIds } = get();
      const newPast = saveHistorySnapshot(components, wires, historyPast);
      const targetIds =
        selectedComponentIds.length > 1 && selectedComponentIds.includes(id)
          ? new Set(selectedComponentIds)
          : new Set([id]);

      set({
        components: components.map((c) =>
          targetIds.has(c.id) ? { ...c, rotation: (c.rotation + deltaAngle) % 360 } : c
        ),
        historyPast: newPast,
        historyFuture: [],
        canUndo: true,
        canRedo: false,
      });
    },

    rotateSelectedComponents: (deltaAngle = 90) => {
      const { components, wires, historyPast, selectedComponentIds, selectedComponentId } = get();
      const targetIds = new Set(selectedComponentIds);
      if (selectedComponentId) targetIds.add(selectedComponentId);
      if (targetIds.size === 0) return;

      const newPast = saveHistorySnapshot(components, wires, historyPast);
      set({
        components: components.map((c) =>
          targetIds.has(c.id) ? { ...c, rotation: (c.rotation + deltaAngle) % 360 } : c
        ),
        historyPast: newPast,
        historyFuture: [],
        canUndo: true,
        canRedo: false,
      });
    },

    moveSelectedComponents: (deltaX, deltaY) => {
      const { components, selectedComponentIds, selectedComponentId } = get();
      const targetIds = new Set(selectedComponentIds);
      if (selectedComponentId) targetIds.add(selectedComponentId);
      if (targetIds.size === 0) return;

      set({
        components: components.map((c) =>
          targetIds.has(c.id)
            ? { ...c, x: snapToGrid(c.x + deltaX), y: snapToGrid(c.y + deltaY) }
            : c
        ),
      });
    },

    flipComponentHorizontal: (id) => {
      const { components, wires, historyPast } = get();
      const newPast = saveHistorySnapshot(components, wires, historyPast);

      set({
        components: components.map((c) =>
          c.id === id ? { ...c, mirrored: !c.mirrored } : c
        ),
        historyPast: newPast,
        historyFuture: [],
        canUndo: true,
        canRedo: false,
      });
    },

    updateComponentProperty: (id, key, value) => {
      const { simulationStatus, simClockMs, components } = get();
      const hadActiveSim =
        simulationStatus === 'running' ||
        simClockMs > 0 ||
        components.some((c) => c.state?.isBurned || c.state?.isOverloaded);

      set((state) => ({
        components: clearLatchedBurnoutOnComps(state.components).map((c) =>
          c.id === id
            ? { ...c, properties: { ...c.properties, [key]: value } }
            : c
        ),
        latchedDiagnostics: {},
      }));

      // Immediate simulation re-evaluation for responsive interactive controls & live fixes
      if (
        hadActiveSim ||
        [
          'state',
          'isPressed',
          'temperatureC',
          'lux',
          'position',
          'humidity',
          'motionDetected',
          'ppm',
          'accelX',
          'accelY',
          'accelZ',
          'targetAngle',
          'targetVoltage',
          'converterMode',
          'activeKey',
          'clockHz',
        ].includes(key)
      ) {
        get().runSimulationCycle(0);
      }
    },

    updateComponentLabel: (id, label) => {
      set((state) => ({
        components: state.components.map((c) =>
          c.id === id ? { ...c, label } : c
        ),
      }));
    },

    deleteSelected: () => {
      const {
        selectedComponentIds,
        selectedComponentId,
        selectedWireId,
        components,
        wires,
        historyPast,
        simulationStatus,
        simClockMs,
      } = get();
      const targetCompIds = new Set(selectedComponentIds);
      if (selectedComponentId) targetCompIds.add(selectedComponentId);

      if (targetCompIds.size === 0 && !selectedWireId) return;

      const hadActiveSim =
        simulationStatus === 'running' ||
        simClockMs > 0 ||
        components.some((c) => c.state?.isBurned || c.state?.isOverloaded);

      const newPast = saveHistorySnapshot(components, wires, historyPast);

      let nextComponents = clearLatchedBurnoutOnComps(
        components.filter((c) => !targetCompIds.has(c.id))
      );
      let nextWires = wires.filter(
        (w) => !targetCompIds.has(w.fromCompId) && !targetCompIds.has(w.toCompId)
      );

      if (selectedWireId) {
        nextWires = nextWires.filter((w) => w.id !== selectedWireId);
      }

      set({
        components: nextComponents,
        wires: nextWires,
        latchedDiagnostics: {},
        selectedComponentId: null,
        selectedComponentIds: [],
        selectedWireId: null,
        historyPast: newPast,
        historyFuture: [],
        canUndo: true,
        canRedo: false,
      });

      if (hadActiveSim) {
        get().runSimulationCycle(0);
      }
    },

    selectComponent: (id, isMulti = false) => {
      if (isMulti && id) {
        const { selectedComponentIds } = get();
        const next = selectedComponentIds.includes(id)
          ? selectedComponentIds.filter((x) => x !== id)
          : [...selectedComponentIds, id];
        set({
          selectedComponentIds: next,
          selectedComponentId: next[0] ?? null,
          selectedWireId: null,
        });
      } else {
        set({
          selectedComponentId: id,
          selectedComponentIds: id ? [id] : [],
          selectedWireId: null,
        });
      }
    },

    selectComponents: (ids) => {
      set({
        selectedComponentIds: ids,
        selectedComponentId: ids[0] ?? null,
        selectedWireId: null,
      });
    },

    selectAll: () => {
      const { components } = get();
      if (components.length === 0) return;
      const allIds = components.map((c) => c.id);
      set({
        selectedComponentIds: allIds,
        selectedComponentId: allIds[0] ?? null,
        selectedWireId: null,
      });
    },

    copySelected: () => {
      const { components, wires, selectedComponentIds, selectedComponentId } = get();
      const targetIds = new Set(selectedComponentIds);
      if (selectedComponentId) targetIds.add(selectedComponentId);
      if (targetIds.size === 0) return;

      const copiedComponents = components
        .filter((c) => targetIds.has(c.id))
        .map((c) => JSON.parse(JSON.stringify(c)));

      const copiedWires = wires
        .filter((w) => targetIds.has(w.fromCompId) && targetIds.has(w.toCompId))
        .map((w) => JSON.parse(JSON.stringify(w)));

      set({
        clipboard: {
          components: copiedComponents,
          wires: copiedWires,
        },
        pasteCount: 0,
      });
    },

    pasteSelected: () => {
      const { clipboard, pasteCount, components, wires, historyPast } = get();
      if (!clipboard || clipboard.components.length === 0) return;

      const newPast = saveHistorySnapshot(components, wires, historyPast);
      const offset = (pasteCount + 1) * 40;

      const idMap = new Map<string, string>();
      const newComponents: CircuitComponent[] = [];
      const allCompsForLabels = [...components];

      for (const comp of clipboard.components) {
        const newId = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        idMap.set(comp.id, newId);

        const def = ComponentRegistry.get(comp.type) || COMPONENT_DEFINITIONS[comp.type];
        const prefix = def?.defaultDesignator || comp.label?.replace(/[0-9]/g, '') || 'U';

        const existingNumbers = new Set<number>();
        for (const c of allCompsForLabels) {
          if (c.label && c.label.startsWith(prefix)) {
            const suffix = c.label.substring(prefix.length);
            const num = parseInt(suffix, 10);
            if (!isNaN(num) && num > 0) {
              existingNumbers.add(num);
            }
          }
        }
        let nextNum = 1;
        while (existingNumbers.has(nextNum)) {
          nextNum++;
        }
        const newLabel = `${prefix}${nextNum}`;

        const clonedComp: CircuitComponent = {
          ...JSON.parse(JSON.stringify(comp)),
          id: newId,
          label: newLabel,
          x: snapToGrid(comp.x + offset),
          y: snapToGrid(comp.y + offset),
          state: {},
        };

        newComponents.push(clonedComp);
        allCompsForLabels.push(clonedComp);
      }

      const newWires: CircuitWire[] = [];
      for (const wire of clipboard.wires) {
        const newFromId = idMap.get(wire.fromCompId);
        const newToId = idMap.get(wire.toCompId);
        if (newFromId && newToId) {
          const newWireId = `wire_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const newWaypoints = (wire.waypoints || []).map((pt) => ({
            x: snapToGrid(pt.x + offset),
            y: snapToGrid(pt.y + offset),
          }));

          newWires.push({
            ...JSON.parse(JSON.stringify(wire)),
            id: newWireId,
            fromCompId: newFromId,
            toCompId: newToId,
            waypoints: newWaypoints,
            state: {},
          });
        }
      }

      const newComponentIds = newComponents.map((c) => c.id);

      set({
        components: [...components, ...newComponents],
        wires: [...wires, ...newWires],
        selectedComponentIds: newComponentIds,
        selectedComponentId: newComponentIds[0] ?? null,
        selectedWireId: null,
        pasteCount: pasteCount + 1,
        historyPast: newPast,
        historyFuture: [],
        canUndo: true,
        canRedo: false,
      });

      if (get().simulationStatus === 'running') {
        get().runSimulationCycle(0);
      }
    },

    setHighlightedComponent: (id) => {
      set({ highlightedComponentId: id });
    },

    selectWire: (id) => {
      const { wires } = get();
      const wire = wires.find((w) => w.id === id);
      set({
        selectedWireId: id,
        selectedComponentId: null,
        activeWireColor: wire ? wire.color : get().activeWireColor,
      });
    },

    // Wire Actions
    addWire: (fromCompId, fromPinId, toCompId, toPinId, color) => {
      const { wires, components, historyPast, activeWireColor, simulationStatus, simClockMs } = get();
      const hadActiveSim =
        simulationStatus === 'running' ||
        simClockMs > 0 ||
        components.some((c) => c.state?.isBurned || c.state?.isOverloaded);

      const newPast = saveHistorySnapshot(components, wires, historyPast);
      let finalWaypoints: WireWaypoint[] = [];
      const fromComp = components.find((c) => c.id === fromCompId);
      const toComp = components.find((c) => c.id === toCompId);
      if (fromComp && toComp) {
        const fromDef = ComponentRegistry.get(fromComp.type) || COMPONENT_DEFINITIONS[fromComp.type];
        const toDef = ComponentRegistry.get(toComp.type) || COMPONENT_DEFINITIONS[toComp.type];
        if (fromDef && toDef) {
          const startPos = getPinAbsolutePosition(fromComp, fromPinId, fromDef);
          const endPos = getPinAbsolutePosition(toComp, toPinId, toDef);
          const fullPts = routeSmartWireAStar(startPos, endPos, components, wires);
          finalWaypoints = extractInteriorWaypoints(fullPts);
        }
      }

      const newWire: CircuitWire = {
        id: `wire_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        fromCompId,
        fromPinId,
        toCompId,
        toPinId,
        waypoints: finalWaypoints,
        color: color || activeWireColor,
      };

      set({
        components: clearLatchedBurnoutOnComps(components),
        wires: [...wires, newWire],
        latchedDiagnostics: {},
        selectedWireId: newWire.id,
        historyPast: newPast,
        historyFuture: [],
        canUndo: true,
        canRedo: false,
      });

      if (hadActiveSim) {
        get().runSimulationCycle(0);
      }

      return newWire.id;
    },

    removeWire: (wireId) => {
      const { wires, components, historyPast, simulationStatus, simClockMs } = get();
      const hadActiveSim =
        simulationStatus === 'running' ||
        simClockMs > 0 ||
        components.some((c) => c.state?.isBurned || c.state?.isOverloaded);

      const newPast = saveHistorySnapshot(components, wires, historyPast);
      const nextWires = wires.filter((w) => w.id !== wireId);
      const nextComponents = clearLatchedBurnoutOnComps(components);

      set({
        components: nextComponents,
        wires: nextWires,
        latchedDiagnostics: {},
        selectedWireId: get().selectedWireId === wireId ? null : get().selectedWireId,
        historyPast: newPast,
        historyFuture: [],
        canUndo: true,
        canRedo: false,
      });

      if (hadActiveSim) {
        get().runSimulationCycle(0);
      }
    },

    startDrawingWire: (compId, pinId, startPos) => {
      set({
        drawingWire: {
          fromCompId: compId,
          fromPinId: pinId,
          startPos,
          currentPos: startPos,
          waypoints: [],
          color: get().activeWireColor,
        },
        selectedComponentId: null,
        selectedWireId: null,
      });
    },

    updateDrawingWirePos: (currentPos) => {
      const { drawingWire } = get();
      if (!drawingWire) return;
      set({
        drawingWire: {
          ...drawingWire,
          currentPos,
        },
      });
    },

    addWireWaypoint: (point) => {
      const { drawingWire } = get();
      if (!drawingWire) return;
      set({
        drawingWire: {
          ...drawingWire,
          waypoints: [...drawingWire.waypoints, point],
        },
      });
    },

    completeDrawingWire: (toCompId, toPinId) => {
      const { drawingWire, wires, components, historyPast, simulationStatus, simClockMs } = get();
      if (!drawingWire) return false;

      // Cannot connect a pin to itself on the same component
      if (drawingWire.fromCompId === toCompId && drawingWire.fromPinId === toPinId) {
        get().cancelDrawingWire();
        return false;
      }

      // Check for duplicate wire between same pins
      const duplicate = wires.some(
        (w) =>
          (w.fromCompId === drawingWire.fromCompId &&
            w.fromPinId === drawingWire.fromPinId &&
            w.toCompId === toCompId &&
            w.toPinId === toPinId) ||
          (w.fromCompId === toCompId &&
            w.fromPinId === toPinId &&
            w.toCompId === drawingWire.fromCompId &&
            w.toPinId === drawingWire.fromPinId)
      );

      if (duplicate) {
        get().cancelDrawingWire();
        return false;
      }

      const hadActiveSim =
        simulationStatus === 'running' ||
        simClockMs > 0 ||
        components.some((c) => c.state?.isBurned || c.state?.isOverloaded);

      const newPast = saveHistorySnapshot(components, wires, historyPast);

      // Determine initial orthogonal waypoints using A* obstacle router if none were manually clicked
      let finalWaypoints = [...drawingWire.waypoints];
      if (finalWaypoints.length === 0) {
        const fromComp = components.find((c) => c.id === drawingWire.fromCompId);
        const toComp = components.find((c) => c.id === toCompId);
        if (fromComp && toComp) {
          const fromDef = COMPONENT_DEFINITIONS[fromComp.type];
          const toDef = COMPONENT_DEFINITIONS[toComp.type];
          if (fromDef && toDef) {
            const startPos = getPinAbsolutePosition(fromComp, drawingWire.fromPinId, fromDef);
            const endPos = getPinAbsolutePosition(toComp, toPinId, toDef);
            const fullPts = routeSmartWireAStar(startPos, endPos, components, wires);
            finalWaypoints = extractInteriorWaypoints(fullPts);
          }
        }
      }

      const newWire: CircuitWire = {
        id: `wire_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        fromCompId: drawingWire.fromCompId,
        fromPinId: drawingWire.fromPinId,
        toCompId,
        toPinId,
        waypoints: finalWaypoints,
        color: drawingWire.color,
      };

      set({
        components: clearLatchedBurnoutOnComps(components),
        wires: [...wires, newWire],
        latchedDiagnostics: {},
        drawingWire: null,
        selectedWireId: newWire.id,
        historyPast: newPast,
        historyFuture: [],
        canUndo: true,
        canRedo: false,
      });

      if (hadActiveSim) {
        get().runSimulationCycle(0);
      }

      return true;
    },

    cancelDrawingWire: () => {
      set({ drawingWire: null });
    },

    updateWireColor: (wireId, color) => {
      set((state) => ({
        wires: state.wires.map((w) => (w.id === wireId ? { ...w, color } : w)),
      }));
    },

    updateWireWaypoints: (wireId, waypoints) => {
      set((state) => ({
        wires: state.wires.map((w) => (w.id === wireId ? { ...w, waypoints } : w)),
      }));
    },

    resetWireWaypoints: (wireId) => {
      const { components, wires, historyPast } = get();
      const wire = wires.find((w) => w.id === wireId);
      if (!wire) return;

      const fromComp = components.find((c) => c.id === wire.fromCompId);
      const toComp = components.find((c) => c.id === wire.toCompId);
      if (!fromComp || !toComp) return;

      const fromDef = COMPONENT_DEFINITIONS[fromComp.type];
      const toDef = COMPONENT_DEFINITIONS[toComp.type];
      if (!fromDef || !toDef) return;

      const startPos = getPinAbsolutePosition(fromComp, wire.fromPinId, fromDef);
      const endPos = getPinAbsolutePosition(toComp, wire.toPinId, toDef);
      const defaultPts = routeSmartWireAStar(startPos, endPos, components, wires, wire.id);
      const waypoints = extractInteriorWaypoints(defaultPts);

      const newPast = saveHistorySnapshot(components, wires, historyPast);
      set({
        wires: wires.map((w) => (w.id === wireId ? { ...w, waypoints } : w)),
        historyPast: newPast,
        historyFuture: [],
        canUndo: true,
        canRedo: false,
      });
    },

    // Simulation
    setSimulationMode: (mode) => {
      const { wires, simulationStatus, simClockMs } = get();
      const cleanedWires = wires.map((w) => ({
        ...w,
        state: {
          ...w.state,
          logicLevel: undefined,
          voltage: undefined,
          current: undefined,
        },
      }));
      set({ simulationMode: mode, wires: cleanedWires });
      if (simulationStatus === 'running' || simClockMs > 0) {
        get().runSimulationCycle(0);
      }
    },
    setSimulationStatus: (status) => {
      set({ simulationStatus: status });
      if (status === 'running') {
        get().runSimulationCycle(0);
      } else {
        stopAllSounds();
        if (status === 'stopped') {
          get().resetSimulation();
        }
      }
    },
    setSimulationSpeed: (speed) => set({ simulationSpeed: speed }),
    runSimulationCycle: (deltaTimeMs = 50) => {
      const { components, wires, simClockMs, simulationSpeed, simulationMode } = get();
      const nextClock = simClockMs + deltaTimeMs * simulationSpeed;

      let updatedWires = [...wires];
      let updatedComps = [...components];

      // 0. Advance Microcontroller Runtimes (Arduino Uno / ESP32 / 8-Bit Assembly CPU)
      const mcuManager = McuManager.getInstance();
      const pinVoltagesByComp = new Map<string, Record<string, number>>();
      for (const comp of components) {
        if (comp.state?.pinVoltages) {
          pinVoltagesByComp.set(comp.id, comp.state.pinVoltages);
        }
      }
      const mcuDataMap = mcuManager.stepAll(nextClock, components, pinVoltagesByComp, updatedWires);

      // Collect active MCU peripheral updates (OLED, LCD, SD Card, Servo)
      let activeOledLines: string[] | null = null;
      let activeOledProgress: number | null = null;
      let activeLcdRows: [string, string] | null = null;
      const pendingSdWrites: Array<{ filename: string; text: string; append: boolean }> = [];

      for (const mcuData of mcuDataMap.values()) {
        if (mcuData.peripheralState) {
          if (mcuData.peripheralState.oledUpdated) {
            activeOledLines = mcuData.peripheralState.oledLines ?? null;
            activeOledProgress = mcuData.peripheralState.oledProgressBar ?? null;
          }
          if (mcuData.peripheralState.lcdUpdated) {
            activeLcdRows = mcuData.peripheralState.lcdRows ?? null;
          }
          if (mcuData.peripheralState.sdPendingWrites?.length) {
            pendingSdWrites.push(...mcuData.peripheralState.sdPendingWrites);
          }
        }
      }

      // Inject updated MCU pin states, modes, LEDs, registers, and peripheral outputs into components
      updatedComps = updatedComps.map((c) => {
        const mcuData = mcuDataMap.get(c.id);
        if (mcuData) {
          return {
            ...c,
            state: {
              ...c.state,
              pins: mcuData.pins,
              ledL: mcuData.ledL,
              ledOn: mcuData.ledOn,
              ledTx: mcuData.ledTx,
              ledRx: mcuData.ledRx,
              serialLogs: mcuData.serialLogs,
              mcuStatus: mcuData.status,
              lastMcuError: mcuData.lastError,
              asmRegisters: mcuData.asmRegisters,
            },
          };
        }

        if (
          (c.type === 'builtin_oled_display' || c.type === 'oled-display') &&
          activeOledLines !== null
        ) {
          return {
            ...c,
            properties: {
              ...c.properties,
              displayText: activeOledLines.join('\n'),
              progressBar: activeOledProgress,
            },
          };
        }

        if (
          (c.type === 'builtin_lcd_16x2' || c.type === 'lcd-16x2') &&
          activeLcdRows !== null
        ) {
          return {
            ...c,
            properties: {
              ...c.properties,
              row1Text: activeLcdRows[0],
              row2Text: activeLcdRows[1],
            },
          };
        }

        if (
          (c.type === 'builtin_sd_card' || c.type === 'sd-card') &&
          pendingSdWrites.length > 0
        ) {
          const nextFiles = { ...(c.properties?.files || {}) };
          for (const w of pendingSdWrites) {
            if (w.append) {
              nextFiles[w.filename] = `${nextFiles[w.filename] || ''}${w.text}`;
            } else {
              nextFiles[w.filename] = w.text;
            }
          }
          return {
            ...c,
            properties: {
              ...c.properties,
              files: nextFiles,
            },
            state: {
              ...c.state,
              sdActivity: true,
            },
          };
        }

        return c;
      });

      // 1. LOGICAL Mode: Traces pure digital/logical flow, disregarding analog electrical limits (NO burnout/fire)
      if (simulationMode === 'LOGICAL') {
        const logicalResult = evaluateLogicalCircuit(updatedComps, updatedWires, nextClock);

        updatedWires = updatedWires.map((w) => {
          const lvl = logicalResult.wireStates.get(w.id) ?? 'Z';
          const fromComp = updatedComps.find((c) => c.id === w.fromCompId);
          const toComp = updatedComps.find((c) => c.id === w.toCompId);
          const flowDir = computeWireFlowDirection(
            w,
            fromComp,
            toComp,
            'LOGICAL',
            undefined,
            undefined,
            updatedWires,
            updatedComps
          );
          return {
            ...w,
            state: {
              ...w.state,
              logicLevel: lvl,
              voltage: lvl === 1 ? 5.0 : lvl === 0 ? 0.0 : undefined,
              current: 0,
              flowDirection: flowDir,
            },
          };
        });

        updatedComps = updatedComps.map((c) => {
          const cState = logicalResult.componentStates.get(c.id);
          if (!cState) return c;
          // In LOGICAL mode: Disable all thermal/voltage/current overload fire & burnout hazards
          return {
            ...c,
            state: {
              ...c.state,
              ...cState,
              isOverloaded: false,
              isBurned: false,
              overloadReason: undefined,
              lit: Boolean(cState.lit),
            },
          };
        });
      }

      // 2. ANALOG & OFF Modes: Trace real analog electrical physics (voltage, current, power, hazards, fire/smoke); OFF disables wire flow animation only
      if (simulationMode === 'ANALOG' || simulationMode === 'OFF') {
        // First run logical pass to seed logic gate & MCU digital outputs
        const logicalResult = evaluateLogicalCircuit(updatedComps, updatedWires, nextClock);
        for (const c of updatedComps) {
          const cState = logicalResult.componentStates.get(c.id);
          if (cState) {
            c.state = { ...c.state, ...cState };
          }
        }

        const { showOscilloscope, oscilloscope } = get();
        const isOffMode = simulationMode === 'OFF';
        const hasFastTransientSource =
          showOscilloscope ||
          updatedComps.some(
            (c) =>
              c.type === 'ac-source' ||
              c.type === 'ic-555' ||
              c.type === 'builtin_555' ||
              c.type === 'timer-555'
          );
        // Adaptive sub-stepping: 16 steps for AC/555/Oscilloscope transients, else 2 steps for 60FPS fluidity
        const numSubSteps = deltaTimeMs <= 0 ? 1 : hasFastTransientSource ? 16 : 2;
        const subDtMs = deltaTimeMs > 0 ? deltaTimeMs / numSubSteps : 0;
        const subDtSec = Math.max(0.0005, (subDtMs * simulationSpeed) / 1000);

        const getPinRawVoltageFromSpice = (
          compId: string | undefined,
          pinId: string | undefined,
          sRes: ReturnType<typeof evaluateSpiceCircuit>
        ): number | undefined => {
          if (!compId || !pinId) return undefined;
          const compRes = sRes.componentResults.get(compId);
          if (!compRes?.pinVoltages) return undefined;
          if (typeof compRes.pinVoltages[pinId] === 'number') {
            return compRes.pinVoltages[pinId];
          }
          const lower = pinId.toLowerCase();
          if (typeof compRes.pinVoltages[lower] === 'number') {
            return compRes.pinVoltages[lower];
          }
          return undefined;
        };

        const getPinDcOffsetFromSpice = (
          compId: string | undefined,
          pinId: string | undefined,
          sRes: ReturnType<typeof evaluateSpiceCircuit>
        ): number => {
          if (!compId || !pinId) return 0.0;
          return getRectifierDcReferenceOffset(
            { type: 'pin', compId, pinId },
            updatedComps,
            updatedWires,
            (cId, pId) => getPinRawVoltageFromSpice(cId, pId, sRes)
          );
        };

        const getProbeVoltageFromSpice = (
          target: ProbeTarget | null | undefined,
          sRes: ReturnType<typeof evaluateSpiceCircuit>
        ): number => {
          if (!target) return 0.0;
          if (target.type === 'wire') {
            const w = target.wireId
              ? updatedWires.find((item) => item.id === target.wireId)
              : undefined;
            const fromCompId = w?.fromCompId ?? target.compId;
            const fromPinId = w?.fromPinId ?? target.pinId;
            const toCompId = w?.toCompId;
            const toPinId = w?.toPinId;

            const pinFromV = getPinRawVoltageFromSpice(fromCompId, fromPinId, sRes);
            const pinToV = getPinRawVoltageFromSpice(toCompId, toPinId, sRes);
            const rawV =
              pinFromV ??
              pinToV ??
              (target.wireId ? sRes.wireVoltages.get(target.wireId) : undefined) ??
              0.0;
            const offset =
              getPinDcOffsetFromSpice(fromCompId, fromPinId, sRes) ||
              getPinDcOffsetFromSpice(toCompId, toPinId, sRes);
            return rawV - offset;
          }
          if (target.type === 'pin' && target.compId && target.pinId) {
            const rawV = getPinRawVoltageFromSpice(target.compId, target.pinId, sRes) ?? 0.0;
            const offset = getPinDcOffsetFromSpice(target.compId, target.pinId, sRes);
            return rawV - offset;
          }
          return 0.0;
        };

        let spiceResult!: ReturnType<typeof evaluateSpiceCircuit>;

        for (let step = 1; step <= numSubSteps; step++) {
          const subClock = simClockMs + step * subDtMs * simulationSpeed;
          // Advance logical engine at each sub-step so sequential ICs, flip-flops, counters, shift registers, and 555 timers step cleanly
          const logRes = evaluateLogicalCircuit(updatedComps, updatedWires, subClock);
          for (const c of updatedComps) {
            const cState = logRes.componentStates.get(c.id);
            if (cState) {
              c.state = { ...c.state, ...cState };
            }
          }

          const subRes = evaluateSpiceCircuit(updatedComps, updatedWires, subClock, subDtSec);
          if (step === numSubSteps) {
            spiceResult = subRes;
          }
          if (showOscilloscope && oscilloscope) {
            const v1 = getProbeVoltageFromSpice(oscilloscope.ch1.target, subRes);
            const v2 = getProbeVoltageFromSpice(oscilloscope.ch2.target, subRes);
            scopeSampleBuffer.push({ t: subClock, v1, v2 });
          }
        }
        if (showOscilloscope && scopeSampleBuffer.length > 32000) {
          scopeSampleBuffer.splice(0, scopeSampleBuffer.length - 32000);
        }

        updatedWires = updatedWires.map((w) => {
          const pinFromV = getPinRawVoltageFromSpice(w.fromCompId, w.fromPinId, spiceResult);
          const pinToV = getPinRawVoltageFromSpice(w.toCompId, w.toPinId, spiceResult);
          const rawV = pinFromV ?? pinToV ?? spiceResult.wireVoltages.get(w.id) ?? 0;
          const i = spiceResult.wireCurrents.get(w.id) ?? 0;
          const dcOffset =
            getPinDcOffsetFromSpice(w.fromCompId, w.fromPinId, spiceResult) ||
            getPinDcOffsetFromSpice(w.toCompId, w.toPinId, spiceResult);
          const v = rawV - dcOffset;
          if (isOffMode) {
            return {
              ...w,
              state: {
                ...w.state,
                voltage: v,
                current: i,
                logicLevel: undefined,
                flowDirection: 0,
              },
            };
          }
          const vFrom = pinFromV ?? v;
          const vTo = pinToV ?? v;
          const fromComp = updatedComps.find((c) => c.id === w.fromCompId);
          const toComp = updatedComps.find((c) => c.id === w.toCompId);
          const flowDir = computeWireFlowDirection(
            w,
            fromComp,
            toComp,
            'ANALOG',
            vFrom,
            vTo,
            updatedWires,
            updatedComps
          );

          return {
            ...w,
            state: {
              ...w.state,
              voltage: v,
              current: i,
              logicLevel: undefined,
              flowDirection: flowDir,
            },
          };
        });

        updatedComps = updatedComps.map((c) => {
          const res = spiceResult.componentResults.get(c.id);
          if (!res) return c;
          const previouslyBurned = Boolean(c.state?.isBurned || c.state?.isOverloaded);
          const nowBurned = Boolean(res.isBurned || res.isOverloaded);
          const isBurned = previouslyBurned || nowBurned;
          const isOverloaded = previouslyBurned || nowBurned;
          const overloadReason = previouslyBurned
            ? c.state?.overloadReason || res.overloadReason
            : res.overloadReason;

          return {
            ...c,
            state: {
              ...c.state,
              voltageDropV: res.voltageDropV,
              branchCurrentA: res.currentA,
              powerW: res.powerW,
              isOverloaded,
              isBurned,
              overloadReason,
              lit:
                (res.brightness ?? 0) > 0.05 ||
                Boolean(res.redLit || res.yellowLit || res.greenLit || res.isEmitting),
              brightness: res.brightness ?? 0,
              isRunning: (res.rpm ?? 0) > 0 || (res.flowRateLpm ?? 0) > 0,
              rpm: res.rpm ?? 0,
              direction: res.direction ?? c.state?.direction,
              servoAngle: res.servoAngle ?? c.state?.servoAngle,
              sdActivity: res.sdActivity ?? c.state?.sdActivity,
              isSounding: res.isSounding ?? false,
              outputVoltage: res.outputVoltage,
              logicOutput: res.logicOutput,
              output: res.logicOutput,
              pinVoltages: res.pinVoltages,
              isEngaged: res.isEngaged ?? c.state?.isEngaged,
              redLit: res.redLit ?? c.state?.redLit,
              yellowLit: res.yellowLit ?? c.state?.yellowLit,
              greenLit: res.greenLit ?? c.state?.greenLit,
              flowRateLpm: res.flowRateLpm ?? c.state?.flowRateLpm,
              isTransmitting: res.isTransmitting ?? c.state?.isTransmitting,
              isReceiving: res.isReceiving ?? c.state?.isReceiving,
              isEmitting: res.isEmitting ?? c.state?.isEmitting,
              isReceivingIr: res.isReceivingIr ?? c.state?.isReceivingIr,
            },
          };
        });
      }

      // 3. Track and Latch Active Diagnostic Tips (Preserve Peak Ratings in ANALOG mode)
      const rawTips = runCircuitDiagnostics(
        updatedComps,
        updatedWires,
        simulationMode,
        get().simulationStatus === 'running'
      );
      const activeTips = simulationMode === 'LOGICAL'
        ? rawTips.filter((t) => t.severity !== 'critical' && !t.message.toLowerCase().includes('burnout') && !t.message.toLowerCase().includes('overload'))
        : rawTips;
      const nextLatched = { ...get().latchedDiagnostics };

      for (const tip of activeTips) {
        if (tip.severity === 'critical' || tip.severity === 'warning') {
          const existing = nextLatched[tip.id];
          let peakStr = existing?.peakValue;

          if (tip.componentId) {
            const comp = updatedComps.find((c) => c.id === tip.componentId);
            if (comp?.type.startsWith('led-')) {
              const currMa = comp.state?.branchCurrentA ? Math.round(comp.state.branchCurrentA * 1000) : 0;
              const prevMa = existing?.peakValue ? parseInt(existing.peakValue.replace(/[^0-9]/g, '')) || 0 : 0;
              const maxMa = Math.max(currMa, prevMa);
              if (maxMa > 0) {
                peakStr = `Peak: ${maxMa}mA (Max: 30mA)`;
              }
            } else if (comp?.type === 'resistor') {
              const pW = comp.state?.powerW ?? 0;
              const prevW = existing?.peakValue ? parseFloat(existing.peakValue.replace(/[^0-9.]/g, '')) || 0 : 0;
              const maxW = Math.max(pW, prevW);
              const maxP = comp.properties?.powerRating ?? 0.25;
              if (maxW > 0) {
                peakStr = `Peak: ${maxW.toFixed(2)}W (Max: ${maxP}W)`;
              }
            }
          }

          nextLatched[tip.id] = {
            ...tip,
            peakValue: peakStr || existing?.peakValue,
          };
        }
      }

      syncCircuitSound(updatedComps, get().simulationStatus === 'running', get().isSoundEnabled);

      set({
        simClockMs: nextClock,
        wires: updatedWires,
        components: updatedComps,
        latchedDiagnostics: nextLatched,
      });
    },
    stepSimulation: () => {
      get().runSimulationCycle(50);
    },
    resetSimulation: () => {
      stopAllSounds();
      clearScopeSampleBuffer();
      resetSpiceEngineState();
      resetWireFlowEngineState();
      resetCircuitFlowCache();
      resetDiagnosticsState();
      McuManager.getInstance().resetAll();
      const { wires, components } = get();
      const resetWires = wires.map((w) => ({
        ...w,
        state: { ...w.state, logicLevel: undefined, voltage: undefined, current: undefined },
      }));
      const resetComps = components.map((c) => ({
        ...c,
        state: {
          lit: false,
          brightness: 0,
          isRunning: false,
          angularVelocity: 0,
          isSounding: false,
          segments: undefined,
          isEngaged: false,
          isOverloaded: false,
          isBurned: false,
          overloadReason: undefined,
          powerW: 0,
          branchCurrentA: 0,
          voltageDropV: 0,
          rpm: 0,
          redLit: false,
          yellowLit: false,
          greenLit: false,
          flowRateLpm: 0,
          isTransmitting: false,
          isReceiving: false,
          isEmitting: false,
          isReceivingIr: false,
        },
      }));
      set({
        simulationStatus: 'stopped',
        simClockMs: 0,
        wires: resetWires,
        components: resetComps,
        latchedDiagnostics: {},
      });
    },
    dismissDiagnostic: (tipId: string) =>
      set((state) => {
        const next = { ...state.latchedDiagnostics };
        delete next[tipId];
        return { latchedDiagnostics: next };
      }),
    clearLatchedDiagnostics: () =>
      set({ latchedDiagnostics: {} }),
    toggleInteractiveComponent: (id: string) => {
      const { components } = get();
      const comp = components.find((c) => c.id === id);
      if (!comp) return;

      if (comp.type === 'pushbutton') {
        const isPressed = !comp.properties?.isPressed;
        get().updateComponentProperty(id, 'isPressed', isPressed);
      } else if (comp.type === 'toggle-switch') {
        const nextState = comp.properties?.state === 'T1' ? 'T2' : 'T1';
        get().updateComponentProperty(id, 'state', nextState);
      }
    },

    // UI Panels
    toggleInstrument: (instrument) => {
      if (instrument === 'multimeter') {
        set((state) => ({ showMultimeter: !state.showMultimeter }));
      } else if (instrument === 'oscilloscope') {
        set((state) => ({ showOscilloscope: !state.showOscilloscope }));
      } else if (instrument === 'logicAnalyzer') {
        set((state) => ({ showLogicAnalyzer: !state.showLogicAnalyzer }));
      } else if (instrument === 'smartTips') {
        set((state) => ({ showSmartTips: !state.showSmartTips }));
      }
    },

    // Virtual Bench Instruments Actions
    setMultimeterMode: (mode) =>
      set((state) => ({ multimeter: { ...state.multimeter, mode } })),

    toggleMultimeterHold: () =>
      set((state) => ({
        multimeter: { ...state.multimeter, isHold: !state.multimeter.isHold },
      })),

    resetMultimeterMinMax: () =>
      set((state) => ({
        multimeter: { ...state.multimeter, minVal: null, maxVal: null },
      })),

    attachProbe: (instrument, channelId, target) => {
      if (instrument === 'oscilloscope') {
        clearScopeSampleBuffer();
      }
      set((state) => {
        const resolvedTarget: ProbeTarget | null =
          target && target.type === 'wire' && target.wireId
            ? (() => {
                const matchedWire = state.wires.find((w) => w.id === target.wireId);
                return {
                  ...target,
                  compId: matchedWire?.fromCompId ?? target.compId,
                  pinId: matchedWire?.fromPinId ?? target.pinId,
                };
              })()
            : target;

        if (instrument === 'multimeter') {
          return {
            multimeter: {
              ...state.multimeter,
              [channelId === 'red' ? 'redProbe' : 'blackProbe']: resolvedTarget,
            },
            activeProbePicker: null,
          };
        } else if (instrument === 'oscilloscope') {
          const chKey = channelId as 'ch1' | 'ch2';
          return {
            oscilloscope: {
              ...state.oscilloscope,
              [chKey]: { ...state.oscilloscope[chKey], target: resolvedTarget },
            },
            activeProbePicker: null,
          };
        } else if (instrument === 'logicAnalyzer') {
          return {
            logicAnalyzer: {
              ...state.logicAnalyzer,
              channels: state.logicAnalyzer.channels.map((ch) =>
                ch.id === channelId ? { ...ch, target: resolvedTarget } : ch
              ),
            },
            activeProbePicker: null,
          };
        }
        return state;
      });
    },

    detachProbe: (instrument, channelId) => {
      get().attachProbe(instrument, channelId, null);
    },

    detachAllProbesAtTarget: (target) => {
      set((state) => {
        const isMatch = (t: ProbeTarget | null) =>
          !!(
            t &&
            ((target.type === 'pin' &&
              t.type === 'pin' &&
              t.compId === target.compId &&
              t.pinId === target.pinId) ||
              (target.type === 'wire' && t.type === 'wire' && t.wireId === target.wireId))
          );

        return {
          multimeter: {
            ...state.multimeter,
            redProbe: isMatch(state.multimeter.redProbe) ? null : state.multimeter.redProbe,
            blackProbe: isMatch(state.multimeter.blackProbe) ? null : state.multimeter.blackProbe,
          },
          oscilloscope: {
            ...state.oscilloscope,
            ch1: {
              ...state.oscilloscope.ch1,
              target: isMatch(state.oscilloscope.ch1.target) ? null : state.oscilloscope.ch1.target,
            },
            ch2: {
              ...state.oscilloscope.ch2,
              target: isMatch(state.oscilloscope.ch2.target) ? null : state.oscilloscope.ch2.target,
            },
          },
          logicAnalyzer: {
            ...state.logicAnalyzer,
            channels: state.logicAnalyzer.channels.map((ch) =>
              isMatch(ch.target) ? { ...ch, target: null } : ch
            ),
          },
        };
      });
    },

    setActiveProbePicker: (picker) => set({ activeProbePicker: picker }),

    setScopeChannelConfig: (channel, config) => {
      set((state) => ({
        oscilloscope: {
          ...state.oscilloscope,
          [channel]: { ...state.oscilloscope[channel], ...config },
        },
      }));
    },

    setScopeTimebase: (timebaseMsPerDiv) => {
      set((state) => ({
        oscilloscope: { ...state.oscilloscope, timebaseMsPerDiv },
      }));
    },

    setScopeTrigger: (trigger) => {
      set((state) => ({
        oscilloscope: {
          ...state.oscilloscope,
          trigger: { ...state.oscilloscope.trigger, ...trigger },
        },
      }));
    },

    toggleScopePaused: () => {
      set((state) => ({
        oscilloscope: {
          ...state.oscilloscope,
          isPaused: !state.oscilloscope.isPaused,
        },
      }));
    },

    setLogicChannelConfig: (channelId, config) => {
      set((state) => ({
        logicAnalyzer: {
          ...state.logicAnalyzer,
          channels: state.logicAnalyzer.channels.map((ch) =>
            ch.id === channelId ? { ...ch, ...config } : ch
          ),
        },
      }));
    },

    setLogicTimeScale: (scale) => {
      set((state) => ({
        logicAnalyzer: { ...state.logicAnalyzer, timeScaleMsPerDiv: scale },
      }));
    },

    toggleLogicPaused: () => {
      set((state) => ({
        logicAnalyzer: {
          ...state.logicAnalyzer,
          isPaused: !state.logicAnalyzer.isPaused,
        },
      }));
    },

    setLogicCursors: (t1, t2) => {
      set((state) => ({
        logicAnalyzer: { ...state.logicAnalyzer, cursorT1: t1, cursorT2: t2 },
      }));
    },

    // Microcontroller & Code Editor Actions
    openCodeEditor: (componentId?: string) => {
      const { components } = get();
      if (componentId) {
        set({ activeMcuId: componentId, isCodeEditorOpen: true });
        return;
      }
      const mcu = components.find(
        (c) =>
          c.type === 'arduino-uno' ||
          c.type === 'esp32' ||
          c.type === 'pico' ||
          c.type === 'builtin_cpu_8bit' ||
          c.type === 'cpu-8bit'
      );
      if (mcu) {
        set({ activeMcuId: mcu.id, isCodeEditorOpen: true });
      } else {
        set({ isCodeEditorOpen: true });
      }
    },
    closeCodeEditor: () => set({ isCodeEditorOpen: false }),
    setActiveMcuId: (id) => set({ activeMcuId: id }),
    updateMcuCode: (componentId, code) => {
      const { components } = get();
      const updated = components.map((c) =>
        c.id === componentId ? { ...c, properties: { ...c.properties, code } } : c
      );
      const targetComp = components.find((c) => c.id === componentId);
      const mcuType =
        targetComp?.type === 'esp32'
          ? 'esp32'
          : targetComp?.type === 'pico'
          ? 'pico'
          : targetComp?.type === 'builtin_cpu_8bit' || targetComp?.type === 'cpu-8bit'
          ? 'builtin_cpu_8bit'
          : 'arduino-uno';
      const ok = McuManager.getInstance().updateCode(componentId, code, mcuType);
      set({ components: updated });
      get().runSimulationCycle(0);
      return ok;
    },
    sendSerialInput: (componentId, text) => {
      McuManager.getInstance().sendSerialInput(componentId, text);
    },
    clearSerialLogs: (componentId) => {
      McuManager.getInstance().clearSerialLogs(componentId);
    },

    // File I/O
    newCircuit: () => {
      stopAllSounds();
      clearScopeSampleBuffer();
      resetSpiceEngineState();
      resetWireFlowEngineState();
      resetCircuitFlowCache();
      McuManager.getInstance().clear();
      const { components, wires, historyPast } = get();
      const newPast = saveHistorySnapshot(components, wires, historyPast);
      const newProjId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      set({
        simulationStatus: 'stopped',
        simClockMs: 0,
        currentProjectId: newProjId,
        currentProjectName: 'Untitled Circuit',
        components: [],
        wires: [],
        activeStimulusTool: 'none',
        selectedComponentId: null,
        selectedWireId: null,
        drawingWire: null,
        historyPast: newPast,
        historyFuture: [],
        canUndo: true,
        canRedo: false,
        autoSaveStatus: 'idle',
      });
    },

    loadCircuit: (data) => {
      stopAllSounds();
      clearScopeSampleBuffer();
      resetSpiceEngineState();
      resetWireFlowEngineState();
      resetCircuitFlowCache();
      McuManager.getInstance().clear();
      if (data.theme) {
        get().setTheme(data.theme);
      }
      const vp = data.canvasTransform || data.viewport || { zoom: 1.0, panX: 100, panY: 100 };
      const rawComps = data.components || [];
      const rawWires = data.wires || [];
      const wires = autoRouteAllWires(rawComps, rawWires);

      set({
        currentProjectName: data.name || 'Imported Circuit',
        components: rawComps,
        wires,
        activeStimulusTool: 'none',
        viewport: vp,
        selectedComponentId: null,
        selectedWireId: null,
        drawingWire: null,
        historyPast: [],
        historyFuture: [],
        canUndo: false,
        canRedo: false,
      });
    },

    exportCircuitJson: () => {
      const state = get();
      return {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        name: state.currentProjectName || 'circuit.secs',
        theme: state.theme,
        canvasTransform: state.viewport,
        viewport: state.viewport,
        components: state.components,
        wires: state.wires,
      };
    },

    loadSampleCircuit: () => {
      // Create a clean demo circuit: 9V Battery -> Toggle Switch -> 220Ω Resistor -> Red LED -> GND
      const c1: CircuitComponent = {
        id: 'comp_demo_dc',
        type: 'dc-source',
        label: 'V1 (9V)',
        x: 100,
        y: 200,
        rotation: 0,
        mirrored: false,
        properties: { voltage: 9, internalResistance: 0.1 },
      };
      const c2: CircuitComponent = {
        id: 'comp_demo_sw',
        type: 'toggle-switch',
        label: 'SW1',
        x: 260,
        y: 180,
        rotation: 0,
        mirrored: false,
        properties: { state: 'T1' },
      };
      const c3: CircuitComponent = {
        id: 'comp_demo_r',
        type: 'resistor',
        label: 'R1 (330Ω)',
        x: 420,
        y: 180,
        rotation: 0,
        mirrored: false,
        properties: { resistance: 330, tolerance: 5 },
      };
      const c4: CircuitComponent = {
        id: 'comp_demo_led',
        type: 'led-red',
        label: 'LED1',
        x: 580,
        y: 180,
        rotation: 0,
        mirrored: false,
        properties: { color: '#ef4444', forwardVoltage: 2.0, lit: true, brightness: 100 },
      };
      const c5: CircuitComponent = {
        id: 'comp_demo_gnd',
        type: 'gnd',
        label: 'GND',
        x: 580,
        y: 300,
        rotation: 0,
        mirrored: false,
        properties: {},
      };

      const w1: CircuitWire = {
        id: 'w_demo_1',
        fromCompId: 'comp_demo_dc',
        fromPinId: 'pos',
        toCompId: 'comp_demo_sw',
        toPinId: 'com',
        waypoints: [],
        color: '#ef4444',
      };
      const w2: CircuitWire = {
        id: 'w_demo_2',
        fromCompId: 'comp_demo_sw',
        fromPinId: 't1',
        toCompId: 'comp_demo_r',
        toPinId: 'p1',
        waypoints: [],
        color: '#f97316',
      };
      const w3: CircuitWire = {
        id: 'w_demo_3',
        fromCompId: 'comp_demo_r',
        fromPinId: 'p2',
        toCompId: 'comp_demo_led',
        toPinId: 'anode',
        waypoints: [],
        color: '#eab308',
      };
      const w4: CircuitWire = {
        id: 'w_demo_4',
        fromCompId: 'comp_demo_led',
        fromPinId: 'cathode',
        toCompId: 'comp_demo_gnd',
        toPinId: 'gnd',
        waypoints: [],
        color: '#22c55e',
      };
      const w5: CircuitWire = {
        id: 'w_demo_5',
        fromCompId: 'comp_demo_dc',
        fromPinId: 'neg',
        toCompId: 'comp_demo_gnd',
        toPinId: 'gnd',
        waypoints: [
          { x: 100, y: 340 },
          { x: 600, y: 340 },
        ],
        color: '#0f172a',
      };

      set({
        components: [c1, c2, c3, c4, c5],
        wires: [w1, w2, w3, w4, w5],
        selectedComponentId: null,
        selectedWireId: null,
        historyPast: [],
        historyFuture: [],
        canUndo: false,
        canRedo: false,
      });
    },

    // Undo / Redo
    undo: () => {
      const { historyPast, historyFuture, components, wires } = get();
      if (historyPast.length === 0) return;

      const previous = historyPast[historyPast.length - 1];
      const newPast = historyPast.slice(0, historyPast.length - 1);
      const newFuture = [
        { components: JSON.parse(JSON.stringify(components)), wires: JSON.parse(JSON.stringify(wires)) },
        ...historyFuture,
      ];

      set({
        components: previous.components,
        wires: previous.wires,
        selectedComponentId: null,
        selectedWireId: null,
        historyPast: newPast,
        historyFuture: newFuture,
        canUndo: newPast.length > 0,
        canRedo: true,
      });
    },

    redo: () => {
      const { historyPast, historyFuture, components, wires } = get();
      if (historyFuture.length === 0) return;

      const next = historyFuture[0];
      const newFuture = historyFuture.slice(1);
      const newPast = [
        ...historyPast,
        { components: JSON.parse(JSON.stringify(components)), wires: JSON.parse(JSON.stringify(wires)) },
      ];

      set({
        components: next.components,
        wires: next.wires,
        selectedComponentId: null,
        selectedWireId: null,
        historyPast: newPast,
        historyFuture: newFuture,
        canUndo: true,
        canRedo: newFuture.length > 0,
      });
    },
  };
});
