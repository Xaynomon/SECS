import React from 'react';
import { ComponentDefinition } from '../../types/circuit';
import { ComponentGraphic } from '../circuit-components/ComponentGraphic';

interface ComponentThumbnailProps {
  definition: ComponentDefinition;
  theme: 'dark' | 'light';
}

export const ComponentThumbnail: React.FC<ComponentThumbnailProps> = ({ definition, theme }) => {
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

  const scale = Math.min(36 / Math.max(definition.width, 36), 36 / Math.max(definition.height, 36), 0.7);

  const isCentered =
    (definition as any).origin === 'center' ||
    compType === 'arduino-uno' ||
    compType === 'esp32' ||
    compType === 'pico';

  const viewBox = isCentered
    ? `${-definition.width / 2 - 10} ${-definition.height / 2 - 10} ${definition.width + 20} ${definition.height + 20}`
    : `-10 -10 ${definition.width + 20} ${definition.height + 20}`;

  return (
    <div
      className={`w-12 h-12 rounded-lg border flex items-center justify-center p-1 shrink-0 overflow-hidden transition ${
        isDark
          ? 'bg-slate-950/80 border-slate-800 group-hover:border-sky-500/60 group-hover:bg-slate-900'
          : 'bg-slate-100/90 border-slate-200 group-hover:border-sky-400 group-hover:bg-white'
      }`}
    >
      <svg
        viewBox={viewBox}
        className="w-full h-full"
        style={{ transform: `scale(${scale})` }}
      >
        <ComponentGraphic
          component={mockComponent}
          definition={definition}
          isSelected={false}
          theme={theme}
        />
      </svg>
    </div>
  );
};
