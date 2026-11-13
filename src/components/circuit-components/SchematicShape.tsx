import React, { useRef } from 'react';
import { CircuitComponent } from '../../types/circuit';
import { useCircuitStore } from '../../store/useCircuitStore';
import { snapToGrid } from '../../utils/geometry';

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface SchematicShapeProps {
  component: CircuitComponent;
  isSelected: boolean;
  theme: 'dark' | 'light';
  zoom: number;
}

const HANDLE_DEFS: Array<{ id: ResizeHandle; cursor: string }> = [
  { id: 'nw', cursor: 'nwse-resize' },
  { id: 'n', cursor: 'ns-resize' },
  { id: 'ne', cursor: 'nesw-resize' },
  { id: 'e', cursor: 'ew-resize' },
  { id: 'se', cursor: 'nwse-resize' },
  { id: 's', cursor: 'ns-resize' },
  { id: 'sw', cursor: 'nesw-resize' },
  { id: 'w', cursor: 'ew-resize' },
];

export const SchematicShape: React.FC<SchematicShapeProps> = ({
  component,
  isSelected,
  theme,
  zoom,
}) => {
  const { updateComponentPos, updateComponentProperty } = useCircuitStore();
  const isDark = theme === 'dark';
  const p = component.properties || {};

  const shapeType: string = p.shapeType || 'rectangle';
  const width = Math.max(40, Number(p.width) || 200);
  const height = Math.max(40, Number(p.height) || 140);
  const fillColor: string = p.fillColor || '#38bdf8';
  const fillOpacity =
    p.fillOpacity !== undefined ? Math.max(0, Math.min(1, Number(p.fillOpacity))) : 0.08;
  const strokeColor: string = p.strokeColor || '#38bdf8';
  const strokeWidth =
    p.strokeWidth !== undefined ? Math.max(0, Number(p.strokeWidth)) : 2;
  const strokeStyle: string = p.strokeStyle || 'dashed';
  const label: string = typeof p.label === 'string' ? p.label : '';

  const dragRef = useRef<{
    handle: ResizeHandle;
    startClientX: number;
    startClientY: number;
    initX: number;
    initY: number;
    initW: number;
    initH: number;
    lastX: number;
    lastY: number;
    lastW: number;
    lastH: number;
  } | null>(null);

  const dashArray =
    strokeStyle === 'dashed'
      ? '6 4'
      : strokeStyle === 'dotted'
      ? '2 3'
      : undefined;

  const effectiveStroke = strokeStyle === 'none' || strokeWidth <= 0 ? 'none' : strokeColor;
  const effectiveStrokeWidth = strokeStyle === 'none' ? 0 : strokeWidth;

  const startResize = (handle: ResizeHandle) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    dragRef.current = {
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initX: component.x,
      initY: component.y,
      initW: width,
      initH: height,
      lastX: component.x,
      lastY: component.y,
      lastW: width,
      lastH: height,
    };

    const effectiveZoom = Math.max(0.2, zoom || 1);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const state = dragRef.current;
      if (!state) return;

      const dx = (moveEvent.clientX - state.startClientX) / effectiveZoom;
      const dy = (moveEvent.clientY - state.startClientY) / effectiveZoom;

      let nextX = state.initX;
      let nextY = state.initY;
      let nextW = state.initW;
      let nextH = state.initH;

      if (state.handle.includes('e')) {
        nextW = Math.max(40, snapToGrid(state.initW + dx));
      }
      if (state.handle.includes('w')) {
        nextW = Math.max(40, snapToGrid(state.initW - dx));
        nextX = state.initX + (state.initW - nextW);
      }
      if (state.handle.includes('s')) {
        nextH = Math.max(40, snapToGrid(state.initH + dy));
      }
      if (state.handle.includes('n')) {
        nextH = Math.max(40, snapToGrid(state.initH - dy));
        nextY = state.initY + (state.initH - nextH);
      }

      if (nextX !== state.lastX || nextY !== state.lastY) {
        updateComponentPos(component.id, nextX, nextY);
        state.lastX = nextX;
        state.lastY = nextY;
      }
      if (nextW !== state.lastW) {
        updateComponentProperty(component.id, 'width', nextW);
        state.lastW = nextW;
      }
      if (nextH !== state.lastH) {
        updateComponentProperty(component.id, 'height', nextH);
        state.lastH = nextH;
      }
    };

    const onMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const getHandleCoords = (handle: ResizeHandle): { cx: number; cy: number } => {
    const cx = handle.includes('w') ? 0 : handle.includes('e') ? width : width / 2;
    const cy = handle.includes('n') ? 0 : handle.includes('s') ? height : height / 2;
    return { cx, cy };
  };

  const renderGeometry = () => {
    const commonProps = {
      fill: fillColor,
      fillOpacity,
      stroke: effectiveStroke,
      strokeWidth: effectiveStrokeWidth,
      strokeDasharray: dashArray,
      pointerEvents: 'all' as const,
      className: 'cursor-move',
    };

    switch (shapeType) {
      case 'rounded':
        return (
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            rx={Math.min(20, Math.min(width, height) * 0.22)}
            {...commonProps}
          />
        );
      case 'circle':
        return (
          <ellipse
            cx={width / 2}
            cy={height / 2}
            rx={width / 2}
            ry={height / 2}
            {...commonProps}
          />
        );
      case 'triangle':
        return (
          <polygon
            points={`${width / 2},0 ${width},${height} 0,${height}`}
            strokeLinejoin="round"
            {...commonProps}
          />
        );
      case 'diamond':
        return (
          <polygon
            points={`${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}`}
            strokeLinejoin="round"
            {...commonProps}
          />
        );
      case 'rectangle':
      default:
        return <rect x={0} y={0} width={width} height={height} rx={2} {...commonProps} />;
    }
  };

  const lines = label.trim() ? label.split('\n') : [];
  const labelCenterY = shapeType === 'triangle' ? height * 0.68 : height / 2;

  return (
    <g className="select-none">
      {renderGeometry()}

      {lines.length > 0 && (
        <text
          x={width / 2}
          y={labelCenterY - ((lines.length - 1) * 16) / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={13}
          fontWeight={600}
          fill={isDark ? '#e2e8f0' : '#0f172a'}
          pointerEvents="none"
        >
          {lines.map((line, idx) => (
            <tspan key={idx} x={width / 2} dy={idx === 0 ? 0 : 16}>
              {line}
            </tspan>
          ))}
        </text>
      )}

      {isSelected && (
        <g>
          <rect
            x={-2}
            y={-2}
            width={width + 4}
            height={height + 4}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={1.25}
            strokeDasharray="4 3"
            pointerEvents="none"
          />
          {HANDLE_DEFS.map(({ id, cursor }) => {
            const { cx, cy } = getHandleCoords(id);
            return (
              <rect
                key={id}
                x={cx - 4.5}
                y={cy - 4.5}
                width={9}
                height={9}
                rx={2}
                fill="#ffffff"
                stroke="#0284c7"
                strokeWidth={1.5}
                style={{ cursor }}
                onMouseDown={startResize(id)}
              />
            );
          })}
        </g>
      )}
    </g>
  );
};
