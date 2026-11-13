import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Maximize2, X, Target } from 'lucide-react';
import { CircuitComponent, CircuitWire } from '../../types/circuit';
import { useCircuitStore } from '../../store/useCircuitStore';
import { COMPONENT_DEFINITIONS } from '../../constants/componentLibrary';
import { ComponentRegistry } from '../../registry/ComponentRegistry';
import { ComponentGraphic } from '../circuit-components/ComponentGraphic';
import { SchematicTextBox } from '../circuit-components/SchematicTextBox';
import { SchematicShape } from '../circuit-components/SchematicShape';
import { SensorContextHUD } from '../simulation/SensorContextHUD';
import { PinTerminal } from './PinTerminal';
import {
  getComponentCenter,
  getPinAbsolutePosition,
  getRotatedBoundingBox,
  getComponentValueString,
  snapPointToGrid,
  snapToGrid,
} from '../../utils/geometry';
import {
  computeWirePoints,
  extractInteriorWaypoints,
  getWireSegments,
  moveCornerWaypoint,
  moveWireSegment,
  pointsToSvgPath,
  Point,
} from '../../utils/orthogonalRouter';
import {
  computeLogicalWireFlow,
  computeAnalogWireFlow,
  computeEnergizedPins,
  computeFlowDirectionField,
  WireFlowVisualResult,
} from '../../simulation/wireFlowEngine';

interface DraggingSegmentState {
  wireId: string;
  segmentIndex: number;
  initialPoints: Point[];
}

interface DraggingWaypointState {
  wireId: string;
  waypointIndex: number; // Index in fullPoints
  initialPoints: Point[];
}

