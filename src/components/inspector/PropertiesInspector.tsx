import React, { useState } from 'react';
import {
  Sliders,
  Trash2,
  RotateCw,
  FlipHorizontal,
  Info,
  Layers,
  Activity,
  PanelRightClose,
  PanelRightOpen,
  Link,
  RotateCcw,
  Type,
  Shapes,
  Bold,
  Italic,
  Cpu,
  Code,
  Sun,
  Flame,
  Snowflake,
  Target,
  Sparkles,
  Droplets,
  Wind,
  CloudFog,
  Compass,
  Download,
  FileText,
  Plus,
  Grid,
} from 'lucide-react';
import { useCircuitStore } from '../../store/useCircuitStore';
import { COMPONENT_CATEGORIES, COMPONENT_DEFINITIONS } from '../../constants/componentLibrary';
import { ComponentRegistry } from '../../registry/ComponentRegistry';
import { WIRE_COLORS } from '../../constants/wireColors';
import { ComponentThumbnail } from '../sidebar/ComponentThumbnail';

interface PotentiometerDialProps {
  position: number;
  maxResistance: number;
  onChange: (val: number) => void;
  isDark: boolean;
}

const PotentiometerDial: React.FC<PotentiometerDialProps> = ({
  position,
  maxResistance,
  onChange,
  isDark,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dialRef = React.useRef<SVGSVGElement | null>(null);

  const angle = -135 + (position / 100) * 270;

  const updateFromPointer = (clientX: number, clientY: number) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;

    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    let adjusted = deg - 135;
    while (adjusted < 0) adjusted += 360;
    if (adjusted > 270) {
      adjusted = adjusted > 315 ? 0 : 270;
    }
    const pct = Math.max(0, Math.min(100, Math.round((adjusted / 270) * 100)));
    onChange(pct);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    (e.target as Element).setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateFromPointer(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const r1 = Math.round((position / 100) * maxResistance);
  const r2 = Math.round(((100 - position) / 100) * maxResistance);

  return (
    <div
      className={`p-3 rounded-lg border flex flex-col items-center gap-2 ${
        isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}
    >
      <div className="w-full flex items-center justify-between text-[11px] font-semibold text-sky-400">
        <span>Rotary Wiper Dial</span>
        <span className="font-mono text-xs">{position}%</span>
      </div>

      {/* SVG Knob */}
      <svg
        ref={dialRef}
        width="110"
        height="110"
        viewBox="0 0 100 100"
        className="cursor-grab active:cursor-grabbing select-none touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <circle
          cx="50"
          cy="50"
          r="46"
          fill={isDark ? '#0f172a' : '#f1f5f9'}
          stroke={isDark ? '#334155' : '#cbd5e1'}
          strokeWidth="1.5"
        />
        {/* Track Arc */}
        <path
          d="M 21.7 78.3 A 40 40 0 1 1 78.3 78.3"
          fill="none"
          stroke={isDark ? '#1e293b' : '#e2e8f0'}
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Active Value Arc */}
        <path
          d="M 21.7 78.3 A 40 40 0 1 1 78.3 78.3"
          fill="none"
          stroke="#0284c7"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="188.5"
          strokeDashoffset={188.5 * (1 - (position / 100) * 0.75)}
        />
        {/* Dial Body */}
        <circle
          cx="50"
          cy="50"
          r="32"
          fill={isDark ? '#1e293b' : '#ffffff'}
          stroke={isDark ? '#475569' : '#94a3b8'}
          strokeWidth="2"
        />
        {/* Dial Ridge Textures */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
          <line
            key={d}
            x1="50"
            y1="20"
            x2="50"
            y2="24"
            stroke={isDark ? '#475569' : '#cbd5e1'}
            strokeWidth="1.5"
            transform={`rotate(${d} 50 50)`}
          />
        ))}
        {/* Pointer indicator */}
        <g transform={`rotate(${angle} 50 50)`}>
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="22"
            stroke="#38bdf8"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="50" cy="22" r="3" fill="#ffffff" stroke="#0284c7" strokeWidth="1" />
        </g>
        <circle
          cx="50"
          cy="50"
          r="8"
          fill={isDark ? '#0f172a' : '#e2e8f0'}
          stroke={isDark ? '#38bdf8' : '#0284c7'}
          strokeWidth="2"
        />
      </svg>

      {/* Resistances live readout */}
      <div className="w-full grid grid-cols-2 gap-1 text-[10px] font-mono text-center">
        <div
          className={`p-1 rounded ${
            isDark ? 'bg-slate-900 text-sky-300' : 'bg-white border text-sky-700'
          }`}
        >
          R1: {r1 >= 1000 ? `${(r1 / 1000).toFixed(2)}kΩ` : `${r1}Ω`}
        </div>
        <div
          className={`p-1 rounded ${
            isDark ? 'bg-slate-900 text-amber-300' : 'bg-white border text-amber-700'
          }`}
        >
          R2: {r2 >= 1000 ? `${(r2 / 1000).toFixed(2)}kΩ` : `${r2}Ω`}
        </div>
      </div>

      {/* Quick Presets */}
      <div className="w-full flex items-center justify-between gap-1 pt-1">
        {[0, 25, 50, 75, 100].map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`flex-1 py-0.5 text-[9px] font-mono rounded transition ${
              position === p
                ? 'bg-sky-500 text-white font-bold'
                : isDark
                ? 'bg-slate-800 text-slate-400 hover:text-white'
                : 'bg-slate-200 text-slate-600 hover:text-black'
            }`}
          >
            {p}%
          </button>
        ))}
      </div>
    </div>
  );
};

export const PropertiesInspector: React.FC = () => {
  const {
    theme,
    components,
    wires,
    selectedComponentId,
    selectedWireId,
    updateComponentProperty,
    updateComponentLabel,
    rotateComponent,
    flipComponentHorizontal,
    deleteSelected,
    updateWireColor,
    resetWireWaypoints,
    openCodeEditor,
    activeStimulusTool,
    stimulusIntensity,
    setStimulusTool,
    setStimulusIntensity,
    runSimulationCycle,
  } = useCircuitStore();

  const isDark = theme === 'dark';
  const [collapsed, setCollapsed] = useState(false);
  const [selectedSdFile, setSelectedSdFile] = useState<string>('data.txt');
  const [newSdFileName, setNewSdFileName] = useState<string>('');

  const selectedComp = components.find((c) => c.id === selectedComponentId);
  const selectedWire = wires.find((w) => w.id === selectedWireId);
  const compDef = selectedComp
    ? ((ComponentRegistry.get(selectedComp.type) as any) || COMPONENT_DEFINITIONS[selectedComp.type])
    : null;

  if (collapsed) {
    return (
      <aside
        className={`w-10 border-l flex flex-col items-center py-3 select-none transition-colors ${
          isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
        }`}
      >
        <button
          onClick={() => setCollapsed(false)}
          className={`p-1.5 rounded-lg transition ${
            isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
          }`}
          title="Expand Properties Inspector"
        >
          <PanelRightOpen className="w-5 h-5 text-sky-500" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={`w-80 border-l flex flex-col select-none shrink-0 overflow-y-auto transition-colors ${
        isDark
          ? 'border-slate-800 bg-slate-900 text-slate-100'
          : 'border-slate-200 bg-white text-slate-800'
      }`}
    >
      {/* Header */}
      <div
        className={`p-3 border-b flex items-center justify-between ${
          isDark ? 'border-slate-800' : 'border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-sky-500" />
          <span
            className={`font-bold text-xs uppercase tracking-wider ${
              isDark ? 'text-slate-200' : 'text-slate-800'
            }`}
          >
            Inspector
          </span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className={`p-1 rounded transition ${
            isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
          }`}
          title="Collapse Panel"
        >
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 flex-1 overflow-y-auto space-y-4">
        {/* CASE 1: TEXTBOX ANNOTATION SELECTED */}
        {selectedComp && selectedComp.type === 'textbox' && (
          <div className="space-y-4">
            {/* Header Card */}
            <div
              className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                <Type className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-sky-500">
                  ANNOTATION NOTE
                </span>
                <div
                  className={`font-bold text-sm truncate ${
                    isDark ? 'text-slate-100' : 'text-slate-900'
                  }`}
                >
                  Schematic Text Note
                </div>
              </div>
            </div>

            {/* Note Content Textarea */}
            <div>
              <label
                className={`block text-[11px] font-semibold mb-1 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Note Content
              </label>
              <textarea
                rows={4}
                value={selectedComp.properties.text || ''}
                onChange={(e) => updateComponentProperty(selectedComp.id, 'text', e.target.value)}
                placeholder="Type schematic instructions, notes, or explanations..."
                className={`w-full border rounded-lg p-2.5 text-xs focus:outline-none focus:border-sky-500 transition resize-y font-sans ${
                  isDark
                    ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-600'
                    : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                }`}
              />
            </div>

            {/* Typography Controls */}
            <div>
              <label
                className={`block text-[11px] font-semibold mb-1.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Typography & Font
              </label>
              <div className="flex items-center gap-1.5">
                {/* Size options */}
                <div
                  className={`flex rounded-lg border p-0.5 flex-1 ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'
                  }`}
                >
                  {(['sm', 'md', 'lg', 'xl'] as const).map((sz) => {
                    const active = (selectedComp.properties.fontSize || 'md') === sz;
                    return (
                      <button
                        key={sz}
                        onClick={() => updateComponentProperty(selectedComp.id, 'fontSize', sz)}
                        className={`flex-1 py-1 text-[11px] font-semibold rounded uppercase transition ${
                          active
                            ? 'bg-sky-500 text-white shadow-sm'
                            : isDark
                            ? 'text-slate-400 hover:text-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>

                {/* Bold */}
                <button
                  onClick={() =>
                    updateComponentProperty(
                      selectedComp.id,
                      'fontWeight',
                      selectedComp.properties.fontWeight === 'bold' ? 'normal' : 'bold'
                    )
                  }
                  className={`p-2 rounded-lg border transition ${
                    selectedComp.properties.fontWeight === 'bold'
                      ? 'bg-sky-500 text-white border-sky-400'
                      : isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      : 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900'
                  }`}
                  title="Toggle Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>

                {/* Italic */}
                <button
                  onClick={() =>
                    updateComponentProperty(
                      selectedComp.id,
                      'fontStyle',
                      selectedComp.properties.fontStyle === 'italic' ? 'normal' : 'italic'
                    )
                  }
                  className={`p-2 rounded-lg border transition ${
                    selectedComp.properties.fontStyle === 'italic'
                      ? 'bg-sky-500 text-white border-sky-400'
                      : isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      : 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900'
                  }`}
                  title="Toggle Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Note Theme / Background Style */}
            <div>
              <label
                className={`block text-[11px] font-semibold mb-1.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Card / Sticky Background
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'sticky-yellow', label: 'Yellow Sticky', color: 'bg-amber-300' },
                  { id: 'sticky-blue', label: 'Blue Sticky', color: 'bg-sky-300' },
                  { id: 'sticky-green', label: 'Green Sticky', color: 'bg-emerald-300' },
                  { id: 'card', label: 'Solid Card', color: isDark ? 'bg-slate-800' : 'bg-slate-200' },
                  { id: 'transparent', label: 'Transparent', color: 'border border-dashed border-slate-500' },
                ].map((bg) => {
                  const active = (selectedComp.properties.bgStyle || 'sticky-yellow') === bg.id;
                  return (
                    <button
                      key={bg.id}
                      onClick={() => updateComponentProperty(selectedComp.id, 'bgStyle', bg.id)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-medium transition ${
                        active
                          ? 'border-sky-500 ring-2 ring-sky-500/30'
                          : isDark
                          ? 'border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-300'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full shrink-0 ${bg.color}`} />
                      <span className="truncate">{bg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Border Style */}
            <div>
              <label
                className={`block text-[11px] font-semibold mb-1.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Border Style
              </label>
              <div
                className={`flex rounded-lg border p-0.5 ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'
                }`}
              >
                {(['dashed', 'solid', 'none'] as const).map((bStyle) => {
                  const active = (selectedComp.properties.borderStyle || 'dashed') === bStyle;
                  return (
                    <button
                      key={bStyle}
                      onClick={() => updateComponentProperty(selectedComp.id, 'borderStyle', bStyle)}
                      className={`flex-1 py-1 text-[11px] font-semibold rounded capitalize transition ${
                        active
                          ? 'bg-sky-500 text-white shadow-sm'
                          : isDark
                          ? 'text-slate-400 hover:text-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {bStyle}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dimensions (Width & Height) */}
            <div>
              <label
                className={`block text-[11px] font-semibold mb-1.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Box Dimensions (px)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">Width</span>
                  <input
                    type="number"
                    min="80"
                    step="20"
                    value={selectedComp.properties.boxWidth || 160}
                    onChange={(e) =>
                      updateComponentProperty(
                        selectedComp.id,
                        'boxWidth',
                        Math.max(80, parseInt(e.target.value) || 160)
                      )
                    }
                    className={`w-full border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">Height</span>
                  <input
                    type="number"
                    min="40"
                    step="20"
                    value={selectedComp.properties.boxHeight || 80}
                    onChange={(e) =>
                      updateComponentProperty(
                        selectedComp.id,
                        'boxHeight',
                        Math.max(40, parseInt(e.target.value) || 80)
                      )
                    }
                    className={`w-full border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-100'
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  />
                </div>
              </div>
              <div
                className={`mt-2 text-[10px] font-mono flex items-center justify-between px-1 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                <span>Position: ({selectedComp.x}, {selectedComp.y})</span>
                <span>Pins: 0 (Annotation)</span>
              </div>
            </div>

            {/* Delete Note Button */}
            <button
              onClick={deleteSelected}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 border border-rose-500/30 text-xs font-semibold transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Note</span>
            </button>
          </div>
        )}

        {/* CASE 1B: DIAGRAM SHAPE ANNOTATION SELECTED */}
        {selectedComp && selectedComp.type === 'shape' && (
          <div className="space-y-4">
            {/* Header Card */}
            <div
              className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Shapes className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">
                  DIAGRAM SHAPE
                </span>
                <div
                  className={`font-bold text-sm truncate ${
                    isDark ? 'text-slate-100' : 'text-slate-900'
                  }`}
                >
                  Background Container
                </div>
              </div>
            </div>

            {/* Shape Type */}
            <div>
              <label
                className={`block text-[11px] font-semibold mb-1 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Shape Geometry
              </label>
              <select
                value={selectedComp.properties.shapeType || 'rectangle'}
                onChange={(e) =>
                  updateComponentProperty(selectedComp.id, 'shapeType', e.target.value)
                }
                className={`w-full border rounded px-2.5 py-1.5 text-xs outline-none ${
                  isDark
                    ? 'bg-slate-950 border-slate-700 text-slate-200'
                    : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                <option value="rectangle">Rectangle</option>
                <option value="rounded">Rounded Box</option>
                <option value="circle">Circle / Ellipse</option>
                <option value="hollow-circle">Hollow Circle (Ring)</option>
                <option value="semi-sphere">Semi-Sphere (Dome)</option>
                <option value="triangle">Equilateral Triangle</option>
                <option value="right-triangle">Right-Angle Triangle</option>
                <option value="diamond">Diamond</option>
                <option value="arrow">Block Arrow</option>
                <option value="cloud">Cloud Shape</option>
              </select>
            </div>

            {/* Orientation / 90° Rotation */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  className={`text-[11px] font-semibold ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Orientation
                </label>
                <span className="text-[11px] font-mono text-indigo-400 font-semibold">
                  {(((selectedComp.rotation || 0) % 360) + 360) % 360}°
                </span>
              </div>
              <button
                type="button"
                onClick={() => rotateComponent(selectedComp.id, 90)}
                className={`w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-medium transition ${
                  isDark
                    ? 'bg-slate-950 border-slate-700 hover:bg-slate-800 hover:border-indigo-500/60 text-slate-200'
                    : 'bg-white border-slate-300 hover:bg-indigo-50 hover:border-indigo-400 text-slate-700'
                }`}
              >
                <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
                <span>Rotate 90° (R)</span>
              </button>
            </div>

            {/* Hollow Circle Inner Ring Ratio */}
            {(selectedComp.properties.shapeType || 'rectangle') === 'hollow-circle' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    className={`text-[11px] font-semibold ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    Inner Ring Ratio
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    {Math.round(
                      ((selectedComp.properties.innerRadiusRatio ?? 0.55) as number) * 100
                    )}
                    %
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={0.85}
                  step={0.05}
                  value={selectedComp.properties.innerRadiusRatio ?? 0.55}
                  onChange={(e) =>
                    updateComponentProperty(
                      selectedComp.id,
                      'innerRadiusRatio',
                      Number(e.target.value)
                    )
                  }
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            )}

            {/* Center Label */}
            <div>
              <label
                className={`block text-[11px] font-semibold mb-1 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Center Label (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., Power Stage"
                value={selectedComp.properties.label || ''}
                onChange={(e) =>
                  updateComponentProperty(selectedComp.id, 'label', e.target.value)
                }
                className={`w-full border rounded px-2.5 py-1.5 text-xs outline-none ${
                  isDark
                    ? 'bg-slate-950 border-slate-700 text-slate-200'
                    : 'bg-white border-slate-300 text-slate-800'
                }`}
              />
            </div>

            {/* Dimensions */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  className={`block text-[11px] font-semibold mb-1 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Width (px)
                </label>
                <input
                  type="number"
                  min={40}
                  max={1600}
                  step={20}
                  value={selectedComp.properties.width || 200}
                  onChange={(e) =>
                    updateComponentProperty(
                      selectedComp.id,
                      'width',
                      Math.max(40, Number(e.target.value) || 40)
                    )
                  }
                  className={`w-full border rounded px-2 py-1 text-xs font-mono outline-none ${
                    isDark
                      ? 'bg-slate-950 border-slate-700 text-slate-200'
                      : 'bg-white border-slate-300 text-slate-800'
                  }`}
                />
              </div>
              <div>
                <label
                  className={`block text-[11px] font-semibold mb-1 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Height (px)
                </label>
                <input
                  type="number"
                  min={40}
                  max={1600}
                  step={20}
                  value={selectedComp.properties.height || 140}
                  onChange={(e) =>
                    updateComponentProperty(
                      selectedComp.id,
                      'height',
                      Math.max(40, Number(e.target.value) || 40)
                    )
                  }
                  className={`w-full border rounded px-2 py-1 text-xs font-mono outline-none ${
                    isDark
                      ? 'bg-slate-950 border-slate-700 text-slate-200'
                      : 'bg-white border-slate-300 text-slate-800'
                  }`}
                />
              </div>
            </div>

            {/* Fill Color & Opacity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  className={`text-[11px] font-semibold ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Fill Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={selectedComp.properties.fillColor || '#38bdf8'}
                    onChange={(e) =>
                      updateComponentProperty(selectedComp.id, 'fillColor', e.target.value)
                    }
                    className="w-7 h-6 rounded border-0 cursor-pointer bg-transparent p-0"
                  />
                  <span className="text-[11px] font-mono text-slate-400">
                    {selectedComp.properties.fillColor || '#38bdf8'}
                  </span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    className={`text-[11px] font-semibold ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    Fill Opacity
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    {Math.round(
                      ((selectedComp.properties.fillOpacity ?? 0.08) as number) * 100
                    )}
                    %
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={selectedComp.properties.fillOpacity ?? 0.08}
                  onChange={(e) =>
                    updateComponentProperty(
                      selectedComp.id,
                      'fillOpacity',
                      Number(e.target.value)
                    )
                  }
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Stroke Color, Width & Style */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  className={`text-[11px] font-semibold ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Stroke Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={selectedComp.properties.strokeColor || '#38bdf8'}
                    onChange={(e) =>
                      updateComponentProperty(selectedComp.id, 'strokeColor', e.target.value)
                    }
                    className="w-7 h-6 rounded border-0 cursor-pointer bg-transparent p-0"
                  />
                  <span className="text-[11px] font-mono text-slate-400">
                    {selectedComp.properties.strokeColor || '#38bdf8'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    className={`block text-[11px] font-semibold mb-1 ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    Stroke Width
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={selectedComp.properties.strokeWidth ?? 2}
                    onChange={(e) =>
                      updateComponentProperty(
                        selectedComp.id,
                        'strokeWidth',
                        Math.max(0, Number(e.target.value))
                      )
                    }
                    className={`w-full border rounded px-2 py-1 text-xs font-mono outline-none ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-200'
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  />
                </div>
                <div>
                  <label
                    className={`block text-[11px] font-semibold mb-1 ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    Stroke Style
                  </label>
                  <select
                    value={selectedComp.properties.strokeStyle || 'dashed'}
                    onChange={(e) =>
                      updateComponentProperty(selectedComp.id, 'strokeStyle', e.target.value)
                    }
                    className={`w-full border rounded px-2 py-1 text-xs outline-none ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-slate-200'
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
            </div>

            <div
              className={`text-[10px] font-mono flex items-center justify-between px-1 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              <span>
                Position: ({selectedComp.x}, {selectedComp.y})
              </span>
              <span>Layer: Background</span>
            </div>

            <button
              onClick={deleteSelected}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 border border-rose-500/30 text-xs font-semibold transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Shape</span>
            </button>
          </div>
        )}

        {/* CASE 2: STANDARD ELECTRICAL COMPONENT SELECTED */}
        {selectedComp && compDef && selectedComp.type !== 'textbox' && selectedComp.type !== 'shape' && (
          <div className="space-y-4">
            {/* Component Summary Card */}
            <div
              className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-slate-950/60 border-slate-800'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <ComponentThumbnail definition={compDef as any} theme={theme} />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-sky-500">
                  {COMPONENT_CATEGORIES.find((cat) => cat.id === compDef.category)?.label ||
                    compDef.category}
                </span>
                <div
                  className={`font-bold text-sm truncate ${
                    isDark ? 'text-slate-100' : 'text-slate-900'
                  }`}
                >
                  {compDef.name}
                </div>
              </div>
            </div>

            {/* Designator / Label */}
            <div>
              <label
                className={`block text-[11px] font-semibold mb-1 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Reference Designator
              </label>
              <input
                type="text"
                value={selectedComp.label}
                onChange={(e) => updateComponentLabel(selectedComp.id, e.target.value)}
                className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 transition ${
                  isDark
                    ? 'bg-slate-950 border-slate-700 text-slate-100'
                    : 'bg-white border-slate-300 text-slate-800'
                }`}
              />
            </div>

            {/* Orientation & Transform Controls */}
            <div>
              <label
                className={`block text-[11px] font-semibold mb-1.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Orientation & Placement
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => rotateComponent(selectedComp.id, 90)}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs transition ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Rotate 90° ({selectedComp.rotation}°)
                </button>
                <button
                  onClick={() => flipComponentHorizontal(selectedComp.id)}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs transition ${
                    selectedComp.mirrored
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-400/40'
                      : isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  Flip H
                </button>
              </div>
              <div
                className={`mt-2 text-[10px] font-mono flex items-center justify-between px-1 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                <span>Position: ({selectedComp.x}, {selectedComp.y})</span>
                <span>Pins: {compDef.pins.length}</span>
              </div>
            </div>

            {/* Programmable Microcontroller Section */}
            {(selectedComp.type === 'arduino-uno' || selectedComp.type === 'esp32' || selectedComp.type === 'pico') && (
              <div
                className={`p-3 rounded-lg border flex flex-col gap-2 ${
                  isDark ? 'bg-teal-950/40 border-teal-800/60' : 'bg-teal-50 border-teal-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-teal-400" />
                  <span className="text-xs font-bold text-teal-400">Programmable Firmware</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Write and upload C++ sketches, control pins, and inspect Serial Monitor output in real-time.
                </p>
                <button
                  onClick={() => openCodeEditor(selectedComp.id)}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-teal-600 hover:bg-teal-500 text-white rounded-md text-xs font-medium transition shadow-sm"
                >
                  <Code className="w-4 h-4" />
                  <span>Edit Code & Serial</span>
                </button>
              </div>
            )}

            {/* 8-Bit Programmable Assembly Microprocessor (SECS-808 CPU) */}
            {(selectedComp.type === 'builtin_cpu_8bit' || selectedComp.type === 'cpu-8bit') && (() => {
              const regs = selectedComp.properties.asmRegisters || {
                acc: 0,
                regB: 0,
                pc: 0,
                zeroFlag: false,
                carryFlag: false,
                currentMnemonic: 'NOP',
              };
              const accHex = '0x' + (regs.acc & 0xff).toString(16).toUpperCase().padStart(2, '0');
              const accBin = (regs.acc & 0xff).toString(2).padStart(8, '0');
              const regBHex = '0x' + (regs.regB & 0xff).toString(16).toUpperCase().padStart(2, '0');
              return (
                <div
                  className={`p-3 rounded-lg border flex flex-col gap-2.5 ${
                    isDark ? 'bg-indigo-950/40 border-indigo-800/60' : 'bg-indigo-50 border-indigo-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-indigo-400">SECS-808 Assembly CPU</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {regs.currentMnemonic || 'NOP'}
                    </span>
                  </div>

                  {/* Live CPU Register Bar */}
                  <div
                    className={`p-2 rounded-lg border font-mono text-[10px] space-y-1.5 ${
                      isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">ACC:</span>
                      <span className="font-bold text-amber-400">
                        {accHex} <span className="text-slate-500">({accBin})</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-800/60 text-center">
                      <div>
                        <span className="text-slate-500 block text-[9px]">REG B</span>
                        <span className="font-bold text-sky-400">{regBHex}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px]">PC</span>
                        <span className="font-bold text-emerald-400">L{regs.pc ?? 0}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px]">FLAGS</span>
                        <span className="font-bold text-purple-400">
                          Z:{regs.zeroFlag ? 1 : 0} C:{regs.carryFlag ? 1 : 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => openCodeEditor(selectedComp.id)}
                    className="flex items-center justify-center gap-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-medium transition shadow-sm"
                  >
                    <Code className="w-4 h-4" />
                    <span>Assembly IDE & Registers</span>
                  </button>
                </div>
              );
            })()}

            {/* Interactive Stimulus Tools */}
            {(selectedComp.type === 'light-sensor' ||
              selectedComp.type === 'temp-sensor' ||
              selectedComp.type === 'ultrasonic' ||
              selectedComp.type === 'potentiometer' ||
              selectedComp.type === 'builtin_humidity_sensor' ||
              selectedComp.type === 'humidity-sensor' ||
              selectedComp.type === 'builtin_motion_sensor' ||
              selectedComp.type === 'motion-sensor' ||
              selectedComp.type === 'builtin_gas_sensor' ||
              selectedComp.type === 'gas-sensor' ||
              selectedComp.type === 'builtin_accelerometer' ||
              selectedComp.type === 'accelerometer') && (
              <div
                className={`p-3 rounded-lg border space-y-2.5 ${
                  isDark
                    ? 'bg-amber-950/20 border-amber-800/40'
                    : 'bg-amber-50/70 border-amber-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-500">
                    Interactive Stimulus Tool
                  </span>
                </div>

                {selectedComp.type === 'light-sensor' && (
                  <div className="space-y-2">
                    <p
                      className={`text-[11px] leading-relaxed ${
                        isDark ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      Grab a physical lightbulb cursor to illuminate this photoresistor across the canvas.
                    </p>
                    <button
                      onClick={() =>
                        setStimulusTool(
                          activeStimulusTool === 'lightbulb' ? 'none' : 'lightbulb',
                          stimulusIntensity || 1000
                        )
                      }
                      className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition shadow-sm ${
                        activeStimulusTool === 'lightbulb'
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-amber-500/30 ring-2 ring-amber-400'
                          : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      <Sun className="w-4 h-4" />
                      <span>
                        {activeStimulusTool === 'lightbulb'
                          ? '💡 Lightbulb Active (Click to Release)'
                          : '💡 Grab Lightbulb Cursor'}
                      </span>
                    </button>
                    {activeStimulusTool === 'lightbulb' && (
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[11px]">
                          <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                            Bulb Brightness:
                          </span>
                          <span className="font-mono text-amber-400 font-bold">
                            {stimulusIntensity} Lux
                          </span>
                        </div>
                        <input
                          type="range"
                          min="100"
                          max="3000"
                          step="50"
                          value={stimulusIntensity}
                          onChange={(e) => setStimulusIntensity(parseInt(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                        <p className="text-[10px] text-slate-400 italic">
                          Move cursor near sensor on canvas. Right-Click or Esc to release.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {selectedComp.type === 'temp-sensor' && (
                  <div className="space-y-2">
                    <p
                      className={`text-[11px] leading-relaxed ${
                        isDark ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      Grab heat or cold physical environment tools to change TMP36 temperature.
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() =>
                          setStimulusTool(
                            activeStimulusTool === 'matchstick' ? 'none' : 'matchstick',
                            125
                          )
                        }
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-semibold transition ${
                          activeStimulusTool === 'matchstick'
                            ? 'bg-orange-500 text-white font-bold ring-2 ring-orange-400'
                            : 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30'
                        }`}
                      >
                        <Flame className="w-3.5 h-3.5" />
                        <span>🔥 Matchstick</span>
                      </button>
                      <button
                        onClick={() =>
                          setStimulusTool(
                            activeStimulusTool === 'ice' ? 'none' : 'ice',
                            -20
                          )
                        }
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-semibold transition ${
                          activeStimulusTool === 'ice'
                            ? 'bg-cyan-500 text-slate-950 font-bold ring-2 ring-cyan-400'
                            : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30'
                        }`}
                      >
                        <Snowflake className="w-3.5 h-3.5" />
                        <span>❄️ Ice Cube</span>
                      </button>
                    </div>
                    {activeStimulusTool === 'matchstick' && (
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[11px]">
                          <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                            Flame Heat:
                          </span>
                          <span className="font-mono text-orange-400 font-bold">
                            {stimulusIntensity}°C
                          </span>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="200"
                          step="5"
                          value={stimulusIntensity}
                          onChange={(e) => setStimulusIntensity(parseInt(e.target.value))}
                          className="w-full accent-orange-500 cursor-pointer"
                        />
                      </div>
                    )}
                    {activeStimulusTool === 'ice' && (
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[11px]">
                          <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                            Ice Temp:
                          </span>
                          <span className="font-mono text-cyan-400 font-bold">
                            {stimulusIntensity}°C
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-40"
                          max="5"
                          step="1"
                          value={stimulusIntensity}
                          onChange={(e) => setStimulusIntensity(parseInt(e.target.value))}
                          className="w-full accent-cyan-500 cursor-pointer"
                        />
                      </div>
                    )}
                    <div
                      className={`p-1.5 rounded text-[11px] font-mono flex justify-between ${
                        isDark
                          ? 'bg-slate-900/80 text-emerald-400'
                          : 'bg-white border text-emerald-700'
                      }`}
                    >
                      <span>Current TMP36:</span>
                      <span>
                        {selectedComp.properties.temperatureC ?? 25}°C (
                        {(
                          0.5 +
                          0.01 * (selectedComp.properties.temperatureC ?? 25)
                        ).toFixed(2)}
                        V)
                      </span>
                    </div>
                  </div>
                )}

                {selectedComp.type === 'ultrasonic' && (
                  <div className="space-y-2">
                    <p
                      className={`text-[11px] leading-relaxed ${
                        isDark ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      Grab an acoustic target reflector to test ultrasonic distance measurements.
                    </p>
                    <button
                      onClick={() =>
                        setStimulusTool(
                          activeStimulusTool === 'ultrasonic_target'
                            ? 'none'
                            : 'ultrasonic_target',
                          50
                        )
                      }
                      className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition shadow-sm ${
                        activeStimulusTool === 'ultrasonic_target'
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow-emerald-500/30 ring-2 ring-emerald-400'
                          : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      <Target className="w-4 h-4" />
                      <span>
                        {activeStimulusTool === 'ultrasonic_target'
                          ? '🎯 Target Active (Click to Release)'
                          : '🎯 Grab Target Object Cursor'}
                      </span>
                    </button>
                    <div
                      className={`p-1.5 rounded text-[11px] font-mono flex justify-between ${
                        isDark
                          ? 'bg-slate-900/80 text-emerald-400'
                          : 'bg-white border text-emerald-700'
                      }`}
                    >
                      <span>Echo Distance:</span>
                      <span>{selectedComp.properties.distanceCm ?? 50} cm</span>
                    </div>
                  </div>
                )}

                {selectedComp.type === 'potentiometer' && (
                  <PotentiometerDial
                    position={selectedComp.properties.position ?? 50}
                    maxResistance={selectedComp.properties.maxResistance ?? 10000}
                    onChange={(val) => {
                      updateComponentProperty(selectedComp.id, 'position', val);
                      runSimulationCycle(0);
                    }}
                    isDark={isDark}
                  />
                )}

                {/* 1. HUMIDITY SENSOR (DHT22) STIMULUS TOOLS */}
                {(selectedComp.type === 'builtin_humidity_sensor' ||
                  selectedComp.type === 'humidity-sensor') && (
                  <div className="space-y-2">
                    <p
                      className={`text-[11px] leading-relaxed ${
                        isDark ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      Grab a Water Mister or Dry Air Blower cursor to change relative humidity (%RH) on the canvas.
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() =>
                          setStimulusTool(
                            activeStimulusTool === 'water_mister' ? 'none' : 'water_mister',
                            95
                          )
                        }
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-semibold transition ${
                          activeStimulusTool === 'water_mister'
                            ? 'bg-sky-500 text-slate-950 font-bold ring-2 ring-sky-400'
                            : 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30'
                        }`}
                      >
                        <Droplets className="w-3.5 h-3.5" />
                        <span>💧 Grab Water Mister Cursor</span>
                      </button>
                      <button
                        onClick={() =>
                          setStimulusTool(
                            activeStimulusTool === 'dry_air' ? 'none' : 'dry_air',
                            10
                          )
                        }
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-semibold transition ${
                          activeStimulusTool === 'dry_air'
                            ? 'bg-amber-500 text-slate-950 font-bold ring-2 ring-amber-400'
                            : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        <Wind className="w-3.5 h-3.5" />
                        <span>💨 Grab Dry Air Cursor</span>
                      </button>
                    </div>
                    <div
                      className={`p-1.5 rounded text-[11px] font-mono flex justify-between ${
                        isDark
                          ? 'bg-slate-900/80 text-sky-400'
                          : 'bg-white border text-sky-700'
                      }`}
                    >
                      <span>Humidity:</span>
                      <span>
                        {selectedComp.properties.humidity ?? 45}% RH (
                        {(5.0 * ((selectedComp.properties.humidity ?? 45) / 100)).toFixed(2)}V)
                      </span>
                    </div>
                  </div>
                )}

                {/* 4. PIR MOTION SENSOR (HC-SR501) STIMULUS TOOL */}
                {(selectedComp.type === 'builtin_motion_sensor' ||
                  selectedComp.type === 'motion-sensor') && (
                  <div className="space-y-2">
                    <p
                      className={`text-[11px] leading-relaxed ${
                        isDark ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      Grab a Moving Target cursor to walk across the PIR Fresnel cone, or trigger motion manually.
                    </p>
                    <button
                      onClick={() =>
                        setStimulusTool(
                          activeStimulusTool === 'motion_target' ? 'none' : 'motion_target',
                          100
                        )
                      }
                      className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition shadow-sm ${
                        activeStimulusTool === 'motion_target'
                          ? 'bg-emerald-500 text-slate-950 font-bold ring-2 ring-emerald-400'
                          : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      <Target className="w-4 h-4" />
                      <span>
                        {activeStimulusTool === 'motion_target'
                          ? '🚶 Moving Target Active (Click to Release)'
                          : '🚶 Grab Moving Target Cursor'}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        updateComponentProperty(
                          selectedComp.id,
                          'motionDetected',
                          !selectedComp.properties.motionDetected
                        );
                        runSimulationCycle(0);
                      }}
                      className={`w-full py-1.5 px-2 rounded text-[11px] font-mono font-bold transition border ${
                        selectedComp.properties.motionDetected
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                          : isDark
                          ? 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      {selectedComp.properties.motionDetected
                        ? '🔴 MOTION DETECTED (OUT = 3.3V HIGH)'
                        : '⚪ IDLE — Click to Trigger Motion'}
                    </button>
                  </div>
                )}

                {/* 5. GAS / SMOKE SENSOR (MQ-2) STIMULUS TOOL */}
                {(selectedComp.type === 'builtin_gas_sensor' ||
                  selectedComp.type === 'gas-sensor') && (
                  <div className="space-y-2">
                    <p
                      className={`text-[11px] leading-relaxed ${
                        isDark ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      Grab a Gas / Smoke Plume cursor and hover near the MQ-2 mesh to test gas detection.
                    </p>
                    <button
                      onClick={() =>
                        setStimulusTool(
                          activeStimulusTool === 'smoke_plume' ? 'none' : 'smoke_plume',
                          1500
                        )
                      }
                      className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition shadow-sm ${
                        activeStimulusTool === 'smoke_plume'
                          ? 'bg-purple-500 text-white font-bold ring-2 ring-purple-400'
                          : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30'
                      }`}
                    >
                      <CloudFog className="w-4 h-4" />
                      <span>
                        {activeStimulusTool === 'smoke_plume'
                          ? '☁️ Smoke Plume Active (Click to Release)'
                          : '☁️ Grab Gas / Smoke Plume Cursor'}
                      </span>
                    </button>
                    <div
                      className={`p-1.5 rounded text-[11px] font-mono flex justify-between ${
                        isDark
                          ? 'bg-slate-900/80 text-purple-400'
                          : 'bg-white border text-purple-700'
                      }`}
                    >
                      <span>Gas Concentration:</span>
                      <span>
                        {selectedComp.properties.ppm ?? 120} ppm (AO:{' '}
                        {(0.2 + 4.6 * ((selectedComp.properties.ppm ?? 120) / 2000)).toFixed(2)}V)
                      </span>
                    </div>
                  </div>
                )}

                {/* 6. 3-AXIS ACCELEROMETER (ADXL335) STIMULUS TOOL */}
                {(selectedComp.type === 'builtin_accelerometer' ||
                  selectedComp.type === 'accelerometer') && (
                  <div className="space-y-2">
                    <p
                      className={`text-[11px] leading-relaxed ${
                        isDark ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      Grab the Tilt / Shake Manipulator cursor to tilt the sensor in 2D space on the canvas, or adjust X/Y/Z sliders below.
                    </p>
                    <button
                      onClick={() =>
                        setStimulusTool(
                          activeStimulusTool === 'tilt_manipulator' ? 'none' : 'tilt_manipulator',
                          100
                        )
                      }
                      className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition shadow-sm ${
                        activeStimulusTool === 'tilt_manipulator'
                          ? 'bg-cyan-500 text-slate-950 font-bold ring-2 ring-cyan-400'
                          : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30'
                      }`}
                    >
                      <Compass className="w-4 h-4" />
                      <span>
                        {activeStimulusTool === 'tilt_manipulator'
                          ? '📐 Tilt Cursor Active (Click to Release)'
                          : '📐 Grab Tilt / Shake Manipulator Cursor'}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        updateComponentProperty(selectedComp.id, 'accelX', 0);
                        updateComponentProperty(selectedComp.id, 'accelY', 0);
                        updateComponentProperty(selectedComp.id, 'accelZ', 1.0);
                        runSimulationCycle(0);
                      }}
                      className={`w-full py-1 rounded text-[10px] font-mono border transition ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                          : 'bg-white border-slate-300 text-slate-700'
                      }`}
                    >
                      Reset Flat Level (X=0g, Y=0g, Z=+1.0g)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* OLED Graphic Display Interactive Text Panel */}
            {(selectedComp.type === 'builtin_oled_display' ||
              selectedComp.type === 'oled-display') && (
              <div
                className={`p-3 rounded-lg border space-y-2 ${
                  isDark ? 'bg-sky-950/30 border-sky-800/50' : 'bg-sky-50 border-sky-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-400">OLED Screen Buffer</span>
                  <button
                    onClick={() => updateComponentProperty(selectedComp.id, 'displayText', '')}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={selectedComp.properties.displayText ?? 'SECS OLED\n128x64 I2C\nREADY'}
                  onChange={(e) =>
                    updateComponentProperty(selectedComp.id, 'displayText', e.target.value)
                  }
                  placeholder="Type multi-line text for OLED screen..."
                  className={`w-full border rounded-lg p-2 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                    isDark
                      ? 'bg-slate-950 border-slate-700 text-sky-300'
                      : 'bg-white border-slate-300 text-slate-800'
                  }`}
                />
              </div>
            )}

            {/* 16x2 Character LCD Interactive Text Panel */}
            {(selectedComp.type === 'builtin_lcd_16x2' ||
              selectedComp.type === 'lcd-16x2') && (
              <div
                className={`p-3 rounded-lg border space-y-2 ${
                  isDark ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-emerald-50 border-emerald-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400">16x2 Character Matrix</span>
                  <button
                    onClick={() => {
                      updateComponentProperty(selectedComp.id, 'row1Text', '');
                      updateComponentProperty(selectedComp.id, 'row2Text', '');
                    }}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                  >
                    Clear LCD
                  </button>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-0.5">
                    Row 0 (16 chars max)
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    value={selectedComp.properties.row1Text ?? 'SECS 16x2 LCD'}
                    onChange={(e) =>
                      updateComponentProperty(selectedComp.id, 'row1Text', e.target.value)
                    }
                    className={`w-full border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-emerald-500 ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-emerald-300'
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-0.5">
                    Row 1 (16 chars max)
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    value={selectedComp.properties.row2Text ?? 'STATUS: ONLINE'}
                    onChange={(e) =>
                      updateComponentProperty(selectedComp.id, 'row2Text', e.target.value)
                    }
                    className={`w-full border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-emerald-500 ${
                      isDark
                        ? 'bg-slate-950 border-slate-700 text-emerald-300'
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* MicroSD Card Reader — Virtual SD Card Files Manager */}
            {(selectedComp.type === 'builtin_sd_card' ||
              selectedComp.type === 'sd-card') && (() => {
              const files: Record<string, string> = selectedComp.properties.files || {
                'data.txt': 'SECS Telemetry Log\n2026-01-01,OK\n',
                'log.csv': 'time_ms,voltage_v\n0,5.00\n',
              };
              const fileNames = Object.keys(files);
              const activeFile = fileNames.includes(selectedSdFile)
                ? selectedSdFile
                : fileNames[0] || 'data.txt';
              const activeContent = files[activeFile] ?? '';

              const handleDownloadSdFile = () => {
                const blob = new Blob([activeContent], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = activeFile;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              };

              const handleAddSdFile = () => {
                const cleanName = (newSdFileName.trim() || `file_${fileNames.length + 1}.txt`);
                const updated = { ...files, [cleanName]: '' };
                updateComponentProperty(selectedComp.id, 'files', updated);
                setSelectedSdFile(cleanName);
                setNewSdFileName('');
              };

              return (
                <div
                  className={`p-3 rounded-lg border space-y-2.5 ${
                    isDark ? 'bg-amber-950/20 border-amber-800/50' : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-amber-400">
                        Virtual SD Card Files
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {fileNames.length} file(s)
                    </span>
                  </div>

                  {/* File Tabs */}
                  <div className="flex flex-wrap gap-1">
                    {fileNames.map((fname) => (
                      <button
                        key={fname}
                        onClick={() => setSelectedSdFile(fname)}
                        className={`px-2 py-1 rounded text-[10px] font-mono transition ${
                          activeFile === fname
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : isDark
                            ? 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                            : 'bg-white text-slate-700 border border-slate-300'
                        }`}
                      >
                        {fname}
                      </button>
                    ))}
                  </div>

                  {/* Create New File Row */}
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newSdFileName}
                      onChange={(e) => setNewSdFileName(e.target.value)}
                      placeholder="New file (e.g. sensor.csv)"
                      className={`flex-1 border rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-amber-500 ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-slate-200'
                          : 'bg-white border-slate-300 text-slate-800'
                      }`}
                    />
                    <button
                      onClick={handleAddSdFile}
                      className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-[11px] font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>

                  {/* File Content Editor */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                      <span>{activeFile}</span>
                      <span>{activeContent.length} bytes</span>
                    </div>
                    <textarea
                      rows={4}
                      value={activeContent}
                      onChange={(e) => {
                        const updated = { ...files, [activeFile]: e.target.value };
                        updateComponentProperty(selectedComp.id, 'files', updated);
                      }}
                      placeholder="File contents (MCU SD.println appends here)..."
                      className={`w-full border rounded-lg p-2 text-[11px] font-mono focus:outline-none focus:border-amber-500 ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-amber-200'
                          : 'bg-white border-slate-300 text-slate-800'
                      }`}
                    />
                  </div>

                  {/* Download File to PC Button */}
                  <button
                    onClick={handleDownloadSdFile}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File ({activeFile})</span>
                  </button>
                </div>
              );
            })()}

            {/* 4x4 Matrix Membrane Numpad Interactive Keypad */}
            {(selectedComp.type === 'builtin_numpad' ||
              selectedComp.type === 'numpad') && (() => {
              const keys = [
                '1', '2', '3', 'A',
                '4', '5', '6', 'B',
                '7', '8', '9', 'C',
                '*', '0', '#', 'D',
              ];
              const pressedKey = String(
                selectedComp.properties.activeKey ?? selectedComp.properties.pressedKey ?? ''
              );
              const keyIdx = keys.indexOf(pressedKey);
              const activeRow = keyIdx >= 0 ? Math.floor(keyIdx / 4) + 1 : null;
              const activeCol = keyIdx >= 0 ? (keyIdx % 4) + 1 : null;

              return (
                <div
                  className={`p-3 rounded-lg border space-y-2.5 ${
                    isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Grid className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-bold text-sky-400">4x4 Matrix Keypad</span>
                    </div>
                    {pressedKey ? (
                      <button
                        onClick={() => {
                          updateComponentProperty(selectedComp.id, 'activeKey', '');
                          updateComponentProperty(selectedComp.id, 'pressedKey', '');
                          runSimulationCycle(0);
                        }}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      >
                        Release &apos;{pressedKey}&apos;
                      </button>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-500">No key pressed</span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {keys.map((k) => {
                      const isPressed = pressedKey === k;
                      const isLetter = ['A', 'B', 'C', 'D'].includes(k);
                      const isSymbol = ['*', '#'].includes(k);
                      return (
                        <button
                          key={k}
                          onClick={() => {
                            const nextKey = isPressed ? '' : k;
                            updateComponentProperty(selectedComp.id, 'activeKey', nextKey);
                            updateComponentProperty(selectedComp.id, 'pressedKey', nextKey);
                            runSimulationCycle(0);
                          }}
                          className={`py-2 rounded-md font-mono text-xs font-bold border transition ${
                            isPressed
                              ? 'bg-sky-500 text-white border-sky-300 shadow-md scale-95'
                              : isLetter
                              ? 'bg-rose-600/80 hover:bg-rose-500 text-white border-rose-500/50'
                              : isSymbol
                              ? 'bg-amber-600/80 hover:bg-amber-500 text-white border-amber-500/50'
                              : isDark
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                              : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                          }`}
                        >
                          {k}
                        </button>
                      );
                    })}
                  </div>

                  <div
                    className={`p-1.5 rounded text-[10px] font-mono flex items-center justify-between ${
                      isDark ? 'bg-slate-900 text-slate-300' : 'bg-white border text-slate-700'
                    }`}
                  >
                    <span>Matrix Short:</span>
                    <span className={activeRow ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {activeRow ? `R${activeRow} ↔ C${activeCol} (OUT = HIGH)` : 'Open Circuit'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Protective Fuse Interactive Controls */}
            {selectedComp.type === 'builtin_fuse' && (() => {
              const isBlown = selectedComp.properties.isBlown === true || selectedComp.state?.isBlown === true;
              const maxI = typeof selectedComp.properties.maxCurrent === 'number' ? selectedComp.properties.maxCurrent : 0.1;
              return (
                <div className={`p-3 rounded-lg border space-y-2.5 ${isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400">Protective Fuse</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isBlown ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {isBlown ? '⚡ BLOWN' : 'INTACT'}
                    </span>
                  </div>
                  {isBlown && (
                    <button
                      onClick={() => {
                        updateComponentProperty(selectedComp.id, 'isBlown', false);
                        runSimulationCycle(0);
                      }}
                      className="w-full py-1.5 rounded text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition"
                    >
                      🔄 Reset / Replace Fuse
                    </button>
                  )}
                  <div className="text-[10px] text-slate-400 font-mono">
                    Rating: {(maxI * 1000).toFixed(0)}mA (Blows on overcurrent)
                  </div>
                </div>
              );
            })()}

            {/* 4-Bit DIP Switch Bank Controls */}
            {selectedComp.type === 'builtin_dip_switch_4' && (() => {
              const pullup = selectedComp.properties.internalPullup === true;
              return (
                <div className={`p-3 rounded-lg border space-y-2.5 ${isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-400">4-Bit DIP Switches</span>
                    <button
                      onClick={() => {
                        updateComponentProperty(selectedComp.id, 'internalPullup', !pullup);
                        runSimulationCycle(0);
                      }}
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition ${
                        pullup ? 'bg-sky-500/20 text-sky-400 border-sky-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {pullup ? 'Pull-Up: ON' : 'Pull-Up: OFF'}
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4].map((idx) => {
                      const isOn = selectedComp.properties[`sw${idx}`] === true;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            updateComponentProperty(selectedComp.id, `sw${idx}`, !isOn);
                            runSimulationCycle(0);
                          }}
                          className={`py-1.5 rounded text-xs font-bold border transition ${
                            isOn
                              ? 'bg-red-600 text-white border-red-400 shadow-sm shadow-red-500/30'
                              : isDark
                              ? 'bg-slate-800 text-slate-400 border-slate-700'
                              : 'bg-white text-slate-600 border-slate-300'
                          }`}
                        >
                          SW{idx}: {isOn ? 'ON' : 'OFF'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Solar Panel Irradiance & Cursor Grab */}
            {selectedComp.type === 'builtin_solar_panel' && (() => {
              const lux = typeof selectedComp.properties.lux === 'number' ? selectedComp.properties.lux : 100;
              const maxV = typeof selectedComp.properties.maxVoltage === 'number' ? selectedComp.properties.maxVoltage : 6.0;
              const vGen = Math.min(maxV, 0.5 + (lux / 1000) * (maxV - 0.5));
              return (
                <div className={`p-3 rounded-lg border space-y-2.5 ${isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400">☀️ Photovoltaic Cell</span>
                    <span className="text-xs font-mono font-bold text-sky-400">{vGen.toFixed(2)}V</span>
                  </div>
                  <button
                    onClick={() => {
                      setStimulusTool('lightbulb');
                    }}
                    className="w-full py-1.5 rounded text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition"
                  >
                    💡 Grab Sunlight / Bulb Cursor
                  </button>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Irradiance:</span>
                      <span className="font-mono text-amber-400 font-bold">{lux} lux</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2000"
                      step="25"
                      value={lux}
                      onChange={(e) => {
                        updateComponentProperty(selectedComp.id, 'lux', Number(e.target.value));
                        runSimulationCycle(0);
                      }}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                  </div>
                </div>
              );
            })()}

            {/* 2-Axis Analog Joystick Pad */}
            {selectedComp.type === 'builtin_joystick' && (() => {
              const jx = typeof selectedComp.properties.joyX === 'number' ? selectedComp.properties.joyX : 0;
              const jy = typeof selectedComp.properties.joyY === 'number' ? selectedComp.properties.joyY : 0;
              const pressed = selectedComp.properties.isPressed === true;
              return (
                <div className={`p-3 rounded-lg border space-y-2.5 ${isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-400">Analog 2D Joystick</span>
                    <button
                      onClick={() => {
                        updateComponentProperty(selectedComp.id, 'isPressed', !pressed);
                        runSimulationCycle(0);
                      }}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition ${
                        pressed ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {pressed ? 'SW: PRESSED' : 'SW: OPEN'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-slate-400">X: {jx}%</span>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="5"
                        value={jx}
                        onChange={(e) => {
                          updateComponentProperty(selectedComp.id, 'joyX', Number(e.target.value));
                          runSimulationCycle(0);
                        }}
                        className="w-full h-1.5 bg-slate-700 rounded-lg accent-sky-400"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400">Y: {jy}%</span>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="5"
                        value={jy}
                        onChange={(e) => {
                          updateComponentProperty(selectedComp.id, 'joyY', Number(e.target.value));
                          runSimulationCycle(0);
                        }}
                        className="w-full h-1.5 bg-slate-700 rounded-lg accent-sky-400"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Stepper Motor Controls */}
            {selectedComp.type === 'builtin_stepper_motor' && (() => {
              const angle = typeof selectedComp.properties.angle === 'number' ? selectedComp.properties.angle : (typeof selectedComp.state?.angle === 'number' ? selectedComp.state.angle : 0);
              return (
                <div className={`p-3 rounded-lg border space-y-2.5 ${isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-400">NEMA-17 Stepper</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">{Math.round(angle)}°</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        const nextAngle = (angle - 15 + 360) % 360;
                        updateComponentProperty(selectedComp.id, 'angle', nextAngle);
                        runSimulationCycle(0);
                      }}
                      className="py-1 rounded text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                    >
                      ↺ Step CCW (-15°)
                    </button>
                    <button
                      onClick={() => {
                        const nextAngle = (angle + 15 + 360) % 360;
                        updateComponentProperty(selectedComp.id, 'angle', nextAngle);
                        runSimulationCycle(0);
                      }}
                      className="py-1 rounded text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                    >
                      ↻ Step CW (+15°)
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* PHASE 7.9: Soil Moisture Sensor Controls & Watering Can Cursor */}
            {selectedComp.type === 'builtin_soil_moisture' && (() => {
              const moisture = typeof selectedComp.properties.moisture === 'number' ? selectedComp.properties.moisture : 20;
              const threshold = typeof selectedComp.properties.threshold === 'number' ? selectedComp.properties.threshold : 50;
              const triggerOnDry = selectedComp.properties.triggerOnDry === true;
              const isTrig = triggerOnDry ? moisture < threshold : moisture >= threshold;
              return (
                <div className={`p-3 rounded-lg border space-y-2.5 ${isDark ? 'bg-sky-950/25 border-sky-800/50' : 'bg-sky-50 border-sky-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-400">💧 Soil Moisture Probe</span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isTrig ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'}`}>
                      OUT: {isTrig ? 'HIGH (5V)' : 'LOW (0V)'}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setStimulusTool(
                        activeStimulusTool === 'watering_can' ? 'none' : 'watering_can',
                        100
                      )
                    }
                    className={`w-full py-2 px-3 rounded-md text-xs font-semibold transition shadow-sm ${
                      activeStimulusTool === 'watering_can'
                        ? 'bg-sky-500 text-slate-950 font-bold ring-2 ring-sky-300'
                        : 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40'
                    }`}
                  >
                    {activeStimulusTool === 'watering_can'
                      ? '🪣 Watering Can Active (Click to Release)'
                      : '🪣 Grab Watering Can Cursor'}
                  </button>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Soil Moisture:</span>
                      <span className="font-mono text-sky-400 font-bold">{moisture}% (Thresh: {threshold}%)</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={moisture}
                      onChange={(e) => {
                        updateComponentProperty(selectedComp.id, 'moisture', Number(e.target.value));
                        runSimulationCycle(0);
                      }}
                      className="w-full h-1.5 bg-slate-700 rounded-lg accent-sky-400 cursor-pointer"
                    />
                  </div>
                  <button
                    onClick={() => {
                      updateComponentProperty(selectedComp.id, 'triggerOnDry', !triggerOnDry);
                      runSimulationCycle(0);
                    }}
                    className={`w-full py-1.5 px-2 rounded text-[11px] font-mono font-bold border transition ${
                      triggerOnDry
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {triggerOnDry ? '🌵 Mode: Trigger HIGH when DRY (< Thresh)' : '🌊 Mode: Trigger HIGH when WET (≥ Thresh)'}
                  </button>
                </div>
              );
            })()}

            {/* PHASE 7.9: Traffic Light LED Module Status */}
            {selectedComp.type === 'builtin_traffic_light' && (() => {
              const rLit = selectedComp.state?.redLit === true;
              const yLit = selectedComp.state?.yellowLit === true;
              const gLit = selectedComp.state?.greenLit === true;
              return (
                <div className={`p-3 rounded-lg border space-y-2 ${isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-xs font-bold text-slate-300 block">🚦 Traffic Signal Lamps</span>
                  <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-mono font-bold">
                    <div className={`py-1.5 rounded border ${rLit ? 'bg-red-500/25 text-red-400 border-red-500/50' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                      RED: {rLit ? 'ON' : 'OFF'}
                    </div>
                    <div className={`py-1.5 rounded border ${yLit ? 'bg-amber-500/25 text-amber-300 border-amber-500/50' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                      YEL: {yLit ? 'ON' : 'OFF'}
                    </div>
                    <div className={`py-1.5 rounded border ${gLit ? 'bg-emerald-500/25 text-emerald-400 border-emerald-500/50' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                      GRN: {gLit ? 'ON' : 'OFF'}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* PHASE 7.9: Submersible DC Water Pump Telemetry */}
            {selectedComp.type === 'builtin_water_pump' && (() => {
              const isRunning = selectedComp.state?.isRunning === true || (selectedComp.state?.flowRateLpm ?? 0) > 0;
              const flowRate = selectedComp.state?.flowRateLpm ?? 0;
              return (
                <div className={`p-3 rounded-lg border space-y-1.5 ${isDark ? 'bg-sky-950/25 border-sky-800/50' : 'bg-sky-50 border-sky-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-400">🌊 Submersible Pump</span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isRunning ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'bg-slate-800 text-slate-400'}`}>
                      {isRunning ? `PUMPING (${flowRate.toFixed(1)} L/min)` : 'IDLE (0.0 L/min)'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* PHASE 7.9: Wireless RF Radio + Antenna Controls */}
            {selectedComp.type === 'builtin_rf_radio' && (() => {
              const isTx = selectedComp.state?.isTransmitting === true;
              const isRx = selectedComp.state?.isReceiving === true;
              const channel = selectedComp.properties.rfChannel || 'CH 1 (433.0 MHz)';
              return (
                <div className={`p-3 rounded-lg border space-y-2 ${isDark ? 'bg-emerald-950/25 border-emerald-800/50' : 'bg-emerald-50 border-emerald-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400">📡 Wireless RF Bridge</span>
                    <span className="text-[10px] font-mono text-emerald-300">{channel}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-center text-[10px] font-mono font-bold">
                    <div className={`py-1.5 rounded border ${isTx ? 'bg-sky-500/25 text-sky-300 border-sky-500/50' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                      TX: {isTx ? 'BROADCASTING' : 'IDLE'}
                    </div>
                    <div className={`py-1.5 rounded border ${isRx ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                      RX: {isRx ? 'RECEIVING (5V)' : 'LISTENING (0V)'}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* PHASE 7.9: Infrared (IR) Receiver Controls & IR Remote Cursor */}
            {selectedComp.type === 'builtin_ir_rx' && (() => {
              const isRx = selectedComp.state?.isReceivingIr === true || selectedComp.state?.logicOutput === 1 || selectedComp.properties.irDetected === true;
              return (
                <div className={`p-3 rounded-lg border space-y-2.5 ${isDark ? 'bg-fuchsia-950/25 border-fuchsia-800/50' : 'bg-fuchsia-50 border-fuchsia-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-fuchsia-400">📱 IR Receiver (38kHz)</span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isRx ? 'bg-fuchsia-500/25 text-fuchsia-300 border border-fuchsia-500/50' : 'bg-slate-800 text-slate-400'}`}>
                      {isRx ? 'IR DETECTED (5V)' : 'NO BEAM (0V)'}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setStimulusTool(
                        activeStimulusTool === 'ir_remote' ? 'none' : 'ir_remote',
                        100
                      )
                    }
                    className={`w-full py-2 px-3 rounded-md text-xs font-semibold transition shadow-sm ${
                      activeStimulusTool === 'ir_remote'
                        ? 'bg-fuchsia-500 text-slate-950 font-bold ring-2 ring-fuchsia-300'
                        : 'bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-300 border border-fuchsia-500/40'
                    }`}
                  >
                    {activeStimulusTool === 'ir_remote'
                      ? '📱 IR Remote Active (Click to Release)'
                      : '📱 Grab IR Remote Cursor'}
                  </button>
                </div>
              );
            })()}

            {/* PHASE 7.9: Hall-Effect Magnetic Sensor Controls & Bar Magnet Cursor */}
            {selectedComp.type === 'builtin_hall_sensor' && (() => {
              const mag = typeof selectedComp.properties.magneticField === 'number' ? selectedComp.properties.magneticField : 0;
              const threshold = typeof selectedComp.properties.threshold === 'number' ? selectedComp.properties.threshold : 30;
              const isTrig = mag >= threshold;
              return (
                <div className={`p-3 rounded-lg border space-y-2.5 ${isDark ? 'bg-indigo-950/25 border-indigo-800/50' : 'bg-indigo-50 border-indigo-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400">🧲 Hall Sensor (A3144)</span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isTrig ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'}`}>
                      {isTrig ? 'MAGNET DETECTED (5V)' : 'IDLE (0V)'}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setStimulusTool(
                        activeStimulusTool === 'bar_magnet' ? 'none' : 'bar_magnet',
                        100
                      )
                    }
                    className={`w-full py-2 px-3 rounded-md text-xs font-semibold transition shadow-sm ${
                      activeStimulusTool === 'bar_magnet'
                        ? 'bg-indigo-500 text-white font-bold ring-2 ring-indigo-300'
                        : 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40'
                    }`}
                  >
                    {activeStimulusTool === 'bar_magnet'
                      ? '🧲 Bar Magnet Active (Click to Release)'
                      : '🧲 Grab Bar Magnet Cursor'}
                  </button>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Magnetic Flux Density:</span>
                      <span className="font-mono text-indigo-400 font-bold">{mag} mT (Thresh: {threshold} mT)</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={mag}
                      onChange={(e) => {
                        updateComponentProperty(selectedComp.id, 'magneticField', Number(e.target.value));
                        runSimulationCycle(0);
                      }}
                      className="w-full h-1.5 bg-slate-700 rounded-lg accent-indigo-400 cursor-pointer"
                    />
                  </div>
                </div>
              );
            })()}

            {/* PHASE 7.9: Vibration / Knock Sensor Controls & Tap Hammer Cursor */}
            {selectedComp.type === 'builtin_vibration_sensor' && (() => {
              const isVib = selectedComp.properties.vibrationDetected === true || selectedComp.state?.logicOutput === 1;
              return (
                <div className={`p-3 rounded-lg border space-y-2.5 ${isDark ? 'bg-amber-950/25 border-amber-800/50' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400">🔨 Vibration Sensor (SW-420)</span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isVib ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50' : 'bg-slate-800 text-slate-400'}`}>
                      {isVib ? 'SHOCK PULSE (5V)' : 'CALM (0V)'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      updateComponentProperty(selectedComp.id, 'vibrationDetected', true);
                      runSimulationCycle(0);
                      setTimeout(() => {
                        updateComponentProperty(selectedComp.id, 'vibrationDetected', false);
                        runSimulationCycle(0);
                      }, 1000);
                    }}
                    className="w-full py-2 px-3 rounded-md text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-sm"
                  >
                    🔨 Tap / Knock Sensor Now (1.0s Pulse)
                  </button>
                  <button
                    onClick={() =>
                      setStimulusTool(
                        activeStimulusTool === 'hammer_tap' ? 'none' : 'hammer_tap',
                        100
                      )
                    }
                    className={`w-full py-1.5 px-3 rounded-md text-xs font-semibold transition ${
                      activeStimulusTool === 'hammer_tap'
                        ? 'bg-amber-400 text-slate-950 font-bold ring-2 ring-amber-300'
                        : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {activeStimulusTool === 'hammer_tap'
                      ? '🔨 Hammer Cursor Active (Click to Release)'
                      : '🔨 Grab Tap / Hammer Cursor'}
                  </button>
                </div>
              );
            })()}

            {/* PHASE 7.9: Linear Push-Pull Solenoid Status */}
            {selectedComp.type === 'builtin_solenoid' && (() => {
              const isEngaged = selectedComp.state?.isEngaged === true;
              return (
                <div className={`p-3 rounded-lg border space-y-1.5 ${isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400">🧲 Linear Solenoid</span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isEngaged ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'}`}>
                      {isEngaged ? 'STATE: ACTUATED ➡️' : 'STATE: RETRACTED ⬅️'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* PHASE 7.9: 8Ω Dynamic Audio Speaker Controls */}
            {selectedComp.type === 'builtin_speaker' && (() => {
              const isSounding = selectedComp.state?.isSounding === true;
              const audioEnabled = selectedComp.properties.audioEnabled === true;
              return (
                <div className={`p-3 rounded-lg border space-y-2 ${isDark ? 'bg-sky-950/25 border-sky-800/50' : 'bg-sky-50 border-sky-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-400">🔊 8Ω Dynamic Speaker</span>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isSounding ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'bg-slate-800 text-slate-400'}`}>
                      {isSounding ? 'VIBRATING 🎵' : 'SILENT'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      updateComponentProperty(selectedComp.id, 'audioEnabled', !audioEnabled);
                      runSimulationCycle(0);
                    }}
                    className={`w-full py-1.5 px-3 rounded-md text-xs font-bold border transition ${
                      audioEnabled
                        ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                  >
                    {audioEnabled ? '🔊 WebAudio Sound: ON' : '🔇 Enable WebAudio Sound'}
                  </button>
                </div>
              );
            })()}

            {/* Editable Electrical Parameters */}
            {compDef.propertySchema && compDef.propertySchema.length > 0 && (
              <div
                className={`space-y-3 pt-2 border-t ${
                  isDark ? 'border-slate-800' : 'border-slate-200'
                }`}
              >
                <span
                  className={`text-xs font-bold uppercase tracking-wider block ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  Electrical Parameters
                </span>

                {compDef.propertySchema.map((item: any) => {
                  const currentValue =
                    selectedComp.properties[item.key] ?? compDef.defaultProperties[item.key];

                  return (
                    <div key={item.key}>
                      <div
                        className={`flex items-center justify-between text-[11px] font-medium mb-1 ${
                          isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}
                      >
                        <span>{item.label}</span>
                        {item.unit && <span className="font-mono text-sky-500">{item.unit}</span>}
                      </div>

                      {item.type === 'number' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={item.min}
                            max={item.max}
                            step={item.step || 1}
                            value={currentValue ?? ''}
                            onChange={(e) => {
                              updateComponentProperty(
                                selectedComp.id,
                                item.key,
                                parseFloat(e.target.value) || 0
                              );
                              runSimulationCycle(0);
                            }}
                            className={`flex-1 border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                              isDark
                                ? 'bg-slate-950 border-slate-700 text-slate-100'
                                : 'bg-white border-slate-300 text-slate-800'
                            }`}
                          />
                        </div>
                      )}

                      {((item.type as string) === 'string' || (item.type as string) === 'text') && (
                        <input
                          type="text"
                          value={currentValue ?? ''}
                          onChange={(e) => {
                            updateComponentProperty(selectedComp.id, item.key, e.target.value);
                            runSimulationCycle(0);
                          }}
                          className={`w-full border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                            isDark
                              ? 'bg-slate-950 border-slate-700 text-slate-100'
                              : 'bg-white border-slate-300 text-slate-800'
                          }`}
                        />
                      )}

                      {item.type === 'select' && (
                        <select
                          value={currentValue ?? ''}
                          onChange={(e) => {
                            updateComponentProperty(
                              selectedComp.id,
                              item.key,
                              isNaN(Number(e.target.value))
                                ? e.target.value
                                : Number(e.target.value)
                            );
                            runSimulationCycle(0);
                          }}
                          className={`w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-sky-500 ${
                            isDark
                              ? 'bg-slate-950 border-slate-700 text-slate-100'
                              : 'bg-white border-slate-300 text-slate-800'
                          }`}
                        >
                          {item.options?.map((opt: any) => (
                            <option key={opt.label} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}

                      {item.type === 'boolean' && (
                        <button
                          onClick={() => {
                            updateComponentProperty(selectedComp.id, item.key, !currentValue);
                            runSimulationCycle(0);
                          }}
                          className={`w-full py-1.5 px-3 rounded text-xs font-semibold transition ${
                            currentValue
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/40'
                              : isDark
                              ? 'bg-slate-800 text-slate-400 border border-transparent'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {currentValue ? 'Enabled / Active' : 'Disabled / Inactive'}
                        </button>
                      )}

                      {item.type === 'color' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={currentValue || '#ef4444'}
                            onChange={(e) =>
                              updateComponentProperty(selectedComp.id, item.key, e.target.value)
                            }
                            className="w-8 h-8 rounded border border-slate-300 cursor-pointer bg-transparent"
                          />
                          <span
                            className={`text-xs font-mono ${
                              isDark ? 'text-slate-300' : 'text-slate-700'
                            }`}
                          >
                            {currentValue}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Interactive Pin Terminals Table */}
            <div
              className={`pt-2 border-t ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <span
                className={`text-xs font-bold uppercase tracking-wider block mb-2 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Terminals & Pins
              </span>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {compDef.pins.map((pin: any) => {
                  const isConnected = wires.some(
                    (w) =>
                      (w.fromCompId === selectedComp.id && w.fromPinId === pin.id) ||
                      (w.toCompId === selectedComp.id && w.toPinId === pin.id)
                  );
                  return (
                    <div
                      key={pin.id}
                      className={`flex items-center justify-between px-2 py-1 rounded text-[11px] ${
                        isDark ? 'bg-slate-950/40' : 'bg-slate-50 border border-slate-200/60'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isConnected ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        <span
                          className={`font-mono ${
                            isDark ? 'text-slate-200' : 'text-slate-800'
                          }`}
                        >
                          {pin.name}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] uppercase font-mono ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        {isConnected ? 'Connected' : 'Open'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Delete Component Button */}
            <button
              onClick={deleteSelected}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 border border-rose-500/30 text-xs font-semibold transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Component
            </button>
          </div>
        )}

        {/* CASE 2: WIRE SELECTED */}
        {selectedWire && (
          <div className="space-y-4">
            <div
              className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-slate-950/60 border-slate-800'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <Link className="w-5 h-5 text-sky-500" />
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-sky-500">
                  Connection Link
                </span>
                <div
                  className={`font-bold text-xs font-mono truncate ${
                    isDark ? 'text-slate-200' : 'text-slate-900'
                  }`}
                >
                  {selectedWire.id}
                </div>
              </div>
            </div>

            {/* Wire Color Selection */}
            <div>
              <label
                className={`block text-[11px] font-semibold mb-2 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                Wire Insulation Color
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {WIRE_COLORS.map((wColor) => (
                  <button
                    key={wColor.value}
                    onClick={() => updateWireColor(selectedWire.id, wColor.value)}
                    className={`flex items-center gap-1.5 p-1.5 rounded border text-[10px] transition ${
                      selectedWire.color === wColor.value
                        ? 'border-sky-500 bg-sky-500/10 text-sky-500 font-bold'
                        : isDark
                        ? 'border-slate-800 hover:bg-slate-800 text-slate-300'
                        : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/30"
                      style={{ backgroundColor: wColor.value }}
                    />
                    <span className="truncate">{wColor.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Connected Endpoints */}
            <div
              className={`p-2.5 rounded-lg border space-y-2 text-xs ${
                isDark
                  ? 'bg-slate-950/40 border-slate-800 text-slate-400'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>From Node:</span>
                <span
                  className={`font-mono font-semibold ${
                    isDark ? 'text-slate-200' : 'text-slate-800'
                  }`}
                >
                  {components.find((c) => c.id === selectedWire.fromCompId)?.label ||
                    selectedWire.fromCompId}{' '}
                  ({selectedWire.fromPinId})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>To Node:</span>
                <span
                  className={`font-mono font-semibold ${
                    isDark ? 'text-slate-200' : 'text-slate-800'
                  }`}
                >
                  {components.find((c) => c.id === selectedWire.toCompId)?.label ||
                    selectedWire.toCompId}{' '}
                  ({selectedWire.toPinId})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Waypoints:</span>
                <span className="font-mono text-sky-500 font-semibold">
                  {selectedWire.waypoints ? selectedWire.waypoints.length : 0} bend(s)
                </span>
              </div>
            </div>

            {/* Reset Wire Path Button */}
            <button
              onClick={() => resetWireWaypoints(selectedWire.id)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-500 border border-sky-500/30 text-xs font-semibold transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Wire Path (Auto-Route)
            </button>

            {/* Delete Wire Button */}
            <button
              onClick={deleteSelected}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 border border-rose-500/30 text-xs font-semibold transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Wire
            </button>
          </div>
        )}

        {/* CASE 3: NOTHING SELECTED */}
        {!selectedComp && !selectedWire && (
          <div className="text-center py-8 space-y-4">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
                isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
              }`}
            >
              <Info className="w-6 h-6" />
            </div>
            <div>
              <div
                className={`text-xs font-bold ${
                  isDark ? 'text-slate-300' : 'text-slate-800'
                }`}
              >
                No Selection
              </div>
              <p
                className={`text-[11px] mt-1 max-w-[200px] mx-auto ${
                  isDark ? 'text-slate-500' : 'text-slate-500'
                }`}
              >
                Click any component or wire to inspect and modify its properties.
              </p>
            </div>

            {/* Circuit Stats */}
            <div
              className={`p-3 rounded-lg border text-left space-y-2 ${
                isDark
                  ? 'bg-slate-950/50 border-slate-800'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Circuit Statistics
              </div>
              <div
                className={`flex items-center justify-between text-xs ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky-500" /> Components
                </span>
                <span className="font-mono font-bold">{components.length}</span>
              </div>
              <div
                className={`flex items-center justify-between text-xs ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" /> Net Wires
                </span>
                <span className="font-mono font-bold">{wires.length}</span>
              </div>
            </div>

            {/* Quick Shortcuts Cheat-sheet */}
            <div
              className={`p-3 rounded-lg border text-left space-y-1.5 text-[11px] ${
                isDark
                  ? 'bg-slate-950/50 border-slate-800 text-slate-400'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <div
                className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Quick Shortcuts
              </div>
              <div className="flex justify-between">
                <span>Pan Canvas:</span>
                <kbd className="font-mono font-semibold">Space + Drag</kbd>
              </div>
              <div className="flex justify-between">
                <span>Rotate:</span>
                <kbd className="font-mono font-semibold">R</kbd>
              </div>
              <div className="flex justify-between">
                <span>Flip:</span>
                <kbd className="font-mono font-semibold">F</kbd>
              </div>
              <div className="flex justify-between">
                <span>Delete:</span>
                <kbd className="font-mono font-semibold">Del / Backspace</kbd>
              </div>
              <div className="flex justify-between">
                <span>Cancel Wire:</span>
                <kbd className="font-mono font-semibold">Esc / Right-Click</kbd>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
