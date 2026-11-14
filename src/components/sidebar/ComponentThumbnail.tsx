import React from 'react';
import { ComponentDefinition } from '../../types/circuit';
import { ComponentGraphic } from '../circuit-components/ComponentGraphic';

interface ComponentThumbnailProps {
  definition: ComponentDefinition;
  theme: 'dark' | 'light';
  size?: 'sm' | 'lg';
}

export const ComponentThumbnail: React.FC<ComponentThumbnailProps> = ({
  definition,
  theme,
  size = 'lg',
}) => {
  const isDark = theme === 'dark';

  const compType = (definition as any).id || definition.type;
  const mockComponent = {
    id: 'preview',
    type: compType,
    label: definition.defaultDesignator,
    x: 0,
    y: 0,
    rotation: 0,
    mirrored: false,
    properties: definition.defaultProperties,
  };

  const w = Math.max(20, definition.width || 60);
  const h = Math.max(20, definition.height || 60);
  const padX = Math.max(4, Math.round(w * 0.08));
  const padY = Math.max(4, Math.round(h * 0.08));

  const isCentered =
    (definition as any).origin === 'center' ||
    compType === 'arduino-uno' ||
    compType === 'esp32' ||
    compType === 'pico';

  const viewBox = isCentered
    ? `${-w / 2 - padX} ${-h / 2 - padY} ${w + padX * 2} ${h + padY * 2}`
    : `${-padX} ${-padY} ${w + padX * 2} ${h + padY * 2}`;

  const containerClass =
    size === 'sm'
      ? 'w-9 h-9 rounded-md flex items-center justify-center p-0.5 shrink-0 overflow-hidden'
      : `w-16 h-16 rounded-xl border flex items-center justify-center p-1 shrink-0 overflow-hidden transition ${
          isDark
            ? 'bg-slate-950/95 border-slate-700/80 group-hover:border-sky-500/70 group-hover:bg-slate-900 shadow-inner'
            : 'bg-slate-50 border-slate-300 group-hover:border-sky-500 group-hover:bg-white shadow-inner'
        }`;

  return (
    <div className={containerClass}>
      {compType === 'shape' ? (
        <svg viewBox="0 0 64 64" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <rect
            x={8}
            y={12}
            width={32}
            height={28}
            rx={5}
            fill="#6366f1"
            fillOpacity={0.22}
            stroke={isDark ? '#818cf8' : '#4f46e5'}
            strokeWidth={2.5}
          />
          <circle
            cx={42}
            cy={42}
            r={14}
            fill="#38bdf8"
            fillOpacity={0.28}
            stroke={isDark ? '#38bdf8' : '#0284c7'}
            strokeWidth={2.5}
          />
        </svg>
      ) : compType === 'textbox' ? (
        <svg viewBox="0 0 64 64" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <rect
            x={8}
            y={12}
            width={48}
            height={40}
            rx={6}
            fill={isDark ? '#0f172a' : '#ffffff'}
            stroke={isDark ? '#38bdf8' : '#0284c7'}
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          <text
            x={32}
            y={30}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={18}
            fontWeight="700"
            fill={isDark ? '#e2e8f0' : '#0f172a'}
          >
            Aa
          </text>
          <line
            x1={16}
            y1={43}
            x2={48}
            y2={43}
            stroke={isDark ? '#64748b' : '#475569'}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg
          viewBox={viewBox}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full overflow-visible"
          shapeRendering="geometricPrecision"
        >
          <ComponentGraphic
            component={mockComponent}
            definition={definition}
            isSelected={false}
            theme={theme}
          />
        </svg>
      )}
    </div>
  );
};