export const CircuitCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    theme,
    viewport,
    setViewport,
    zoomIn,
    zoomOut,
    zoomToFit,
    components,
    wires,
    selectedComponentId,
    selectedComponentIds,
    highlightedComponentId,
    selectedWireId,
    selectComponent,
    selectComponents,
    selectWire,
    addComponent,
    addTextBox,
    updateComponentPos,
    rotateComponent,
    rotateSelectedComponents,
    flipComponentHorizontal,
    deleteSelected,
    selectAll,
    copySelected,
    pasteSelected,
    drawingWire,
    startDrawingWire,
    updateDrawingWirePos,
    addWireWaypoint,
    completeDrawingWire,
    cancelDrawingWire,
    updateWireWaypoints,
    undo,
    redo,
    toggleInteractiveComponent,
    simulationStatus,
    simulationMode,
    commitComponentMove,
    updateComponentProperty,
    activeStimulusTool,
    stimulusIntensity,
    setStimulusTool,
    runSimulationCycle,
    multimeter,
    oscilloscope,
    logicAnalyzer,
    activeProbePicker,
    setActiveProbePicker,
    attachProbe,
    detachProbe,
    toggleInstrument,
    showMultimeter,
    showOscilloscope,
    showLogicAnalyzer,
  } = useCircuitStore();

  const isDark = theme === 'dark';

  // Stimulus Tool Follower Cursor State
  const [cursorScreenPos, setCursorScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [cursorWorldPos, setCursorWorldPos] = useState<{ x: number; y: number } | null>(null);
  const prevCursorWorldRef = useRef<{ x: number; y: number } | null>(null);
  const motionHoldTimersRef = useRef<Map<string, any>>(new Map());

  // Interaction States
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);

  // Marquee Multi-Selection Box State
  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isShift: boolean;
  } | null>(null);

  // Multi-Selection Group Dragging State
  const [groupDragInitials, setGroupDragInitials] = useState<Map<string, { x: number; y: number }> | null>(null);
  const [groupDragStartWorld, setGroupDragStartWorld] = useState<{ x: number; y: number } | null>(null);

  // Live SPICE Hover Probe Target Reference State
  const [hoverProbeTarget, setHoverProbeTarget] = useState<{
    type: 'wire' | 'component';
    id: string;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Component Dragging
  const [draggingCompId, setDraggingCompId] = useState<string | null>(null);
  const [compDragOffset, setCompDragOffset] = useState({ x: 0, y: 0 });

  // Wire Hover State
  const [hoveredWireId, setHoveredWireId] = useState<string | null>(null);

  // Wire Segment Dragging State
  const [draggingSegment, setDraggingSegment] = useState<DraggingSegmentState | null>(null);

  // Wire Waypoint Dragging State
  const [draggingWaypoint, setDraggingWaypoint] = useState<DraggingWaypointState | null>(null);

  // Right-Click Context Menu HUD Target State
  const [contextMenuTarget, setContextMenuTarget] = useState<{
    componentId: string;
    screenPos: { x: number; y: number };
  } | null>(null);

  // Component Click vs Drag Tracker
  const [compMouseDown, setCompMouseDown] = useState<{
    id: string;
    clientX: number;
    clientY: number;
  } | null>(null);
  const preDragPositionsRef = useRef<Map<string, { x: number; y: number }> | null>(null);
  const preDragSnapshotRef = useRef<{ components: CircuitComponent[]; wires: CircuitWire[] } | null>(null);

  const activeContextComponent = contextMenuTarget
    ? components.find((c) => c.id === contextMenuTarget.componentId) || null
    : null;

  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = (clientX - rect.left - viewport.panX) / viewport.zoom;
      const rawY = (clientY - rect.top - viewport.panY) / viewport.zoom;
      return { x: rawX, y: rawY };
    },
    [viewport]
  );

  // Active Virtual Bench Instrument Probe Badges
  const probeBadges = useMemo(() => {
    const list: Array<{
      id: string;
      instrument: 'multimeter' | 'oscilloscope' | 'logicAnalyzer';
      channelId: string;
      label: string;
      color: string;
      x: number;
      y: number;
    }> = [];

    const resolvePos = (target: any): { x: number; y: number } | null => {
      if (!target) return null;
      if (target.type === 'pin' && target.compId && target.pinId) {
        const comp = components.find((c) => c.id === target.compId);
        if (!comp) return null;
        const def = COMPONENT_DEFINITIONS[comp.type];
        if (!def) return null;
        return getPinAbsolutePosition(comp, target.pinId, def);
      }
      if (target.type === 'wire' && target.wireId) {
        const wire = wires.find((w) => w.id === target.wireId);
        if (!wire) return null;
        const fromComp = components.find((c) => c.id === wire.fromCompId);
        const toComp = components.find((c) => c.id === wire.toCompId);
        if (!fromComp || !toComp) return null;
        const fromDef = COMPONENT_DEFINITIONS[fromComp.type];
        const toDef = COMPONENT_DEFINITIONS[toComp.type];
        if (!fromDef || !toDef) return null;
        const p1 = getPinAbsolutePosition(fromComp, wire.fromPinId, fromDef);
        const p2 = getPinAbsolutePosition(toComp, wire.toPinId, toDef);
        const pts = computeWirePoints(p1, p2, wire.waypoints);
        if (pts.length >= 2) {
          const midIdx = Math.floor(pts.length / 2);
          const ptA = pts[midIdx - 1];
          const ptB = pts[midIdx];
          return { x: Math.round((ptA.x + ptB.x) / 2), y: Math.round((ptA.y + ptB.y) / 2) };
        }
        return { x: Math.round((p1.x + p2.x) / 2), y: Math.round((p1.y + p2.y) / 2) };
      }
      return null;
    };

    if (multimeter.redProbe) {
      const pos = resolvePos(multimeter.redProbe);
      if (pos) {
        list.push({
          id: 'dmm_red',
          instrument: 'multimeter',
          channelId: 'red',
          label: 'V+',
          color: '#ef4444',
          x: pos.x,
          y: pos.y,
        });
      }
    }
    if (multimeter.blackProbe) {
      const pos = resolvePos(multimeter.blackProbe);
      if (pos) {
        list.push({
          id: 'dmm_black',
          instrument: 'multimeter',
          channelId: 'black',
          label: 'COM',
          color: '#64748b',
          x: pos.x,
          y: pos.y,
        });
      }
    }

    if (oscilloscope.ch1.enabled && oscilloscope.ch1.target) {
      const pos = resolvePos(oscilloscope.ch1.target);
      if (pos) {
        list.push({
          id: 'scope_ch1',
          instrument: 'oscilloscope',
          channelId: 'ch1',
          label: 'CH1',
          color: '#facc15',
          x: pos.x,
          y: pos.y,
        });
      }
    }
    if (oscilloscope.ch2.enabled && oscilloscope.ch2.target) {
      const pos = resolvePos(oscilloscope.ch2.target);
      if (pos) {
        list.push({
          id: 'scope_ch2',
          instrument: 'oscilloscope',
          channelId: 'ch2',
          label: 'CH2',
          color: '#38bdf8',
          x: pos.x,
          y: pos.y,
        });
      }
    }

    logicAnalyzer.channels.forEach((ch) => {
      if (ch.enabled && ch.target) {
        const pos = resolvePos(ch.target);
        if (pos) {
          list.push({
            id: `la_${ch.id}`,
            instrument: 'logicAnalyzer',
            channelId: ch.id,
            label: ch.id,
            color: ch.color,
            x: pos.x,
            y: pos.y,
          });
        }
      }
    });

    return list;
  }, [multimeter, oscilloscope, logicAnalyzer, components, wires]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable ||
        target?.closest?.('input, textarea, select, [contenteditable="true"], .monaco-editor')
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        selectAll();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        copySelected();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        pasteSelected();
        return;
      }

      if (e.code === 'Space' && !spacePressed) {
        setSpacePressed(true);
      }

      if (e.key === 'r' || e.key === 'R') {
        if (selectedComponentIds && selectedComponentIds.length > 0) {
          rotateSelectedComponents(90);
        } else if (selectedComponentId) {
          rotateComponent(selectedComponentId, 90);
        }
      }

      if (e.key === 't' || e.key === 'T') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          addTextBox();
        }
      }

      if (e.key === 'f' || e.key === 'F') {
        if (selectedComponentId) {
          flipComponentHorizontal(selectedComponentId);
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      }

      if (e.key === 'Escape') {
        if (activeProbePicker) {
          setActiveProbePicker(null);
          return;
        }
        cancelDrawingWire();
        selectComponent(null);
        selectWire(null);
        if (activeStimulusTool !== 'none') {
          setStimulusTool('none');
        }
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        redo();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    spacePressed,
    selectedComponentId,
    rotateComponent,
    flipComponentHorizontal,
    deleteSelected,
    selectAll,
    copySelected,
    pasteSelected,
    cancelDrawingWire,
    selectComponent,
    selectWire,
    undo,
    redo,
  ]);

  // Handle Mouse Wheel Zoom centered on cursor
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newZoom = Math.min(4.0, Math.max(0.25, +(viewport.zoom * zoomFactor).toFixed(2)));

    const newPanX = cursorX - (cursorX - viewport.panX) * (newZoom / viewport.zoom);
    const newPanY = cursorY - (cursorY - viewport.panY) * (newZoom / viewport.zoom);

    setViewport({ zoom: newZoom, panX: Math.round(newPanX), panY: Math.round(newPanY) });
  };

  // Canvas Pan & Selection Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (contextMenuTarget) {
      setContextMenuTarget(null);
    }

    // Panning with Middle-click (1), Right-click on empty canvas (2), or Space + Left-click (0)
    if (e.button === 1 || e.button === 2 || (e.button === 0 && spacePressed)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.panX, y: e.clientY - viewport.panY });
      return;
    }

    if (e.button === 0) {
      if (activeStimulusTool !== 'none') {
        // Stimulus tool active
        return;
      }
      if (drawingWire) {
        const world = screenToWorld(e.clientX, e.clientY);
        const isHalfGrid = drawingWire.startPos.x % 20 !== 0 || drawingWire.startPos.y % 20 !== 0;
        const snapStep = isHalfGrid ? 10 : 20;
        const snapped = snapPointToGrid(world.x, world.y, snapStep);
        addWireWaypoint(snapped);
      } else {
        // Start Marquee Selection Box
        const world = screenToWorld(e.clientX, e.clientY);
        setMarquee({
          startX: world.x,
          startY: world.y,
          currentX: world.x,
          currentY: world.y,
          isShift: e.shiftKey,
        });
        if (!e.shiftKey) {
          selectComponent(null);
          selectWire(null);
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setViewport({
        panX: e.clientX - panStart.x,
        panY: e.clientY - panStart.y,
      });
      return;
    }

    const world = screenToWorld(e.clientX, e.clientY);

    // Active stimulus tool tracking and live physics updates
    if (activeStimulusTool !== 'none') {
      setCursorScreenPos({ x: e.clientX, y: e.clientY });
      setCursorWorldPos(world);

      if (activeStimulusTool === 'lightbulb') {
        let changed = false;
        for (const comp of components) {
          if (comp.type === 'light-sensor' || comp.type === 'builtin_solar_panel') {
            const cx = comp.x + 40;
            const cy = comp.type === 'builtin_solar_panel' ? comp.y + 40 : comp.y + 20;
            const dist = Math.hypot(world.x - cx, world.y - cy);
            const intensity = stimulusIntensity || 1000;
            const lux = Math.round(20 + Math.max(0, intensity - 20) * Math.pow(Math.max(0, 1 - dist / 320), 2));
            if (comp.properties.lux !== lux) {
              updateComponentProperty(comp.id, 'lux', lux);
              changed = true;
            }
          }
        }
        if (changed) runSimulationCycle(0);
      } else if (activeStimulusTool === 'matchstick') {
        let changed = false;
        for (const comp of components) {
          if (comp.type === 'temp-sensor') {
            const cx = comp.x + 40;
            const cy = comp.y + 20;
            const dist = Math.hypot(world.x - cx, world.y - cy);
            const flameTemp = stimulusIntensity || 125;
            const temp = Math.round(25 + (flameTemp - 25) * Math.pow(Math.max(0, 1 - dist / 280), 2));
            if (comp.properties.temperatureC !== temp) {
              updateComponentProperty(comp.id, 'temperatureC', temp);
              changed = true;
            }
          }
        }
        if (changed) runSimulationCycle(0);
      } else if (activeStimulusTool === 'ice') {
        let changed = false;
        for (const comp of components) {
          if (comp.type === 'temp-sensor') {
            const cx = comp.x + 40;
            const cy = comp.y + 20;
            const dist = Math.hypot(world.x - cx, world.y - cy);
            const iceTemp = stimulusIntensity !== undefined ? stimulusIntensity : -20;
            const temp = Math.round(25 - (25 - iceTemp) * Math.pow(Math.max(0, 1 - dist / 280), 2));
            if (comp.properties.temperatureC !== temp) {
              updateComponentProperty(comp.id, 'temperatureC', temp);
              changed = true;
            }
          }
        }
        if (changed) runSimulationCycle(0);
      } else if (activeStimulusTool === 'ultrasonic_target') {
        let changed = false;
        for (const comp of components) {
          if (comp.type === 'ultrasonic') {
            const cx = comp.x + 50;
            const cy = comp.y + 30;
            const dist = Math.hypot(world.x - cx, world.y - cy);
            const d_cm = Math.max(2, Math.min(400, Math.round(dist / 2.5)));
            if (comp.properties.distanceCm !== d_cm) {
              updateComponentProperty(comp.id, 'distanceCm', d_cm);
              changed = true;
            }
          }
        }
        if (changed) runSimulationCycle(0);
      } else if (activeStimulusTool === 'water_mister' || activeStimulusTool === 'dry_air') {
        let changed = false;
        for (const comp of components) {
          if (comp.type === 'builtin_humidity_sensor' || comp.type === 'humidity-sensor') {
            const cx = comp.x + 40;
            const cy = comp.y + 40;
            const dist = Math.hypot(world.x - cx, world.y - cy);
            const factor = Math.pow(Math.max(0, 1 - dist / 280), 2);
            const humidity =
              activeStimulusTool === 'water_mister'
                ? Math.min(100, Math.round(45 + 55 * factor))
                : Math.max(5, Math.round(45 - 40 * factor));
            if (comp.properties.humidity !== humidity) {
              updateComponentProperty(comp.id, 'humidity', humidity);
              changed = true;
            }
          }
        }
        if (changed) runSimulationCycle(0);
      } else if (activeStimulusTool === 'motion_target') {
        let changed = false;
        for (const comp of components) {
          if (comp.type === 'builtin_motion_sensor' || comp.type === 'motion-sensor') {
            const cx = comp.x + 40;
            const cy = comp.y + 40;
            const dist = Math.hypot(world.x - cx, world.y - cy);
            const inRange = dist <= 250;
            if (inRange) {
              if (!comp.properties.motionDetected) {
                updateComponentProperty(comp.id, 'motionDetected', true);
                changed = true;
              }
              const prevTimer = motionHoldTimersRef.current.get(comp.id);
              if (prevTimer) clearTimeout(prevTimer);
              const holdMs = typeof comp.properties.holdTimeMs === 'number' ? comp.properties.holdTimeMs : 1500;
              const timer = setTimeout(() => {
                updateComponentProperty(comp.id, 'motionDetected', false);
                motionHoldTimersRef.current.delete(comp.id);
              }, holdMs);
              motionHoldTimersRef.current.set(comp.id, timer);
            }
          }
        }
        if (changed) runSimulationCycle(0);
      } else if (activeStimulusTool === 'smoke_plume') {
        let changed = false;
        for (const comp of components) {
          if (comp.type === 'builtin_gas_sensor' || comp.type === 'gas-sensor') {
            const cx = comp.x + 40;
            const cy = comp.y + 40;
            const dist = Math.hypot(world.x - cx, world.y - cy);
            const factor = Math.pow(Math.max(0, 1 - dist / 280), 2);
            const ppm = Math.min(2000, Math.round(50 + 1950 * factor));
            if (comp.properties.ppm !== ppm) {
              updateComponentProperty(comp.id, 'ppm', ppm);
              changed = true;
            }
          }
        }
        if (changed) runSimulationCycle(0);
      } else if (activeStimulusTool === 'tilt_manipulator') {
        const prevW = prevCursorWorldRef.current || world;
        const speed = Math.hypot(world.x - prevW.x, world.y - prevW.y);
        prevCursorWorldRef.current = world;
        let changed = false;
        for (const comp of components) {
          if (comp.type === 'builtin_accelerometer' || comp.type === 'accelerometer') {
            const cx = comp.x + 60;
            const cy = comp.y + 40;
            const ax = +Math.max(-3.0, Math.min(3.0, (world.x - cx) / 50)).toFixed(2);
            const ay = +Math.max(-3.0, Math.min(3.0, (world.y - cy) / 50)).toFixed(2);
            const shakeZ = speed > 4 ? Math.sin(Date.now() / 35) * Math.min(2.0, speed / 12) : 0;
            const az = +Math.max(-3.0, Math.min(3.0, 1.0 + shakeZ)).toFixed(2);
            if (
              comp.properties.accelX !== ax ||
              comp.properties.accelY !== ay ||
              comp.properties.accelZ !== az
            ) {
              updateComponentProperty(comp.id, 'accelX', ax);
              updateComponentProperty(comp.id, 'accelY', ay);
              updateComponentProperty(comp.id, 'accelZ', az);
              changed = true;
            }
          }
        }
        if (changed) runSimulationCycle(0);
      } else if (activeStimulusTool === 'watering_can') {
        let changed = false;
        for (const comp of components) {
          if (comp.type === 'builtin_soil_moisture') {
            const cx = comp.x + 40;
            const cy = comp.y + 60;
            const dist = Math.hypot(world.x - cx, world.y - cy);
            const factor = Math.pow(Math.max(0, 1 - dist / 280), 2);
            const moisture = Math.min(100, Math.round(20 + 80 * factor));
            if (comp.properties.moisture !== moisture) {
              updateComponentProperty(comp.id, 'moisture', moisture);
              changed = true;
            }
          }
        }
        if (changed) runSimulationCycle(0);
      } else if (activeStimulusTool === 'ir_remote') {
        let changed = false;
        for (const comp of components) {
          if (comp.type === 'builtin_ir_rx') {
            const cx = comp.x + 40;
            const cy = comp.y + 40;
            const dist = Math.hypot(world.x - cx, world.y - cy);
            const irDetected = dist <= 300;
            if (Boolean(comp.properties.irDetected) !== irDetected) {
              updateComponentProperty(comp.id, 'irDetected', irDetected);
              changed = true;
            }
          }
        }
        if (changed) runSimulationCycle(0);
      } else if (activeStimulusTool === 'bar_magnet') {
        let changed = false;
        for (const comp of components) {
          if (comp.type === 'builtin_hall_sensor') {
            const cx = comp.x + 40;
            const cy = comp.y + 40;
            const dist = Math.hypot(world.x - cx, world.y - cy);
            const factor = Math.pow(Math.max(0, 1 - dist / 260), 2);
            const mag = Math.min(100, Math.round(100 * factor));
            if (comp.properties.magneticField !== mag) {
              updateComponentProperty(comp.id, 'magneticField', mag);
              changed = true;
            }
          }
        }
        if (changed) runSimulationCycle(0);
      } else if (activeStimulusTool === 'hammer_tap') {
        let changed = false;
        for (const comp of components) {
          if (comp.type === 'builtin_vibration_sensor') {
            const cx = comp.x + 40;
            const cy = comp.y + 40;
            const dist = Math.hypot(world.x - cx, world.y - cy);
            if (dist <= 130) {
              if (!comp.properties.vibrationDetected) {
                updateComponentProperty(comp.id, 'vibrationDetected', true);
                changed = true;
              }
              const prevTimer = motionHoldTimersRef.current.get(comp.id);
              if (prevTimer) clearTimeout(prevTimer);
              const timer = setTimeout(() => {
                updateComponentProperty(comp.id, 'vibrationDetected', false);
                motionHoldTimersRef.current.delete(comp.id);
              }, 1000);
              motionHoldTimersRef.current.set(comp.id, timer);
            }
          }
        }
        if (changed) runSimulationCycle(0);
      }
    }

    // Update drawing wire live preview
    if (drawingWire) {
      const isHalfGrid = drawingWire.startPos.x % 20 !== 0 || drawingWire.startPos.y % 20 !== 0;
      const snapStep = isHalfGrid ? 10 : 20;
      const snapped = snapPointToGrid(world.x, world.y, snapStep);
      updateDrawingWirePos(snapped);
      return;
    }

    // Marquee Dragging
    if (marquee) {
      setMarquee((prev) => (prev ? { ...prev, currentX: world.x, currentY: world.y } : null));
      return;
    }

    // Multi-Component Group Dragging
    if (draggingCompId && groupDragInitials && groupDragStartWorld) {
      const deltaX = snapToGrid(world.x - groupDragStartWorld.x);
      const deltaY = snapToGrid(world.y - groupDragStartWorld.y);
      groupDragInitials.forEach((initPos, id) => {
        updateComponentPos(id, snapToGrid(initPos.x + deltaX), snapToGrid(initPos.y + deltaY));
      });
      return;
    }

    // Fallback single component dragging
    if (draggingCompId) {
      const newX = snapToGrid(world.x - compDragOffset.x);
      const newY = snapToGrid(world.y - compDragOffset.y);
      updateComponentPos(draggingCompId, newX, newY);
      return;
    }

    // Dragging wire segment
    if (draggingSegment) {
      const wire = wires.find((w) => w.id === draggingSegment.wireId);
      if (!wire) return;

      const fromComp = components.find((c) => c.id === wire.fromCompId);
      const toComp = components.find((c) => c.id === wire.toCompId);
      if (!fromComp || !toComp) return;

      const fromDef = COMPONENT_DEFINITIONS[fromComp.type];
      const toDef = COMPONENT_DEFINITIONS[toComp.type];
      if (!fromDef || !toDef) return;

      const seg = getWireSegments(draggingSegment.initialPoints)[draggingSegment.segmentIndex];
      if (!seg) return;

      const newCoord = seg.isHorizontal ? world.y : world.x;
      const newFullPoints = moveWireSegment(
        draggingSegment.initialPoints,
        draggingSegment.segmentIndex,
        newCoord
      );
      const interiorWaypoints = extractInteriorWaypoints(newFullPoints);
      updateWireWaypoints(draggingSegment.wireId, interiorWaypoints);
      return;
    }

    // Dragging wire waypoint
    if (draggingWaypoint) {
      const wire = wires.find((w) => w.id === draggingWaypoint.wireId);
      if (!wire) return;

      const newFullPoints = moveCornerWaypoint(
        draggingWaypoint.initialPoints,
        draggingWaypoint.waypointIndex,
        world
      );
      const interiorWaypoints = extractInteriorWaypoints(newFullPoints);
      updateWireWaypoints(draggingWaypoint.wireId, interiorWaypoints);
      return;
    }
  };

  const handleMouseUp = () => {
    if (isPanning) setIsPanning(false);

    // Finalize Marquee Selection Box
    if (marquee) {
      const minX = Math.min(marquee.startX, marquee.currentX);
      const maxX = Math.max(marquee.startX, marquee.currentX);
      const minY = Math.min(marquee.startY, marquee.currentY);
      const maxY = Math.max(marquee.startY, marquee.currentY);

      if (maxX - minX > 5 || maxY - minY > 5) {
        const found: string[] = [];
        for (const comp of components) {
          const def = COMPONENT_DEFINITIONS[comp.type];
          const width = def ? def.width : 60;
          const height = def ? def.height : 60;
          const bbox = getRotatedBoundingBox(width, height, comp.rotation || 0);
          const cMinX = comp.x + bbox.minX;
          const cMaxX = comp.x + bbox.maxX;
          const cMinY = comp.y + bbox.minY;
          const cMaxY = comp.y + bbox.maxY;

          const intersects = !(cMaxX < minX || cMinX > maxX || cMaxY < minY || cMinY > maxY);
          if (intersects) {
            found.push(comp.id);
          }
        }

        if (marquee.isShift) {
          const combined = Array.from(new Set([...selectedComponentIds, ...found]));
          selectComponents(combined);
        } else {
          selectComponents(found);
        }
      }
      setMarquee(null);
    }

    if (draggingCompId) {
      let didMove = false;
      if (preDragPositionsRef.current) {
        for (const comp of components) {
          const initial = preDragPositionsRef.current.get(comp.id);
          if (initial && (initial.x !== comp.x || initial.y !== comp.y)) {
            didMove = true;
            break;
          }
        }
      }
      if (didMove && preDragSnapshotRef.current) {
        commitComponentMove(preDragSnapshotRef.current);
      }
      setDraggingCompId(null);
      setGroupDragInitials(null);
      setGroupDragStartWorld(null);
      preDragPositionsRef.current = null;
      preDragSnapshotRef.current = null;
    }
    if (draggingSegment) setDraggingSegment(null);
    if (draggingWaypoint) setDraggingWaypoint(null);
  };

  // Window-level mouse listeners so fast mouse moves outside canvas bounds don't break dragging or panning
  useEffect(() => {
    if (!draggingCompId && !isPanning && !marquee && !draggingSegment && !draggingWaypoint) return;

    const onWindowMouseMove = (e: MouseEvent) => {
      handleMouseMove(e as unknown as React.MouseEvent);
    };

    const onWindowMouseUp = () => {
      handleMouseUp();
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  });

  // Drag & Drop from Library Sidebar
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const type =
      e.dataTransfer.getData('application/secs-component') ||
      e.dataTransfer.getData('text/plain') ||
      e.dataTransfer.getData('text');
    if (!type) return;
    const def = ComponentRegistry.get(type) || COMPONENT_DEFINITIONS[type];
    if (!def) return;

    const world = screenToWorld(e.clientX, e.clientY);
    const x = snapToGrid(world.x - (def.width || 60) / 2);
    const y = snapToGrid(world.y - (def.height || 60) / 2);

    addComponent(type, x, y);
    try {
      e.dataTransfer.clearData();
    } catch {
      // ignore
    }
  };

  // Pin Click Handler for Wire Connection & Probe Attachment
  const handlePinClick = (compId: string, pinId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Attach Instrument Probe Mode
    if (activeProbePicker) {
      const comp = components.find((c) => c.id === compId);
      const label = `${comp?.label || compId}:${pinId}`;
      attachProbe(activeProbePicker.instrument, activeProbePicker.channelId, {
        type: 'pin',
        compId,
        pinId,
        label,
      });
      return;
    }

    const comp = components.find((c) => c.id === compId);
    if (!comp) return;
    const def = COMPONENT_DEFINITIONS[comp.type];
    if (!def) return;

    const pinPos = getPinAbsolutePosition(comp, pinId, def);

    if (!drawingWire) {
      startDrawingWire(compId, pinId, pinPos);
    } else {
      completeDrawingWire(compId, pinId);
    }
  };

  // Wire Drawing Preview
  const renderDrawingWirePreview = () => {
    if (!drawingWire) return null;

    const points = computeWirePoints(
      drawingWire.startPos,
      drawingWire.currentPos,
      drawingWire.waypoints
    );
    const pathD = pointsToSvgPath(points, 4);

    return (
      <g className="pointer-events-none">
        <path
          d={pathD}
          fill="none"
          stroke={drawingWire.color}
          strokeWidth="2.5"
          strokeDasharray="5 3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="active-pulse"
        />
        {drawingWire.waypoints.map((wp, idx) => (
          <circle key={idx} cx={wp.x} cy={wp.y} r="3" fill={drawingWire.color} />
        ))}
      </g>
    );
  };

  // Render Placed Wires with Interactive Segments & Waypoints
  const renderAnnotationItem = (component: CircuitComponent) => {
    const isSelected =
      selectedComponentIds.includes(component.id) || selectedComponentId === component.id;
    const isHighlighted = highlightedComponentId === component.id;
    const boxW =
      component.type === 'shape'
        ? Math.max(40, Number(component.properties?.width) || 200)
        : component.properties?.boxWidth || component.properties?.width || 160;
    const boxH =
      component.type === 'shape'
        ? Math.max(40, Number(component.properties?.height) || 140)
        : component.properties?.boxHeight || component.properties?.height || 80;

    return (
      <g
        key={component.id}
        onDragStart={(e) => e.preventDefault()}
        transform={`translate(${component.x}, ${component.y})`}
        className="cursor-move"
        onMouseDown={(e) => {
          e.stopPropagation();
          if (contextMenuTarget) setContextMenuTarget(null);
          if (e.button === 0) {
            e.preventDefault();
            preDragPositionsRef.current = new Map(components.map((c) => [c.id, { x: c.x, y: c.y }]));
            preDragSnapshotRef.current = {
              components: JSON.parse(JSON.stringify(components)),
              wires: JSON.parse(JSON.stringify(wires)),
            };
            const isShift = e.shiftKey;
            const isAlreadySelected = selectedComponentIds.includes(component.id);

            if (isShift) {
              selectComponent(component.id, true);
            } else if (!isAlreadySelected) {
              selectComponent(component.id, false);
            }

            const world = screenToWorld(e.clientX, e.clientY);
            const targetIds = isShift
              ? isAlreadySelected
                ? selectedComponentIds.filter((id) => id !== component.id)
                : [...selectedComponentIds, component.id]
              : isAlreadySelected
              ? selectedComponentIds
              : [component.id];

            const initMap = new Map<string, { x: number; y: number }>();
            components.forEach((c) => {
              if (targetIds.includes(c.id)) {
                initMap.set(c.id, { x: c.x, y: c.y });
              }
            });

            setGroupDragInitials(initMap);
            setGroupDragStartWorld(world);
            setDraggingCompId(component.id);
            setCompDragOffset({
              x: world.x - component.x,
              y: world.y - component.y,
            });
          }
        }}
      >
        {isHighlighted && (
          <rect
            x="-6"
            y="-6"
            width={boxW + 12}
            height={boxH + 12}
            rx="6"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            className="animate-pulse"
            filter="drop-shadow(0 0 8px #38bdf8)"
          />
        )}
        {component.type === 'shape' ? (
          <SchematicShape
            component={component}
            isSelected={isSelected}
            theme={theme}
            zoom={viewport.zoom}
          />
        ) : (
          <SchematicTextBox
            component={component}
            isSelected={isSelected}
            theme={theme}
            zoom={viewport.zoom}
          />
        )}
      </g>
    );
  };

  const renderWires = () => {
    const isSimRunning = simulationStatus === 'running';
    const isOffMode = simulationMode === 'OFF';
    const isLogicalMode = simulationMode === 'LOGICAL';
    const isAnalogMode = simulationMode === 'ANALOG';
    const energizedPins = !isOffMode && isAnalogMode ? computeEnergizedPins(components, wires) : undefined;
    const directionField = isOffMode ? undefined : computeFlowDirectionField(components, wires, simulationMode);

    return wires.map((wire) => {
      const fromComp = components.find((c) => c.id === wire.fromCompId);
      const toComp = components.find((c) => c.id === wire.toCompId);
      if (!fromComp || !toComp) return null;

      const fromDef = COMPONENT_DEFINITIONS[fromComp.type];
      const toDef = COMPONENT_DEFINITIONS[toComp.type];
      if (!fromDef || !toDef) return null;

      const startPos = getPinAbsolutePosition(fromComp, wire.fromPinId, fromDef);
      const endPos = getPinAbsolutePosition(toComp, wire.toPinId, toDef);

      const points = computeWirePoints(startPos, endPos, wire.waypoints || [], components, wires, wire.id);
      const pathD = pointsToSvgPath(points, 4);

      // Compute visual flow status using isolated Wire Flow Engine (O(1) bypass when OFF)
      const flowInfo: WireFlowVisualResult = isOffMode
        ? {
            hasFlow: false,
            isFlowing: false,
            flowColor: wire.color,
            flowDirection: 1,
            isProblematic: false,
            isShortCircuit: false,
            effectiveVoltage: 0,
            effectiveCurrent: 0,
          }
        : isLogicalMode
        ? computeLogicalWireFlow(wire, fromComp, toComp, wire.state, undefined, directionField, simulationMode)
        : computeAnalogWireFlow(
            wire,
            fromComp,
            toComp,
            wire.state?.voltage,
            wire.state?.current,
            components,
            wires,
            isSimRunning,
            energizedPins,
            directionField,
            undefined,
            simulationMode
          );

      const shouldReversePath = !isOffMode && directionField?.get(wire.id) === -1;
      const orderedPoints = shouldReversePath ? [...points].reverse() : points;
      const flowPathD = pointsToSvgPath(orderedPoints, 4);
      const isSelected = selectedWireId === wire.id;
      const isHovered = hoveredWireId === wire.id;
      const showHandles = isSelected || isHovered;

      const segments = getWireSegments(points);
      const logicLevel = wire.state?.logicLevel;
      const hasActiveCurrent = !isOffMode && isAnalogMode && flowInfo.hasFlow;
      const hasLogicalHigh = !isOffMode && isLogicalMode && flowInfo.hasFlow;
      const isShortCircuit = !isOffMode && isSimRunning && flowInfo.isShortCircuit;

      const terminalFill = isSelected
        ? '#38bdf8'
        : isShortCircuit
        ? '#ef4444'
        : hasLogicalHigh
        ? '#3b82f6'
        : hasActiveCurrent
        ? '#fbbf24'
        : wire.color;

      return (
        <g
          key={wire.id}
          className="group cursor-pointer"
          onMouseEnter={(e) => {
            setHoveredWireId(wire.id);
            if (simulationStatus === 'running') {
              setHoverProbeTarget({
                type: 'wire',
                id: wire.id,
                screenX: e.clientX,
                screenY: e.clientY,
              });
            }
          }}
          onMouseMove={(e) => {
            if (hoverProbeTarget && simulationStatus === 'running') {
              setHoverProbeTarget((prev) => (prev ? { ...prev, screenX: e.clientX, screenY: e.clientY } : null));
            }
          }}
          onMouseLeave={() => {
            setHoveredWireId((prev) => (prev === wire.id ? null : prev));
            setHoverProbeTarget(null);
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (activeProbePicker) {
              attachProbe(activeProbePicker.instrument, activeProbePicker.channelId, {
                type: 'wire',
                wireId: wire.id,
                label: `Wire #${wire.id.slice(-4)}`,
              });
              return;
            }
            selectWire(wire.id);
          }}
        >
          {/* Fat hit testing path */}
          <path
            d={pathD}
            fill="none"
            stroke="transparent"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Selection Glow */}
          {isSelected && (
            <path
              d={pathD}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.6"
              filter="drop-shadow(0 0 4px #38bdf8)"
            />
          )}

          {/* Problematic / Short Circuit Glowing Red Alert Wire */}
          {isShortCircuit && (
            <>
              <path
                d={pathD}
                fill="none"
                stroke="#ef4444"
                strokeWidth="7"
                opacity="0.75"
                filter="drop-shadow(0 0 6px #ef4444)"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="wire-contention-pulse"
              />
              <path
                d={pathD}
                fill="none"
                stroke="#dc2626"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* Base Wire Path (User-selected color, highlighted red on short) */}
          <path
            d={pathD}
            fill="none"
            stroke={isSelected ? '#38bdf8' : isShortCircuit ? '#dc2626' : wire.color}
            strokeWidth={isSelected ? '3' : '2.5'}
            strokeDasharray={!isOffMode && !isShortCircuit && !hasActiveCurrent && logicLevel === 'Z' ? '5 3' : undefined}
            opacity={!isOffMode && !isShortCircuit && !hasActiveCurrent && logicLevel === 'Z' ? 0.65 : 1}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-colors duration-150"
          />

          {/* LOGICAL MODE: Clean Blue (#3b82f6 / #60a5fa) animated flow effect at calm, steady speed */}
          {hasLogicalHigh && !isShortCircuit && (
            <>
              <path
                d={flowPathD}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="5"
                opacity="0.4"
                filter="drop-shadow(0 0 4px #3b82f6)"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={flowPathD}
                fill="none"
                stroke="#60a5fa"
                strokeWidth="2.5"
                strokeDasharray="6 6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animationDuration: '0.8s' }}
                className="wire-flow-active pointer-events-none"
              />
            </>
          )}

          {/* ANALOG MODE: Warm Electric Yellow/Amber (#fbbf24 / #fde047) animated current flow at matching calm speed */}
          {hasActiveCurrent && !isShortCircuit && (
            <>
              {/* Subtle dark underlay dash for high contrast on yellow wires */}
              <path
                d={flowPathD}
                fill="none"
                stroke="rgba(0, 0, 0, 0.4)"
                strokeWidth="4"
                strokeDasharray="6 6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animationDuration: '0.8s' }}
                className="wire-flow-active pointer-events-none"
              />
              <path
                d={flowPathD}
                fill="none"
                stroke="#fde047"
                strokeWidth="2.5"
                strokeDasharray="6 6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animationDuration: '0.8s' }}
                className="wire-flow-active pointer-events-none"
              />
            </>
          )}

          {/* Start and End Terminal Connection Nodes */}
          <circle
            cx={startPos.x}
            cy={startPos.y}
            r={isSimRunning && (hasActiveCurrent || hasLogicalHigh || isShortCircuit) ? 3.5 : 3}
            fill={terminalFill}
          />
          <circle
            cx={endPos.x}
            cy={endPos.y}
            r={isSimRunning && (hasActiveCurrent || hasLogicalHigh || isShortCircuit) ? 3.5 : 3}
            fill={terminalFill}
          />

          {/* INTERACTIVE SEGMENT GRAB HANDLES */}
          {showHandles &&
            segments.map((seg) => {
              if (seg.length < 12) return null; // Don't crowd tiny segments
              const cursorClass = seg.isHorizontal ? 'cursor-ns-resize' : 'cursor-ew-resize';

              return (
                <g
                  key={`seg_${seg.index}`}
                  transform={`translate(${seg.midpoint.x}, ${seg.midpoint.y})`}
                  className={`${cursorClass} select-none`}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (contextMenuTarget) setContextMenuTarget(null);
                    if (e.button === 0) {
                      selectWire(wire.id);
                      setDraggingSegment({
                        wireId: wire.id,
                        segmentIndex: seg.index,
                        initialPoints: points,
                      });
                    }
                  }}
                >
                  {/* Invisible hit area */}
                  <circle cx="0" cy="0" r="10" fill="transparent" />
                  {/* Handle Pill */}
                  {seg.isHorizontal ? (
                    <rect
                      x="-8"
                      y="-3.5"
                      width="16"
                      height="7"
                      rx="3.5"
                      fill={isDark ? '#0f172a' : '#ffffff'}
                      stroke={isSelected ? '#38bdf8' : '#64748b'}
                      strokeWidth="1.5"
                      filter="drop-shadow(0 1px 2px rgba(0,0,0,0.4))"
                    />
                  ) : (
                    <rect
                      x="-3.5"
                      y="-8"
                      width="7"
                      height="16"
                      rx="3.5"
                      fill={isDark ? '#0f172a' : '#ffffff'}
                      stroke={isSelected ? '#38bdf8' : '#64748b'}
                      strokeWidth="1.5"
                      filter="drop-shadow(0 1px 2px rgba(0,0,0,0.4))"
                    />
                  )}
                  {/* Center Dot */}
                  <circle cx="0" cy="0" r="1.5" fill={isSelected ? '#38bdf8' : '#94a3b8'} />
                </g>
              );
            })}

          {/* INTERACTIVE CORNER BEND WAYPOINT HANDLES */}
          {showHandles &&
            points.slice(1, -1).map((pt, idx) => {
              const fullIdx = idx + 1;
              return (
                <g
                  key={`corner_${fullIdx}`}
                  transform={`translate(${pt.x}, ${pt.y})`}
                  className="cursor-move select-none"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (contextMenuTarget) setContextMenuTarget(null);
                    if (e.button === 0) {
                      selectWire(wire.id);
                      setDraggingWaypoint({
                        wireId: wire.id,
                        waypointIndex: fullIdx,
                        initialPoints: points,
                      });
                    }
                  }}
                >
                  <circle cx="0" cy="0" r="10" fill="transparent" />
                  <rect
                    x="-4"
                    y="-4"
                    width="8"
                    height="8"
                    transform="rotate(45)"
                    fill={isDark ? '#0f172a' : '#ffffff'}
                    stroke={isSelected ? '#38bdf8' : '#eab308'}
                    strokeWidth="1.5"
                    filter="drop-shadow(0 1px 2px rgba(0,0,0,0.4))"
                  />
                  <circle cx="0" cy="0" r="1.5" fill={isSelected ? '#38bdf8' : '#eab308'} />
                </g>
              );
            })}
        </g>
      );
    });
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full select-none overflow-hidden transition-colors ${
        spacePressed ? 'cursor-grab' : isPanning ? 'cursor-grabbing' : 'cursor-default'
      } ${isDark ? 'bg-[#0b1120]' : 'bg-[#f8fafc]'}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseLeave={() => {
        setCursorScreenPos(null);
        setCursorWorldPos(null);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (drawingWire) cancelDrawingWire();
        if (activeStimulusTool !== 'none') {
          setStimulusTool('none');
        }
      }}
    >
      <svg
        className="w-full h-full block"
        style={{ touchAction: 'none' }}
      >
        <defs>
          {/* Minor Grid Pattern (20px) */}
          <pattern
            id="grid-minor"
            width={20 * viewport.zoom}
            height={20 * viewport.zoom}
            patternUnits="userSpaceOnUse"
            x={viewport.panX % (20 * viewport.zoom)}
            y={viewport.panY % (20 * viewport.zoom)}
          >
            <circle
              cx={1}
              cy={1}
              r={1.2}
              fill={isDark ? '#1e293b' : '#cbd5e1'}
              opacity={isDark ? 0.8 : 0.9}
            />
          </pattern>

          {/* Major Grid Pattern (100px) */}
          <pattern
            id="grid-major"
            width={100 * viewport.zoom}
            height={100 * viewport.zoom}
            patternUnits="userSpaceOnUse"
            x={viewport.panX % (100 * viewport.zoom)}
            y={viewport.panY % (100 * viewport.zoom)}
          >
            <circle
              cx={1}
              cy={1}
              r={2}
              fill={isDark ? '#334155' : '#94a3b8'}
              opacity={isDark ? 0.9 : 0.8}
            />
          </pattern>
        </defs>

        {/* Responsive Grid Background */}
        <rect width="100%" height="100%" fill="url(#grid-minor)" />
        <rect width="100%" height="100%" fill="url(#grid-major)" />

        {/* Scaled and Panned World Content */}
        <g transform={`translate(${viewport.panX}, ${viewport.panY}) scale(${viewport.zoom})`}>
          {/* Origin axes indicator */}
          <line x1="0" y1="-20" x2="0" y2="20" stroke={isDark ? '#334155' : '#cbd5e1'} strokeWidth="1" />
          <line x1="-20" y1="0" x2="20" y2="0" stroke={isDark ? '#334155' : '#cbd5e1'} strokeWidth="1" />

          {/* Render Background Diagram Shapes (behind wires and components) */}
          {components.filter((c) => c.type === 'shape').map(renderAnnotationItem)}

          {/* Render Placed Wires */}
          {renderWires()}

          {/* Render Active Wire Drawing Live Preview */}
          {renderDrawingWirePreview()}

          {/* Render Components */}
          {components.map((component) => {
            if (component.type === 'shape') return null;

            const registryDef = ComponentRegistry.getComponentDefinition(component.type);
            const def = registryDef || COMPONENT_DEFINITIONS[component.type];
            if (!def) return null;

            const isSelected =
              selectedComponentIds.includes(component.id) || selectedComponentId === component.id;
            const isHighlighted = highlightedComponentId === component.id;

            // Handle Textbox Annotations & Notes
            if (component.type === 'textbox') {
              return renderAnnotationItem(component);
            }

            const { cx, cy } = getComponentCenter(def, component.type);

            // Compute rotated bounding box for perfect upright label positioning
            const bbox = getRotatedBoundingBox(def.width, def.height, component.rotation);
            const valueStr = getComponentValueString(component);

            return (
              <g
                key={component.id}
                onDragStart={(e) => e.preventDefault()}
                transform={`translate(${component.x}, ${component.y})`}
                className="cursor-move"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  if (contextMenuTarget) setContextMenuTarget(null);
                  if (e.button === 0) {
                    e.preventDefault();
                    preDragPositionsRef.current = new Map(components.map((c) => [c.id, { x: c.x, y: c.y }]));
                    preDragSnapshotRef.current = {
                      components: JSON.parse(JSON.stringify(components)),
                      wires: JSON.parse(JSON.stringify(wires)),
                    };
                    const isShift = e.shiftKey;
                    const isAlreadySelected = selectedComponentIds.includes(component.id);

                    if (isShift) {
                      selectComponent(component.id, true);
                    } else if (!isAlreadySelected) {
                      selectComponent(component.id, false);
                    }

                    const world = screenToWorld(e.clientX, e.clientY);
                    const targetIds = isShift
                      ? (isAlreadySelected
                          ? selectedComponentIds.filter((id) => id !== component.id)
                          : [...selectedComponentIds, component.id])
                      : (isAlreadySelected ? selectedComponentIds : [component.id]);

                    const initMap = new Map<string, { x: number; y: number }>();
                    components.forEach((c) => {
                      if (targetIds.includes(c.id)) {
                        initMap.set(c.id, { x: c.x, y: c.y });
                      }
                    });

                    setGroupDragInitials(initMap);
                    setGroupDragStartWorld(world);
                    setDraggingCompId(component.id);
                    setCompDragOffset({
                      x: world.x - component.x,
                      y: world.y - component.y,
                    });
                    setCompMouseDown({
                      id: component.id,
                      clientX: e.clientX,
                      clientY: e.clientY,
                    });
                  }
                }}
                onMouseEnter={(e) => {
                  if (simulationStatus === 'running') {
                    setHoverProbeTarget({
                      type: 'component',
                      id: component.id,
                      screenX: e.clientX,
                      screenY: e.clientY,
                    });
                  }
                }}
                onMouseMove={(e) => {
                  if (hoverProbeTarget && simulationStatus === 'running') {
                    setHoverProbeTarget((prev) => (prev ? { ...prev, screenX: e.clientX, screenY: e.clientY } : null));
                  }
                }}
                onMouseLeave={() => setHoverProbeTarget(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (compMouseDown && compMouseDown.id === component.id) {
                    const dist = Math.hypot(e.clientX - compMouseDown.clientX, e.clientY - compMouseDown.clientY);
                    if (dist < 6) {
                      if (component.type === 'pushbutton' || component.type === 'toggle-switch') {
                        toggleInteractiveComponent(component.id);
                      } else if (component.type === 'multimeter') {
                        if (!showMultimeter) toggleInstrument('multimeter');
                      } else if (component.type === 'oscilloscope') {
                        if (!showOscilloscope) toggleInstrument('oscilloscope');
                      } else if (component.type === 'logic-analyzer') {
                        if (!showLogicAnalyzer) toggleInstrument('logicAnalyzer');
                      }
                    }
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  selectComponent(component.id);
                  setContextMenuTarget({
                    componentId: component.id,
                    screenPos: { x: e.clientX, y: e.clientY },
                  });
                }}
              >
                {/* Highlight Beacon Ring for Smart Diagnostics HUD */}
                {isHighlighted && (
                  <rect
                    x={bbox.minX - 8}
                    y={bbox.minY - 8}
                    width={bbox.width + 16}
                    height={bbox.height + 16}
                    rx="10"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="3"
                    className="animate-pulse"
                    filter="drop-shadow(0 0 10px #38bdf8)"
                  />
                )}

                {/* 1. BODY & PINS GROUP: Rotates & Mirrors with component orientation */}
                {(() => {
                  const isCentered =
                    def.origin === 'center' ||
                    component.type === 'arduino-uno' ||
                    component.type === 'esp32' ||
                    component.type === 'pico';

                  return (
                    <g
                      transform={
                        isCentered
                          ? `translate(${cx}, ${cy}) rotate(${component.rotation}) scale(${
                              component.mirrored ? -1 : 1
                            }, 1)`
                          : `translate(${cx}, ${cy}) rotate(${component.rotation}) scale(${
                              component.mirrored ? -1 : 1
                            }, 1) translate(${-cx}, ${-cy})`
                      }
                    >
                      <ComponentGraphic
                        component={component}
                        definition={def as any}
                        isSelected={isSelected}
                        theme={theme}
                      />

                      {/* Pin Terminals */}
                      {def.pins.map((pin) => (
                        <PinTerminal
                          key={pin.id}
                          pin={pin as any}
                          isConnecting={!!drawingWire && drawingWire.fromCompId !== component.id}
                          onPinClick={(e) => handlePinClick(component.id, pin.id, e)}
                        />
                      ))}
                    </g>
                  );
                })()}

                {/* 2. UPRIGHT LABEL & VALUE OVERLAY: ALWAYS 0° HORIZONTAL (Screen Oriented) */}
                <g className="pointer-events-none select-none">
                  {/* Upright Reference Designator */}
                  <text
                    x={cx}
                    y={bbox.minY - 7}
                    fill={isDark ? '#e2e8f0' : '#1e293b'}
                    fontSize="11"
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="monospace"
                    className="drop-shadow-sm"
                  >
                    {component.label}
                  </text>

                  {/* Upright Electrical Parameter Value */}
                  {valueStr && (
                    <text
                      x={cx}
                      y={bbox.maxY + 13}
                      fill={isDark ? '#38bdf8' : '#0284c7'}
                      fontSize="9.5"
                      fontWeight="bold"
                      textAnchor="middle"
                      fontFamily="monospace"
                      className="drop-shadow-sm"
                    >
                      {valueStr}
                    </text>
                  )}
                </g>
              </g>
            );
          })}

          {/* Marquee Selection Rectangle */}
          {marquee && (
            <rect
              x={Math.min(marquee.startX, marquee.currentX)}
              y={Math.min(marquee.startY, marquee.currentY)}
              width={Math.abs(marquee.currentX - marquee.startX)}
              height={Math.abs(marquee.currentY - marquee.startY)}
              fill="rgba(59, 130, 246, 0.15)"
              stroke="#3b82f6"
              strokeWidth="1.5"
              strokeDasharray="4 2"
              className="pointer-events-none select-none"
            />
          )}

          {/* Interactive Physical Stimulus Visual Rays & Live Readout Badges */}
          {activeStimulusTool !== 'none' && cursorWorldPos && (
            <g className="pointer-events-none select-none">
              <defs>
                <radialGradient id="stimulusBulbGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.45" />
                  <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="stimulusFlameGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.5" />
                  <stop offset="70%" stopColor="#ea580c" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="stimulusIceGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.5" />
                  <stop offset="70%" stopColor="#0284c7" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
                </radialGradient>
              </defs>

              {activeStimulusTool === 'lightbulb' &&
                components
                  .filter((c) => c.type === 'light-sensor' || c.type === 'builtin_solar_panel')
                  .map((c) => {
                    const cx = c.x + 40;
                    const cy = c.type === 'builtin_solar_panel' ? c.y + 40 : c.y + 20;
                    const dist = Math.hypot(cursorWorldPos.x - cx, cursorWorldPos.y - cy);
                    const opacity = Math.max(0, Math.min(1, 1 - dist / 350));
                    const lux = c.properties.lux ?? 20;
                    const res = Math.max(50, Math.round(500000 / Math.pow(Math.max(1, lux), 0.7)));
                    const resStr = res >= 1000 ? `${(res / 1000).toFixed(1)}kΩ` : `${res}Ω`;

                    return (
                      <g key={`stim_l_${c.id}`}>
                        {dist < 350 && (
                          <>
                            <line
                              x1={cursorWorldPos.x}
                              y1={cursorWorldPos.y}
                              x2={cx}
                              y2={cy}
                              stroke="#fbbf24"
                              strokeWidth="2"
                              strokeDasharray="4 3"
                              strokeOpacity={opacity * 0.8}
                            />
                            <circle cx={cx} cy={cy} r={35} fill="url(#stimulusBulbGlow)" opacity={opacity} />
                          </>
                        )}
                        <g transform={`translate(${cx}, ${c.y - 12})`}>
                          <rect
                            x="-50"
                            y="-14"
                            width="100"
                            height="16"
                            rx="8"
                            fill="#0f172a"
                            stroke="#f59e0b"
                            strokeWidth="1.2"
                            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.4))"
                          />
                          <text
                            x="0"
                            y="-2"
                            textAnchor="middle"
                            fill="#fbbf24"
                            fontSize="9.5"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {lux} Lux • {resStr}
                          </text>
                        </g>
                      </g>
                    );
                  })}

              {activeStimulusTool === 'matchstick' &&
                components
                  .filter((c) => c.type === 'temp-sensor')
                  .map((c) => {
                    const cx = c.x + 40;
                    const cy = c.y + 20;
                    const dist = Math.hypot(cursorWorldPos.x - cx, cursorWorldPos.y - cy);
                    const opacity = Math.max(0, Math.min(1, 1 - dist / 300));
                    const temp = c.properties.temperatureC ?? 25;
                    const vout = (0.5 + 0.01 * temp).toFixed(2);

                    return (
                      <g key={`stim_m_${c.id}`}>
                        {dist < 300 && (
                          <>
                            <line
                              x1={cursorWorldPos.x}
                              y1={cursorWorldPos.y}
                              x2={cx}
                              y2={cy}
                              stroke="#f97316"
                              strokeWidth="2.5"
                              strokeDasharray="5 3"
                              strokeOpacity={opacity * 0.85}
                            />
                            <circle cx={cx} cy={cy} r={35} fill="url(#stimulusFlameGlow)" opacity={opacity} />
                          </>
                        )}
                        <g transform={`translate(${cx}, ${c.y - 12})`}>
                          <rect
                            x="-45"
                            y="-14"
                            width="90"
                            height="16"
                            rx="8"
                            fill="#0f172a"
                            stroke="#ea580c"
                            strokeWidth="1.2"
                            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.4))"
                          />
                          <text
                            x="0"
                            y="-2"
                            textAnchor="middle"
                            fill="#fb923c"
                            fontSize="9.5"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {temp}°C • {vout}V
                          </text>
                        </g>
                      </g>
                    );
                  })}

              {activeStimulusTool === 'ice' &&
                components
                  .filter((c) => c.type === 'temp-sensor')
                  .map((c) => {
                    const cx = c.x + 40;
                    const cy = c.y + 20;
                    const dist = Math.hypot(cursorWorldPos.x - cx, cursorWorldPos.y - cy);
                    const opacity = Math.max(0, Math.min(1, 1 - dist / 300));
                    const temp = c.properties.temperatureC ?? 25;
                    const vout = (0.5 + 0.01 * temp).toFixed(2);

                    return (
                      <g key={`stim_i_${c.id}`}>
                        {dist < 300 && (
                          <>
                            <line
                              x1={cursorWorldPos.x}
                              y1={cursorWorldPos.y}
                              x2={cx}
                              y2={cy}
                              stroke="#38bdf8"
                              strokeWidth="2"
                              strokeDasharray="4 2"
                              strokeOpacity={opacity * 0.85}
                            />
                            <circle cx={cx} cy={cy} r={35} fill="url(#stimulusIceGlow)" opacity={opacity} />
                          </>
                        )}
                        <g transform={`translate(${cx}, ${c.y - 12})`}>
                          <rect
                            x="-45"
                            y="-14"
                            width="90"
                            height="16"
                            rx="8"
                            fill="#0f172a"
                            stroke="#0284c7"
                            strokeWidth="1.2"
                            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.4))"
                          />
                          <text
                            x="0"
                            y="-2"
                            textAnchor="middle"
                            fill="#7dd3fc"
                            fontSize="9.5"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {temp}°C • {vout}V
                          </text>
                        </g>
                      </g>
                    );
                  })}

              {activeStimulusTool === 'ultrasonic_target' &&
                components
                  .filter((c) => c.type === 'ultrasonic')
                  .map((c) => {
                    const cx = c.x + 50;
                    const cy = c.y + 30;
                    const distCm = c.properties.distanceCm ?? 50;

                    return (
                      <g key={`stim_u_${c.id}`}>
                        <line
                          x1={cx}
                          y1={cy}
                          x2={cursorWorldPos.x}
                          y2={cursorWorldPos.y}
                          stroke="#10b981"
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                          opacity="0.7"
                        />
                        {[0.3, 0.6, 0.9].map((ratio, i) => {
                          const px = cx + (cursorWorldPos.x - cx) * ratio;
                          const py = cy + (cursorWorldPos.y - cy) * ratio;
                          return (
                            <circle
                              key={i}
                              cx={px}
                              cy={py}
                              r={6 + i * 4}
                              fill="none"
                              stroke="#34d399"
                              strokeWidth="1.5"
                              opacity={0.7 - i * 0.2}
                            />
                          );
                        })}
                        <g transform={`translate(${cx}, ${c.y - 12})`}>
                          <rect
                            x="-35"
                            y="-14"
                            width="70"
                            height="16"
                            rx="8"
                            fill="#0f172a"
                            stroke="#10b981"
                            strokeWidth="1.2"
                            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.4))"
                          />
                          <text
                            x="0"
                            y="-2"
                            textAnchor="middle"
                            fill="#34d399"
                            fontSize="9.5"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {distCm} cm
                          </text>
                        </g>
                      </g>
                    );
                  })}

              {(activeStimulusTool === 'water_mister' || activeStimulusTool === 'dry_air') &&
                components
                  .filter((c) => c.type === 'builtin_humidity_sensor' || c.type === 'humidity-sensor')
                  .map((c) => {
                    const cx = c.x + 40;
                    const cy = c.y + 40;
                    const hum = c.properties.humidity ?? 45;
                    const vout = (5.0 * (hum / 100)).toFixed(2);
                    return (
                      <g key={`stim_h_${c.id}`}>
                        <line
                          x1={cursorWorldPos.x}
                          y1={cursorWorldPos.y}
                          x2={cx}
                          y2={cy}
                          stroke={activeStimulusTool === 'water_mister' ? '#38bdf8' : '#f59e0b'}
                          strokeWidth="2"
                          strokeDasharray="4 3"
                          opacity="0.8"
                        />
                        <g transform={`translate(${cx}, ${c.y - 12})`}>
                          <rect
                            x="-48"
                            y="-14"
                            width="96"
                            height="16"
                            rx="8"
                            fill="#0f172a"
                            stroke="#38bdf8"
                            strokeWidth="1.2"
                          />
                          <text
                            x="0"
                            y="-2"
                            textAnchor="middle"
                            fill="#38bdf8"
                            fontSize="9.5"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {hum}% RH • {vout}V
                          </text>
                        </g>
                      </g>
                    );
                  })}

              {activeStimulusTool === 'motion_target' &&
                components
                  .filter((c) => c.type === 'builtin_motion_sensor' || c.type === 'motion-sensor')
                  .map((c) => {
                    const cx = c.x + 40;
                    const cy = c.y + 40;
                    const dist = Math.hypot(cursorWorldPos.x - cx, cursorWorldPos.y - cy);
                    const detected = Boolean(c.properties.motionDetected);
                    return (
                      <g key={`stim_pir_${c.id}`}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r="250"
                          fill="none"
                          stroke={detected ? '#f97316' : '#334155'}
                          strokeWidth="1.5"
                          strokeDasharray="6 4"
                          opacity="0.5"
                        />
                        <line
                          x1={cursorWorldPos.x}
                          y1={cursorWorldPos.y}
                          x2={cx}
                          y2={cy}
                          stroke={detected ? '#f97316' : '#64748b'}
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                        />
                        <g transform={`translate(${cx}, ${c.y - 12})`}>
                          <rect
                            x="-52"
                            y="-14"
                            width="104"
                            height="16"
                            rx="8"
                            fill="#0f172a"
                            stroke={detected ? '#f97316' : '#475569'}
                            strokeWidth="1.2"
                          />
                          <text
                            x="0"
                            y="-2"
                            textAnchor="middle"
                            fill={detected ? '#fb923c' : '#94a3b8'}
                            fontSize="9"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {detected ? 'MOTION ACTIVE' : `${Math.round(dist)}px (>250px)`}
                          </text>
                        </g>
                      </g>
                    );
                  })}

              {activeStimulusTool === 'smoke_plume' &&
                components
                  .filter((c) => c.type === 'builtin_gas_sensor' || c.type === 'gas-sensor')
                  .map((c) => {
                    const cx = c.x + 40;
                    const cy = c.y + 40;
                    const ppm = c.properties.ppm ?? 50;
                    return (
                      <g key={`stim_gas_${c.id}`}>
                        <line
                          x1={cursorWorldPos.x}
                          y1={cursorWorldPos.y}
                          x2={cx}
                          y2={cy}
                          stroke="#94a3b8"
                          strokeWidth="2"
                          strokeDasharray="4 3"
                        />
                        <g transform={`translate(${cx}, ${c.y - 12})`}>
                          <rect
                            x="-48"
                            y="-14"
                            width="96"
                            height="16"
                            rx="8"
                            fill="#0f172a"
                            stroke={ppm >= (c.properties.threshold ?? 400) ? '#ef4444' : '#94a3b8'}
                            strokeWidth="1.2"
                          />
                          <text
                            x="0"
                            y="-2"
                            textAnchor="middle"
                            fill={ppm >= (c.properties.threshold ?? 400) ? '#f87171' : '#cbd5e1'}
                            fontSize="9.5"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {ppm} PPM {ppm >= (c.properties.threshold ?? 400) ? '⚠️' : ''}
                          </text>
                        </g>
                      </g>
                    );
                  })}

              {activeStimulusTool === 'tilt_manipulator' &&
                components
                  .filter((c) => c.type === 'builtin_accelerometer' || c.type === 'accelerometer')
                  .map((c) => {
                    const cx = c.x + 60;
                    const cy = c.y + 40;
                    const ax = Number(c.properties.accelX ?? 0).toFixed(1);
                    const ay = Number(c.properties.accelY ?? 0).toFixed(1);
                    const az = Number(c.properties.accelZ ?? 1.0).toFixed(1);
                    return (
                      <g key={`stim_acc_${c.id}`}>
                        <line
                          x1={cursorWorldPos.x}
                          y1={cursorWorldPos.y}
                          x2={cx}
                          y2={cy}
                          stroke="#818cf8"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                        />
                        <g transform={`translate(${cx}, ${c.y - 12})`}>
                          <rect
                            x="-64"
                            y="-14"
                            width="128"
                            height="16"
                            rx="8"
                            fill="#0f172a"
                            stroke="#6366f1"
                            strokeWidth="1.2"
                          />
                          <text
                            x="0"
                            y="-2"
                            textAnchor="middle"
                            fill="#a5b4fc"
                            fontSize="8.5"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            X:{ax}g Y:{ay}g Z:{az}g
                          </text>
                        </g>
                      </g>
                    );
                  })}

              {activeStimulusTool === 'watering_can' &&
                components
                  .filter((c) => c.type === 'builtin_soil_moisture')
                  .map((c) => {
                    const cx = c.x + 40;
                    const cy = c.y + 60;
                    const moisture = c.properties.moisture ?? 20;
                    return (
                      <g key={`stim_soil_${c.id}`}>
                        <line
                          x1={cursorWorldPos.x}
                          y1={cursorWorldPos.y}
                          x2={cx}
                          y2={cy}
                          stroke="#38bdf8"
                          strokeWidth="2"
                          strokeDasharray="4 3"
                        />
                        <g transform={`translate(${cx}, ${c.y - 12})`}>
                          <rect
                            x="-48"
                            y="-14"
                            width="96"
                            height="16"
                            rx="8"
                            fill="#0f172a"
                            stroke="#0284c7"
                            strokeWidth="1.2"
                          />
                          <text
                            x="0"
                            y="-2"
                            textAnchor="middle"
                            fill="#38bdf8"
                            fontSize="9"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            💧 Moisture: {moisture}%
                          </text>
                        </g>
                      </g>
                    );
                  })}

              {activeStimulusTool === 'ir_remote' &&
                components
                  .filter((c) => c.type === 'builtin_ir_rx')
                  .map((c) => {
                    const cx = c.x + 40;
                    const cy = c.y + 40;
                    const irDet = Boolean(c.properties.irDetected);
                    return (
                      <g key={`stim_ir_${c.id}`}>
                        <line
                          x1={cursorWorldPos.x}
                          y1={cursorWorldPos.y}
                          x2={cx}
                          y2={cy}
                          stroke="#e879f9"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                        />
                        <g transform={`translate(${cx}, ${c.y - 12})`}>
                          <rect
                            x="-52"
                            y="-14"
                            width="104"
                            height="16"
                            rx="8"
                            fill="#0f172a"
                            stroke="#d946ef"
                            strokeWidth="1.2"
                          />
                          <text
                            x="0"
                            y="-2"
                            textAnchor="middle"
                            fill="#f0abfc"
                            fontSize="9"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {irDet ? '📡 38kHz IR ACTIVE' : 'OUT OF RANGE'}
                          </text>
                        </g>
                      </g>
                    );
                  })}

              {activeStimulusTool === 'bar_magnet' &&
                components
                  .filter((c) => c.type === 'builtin_hall_sensor')
                  .map((c) => {
                    const cx = c.x + 40;
                    const cy = c.y + 40;
                    const mag = c.properties.magneticField ?? 0;
                    return (
                      <g key={`stim_hall_${c.id}`}>
                        <line
                          x1={cursorWorldPos.x}
                          y1={cursorWorldPos.y}
                          x2={cx}
                          y2={cy}
                          stroke="#818cf8"
                          strokeWidth="2"
                          strokeDasharray="4 3"
                        />
                        <g transform={`translate(${cx}, ${c.y - 12})`}>
                          <rect
                            x="-48"
                            y="-14"
                            width="96"
                            height="16"
                            rx="8"
                            fill="#0f172a"
                            stroke="#6366f1"
                            strokeWidth="1.2"
                          />
                          <text
                            x="0"
                            y="-2"
                            textAnchor="middle"
                            fill="#a5b4fc"
                            fontSize="9"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            🧲 Flux: {mag} mT
                          </text>
                        </g>
                      </g>
                    );
                  })}

              {activeStimulusTool === 'hammer_tap' &&
                components
                  .filter((c) => c.type === 'builtin_vibration_sensor')
                  .map((c) => {
                    const cx = c.x + 40;
                    const cy = c.y + 40;
                    const vib = Boolean(c.properties.vibrationDetected);
                    return (
                      <g key={`stim_vib_${c.id}`}>
                        <line
                          x1={cursorWorldPos.x}
                          y1={cursorWorldPos.y}
                          x2={cx}
                          y2={cy}
                          stroke="#f59e0b"
                          strokeWidth="2"
                          strokeDasharray="3 3"
                        />
                        <g transform={`translate(${cx}, ${c.y - 12})`}>
                          <rect
                            x="-50"
                            y="-14"
                            width="100"
                            height="16"
                            rx="8"
                            fill="#0f172a"
                            stroke="#f59e0b"
                            strokeWidth="1.2"
                          />
                          <text
                            x="0"
                            y="-2"
                            textAnchor="middle"
                            fill="#fcd34d"
                            fontSize="9"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {vib ? '🔨 SHOCK PULSE!' : 'Move Close to Tap'}
                          </text>
                        </g>
                      </g>
                    );
                  })}
            </g>
          )}

          {/* Render Color-Coded Instrument Probe Flags / Clips on Canvas */}
          {(() => {
            const posCounts = new Map<string, number>();

            return probeBadges.map((badge) => {
              const key = `${badge.x}_${badge.y}`;
              const stackIdx = posCounts.get(key) || 0;
              posCounts.set(key, stackIdx + 1);

              // Stagger adjacent 20px pins vertically between Tier 1 (-18px) and Tier 2 (-36px)
              // to prevent adjacent badges from colliding horizontally
              const staggerTier = Math.abs(Math.round(badge.x / 20)) % 2;
              const tierOffset = staggerTier === 0 ? 18 : 36;
              const badgeY = badge.y - tierOffset - stackIdx * 18;
              const badgeX = badge.x;

              return (
                <g key={badge.id} className="select-none z-30">
                  {/* Thin leader line from badge down to exact pin/wire target */}
                  <line
                    x1={badgeX}
                    y1={badgeY + 8}
                    x2={badge.x}
                    y2={badge.y}
                    stroke={badge.color}
                    strokeWidth="1.2"
                    strokeDasharray="2 1"
                  />
                  {/* Little Alligator Clip Ring at Target Origin */}
                  <circle
                    cx={badge.x}
                    cy={badge.y}
                    r="3.5"
                    fill={badge.color}
                    stroke="#090d16"
                    strokeWidth="1.2"
                  />

                  {/* Compact Floating Probe Badge Pill */}
                  <g transform={`translate(${badgeX}, ${badgeY})`}>
                    <rect
                      x="-19"
                      y="-8"
                      width="38"
                      height="16"
                      rx="8"
                      fill="#090d16"
                      stroke={badge.color}
                      strokeWidth="1.5"
                      filter="drop-shadow(0 2px 4px rgba(0,0,0,0.6))"
                    />
                    {/* Probe Label: [CH1], [V+], [COM], [D0] */}
                    <text
                      x="-5"
                      y="3.5"
                      fill={badge.color}
                      fontSize="8.5"
                      fontWeight="bold"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {badge.label}
                    </text>

                    {/* Unclip / Detach Button (×) */}
                    <g
                      onClick={(e) => {
                        e.stopPropagation();
                        detachProbe(badge.instrument, badge.channelId);
                      }}
                      className="cursor-pointer hover:opacity-80"
                    >
                      <circle cx="11" cy="0" r="4.5" fill="#ef4444" />
                      <text
                        x="11"
                        y="3"
                        fill="#ffffff"
                        fontSize="8"
                        fontWeight="black"
                        textAnchor="middle"
                      >
                        ×
                      </text>
                    </g>
                  </g>
                </g>
              );
            });
          })()}
        </g>
      </svg>

      {/* Floating Canvas Quick Controls & Zoom Overlay */}
      <div
        className={`absolute bottom-4 left-4 flex items-center gap-1.5 backdrop-blur-md border rounded-lg p-1.5 text-xs shadow-xl z-20 ${
          isDark
            ? 'bg-slate-900/85 border-slate-700/60 text-slate-300'
            : 'bg-white/95 border-slate-200 text-slate-700'
        }`}
      >
        <button
          onClick={zoomOut}
          className={`px-2 py-1 rounded transition ${
            isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
          }`}
          title="Zoom Out (Scroll Down)"
        >
          -
        </button>
        <span className="px-2 font-mono font-semibold text-sky-500">
          {Math.round(viewport.zoom * 100)}%
        </span>
        <button
          onClick={zoomIn}
          className={`px-2 py-1 rounded transition ${
            isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
          }`}
          title="Zoom In (Scroll Up)"
        >
          +
        </button>
        <button
          onClick={zoomToFit}
          className={`p-1 rounded transition ${
            isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
          }`}
          title="Fit to Screen"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <div className={`w-[1px] h-4 mx-1 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
        <span className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          X: {Math.round(-viewport.panX)} Y: {Math.round(-viewport.panY)}
        </span>
      </div>

      {/* Wire Drawing Mode Hint Banner */}
      {drawingWire && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-sky-600/90 backdrop-blur text-white text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border border-sky-400/50 animate-pulse z-30">
          <span className="w-2 h-2 rounded-full bg-white" />
          <span>Routing Wire. Click pin to connect, click canvas to add bend waypoint, Esc to cancel.</span>
        </div>
      )}

      {/* Active Probe Picker Attachment Banner */}
      {activeProbePicker && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-xs px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 border animate-pulse z-30 backdrop-blur-md"
          style={{ backgroundColor: `${activeProbePicker.color}ee`, borderColor: activeProbePicker.color }}
        >
          <Target className="w-3.5 h-3.5" />
          <span className="font-semibold">
            Attach {activeProbePicker.title}: Click any Pin or Wire on canvas (Esc to cancel)
          </span>
          <button
            onClick={() => setActiveProbePicker(null)}
            className="ml-2 hover:bg-black/30 p-0.5 rounded-full transition"
            title="Cancel Probe Attachment"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Interactive Sensor & Component Context HUD */}
      {activeContextComponent && contextMenuTarget && (
        <SensorContextHUD
          component={activeContextComponent}
          screenPos={contextMenuTarget.screenPos}
          onClose={() => setContextMenuTarget(null)}
        />
      )}

      {/* Live SPICE & Mixed Simulation Hover Probe Tooltip */}
      {(() => {
        if (!hoverProbeTarget || simulationStatus !== 'running') return null;
        let title = '';
        let voltage: number | undefined;
        let current: number | undefined;
        let power: number | undefined;
        let logicLevel: any;

        if (hoverProbeTarget.type === 'wire') {
          const wire = wires.find((w) => w.id === hoverProbeTarget.id);
          if (!wire) return null;
          title = simulationMode === 'LOGICAL' ? 'Logic Wire Net' : 'Analog Wire Net';
          voltage = wire.state?.voltage;
          current = wire.state?.current;
          logicLevel = wire.state?.logicLevel;
        } else if (hoverProbeTarget.type === 'component') {
          const comp = components.find((c) => c.id === hoverProbeTarget.id);
          if (!comp) return null;
          const def = ComponentRegistry.get(comp.type);
          title = `${comp.label} (${def?.name || comp.type})`;
          voltage = comp.state?.voltageDropV;
          current = comp.state?.branchCurrentA;
          power = comp.state?.powerW;
          logicLevel = comp.state?.logicOutput;
        }

        return (
          <div
            style={{ left: hoverProbeTarget.screenX + 14, top: hoverProbeTarget.screenY + 14 }}
            className="fixed z-40 pointer-events-none bg-slate-900/95 text-slate-100 text-xs px-2.5 py-1.5 rounded-lg border border-sky-500/50 shadow-2xl backdrop-blur font-mono space-y-0.5 select-none"
          >
            <div className="font-bold text-[11px] text-sky-400 border-b border-slate-700/60 pb-0.5 mb-1">
              {title}
            </div>
            {voltage !== undefined && (
              <div className="flex justify-between gap-3 text-[10.5px]">
                <span className="text-slate-400">Voltage:</span>
                <span className="font-bold text-amber-300">
                  {Math.abs(voltage) >= 1
                    ? `${voltage.toFixed(2)} V`
                    : `${(voltage * 1000).toFixed(2)} mV`}
                </span>
              </div>
            )}
            {current !== undefined && (
              <div className="flex justify-between gap-3 text-[10.5px]">
                <span className="text-slate-400">Current:</span>
                <span className="font-bold text-emerald-400">
                  {Math.abs(current) >= 1
                    ? `${current.toFixed(2)} A`
                    : Math.abs(current) >= 0.001
                    ? `${(current * 1000).toFixed(2)} mA`
                    : `${(current * 1e6).toFixed(2)} µA`}
                </span>
              </div>
            )}
            {power !== undefined && power > 0 && (
              <div className="flex justify-between gap-3 text-[10.5px]">
                <span className="text-slate-400">Power:</span>
                <span className="font-bold text-rose-300">
                  {power >= 1
                    ? `${power.toFixed(2)} W`
                    : `${(power * 1000).toFixed(2)} mW`}
                </span>
              </div>
            )}
            {logicLevel !== undefined && (
              <div className="flex justify-between gap-3 text-[10.5px]">
                <span className="text-slate-400">Logic:</span>
                <span className="font-bold text-sky-400">
                  {String(logicLevel)}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Cursor-Attached Physical Stimulus Tool Follower */}
      {activeStimulusTool !== 'none' && cursorScreenPos && (
        <div
          style={{
            left: cursorScreenPos.x,
            top: cursorScreenPos.y,
            transform: 'translate(-50%, -50%)',
          }}
          className="fixed pointer-events-none z-50 select-none flex flex-col items-center"
        >
          {activeStimulusTool === 'lightbulb' && (
            <div className="relative flex items-center justify-center">
              <div className="absolute w-16 h-16 rounded-full bg-amber-400/25 blur-md animate-pulse" />
              <svg width="48" height="48" viewBox="0 0 48 48" className="drop-shadow-lg filter">
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                  <line
                    key={angle}
                    x1="24"
                    y1="5"
                    x2="24"
                    y2="10"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    transform={`rotate(${angle} 24 24)`}
                  />
                ))}
                <path
                  d="M 17 24 C 17 19 20 15 24 15 C 28 15 31 19 31 24 C 31 27 29 29 28 32 L 20 32 C 19 29 17 27 17 24 Z"
                  fill="#fef08a"
                  stroke="#eab308"
                  strokeWidth="2"
                />
                <path d="M 22 26 L 24 20 L 26 26" fill="none" stroke="#ea580c" strokeWidth="1.5" strokeLinecap="round" />
                <rect x="20" y="32" width="8" height="5" rx="1.5" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
                <ellipse cx="24" cy="37.5" rx="3" ry="1.5" fill="#334155" />
              </svg>
            </div>
          )}

          {activeStimulusTool === 'matchstick' && (
            <div className="relative flex items-center justify-center">
              <svg width="56" height="56" viewBox="0 0 56 56" className="drop-shadow-xl filter">
                <line x1="16" y1="42" x2="34" y2="24" stroke="#d97706" strokeWidth="5" strokeLinecap="round" />
                <circle cx="34" cy="24" r="3.5" fill="#78350f" />
                <g transform="translate(34, 22)">
                  <path
                    d="M 0 0 C -6 -6 -8 -16 0 -24 C 8 -16 6 -6 0 0 Z"
                    fill="#f97316"
                    className="animate-pulse"
                  />
                  <path
                    d="M 0 -2 C -3 -6 -4 -13 0 -18 C 4 -13 3 -6 0 -2 Z"
                    fill="#fef08a"
                  />
                  <circle cx="0" cy="-2" r="2.5" fill="#38bdf8" opacity="0.8" />
                </g>
              </svg>
            </div>
          )}

          {activeStimulusTool === 'ice' && (
            <div className="relative flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 48 48" className="drop-shadow-xl filter">
                <circle cx="24" cy="24" r="20" fill="rgba(56, 189, 248, 0.2)" />
                <polygon points="24,10 38,18 24,26 10,18" fill="#bae6fd" stroke="#38bdf8" strokeWidth="1.5" />
                <polygon points="10,18 24,26 24,38 10,30" fill="#7dd3fc" stroke="#0284c7" strokeWidth="1.5" />
                <polygon points="24,26 38,18 38,30 24,38" fill="#38bdf8" stroke="#0369a1" strokeWidth="1.5" />
                <line x1="24" y1="14" x2="24" y2="20" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="21" y1="17" x2="27" y2="17" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          )}

          {activeStimulusTool === 'ultrasonic_target' && (
            <div className="relative flex items-center justify-center">
              <svg width="50" height="50" viewBox="0 0 50 50" className="drop-shadow-xl filter">
                <rect x="14" y="14" width="22" height="22" rx="3" fill="#047857" stroke="#10b981" strokeWidth="2" opacity="0.85" />
                <circle cx="25" cy="25" r="18" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 2" />
                <circle cx="25" cy="25" r="8" fill="none" stroke="#34d399" strokeWidth="1.5" />
                <circle cx="25" cy="25" r="2.5" fill="#ec4899" />
                <line x1="25" y1="4" x2="25" y2="46" stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="4" y1="25" x2="46" y2="25" stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" />
              </svg>
            </div>
          )}

          {activeStimulusTool === 'water_mister' && (
            <div className="relative flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 48 48" className="drop-shadow-xl filter">
                <circle cx="24" cy="24" r="20" fill="rgba(56, 189, 248, 0.2)" />
                <path d="M 24 8 C 16 20 14 26 14 31 A 10 10 0 0 0 34 31 C 34 26 32 20 24 8 Z" fill="#38bdf8" stroke="#0284c7" strokeWidth="2" />
                <circle cx="20" cy="29" r="2.5" fill="#e0f2fe" opacity="0.8" />
              </svg>
            </div>
          )}

          {activeStimulusTool === 'dry_air' && (
            <div className="relative flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 48 48" className="drop-shadow-xl filter">
                <circle cx="24" cy="24" r="20" fill="rgba(245, 158, 11, 0.2)" />
                <path d="M 10 18 Q 24 12 36 18 M 8 24 Q 24 18 38 24 M 12 30 Q 24 24 34 30" fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
          )}

          {activeStimulusTool === 'motion_target' && (
            <div className="relative flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 48 48" className="drop-shadow-xl filter">
                <circle cx="24" cy="24" r="20" fill="rgba(249, 115, 22, 0.2)" />
                <circle cx="24" cy="14" r="5" fill="#f97316" />
                <path d="M 24 20 L 24 31 M 24 23 L 16 28 M 24 23 L 32 27 M 24 31 L 17 40 M 24 31 L 31 40" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
          )}

          {activeStimulusTool === 'smoke_plume' && (
            <div className="relative flex items-center justify-center">
              <svg width="52" height="52" viewBox="0 0 52 52" className="drop-shadow-xl filter">
                <circle cx="20" cy="28" r="10" fill="#94a3b8" opacity="0.85" />
                <circle cx="30" cy="24" r="12" fill="#64748b" opacity="0.85" />
                <circle cx="25" cy="18" r="9" fill="#cbd5e1" opacity="0.9" />
              </svg>
            </div>
          )}

          {activeStimulusTool === 'tilt_manipulator' && (
            <div className="relative flex items-center justify-center">
              <svg width="50" height="50" viewBox="0 0 50 50" className="drop-shadow-xl filter">
                <circle cx="25" cy="25" r="18" fill="rgba(99, 102, 241, 0.2)" stroke="#818cf8" strokeWidth="2" />
                <line x1="7" y1="25" x2="43" y2="25" stroke="#38bdf8" strokeWidth="2" />
                <line x1="25" y1="7" x2="25" y2="43" stroke="#4ade80" strokeWidth="2" />
                <circle cx="25" cy="25" r="4" fill="#facc15" />
              </svg>
            </div>
          )}

          {activeStimulusTool === 'watering_can' && (
            <div className="relative flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 48 48" className="drop-shadow-xl filter">
                <circle cx="24" cy="24" r="20" fill="rgba(56, 189, 248, 0.25)" />
                <rect x="16" y="18" width="16" height="14" rx="2" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
                <path d="M 16,22 L 8,16 M 32,20 C 37,20 37,30 32,30" stroke="#38bdf8" strokeWidth="2" fill="none" />
                <circle cx="8" cy="24" r="2" fill="#7dd3fc" />
                <circle cx="6" cy="29" r="2" fill="#7dd3fc" />
              </svg>
            </div>
          )}

          {activeStimulusTool === 'ir_remote' && (
            <div className="relative flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 48 48" className="drop-shadow-xl filter">
                <circle cx="24" cy="24" r="20" fill="rgba(217, 70, 239, 0.25)" />
                <rect x="16" y="12" width="16" height="26" rx="3" fill="#1e1b4b" stroke="#e879f9" strokeWidth="1.8" />
                <circle cx="24" cy="12" r="3" fill="#f0abfc" />
                <circle cx="24" cy="20" r="3" fill="#ef4444" />
                <circle cx="21" cy="27" r="1.5" fill="#94a3b8" />
                <circle cx="27" cy="27" r="1.5" fill="#94a3b8" />
              </svg>
            </div>
          )}

          {activeStimulusTool === 'bar_magnet' && (
            <div className="relative flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 48 48" className="drop-shadow-xl filter">
                <circle cx="24" cy="24" r="20" fill="rgba(99, 102, 241, 0.25)" />
                <rect x="10" y="18" width="14" height="12" rx="2" fill="#ef4444" stroke="#fca5a5" strokeWidth="1.2" />
                <rect x="24" y="18" width="14" height="12" rx="2" fill="#3b82f6" stroke="#93c5fd" strokeWidth="1.2" />
                <text x="17" y="26.5" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">N</text>
                <text x="31" y="26.5" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">S</text>
              </svg>
            </div>
          )}

          {activeStimulusTool === 'hammer_tap' && (
            <div className="relative flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 48 48" className="drop-shadow-xl filter">
                <circle cx="24" cy="24" r="20" fill="rgba(245, 158, 11, 0.25)" />
                <line x1="16" y1="36" x2="28" y2="20" stroke="#d97706" strokeWidth="4" strokeLinecap="round" />
                <rect x="20" y="13" width="16" height="8" rx="2" transform="rotate(35 28 17)" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="1.5" />
              </svg>
            </div>
          )}

          <div className="mt-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-950/90 text-white border border-slate-700/80 shadow-2xl backdrop-blur whitespace-nowrap">
            {activeStimulusTool === 'lightbulb' && `Light Source (${stimulusIntensity} Lux)`}
            {activeStimulusTool === 'matchstick' && `Heat Source (${stimulusIntensity}°C)`}
            {activeStimulusTool === 'ice' && `Cold Source (${stimulusIntensity}°C)`}
            {activeStimulusTool === 'ultrasonic_target' && `Acoustic Target`}
            {activeStimulusTool === 'water_mister' && `💧 Water Mister Cursor (Increases %RH)`}
            {activeStimulusTool === 'dry_air' && `💨 Dry Air Cursor (Decreases %RH)`}
            {activeStimulusTool === 'motion_target' && `🚶 Moving Target Cursor (Triggers PIR)`}
            {activeStimulusTool === 'smoke_plume' && `☁️ Gas / Smoke Plume Cursor (Increases PPM)`}
            {activeStimulusTool === 'tilt_manipulator' && `📐 3-Axis Tilt / Shake Manipulator`}
            {activeStimulusTool === 'watering_can' && `🪣 Watering Can Cursor (Increases Soil Moisture %)`}
            {activeStimulusTool === 'ir_remote' && `📱 38kHz IR Remote Cursor (Triggers IR Receiver)`}
            {activeStimulusTool === 'bar_magnet' && `🧲 Bar Magnet Cursor (Increases Magnetic Flux mT)`}
            {activeStimulusTool === 'hammer_tap' && `🔨 Tap / Hammer Cursor (Triggers Vibration Sensor)`}
            <span className="text-slate-400 font-normal ml-1">• Right-Click or Esc to release</span>
          </div>
        </div>
      )}
    </div>
  );
};
