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
  const innerRadiusRatio = Math.max(
    0.15,
    Math.min(0.88, Number(p.innerRadiusRatio ?? 0.55) || 0.55)
  );
  const fillColor: string = p.fillColor || '#38bdf8';
  const fillOpacity =
    p.fillOpacity !== undefined ? Math.max(0, Math.min(1, Number(p.fillOpacity))) : 0.08;
  const strokeColor: string = p.strokeColor || '#38bdf8';
  const strokeWidth =
    p.strokeWidth !== undefined ? Math.max(0, Number(p.strokeWidth)) : 2;
  const strokeStyle: string = p.strokeStyle || 'dashed';
  const label: string = typeof p.label === 'string' ? p.label : '';
  const rotation = (((component.rotation || 0) % 360) + 360) % 360;

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
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.round(Math.cos(rad) * 1000) / 1000;
    const sin = Math.round(Math.sin(rad) * 1000) / 1000;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const state = dragRef.current;
      if (!state) return;

      const dxScreen = (moveEvent.clientX - state.startClientX) / effectiveZoom;
      const dyScreen = (moveEvent.clientY - state.startClientY) / effectiveZoom;
      const dx = dxScreen * cos + dyScreen * sin;
      const dy = -dxScreen * sin + dyScreen * cos;

      let nextW = state.initW;
      let nextH = state.initH;

      if (state.handle.includes('e')) {
        nextW = Math.max(40, snapToGrid(state.initW + dx));
      }
      if (state.handle.includes('w')) {
        nextW = Math.max(40, snapToGrid(state.initW - dx));
      }
      if (state.handle.includes('s')) {
        nextH = Math.max(40, snapToGrid(state.initH + dy));
      }
      if (state.handle.includes('n')) {
        nextH = Math.max(40, snapToGrid(state.initH - dy));
      }

      // Keep the opposite edge anchored in world coordinates regardless of 90° rotation
      let dCxLocal = 0;
      let dCyLocal = 0;
      if (state.handle.includes('e')) dCxLocal += (nextW - state.initW) / 2;
      if (state.handle.includes('w')) dCxLocal -= (nextW - state.initW) / 2;
      if (state.handle.includes('s')) dCyLocal += (nextH - state.initH) / 2;
      if (state.handle.includes('n')) dCyLocal -= (nextH - state.initH) / 2;

      const worldCx = state.initX + state.initW / 2 + (dCxLocal * cos - dCyLocal * sin);
      const worldCy = state.initY + state.initH / 2 + (dCxLocal * sin + dCyLocal * cos);
      const nextX = Math.round(worldCx - nextW / 2);
      const nextY = Math.round(worldCy - nextH / 2);

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

  const getRotatedCursor = (cursor: string): string => {
    const isQuarterTurn = Math.round(rotation / 90) % 2 === 1;
    if (!isQuarterTurn) return cursor;
    if (cursor === 'ns-resize') return 'ew-resize';
    if (cursor === 'ew-resize') return 'ns-resize';
    if (cursor === 'nwse-resize') return 'nesw-resize';
    if (cursor === 'nesw-resize') return 'nwse-resize';
    return cursor;
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

    const pt = (nx: number, ny: number) =>
      `${(nx * width).toFixed(1)},${(ny * height).toFixed(1)}`;

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
      case 'hollow-circle': {
        const cx = width / 2;
        const cy = height / 2;
        const rxO = width / 2;
        const ryO = height / 2;
        const rxI = rxO * innerRadiusRatio;
        const ryI = ryO * innerRadiusRatio;
        const d = [
          `M ${(cx - rxO).toFixed(1)},${cy.toFixed(1)}`,
          `A ${rxO.toFixed(1)},${ryO.toFixed(1)} 0 1,0 ${(cx + rxO).toFixed(1)},${cy.toFixed(1)}`,
          `A ${rxO.toFixed(1)},${ryO.toFixed(1)} 0 1,0 ${(cx - rxO).toFixed(1)},${cy.toFixed(1)} Z`,
          `M ${(cx - rxI).toFixed(1)},${cy.toFixed(1)}`,
          `A ${rxI.toFixed(1)},${ryI.toFixed(1)} 0 1,1 ${(cx + rxI).toFixed(1)},${cy.toFixed(1)}`,
          `A ${rxI.toFixed(1)},${ryI.toFixed(1)} 0 1,1 ${(cx - rxI).toFixed(1)},${cy.toFixed(1)} Z`,
        ].join(' ');
        return <path d={d} fillRule="evenodd" {...commonProps} />;
      }
      case 'semi-sphere': {
        const d = `M 0,${height} A ${width / 2},${height} 0 0,1 ${width},${height} Z`;
        return <path d={d} strokeLinejoin="round" {...commonProps} />;
      }
      case 'triangle':
        return (
          <polygon
            points={`${width / 2},0 ${width},${height} 0,${height}`}
            strokeLinejoin="round"
            {...commonProps}
          />
        );
      case 'right-triangle':
        return (
          <polygon
            points={`0,0 ${width},${height} 0,${height}`}
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
      case 'arrow':
        return (
          <polygon
            points={`${pt(0, 0.28)} ${pt(0.62, 0.28)} ${pt(0.62, 0)} ${pt(1, 0.5)} ${pt(0.62, 1)} ${pt(0.62, 0.72)} ${pt(0, 0.72)}`}
            strokeLinejoin="round"
            {...commonProps}
          />
        );
      case 'cloud': {
        const d = [
          `M ${pt(0.19, 0.94)}`,
          `C ${pt(0.01, 0.94)} ${pt(0.0, 0.64)} ${pt(0.11, 0.51)}`,
          `C ${pt(0.07, 0.3)} ${pt(0.24, 0.18)} ${pt(0.35, 0.27)}`,
          `C ${pt(0.41, 0.02)} ${pt(0.66, 0.02)} ${pt(0.71, 0.27)}`,
          `C ${pt(0.84, 0.21)} ${pt(0.96, 0.36)} ${pt(0.89, 0.52)}`,
          `C ${pt(1.0, 0.62)} ${pt(0.98, 0.94)} ${pt(0.8, 0.94)}`,
          'Z',
        ].join(' ');
        return <path d={d} strokeLinejoin="round" {...commonProps} />;
      }
      case 'rectangle':
      default:
        return <rect x={0} y={0} width={width} height={height} rx={2} {...commonProps} />;
    }
  };

  const lines = label.trim() ? label.split('\n') : [];
  const labelCenterX =
    shapeType === 'right-triangle'
      ? width * 0.36
      : shapeType === 'arrow'
      ? width * 0.42
      : width / 2;
  const labelCenterY =
    shapeType === 'triangle'
      ? height * 0.68
      : shapeType === 'right-triangle'
      ? height * 0.72
      : shapeType === 'semi-sphere'
      ? height * 0.64
      : shapeType === 'cloud'
      ? height * 0.58
      : height / 2;

  return (
    <g
      className="select-none"
      transform={rotation ? `rotate(${rotation}, ${width / 2}, ${height / 2})` : undefined}
    >
      {renderGeometry()}

      {lines.length > 0 && (
        <g
          transform={
            rotation ? `rotate(${-rotation}, ${labelCenterX}, ${labelCenterY})` : undefined
          }
        >
          <text
            x={labelCenterX}
            y={labelCenterY - ((lines.length - 1) * 16) / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={13}
            fontWeight={600}
            fill={isDark ? '#e2e8f0' : '#0f172a'}
            pointerEvents="none"
          >
            {lines.map((line, idx) => (
              <tspan key={idx} x={labelCenterX} dy={idx === 0 ? 0 : 16}>
                {line}
              </tspan>
            ))}
          </text>
        </g>
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
                style={{ cursor: getRotatedCursor(cursor) }}
                onMouseDown={startResize(id)}
              />
            );
          })}
        </g>
      )}
    </g>
  );
};
